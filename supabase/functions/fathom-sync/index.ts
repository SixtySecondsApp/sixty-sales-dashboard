import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { matchOrCreateCompany } from '../_shared/companyMatching.ts'
import { selectPrimaryContact, determineMeetingCompany } from '../_shared/primaryContactSelection.ts'
import { analyzeTranscriptWithClaude, deduplicateActionItems, type TranscriptAnalysis } from './aiAnalysis.ts'

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
  sync_type: 'initial' | 'incremental' | 'manual' | 'webhook' | 'all_time'
  start_date?: string // ISO 8601
  end_date?: string
  call_id?: string // For webhook-triggered single call sync
  user_id?: string // For webhook calls that explicitly pass user ID
  limit?: number // Optional limit for test syncs (e.g., only sync last 5 calls)
}

interface FathomCall {
  id: string
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
 * Helper: Generate video thumbnail by calling the thumbnail generation service
 */
async function generateVideoThumbnail(
  recordingId: string | number,
  shareUrl: string,
  embedUrl: string
): Promise<string | null> {
  try {
    const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-video-thumbnail-v2`

    console.log(`📸 Calling thumbnail generation service for recording ${recordingId}...`)

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recording_id: String(recordingId),
        share_url: shareUrl,
        fathom_embed_url: embedUrl,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Thumbnail generation service error: ${response.status} - ${errorText}`)
      return null
    }

    const data = await response.json()

    if (data.success && data.thumbnail_url) {
      console.log(`✅ Video thumbnail generated: ${data.thumbnail_url}`)
      return data.thumbnail_url
    }

