import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { captureException } from "../_shared/sentryEdge.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const publicUrl =
  Deno.env.get('PUBLIC_URL') ||
  Deno.env.get('APP_URL') ||
  Deno.env.get('SITE_URL') ||
  'https://use60.com'

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
    // Get code and state from request body (POST) or URL params (GET redirect)
    let code: string | null = null
    let state: string | null = null
    let error: string | null = null
    let errorDescription: string | null = null

    if (req.method === 'POST') {
      const body = await req.json()
      code = body.code
      state = body.state
    } else {
      const url = new URL(req.url)
      code = url.searchParams.get('code')
      state = url.searchParams.get('state')
      error = url.searchParams.get('error')
      errorDescription = url.searchParams.get('error_description')
    }

    // Check for OAuth errors from Fathom
    if (error) {
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
    const stateOrgId: string | null = (stateRecord as any).org_id || null

    // Delete used state
    await supabase
      .from('fathom_oauth_states')
      .delete()
      .eq('state', state)

    // Get OAuth configuration
    const clientId = Deno.env.get('FATHOM_CLIENT_ID')
    const clientSecret = Deno.env.get('FATHOM_CLIENT_SECRET')
    const redirectUri = Deno.env.get('FATHOM_REDIRECT_URI')

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Missing Fathom OAuth configuration')
    }
    // Exchange authorization code for access token
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    })

    const tokenResponse = await fetch('https://fathom.video/external/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      throw new Error(`Token exchange failed: ${errorText}`)
    }

    const tokenData = await tokenResponse.json()
    // Get Fathom user info - try multiple endpoints and methods
    let fathomUserId: string | null = null
    let fathomUserEmail: string | null = null
    let fathomTeamId: string | null = null
    let fathomTeamName: string | null = null

    try {
      console.log('[fathom-oauth] Fetching user info from /me endpoint...')

      // OAuth tokens may use Bearer authentication instead of X-Api-Key
      // Try Bearer first (standard OAuth), then fallback to X-Api-Key
      let userInfoResponse = await fetch('https://api.fathom.ai/external/v1/me', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      })

      if (!userInfoResponse.ok) {
        console.log('[fathom-oauth] Bearer auth failed, trying X-Api-Key...')
        // Try with X-Api-Key instead
        userInfoResponse = await fetch('https://api.fathom.ai/external/v1/me', {
          headers: {
            'X-Api-Key': tokenData.access_token,
          },
        })
      }

      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json()
        console.log('[fathom-oauth] User info response:', JSON.stringify(userInfo))

        fathomUserId = userInfo.id || userInfo.user_id || null
        fathomUserEmail = userInfo.email || userInfo.user_email || null

        // Extract team info if available
        if (userInfo.team) {
          fathomTeamId = userInfo.team.id || userInfo.team_id || null
          fathomTeamName = userInfo.team.name || userInfo.team_name || null
        } else {
          fathomTeamId = userInfo.team_id || null
          fathomTeamName = userInfo.team_name || null
        }

        console.log(`[fathom-oauth] Extracted: userId=${fathomUserId}, email=${fathomUserEmail}, teamId=${fathomTeamId}, teamName=${fathomTeamName}`)
      } else {
        const errorText = await userInfoResponse.text()
        console.error(`[fathom-oauth] /me endpoint failed: ${userInfoResponse.status} - ${errorText}`)
      }
    } catch (error) {
      console.error('[fathom-oauth] Error fetching user info:', error)
      // Continue anyway - this is not critical
    }

    // If we still don't have user email, try fetching from meetings to extract it
    if (!fathomUserEmail) {
      try {
        console.log('[fathom-oauth] Email not found, trying to extract from meetings...')
        const meetingsResponse = await fetch('https://api.fathom.ai/external/v1/meetings?limit=1', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
          },
        })

        if (meetingsResponse.ok) {
          const meetingsData = await meetingsResponse.json()
          const meetings = meetingsData.items || meetingsData.meetings || meetingsData.data || (Array.isArray(meetingsData) ? meetingsData : [])

          if (meetings.length > 0) {
            const firstMeeting = meetings[0]
            // Try to get email from host or recorded_by
            fathomUserEmail = firstMeeting.recorded_by?.email || firstMeeting.host_email || firstMeeting.host?.email || null
            console.log(`[fathom-oauth] Extracted email from meeting: ${fathomUserEmail}`)
          }
        }
      } catch (e) {
        console.error('[fathom-oauth] Error extracting email from meetings:', e)
      }
    }

    // Calculate token expiry
    const expiresIn = tokenData.expires_in || 3600 // Default 1 hour
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    // Resolve org_id from state (preferred), otherwise fall back to first membership (legacy states)
    let orgId: string | null = stateOrgId
    if (!orgId) {
      const { data: membership } = await supabase
        .from('organization_memberships')
        .select('org_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      orgId = membership?.org_id || null
    }

    if (!orgId) {
      throw new Error('No organization could be resolved for this OAuth connection')
    }

    // Store org-scoped integration metadata (non-sensitive)
    const { data: orgIntegration, error: insertError } = await supabase
      .from('fathom_org_integrations')
      .upsert({
        org_id: orgId,
        connected_by_user_id: userId,
        fathom_user_id: fathomUserId,
        fathom_user_email: fathomUserEmail,
        scopes: tokenData.scope?.split(' ') || ['public_api'],
        is_active: true,
        last_sync_at: null,
      }, {
        onConflict: 'org_id',
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to store integration: ${insertError.message}`)
    }

    // Store org-scoped credentials (service role only)
    const { error: credsError } = await supabase
      .from('fathom_org_credentials')
      .upsert({
        org_id: orgId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: tokenExpiresAt,
      }, {
        onConflict: 'org_id',
      })

    if (credsError) {
      throw new Error(`Failed to store integration credentials: ${credsError.message}`)
    }

    // Create initial sync state
    const { error: syncStateError } = await supabase
      .from('fathom_org_sync_state')
      .upsert({
        org_id: orgId,
        integration_id: orgIntegration.id,
        sync_status: 'idle',
        meetings_synced: 0,
        total_meetings_found: 0,
      }, {
        onConflict: 'org_id',
      })

    if (syncStateError) {
      // Continue anyway - sync state can be created later
    }
    // Return JSON response for POST requests, HTML for GET redirects
    if (req.method === 'POST') {
      return new Response(
        JSON.stringify({
          success: true,
          integration_id: orgIntegration.id,
          user_id: userId,
          org_id: orgId,
          message: 'Fathom integration connected successfully'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // HTML response for GET redirects (if Fathom redirects directly to Edge Function)
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
            <p>Redirecting to integrations...</p>
            <div class="spinner"></div>
          </div>
          <script>
            // Redirect after 2 seconds
            setTimeout(() => {
              window.location.href = '${publicUrl}/integrations?fathom=connected';
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
    await captureException(error, {
      tags: {
        function: 'fathom-oauth-callback',
        integration: 'fathom',
      },
    });
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head><title>Connection Failed</title></head>
        <body>
          <h1>Fathom Connection Failed</h1>
          <p>Error: ${error.message}</p>
          <a href="${publicUrl}/integrations">Return to Integrations</a>
          <script>
            setTimeout(() => {
              if (window.opener) {
                window.close();
              } else {
                window.location.href = '${publicUrl}/integrations';
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
