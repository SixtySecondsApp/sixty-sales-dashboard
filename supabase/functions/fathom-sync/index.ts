import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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
            const result = await syncSingleCall(supabase, userId, integration, call.id)

            if (result.success) {
              meetingsSynced++
            } else {
              errors.push({ call_id: call.id, error: result.error || 'Unknown error' })
            }
          } catch (error) {
            console.error(`❌ Error syncing call ${call.id}:`, error)
            errors.push({
              call_id: call.id,
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
    limit: number
    offset: number
  }
): Promise<FathomCall[]> {
  const queryParams = new URLSearchParams()

  // Fathom API uses created_after/created_before instead of start_date/end_date
  if (params.start_date) queryParams.set('created_after', params.start_date)
  if (params.end_date) queryParams.set('created_before', params.end_date)

  // Note: Fathom API uses cursor-based pagination, offset may not work
  // For now, we'll implement basic pagination support
  // TODO: Implement proper cursor-based pagination

  // Correct API base URL
  const url = `https://api.fathom.ai/external/v1/meetings?${queryParams.toString()}`

  return await retryWithBackoff(async () => {
    console.log(`📡 Fetching from: ${url}`)
    console.log(`🔑 Using token: ${integration.access_token?.substring(0, 10)}...`)

    const response = await fetch(url, {
      headers: {
        'X-Api-Key': integration.access_token,
        'Content-Type': 'application/json',
      },
    })

    console.log(`📊 Response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ API Error Response: ${errorText}`)
      throw new Error(`Fathom API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log(`📦 Response data structure:`, Object.keys(data))

    // Fathom API returns meetings array directly or in a data wrapper
    return data.meetings || data.data || data || []
  })
}

/**
 * Sync a single call from Fathom to database
 */
async function syncSingleCall(
  supabase: any,
  userId: string,
  integration: any,
  callId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch call details with retry logic
    // Note: Fathom API may use /recordings/{id} or /meetings/{id} endpoint
    const call: FathomCall = await retryWithBackoff(async () => {
      const callResponse = await fetch(`https://api.fathom.ai/external/v1/meetings/${callId}`, {
        headers: {
          'X-Api-Key': integration.access_token,
          'Content-Type': 'application/json',
        },
      })

      if (!callResponse.ok) {
        const errorText = await callResponse.text()
        throw new Error(`Failed to fetch call details: ${callResponse.status} - ${errorText}`)
      }

      return await callResponse.json()
    })

    // Fetch transcript/analytics if needed
    // Note: Fathom API may include analytics in the main meeting response
    let analytics: FathomAnalytics | null = null
    try {
      // Try to fetch transcript separately if not included
      analytics = await retryWithBackoff(async () => {
        const analyticsResponse = await fetch(`https://api.fathom.ai/external/v1/recordings/${callId}/transcript`, {
          headers: {
            'X-Api-Key': integration.access_token,
            'Content-Type': 'application/json',
          },
        })

        if (!analyticsResponse.ok) {
          // Analytics may not be available yet, this is not an error
          return null
        }

        return await analyticsResponse.json()
      }, 2, 500) // Fewer retries for analytics, shorter delay
    } catch (error) {
      console.warn(`⚠️  Analytics not available for call ${callId}:`, error)
    }

    // Map to meetings table schema
    const meetingData = {
      owner_user_id: userId,
      fathom_recording_id: call.id,
      fathom_user_id: integration.fathom_user_id,
      title: call.title,
      meeting_start: call.start_time,
      meeting_end: call.end_time,
      duration_minutes: Math.round(call.duration / 60),
      owner_email: call.host_email,
      share_url: call.share_url,
      calls_url: call.app_url,
      transcript_doc_url: call.transcript_url,
      summary: call.ai_summary?.text,
      sentiment_score: analytics?.sentiment?.score,
      coach_summary: analytics?.sentiment?.label,
      talk_time_rep_pct: analytics?.talk_time_analysis?.rep_percentage,
      talk_time_customer_pct: analytics?.talk_time_analysis?.customer_percentage,
      talk_time_judgement: analytics?.talk_time_analysis?.rep_percentage
        ? (analytics.talk_time_analysis.rep_percentage > 70 ? 'high' :
           analytics.talk_time_analysis.rep_percentage < 30 ? 'low' : 'good')
        : null,
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

    console.log(`✅ Synced meeting: ${call.title} (${call.id})`)

    // Process participants (if available)
    if (call.participants && call.participants.length > 0) {
      for (const participant of call.participants) {
        // Create meeting attendee record
        await supabase
          .from('meeting_attendees')
          .insert({
            meeting_id: meeting.id,
            name: participant.name,
            email: participant.email || null,
            is_external: !participant.is_host,
            role: participant.is_host ? 'host' : 'attendee',
          })

        // Also try to find/create contact for internal tracking
        if (participant.email && !participant.is_host) {
          const { data: existingContact } = await supabase
            .from('contacts')
            .select('id')
            .eq('user_id', userId)
            .eq('email', participant.email)
            .single()

          if (!existingContact) {
            // Create new contact
            await supabase
              .from('contacts')
              .insert({
                user_id: userId,
                name: participant.name,
                email: participant.email,
                source: 'fathom_sync',
              })
          }
        }
      }
    }

    // Process key moments as action items
    if (analytics?.key_moments && analytics.key_moments.length > 0) {
      for (const moment of analytics.key_moments) {
        await supabase
          .from('meeting_action_items')
          .insert({
            meeting_id: meeting.id,
            title: moment.description,
            timestamp_seconds: moment.timestamp,
            category: moment.type,
            priority: moment.type === 'objection' ? 'high' : 'medium',
            ai_generated: true,
            completed: false,
          })
      }
    }

    return { success: true }
  } catch (error) {
    console.error(`❌ Error syncing call ${callId}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
