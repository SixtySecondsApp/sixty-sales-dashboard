/// <reference path="../deno.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Fathom Token Refresh Edge Function
 *
 * Purpose: Proactively refresh all Fathom OAuth tokens to prevent expiration
 * Schedule: Run daily via Vercel cron to keep refresh tokens alive
 *
 * Why this matters:
 * - Access tokens expire after ~1 hour
 * - Refresh tokens expire after ~30 days of non-use
 * - By refreshing daily, we keep the refresh token chain alive
 * - This prevents users from having to manually reconnect
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  const results: Array<{
    org_id: string
    connected_by_user_id: string | null
    email: string
    status: 'refreshed' | 'skipped' | 'failed' | 'needs_reconnect'
    message: string
    expires_at?: string
  }> = []

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get OAuth configuration
    const clientId = Deno.env.get('FATHOM_CLIENT_ID')
    const clientSecret = Deno.env.get('FATHOM_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      throw new Error('Missing FATHOM_CLIENT_ID or FATHOM_CLIENT_SECRET environment variables')
    }

    // Prefer org-scoped integrations
    const { data: orgIntegrations, error: orgFetchError } = await supabase
      .from('fathom_org_integrations')
      .select('org_id, connected_by_user_id, fathom_user_email, is_active')
      .eq('is_active', true)

    if (orgFetchError) {
      throw new Error(`Failed to fetch org integrations: ${orgFetchError.message}`)
    }

    const useOrgMode = !!orgIntegrations && orgIntegrations.length > 0

    if (useOrgMode) {
      console.log(`[fathom-token-refresh] Processing ${orgIntegrations.length} org integrations`)

      for (const integration of orgIntegrations) {
        const orgId = (integration as any).org_id as string
        const connectedBy = (integration as any).connected_by_user_id as string | null
        const email = (integration as any).fathom_user_email || 'unknown'

        try {
          const { data: creds, error: credsError } = await supabase
            .from('fathom_org_credentials')
            .select('access_token, refresh_token, token_expires_at')
            .eq('org_id', orgId)
            .single()

          if (credsError || !creds) {
            results.push({
              org_id: orgId,
              connected_by_user_id: connectedBy,
              email,
              status: 'needs_reconnect',
              message: `No org credentials available - org admin must reconnect (${credsError?.message || 'unknown'})`,
            })
            continue
          }

        const now = new Date()
        const expiresAt = new Date(creds.token_expires_at)
        const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)

        // Always refresh if expiring within 24 hours, or proactively refresh to keep tokens alive
        // The key insight: using the refresh token extends its lifetime
        const shouldRefresh = hoursUntilExpiry < 24 || true // Always refresh to keep refresh token alive

        if (!shouldRefresh) {
          results.push({
            org_id: orgId,
            connected_by_user_id: connectedBy,
            email,
            status: 'skipped',
            message: `Token valid for ${Math.round(hoursUntilExpiry)} more hours`,
            expires_at: creds.token_expires_at,
          })
          continue
        }

        if (!creds.refresh_token) {
          results.push({
            org_id: orgId,
            connected_by_user_id: connectedBy,
            email,
            status: 'needs_reconnect',
            message: 'No refresh token available - user must reconnect',
          })
          continue
        }

        // Refresh the token
        console.log(`[fathom-token-refresh] Refreshing token for org ${orgId} (${email})`)

        const tokenParams = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: creds.refresh_token,
          client_id: clientId,
          client_secret: clientSecret,
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
          console.error(`[fathom-token-refresh] Token refresh failed for org ${orgId}: ${errorText}`)

          // Check if this is a permanent failure (invalid_grant means refresh token expired)
          const isPermFailure = errorText.includes('invalid_grant') ||
                               errorText.includes('expired') ||
                               tokenResponse.status === 400

          if (isPermFailure) {
            // Mark org integration as needing reconnection
            await supabase
              .from('fathom_org_integrations')
              .update({
                is_active: false,
                updated_at: new Date().toISOString(),
              })
              .eq('org_id', orgId)

            // TODO: Send email notification to user about reconnection needed

            results.push({
              org_id: orgId,
              connected_by_user_id: connectedBy,
              email,
              status: 'needs_reconnect',
              message: `Refresh token expired - user must reconnect Fathom`,
            })
          } else {
            results.push({
              org_id: orgId,
              connected_by_user_id: connectedBy,
              email,
              status: 'failed',
              message: `Token refresh failed: ${errorText.substring(0, 100)}`,
            })
          }
          continue
        }

        const tokenData = await tokenResponse.json()

        // Calculate new token expiry
        const expiresIn = tokenData.expires_in || 3600 // Default 1 hour
        const newTokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

        // Update tokens in database
        const { error: updateError } = await supabase
          .from('fathom_org_credentials')
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || creds.refresh_token, // Keep old if not provided
            token_expires_at: newTokenExpiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq('org_id', orgId)

        if (updateError) {
          results.push({
            org_id: orgId,
            connected_by_user_id: connectedBy,
            email,
            status: 'failed',
            message: `Database update failed: ${updateError.message}`,
          })
          continue
        }

        results.push({
          org_id: orgId,
          connected_by_user_id: connectedBy,
          email,
          status: 'refreshed',
          message: 'Token refreshed successfully',
          expires_at: newTokenExpiresAt,
        })

        console.log(`[fathom-token-refresh] ✅ Token refreshed for org ${orgId} (${email})`)

      } catch (error) {
        results.push({
          org_id: orgId,
          connected_by_user_id: connectedBy,
          email,
          status: 'failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
    } else {
      // Legacy fallback: per-user integrations (pre-org rollout)
      const { data: integrations, error: fetchError } = await supabase
        .from('fathom_integrations')
        .select('id, user_id, access_token, refresh_token, token_expires_at, fathom_user_email')
        .eq('is_active', true)

      if (fetchError) {
        throw new Error(`Failed to fetch integrations: ${fetchError.message}`)
      }

      if (!integrations || integrations.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'No active Fathom integrations to refresh',
            integrations_processed: 0,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      console.log(`[fathom-token-refresh] (legacy) Processing ${integrations.length} user integrations`)

      for (const integration of integrations) {
        try {
          const now = new Date()
          const expiresAt = new Date((integration as any).token_expires_at)
          const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)

          const shouldRefresh = hoursUntilExpiry < 24 || true
          if (!shouldRefresh) {
            results.push({
              org_id: 'legacy',
              connected_by_user_id: (integration as any).user_id,
              email: (integration as any).fathom_user_email || 'unknown',
              status: 'skipped',
              message: `Token valid for ${Math.round(hoursUntilExpiry)} more hours`,
              expires_at: (integration as any).token_expires_at,
            })
            continue
          }

          if (!(integration as any).refresh_token) {
            results.push({
              org_id: 'legacy',
              connected_by_user_id: (integration as any).user_id,
              email: (integration as any).fathom_user_email || 'unknown',
              status: 'needs_reconnect',
              message: 'No refresh token available - user must reconnect',
            })
            continue
          }

          const tokenParams = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: (integration as any).refresh_token,
            client_id: clientId,
            client_secret: clientSecret,
          })

          const tokenResponse = await fetch('https://fathom.video/external/v1/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams.toString(),
          })

          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text()
            const isPermFailure = errorText.includes('invalid_grant') || errorText.includes('expired') || tokenResponse.status === 400
            if (isPermFailure) {
              await supabase
                .from('fathom_integrations')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('id', (integration as any).id)
              results.push({
                org_id: 'legacy',
                connected_by_user_id: (integration as any).user_id,
                email: (integration as any).fathom_user_email || 'unknown',
                status: 'needs_reconnect',
                message: 'Refresh token expired - user must reconnect Fathom',
              })
            } else {
              results.push({
                org_id: 'legacy',
                connected_by_user_id: (integration as any).user_id,
                email: (integration as any).fathom_user_email || 'unknown',
                status: 'failed',
                message: `Token refresh failed: ${errorText.substring(0, 100)}`,
              })
            }
            continue
          }

          const tokenData = await tokenResponse.json()
          const expiresIn = tokenData.expires_in || 3600
          const newTokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

          const { error: updateError } = await supabase
            .from('fathom_integrations')
            .update({
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token || (integration as any).refresh_token,
              token_expires_at: newTokenExpiresAt,
              updated_at: new Date().toISOString(),
            })
            .eq('id', (integration as any).id)

          if (updateError) {
            results.push({
              org_id: 'legacy',
              connected_by_user_id: (integration as any).user_id,
              email: (integration as any).fathom_user_email || 'unknown',
              status: 'failed',
              message: `Database update failed: ${updateError.message}`,
            })
            continue
          }

          results.push({
            org_id: 'legacy',
            connected_by_user_id: (integration as any).user_id,
            email: (integration as any).fathom_user_email || 'unknown',
            status: 'refreshed',
            message: 'Token refreshed successfully',
            expires_at: newTokenExpiresAt,
          })
        } catch (error) {
          results.push({
            org_id: 'legacy',
            connected_by_user_id: (integration as any).user_id,
            email: (integration as any).fathom_user_email || 'unknown',
            status: 'failed',
            message: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    }

    // Summary stats
    const refreshed = results.filter(r => r.status === 'refreshed').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const failed = results.filter(r => r.status === 'failed').length
    const needsReconnect = results.filter(r => r.status === 'needs_reconnect').length

    const duration = Date.now() - startTime

    console.log(`[fathom-token-refresh] Complete: ${refreshed} refreshed, ${skipped} skipped, ${failed} failed, ${needsReconnect} need reconnect (${duration}ms)`)

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: results.length,
          refreshed,
          skipped,
          failed,
          needs_reconnect: needsReconnect,
          duration_ms: duration,
        },
        results,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('[fathom-token-refresh] Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
