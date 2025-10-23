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
 *   - initial: User-initiated with date range
 *   - incremental: Hourly cron job (last 24h)
 *   - manual: User-triggered refresh
 *   - webhook: Immediate sync on webhook notification
 */

interface SyncRequest {
  sync_type: 'initial' | 'incremental' | 'manual' | 'webhook'
  start_date?: string // ISO 8601
  end_date?: string
  call_id?: string // For webhook-triggered single call sync
  user_id?: string // For webhook calls that explicitly pass user ID
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
    const { sync_type, start_date, end_date, call_id } = body

    // Get active Fathom integration
    const { data: integration, error: integrationError } = await supabase
      .from('fathom_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (integrationError || !integration) {
      throw new Error('No active Fathom integration found. Please connect your Fathom account first.')
    }

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
      const limit = 100
      let hasMore = true

      while (hasMore) {
        const calls = await fetchFathomCalls(integration, {
          start_date: apiStartDate,
          end_date: apiEndDate,
          limit,
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
        hasMore = calls.length === limit
        offset += limit

        // Safety limit to prevent infinite loops
        if (offset > 10000) {
          console.warn('⚠️  Reached safety limit of 10,000 calls')
          break
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
 * Fetch calls from Fathom API
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
  if (params.start_date) queryParams.set('start_date', params.start_date)
  if (params.end_date) queryParams.set('end_date', params.end_date)
  queryParams.set('limit', params.limit.toString())
  queryParams.set('offset', params.offset.toString())
  queryParams.set('sort_by', 'start_time')
  queryParams.set('sort_order', 'desc')

  const url = `https://api.fathom.video/v1/calls?${queryParams.toString()}`

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${integration.access_token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Fathom API error: ${response.status} - ${await response.text()}`)
  }

  const data = await response.json()
  return data.data || []
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
    // Fetch call details
    const callResponse = await fetch(`https://api.fathom.video/v1/calls/${callId}`, {
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json',
      },
    })

    if (!callResponse.ok) {
      throw new Error(`Failed to fetch call details: ${callResponse.status}`)
    }

    const call: FathomCall = await callResponse.json()

    // Fetch analytics (may not be available for new calls)
    let analytics: FathomAnalytics | null = null
    try {
      const analyticsResponse = await fetch(`https://api.fathom.video/v1/calls/${callId}/analytics`, {
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (analyticsResponse.ok) {
        analytics = await analyticsResponse.json()
      }
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
