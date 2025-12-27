import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

/**
 * Fathom Cron Sync Edge Function
 *
 * Purpose: Triggered by pg_cron hourly to sync all active Fathom integrations
 * This function is called with service role permissions and loops through all orgs (preferred),
 * falling back to legacy per-user integrations if no org integrations exist.
 */
serve(async (req) => {
  try {
    // Authorize request as service-role.
    //
    // Previously this function compared the Authorization header to an env var (SUPABASE_SERVICE_ROLE_KEY).
    // That is brittle because Supabase now supports multiple key formats (e.g. sb_secret_* and JWT) and
    // secret UIs can introduce whitespace.
    //
    // Instead, validate the provided Bearer token by calling an admin-only endpoint. If it succeeds,
    // the request is authorized and we use the provided token for all downstream Supabase calls.
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const authHeader = (req.headers.get('Authorization') ?? '').trim()
    const providedToken = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''

    if (!supabaseUrl || !providedToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Cron jobs must use service role key' }),
        { status: 401 }
      )
    }

    const supabase = createClient(
      supabaseUrl,
      providedToken,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    )

    // Admin-only probe to confirm this token is service role.
    const { error: adminProbeError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (adminProbeError) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Cron jobs must use service role key' }),
        { status: 401 }
      )
    }

    const serviceRoleKey = providedToken

    // Per-user integrations (PRIMARY - each user connects their own Fathom account)
    const { data: userIntegrations, error: userIntegrationsError } = await supabase
      .from('fathom_integrations')
      .select('id, user_id, fathom_user_email, token_expires_at')
      .eq('is_active', true)

    if (userIntegrationsError) {
      throw new Error(`Failed to fetch user integrations: ${userIntegrationsError.message}`)
    }

    const hasUserIntegrations = !!userIntegrations && userIntegrations.length > 0

    const results = {
      mode: 'user' as const,
      total: hasUserIntegrations ? userIntegrations.length : 0,
      successful: 0,
      failed: 0,
      // Per-org/user detail so callers can see "0 meetings found" vs real failures.
      details: [] as Array<{
        id: string
        sync_type: 'incremental' | 'manual'
        meetings_synced: number
        total_meetings_found: number
        errors_count: number
        errors_sample?: Array<{ call_id: string; error: string }>
        db_meetings_total?: number
        db_meetings_last_90d?: number
      }>,
      errors: [] as Array<{ id: string; error: string }>,
    }

    if (!hasUserIntegrations) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active Fathom user integrations',
          results: { ...results, total: 0 },
        }),
        { status: 200 }
      )
    }

    console.log(`[fathom-cron-sync] Processing ${userIntegrations.length} user integrations`)

    for (const integration of userIntegrations) {
      const userId = (integration as any).user_id as string

      try {
        // Decide whether we need a catch-up sync.
        // If the last successful sync is old/missing, run a manual (last-30-days) sync once
        let syncType: 'incremental' | 'manual' = 'incremental'
        try {
          const { data: state } = await supabase
            .from('fathom_sync_state')
            .select('last_sync_completed_at')
            .eq('user_id', userId)
            .maybeSingle()

          const last = state?.last_sync_completed_at ? new Date(state.last_sync_completed_at) : null
          const ageHours = last ? (Date.now() - last.getTime()) / (1000 * 60 * 60) : Infinity
          if (!isFinite(ageHours) || ageHours > 36) {
            syncType = 'manual'
          }
        } catch {
          // If we can't read sync state for any reason, default to incremental.
        }

        // NOTE:
        // Access tokens typically expire in ~1 hour. The downstream `fathom-sync` function
        // already refreshes tokens as needed, so we should always attempt the sync.

        const syncUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fathom-sync`
        const syncResponse = await fetch(syncUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sync_type: syncType,
            user_id: userId,
          }),
        })

        if (!syncResponse.ok) {
          const errorText = await syncResponse.text()
          throw new Error(`Sync failed (${syncResponse.status}): ${errorText}`)
        }

        const syncResult = await syncResponse.json()

        await supabase.from('cron_job_logs').insert({
          job_name: 'fathom_hourly_sync',
          user_id: userId,
          status: 'success',
          message: `Synced ${syncResult.meetings_synced || 0} meetings`,
        })

        // Optional: count meetings in DB for sanity (service role only).
        let dbTotal: number | undefined
        let dbLast90d: number | undefined
        try {
          const { count: c1 } = await supabase
            .from('meetings')
            .select('id', { count: 'exact', head: true })
            .eq('owner_user_id', userId)
            .not('fathom_recording_id', 'is', null)
          if (typeof c1 === 'number') dbTotal = c1

          const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
          const { count: c2 } = await supabase
            .from('meetings')
            .select('id', { count: 'exact', head: true })
            .eq('owner_user_id', userId)
            .not('fathom_recording_id', 'is', null)
            .gte('meeting_start', since)
          if (typeof c2 === 'number') dbLast90d = c2
        } catch {
          // ignore counting errors (non-fatal)
        }

        results.details.push({
          id: userId,
          sync_type: syncType,
          meetings_synced: Number(syncResult.meetings_synced || 0),
          total_meetings_found: Number(syncResult.total_meetings_found || 0),
          errors_count: Array.isArray(syncResult.errors) ? syncResult.errors.length : 0,
          errors_sample: Array.isArray(syncResult.errors) ? syncResult.errors.slice(0, 3) : undefined,
          db_meetings_total: dbTotal,
          db_meetings_last_90d: dbLast90d,
        })

        results.successful++
      } catch (error) {
        results.errors.push({ id: userId, error: error instanceof Error ? error.message : 'Unknown error' })

        await supabase.from('cron_job_logs').insert({
          job_name: 'fathom_hourly_sync',
          user_id: userId,
          status: 'error',
          message: 'Sync failed',
          error_details: error instanceof Error ? error.message : 'Unknown error',
        })

        results.failed++
      }
    }
    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
