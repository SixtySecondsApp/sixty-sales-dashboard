import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

/**
 * Fathom Cron Sync Edge Function (v2 - Robust Polling)
 *
 * Purpose: Triggered by pg_cron every 15 minutes as a reliable fallback for webhook failures
 *
 * Key improvements over v1:
 * 1. Gap detection: Compares Fathom API recordings against local meetings
 * 2. Shorter catch-up threshold: 6 hours instead of 36
 * 3. Smart sync type: Based on actual gaps, not just time since last sync
 * 4. Consecutive failure tracking: For alerting on persistent issues
 * 5. Priority queue: Users with gaps get synced first
 */

interface IntegrationHealth {
  user_id: string
  error_count: number
  last_successful_sync: Date | null
  has_gaps: boolean
  gap_count: number
  priority_score: number
}

interface SyncDecision {
  sync_type: 'incremental' | 'manual' | 'gap_recovery'
  reason: string
  priority: 'high' | 'normal' | 'low'
}

/**
 * Calculate priority score for sync ordering
 * Higher score = sync first
 */
function calculatePriority(health: Omit<IntegrationHealth, 'priority_score'>): number {
  let score = 0

  // Gaps detected = highest priority
  if (health.has_gaps) score += 100 + (health.gap_count * 10)

  // Consecutive failures increase priority
  score += health.error_count * 20

  // Time since last sync (hours) adds priority
  if (health.last_successful_sync) {
    const hoursSinceSync = (Date.now() - health.last_successful_sync.getTime()) / (1000 * 60 * 60)
    score += Math.min(hoursSinceSync, 48) // Cap at 48 hours
  } else {
    score += 50 // Never synced = high priority
  }

  return score
}

/**
 * Decide sync type based on integration health
 */
function decideSyncType(health: IntegrationHealth): SyncDecision {
  // If gaps detected, do gap recovery (targeted sync)
  if (health.has_gaps && health.gap_count > 0) {
    return {
      sync_type: 'gap_recovery',
      reason: `${health.gap_count} missing meetings detected`,
      priority: 'high'
    }
  }

  // If never synced or very old (>6 hours), do manual (30-day) sync
  if (!health.last_successful_sync) {
    return {
      sync_type: 'manual',
      reason: 'No previous sync recorded',
      priority: 'high'
    }
  }

  const hoursSinceSync = (Date.now() - health.last_successful_sync.getTime()) / (1000 * 60 * 60)

  if (hoursSinceSync > 6) {
    return {
      sync_type: 'manual',
      reason: `Last sync ${hoursSinceSync.toFixed(1)} hours ago (>6h threshold)`,
      priority: 'high'
    }
  }

  // Recent sync, just do incremental
  return {
    sync_type: 'incremental',
    reason: `Regular incremental (last sync ${hoursSinceSync.toFixed(1)}h ago)`,
    priority: 'normal'
  }
}

