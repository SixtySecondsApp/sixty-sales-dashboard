import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

/**
 * Fathom Cron Sync Edge Function
 *
 * Purpose: Triggered by pg_cron hourly to sync all active Fathom integrations
 * This function is called with service role permissions and processes users in parallel
 * with concurrency limits and a time budget to prevent timeouts.
 *
 * Optimization Strategy:
 * - Process users in parallel batches (default: 5 concurrent syncs)
 * - Time budget of 120 seconds (below 150s Supabase timeout)
 * - Graceful early exit when approaching timeout
 * - Incomplete users will be processed in the next cron run
 */

// Configuration
const MAX_CONCURRENCY = 5 // Process 5 users at a time
const TIME_BUDGET_MS = 120_000 // 120 seconds (2 minutes) - leaves 30s buffer before 150s timeout
const SYNC_TIMEOUT_MS = 30_000 // 30 seconds max per individual user sync

/**
 * Process a single user sync with timeout
 */
async function syncUserWithTimeout(
  supabase: any,
  serviceRoleKey: string,
  integration: any,
  timeoutMs: number
): Promise<{
  userId: string
  success: boolean
  syncType: 'incremental' | 'manual'
  syncResult?: any
  error?: string
}> {
  const userId = integration.user_id as string
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    // Decide whether we need a catch-up sync
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
      // If we can't read sync state, default to incremental
    }

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
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!syncResponse.ok) {
      const errorText = await syncResponse.text()
      return { userId, success: false, syncType, error: `Sync failed (${syncResponse.status}): ${errorText}` }
    }

    const syncResult = await syncResponse.json()
    return { userId, success: true, syncType, syncResult }
  } catch (error) {
    clearTimeout(timeoutId)
    const errorMessage = error instanceof Error
      ? (error.name === 'AbortError' ? 'Sync timed out' : error.message)
      : 'Unknown error'
    return { userId, success: false, syncType: 'incremental', error: errorMessage }
  }
}

/**
 * Process a batch of users in parallel
 */
async function processBatch(
  supabase: any,
  serviceRoleKey: string,
  batch: any[],
  timeoutMs: number
): Promise<Array<{
  userId: string
  success: boolean
  syncType: 'incremental' | 'manual'
  syncResult?: any
  error?: string
}>> {
  const promises = batch.map(integration =>
    syncUserWithTimeout(supabase, serviceRoleKey, integration, timeoutMs)
  )
  return Promise.all(promises)
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

    // Fetch all active user integrations
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
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0, // Users skipped due to time budget
      details: [] as Array<{
        id: string
        sync_type: 'incremental' | 'manual'
        meetings_synced: number
        total_meetings_found: number
        errors_count: number
        errors_sample?: Array<{ call_id: string; error: string }>
      }>,
      errors: [] as Array<{ id: string; error: string }>,
      timing: {
        total_ms: 0,
        avg_per_user_ms: 0,
      },
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

    console.log(`[fathom-cron-sync] Processing ${userIntegrations.length} user integrations (max ${MAX_CONCURRENCY} concurrent)`)

    // Process users in batches with concurrency limit
    let batchIndex = 0
    const batches: any[][] = []

    // Split into batches
    for (let i = 0; i < userIntegrations.length; i += MAX_CONCURRENCY) {
      batches.push(userIntegrations.slice(i, i + MAX_CONCURRENCY))
    }

    console.log(`[fathom-cron-sync] Split into ${batches.length} batches of up to ${MAX_CONCURRENCY} users`)

    // Process batches until time budget is exhausted
    for (const batch of batches) {
      const elapsed = Date.now() - startTime
      const remaining = TIME_BUDGET_MS - elapsed

      // Check if we have enough time for another batch
      if (remaining < SYNC_TIMEOUT_MS) {
        console.log(`[fathom-cron-sync] Time budget exhausted (${elapsed}ms elapsed). Skipping remaining ${userIntegrations.length - results.processed} users.`)
        results.skipped = userIntegrations.length - results.processed
        break
      }

      console.log(`[fathom-cron-sync] Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} users, ${remaining}ms remaining)`)

      // Process batch in parallel
      const batchResults = await processBatch(supabase, serviceRoleKey, batch, Math.min(SYNC_TIMEOUT_MS, remaining))

      // Process results
      for (const result of batchResults) {
        results.processed++

        if (result.success && result.syncResult) {
          results.successful++
          results.details.push({
            id: result.userId,
            sync_type: result.syncType,
            meetings_synced: Number(result.syncResult.meetings_synced || 0),
            total_meetings_found: Number(result.syncResult.total_meetings_found || 0),
            errors_count: Array.isArray(result.syncResult.errors) ? result.syncResult.errors.length : 0,
            errors_sample: Array.isArray(result.syncResult.errors) ? result.syncResult.errors.slice(0, 3) : undefined,
          })

          // Log success (non-fatal if logging fails)
          try {
            await supabase.from('cron_job_logs').insert({
              job_name: 'fathom_hourly_sync',
              user_id: result.userId,
              status: 'success',
              message: `Synced ${result.syncResult.meetings_synced || 0} meetings`,
            })
          } catch {
            // Ignore logging errors
          }
        } else {
          results.failed++
          results.errors.push({ id: result.userId, error: result.error || 'Unknown error' })

          // Log error (non-fatal if logging fails)
          try {
            await supabase.from('cron_job_logs').insert({
              job_name: 'fathom_hourly_sync',
              user_id: result.userId,
              status: 'error',
              message: 'Sync failed',
              error_details: result.error || 'Unknown error',
            })
          } catch {
            // Ignore logging errors
          }
        }
      }

      batchIndex++
    }

    // Calculate timing stats
    results.timing.total_ms = Date.now() - startTime
    results.timing.avg_per_user_ms = results.processed > 0
      ? Math.round(results.timing.total_ms / results.processed)
      : 0

    console.log(`[fathom-cron-sync] Complete: ${results.successful} success, ${results.failed} failed, ${results.skipped} skipped in ${results.timing.total_ms}ms`)

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
        timing: { total_ms: Date.now() - startTime },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
