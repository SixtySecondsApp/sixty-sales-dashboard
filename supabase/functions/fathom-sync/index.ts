import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { matchOrCreateCompany } from '../_shared/companyMatching.ts'
import { selectPrimaryContact, determineMeetingCompany } from '../_shared/primaryContactSelection.ts'

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
 * Helper: Try to fetch thumbnail from Fathom's potential thumbnail endpoints
 * Tests various URL patterns that Fathom might use for thumbnails
 */
async function fetchFathomDirectThumbnail(recordingId: string | number, shareUrl?: string): Promise<string | null> {
  console.log(`🖼️  Testing Fathom thumbnail endpoints for recording ${recordingId}...`)

  // Extract share ID from URL for additional patterns
  let shareId = null
  if (shareUrl) {
    try {
      const url = new URL(shareUrl)
      shareId = url.pathname.split('/').pop()
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Test various potential thumbnail URL patterns
  const patterns = [
    `https://thumbnails.fathom.video/${recordingId}.jpg`,
    `https://thumbnails.fathom.video/${recordingId}.png`,
    `https://cdn.fathom.video/thumbnails/${recordingId}.jpg`,
    `https://cdn.fathom.video/thumbnails/${recordingId}.png`,
    `https://fathom.video/thumbnails/${recordingId}.jpg`,
    `https://app.fathom.video/thumbnails/${recordingId}.jpg`,
    shareId ? `https://thumbnails.fathom.video/${shareId}.jpg` : null,
    shareId ? `https://cdn.fathom.video/thumbnails/${shareId}.jpg` : null,
  ].filter(Boolean) as string[]

  for (const url of patterns) {
    try {
      // Use HEAD request to check if URL exists without downloading
      const response = await fetch(url, { method: 'HEAD' })
      if (response.ok) {
        console.log(`✅ Found Fathom thumbnail at: ${url}`)
        return url
      }
    } catch (e) {
      // Continue to next pattern
    }
  }

  console.log('⚠️  No direct Fathom thumbnail endpoint found')
  return null
}

/**
 * Helper: Extract video poster/thumbnail from Fathom embed page
 * Looks for video player metadata in the embed HTML
 */
async function fetchThumbnailFromEmbed(shareUrl?: string, recordingId?: string | number): Promise<string | null> {
  if (!shareUrl && !recordingId) return null

  try {
    // Build embed URL
    let embedUrl: string
    if (shareUrl) {
      const shareId = shareUrl.split('/').pop()
      embedUrl = `https://fathom.video/embed/${shareId}`
    } else {
      embedUrl = `https://app.fathom.video/recording/${recordingId}`
    }

    console.log(`🎬 Checking embed page for video poster: ${embedUrl}`)

    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Sixty/1.0 (+thumbnail-fetcher)',
        'Accept': 'text/html'
      }
    })

    if (!response.ok) return null

    const html = await response.text()

    // Look for video poster attribute
    const posterMatch = html.match(/poster=["']([^"']+)["']/i)
    if (posterMatch && posterMatch[1]) {
      console.log(`✅ Found video poster: ${posterMatch[1]}`)
      return posterMatch[1]
    }

    // Look for thumbnail in video player config/metadata
    const patterns = [
      /thumbnail["']?\s*:\s*["']([^"']+)["']/i,
      /posterImage["']?\s*:\s*["']([^"']+)["']/i,
      /previewImage["']?\s*:\s*["']([^"']+)["']/i,
    ]

    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        console.log(`✅ Found video thumbnail in config: ${match[1]}`)
        return match[1]
      }
    }

    console.log('⚠️  No video poster or thumbnail found in embed')
    return null
  } catch (error) {
    console.error('❌ Error fetching embed thumbnail:', error)
    return null
  }
}

/**
 * Helper: Scrape og:image from share page for a lightweight thumbnail.
 * This avoids adding heavy dependencies; works best when share_url is public.
 */