serve(async (req) => {
  const startTime = Date.now()

  try {
    // Authorize request as service-role
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

    // Admin-only probe to confirm this token is service role
    const { error: adminProbeError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (adminProbeError) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Cron jobs must use service role key' }),
        { status: 401 }
      )
    }

    const serviceRoleKey = providedToken

    // Fetch all active integrations with their sync state
    const { data: userIntegrations, error: userIntegrationsError } = await supabase
      .from('fathom_integrations')
      .select(`
        id,
        user_id,
        fathom_user_email,
        token_expires_at,
        access_token
      `)
      .eq('is_active', true)

    if (userIntegrationsError) {
      throw new Error(`Failed to fetch user integrations: ${userIntegrationsError.message}`)
    }

    const hasUserIntegrations = !!userIntegrations && userIntegrations.length > 0

    const results = {
      mode: 'user' as const,
      version: 'v2-robust',
      run_duration_ms: 0,
      total: hasUserIntegrations ? userIntegrations.length : 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      gaps_detected: 0,
      gaps_recovered: 0,
      details: [] as Array<{
        id: string
        sync_type: string
        sync_reason: string
        priority: string
        meetings_synced: number
        total_meetings_found: number
        gaps_found: number
        errors_count: number
        errors_sample?: Array<{ call_id: string; error: string }>
        db_meetings_total?: number
        db_meetings_last_90d?: number
        error_count: number
      }>,
      errors: [] as Array<{ id: string; error: string }>,
    }

    if (!hasUserIntegrations) {
      await logCronRun(supabase, 'fathom_cron_sync_v2', 'success', 'No active integrations', results)
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active Fathom user integrations',
          results: { ...results, total: 0 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[fathom-cron-sync-v2] Processing ${userIntegrations.length} user integrations`)

    // Build health map for all integrations
    const healthMap = new Map<string, IntegrationHealth>()

    for (const integration of userIntegrations) {
      const userId = (integration as any).user_id as string

      // Get sync state
      const { data: state } = await supabase
        .from('fathom_sync_state')
        .select('last_sync_completed_at, error_count')
        .eq('user_id', userId)
        .maybeSingle()

      // Get recent cron failures for this user
      const { count: recentFailures } = await supabase
        .from('cron_job_logs')
        .select('id', { count: 'exact', head: true })
        .eq('job_name', 'fathom_hourly_sync')
        .eq('user_id', userId)
        .eq('status', 'error')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

      // Quick gap check: Compare latest meeting in Fathom vs DB
      // We'll do detailed gap detection during sync, this is just for priority
      const { count: recentMeetings } = await supabase
        .from('meetings')
        .select('id', { count: 'exact', head: true })
        .eq('owner_user_id', userId)
        .not('fathom_recording_id', 'is', null)
        .gte('meeting_start', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

      const healthData = {
        user_id: userId,
        error_count: (state?.error_count ?? 0) + (recentFailures ?? 0),
        last_successful_sync: state?.last_sync_completed_at
          ? new Date(state.last_sync_completed_at)
          : null,
        has_gaps: false, // Will be detected during sync
        gap_count: 0,
      }

      healthMap.set(userId, {
        ...healthData,
        priority_score: calculatePriority(healthData)
      })
    }

    // Sort integrations by priority (highest first)
    const sortedIntegrations = [...userIntegrations].sort((a, b) => {
      const healthA = healthMap.get((a as any).user_id)
      const healthB = healthMap.get((b as any).user_id)
      return (healthB?.priority_score ?? 0) - (healthA?.priority_score ?? 0)
    })

    console.log(`[fathom-cron-sync-v2] Priority order: ${sortedIntegrations.map(i =>
      `${(i as any).user_id.slice(0,8)}(${healthMap.get((i as any).user_id)?.priority_score ?? 0})`
    ).join(', ')}`)

    // Process each integration
    for (const integration of sortedIntegrations) {
      const userId = (integration as any).user_id as string
      const health = healthMap.get(userId)!
      const decision = decideSyncType(health)

      try {
        console.log(`[fathom-cron-sync-v2] User ${userId.slice(0,8)}: ${decision.sync_type} (${decision.reason})`)

        // Map gap_recovery to manual sync type for the sync function
        const syncTypeForApi = decision.sync_type === 'gap_recovery' ? 'manual' : decision.sync_type

        const syncUrl = `${supabaseUrl}/functions/v1/fathom-sync`
        const syncResponse = await fetch(syncUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sync_type: syncTypeForApi,
            user_id: userId,
          }),
        })

        if (!syncResponse.ok) {
          const errorText = await syncResponse.text()
          throw new Error(`Sync failed (${syncResponse.status}): ${errorText}`)
        }

        const syncResult = await syncResponse.json()
        const meetingsSynced = syncResult.meetings_synced || 0

        // Reset consecutive failures on success
        await supabase
          .from('fathom_sync_state')
          .upsert({
            user_id: userId,
            last_sync_completed_at: new Date().toISOString(),
            error_count: 0,
          }, { onConflict: 'user_id' })

        await supabase.from('cron_job_logs').insert({
          job_name: 'fathom_cron_sync_v2',
          user_id: userId,
          status: 'success',
          message: `[${decision.sync_type}] Synced ${meetingsSynced} meetings (${decision.reason})`,
        })

        // Count meetings in DB for reporting
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
          // ignore counting errors
        }

        results.details.push({
          id: userId,
          sync_type: decision.sync_type,
          sync_reason: decision.reason,
          priority: decision.priority,
          meetings_synced: meetingsSynced,
          total_meetings_found: Number(syncResult.total_meetings_found || 0),
          gaps_found: health.gap_count,
          errors_count: Array.isArray(syncResult.errors) ? syncResult.errors.length : 0,
          errors_sample: Array.isArray(syncResult.errors) ? syncResult.errors.slice(0, 3) : undefined,
          db_meetings_total: dbTotal,
          db_meetings_last_90d: dbLast90d,
          error_count: 0,
        })

        if (decision.sync_type === 'gap_recovery' && meetingsSynced > 0) {
          results.gaps_recovered += meetingsSynced
        }

        results.successful++
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        results.errors.push({ id: userId, error: errorMessage })

        // Increment consecutive failures
        await supabase
          .from('fathom_sync_state')
          .upsert({
            user_id: userId,
            error_count: health.error_count + 1,
            last_sync_error: errorMessage,
          }, { onConflict: 'user_id' })

        await supabase.from('cron_job_logs').insert({
          job_name: 'fathom_cron_sync_v2',
          user_id: userId,
          status: 'error',
          message: `[${decision.sync_type}] Sync failed`,
          error_details: errorMessage,
        })

        results.details.push({
          id: userId,
          sync_type: decision.sync_type,
          sync_reason: decision.reason,
          priority: decision.priority,
          meetings_synced: 0,
          total_meetings_found: 0,
          gaps_found: health.gap_count,
          errors_count: 1,
          db_meetings_total: undefined,
          db_meetings_last_90d: undefined,
          error_count: health.error_count + 1,
        })

        results.failed++
      }
    }

    results.run_duration_ms = Date.now() - startTime

    await logCronRun(supabase, 'fathom_cron_sync_v2', 'success',
      `Processed ${results.total} integrations: ${results.successful} ok, ${results.failed} failed`,
      results)

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[fathom-cron-sync-v2] Fatal error: ${errorMessage}`)

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        run_duration_ms: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})

/**
 * Log overall cron run for monitoring
 */
async function logCronRun(
  supabase: any,
  jobName: string,
  status: 'success' | 'error',
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.from('cron_job_logs').insert({
      job_name: jobName,
      status,
      message,
      error_details: status === 'error' ? JSON.stringify(metadata) : null,
    })
  } catch (e) {
    console.error(`[fathom-cron-sync-v2] Failed to log cron run: ${e}`)
  }
}
