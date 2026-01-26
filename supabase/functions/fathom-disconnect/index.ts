import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DisconnectRequest {
  delete_synced_meetings?: boolean
}

/**
 * Fathom Disconnect Edge Function (Per-User)
 *
 * Purpose:
 * - Allow any user to disconnect their own Fathom integration
 * - Optionally delete all Fathom-synced meetings owned by that user
 *
 * Security:
 * - Requires a valid user session
 * - Users can only disconnect their own integration
 *
 * Note: This is a per-user integration - each user manages their own Fathom connection.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: DisconnectRequest = await req.json().catch(() => ({} as DisconnectRequest))
    const deleteSyncedMeetings = !!body.delete_synced_meetings

    const authHeader = req.headers.get('Authorization') || ''
    console.log('[fathom-disconnect] Auth header present:', !!authHeader)

    if (!authHeader) {
      console.error('[fathom-disconnect] Missing authorization header')
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate user via anon client using caller JWT
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    console.log('[fathom-disconnect] Validating user session...')
    const { data: { user }, error: userError } = await anonClient.auth.getUser()

    if (userError || !user) {
      console.error('[fathom-disconnect] Session validation failed:', userError?.message)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized: Invalid session',
          details: userError?.message
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[fathom-disconnect] User validated:', user.id)

    // Service role client for privileged operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    // Verify user has an active integration
    const { data: existingIntegration } = await supabase
      .from('fathom_integrations')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!existingIntegration) {
      return new Response(
        JSON.stringify({ success: false, error: 'No active Fathom integration found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Optionally delete user's meetings synced from Fathom
    if (deleteSyncedMeetings) {
      const { error: delMeetingsError } = await supabase
        .from('meetings')
        .delete()
        .eq('owner_user_id', user.id)
        .not('fathom_recording_id', 'is', null)

      if (delMeetingsError) {
        // Non-fatal: proceed with disconnect
        console.error('[fathom-disconnect] Failed to delete meetings:', delMeetingsError)
      }
    }

    // Delete sync state
    const { error: deleteSyncError } = await supabase
      .from('fathom_sync_state')
      .delete()
      .eq('user_id', user.id)

    if (deleteSyncError) {
      console.error('[fathom-disconnect] Failed to delete sync state:', deleteSyncError)
    }

    // Delete integration record entirely (ensures fresh token on reconnect)
    const { error: deleteIntegrationError } = await supabase
      .from('fathom_integrations')
      .delete()
      .eq('user_id', user.id)

    if (deleteIntegrationError) {
      throw new Error(`Failed to delete integration: ${deleteIntegrationError.message}`)
    }

    console.log(`[fathom-disconnect] Successfully disconnected Fathom for user ${user.id}`)

    return new Response(
      JSON.stringify({
        success: true,
        user_id: user.id,
        deleted_meetings: deleteSyncedMeetings
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
