import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FathomSummaryResponse {
  summary: string
  sentiment?: string
  coach_summary?: string
  talk_time_rep_pct?: number
  talk_time_customer_pct?: number
  talk_time_judgement?: string
}

async function fetchSummaryFromFathom(
  accessToken: string,
  recordingId: string
): Promise<FathomSummaryResponse | null> {
  try {
    console.log(`📝 Fetching summary for recording ${recordingId}...`)

    const response = await fetch(
      `https://api.fathom.ai/external/v1/recordings/${recordingId}/summary`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error(`❌ Summary fetch failed: HTTP ${response.status}`)
      if (response.status === 404) {
        console.log('ℹ️  Summary not yet available (still processing)')
        return null
      }
      throw new Error(`Failed to fetch summary: ${response.status}`)
    }

    const data: FathomSummaryResponse = await response.json()
    console.log(`✅ Summary fetched: ${data.summary?.length || 0} characters`)

    return data
  } catch (error) {
    console.error(`❌ Error fetching summary:`, error)
    throw error
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      throw new Error('Invalid user token')
    }

    const userId = user.id

    // Get meeting ID from request
    const { meetingId } = await req.json()

    if (!meetingId) {
      throw new Error('Missing meetingId parameter')
    }

    console.log(`📋 Fetching summary for meeting ${meetingId}`)

    // Get meeting details
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select(`
        id,
        fathom_recording_id,
        title,
        summary,
        sentiment_score,
        coach_summary,
        talk_time_rep_pct,
        talk_time_customer_pct,
        talk_time_judgement,
        owner_user_id
      `)
      .eq('id', meetingId)
      .eq('owner_user_id', userId)
      .single()

    if (meetingError || !meeting) {
      throw new Error('Meeting not found or access denied')
    }

    // Check if enhanced summary already exists
    if (meeting.summary && meeting.coach_summary) {
      console.log('ℹ️  Enhanced summary already exists, returning cached version')
      return new Response(
        JSON.stringify({
          success: true,
          summary: meeting.summary,
          sentiment_score: meeting.sentiment_score,
          coach_summary: meeting.coach_summary,
          talk_time_rep_pct: meeting.talk_time_rep_pct,
          talk_time_customer_pct: meeting.talk_time_customer_pct,
          talk_time_judgement: meeting.talk_time_judgement,
          cached: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    // Get Fathom integration
    const { data: fathomIntegration, error: integrationError } = await supabase
      .from('integrations')
      .select('access_token, fathom_user_id')
      .eq('user_id', userId)
      .eq('provider', 'fathom')
      .single()

    if (integrationError || !fathomIntegration) {
      throw new Error('Fathom integration not found')
    }

    // Fetch summary from Fathom
    const summaryData = await fetchSummaryFromFathom(
      fathomIntegration.access_token,
      meeting.fathom_recording_id
    )

    if (!summaryData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Summary not yet available - still processing',
          processing: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 202, // Accepted but not ready
        }
      )
    }

    // Update meeting with enhanced summary data
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        summary: summaryData.summary || meeting.summary, // Keep existing if new one not available
        sentiment_score: summaryData.sentiment || null,
        coach_summary: summaryData.coach_summary || null,
        talk_time_rep_pct: summaryData.talk_time_rep_pct || null,
        talk_time_customer_pct: summaryData.talk_time_customer_pct || null,
        talk_time_judgement: summaryData.talk_time_judgement || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', meetingId)

    if (updateError) {
      console.error('❌ Error updating meeting with summary:', updateError)
      throw updateError
    }

    console.log(`✅ Enhanced summary saved to meeting ${meetingId}`)

    return new Response(
      JSON.stringify({
        success: true,
        summary: summaryData.summary,
        sentiment_score: summaryData.sentiment,
        coach_summary: summaryData.coach_summary,
        talk_time_rep_pct: summaryData.talk_time_rep_pct,
        talk_time_customer_pct: summaryData.talk_time_customer_pct,
        talk_time_judgement: summaryData.talk_time_judgement,
        cached: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('❌ Error in fetch-summary function:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
