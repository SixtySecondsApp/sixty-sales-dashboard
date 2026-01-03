import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { S3Client } from "https://deno.land/x/s3_lite_client@0.7.0/mod.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TranscribeRequest {
  recording_id: string
}

/**
 * Voice Transcribe Edge Function
 *
 * Starts transcription via Gladia API and returns immediately.
 * The result_url is saved to the database for polling.
 *
 * Required Environment Variables:
 * - GLADIA_API_KEY
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - VOICE_S3_BUCKET (defaults to use60-voice-notes)
 * - AWS_REGION (defaults to eu-west-2)
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

    const { recording_id }: TranscribeRequest = await req.json()

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

    // Check if user has access to this recording
    if (recording.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update status to transcribing
    await supabase
      .from('voice_recordings')
      .update({ status: 'transcribing' })
      .eq('id', recording_id)

    // Get Gladia API key
    const gladiaApiKey = Deno.env.get('GLADIA_API_KEY')
    if (!gladiaApiKey) {
      await supabase
        .from('voice_recordings')
        .update({ status: 'failed', error_message: 'Gladia API key not configured' })
        .eq('id', recording_id)

      return new Response(
        JSON.stringify({ error: 'Transcription service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get AWS credentials for S3 presigned URL
    const awsAccessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID')
    const awsSecretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')
    const awsRegion = Deno.env.get('AWS_REGION') || 'eu-west-2'
    const awsBucket = Deno.env.get('VOICE_S3_BUCKET') || 'use60-voice-notes'

    if (!awsAccessKeyId || !awsSecretAccessKey) {
      await supabase
        .from('voice_recordings')
        .update({ status: 'failed', error_message: 'AWS credentials not configured' })
        .eq('id', recording_id)

      return new Response(
        JSON.stringify({ error: 'Storage credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate presigned URL for S3 audio file
    const audioUrlParts = recording.audio_url.match(/https:\/\/[^/]+\/(.+)$/)
    if (!audioUrlParts) {
      await supabase
        .from('voice_recordings')
        .update({ status: 'failed', error_message: 'Invalid audio URL format' })
        .eq('id', recording_id)

      return new Response(
        JSON.stringify({ error: 'Invalid audio URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const s3Key = audioUrlParts[1]
    console.log('Generating presigned URL for S3 key:', s3Key)

    const s3Client = new S3Client({
      endPoint: `s3.${awsRegion}.amazonaws.com`,
      region: awsRegion,
      accessKey: awsAccessKeyId,
      secretKey: awsSecretAccessKey,
      bucket: awsBucket,
      useSSL: true,
    })

    // Generate a presigned URL valid for 1 hour
    const presignedUrl = await s3Client.presignedGetObject(s3Key, { expirySeconds: 3600 })
    console.log('Generated presigned URL for Gladia access')

    // Start transcription with speaker diarization
    console.log('Starting transcription with diarization...')
    const transcriptionResponse = await fetch('https://api.gladia.io/v2/transcription', {
      method: 'POST',
      headers: {
        'x-gladia-key': gladiaApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: presignedUrl,
        diarization: true,
        diarization_config: {
          number_of_speakers: null,
          min_speakers: 1,
          max_speakers: 6,
        },
        detect_language: true,
        enable_code_switching: false,
        summarization: true,
        summarization_config: {
          type: 'general',
        },
      }),
    })

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text()
      console.error('Gladia transcription request failed:', errorText)
      await supabase
        .from('voice_recordings')
        .update({ status: 'failed', error_message: `Transcription request failed: ${errorText}` })
        .eq('id', recording_id)

      return new Response(
        JSON.stringify({ error: 'Failed to start transcription' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const transcriptionResult = await transcriptionResponse.json()
    const resultUrl = transcriptionResult.result_url

    console.log('Transcription started, result_url:', resultUrl)

    // Save result_url to database for polling
    await supabase
      .from('voice_recordings')
      .update({
        gladia_result_url: resultUrl,
        status: 'transcribing'
      })
      .eq('id', recording_id)

    // Return immediately - polling will be done by voice-transcribe-poll
    return new Response(
      JSON.stringify({
        success: true,
        recording_id,
        status: 'transcribing',
        message: 'Transcription started. Poll for results.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('Voice transcribe error:', error)
    return new Response(
      JSON.stringify({
        error: message,
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
