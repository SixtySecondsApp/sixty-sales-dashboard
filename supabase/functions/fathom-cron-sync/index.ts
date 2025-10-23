import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

/**
 * Fathom Cron Sync Edge Function
 *
 * Purpose: Triggered by pg_cron hourly to sync all active Fathom integrations
 * This function is called with service role permissions and loops through all users
 */
serve(async (req) => {
  try {
    // Verify this is an internal cron request (basic security)
    const authHeader = req.headers.get('Authorization')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!authHeader || !authHeader.includes(serviceRoleKey || '')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Cron jobs must use service role key' }),
        { status: 401 }
      )
    }

    console.log('🕐 Starting Fathom cron sync...')

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

    // Get all active integrations
    const { data: integrations, error: integrationsError } = await supabase
      .from('fathom_integrations')
      .select('id, user_id, fathom_user_email, token_expires_at')
      .eq('is_active', true)

    if (integrationsError) {
      throw new Error(`Failed to fetch integrations: ${integrationsError.message}`)
    }

    if (!integrations || integrations.length === 0) {
      console.log('ℹ️  No active integrations to sync')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active integrations',
          users_synced: 0,
        }),
        { status: 200 }
      )
    }

    console.log(`📊 Found ${integrations.length} active integration(s)`)

    const results = {
      total_users: integrations.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ user_id: string; error: string }>,
    }

    // Sync each user
    for (const integration of integrations) {
      try {
        // Check token expiry
        const tokenExpiresAt = new Date(integration.token_expires_at)
        const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000)

        if (tokenExpiresAt < oneHourFromNow) {
          console.warn(`⚠️  Skipping ${integration.user_id}: Token expires soon`)
          results.errors.push({
            user_id: integration.user_id,
            error: 'Token expires within 1 hour',
          })
          results.failed++
          continue
        }

        console.log(`🔄 Syncing user: ${integration.fathom_user_email || integration.user_id}`)

        // Call fathom-sync Edge Function for this user
        const syncUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fathom-sync`

        const syncResponse = await fetch(syncUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sync_type: 'incremental', // Cron always does incremental (last 24h)
            user_id: integration.user_id,
          }),
        })

        if (!syncResponse.ok) {
          const errorText = await syncResponse.text()
          throw new Error(`Sync failed (${syncResponse.status}): ${errorText}`)
        }

        const syncResult = await syncResponse.json()

        console.log(`✅ Successfully synced ${syncResult.meetings_synced || 0} meetings for ${integration.fathom_user_email}`)

        // Log success
        await supabase
          .from('cron_job_logs')
          .insert({
            job_name: 'fathom_hourly_sync',
            user_id: integration.user_id,
            status: 'success',
            message: `Synced ${syncResult.meetings_synced || 0} meetings`,
          })

        results.successful++

      } catch (error) {
        console.error(`❌ Error syncing user ${integration.user_id}:`, error)

        results.errors.push({
          user_id: integration.user_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })

        // Log error
        await supabase
          .from('cron_job_logs')
          .insert({
            job_name: 'fathom_hourly_sync',
            user_id: integration.user_id,
            status: 'error',
            message: 'Sync failed',
            error_details: error instanceof Error ? error.message : 'Unknown error',
          })

        results.failed++
      }
    }

    console.log(`🎉 Cron sync complete: ${results.successful}/${results.total_users} successful`)

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
    console.error('❌ Cron sync error:', error)

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
