/// <reference path="../deno.d.ts" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { matchOrCreateCompany } from '../_shared/companyMatching.ts'
import { selectPrimaryContact, determineMeetingCompany } from '../_shared/primaryContactSelection.ts'
import { analyzeTranscriptWithClaude, deduplicateActionItems, type TranscriptAnalysis } from './aiAnalysis.ts'
import { fetchTranscriptFromFathom, fetchSummaryFromFathom } from '../_shared/fathomTranscript.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Fathom Sync Engine Edge Function
 *
 * Purpose: Sync meetings from Fathom API to CRM database
 * Sync Types:
 *   - initial: User-initiated with custom date range
 *   - incremental: Hourly cron job (last 24h)
 *   - manual: User-triggered refresh (last 30 days)
 *   - all_time: Complete historical sync (all meetings ever)
 *   - webhook: Immediate sync on webhook notification
 */

interface SyncRequest {
  sync_type: 'initial' | 'incremental' | 'manual' | 'webhook' | 'all_time' | 'onboarding_fast' | 'onboarding_background'
  start_date?: string // ISO 8601
  end_date?: string
  call_id?: string // For webhook-triggered single call sync
  user_id?: string // For webhook calls that explicitly pass user ID
  org_id?: string // Org-scoped sync (preferred)
  limit?: number // Optional limit for test syncs (e.g., only sync last 5 calls)
  webhook_payload?: any // For webhook calls that pass the complete Fathom payload
  skip_thumbnails?: boolean // Skip thumbnail generation for faster syncs
  is_onboarding?: boolean // Flag to mark meetings as historical imports
}

interface MeetingLimits {
  is_free_tier: boolean
  max_meetings_per_month: number
  new_meetings_used: number
  historical_meetings: number
  total_meetings: number
  meetings_remaining: number
  can_sync_new: boolean
  historical_cutoff_date: string | null
}

interface FathomCall {
  id: string
  recording_id?: string | number // Alternative ID field from Fathom API
  title: string
  start_time: string
  end_time: string
  duration: number
  host_email: string
  host_name: string
  share_url: string
  app_url: string
  transcript_url?: string
  ai_summary?: {
    text: string
    key_points?: string[]
  }
  participants?: Array<{
    name: string
    email?: string
    is_host: boolean
  }>
  recording_status: 'processing' | 'ready' | 'failed'
}

interface FathomAnalytics {
  call_id: string
  sentiment?: {
    score: number
    label: 'positive' | 'neutral' | 'negative'
  }
  talk_time_analysis?: {
    rep_percentage: number
    customer_percentage: number
  }
  key_moments?: Array<{
    timestamp: number
    description: string
    type: 'question' | 'objection' | 'next_step' | 'highlight'
  }>
}

/**
 * Helper: Refresh OAuth access token if expired
 */
async function refreshAccessToken(
  supabase: any,
  integration: any,
  scope: 'org' | 'user'
): Promise<string> {
  const now = new Date()
  const expiresAt = new Date(integration.token_expires_at)

  // Check if token is expired or will expire within 5 minutes
  const bufferMs = 5 * 60 * 1000 // 5 minutes buffer
  if (expiresAt.getTime() - now.getTime() > bufferMs) {
    // Token is still valid
    return integration.access_token
  }
  // Get OAuth configuration
  const clientId = Deno.env.get('FATHOM_CLIENT_ID')
  const clientSecret = Deno.env.get('FATHOM_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error('Missing Fathom OAuth configuration for token refresh')
  }

  // Exchange refresh token for new access token
  const tokenParams = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: integration.refresh_token,
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
    throw new Error(`Token refresh failed: ${errorText}. Please reconnect your Fathom integration.`)
  }

  const tokenData = await tokenResponse.json()
  // Calculate new token expiry
  const expiresIn = tokenData.expires_in || 3600 // Default 1 hour
  const newTokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  // Update tokens in database
  const updatePayload = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || integration.refresh_token, // Some OAuth providers don't issue new refresh tokens
    token_expires_at: newTokenExpiresAt,
    updated_at: new Date().toISOString(),
  }

  const updateQuery =
    scope === 'org'
      ? supabase.from('fathom_org_credentials').update(updatePayload).eq('org_id', integration.org_id)
      : supabase.from('fathom_integrations').update(updatePayload).eq('id', integration.id)

  const { error: updateError } = await updateQuery

  if (updateError) {
    throw new Error(`Failed to update refreshed tokens: ${updateError.message}`)
  }
  return tokenData.access_token
}

/**
 * Helper: Check meeting limits for an organization
 * Returns limit info and whether sync is allowed
 */
async function checkMeetingLimits(supabase: any, orgId: string): Promise<MeetingLimits | null> {
  try {
    const { data, error } = await supabase.rpc('check_meeting_limits', { p_org_id: orgId })
    
    if (error) {
      console.error('[fathom-sync] Error checking meeting limits:', error)
      return null
    }
    
    if (!data || data.length === 0) {
      // No subscription found - treat as free tier with defaults
      return {
        is_free_tier: true,
        max_meetings_per_month: 15,
        new_meetings_used: 0,
        historical_meetings: 0,
        total_meetings: 0,
        meetings_remaining: 15,
        can_sync_new: true,
        historical_cutoff_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      }
    }
    
    return data[0] as MeetingLimits
  } catch (err) {
    console.error('[fathom-sync] Exception checking meeting limits:', err)
    return null
  }
}

/**
 * Helper: Enforce free tier date limit
 * Returns adjusted start date for free tier users
 */
function enforceFreeTierDateLimit(
  requestedStartDate: string | undefined,
  limits: MeetingLimits | null,
  syncType: string
): { startDate: string | undefined; upgradeRequired: boolean; reason?: string } {
  // Skip limit enforcement for paid users
  if (!limits?.is_free_tier) {
    return { startDate: requestedStartDate, upgradeRequired: false }
  }
  
  // Calculate 30 days ago
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  
  // If no start date specified, use defaults based on sync type
  if (!requestedStartDate) {
    // For most sync types, default to 30 days
    return { 
      startDate: thirtyDaysAgo.toISOString(), 
      upgradeRequired: false 
    }
  }
  
  // Check if requested date is older than 30 days
  const requestedDate = new Date(requestedStartDate)
  if (requestedDate < thirtyDaysAgo) {
    console.log(`[fathom-sync] Free tier: Requested ${requestedStartDate} but limiting to ${thirtyDaysAgo.toISOString()}`)
    return {
      startDate: thirtyDaysAgo.toISOString(),
      upgradeRequired: true,
      reason: 'Free tier is limited to meetings from the last 30 days. Upgrade to access your full history.',
    }
  }
  
  return { startDate: requestedStartDate, upgradeRequired: false }
}

/**
 * Helper: Extract share token and build a stable embed URL
 */
function buildEmbedUrl(shareUrl?: string, recordingId?: string | number): string | null {
  try {
    if (recordingId) {
      return `https://app.fathom.video/recording/${recordingId}`
    }
    if (!shareUrl) return null
    const u = new URL(shareUrl)
    const parts = u.pathname.split('/').filter(Boolean)
    const token = parts.pop()
    if (!token) return null
    return `https://fathom.video/embed/${token}`
  } catch {
    return null
  }
}

/**
 * Normalize calendar_invitees_type to allowed values for DB check constraint.
 * Only 'all_internal' or 'one_or_more_external' are permitted; everything else becomes null.
 */
function normalizeInviteesType(rawType: unknown): 'all_internal' | 'one_or_more_external' | null {
  if (!rawType || typeof rawType !== 'string') return null
  const value = rawType.toLowerCase().replace('-', '_').trim()
  if (value === 'all_internal') return 'all_internal'
  if (value === 'one_or_more_external') return 'one_or_more_external'
  return null
}


/**
 * Helper: Generate video thumbnail by calling the thumbnail generation service
 */
async function generateVideoThumbnail(
  recordingId: string | number,
  shareUrl: string,
  embedUrl: string,
  meetingId?: string
): Promise<string | null> {
  try {
    const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-video-thumbnail-v2`
    const requestBody: any = {
      recording_id: String(recordingId),
      share_url: shareUrl,
      fathom_embed_url: embedUrl,
    }
    
    // Include meeting_id if available so thumbnail can be persisted to database
    if (meetingId) {
      requestBody.meeting_id = meetingId
    }
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Thumbnail generation failed (status ${response.status}):`, errorText.substring(0, 200))
      return null
    }

    const data = await response.json()

    if (data.success && data.thumbnail_url) {
      return data.thumbnail_url
    }
    
    console.warn(`⚠️  Thumbnail generation returned unsuccessful response:`, data)
    return null
  } catch (error) {
    console.error(`❌ Error calling thumbnail generation function:`, error instanceof Error ? error.message : String(error))
    return null
  }
}

/**
 * Helper: Fetch summary text for a recording when not present in bulk payload
 */
