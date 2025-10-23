import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Fathom OAuth Initiation Edge Function
 *
 * Purpose: Generate OAuth authorization URL and redirect user to Fathom
 * Flow: User clicks "Connect Fathom" → This function → Redirect to Fathom OAuth
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authenticated user using anon key
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user }, error: userError } = await anonClient.auth.getUser()

    if (userError || !user) {
      throw new Error('Unauthorized: No valid session')
    }

    console.log('🔐 Initiating OAuth for user:', user.id)

    // Create service role client for bypassing RLS when storing OAuth state
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

    // Check if user already has an active integration
    const { data: existingIntegration } = await supabase
      .from('fathom_integrations')
      .select('id, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (existingIntegration) {
      console.log('⚠️  User already has active Fathom integration')
      return new Response(
        JSON.stringify({
          error: 'Integration already exists',
          message: 'You already have an active Fathom connection. Disconnect first to reconnect.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get OAuth configuration from environment
    const clientId = Deno.env.get('VITE_FATHOM_CLIENT_ID')
    const redirectUri = Deno.env.get('VITE_FATHOM_REDIRECT_URI')

    if (!clientId || !redirectUri) {
      throw new Error('Missing Fathom OAuth configuration')
    }

    // Generate secure random state for CSRF protection
    const state = crypto.randomUUID()

    // Store state in session for validation (using Supabase as simple KV store)
    // Note: In production, consider using a proper session store or Redis
    const { error: stateError } = await supabase
      .from('fathom_oauth_states')
      .insert({
        state,
        user_id: user.id,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      })

    if (stateError) {
      console.error('Failed to store OAuth state:', stateError)
      // Continue anyway - state validation is best-effort
    }

    // Required scopes for Fathom API
    const scopes = [
      'calls:read',        // Read meeting/call data
      'analytics:read',    // Read analytics and insights
      'highlights:write',  // Create highlights from CRM (future)
    ]

    // Build OAuth authorization URL (updated to correct endpoint)
    const authUrl = new URL('https://fathom.video/external/v1/oauth2/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', scopes.join(' '))
    authUrl.searchParams.set('state', state)

    console.log('✅ OAuth URL generated successfully')

    return new Response(
      JSON.stringify({
        success: true,
        authorization_url: authUrl.toString(),
        state,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('❌ OAuth initiation error:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to initiate OAuth',
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

// Note: We need to create the fathom_oauth_states table
// This will be added in the next migration
