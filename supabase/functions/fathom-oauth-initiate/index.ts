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
    // Optional JSON body (org-scoped). For backwards compatibility, we can fall back
    // to the user's first org membership if org_id is not provided.
    let orgIdFromBody: string | null = null
    try {
      const contentType = req.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const body = await req.json().catch(() => null)
        orgIdFromBody = (body && typeof body.org_id === 'string' ? body.org_id : null)
      }
    } catch {
      // ignore parse errors; we'll fall back below
    }

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

    // Resolve org_id (prefer explicit, else first membership)
    let orgId: string | null = orgIdFromBody
    if (!orgId) {
      const { data: membership } = await supabase
        .from('organization_memberships')
        .select('org_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      orgId = membership?.org_id || null
    }

    if (!orgId) {
      return new Response(
        JSON.stringify({
          error: 'Missing org_id',
          message: 'No organization could be resolved for this user. Please select an organization and try again.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Enforce org admin/owner
    const { data: roleRow } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle()

    const role = roleRow?.role || null
    if (role !== 'owner' && role !== 'admin') {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'Only organization owners/admins can connect Fathom for this organization.',
        }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if org already has an active integration
    const { data: existingOrgIntegration } = await supabase
      .from('fathom_org_integrations')
      .select('id, is_active')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .maybeSingle()

    if (existingOrgIntegration) {
      return new Response(
        JSON.stringify({
          error: 'Integration already exists',
          message: 'This organization already has an active Fathom connection. Disconnect first to reconnect.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get OAuth configuration from environment
    const clientId = Deno.env.get('FATHOM_CLIENT_ID')
    const redirectUri = Deno.env.get('FATHOM_REDIRECT_URI')

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
        org_id: orgId,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      })

    if (stateError) {
      throw new Error(`Failed to store OAuth state: ${stateError.message}`)
    }

    // Build OAuth authorization URL
    // Using Fathom's OAuth 2.0 endpoints
    const authUrl = new URL('https://fathom.video/external/v1/oauth2/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'public_api') // Only supported scope
    authUrl.searchParams.set('state', state)
    return new Response(
      JSON.stringify({
        success: true,
        authorization_url: authUrl.toString(),
        state,
        org_id: orgId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
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
