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
    // Verify this is an internal cron request (basic security)
    const authHeader = req.headers.get('Authorization')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!authHeader || !serviceRoleKey || authHeader.trim() !== `Bearer ${serviceRoleKey}`) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Cron jobs must use service role key' }),
        { status: 401 }
      )
    }
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

    // Prefer org-scoped integrations
    const { data: orgIntegrations, error: orgIntegrationsError } = await supabase
      .from('fathom_org_integrations')
      .select('id, org_id, connected_by_user_id, fathom_user_email')
      .eq('is_active', true)

    if (orgIntegrationsError) {
      throw new Error(`Failed to fetch org integrations: ${orgIntegrationsError.message}`)
    }

    const useOrgMode = !!orgIntegrations && orgIntegrations.length > 0

    const results = {
      mode: useOrgMode ? 'org' : 'user',
      total: useOrgMode ? (orgIntegrations?.length || 0) : 0,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ id: string; error: string }>,
    }

    if (useOrgMode) {
      results.total = orgIntegrations!.length

      for (const integration of orgIntegrations!) {
        const orgId = (integration as any).org_id as string
        const logUserId = (integration as any).connected_by_user_id as string | null

        try {
          const { data: creds, error: credsError } = await supabase
            .from('fathom_org_credentials')
            .select('token_expires_at')
            .eq('org_id', orgId)
            .single()

          if (credsError || !creds?.token_expires_at) {
            results.errors.push({ id: orgId, error: `Missing org credentials: ${credsError?.message || 'unknown'}` })
            results.failed++
            continue
          }

          const tokenExpiresAt = new Date(creds.token_expires_at)
          const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000)
          if (tokenExpiresAt < oneHourFromNow) {
            results.errors.push({ id: orgId, error: 'Token expires within 1 hour' })
            results.failed++
            continue
          }

          const syncUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fathom-sync`
          const syncResponse = await fetch(syncUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sync_type: 'incremental',
              org_id: orgId,
            }),
          })

          if (!syncResponse.ok) {
            const errorText = await syncResponse.text()
            throw new Error(`Sync failed (${syncResponse.status}): ${errorText}`)
          }

          const syncResult = await syncResponse.json()

          await supabase.from('cron_job_logs').insert({
            job_name: 'fathom_hourly_sync',
            user_id: logUserId,
            status: 'success',
            message: `Org ${orgId}: Synced ${syncResult.meetings_synced || 0} meetings`,
          })

          results.successful++
        } catch (error) {
          results.errors.push({ id: orgId, error: error instanceof Error ? error.message : 'Unknown error' })

          await supabase.from('cron_job_logs').insert({
            job_name: 'fathom_hourly_sync',
            user_id: logUserId,
            status: 'error',
            message: `Org ${orgId}: Sync failed`,
            error_details: error instanceof Error ? error.message : 'Unknown error',
          })

          results.failed++
        }
      }
    } else {
      // Legacy fallback (pre-org integrations): keep old behavior
      const { data: integrations, error: integrationsError } = await supabase
        .from('fathom_integrations')
        .select('id, user_id, fathom_user_email, token_expires_at')
        .eq('is_active', true)

      if (integrationsError) {
        throw new Error(`Failed to fetch integrations: ${integrationsError.message}`)
      }

      if (!integrations || integrations.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No active integrations',
            results: { ...results, total: 0 },
          }),
          { status: 200 }
        )
      }

      results.total = integrations.length

      for (const integration of integrations) {
        try {
          const tokenExpiresAt = new Date((integration as any).token_expires_at)
          const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000)

          if (tokenExpiresAt < oneHourFromNow) {
            results.errors.push({ id: (integration as any).user_id, error: 'Token expires within 1 hour' })
            results.failed++
            continue
          }

          const syncUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fathom-sync`
          const syncResponse = await fetch(syncUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sync_type: 'incremental',
              user_id: (integration as any).user_id,
            }),
          })

          if (!syncResponse.ok) {
            const errorText = await syncResponse.text()
            throw new Error(`Sync failed (${syncResponse.status}): ${errorText}`)
          }

          const syncResult = await syncResponse.json()
          await supabase.from('cron_job_logs').insert({
            job_name: 'fathom_hourly_sync',
            user_id: (integration as any).user_id,
            status: 'success',
            message: `Synced ${syncResult.meetings_synced || 0} meetings`,
          })

          results.successful++
        } catch (error) {
          results.errors.push({ id: (integration as any).user_id, error: error instanceof Error ? error.message : 'Unknown error' })

          await supabase.from('cron_job_logs').insert({
            job_name: 'fathom_hourly_sync',
            user_id: (integration as any).user_id,
            status: 'error',
            message: 'Sync failed',
            error_details: error instanceof Error ? error.message : 'Unknown error',
          })

          results.failed++
        }
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
