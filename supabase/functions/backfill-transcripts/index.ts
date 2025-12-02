/**
 * Backfill Transcripts Edge Function
 *
 * Purpose: Fetch transcripts from Fathom API for existing meetings that have
 * recording IDs but no transcript_text.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { fetchTranscriptFromFathom } from '../_shared/fathomTranscript.ts'

const BATCH_SIZE = 20

interface BackfillResult {
  meeting_id: string
  recording_id: string
  success: boolean
  message: string
  transcript_length?: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let limit = BATCH_SIZE
    try {
      const body = await req.json()
      limit = Math.min(body.limit || BATCH_SIZE, 50)
    } catch {}

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: integration, error: integrationError } = await adminClient
      .from('fathom_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (integrationError || !integration) {
      return new Response(JSON.stringify({ error: 'No active Fathom integration found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let accessToken = integration.access_token
    const expiresAt = new Date(integration.token_expires_at)
    const now = new Date()

    if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
      const clientId = Deno.env.get('FATHOM_CLIENT_ID')
      const clientSecret = Deno.env.get('FATHOM_CLIENT_SECRET')

      if (clientId && clientSecret && integration.refresh_token) {
        const tokenParams = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: integration.refresh_token,
          client_id: clientId,
          client_secret: clientSecret,
        })

        const tokenResponse = await fetch('https://fathom.ai/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: tokenParams.toString(),
        })

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json()
          accessToken = tokenData.access_token
          await adminClient.from('fathom_integrations').update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || integration.refresh_token,
            token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          }).eq('id', integration.id)
        }
      }
    }

    const { data: meetings, error: queryError } = await adminClient
      .from('meetings')
      .select('id, fathom_recording_id, owner_user_id')
      .is('transcript_text', null)
      .not('fathom_recording_id', 'is', null)
      .order('meeting_start', { ascending: false })
      .limit(limit)

    if (queryError) {
      return new Response(JSON.stringify({ error: 'Failed to query meetings', details: queryError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!meetings || meetings.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No meetings found needing transcripts', processed: 0, results: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log(`Processing ${meetings.length} meetings for transcript backfill`)

    const results: BackfillResult[] = []

    for (const meeting of meetings) {
      const recordingId = meeting.fathom_recording_id

      if (!recordingId || recordingId.startsWith('test-') || !/^\d+$/.test(recordingId)) {
        results.push({ meeting_id: meeting.id, recording_id: recordingId || 'none', success: false, message: 'Invalid or test recording ID' })
        continue
      }

      try {
        console.log(`Fetching transcript for meeting ${meeting.id} (recording ${recordingId})`)
        const transcript = await fetchTranscriptFromFathom(accessToken, recordingId)

        if (!transcript) {
          results.push({ meeting_id: meeting.id, recording_id: recordingId, success: false, message: 'Transcript not available from Fathom' })
          continue
        }

        const { error: updateError } = await adminClient.from('meetings').update({
          transcript_text: transcript,
          updated_at: new Date().toISOString()
        }).eq('id', meeting.id)

        if (updateError) {
          results.push({ meeting_id: meeting.id, recording_id: recordingId, success: false, message: `Failed to save: ${updateError.message}` })
          continue
        }

        await adminClient.from('meeting_index_queue').upsert({
          meeting_id: meeting.id,
          user_id: meeting.owner_user_id,
          priority: 5,
          attempts: 0,
          max_attempts: 3
        }, { onConflict: 'meeting_id,user_id' })

        results.push({ meeting_id: meeting.id, recording_id: recordingId, success: true, message: 'Transcript fetched', transcript_length: transcript.length })
        await new Promise(resolve => setTimeout(resolve, 300))

      } catch (error) {
        results.push({ meeting_id: meeting.id, recording_id: recordingId, success: false, message: error instanceof Error ? error.message : String(error) })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${results.length} meetings`,
      processed: results.length,
      succeeded: successCount,
      failed: failCount,
      results
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Error in backfill-transcripts:', error)
    return new Response(JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