async function fetchThumbnailFromShareUrl(shareUrl?: string): Promise<string | null> {
  if (!shareUrl) {
    console.log('⚠️  No share URL provided for thumbnail fetch')
    return null
  }

  try {
    console.log(`🖼️  Attempting to fetch og:image from: ${shareUrl}`)
    const res = await fetch(shareUrl, {
      headers: {
        'User-Agent': 'Sixty/1.0 (+thumbnail-fetcher)',
        'Accept': 'text/html'
      }
    })

    if (!res.ok) {
      console.log(`⚠️  Thumbnail fetch failed: HTTP ${res.status}`)
      return null
    }

    const html = await res.text()
    console.log(`📄 HTML received (${html.length} chars), searching for og:image...`)

    // Try multiple meta tag patterns
    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    ]

    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match && match[1]) {
        console.log(`✅ Found og:image: ${match[1]}`)
        return match[1]
      }
    }

    console.log('❌ No og:image or twitter:image meta tag found in HTML')
    return null
  } catch (error) {
    console.error('❌ Error fetching thumbnail:', error)
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
    const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-video-thumbnail`

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
 * Helper: Fetch action items for a specific recording
 * Action items are not included in the bulk meetings API response
 */
async function fetchRecordingActionItems(apiKey: string, recordingId: string | number): Promise<any[] | null> {
  const url = `https://api.fathom.ai/external/v1/recordings/${recordingId}/action_items`

  console.log(`📋 Fetching action items for recording ${recordingId}...`)

  const resp = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  })

  if (!resp.ok) {
    console.log(`⚠️  Action items fetch failed: HTTP ${resp.status}`)
    // Try with X-Api-Key header instead
    const resp2 = await fetch(url, {
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json'
      }
    })

    if (!resp2.ok) {
      console.log(`⚠️  Action items fetch failed with X-Api-Key too: HTTP ${resp2.status}`)
      return null
    }

    const data = await resp2.json().catch(() => null)
    console.log(`✅ Fetched action items (X-Api-Key):`, JSON.stringify(data, null, 2))
    return data?.action_items || data?.items || (Array.isArray(data) ? data : null)
  }

  const data = await resp.json().catch(() => null)
  console.log(`✅ Fetched action items (Bearer):`, JSON.stringify(data, null, 2))
  return data?.action_items || data?.items || (Array.isArray(data) ? data : null)
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
      throw new Error('No active Fathom integration found. Please connect your Fathom account first.')
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
        console.log('ℹ️  No meetings found in range. Retrying without date filters...')
        const retryCalls = await fetchFathomCalls(integration, { limit: apiLimit, offset: 0 })
        totalMeetingsFound += retryCalls.length
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

    // Note: Analytics data (transcript, action_items, default_summary) is included in call object
    // No need to fetch separately - it's already in the API response

    // Calculate duration in minutes from recording start/end times
    const startTime = new Date(call.recording_start_time || call.scheduled_start_time)
    const endTime = new Date(call.recording_end_time || call.scheduled_end_time)
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))

    // Compute derived fields prior to DB write
    const embedUrl = buildEmbedUrl(call.share_url, call.recording_id)

    // Try multiple methods to get a thumbnail (in order of preference)
    console.log(`🖼️  Starting thumbnail fetch cascade for recording ${call.recording_id}...`)

    let thumbnailUrl: string | null = null

    // Method 1: Try Fathom's direct thumbnail endpoints (fastest if they exist)
    thumbnailUrl = await fetchFathomDirectThumbnail(call.recording_id, call.share_url)

    // Method 2: Extract video poster from Fathom embed page
    if (!thumbnailUrl) {
      thumbnailUrl = await fetchThumbnailFromEmbed(call.share_url, call.recording_id)
    }

    // Method 3: Scrape og:image from share page
    if (!thumbnailUrl) {
      thumbnailUrl = await fetchThumbnailFromShareUrl(call.share_url)
    }

    // Method 4: Generate video screenshot (if enabled and embed URL available)
    if (!thumbnailUrl && embedUrl && Deno.env.get('ENABLE_VIDEO_THUMBNAILS') === 'true') {
      console.log('📸 Attempting to generate video screenshot...')
      thumbnailUrl = await generateVideoThumbnail(call.recording_id, call.share_url, embedUrl)
    }

    // Method 5: Generate a placeholder thumbnail as last resort
    if (!thumbnailUrl && call.share_url) {
      console.log('ℹ️  Using generated placeholder thumbnail')
      const firstLetter = (call.title || 'M')[0].toUpperCase()
      thumbnailUrl = `https://via.placeholder.com/640x360/1a1a1a/10b981?text=${encodeURIComponent(firstLetter)}`
    }

    console.log(`✅ Final thumbnail URL: ${thumbnailUrl}`)

    // If summary not present in bulk API, fetch via recordings endpoint
    let summaryText: string | null = call.default_summary || null
    if (!summaryText && call.recording_id) {
      summaryText = await fetchRecordingSummary(integration.access_token, call.recording_id)
    }

    // Map to meetings table schema using actual Fathom API fields
    const meetingData = {
      owner_user_id: userId,
      fathom_recording_id: String(call.recording_id), // Use recording_id as unique identifier
      fathom_user_id: integration.fathom_user_id,
      title: call.title || call.meeting_title,
      meeting_start: call.recording_start_time || call.scheduled_start_time,
      meeting_end: call.recording_end_time || call.scheduled_end_time,
      duration_minutes: durationMinutes,
      owner_email: call.recorded_by?.email,
      team_name: call.recorded_by?.team || null,
      share_url: call.share_url,
      calls_url: call.url,
      transcript_doc_url: call.transcript || null, // If Fathom provided a URL
      summary: summaryText, // Prefer explicit fetch when missing
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

    // If no transcript_doc_url yet, fetch plaintext and create a Google Doc
    if (!meeting.transcript_doc_url && call.recording_id) {
      const transcriptPlain = await fetchRecordingTranscriptPlaintext(integration.access_token, call.recording_id)
      if (transcriptPlain) {
        const docUrl = await createGoogleDocForTranscript(supabase, userId, meeting.id, `Transcript • ${call.title || 'Meeting'}`, transcriptPlain)
        if (docUrl) {
          await supabase
            .from('meetings')
            .update({ transcript_doc_url: docUrl, updated_at: new Date().toISOString() })
            .eq('id', meeting.id)
        }
      }
    }

    // Process participants (use calendar_invitees from actual API)
    const externalContactIds: string[] = []

    if (call.calendar_invitees && call.calendar_invitees.length > 0) {
      for (const invitee of call.calendar_invitees) {
        // Create meeting attendee record
        await supabase
          .from('meeting_attendees')
          .insert({
            meeting_id: meeting.id,
            name: invitee.name,
            email: invitee.email || null,
            is_external: invitee.is_external,
            role: invitee.is_external ? 'attendee' : 'host',
          })

        // Process external contacts - match/create company and contact
        if (invitee.email && invitee.is_external) {
          console.log(`👤 Processing external contact: ${invitee.name} (${invitee.email})`)

          // 1. Match or create company from email domain
          const company = await matchOrCreateCompany(supabase, invitee.email, userId, invitee.name)
          if (company) {
            console.log(`🏢 Matched/created company: ${company.name} (${company.domain})`)
          }

          // 2. Check for existing contact
          const { data: existingContact } = await supabase
            .from('contacts')
            .select('id, company_id')
            .eq('user_id', userId)
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
            const { data: newContact, error: contactError } = await supabase
              .from('contacts')
              .insert({
                user_id: userId,
                name: invitee.name,
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
      const primaryContactId = await selectPrimaryContact(supabase, externalContactIds, userId)

      if (primaryContactId) {
        console.log(`✅ Selected primary contact: ${primaryContactId}`)

        // Determine meeting company (use primary contact's company)
        const meetingCompanyId = await determineMeetingCompany(supabase, externalContactIds, primaryContactId, userId)

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

        // Create activity record for CRM integration
        console.log(`📝 Creating activity record for Fathom meeting...`)

        // Determine outcome based on sentiment score (if available)
        let outcome = 'neutral'
        if (meeting.sentiment_score) {
          if (meeting.sentiment_score >= 0.3) outcome = 'positive'
          else if (meeting.sentiment_score <= -0.3) outcome = 'negative'
        }

        const { error: activityError } = await supabase.from('activities').insert({
          user_id: userId,
          meeting_id: meeting.id,
          contact_id: primaryContactId,
          company_id: meetingCompanyId,
          type: 'meeting', // Use 'meeting' or 'fathom_meeting' if enum supports it
          status: 'completed',
          client_name: meetingData.title || 'Fathom Meeting',
          details: meetingData.summary || `Meeting with ${externalContactIds.length} external contact${externalContactIds.length > 1 ? 's' : ''}`,
          date: meetingData.meeting_start,
          outcome: outcome,
          duration_minutes: meetingData.duration_minutes,
          created_at: new Date().toISOString()
        })

        if (activityError) {
          console.error(`❌ Error creating activity: ${activityError.message}`)
        } else {
          console.log(`✅ Created activity record for meeting`)
        }
      }
    }

    // Process action items - need to fetch separately as they're not in bulk API response
    let actionItems = call.action_items

    // If action items weren't in the bulk response, fetch them separately
    if (!actionItems && call.recording_id) {
      actionItems = await fetchRecordingActionItems(integration.access_token, call.recording_id)
    }

    if (actionItems && Array.isArray(actionItems) && actionItems.length > 0) {
      console.log(`📋 Processing ${actionItems.length} action items for meeting ${meeting.id}`)

      for (const actionItem of actionItems) {
        const timestampSeconds = actionItem.timestamp_seconds || actionItem.timestamp || null
        const playbackUrl = actionItem.recording_playback_url || actionItem.playback_url || null
        const title = actionItem.description || actionItem.title || (typeof actionItem === 'string' ? actionItem : 'Untitled Action Item')

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
            ai_generated: true,
            completed: false,
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