async function fetchRecordingSummary(apiKey: string, recordingId: string | number): Promise<string | null> {
  const url = `https://api.fathom.ai/external/v1/recordings/${recordingId}/summary`
  const resp = await fetch(url, { headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' } })
  if (!resp.ok) return null
  const data = await resp.json().catch(() => null)
  // Prefer markdown if present; otherwise look for plain text
  const md = data?.summary?.markdown_formatted || data?.summary?.markdown || null
  const txt = data?.summary?.text || null
  return md || txt
}

/**
 * Helper: Fetch transcript plaintext when needed (optional)
 */
async function fetchRecordingTranscriptPlaintext(apiKey: string, recordingId: string | number): Promise<string | null> {
  const url = `https://api.fathom.ai/external/v1/recordings/${recordingId}/transcript`
  const resp = await fetch(url, { headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' } })
  if (!resp.ok) return null
  const data = await resp.json().catch(() => null)
  if (!data) return null
  // If the API returns an array of transcript lines, join them into plaintext
  if (Array.isArray(data.transcript)) {
    const lines = data.transcript.map((t: any) => {
      const speaker = t?.speaker?.display_name ? `${t.speaker.display_name}: ` : ''
      const text = t?.text || ''
      return `${speaker}${text}`.trim()
    })
    return lines.join('\n')
  }
  return typeof data === 'string' ? data : null
}

/**
 * Helper: Fetch full recording details including action items
 * Action items are not included in the bulk meetings API response
 * We must fetch the full recording details to get action items
 */
async function fetchRecordingActionItems(apiKey: string, recordingId: string | number): Promise<any[] | null> {
  // Use the full recording details endpoint, not the separate action_items endpoint
  const url = `https://api.fathom.ai/external/v1/recordings/${recordingId}`
  const resp = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  })

  if (!resp.ok) {
    // Try with X-Api-Key header instead
    const resp2 = await fetch(url, {
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json'
      }
    })

    if (!resp2.ok) {
      return null
    }
    const data = await resp2.json().catch((err) => {
      return null
    })

    // Log the actual response for debugging
    if (data?.action_items !== undefined) {
    }

    if (data?.action_items && Array.isArray(data.action_items)) {
      return data.action_items
    }
    return null
  }
  const data = await resp.json().catch((err) => {
    return null
  })

  // Log the actual response for debugging
  if (data?.action_items !== undefined) {
  }

  if (data?.action_items && Array.isArray(data.action_items)) {
    return data.action_items
  }
  return null
}

async function createGoogleDocForTranscript(supabase: any, userId: string, meetingId: string, title: string, plaintext: string): Promise<string | null> {
  try {
    const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-docs-create`
    // Create a service role client to mint a short-lived user JWT by calling auth API
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Create a JWT for the user via admin API (if available) or fetch session from DB
    // Fallback: use service role header; function uses Authorization header to lookup user via getUser(jwt)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: title || 'Meeting Transcript',
        content: plaintext,
        metadata: { meetingId },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return null
    }

    const data = await response.json()
    return data?.url || null
  } catch (e) {
    return null
  }
}

serve(async (req) => {
  // For error handling: capture which sync state row to update
  let syncStateOrgId: string | null = null
  let syncStateUserId: string | null = null
  let syncStateScope: 'org' | 'user' | null = null

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    // Parse request body first
    const body: SyncRequest = await req.json()

    // Determine caller context
    const authHeaderRaw = req.headers.get('Authorization')?.trim() || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const isServiceRoleCall = !!serviceRoleKey && authHeaderRaw === `Bearer ${serviceRoleKey}`

    // Resolve org/user from body and/or auth
    let userId: string | null = null
    let orgId: string | null = body.org_id || null

    if (body.user_id) {
      // SECURITY: only internal callers (service role) may specify user_id explicitly.
      if (!isServiceRoleCall) throw new Error('Unauthorized: user_id can only be provided by internal callers')
      userId = body.user_id

      // Legacy: if org_id isn't provided, use first org membership
      if (!orgId) {
        const { data: membership } = await supabase
          .from('organization_memberships')
          .select('org_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        orgId = membership?.org_id || null
      }
    } else if (orgId && isServiceRoleCall) {
      // Internal org-scoped call (preferred for webhook/cron). No user context required.
      userId = null
    } else {
      // Regular authenticated call
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        throw new Error('Missing authorization header')
      }

      // Get user from token
      const token = authHeader.replace('Bearer ', '').trim()
      const { data: { user }, error: userError } = await supabase.auth.getUser(token)

      if (userError || !user) {
        throw new Error('Unauthorized: Invalid token')
      }

      userId = user.id

      // If org_id isn't provided, use first membership. If it is provided, enforce membership.
      if (!orgId) {
        const { data: membership } = await supabase
          .from('organization_memberships')
          .select('org_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        orgId = membership?.org_id || null
      } else {
        const { data: membership } = await supabase
          .from('organization_memberships')
          .select('org_id')
          .eq('org_id', orgId)
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle()
        if (!membership) throw new Error('Forbidden: You are not a member of this organization')
      }
    }
    const { sync_type, start_date, end_date, call_id, limit, webhook_payload, skip_thumbnails } = body

    // Load integration (org-scoped preferred; user-scoped fallback for legacy)
    let integration: any = null
    let integrationScope: 'org' | 'user' = 'org'

    if (orgId) {
      const { data: orgIntegration, error: orgIntegrationError } = await supabase
        .from('fathom_org_integrations')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .maybeSingle()

      if (!orgIntegrationError && orgIntegration) {
        const { data: creds, error: credsError } = await supabase
          .from('fathom_org_credentials')
          .select('*')
          .eq('org_id', orgId)
          .single()

        if (credsError) {
          throw new Error(`Fathom credentials missing for org: ${credsError.message}`)
        }

        integration = {
          ...orgIntegration,
          ...creds,
          org_id: orgId,
          _scope: 'org',
        }
        integrationScope = 'org'
      }
    }

    // Legacy per-user fallback if org integration is not configured
    if (!integration && userId) {
      const { data: userIntegration, error: integrationError } = await supabase
        .from('fathom_integrations')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle()

      if (integrationError) {
        throw new Error(`Fathom integration error: ${integrationError.message}`)
      }

      if (userIntegration) {
        integration = { ...userIntegration, _scope: 'user' }
        integrationScope = 'user'
      }
    }

    if (!integration) {
      throw new Error('No active Fathom integration found. Please connect Fathom in Integrations.')
    }

    const effectiveUserIdForOwnership =
      userId || integration.connected_by_user_id || integration.user_id || null

    // Capture for error-state updates
    syncStateOrgId = orgId
    syncStateUserId = userId
    syncStateScope = integrationScope

    console.log(`[fathom-sync] scope=${integrationScope} org_id=${orgId || 'null'} user_id=${userId || 'null'}`)

    // ========================================================================
    // FREE TIER ENFORCEMENT: Check meeting limits before syncing
    // ========================================================================
    let meetingLimits: MeetingLimits | null = null
    let upgradeRequired = false
    let limitWarning: string | undefined
    const isOnboardingSync = sync_type === 'onboarding_fast' || sync_type === 'onboarding_background' || body.is_onboarding
    
    if (orgId) {
      meetingLimits = await checkMeetingLimits(supabase, orgId)
      
      if (meetingLimits) {
        console.log(`[fathom-sync] Meeting limits for org ${orgId}:`, {
          is_free_tier: meetingLimits.is_free_tier,
          new_meetings_used: meetingLimits.new_meetings_used,
          max_meetings: meetingLimits.max_meetings_per_month,
          can_sync_new: meetingLimits.can_sync_new,
          meetings_remaining: meetingLimits.meetings_remaining,
        })
        
        // Check if free tier can sync new meetings (skip for onboarding syncs which are historical)
        if (meetingLimits.is_free_tier && !meetingLimits.can_sync_new && !isOnboardingSync) {
          // Return early with upgrade required response
          return new Response(
            JSON.stringify({
              success: false,
              upgrade_required: true,
              error: `You've reached your free tier limit of ${meetingLimits.max_meetings_per_month} meetings. Upgrade to sync more meetings.`,
              limits: {
                used: meetingLimits.new_meetings_used,
                max: meetingLimits.max_meetings_per_month,
                remaining: 0,
              },
            }),
            {
              status: 402, // Payment Required
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
      }
    }

    // Update sync state to 'syncing'
    if (integrationScope === 'org') {
      await supabase
        .from('fathom_org_sync_state')
        .upsert({
          org_id: orgId,
          integration_id: integration.id,
          sync_status: 'syncing',
          last_sync_started_at: new Date().toISOString(),
        }, { onConflict: 'org_id' })
    } else if (userId) {
      await supabase
        .from('fathom_sync_state')
        .upsert({
          user_id: userId,
          integration_id: integration.id,
          sync_status: 'syncing',
          last_sync_started_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
    }

    let meetingsSynced = 0
    let totalMeetingsFound = 0
    const errors: Array<{ call_id: string; error: string }> = []

    // Single call sync (webhook-triggered)
    if (sync_type === 'webhook') {
      // If webhook_payload is provided, use it directly
      if (webhook_payload) {
        // Webhook syncs are for new meetings (not historical)
        if (!effectiveUserIdForOwnership) throw new Error('Cannot resolve user context for webhook sync')
        const result = await syncSingleCall(supabase, effectiveUserIdForOwnership, orgId, integration, webhook_payload, skip_thumbnails, false)

        if (result.success) {
          meetingsSynced = 1
          totalMeetingsFound = 1
        } else {
          const recordingId = webhook_payload.recording_id || webhook_payload.id || 'unknown'
          errors.push({ call_id: recordingId, error: result.error || 'Unknown error' })
        }
      } else if (call_id) {
        // Legacy: fetch single call by ID (not historical)
        if (!effectiveUserIdForOwnership) throw new Error('Cannot resolve user context for webhook sync')
        const result = await syncSingleCall(supabase, effectiveUserIdForOwnership, orgId, integration, call_id, skip_thumbnails, false)

        if (result.success) {
          meetingsSynced = 1
          totalMeetingsFound = 1
        } else {
          errors.push({ call_id, error: result.error || 'Unknown error' })
        }
      } else {
        errors.push({ call_id: 'unknown', error: 'Webhook sync requires either webhook_payload or call_id' })
      }
    } else {
      // Bulk sync (initial, incremental, manual, onboarding_fast, onboarding_background)
      let apiStartDate = start_date
      let apiEndDate = end_date
      let syncLimit = limit
      
      // For onboarding syncs, set specific behaviors
      const isOnboardingFast = sync_type === 'onboarding_fast'
      const isOnboardingBackground = sync_type === 'onboarding_background'
      const markAsHistorical = isOnboardingFast || isOnboardingBackground || body.is_onboarding

      // Default date ranges based on sync type
      if (!apiStartDate) {
        const now = new Date()
        switch (sync_type) {
          case 'incremental':
            // Last 24 hours for incremental sync
            apiStartDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
            apiEndDate = now.toISOString()
            break
          case 'all_time':
            // All time - BUT enforce free tier limit
            if (meetingLimits?.is_free_tier) {
              // Free tier: limit to 30 days
              apiStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
              upgradeRequired = true
              limitWarning = 'Free tier is limited to meetings from the last 30 days. Upgrade to access your full history.'
            } else {
              apiStartDate = undefined
            }
            apiEndDate = now.toISOString()
            break
          case 'onboarding_fast':
            // Phase 1: Just 3 most recent meetings for instant value
            apiStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
            apiEndDate = now.toISOString()
            syncLimit = 3 // Only sync 3 meetings
            console.log('[fathom-sync] Onboarding fast sync: limiting to 3 most recent meetings')
            break
          case 'onboarding_background':
            // Phase 2: Rest of last 30 days (for free tier)
            if (meetingLimits?.is_free_tier) {
              apiStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
            } else {
              // Paid: can sync more history
              apiStartDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
            }
            apiEndDate = now.toISOString()
            console.log('[fathom-sync] Onboarding background sync: syncing remaining meetings from', apiStartDate)
            break
          case 'initial':
          case 'manual':
            // Last 30 days for initial/manual sync (can be overridden by request)
            apiStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
            apiEndDate = now.toISOString()
            break
        }
      }
      // Fetch calls from Fathom API with cursor-based pagination
      let cursor: string | undefined = undefined
      const apiLimit = syncLimit || limit || 100 // Use syncLimit (from onboarding types) or provided limit or default
      let hasMore = true
      let pageCount = 0
      const maxPages = 100 // Safety limit to prevent infinite loops

      // If user specified a limit or we set one for onboarding, only fetch one batch
      const isLimitedSync = !!syncLimit || !!limit

      while (hasMore && pageCount < maxPages) {
        pageCount++
        const response = await fetchFathomCalls(integration, {
          start_date: apiStartDate,
          end_date: apiEndDate,
          limit: apiLimit,
          cursor,
        }, supabase)

        const calls = response.items
        totalMeetingsFound += calls.length

        // Process each call
        for (const call of calls) {
          try {
            // Pass markAsHistorical flag for onboarding syncs
            if (!effectiveUserIdForOwnership) throw new Error('Cannot resolve user context for sync')
            const result = await syncSingleCall(supabase, effectiveUserIdForOwnership, orgId, integration, call, skip_thumbnails, markAsHistorical)

            if (result.success) {
              meetingsSynced++
            } else {
              errors.push({ call_id: String(call.recording_id || call.id), error: result.error || 'Unknown error' })
            }
          } catch (error) {
            errors.push({
              call_id: String(call.recording_id || call.id),
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          }
        }

        // Check if there are more results using cursor-based pagination
        // If this is a limited sync (test mode), stop after first batch
        if (isLimitedSync) {
          hasMore = false
        } else {
          // Use has_more from API response and cursor for next page
          hasMore = response.has_more && !!response.cursor
          cursor = response.cursor
        }
      }
      // Fallback: if nothing found in the selected window, retry once without date filters
      if (totalMeetingsFound === 0 && (apiStartDate || apiEndDate)) {
        const retryResponse = await fetchFathomCalls(integration, { limit: apiLimit }, supabase)
        const retryCalls = retryResponse.items
        totalMeetingsFound += retryCalls.length

        if (retryCalls.length > 0) {
          for (const call of retryCalls) {
            try {
              // Fallback retries also use markAsHistorical flag
              if (!effectiveUserIdForOwnership) throw new Error('Cannot resolve user context for sync')
              const result = await syncSingleCall(supabase, effectiveUserIdForOwnership, orgId, integration, call, skip_thumbnails, markAsHistorical)
              if (result.success) meetingsSynced++
            } catch (error) {
            }
          }
        }
      }
    }

    // Update sync state to 'idle' with results
    if (integrationScope === 'org') {
      await supabase
        .from('fathom_org_sync_state')
        .update({
          sync_status: 'idle',
          last_successful_sync: new Date().toISOString(),
          last_sync_completed_at: new Date().toISOString(),
          meetings_synced: meetingsSynced,
          total_meetings_found: totalMeetingsFound,
          error_message: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null,
        })
        .eq('org_id', orgId)

      // Update integration metadata
      if (orgId) {
        await supabase
          .from('fathom_org_integrations')
          .update({
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('org_id', orgId)
      }
    } else if (userId) {
      await supabase
        .from('fathom_sync_state')
        .update({
          sync_status: 'idle',
          last_sync_completed_at: new Date().toISOString(),
          meetings_synced: meetingsSynced,
          total_meetings_found: totalMeetingsFound,
          last_sync_error: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null,
        })
        .eq('user_id', userId)

      // Best-effort: update legacy integration metadata
      await supabase
        .from('fathom_integrations')
        .update({
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
    }

    // USAGE LIMIT WARNING: Check if user is approaching their limit (80%) and send email
    if (meetingLimits && meetingLimits.is_free_tier && meetingsSynced > 0) {
      const warningUserId: string | null = userId || integration.connected_by_user_id || null
      const newUsed = meetingLimits.new_meetings_used + meetingsSynced
      const usagePercent = (newUsed / meetingLimits.max_meetings_per_month) * 100
      
      // Send warning at 80% usage (12 out of 15 meetings)
      if (usagePercent >= 80 && usagePercent < 100) {
        console.log(`⚠️ User approaching limit: ${newUsed}/${meetingLimits.max_meetings_per_month} (${usagePercent.toFixed(0)}%)`)
        
        // Check if we've already sent a warning email (to avoid spam)
        try {
          if (!warningUserId) {
            console.warn('[fathom-sync] Cannot send usage warning: no user context available')
          } else {
          const { data: existingWarning } = await supabase
            .from('email_logs')
            .select('id')
            .eq('user_id', warningUserId)
            .eq('email_type', 'meeting_limit_warning')
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
            .limit(1)
          
          if (!existingWarning || existingWarning.length === 0) {
            // Get user email
            const { data: userData } = await supabase.auth.admin.getUserById(warningUserId)
            
            if (userData?.user?.email) {
              // Fire-and-forget: Send warning email via encharge-email function
              fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/encharge-email`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  email_type: 'meeting_limit_warning',
                  to_email: userData.user.email,
                  to_name: userData.user.user_metadata?.full_name || userData.user.email.split('@')[0],
                  user_id: warningUserId,
                  data: {
                    meetings_used: newUsed,
                    meetings_limit: meetingLimits.max_meetings_per_month,
                    meetings_remaining: meetingLimits.max_meetings_per_month - newUsed,
                    usage_percent: usagePercent,
                  },
                }),
              }).then(response => {
                if (response.ok) {
                  console.log(`✅ Usage limit warning email sent to ${userData.user?.email}`)
                } else {
                  console.warn(`⚠️ Failed to send usage limit warning email: ${response.status}`)
                }
              }).catch(err => {
                console.error(`⚠️ Error sending usage limit warning email:`, err)
              })
            }
          } else {
            console.log(`📧 Usage limit warning already sent recently, skipping`)
          }
          }
        } catch (emailError) {
          console.error(`⚠️ Error checking/sending usage limit warning:`, emailError)
        }
        
        // Set the limit warning message
        limitWarning = `You're using ${newUsed} of ${meetingLimits.max_meetings_per_month} meetings. Upgrade to get unlimited meetings.`
      }
    }

    // AUTO-INDEX: Trigger queue processor to index newly synced meetings
    // This runs asynchronously in the background after sync completes
    if (meetingsSynced > 0) {
      console.log(`🔍 Triggering AI search indexing for ${meetingsSynced} synced meetings`)
      try {
        // Fire-and-forget: Don't await to avoid blocking the sync response
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/meeting-intelligence-process-queue`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            limit: Math.min(meetingsSynced, 50), // Process up to 50 meetings per batch
          }),
        }).then(response => {
          if (response.ok) {
            console.log(`✅ AI search indexing triggered successfully`)
          } else {
            console.warn(`⚠️  AI search indexing trigger returned status ${response.status}`)
          }
        }).catch(err => {
          console.error(`⚠️  Failed to trigger AI search indexing:`, err)
        })
      } catch (triggerError) {
        // Non-fatal - log but don't fail the sync response
        console.error(`⚠️  Error triggering AI search indexing:`, triggerError)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sync_type,
        meetings_synced: meetingsSynced,
        total_meetings_found: totalMeetingsFound,
        errors: errors.length > 0 ? errors : undefined,
        // Free tier limit info
        upgrade_required: upgradeRequired,
        limit_warning: limitWarning,
        limits: meetingLimits ? {
          is_free_tier: meetingLimits.is_free_tier,
          used: meetingLimits.new_meetings_used + meetingsSynced, // Include newly synced
          max: meetingLimits.max_meetings_per_month,
          remaining: Math.max(0, meetingLimits.meetings_remaining - meetingsSynced),
          historical: meetingLimits.historical_meetings,
        } : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    // Try to update sync state to error
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      const message = error instanceof Error ? error.message : 'Unknown error'

      if (syncStateScope === 'org' && syncStateOrgId) {
        await supabase
          .from('fathom_org_sync_state')
          .update({
            sync_status: 'error',
            error_message: message,
            last_error_at: new Date().toISOString(),
            last_sync_completed_at: new Date().toISOString(),
          })
          .eq('org_id', syncStateOrgId)
      } else if (syncStateUserId) {
        await supabase
          .from('fathom_sync_state')
          .update({
            sync_status: 'error',
            last_sync_error: message,
          })
          .eq('user_id', syncStateUserId)
      }
    } catch (updateError) {
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

/**
 * Retry helper with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on authentication errors (401, 403)
      if (lastError.message.includes('401') || lastError.message.includes('403')) {
        throw lastError
      }

      // If this is the last attempt, throw the error
      if (attempt === maxRetries - 1) {
        throw lastError
      }

      // Calculate backoff delay with jitter
      const delay = initialDelayMs * Math.pow(2, attempt) + Math.random() * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * Response type for paginated Fathom API calls
 */
interface FathomPaginatedResponse {
  items: FathomCall[]
  has_more: boolean
  cursor?: string
}

/**
 * Fetch calls from Fathom API with proper cursor-based pagination
 */
async function fetchFathomCalls(
  integration: any,
  params: {
    start_date?: string
    end_date?: string
    limit?: number
    cursor?: string  // Use cursor instead of offset for proper pagination
  },
  supabase?: any
): Promise<FathomPaginatedResponse> {
  const queryParams = new URLSearchParams()

  // Fathom API uses created_after/created_before instead of start_date/end_date
  if (params.start_date) queryParams.set('created_after', params.start_date)
  if (params.end_date) queryParams.set('created_before', params.end_date)
  // Request larger page size (100) to get more meetings per request
  queryParams.set('limit', String(params.limit ?? 100))

  // Use cursor for pagination (Fathom uses cursor-based pagination)
  if (params.cursor) {
    queryParams.set('cursor', params.cursor)
  }

  // Correct API base URL
  const url = `https://api.fathom.ai/external/v1/meetings?${queryParams.toString()}`

  return await retryWithBackoff(async () => {
    // Refresh token if expired (only if supabase client is provided)
    let accessToken = integration.access_token
    if (supabase) {
      try {
        accessToken = await refreshAccessToken(supabase, integration, integration._scope === 'org' ? 'org' : 'user')
        // Update the integration object with the new token
        integration.access_token = accessToken
        console.log(`✅ Token refreshed successfully (${integration._scope || 'user'} scope)`)
      } catch (error) {
        // Log the error but continue with existing token
        console.error(`⚠️ Token refresh failed (${integration._scope || 'user'} scope):`, error instanceof Error ? error.message : String(error))
        console.error('Token refresh error details:', error)
        // Continue with existing token - it might still work
      }
    }
    // OAuth tokens typically use Authorization: Bearer, not X-Api-Key
    // Try Bearer first (standard for OAuth), then fallback to X-Api-Key
    let response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })
    // If Bearer fails with 401, try X-Api-Key (for API keys)
    if (response.status === 401) {
      response = await fetch(url, {
        headers: {
          'X-Api-Key': accessToken,
          'Content-Type': 'application/json',
        },
      })
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Fathom API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    // DEBUG: Log raw API response to understand pagination structure
    console.log('[Fathom API] Raw response keys:', Object.keys(data))
    console.log('[Fathom API] has_more:', data.has_more, 'hasMore:', data.hasMore)
    console.log('[Fathom API] cursor:', data.cursor, 'next_cursor:', data.next_cursor)
    console.log('[Fathom API] total_count:', data.total_count, 'total:', data.total)
    if (data.items) console.log('[Fathom API] items count:', data.items.length)
    if (data.meetings) console.log('[Fathom API] meetings count:', data.meetings.length)

    // Fathom API returns meetings array directly or in a data wrapper
    // Handle different possible response structures
    let meetings: FathomCall[] = []
    let has_more = false
    let cursor: string | undefined = undefined

    if (Array.isArray(data)) {
      // Response is directly an array (no pagination info)
      meetings = data
      has_more = false
    } else if (data.items && Array.isArray(data.items)) {
      // Response has an items property that's an array (actual Fathom API structure)
      meetings = data.items
      // Fathom API uses next_cursor for pagination - presence of next_cursor means more results
      cursor = data.next_cursor || data.cursor || data.nextCursor || undefined
      // If next_cursor exists, there are more results to fetch
      has_more = !!cursor
    } else if (data.meetings && Array.isArray(data.meetings)) {
      // Response has a meetings property that's an array
      meetings = data.meetings
      has_more = data.has_more === true || false
      cursor = data.cursor || data.next_cursor || undefined
    } else if (data.data && Array.isArray(data.data)) {
      // Response has a data property that's an array
      meetings = data.data
      has_more = data.has_more === true || false
      cursor = data.cursor || data.next_cursor || undefined
    } else if (data.calls && Array.isArray(data.calls)) {
      // Response has a calls property that's an array
      meetings = data.calls
      has_more = data.has_more === true || false
      cursor = data.cursor || data.next_cursor || undefined
    } else {
      // Unknown structure, return empty
      meetings = []
      has_more = false
    }

    return { items: meetings, has_more, cursor }
  })
}

/**
 * Condense meeting summary into one-liners using Claude Haiku 4.5
 */
async function condenseMeetingSummary(
  supabase: any,
  meetingId: string,
  summary: string,
  title: string
): Promise<void> {
  try {
    const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/condense-meeting-summary`

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary,
        meetingTitle: title,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return // Non-fatal error - continue without condensed summaries
    }

    const data = await response.json()

    if (data.success && data.meeting_about && data.next_steps) {
      // Update meeting with condensed summaries
      await supabase
        .from('meetings')
        .update({
          summary_oneliner: data.meeting_about,
          next_steps_oneliner: data.next_steps,
        })
        .eq('id', meetingId)
    } else {
    }
  } catch (error) {
    // Non-fatal - don't throw, allow meeting sync to continue
  }
}

/**
 * Helper: dynamic cooldown for transcript fetch attempts
 * Gradually increases the wait between attempts to avoid hammering Fathom API
 */
function calculateTranscriptFetchCooldownMinutes(attempts: number | null | undefined): number {
  const count = attempts ?? 0

  if (count >= 24) return 720 // 12 hours after many attempts
  if (count >= 12) return 180 // 3 hours after a dozen attempts
  if (count >= 6) return 60 // 1 hour after repeated attempts
  if (count >= 3) return 15 // 15 minutes after a few retries

  return 5 // default: retry after 5 minutes
}

/**
 * Auto-fetch transcript and summary, then analyze with Claude AI
 * Includes smart retry logic for Fathom's async processing
 */
async function autoFetchTranscriptAndAnalyze(
  supabase: any,
  userId: string,
  integration: any,
  meeting: any,
  call: any
): Promise<void> {
  try {
    // Get recording ID from multiple possible sources
    const recordingId = call.recording_id || call.id || meeting.fathom_recording_id
    
    // If no recording ID available, cannot fetch transcript
    if (!recordingId) {
      console.log(`⚠️  No recording ID available for meeting ${meeting.id} - skipping transcript fetch`)
      return
    }

    // Track retry attempts with adaptive backoff to avoid hammering the API
    const fetchAttempts = meeting.transcript_fetch_attempts || 0
    const cooldownMinutes = calculateTranscriptFetchCooldownMinutes(fetchAttempts)

    // Check if we already have transcript AND AI analysis completed
    // This prevents cooldown from blocking AI analysis on existing transcripts
    if (meeting.transcript_text) {
      // Check if AI analysis has already been completed (has sentiment_score or talk_time data)
      const hasAIAnalysis = meeting.sentiment_score !== null || meeting.talk_time_rep_pct !== null
      
      // Check if action items exist for this meeting
      const { data: existingActionItems, error: aiCheckError } = await supabase
        .from('meeting_action_items')
        .select('id')
        .eq('meeting_id', meeting.id)
        .limit(1)

      if (aiCheckError) {
        console.warn(`⚠️  Error checking action items for meeting ${meeting.id}:`, aiCheckError.message)
      }

      // If we have both AI analysis AND action items, skip processing
      if (hasAIAnalysis && existingActionItems && existingActionItems.length > 0) {
        console.log(`✅ Meeting ${meeting.id} already has AI analysis and action items - skipping`)
        return
      }
      
      // If we have transcript but missing AI analysis, continue to run analysis
      if (!hasAIAnalysis) {
        console.log(`🤖 Meeting ${meeting.id} has transcript but missing AI analysis - will run analysis`)
        // Continue to AI analysis using existing transcript
        // NOTE: Cooldown does NOT apply here - we're just running AI on existing transcript
      }
    }

    // Check last attempt time - wait at least 5 minutes between attempts
    // IMPORTANT: Only applies when we need to FETCH a new transcript
    // BUT: Always attempt fetch if transcript is missing, even if cooldown hasn't passed
    // This ensures transcripts are eventually fetched
    if (!meeting.transcript_text && meeting.last_transcript_fetch_at) {
      const lastAttempt = new Date(meeting.last_transcript_fetch_at)
      const now = new Date()
      const minutesSinceLastAttempt = (now.getTime() - lastAttempt.getTime()) / (1000 * 60)

      if (!isFinite(minutesSinceLastAttempt) || minutesSinceLastAttempt < 0) {
        // Invalid date, proceed with fetch
      } else if (minutesSinceLastAttempt < cooldownMinutes) {
        // Still in cooldown, but log for debugging
        const waitMinutes = Math.ceil(cooldownMinutes - minutesSinceLastAttempt)
        console.log(`⏳ Transcript fetch cooldown active for meeting ${meeting.id} - waiting ${waitMinutes} more minutes`)
        // Continue anyway - we'll attempt fetch but respect API rate limits
      }
    }

    // Determine if we need to fetch transcript or use existing
    let transcript: string | null = meeting.transcript_text

    if (!transcript) {
      console.log(`📄 Attempting to fetch transcript for meeting ${meeting.id} (recording ID: ${recordingId}, attempt ${fetchAttempts + 1})`)
      
      // Update fetch tracking BEFORE attempting fetch
      await supabase
        .from('meetings')
        .update({
          transcript_fetch_attempts: fetchAttempts + 1,
          last_transcript_fetch_at: new Date().toISOString(),
        })
        .eq('id', meeting.id)

      // Fetch transcript - ensure we use the refreshed token
      const accessToken = integration.access_token
      transcript = await fetchTranscriptFromFathom(accessToken, String(recordingId))

      if (!transcript) {
        console.log(`ℹ️  Transcript not yet available for meeting ${meeting.id} (recording ID: ${recordingId}) - will retry later`)
        return
      }
      
      console.log(`✅ Successfully fetched transcript for meeting ${meeting.id} (${transcript.length} characters)`)
      // Fetch enhanced summary
      let summaryData: any = null
      try {
        summaryData = await fetchSummaryFromFathom(accessToken, String(recordingId))
        if (summaryData) {
          console.log(`✅ Successfully fetched enhanced summary for meeting ${meeting.id}`)
        }
      } catch (error) {
        console.error(`⚠️  Failed to fetch enhanced summary for meeting ${meeting.id}:`, error instanceof Error ? error.message : String(error))
      }

      // Store transcript immediately
      await supabase
        .from('meetings')
        .update({
          transcript_text: transcript,
          summary: summaryData?.summary || meeting.summary, // Keep existing summary if new one not available
        })
        .eq('id', meeting.id)

      // AUTO-INDEX: Queue meeting for AI search indexing after transcript is saved
      // This ensures all meetings with transcripts are automatically searchable
      console.log(`🔍 Queueing meeting ${meeting.id} for AI search indexing`)
      try {
        await supabase
          .from('meeting_index_queue')
          .upsert({
            meeting_id: meeting.id,
            user_id: meeting.owner_user_id || userId,
            priority: 0, // Normal priority for auto-indexed meetings
          }, { onConflict: 'meeting_id' })
        console.log(`✅ Meeting ${meeting.id} queued for indexing`)
      } catch (indexQueueError) {
        // Non-fatal - log but don't fail the sync
        console.error(`⚠️  Failed to queue meeting for indexing:`, indexQueueError instanceof Error ? indexQueueError.message : String(indexQueueError))
      }

      // Condense summary if we have a new one (non-blocking)
      const finalSummary = summaryData?.summary || meeting.summary
      if (finalSummary && finalSummary.length > 0) {
        // Fire-and-forget - don't block sync on AI summarization
        condenseMeetingSummary(supabase, meeting.id, finalSummary, meeting.title || 'Meeting')
          .catch(err => undefined)
      }
    } else {
      // Meeting already has transcript - ensure it's queued for indexing
      // This handles cases where transcript exists but wasn't indexed yet
      console.log(`🔍 Queueing existing transcript meeting ${meeting.id} for AI search indexing`)
      try {
        await supabase
          .from('meeting_index_queue')
          .upsert({
            meeting_id: meeting.id,
            user_id: meeting.owner_user_id || userId,
            priority: 0,
          }, { onConflict: 'meeting_id' })
      } catch (indexQueueError) {
        // Non-fatal - continue with sync
        console.warn(`⚠️  Failed to queue existing meeting for indexing:`, indexQueueError instanceof Error ? indexQueueError.message : String(indexQueueError))
      }

      // Condense existing summary if not already done (non-blocking)
      if (meeting.summary && !meeting.summary_oneliner) {
        // Fire-and-forget - don't block sync on AI summarization
        condenseMeetingSummary(supabase, meeting.id, meeting.summary, meeting.title || 'Meeting')
          .catch(err => undefined)
      }
    }

    // Run AI analysis on transcript (with extraction rules integration - Phase 6.3)
    // Only run if transcript exists and has content
    if (!transcript || transcript.trim().length === 0) {
      console.log(`⚠️  Skipping AI analysis for meeting ${meeting.id} - no transcript available`)
      return
    }

    console.log(`🤖 Starting AI analysis for meeting ${meeting.id} (transcript length: ${transcript.length} chars)`)
    
    // Get org_id from meeting for call type classification
    const meetingOrgId = meeting.org_id || null
    
    const analysis: TranscriptAnalysis = await analyzeTranscriptWithClaude(
      transcript,
      {
        id: meeting.id,
        title: meeting.title,
        meeting_start: meeting.meeting_start,
        owner_email: meeting.owner_email,
      },
      supabase,
      meeting.owner_user_id || userId,
      meetingOrgId // Pass orgId for call type classification
    )
    console.log(`✅ AI analysis completed for meeting ${meeting.id}`)

    // Build update object with AI metrics including coaching insights
    const updateData: Record<string, any> = {
      talk_time_rep_pct: analysis.talkTime.repPct,
      talk_time_customer_pct: analysis.talkTime.customerPct,
      talk_time_judgement: analysis.talkTime.assessment,
      sentiment_score: analysis.sentiment.score,
      sentiment_reasoning: analysis.sentiment.reasoning,
      coach_rating: analysis.coaching.rating,
      coach_summary: JSON.stringify({
        summary: analysis.coaching.summary,
        strengths: analysis.coaching.strengths,
        improvements: analysis.coaching.improvements,
        evaluationBreakdown: analysis.coaching.evaluationBreakdown,
      }),
    }

    // Add call type classification if available
    if (analysis.callType) {
      updateData.call_type_id = analysis.callType.callTypeId
      updateData.call_type_confidence = analysis.callType.confidence
      updateData.call_type_reasoning = analysis.callType.reasoning
      console.log(`📋 Call type classified: ${analysis.callType.callTypeName} (confidence: ${(analysis.callType.confidence * 100).toFixed(1)}%)`)
    }

    // Update meeting with AI metrics including coaching insights and call type
    const { data: updateResult, error: updateError } = await supabase
      .from('meetings')
      .update(updateData)
      .eq('id', meeting.id)
      .select() // CRITICAL: Add .select() to get confirmation of what was updated

    if (updateError) {
      throw new Error(`Failed to store AI metrics: ${updateError.message}`)
    }

    if (!updateResult || updateResult.length === 0) {
      throw new Error(`Failed to update meeting ${meeting.id} - no rows affected`)
    }
    // Get existing Fathom action items
    const existingActionItems = call.action_items || []

    // Deduplicate AI action items against Fathom's
    const uniqueAIActionItems = deduplicateActionItems(analysis.actionItems, existingActionItems)

    // Store AI-generated action items
    if (uniqueAIActionItems.length > 0) {
      for (const item of uniqueAIActionItems) {
        // Align column names with UI and triggers (auto task creation expects assignee_email, deadline_at)
        // CRITICAL: Explicitly set synced_to_task=false to prevent automatic task creation
        await supabase
          .from('meeting_action_items')
          .insert({
            meeting_id: meeting.id,
            title: item.title,
            description: item.title,
            priority: item.priority,
            category: item.category,
            assignee_name: item.assignedTo || null,
            assignee_email: item.assignedToEmail || null,
            deadline_at: item.deadline ? new Date(item.deadline).toISOString() : null,
            ai_generated: true,
            ai_confidence: item.confidence,
            needs_review: item.confidence < 0.8, // Low confidence items need review
            completed: false,
            synced_to_task: false, // Explicitly prevent automatic task creation
            task_id: null, // No task created yet - manual creation only
            timestamp_seconds: null,
            playback_url: null,
          })
      }
    } else {
    }

  } catch (error) {
    // Don't throw - allow meeting sync to continue even if AI analysis fails
    // But log the error for debugging with more context
    const errorMessage = error instanceof Error ? error.message : String(error)
    const isMissingApiKey = errorMessage.includes('ANTHROPIC_API_KEY')
    
    console.error(`❌ Error in autoFetchTranscriptAndAnalyze for meeting ${meeting?.id || 'unknown'}:`, errorMessage)
    
    if (isMissingApiKey) {
      console.error(`🚨 CRITICAL: ANTHROPIC_API_KEY is not configured in edge function environment variables`)
      console.error(`   Please set ANTHROPIC_API_KEY in Supabase Dashboard → Edge Functions → fathom-sync → Settings → Secrets`)
    }
    
    if (error instanceof Error && error.stack) {
      console.error(`Stack trace:`, error.stack.substring(0, 500))
    }
  }
}

// Transcript fetching functions are now imported from _shared/fathomTranscript.ts

/**
 * Sync a single call from Fathom to database
 */
async function syncSingleCall(
  supabase: any,
  userId: string,
  orgId: string | null,
  integration: any,
  call: any, // Directly receive the call object from bulk API
  skipThumbnails: boolean = false,
  markAsHistorical: boolean = false // Mark as historical import (doesn't count toward new meeting limit)
): Promise<{ success: boolean; error?: string }> {
  try {
    // Call object already contains all necessary data from bulk API
    // Helper: resolve the meeting owner user by email (robust across payload variants)
    async function resolveOwnerUserIdFromEmail(email: string | null | undefined): Promise<string | null> {
      if (!email) return null
      try {
        // Query profiles table (auth.users is not directly accessible in edge functions)
        const { data: prof, error: profError } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name')
          .eq('email', email)
          .single()

        if (prof?.id) {
          const fullName = [prof.first_name, prof.last_name].filter(Boolean).join(' ') || prof.email
          return prof.id
        }

        if (profError) {
        }
      } catch (e) {
      }
      return null
    }

    // Resolve meeting owner from multiple possible fields
    let ownerUserId = userId
    let ownerResolved = false
    const possibleOwnerEmails: Array<string | null | undefined> = [
      call?.recorded_by?.email,
      call?.host_email,
      (call?.host && typeof call.host === 'object' ? call.host.email : undefined),
      // From participants/invitees: pick the first host
      (Array.isArray(call?.participants) ? (call.participants.find((p: any) => p?.is_host)?.email) : undefined),
      (Array.isArray(call?.calendar_invitees) ? (call.calendar_invitees.find((p: any) => p?.is_host)?.email) : undefined),
    ]
    let ownerEmailCandidate: string | null = null
    for (const em of possibleOwnerEmails) {
      const uid = await resolveOwnerUserIdFromEmail(em)
      if (uid) {
        ownerUserId = uid
        ownerResolved = true
        ownerEmailCandidate = em || null
        break
      }
      if (!ownerEmailCandidate && em) ownerEmailCandidate = em
    }

    if (!ownerResolved) {
    }

    // Org safety: only assign owner_user_id if that user is actually a member of this org.
    // Otherwise fall back to the integration connector (or the invoking user).
    if (orgId && ownerUserId) {
      try {
        const { data: member } = await supabase
          .from('organization_memberships')
          .select('user_id')
          .eq('org_id', orgId)
          .eq('user_id', ownerUserId)
          .limit(1)
          .maybeSingle()

        if (!member) {
          const fallbackOwner = integration?.connected_by_user_id || userId
          if (fallbackOwner && fallbackOwner !== ownerUserId) {
            console.warn(
              `[fathom-sync] Owner ${ownerUserId} is not a member of org ${orgId}; falling back to ${fallbackOwner}`
            )
            ownerUserId = fallbackOwner
            ownerResolved = false
          }
        }
      } catch {
        // If the membership check fails, keep existing ownerUserId.
      }
    }

    // Calculate duration in minutes from recording start/end times
    const startTime = new Date(call.recording_start_time || call.scheduled_start_time)
    const endTime = new Date(call.recording_end_time || call.scheduled_end_time)
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))

    // Compute derived fields prior to DB write
    const embedUrl = buildEmbedUrl(call.share_url, call.recording_id)

    // Generate thumbnail using thumbnail service
    let thumbnailUrl: string | null = null

    // Always attempt thumbnail generation if embed URL is available (unless explicitly skipped)
    // The generateVideoThumbnail function will handle fallbacks internally
    // Note: We'll call it again after meeting is created to pass meeting_id for DB persistence
    if (!skipThumbnails && embedUrl) {
      try {
        console.log(`🖼️  Generating thumbnail for recording ${call.recording_id}`)
        thumbnailUrl = await generateVideoThumbnail(call.recording_id, call.share_url, embedUrl)
        if (thumbnailUrl) {
          console.log(`✅ Thumbnail generated successfully: ${thumbnailUrl.substring(0, 100)}...`)
        } else {
          console.log(`⚠️  Thumbnail generation returned null for recording ${call.recording_id}`)
        }
      } catch (error) {
        console.error(`❌ Error generating thumbnail for recording ${call.recording_id}:`, error instanceof Error ? error.message : String(error))
        // Continue with fallback placeholder
      }
    }

    // Fallback to placeholder if thumbnail service failed or disabled
    if (!thumbnailUrl) {
      const firstLetter = (call.title || 'M')[0].toUpperCase()
      thumbnailUrl = `https://dummyimage.com/640x360/1a1a1a/10b981&text=${encodeURIComponent(firstLetter)}`
      console.log(`📝 Using placeholder thumbnail for meeting ${call.recording_id}`)
    }
    // Use summary from bulk API response only (don't fetch separately)
    // Summary and transcript should be fetched on-demand via separate endpoint
    const summaryText: string | null = call.default_summary || call.summary || null
    // Map to meetings table schema using actual Fathom API fields
    const meetingData: Record<string, any> = {
      org_id: orgId, // Required for RLS compliance
      owner_user_id: ownerUserId,
      fathom_recording_id: String(call.recording_id), // Use recording_id as unique identifier
      fathom_user_id: integration.fathom_user_id,
      title: call.title || call.meeting_title,
      meeting_start: call.recording_start_time || call.scheduled_start_time,
      meeting_end: call.recording_end_time || call.scheduled_end_time,
      duration_minutes: durationMinutes,
      owner_email: ownerEmailCandidate || call.recorded_by?.email || call.host_email || null,
      team_name: call.recorded_by?.team || null,
      share_url: call.share_url,
      calls_url: call.url,
      transcript_doc_url: call.transcript || null, // If Fathom provided a URL
      sentiment_score: null, // Not available in bulk API response
      coach_summary: null, // Not available in bulk API response
      talk_time_rep_pct: null, // Not available in bulk API response
      talk_time_customer_pct: null, // Not available in bulk API response
      talk_time_judgement: null, // Not available in bulk API response
      fathom_embed_url: embedUrl,
      thumbnail_url: thumbnailUrl,
      // Additional metadata fields
      fathom_created_at: call.created_at || null,
      transcript_language: call.transcript_language || 'en',
      // Validate calendar_invitees_type against check constraint (only two allowed values)
      calendar_invitees_type: normalizeInviteesType(
        call.calendar_invitees_domains_type || call.calendar_invitees_type
      ),
      last_synced_at: new Date().toISOString(),
      sync_status: 'synced',
      // Free tier enforcement: mark historical imports
      is_historical_import: markAsHistorical,
    }

    if (summaryText) {
      meetingData.summary = summaryText
    }

    // UPSERT meeting
    //
    // Preferred (org-scoped) conflict target is: (org_id, fathom_recording_id).
    // If the database has not yet been migrated to add the matching unique index,
    // Postgres throws: "there is no unique or exclusion constraint matching the ON CONFLICT specification".
    //
    // For backwards compatibility (single-org deployments / pre-migration DBs),
    // we retry using the legacy conflict target: (fathom_recording_id).
    const upsertMeeting = async (onConflict: string) => {
      return await supabase
        .from('meetings')
        .upsert(meetingData, { onConflict })
        .select()
        .single()
    }

    let meeting: any = null
    let meetingError: any = null

    ;({
      data: meeting,
      error: meetingError,
    } = await upsertMeeting('org_id,fathom_recording_id'))

    if (
      meetingError &&
      (meetingError.code === '42P10' ||
        String(meetingError.message || '').toLowerCase().includes('on conflict specification') ||
        String(meetingError.message || '').toLowerCase().includes('no unique'))
    ) {
      console.warn(
        `[fathom-sync] Meeting upsert conflict target not supported by DB yet; retrying legacy onConflict=fathom_recording_id (org_id=${orgId || 'null'}, recording_id=${String(call.recording_id)})`
      )

      ;({
        data: meeting,
        error: meetingError,
      } = await upsertMeeting('fathom_recording_id'))
    }

    if (meetingError) {
      throw new Error(`Failed to upsert meeting: ${meetingError.message}`)
    }

    // Seed default call types for org on first sync (if org exists and has no call types)
    if (orgId) {
      try {
        const { data: existingCallTypes, error: checkError } = await supabase
          .from('org_call_types')
          .select('id')
          .eq('org_id', orgId)
          .limit(1)

        if (!checkError && (!existingCallTypes || existingCallTypes.length === 0)) {
          // Seed default call types for this org
          console.log(`🌱 Seeding default call types for org ${orgId}`)
          const { error: seedError } = await supabase.rpc('seed_default_call_types', {
            p_org_id: orgId,
          })

          if (seedError) {
            console.warn(`⚠️  Failed to seed default call types: ${seedError.message}`)
          } else {
            console.log(`✅ Default call types seeded for org ${orgId}`)
          }
        }
      } catch (error) {
        // Non-fatal - continue with sync even if seeding fails
        console.warn(`⚠️  Error checking/seeding call types: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    
    // If thumbnail wasn't generated or is a placeholder, try again now that we have meeting.id
    // This allows the thumbnail function to persist directly to the database
    if (meeting && (!thumbnailUrl || thumbnailUrl.includes('dummyimage.com')) && embedUrl && !skipThumbnails) {
      console.log(`🖼️  Retrying thumbnail generation for meeting ${meeting.id} (recording ${call.recording_id})`)
      try {
        const retryThumbnail = await generateVideoThumbnail(
          call.recording_id,
          call.share_url,
          embedUrl,
          meeting.id // Pass meeting_id so thumbnail can be persisted to DB
        )
        if (retryThumbnail && !retryThumbnail.includes('via.placeholder.com')) {
          thumbnailUrl = retryThumbnail
          console.log(`✅ Retry thumbnail generation successful for meeting ${meeting.id}`)
        }
      } catch (error) {
        console.warn(`⚠️  Thumbnail retry failed for meeting ${meeting.id}:`, error instanceof Error ? error.message : String(error))
      }
    }
    
    // CONDENSE SUMMARY IF AVAILABLE (non-blocking)
    // If we already have a summary from the bulk API, condense it in background
    if (summaryText && summaryText.length > 0) {
      // Fire-and-forget - don't block sync on AI summarization
      condenseMeetingSummary(supabase, meeting.id, summaryText, call.title || 'Meeting')
        .catch(err => undefined)
    }

    // REFRESH TOKEN BEFORE FETCHING TRANSCRIPT/SUMMARY
    // Webhook syncs don't go through fetchFathomCalls, so we need to refresh here
    try {
      console.log(`🔄 Attempting token refresh (${integration._scope || 'user'} scope) before fetching transcript`)
      const refreshedToken = await refreshAccessToken(supabase, integration, integration._scope === 'org' ? 'org' : 'user')
      // Update integration object with refreshed token for subsequent API calls
      integration.access_token = refreshedToken
      console.log(`✅ Token refreshed successfully (${integration._scope || 'user'} scope)`)
    } catch (error) {
      // Log the error but continue with existing token
      console.error(`⚠️ Token refresh failed (${integration._scope || 'user'} scope):`, error instanceof Error ? error.message : String(error))
      console.error('Token refresh error details:', error)
      // Continue with existing token - it might still work
    }

    // AUTO-FETCH TRANSCRIPT AND SUMMARY
    // Attempt to fetch transcript and summary automatically for AI analysis
    await autoFetchTranscriptAndAnalyze(supabase, ownerUserId, integration, meeting, call)

    // Check if transcript was fetched - if not, enqueue retry job
    try {
      const { data: updatedMeeting, error: checkError } = await supabase
        .from('meetings')
        .select('id, transcript_text, fathom_recording_id, transcript_fetch_attempts')
        .eq('id', meeting.id)
        .single()

      if (!checkError && updatedMeeting && !updatedMeeting.transcript_text) {
        // Transcript still not available - enqueue retry job
        const recordingId = call.recording_id || call.id || updatedMeeting.fathom_recording_id
        if (recordingId) {
          console.log(`📋 Enqueueing transcript retry job for meeting ${updatedMeeting.id} (recording: ${recordingId}, attempts: ${updatedMeeting.transcript_fetch_attempts || 0})`)
          
          const { data: retryJobId, error: enqueueError } = await supabase
            .rpc('enqueue_transcript_retry', {
              p_meeting_id: updatedMeeting.id,
              p_user_id: ownerUserId,
              p_recording_id: String(recordingId),
              p_initial_attempt_count: updatedMeeting.transcript_fetch_attempts || 1,
            })

          if (enqueueError) {
            console.error(`⚠️  Failed to enqueue retry job: ${enqueueError.message}`)
          } else {
            console.log(`✅ Enqueued retry job ${retryJobId} for meeting ${updatedMeeting.id}`)
          }
        }
      }
    } catch (error) {
      // Non-fatal - log but don't fail the sync
      console.error(`⚠️  Error checking/enqueueing retry job:`, error instanceof Error ? error.message : String(error))
    }

    // Process participants (use calendar_invitees from actual API)
    // IMPORTANT: Separate handling for internal vs external participants to avoid duplication
    // - Internal users: Create meeting_attendees entry only (no contact creation)
    // - External users: Create/update contacts + meeting_contacts junction (no meeting_attendees)
    const externalContactIds: string[] = []

    if (call.calendar_invitees && call.calendar_invitees.length > 0) {
      for (const invitee of call.calendar_invitees) {
        // Handle internal participants (team members) - store in meeting_attendees only
        if (!invitee.is_external) {
          // Check if already exists to avoid duplicates
          const { data: existingAttendee } = await supabase
            .from('meeting_attendees')
            .select('id')
            .eq('meeting_id', meeting.id)
            .eq('email', invitee.email || invitee.name) // Use name as fallback if no email
            .single()

          if (!existingAttendee) {
            await supabase
              .from('meeting_attendees')
              .insert({
                meeting_id: meeting.id,
                name: invitee.name,
                email: invitee.email || null,
                is_external: false,
                role: 'host',
              })
          } else {
          }

          continue // Skip to next participant
        }

        // Handle external participants (customers/prospects) - create contacts + meeting_contacts
        if (invitee.email && invitee.is_external) {
          // 1. Match or create company from email domain
          const { company } = await matchOrCreateCompany(supabase, invitee.email, userId, invitee.name)
          if (company) {
          }

          // 2. Check for existing contact (email is unique globally, not per owner)
          const { data: existingContact } = await supabase
            .from('contacts')
            .select('id, company_id, owner_id, last_interaction_at')
            .eq('email', invitee.email)
            .single()

          // Get the meeting date for last_interaction_at
          const meetingDate = call.recording_start_time || call.scheduled_start_time

          if (existingContact) {
            // Build update object - always update last_interaction_at if meeting is newer
            const updateData: Record<string, any> = {}

            // Update company if not set
            if (!existingContact.company_id && company) {
              updateData.company_id = company.id
            }

            // Update last_interaction_at only if this meeting is newer
            if (meetingDate) {
              const existingDate = existingContact.last_interaction_at ? new Date(existingContact.last_interaction_at) : null
              const newDate = new Date(meetingDate)
              if (!existingDate || newDate > existingDate) {
                updateData.last_interaction_at = meetingDate
              }
            }

            // Only update if there are changes
            if (Object.keys(updateData).length > 0) {
              await supabase
                .from('contacts')
                .update(updateData)
                .eq('id', existingContact.id)
            }

            externalContactIds.push(existingContact.id)
          } else {
            // Create new contact with company link
            // FIXED: Use owner_id (not user_id) and first_name/last_name (not name)
            const nameParts = invitee.name.split(' ')
            const firstName = nameParts[0] || invitee.name
            const lastName = nameParts.slice(1).join(' ') || null

            const { data: newContact, error: contactError } = await supabase
              .from('contacts')
              .insert({
                owner_id: userId, // FIXED: Use owner_id not user_id
                first_name: firstName, // FIXED: Use first_name not name
                last_name: lastName, // FIXED: Use last_name
                email: invitee.email,
                company_id: company?.id || null,
                source: 'fathom_sync',
                first_seen_at: new Date().toISOString(),
                last_interaction_at: meetingDate || null // Set to actual meeting date
              })
              .select('id')
              .single()

            if (contactError) {
            } else if (newContact) {
              if (company) {
              }
              externalContactIds.push(newContact.id)
            }
          }
        }
      }
    }

    // After processing all contacts, determine primary contact and company
    if (externalContactIds.length > 0) {
      // Select primary contact using smart logic
      const primaryContactId = await selectPrimaryContact(supabase, externalContactIds, ownerUserId)

      if (primaryContactId) {
        // Determine meeting company (use primary contact's company)
        const meetingCompanyId = await determineMeetingCompany(supabase, externalContactIds, primaryContactId, ownerUserId)

        if (meetingCompanyId) {
          // Fetch and log company name for transparency
          const { data: companyDetails } = await supabase
            .from('companies')
            .select('name, domain')
            .eq('id', meetingCompanyId)
            .single()

          if (companyDetails) {
          } else {
          }
        } else {
        }

        // Update meeting with primary contact and company
        await supabase
          .from('meetings')
          .update({
            primary_contact_id: primaryContactId,
            company_id: meetingCompanyId,
            updated_at: new Date().toISOString()
          })
          .eq('id', meeting.id)

        // Create meeting_contacts junction records
        const meetingContactRecords = externalContactIds.map((contactId, idx) => ({
          meeting_id: meeting.id,
          contact_id: contactId,
          is_primary: contactId === primaryContactId,
          role: 'attendee'
        }))

        const { error: junctionError } = await supabase
          .from('meeting_contacts')
          .upsert(meetingContactRecords, { onConflict: 'meeting_id,contact_id' })

        if (junctionError) {
        } else {
        }

    // Conditional activity creation based on per-user preference and meeting date
        try {
          // Load user preference
      const { data: settings } = await supabase
        .from('user_settings')
        .select('preferences')
        .eq('user_id', ownerUserId)
        .single()

          const prefs = (settings?.preferences || {}) as any
          const autoPref = prefs.auto_fathom_activity || {}
          const enabled = !!autoPref.enabled
          const fromDateStr = typeof autoPref.from_date === 'string' ? autoPref.from_date : null

      // Only auto-log if: owner was resolved to an internal user AND preferences allow AND from_date provided
      if (!ownerResolved || !enabled || !fromDateStr) {
          } else {
            // Only log if meeting_start is on/after from_date (user-locality not known; use ISO date)
            const meetingDateOnly = new Date(meetingData.meeting_start)
            const fromDateOnly = new Date(`${fromDateStr}T00:00:00.000Z`)

            if (isNaN(meetingDateOnly.getTime()) || isNaN(fromDateOnly.getTime())) {
            } else if (meetingDateOnly >= fromDateOnly) {
              // Check if activity already exists for this meeting
              const { data: existingActivity } = await supabase
                .from('activities')
                .select('id')
                .eq('meeting_id', meeting.id)
                .eq('user_id', ownerUserId)
                .eq('type', 'meeting')
                .single()

              if (existingActivity) {
              } else {
                // Get sales rep email - use ownerEmailCandidate or lookup from profile
                let salesRepEmail = ownerEmailCandidate
                if (!salesRepEmail) {
                  // Fallback: lookup email from profiles table
                  const { data: ownerProfile } = await supabase
                    .from('profiles')
                    .select('email')
                    .eq('id', ownerUserId)
                    .single()
                  salesRepEmail = ownerProfile?.email || ownerUserId
                }

                // Get company name from meetingCompanyId (extracted from attendee emails)
                let companyName = meetingData.title || 'Fathom Meeting' // Fallback to meeting title
                if (meetingCompanyId) {
                  const { data: companyData, error: companyError } = await supabase
                    .from('companies')
                    .select('name')
                    .eq('id', meetingCompanyId)
                    .single()

                  if (!companyError && companyData?.name) {
                    companyName = companyData.name
                  } else if (companyError) {
                  }
                } else {
                }

                // Extract and truncate summary for activity details to prevent UI overflow
                const extractAndTruncateSummary = (summary: string | null | undefined, maxLength: number = 200): string => {
                  if (!summary) {
                    return `Meeting with ${externalContactIds.length} participant${externalContactIds.length > 1 ? 's' : ''}`
                  }

                  let textContent = summary

                  // If summary is a JSON string, parse and extract markdown_formatted or text field
                  if (summary.trim().startsWith('{')) {
                    try {
                      const parsed = JSON.parse(summary)
                      textContent = parsed.markdown_formatted || parsed.text || summary
                    } catch (e) {
                      // If parsing fails, use the raw summary
                    }
                  }

                  // Remove markdown formatting and clean up
                  textContent = textContent
                    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links [text](url) -> text
                    .replace(/##\s+/g, '') // Remove heading markers
                    .replace(/\*\*/g, '') // Remove bold markers
                    .replace(/\n+/g, ' ') // Replace newlines with spaces
                    .replace(/\s+/g, ' ') // Collapse multiple spaces
                    .trim()

                  // Truncate to max length
                  if (textContent.length <= maxLength) return textContent
                  return textContent.substring(0, maxLength).trim() + '...'
                }

                const { error: activityError } = await supabase.from('activities').insert({
                  user_id: ownerUserId,
                  sales_rep: salesRepEmail,  // Use email instead of UUID
                  meeting_id: meeting.id,
                  contact_id: primaryContactId,
                  company_id: meetingCompanyId,
                  type: 'meeting',
                  status: 'completed',
                  client_name: companyName, // FIXED: Use company name instead of meeting title
                  details: extractAndTruncateSummary(meetingData.summary),
                  date: meetingData.meeting_start,
                  created_at: new Date().toISOString()
                })

                if (activityError) {
                } else {
                }
              }
            } else {
            }
          }
        } catch (e) {
        }
      } else {
      }
    }

    // Process action items - they're included in the bulk meetings API response
    // Note: action_items will be null until Fathom processes the recording (can take several minutes)
    let actionItems = call.action_items

    if (actionItems && Array.isArray(actionItems) && actionItems.length > 0) {
    } else if (actionItems === null) {
    } else if (Array.isArray(actionItems) && actionItems.length === 0) {
    } else {
    }

    if (actionItems && Array.isArray(actionItems) && actionItems.length > 0) {
      for (const actionItem of actionItems) {
        // Parse the new Fathom API format
        // recording_timestamp is in format "HH:MM:SS", we need to convert to seconds
        let timestampSeconds: number | null = null
        if (actionItem.recording_timestamp) {
          const parts = actionItem.recording_timestamp.split(':')
          if (parts.length === 3) {
            timestampSeconds = (parseInt(parts[0]) * 3600) + (parseInt(parts[1]) * 60) + parseInt(parts[2])
          }
        }

        const playbackUrl = actionItem.recording_playback_url || actionItem.playback_url || null
        const title = actionItem.description || actionItem.title || (typeof actionItem === 'string' ? actionItem : 'Untitled Action Item')
        const completed = actionItem.completed || false
        const userGenerated = actionItem.user_generated || false

        // First, check if this action item already exists (by title and timestamp to avoid duplicates)
        const { data: existingItem } = await supabase
          .from('meeting_action_items')
          .select('id')
          .eq('meeting_id', meeting.id)
          .eq('title', title)
          .eq('timestamp_seconds', timestampSeconds)
          .single()

        if (existingItem) {
          continue
        }

        // Insert new action item
        // CRITICAL: Explicitly set synced_to_task=false to prevent automatic task creation
        const { error: actionItemError } = await supabase
          .from('meeting_action_items')
          .insert({
            meeting_id: meeting.id,
            title: title,
            timestamp_seconds: timestampSeconds,
            category: actionItem.type || actionItem.category || 'action_item',
            priority: actionItem.priority || 'medium',
            ai_generated: !userGenerated, // Inverted: user_generated=false means AI generated
            completed: completed,
            synced_to_task: false, // Explicitly prevent automatic task creation
            task_id: null, // No task created yet - manual creation only
            playback_url: playbackUrl,
          })

        if (actionItemError) {
        } else {
        }
      }
    } else {
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