    console.error('Thumbnail generation service returned no URL')
    return null
  } catch (error) {
    console.error('Error calling thumbnail generation service:', error)
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

  console.log(`📋 Fetching full recording details for ${recordingId} to get action items...`)

  const resp = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  })

  if (!resp.ok) {
    console.log(`⚠️  Recording details fetch failed: HTTP ${resp.status}`)
    // Try with X-Api-Key header instead
    const resp2 = await fetch(url, {
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json'
      }
    })

    if (!resp2.ok) {
      console.log(`⚠️  Recording details fetch failed with X-Api-Key too: HTTP ${resp2.status}`)
      return null
    }

    console.log(`🔍 Response status (X-Api-Key): ${resp2.status}, Content-Type: ${resp2.headers.get('content-type')}`)

    const data = await resp2.json().catch((err) => {
      console.error(`❌ Failed to parse JSON response (X-Api-Key): ${err.message}`)
      return null
    })

    // Log the actual response for debugging
    console.log(`📦 API Response keys (X-Api-Key): ${data ? Object.keys(data).join(', ') : 'null'}`)
    if (data?.action_items !== undefined) {
      console.log(`📋 action_items field type: ${typeof data.action_items}, value: ${JSON.stringify(data.action_items)}`)
    }

    if (data?.action_items && Array.isArray(data.action_items)) {
      console.log(`✅ Found ${data.action_items.length} action items in recording details (X-Api-Key)`)
      return data.action_items
    }
    console.log(`ℹ️  No action items in recording details (X-Api-Key)`)
    return null
  }

  console.log(`🔍 Response status: ${resp.status}, Content-Type: ${resp.headers.get('content-type')}`)

  const data = await resp.json().catch((err) => {
    console.error(`❌ Failed to parse JSON response: ${err.message}`)
    return null
  })

  // Log the actual response for debugging
  console.log(`📦 API Response keys: ${data ? Object.keys(data).join(', ') : 'null'}`)
  if (data?.action_items !== undefined) {
    console.log(`📋 action_items field type: ${typeof data.action_items}, value: ${JSON.stringify(data.action_items)}`)
  }

  if (data?.action_items && Array.isArray(data.action_items)) {
    console.log(`✅ Found ${data.action_items.length} action items in recording details (Bearer)`)
    return data.action_items
  }
  console.log(`ℹ️  No action items in recording details (Bearer)`)
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
      console.warn('google-docs-create failed:', errorText)
      return null
    }

    const data = await response.json()
    return data?.url || null
  } catch (e) {
    console.warn('Failed to create Google Doc:', e)
    return null
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authenticated user
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

    // Get user ID - either from body (webhook) or from auth header
    let userId: string

    if (body.user_id) {
      // Webhook call with explicit user_id
      userId = body.user_id
      console.log('🔄 Starting Fathom sync for user (from webhook):', userId)
    } else {
      // Regular authenticated call
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        throw new Error('Missing authorization header and no user_id in request')
      }

      // Get user from token
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: userError } = await supabase.auth.getUser(token)

      if (userError || !user) {
        throw new Error('Unauthorized: Invalid token')
      }

      userId = user.id
      console.log('🔄 Starting Fathom sync for user (authenticated):', userId)
    }
    const { sync_type, start_date, end_date, call_id, limit } = body

    // Get active Fathom integration
    const { data: integration, error: integrationError } = await supabase
      .from('fathom_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (integrationError || !integration) {
      console.error('❌ Integration error:', integrationError)
      const errorMessage = integration === null
        ? 'No active Fathom integration found. Please go to Settings → Integrations and connect your Fathom account.'
        : `Fathom integration error: ${integrationError?.message || 'Unknown error'}`
      throw new Error(errorMessage)
    }

    console.log('✅ Found integration:', {
      id: integration.id,
      fathom_user_email: integration.fathom_user_email,
      token_expires_at: integration.token_expires_at,
      is_active: integration.is_active,
      scopes: integration.scopes,
    })

    // Update sync state to 'syncing'
    await supabase
      .from('fathom_sync_state')
      .upsert({
        user_id: userId,
        integration_id: integration.id,
        sync_status: 'syncing',
        last_sync_started_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    let meetingsSynced = 0
    let totalMeetingsFound = 0
    const errors: Array<{ call_id: string; error: string }> = []

    // Single call sync (webhook-triggered)
    if (sync_type === 'webhook' && call_id) {
      console.log(`📞 Syncing single call: ${call_id}`)

      const result = await syncSingleCall(supabase, userId, integration, call_id)

      if (result.success) {
        meetingsSynced = 1
        totalMeetingsFound = 1
      } else {
        errors.push({ call_id, error: result.error || 'Unknown error' })
      }
    } else {
      // Bulk sync (initial, incremental, manual)
      let apiStartDate = start_date
      let apiEndDate = end_date

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
            // All time - no start date filter (Fathom API will return all historical calls)
            apiStartDate = undefined
            apiEndDate = now.toISOString()
            break
          case 'initial':
          case 'manual':
            // Last 30 days for initial/manual sync (can be overridden by request)
            apiStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
            apiEndDate = now.toISOString()
            break
        }
      }

      console.log(`📅 Sync range: ${apiStartDate} to ${apiEndDate}`)

      // Fetch calls from Fathom API with pagination
      let offset = 0
      const apiLimit = limit || 100 // Use provided limit or default to 100
      let hasMore = true

      // If user specified a limit, we only fetch one batch
      const isLimitedSync = !!limit

      while (hasMore) {
        const calls = await fetchFathomCalls(integration, {
          start_date: apiStartDate,
          end_date: apiEndDate,
          limit: apiLimit,
          offset,
        })

        totalMeetingsFound += calls.length
        console.log(`📦 Fetched ${calls.length} calls (offset: ${offset})`)

        // Process each call
        for (const call of calls) {
          try {
            const result = await syncSingleCall(supabase, userId, integration, call)

            if (result.success) {
              meetingsSynced++
            } else {
              errors.push({ call_id: call.recording_id || call.id, error: result.error || 'Unknown error' })
            }
          } catch (error) {
            console.error(`❌ Error syncing call ${call.recording_id || call.id}:`, error)
            errors.push({
              call_id: call.recording_id || call.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            })
          }
        }

        // Check if there are more results
        // If this is a limited sync (test mode), stop after first batch
        if (isLimitedSync) {
          hasMore = false
          console.log(`✅ Test sync complete: Limited to ${apiLimit} calls`)
        } else {
          hasMore = calls.length === apiLimit
          offset += apiLimit

          // Safety limit to prevent infinite loops
          if (offset > 10000) {
            console.warn('⚠️  Reached safety limit of 10,000 calls')
            break
          }
        }
      }
      // Fallback: if nothing found in the selected window, retry once without date filters
      if (totalMeetingsFound === 0 && (apiStartDate || apiEndDate)) {
        console.log('⚠️  No meetings found in date range.')
        console.log(`   Date range: ${apiStartDate} to ${apiEndDate}`)
        console.log('ℹ️  Retrying without date filters to check if any meetings exist...')
        const retryCalls = await fetchFathomCalls(integration, { limit: apiLimit, offset: 0 })
        totalMeetingsFound += retryCalls.length

        if (retryCalls.length === 0) {
          console.log('❌ No meetings found at all in your Fathom account.')
          console.log('   Possible reasons:')
          console.log('   1. No recordings have been created yet')
          console.log('   2. All recordings are still processing')
          console.log('   3. OAuth token may have expired or been revoked')
        } else {
          console.log(`✅ Found ${retryCalls.length} meetings outside the date range`)
          for (const call of retryCalls) {
            try {
              const result = await syncSingleCall(supabase, userId, integration, call)
              if (result.success) meetingsSynced++
            } catch (error) {
              console.error('❌ Error during fallback sync:', error)
            }
          }
        }
      }
    }

    // Update sync state to 'idle' with results
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

    console.log(`✅ Sync complete: ${meetingsSynced}/${totalMeetingsFound} meetings synced`)

    return new Response(
      JSON.stringify({
        success: true,
        sync_type,
        meetings_synced: meetingsSynced,
        total_meetings_found: totalMeetingsFound,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('❌ Sync error:', error)

    // Try to update sync state to error
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabase.auth.getUser(token)

        if (user) {
          await supabase
            .from('fathom_sync_state')
            .update({
              sync_status: 'error',
              last_sync_error: error instanceof Error ? error.message : 'Unknown error',
            })
            .eq('user_id', user.id)
        }
      }
    } catch (updateError) {
      console.error('Failed to update sync state:', updateError)
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
      console.log(`⚠️  Attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError
}

/**
 * Fetch calls from Fathom API with retry logic
 *
 * Note: Fathom API uses cursor-based pagination, not offset-based
 * We'll need to adapt this to use cursors properly
 */
async function fetchFathomCalls(
  integration: any,
  params: {
    start_date?: string
    end_date?: string
    limit?: number
    offset?: number
  }
): Promise<FathomCall[]> {
  const queryParams = new URLSearchParams()

  // Fathom API uses created_after/created_before instead of start_date/end_date
  if (params.start_date) queryParams.set('created_after', params.start_date)
  if (params.end_date) queryParams.set('created_before', params.end_date)
  // Explicitly request a reasonable page size; some APIs default to 0 without limit
  queryParams.set('limit', String(params.limit ?? 50))

  // Note: Fathom API uses cursor-based pagination, offset may not work
  // For now, we'll implement basic pagination support
  // TODO: Implement proper cursor-based pagination

  // Correct API base URL
  const url = `https://api.fathom.ai/external/v1/meetings?${queryParams.toString()}`

  return await retryWithBackoff(async () => {
    console.log(`📡 Fetching from: ${url}`)
    console.log(`🔑 Using token: ${integration.access_token?.substring(0, 10)}...`)

    // OAuth tokens typically use Authorization: Bearer, not X-Api-Key
    // Try Bearer first (standard for OAuth), then fallback to X-Api-Key
    let response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json',
      },
    })

    console.log(`📊 Response status (Bearer): ${response.status}`)

    // If Bearer fails with 401, try X-Api-Key (for API keys)
    if (response.status === 401) {
      console.log(`⚠️  Bearer auth failed, trying X-Api-Key...`)
      response = await fetch(url, {
        headers: {
          'X-Api-Key': integration.access_token,
          'Content-Type': 'application/json',
        },
      })
      console.log(`📊 Response status (X-Api-Key): ${response.status}`)
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ API Error Response: ${errorText}`)
      throw new Error(`Fathom API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log(`📦 Response data structure:`, Object.keys(data))
    console.log(`📦 Full response data:`, JSON.stringify(data, null, 2))

    // Fathom API returns meetings array directly or in a data wrapper
    // Handle different possible response structures
    let meetings = []

    if (Array.isArray(data)) {
      // Response is directly an array
      meetings = data
    } else if (data.items && Array.isArray(data.items)) {
      // Response has an items property that's an array (actual Fathom API structure)
      meetings = data.items
    } else if (data.meetings && Array.isArray(data.meetings)) {
      // Response has a meetings property that's an array
      meetings = data.meetings
    } else if (data.data && Array.isArray(data.data)) {
      // Response has a data property that's an array
      meetings = data.data
    } else if (data.calls && Array.isArray(data.calls)) {
      // Response has a calls property that's an array
      meetings = data.calls
    } else {
      // Unknown structure, log it and return empty array
      console.warn(`⚠️  Unknown API response structure:`, data)
      meetings = []
    }

    console.log(`📊 Parsed ${meetings.length} meetings from response`)
    return meetings
  })
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
    const recordingId = call.recording_id

    // Check retry attempts - don't try more than 3 times
    const fetchAttempts = meeting.transcript_fetch_attempts || 0
    if (fetchAttempts >= 3) {
      console.log(`⏭️  Skipping transcript fetch for ${recordingId} - max attempts (3) reached`)
      return
    }

    // Check if we already have transcript
    if (meeting.transcript_text) {
      console.log(`⏭️  Transcript already exists for ${recordingId}`)
      return
    }

    // Check last attempt time - wait at least 5 minutes between attempts
    if (meeting.last_transcript_fetch_at) {
      const lastAttempt = new Date(meeting.last_transcript_fetch_at)
      const now = new Date()
      const minutesSinceLastAttempt = (now.getTime() - lastAttempt.getTime()) / (1000 * 60)

      if (minutesSinceLastAttempt < 5) {
        console.log(`⏭️  Skipping transcript fetch for ${recordingId} - last attempt was ${Math.round(minutesSinceLastAttempt)} min ago (waiting 5 min)`)
        return
      }
    }

    console.log(`📄 Auto-fetching transcript for ${recordingId} (attempt ${fetchAttempts + 1}/3)...`)

    // Update fetch tracking
    await supabase
      .from('meetings')
      .update({
        transcript_fetch_attempts: fetchAttempts + 1,
        last_transcript_fetch_at: new Date().toISOString(),
      })
      .eq('id', meeting.id)

    // Fetch transcript
    const transcript = await fetchTranscriptFromFathom(integration.access_token, recordingId)

    if (!transcript) {
      console.log(`ℹ️  Transcript not yet available for ${recordingId} - will retry next sync`)
      return
    }

    console.log(`✅ Transcript fetched: ${transcript.length} characters`)

    // Fetch enhanced summary
    let summaryData: any = null
    try {
      summaryData = await fetchSummaryFromFathom(integration.access_token, recordingId)
      if (summaryData) {
        console.log(`✅ Enhanced summary fetched`)
      }
    } catch (error) {
      console.log(`⚠️  Summary fetch failed (non-fatal): ${error.message}`)
    }

    // Store transcript immediately
    await supabase
      .from('meetings')
      .update({
        transcript_text: transcript,
        summary: summaryData?.summary || meeting.summary, // Keep existing summary if new one not available
      })
      .eq('id', meeting.id)

    // Run AI analysis on transcript
    console.log(`🤖 Running Claude AI analysis on transcript...`)

    const analysis: TranscriptAnalysis = await analyzeTranscriptWithClaude(transcript, {
      id: meeting.id,
      title: meeting.title,
      meeting_start: meeting.meeting_start,
      owner_email: meeting.owner_email,
    })

    // Update meeting with AI metrics
    console.log(`📊 Attempting to store AI metrics for meeting ${meeting.id}:`, {
      talk_time_rep_pct: analysis.talkTime.repPct,
      talk_time_customer_pct: analysis.talkTime.customerPct,
      talk_time_judgement: analysis.talkTime.assessment,
      sentiment_score: analysis.sentiment.score,
      sentiment_reasoning: analysis.sentiment.reasoning?.substring(0, 50) + '...',
    })

    const { data: updateResult, error: updateError } = await supabase
      .from('meetings')
      .update({
        talk_time_rep_pct: analysis.talkTime.repPct,
        talk_time_customer_pct: analysis.talkTime.customerPct,
        talk_time_judgement: analysis.talkTime.assessment,
        sentiment_score: analysis.sentiment.score,
        sentiment_reasoning: analysis.sentiment.reasoning,
      })
      .eq('id', meeting.id)
      .select() // CRITICAL: Add .select() to get confirmation of what was updated

    if (updateError) {
      console.error(`❌ Error updating AI metrics:`, updateError)
      throw new Error(`Failed to store AI metrics: ${updateError.message}`)
    }

    if (!updateResult || updateResult.length === 0) {
      console.error(`❌ No rows updated for meeting ${meeting.id} - meeting may not exist or RLS blocked update`)
      throw new Error(`Failed to update meeting ${meeting.id} - no rows affected`)
    }

    console.log(`✅ AI metrics stored successfully:`, {
      meeting_id: meeting.id,
      fathom_recording_id: meeting.fathom_recording_id,
      sentiment: analysis.sentiment.score,
      rep_pct: analysis.talkTime.repPct,
      customer_pct: analysis.talkTime.customerPct,
      rows_updated: updateResult.length
    })

    // Get existing Fathom action items
    const existingActionItems = call.action_items || []

    // Deduplicate AI action items against Fathom's
    const uniqueAIActionItems = deduplicateActionItems(analysis.actionItems, existingActionItems)

    // Store AI-generated action items
    if (uniqueAIActionItems.length > 0) {
      console.log(`💾 Storing ${uniqueAIActionItems.length} AI-generated action items...`)

      for (const item of uniqueAIActionItems) {
        // Align column names with UI and triggers (auto task creation expects assignee_email, deadline_at)
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
            timestamp_seconds: null,
            playback_url: null,
          })
      }

      console.log(`✅ Stored ${uniqueAIActionItems.length} AI action items`)
    } else {
      console.log(`ℹ️  No unique AI action items to store (${analysis.actionItems.length} total, all duplicates)`)
    }

  } catch (error) {
    console.error(`❌ Error in auto-fetch and analyze: ${error.message}`)
    console.error(error.stack)
    // Don't throw - allow meeting sync to continue even if AI analysis fails
  }
}

