import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Fathom OAuth Callback Edge Function
 *
 * Purpose: Handle OAuth callback from Fathom, exchange code for tokens
 * Flow: Fathom redirects here → Exchange code → Store tokens → Redirect to app
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')
    const errorDescription = url.searchParams.get('error_description')

    // Check for OAuth errors from Fathom
    if (error) {
      console.error('❌ OAuth error from Fathom:', error, errorDescription)
      return new Response(
        `<!DOCTYPE html>
        <html>
          <head><title>Fathom Connection Failed</title></head>
          <body>
            <h1>Connection Failed</h1>
            <p>Error: ${error}</p>
            <p>${errorDescription || ''}</p>
            <a href="/">Return to App</a>
            <script>
              // Auto-close window after 5 seconds if opened in popup
              setTimeout(() => {
                if (window.opener) {
                  window.close();
                } else {
                  window.location.href = '/integrations';
                }
              }, 5000);
            </script>
          </body>
        </html>`,
        {
          status: 400,
          headers: { 'Content-Type': 'text/html' },
        }
      )
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter')
    }

    console.log('🔐 Processing OAuth callback')

    // Use service role to bypass RLS for token storage
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    )

    // Validate state (CSRF protection)
    const { data: stateRecord, error: stateError } = await supabase
      .from('fathom_oauth_states')
      .select('*')
      .eq('state', state)
      .single()

    if (stateError || !stateRecord) {
      throw new Error('Invalid state parameter - possible CSRF attack')
    }

    // Check if state is expired
    if (new Date(stateRecord.expires_at) < new Date()) {
      throw new Error('State expired - please try again')
    }

    const userId = stateRecord.user_id

    // Delete used state
    await supabase
      .from('fathom_oauth_states')
      .delete()
      .eq('state', state)

    // Get OAuth configuration
    const clientId = Deno.env.get('VITE_FATHOM_CLIENT_ID')
    const clientSecret = Deno.env.get('VITE_FATHOM_CLIENT_SECRET')
    const redirectUri = Deno.env.get('VITE_FATHOM_REDIRECT_URI')

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Missing Fathom OAuth configuration')
    }

    console.log('🔄 Exchanging authorization code for tokens')

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://fathom.video/external/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Token exchange failed:', errorText)
      throw new Error(`Token exchange failed: ${errorText}`)
    }

    const tokenData = await tokenResponse.json()

    console.log('✅ Tokens received from Fathom')

    // Get Fathom user info
    let fathomUserId: string | null = null
    let fathomUserEmail: string | null = null

    try {
      const userInfoResponse = await fetch('https://api.fathom.video/v1/me', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      })

      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json()
        fathomUserId = userInfo.id
        fathomUserEmail = userInfo.email
        console.log('✅ Fathom user info retrieved:', fathomUserEmail)
      }
    } catch (error) {
      console.warn('⚠️  Could not fetch Fathom user info:', error)
      // Continue anyway - this is not critical
    }

    // Calculate token expiry
    const expiresIn = tokenData.expires_in || 3600 // Default 1 hour
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    // Store tokens in database
    const { data: integration, error: insertError } = await supabase
      .from('fathom_integrations')
      .upsert({
        user_id: userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: tokenExpiresAt,
        fathom_user_id: fathomUserId,
        fathom_user_email: fathomUserEmail,
        scopes: tokenData.scope?.split(' ') || ['calls:read', 'analytics:read', 'highlights:write'],
        is_active: true,
        last_sync_at: null,
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Failed to store integration:', insertError)
      throw new Error(`Failed to store integration: ${insertError.message}`)
    }

    console.log('✅ Integration stored successfully:', integration.id)

    // Create initial sync state
    const { error: syncStateError } = await supabase
      .from('fathom_sync_state')
      .upsert({
        user_id: userId,
        integration_id: integration.id,
        sync_status: 'idle',
        meetings_synced: 0,
        total_meetings_found: 0,
      }, {
        onConflict: 'user_id',
      })

    if (syncStateError) {
      console.warn('⚠️  Failed to create sync state:', syncStateError)
      // Continue anyway - sync state can be created later
    }

    console.log('🎉 OAuth flow completed successfully')

    // Redirect to sync configuration page
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Fathom Connected!</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: rgba(255, 255, 255, 0.1);
              backdrop-filter: blur(10px);
              border-radius: 20px;
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            }
            h1 { margin: 0 0 1rem; font-size: 2.5rem; }
            p { margin: 0.5rem 0; opacity: 0.9; }
            .spinner {
              margin: 2rem auto;
              width: 50px;
              height: 50px;
              border: 4px solid rgba(255, 255, 255, 0.3);
              border-top-color: white;
              border-radius: 50%;
              animation: spin 1s linear infinite;
            }
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Fathom Connected!</h1>
            <p>Your Fathom account has been successfully connected.</p>
            <p>Redirecting to sync configuration...</p>
            <div class="spinner"></div>
          </div>
          <script>
            // Send message to parent window if opened in popup
            if (window.opener) {
              window.opener.postMessage({
                type: 'fathom-oauth-success',
                integrationId: '${integration.id}',
                userId: '${userId}'
              }, '*');
            }

            // Redirect after 2 seconds
            setTimeout(() => {
              if (window.opener) {
                window.close();
              } else {
                window.location.href = '/integrations?fathom=connected';
              }
            }, 2000);
          </script>
        </body>
      </html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    )
  } catch (error) {
    console.error('❌ OAuth callback error:', error)

    return new Response(
      `<!DOCTYPE html>
      <html>
        <head><title>Connection Failed</title></head>
        <body>
          <h1>Fathom Connection Failed</h1>
          <p>Error: ${error.message}</p>
          <a href="/integrations">Return to Integrations</a>
          <script>
            setTimeout(() => {
              if (window.opener) {
                window.close();
              } else {
                window.location.href = '/integrations';
              }
            }, 5000);
          </script>
        </body>
      </html>`,
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' },
      }
    )
  }
})
