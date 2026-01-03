import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PollRequest {
  recording_id: string
}

interface GladiaUtterance {
  speaker: number
  text: string
  start: number
  end: number
  confidence: number
}

interface GladiaPollResponse {
  id: string
  status: 'queued' | 'processing' | 'done' | 'error'
  error?: string
  result?: {
    metadata: {
      audio_duration: number
      number_of_channels: number
      billing_time: number
    }
    transcription: {
      full_transcript: string
      languages: string[]
      utterances: GladiaUtterance[]
    }
    summarization?: {
      success: boolean
      results: string
    }
  }
}

/**
 * Voice Transcribe Poll Edge Function
 *
 * Polls Gladia for transcription results and updates the recording.
 * Should be called periodically by the client until status is 'completed' or 'failed'.
 *
 * Required Environment Variables:
 * - GLADIA_API_KEY
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get auth token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user from token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { recording_id }: PollRequest = await req.json()

    if (!recording_id) {
      return new Response(
        JSON.stringify({ error: 'recording_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get recording from database
    const { data: recording, error: recordingError } = await supabase
      .from('voice_recordings')
      .select('*')
      .eq('id', recording_id)
      .single()

    if (recordingError || !recording) {
      return new Response(
        JSON.stringify({ error: 'Recording not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user has access
    if (recording.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If already completed or failed, return current status
    if (recording.status === 'completed' || recording.status === 'failed') {
      return new Response(
        JSON.stringify({
          success: true,
          recording_id,
          status: recording.status,
          transcript: recording.transcript_text,
          speakers: recording.speakers,
          summary: recording.summary,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if we have a result URL to poll
    if (!recording.gladia_result_url) {
      return new Response(
        JSON.stringify({
          success: true,
          recording_id,
          status: recording.status,
          message: 'No transcription started yet',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Gladia API key
    const gladiaApiKey = Deno.env.get('GLADIA_API_KEY')
    if (!gladiaApiKey) {
      return new Response(
        JSON.stringify({ error: 'Transcription service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Poll Gladia for results
    console.log('Polling Gladia for recording:', recording_id)
    const pollResponse = await fetch(recording.gladia_result_url, {
      headers: {
        'x-gladia-key': gladiaApiKey,
      },
    })

    if (!pollResponse.ok) {
      console.error('Gladia poll failed:', pollResponse.status)
      return new Response(
        JSON.stringify({
          success: true,
          recording_id,
          status: 'transcribing',
          message: 'Still processing',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const pollResult: GladiaPollResponse = await pollResponse.json()
    console.log('Gladia poll status:', pollResult.status)

    // Handle different statuses
    if (pollResult.status === 'queued' || pollResult.status === 'processing') {
      return new Response(
        JSON.stringify({
          success: true,
          recording_id,
          status: 'transcribing',
          gladia_status: pollResult.status,
          message: 'Still processing',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (pollResult.status === 'error') {
      await supabase
        .from('voice_recordings')
        .update({
          status: 'failed',
          error_message: pollResult.error || 'Transcription failed',
        })
        .eq('id', recording_id)

      return new Response(
        JSON.stringify({
          success: false,
          recording_id,
          status: 'failed',
          error: pollResult.error || 'Transcription failed',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Status is 'done' - process results
    if (pollResult.status === 'done' && pollResult.result) {
      console.log('Transcription complete, processing results...')

      const transcriptionData = pollResult.result.transcription
      const utterances = transcriptionData?.utterances || []
      const fullTranscript = transcriptionData?.full_transcript || ''
      const detectedLanguages = transcriptionData?.languages || ['en']
      const summary = pollResult.result.summarization?.results || ''

      // Extract unique speakers
      const speakerSet = new Set(utterances.map(u => u.speaker))
      const speakers = Array.from(speakerSet).map((speakerId, index) => ({
        id: speakerId,
        name: `Speaker ${index + 1}`,
        initials: `S${index + 1}`,
      }))

      // Format transcript segments
      const transcriptSegments = utterances.map(u => ({
        speaker: `Speaker ${u.speaker + 1}`,
        speaker_id: u.speaker,
        text: u.text,
        start_time: u.start,
        end_time: u.end,
        confidence: u.confidence,
      }))

      // Generate action items from summary (basic extraction)
      const actionItems = extractActionItems(summary, speakers)

      // Update recording with results
      const { error: updateError } = await supabase
        .from('voice_recordings')
        .update({
          status: 'completed',
          transcript_text: fullTranscript,
          transcript_segments: transcriptSegments,
          speakers: speakers,
          language: detectedLanguages[0] || 'en',
          summary: summary || 'Meeting transcription completed.',
          action_items: actionItems,
          processed_at: new Date().toISOString(),
        })
        .eq('id', recording_id)

      if (updateError) {
        console.error('Failed to update recording:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to save transcription' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          recording_id,
          status: 'completed',
          transcript: fullTranscript,
          speakers: speakers,
          summary: summary,
          segments_count: transcriptSegments.length,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fallback
    return new Response(
      JSON.stringify({
        success: true,
        recording_id,
        status: 'transcribing',
        message: 'Processing',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Voice transcribe poll error:', error)
    return new Response(
      JSON.stringify({
        error: message,
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Extract action items from summary text
 */
function extractActionItems(summary: string, speakers: { id: number; name: string }[]): Array<{
  id: string
  text: string
  owner: string
  deadline: string
  done: boolean
}> {
  const items: Array<{
    id: string
    text: string
    owner: string
    deadline: string
    done: boolean
  }> = []

  // Look for action-related patterns
  const patterns = [
    /(?:will|should|need to|must|going to)\s+(.+?)(?:\.|$)/gi,
    /action[:\s]+(.+?)(?:\.|$)/gi,
    /todo[:\s]+(.+?)(?:\.|$)/gi,
    /follow[- ]?up[:\s]+(.+?)(?:\.|$)/gi,
  ]

  for (const pattern of patterns) {
    const matches = summary.matchAll(pattern)
    for (const match of matches) {
      if (match[1] && match[1].length > 10 && match[1].length < 200) {
        items.push({
          id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          text: match[1].trim(),
          owner: speakers[0]?.name || 'Team',
          deadline: 'This week',
          done: false,
        })
      }
    }
  }

  // Limit to 5 action items
  return items.slice(0, 5)
}