/**
 * Fetch transcript from Fathom API
 */
async function fetchTranscriptFromFathom(
  accessToken: string,
  recordingId: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.fathom.ai/external/v1/recordings/${recordingId}/transcript`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (response.status === 404) {
      // Transcript not yet available - Fathom still processing
      return null
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }

    const data = await response.json()

    // CRITICAL FIX: Fathom returns an array of transcript objects, not a string
    // Format: { transcript: [{ speaker: { display_name: "..." }, text: "..." }] }
    if (!data) {
      console.log(`⚠️  Empty response from Fathom transcript API`)
      return null
    }

    // Handle array format (most common)
    if (Array.isArray(data.transcript)) {
      console.log(`📝 Parsing ${data.transcript.length} transcript segments...`)
      const lines = data.transcript.map((segment: any) => {
        const speaker = segment?.speaker?.display_name ? `${segment.speaker.display_name}: ` : ''
        const text = segment?.text || ''
        return `${speaker}${text}`.trim()
      })
      const plaintext = lines.join('\n')
      console.log(`✅ Formatted transcript: ${plaintext.length} characters`)
      return plaintext
    }

    // Handle string format (fallback)
    if (typeof data.transcript === 'string') {
      console.log(`✅ Transcript already in string format: ${data.transcript.length} characters`)
      return data.transcript
    }

    // If data itself is a string
    if (typeof data === 'string') {
      console.log(`✅ Response is direct string: ${data.length} characters`)
      return data
    }

    console.error(`❌ Unexpected transcript format:`, typeof data.transcript, data.transcript)
    return null
  } catch (error) {
    console.error(`❌ Error fetching transcript: ${error.message}`)
    return null
  }
}

/**
 * Fetch enhanced summary from Fathom API
 */
async function fetchSummaryFromFathom(
  accessToken: string,
  recordingId: string
): Promise<any | null> {
  try {
    const response = await fetch(
      `https://api.fathom.ai/external/v1/recordings/${recordingId}/summary`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (response.status === 404) {
      // Summary not yet available
      return null
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`❌ Error fetching summary: ${error.message}`)
    return null
  }
}

