import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DisconnectRequest {
  org_id?: string
  delete_synced_meetings?: boolean
}

/**
 * Fathom Disconnect Edge Function (org-scoped)
 *
 * Purpose:
 * - Allow org owners/admins to disconnect the org-level Fathom integration
 * - Optionally delete all Fathom-synced meetings for that org
 *
 * Security:
 * - Requires a valid user session
 * - Requires org role in ('owner','admin')
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: DisconnectRequest = await req.json().catch(() => ({} as DisconnectRequest))
    const orgId = body.org_id || null
    const deleteSyncedMeetings = !!body.delete_synced_meetings

    if (!orgId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing org_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) {
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

    const { data: { user }, error: userError } = await anonClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Service role client for privileged operations (credentials table is service-role-only)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    // Verify org admin role
    const { data: membership } = await supabase
      .from('organization_memberships')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle()

    const role = membership?.role || null
    if (role !== 'owner' && role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden: org admin required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Optionally delete org meetings synced from Fathom
    if (deleteSyncedMeetings) {
      const { error: delMeetingsError } = await supabase
        .from('meetings')
        .delete()
        .eq('org_id', orgId)
        .not('fathom_recording_id', 'is', null)

      if (delMeetingsError) {
        // Non-fatal: proceed with disconnect
        console.error('[fathom-disconnect] Failed to delete meetings:', delMeetingsError)
      }
    }

    // Deactivate integration (keep credentials row; token refresh will ignore inactive)
    const { error: deactivateError } = await supabase
      .from('fathom_org_integrations')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('org_id', orgId)

    if (deactivateError) {
      throw new Error(`Failed to deactivate integration: ${deactivateError.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, org_id: orgId, deleted_meetings: deleteSyncedMeetings }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