/**
 * Sync a single call from Fathom to database
 */
async function syncSingleCall(
  supabase: any,
  userId: string,
  integration: any,
  call: any // Directly receive the call object from bulk API
): Promise<{ success: boolean; error?: string }> {
  try {
    // Call object already contains all necessary data from bulk API
    console.log(`🔄 Syncing call: ${call.title} (${call.recording_id})`)

    // Helper: resolve the meeting owner user by email (robust across payload variants)
    async function resolveOwnerUserIdFromEmail(email: string | null | undefined): Promise<string | null> {
      if (!email) return null
      try {
        // Prefer auth.users for canonical identity
        const { data: au } = await supabase
          .from('auth.users')
          .select('id')
          .eq('email', email)
          .single()
        if (au?.id) return au.id
      } catch (_) {}
      try {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .single()
        if (prof?.id) return prof.id
      } catch (_) {}
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

    // Calculate duration in minutes from recording start/end times
    const startTime = new Date(call.recording_start_time || call.scheduled_start_time)
    const endTime = new Date(call.recording_end_time || call.scheduled_end_time)
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))

    // Compute derived fields prior to DB write
    const embedUrl = buildEmbedUrl(call.share_url, call.recording_id)

    // Generate thumbnail using thumbnail service only
    console.log(`🖼️  Generating thumbnail for recording ${call.recording_id}...`)

    let thumbnailUrl: string | null = null

    // Generate video screenshot (if enabled and embed URL available)
    if (embedUrl && Deno.env.get('ENABLE_VIDEO_THUMBNAILS') === 'true') {
      console.log('📸 Calling thumbnail generation service...')
      thumbnailUrl = await generateVideoThumbnail(call.recording_id, call.share_url, embedUrl)
    }

    // Fallback to placeholder if thumbnail service failed or disabled
    if (!thumbnailUrl) {
      console.log('ℹ️  Using placeholder thumbnail')
      const firstLetter = (call.title || 'M')[0].toUpperCase()
      thumbnailUrl = `https://via.placeholder.com/640x360/1a1a1a/10b981?text=${encodeURIComponent(firstLetter)}`
    }

    console.log(`✅ Final thumbnail URL: ${thumbnailUrl}`)

    // Use summary from bulk API response only (don't fetch separately)
    // Summary and transcript should be fetched on-demand via separate endpoint
    let summaryText: string | null = call.default_summary || null
    let transcriptText: string | null = null

    console.log(`📝 Summary from bulk API: ${summaryText ? `available (${summaryText.length} chars)` : 'not available'}`)
    console.log(`📄 Transcript: Not fetched during sync (use separate endpoint for on-demand fetching)`)

    // Map to meetings table schema using actual Fathom API fields
    const meetingData = {
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
      transcript_text: transcriptText, // Raw transcript plaintext for search and analysis
      summary: summaryText, // Complete summary from API
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
      calendar_invitees_type: call.calendar_invitees_domains_type || null,
      last_synced_at: new Date().toISOString(),
      sync_status: 'synced',
    }

    // UPSERT meeting
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .upsert(meetingData, {
        onConflict: 'fathom_recording_id',
      })
      .select()
      .single()

    if (meetingError) {
      throw new Error(`Failed to upsert meeting: ${meetingError.message}`)
    }

    console.log(`✅ Synced meeting: ${call.title} (${call.recording_id})`)

    // AUTO-FETCH TRANSCRIPT AND SUMMARY
    // Attempt to fetch transcript and summary automatically for AI analysis
    await autoFetchTranscriptAndAnalyze(supabase, ownerUserId, integration, meeting, call)

    // Process participants (use calendar_invitees from actual API)
    // IMPORTANT: Separate handling for internal vs external participants to avoid duplication
    // - Internal users: Create meeting_attendees entry only (no contact creation)
    // - External users: Create/update contacts + meeting_contacts junction (no meeting_attendees)
    const externalContactIds: string[] = []

    if (call.calendar_invitees && call.calendar_invitees.length > 0) {
      console.log(`👥 Processing ${call.calendar_invitees.length} participants for meeting ${meeting.id}`)

      for (const invitee of call.calendar_invitees) {
        // Handle internal participants (team members) - store in meeting_attendees only
        if (!invitee.is_external) {
          console.log(`👤 Internal participant: ${invitee.name} (${invitee.email || 'no email'})`)

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
            console.log(`✅ Created meeting_attendees entry for internal user: ${invitee.name}`)
          } else {
            console.log(`⏭️  Internal attendee already exists: ${invitee.name}`)
          }

          continue // Skip to next participant
        }

        // Handle external participants (customers/prospects) - create contacts + meeting_contacts
        if (invitee.email && invitee.is_external) {
          console.log(`👤 Processing external contact: ${invitee.name} (${invitee.email})`)

          // 1. Match or create company from email domain
          const company = await matchOrCreateCompany(supabase, invitee.email, userId, invitee.name)
          if (company) {
            console.log(`🏢 Matched/created company: ${company.name} (${company.domain})`)
          }

          // 2. Check for existing contact (email is unique globally, not per owner)
          const { data: existingContact } = await supabase
            .from('contacts')
            .select('id, company_id, owner_id')
            .eq('email', invitee.email)
            .single()

          if (existingContact) {
            console.log(`✅ Found existing contact: ${invitee.name}`)

            // Update existing contact with company if not set
            if (!existingContact.company_id && company) {
              await supabase
                .from('contacts')
                .update({
                  company_id: company.id,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingContact.id)

              console.log(`🔗 Linked contact to company: ${company.name}`)
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
                first_seen_at: new Date().toISOString()
              })
              .select('id')
              .single()

            if (contactError) {
              console.error(`❌ Error creating contact: ${contactError.message}`)
            } else if (newContact) {
              console.log(`✅ Created new contact: ${invitee.name}`)
              if (company) {
                console.log(`🔗 Linked to company: ${company.name}`)
              }
              externalContactIds.push(newContact.id)
            }
          }
        }
      }
    }

    // After processing all contacts, determine primary contact and company
    if (externalContactIds.length > 0) {
      console.log(`🎯 Determining primary contact from ${externalContactIds.length} external contacts...`)

      // Select primary contact using smart logic
      const primaryContactId = await selectPrimaryContact(supabase, externalContactIds, ownerUserId)

      if (primaryContactId) {
        console.log(`✅ Selected primary contact: ${primaryContactId}`)

        // Determine meeting company (use primary contact's company)
        const meetingCompanyId = await determineMeetingCompany(supabase, externalContactIds, primaryContactId, ownerUserId)

        if (meetingCompanyId) {
          console.log(`🏢 Meeting linked to company: ${meetingCompanyId}`)
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
          console.error(`❌ Error creating meeting_contacts records: ${junctionError.message}`)
        } else {
          console.log(`✅ Created ${meetingContactRecords.length} meeting_contacts records`)
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
            console.log(`📝 Skipping activity creation (preference disabled or no from_date)`)
          } else {
            // Only log if meeting_start is on/after from_date (user-locality not known; use ISO date)
            const meetingDateOnly = new Date(meetingData.meeting_start)
            const fromDateOnly = new Date(`${fromDateStr}T00:00:00.000Z`)

            if (isNaN(meetingDateOnly.getTime()) || isNaN(fromDateOnly.getTime())) {
              console.log('⚠️  Invalid dates - skipping auto activity creation')
            } else if (meetingDateOnly >= fromDateOnly) {
              console.log('📝 Auto-logging meeting activity per user preference (new meetings only)')

              const { error: activityError } = await supabase.from('activities').insert({
                user_id: ownerUserId,
                sales_rep: ownerUserId,
                meeting_id: meeting.id,
                contact_id: primaryContactId,
                company_id: meetingCompanyId,
                type: 'meeting',
                status: 'completed',
                client_name: meetingData.title || 'Fathom Meeting',
                details: meetingData.summary || `Meeting with ${externalContactIds.length} external contact${externalContactIds.length > 1 ? 's' : ''}`,
                date: meetingData.meeting_start,
                created_at: new Date().toISOString()
              })

              if (activityError) {
                console.error(`❌ Error creating activity: ${activityError.message}`)
              } else {
                console.log('✅ Created activity record for meeting')
              }
            } else {
              console.log('📝 Meeting before preference start date - skipping auto activity creation')
            }
          }
        } catch (e) {
          console.log('⚠️  Preference check failed, skipping auto activity creation')
        }
      }
    }

    // Process action items - they're included in the bulk meetings API response
    // Note: action_items will be null until Fathom processes the recording (can take several minutes)
    let actionItems = call.action_items

    if (actionItems && Array.isArray(actionItems) && actionItems.length > 0) {
      console.log(`✅ Found ${actionItems.length} action items in bulk response for recording ${call.recording_id}`)
    } else if (actionItems === null) {
      console.log(`ℹ️  Action items not yet processed by Fathom for recording ${call.recording_id} (action_items: null)`)
    } else if (Array.isArray(actionItems) && actionItems.length === 0) {
      console.log(`ℹ️  No action items detected in this meeting (action_items: [])`)
    } else {
      console.log(`⚠️  Unexpected action_items format: ${typeof actionItems}`)
    }

    if (actionItems && Array.isArray(actionItems) && actionItems.length > 0) {
      console.log(`📋 Processing ${actionItems.length} action items for meeting ${meeting.id}`)

      for (const actionItem of actionItems) {
        // Parse the new Fathom API format
        // recording_timestamp is in format "HH:MM:SS", we need to convert to seconds
        let timestampSeconds = null
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
          console.log(`⏭️  Action item already exists: "${title}"`)
          continue
        }

        // Insert new action item
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
            playback_url: playbackUrl,
          })

        if (actionItemError) {
          console.error(`❌ Error inserting action item: ${actionItemError.message}`)
        } else {
          console.log(`✅ Inserted action item: "${title}"`)
        }
      }
    } else {
      console.log(`ℹ️  No action items available for meeting ${meeting.id} (recording_id: ${call.recording_id})`)
    }

    return { success: true }
  } catch (error) {
    console.error(`❌ Error syncing call ${call?.recording_id || 'unknown'}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
