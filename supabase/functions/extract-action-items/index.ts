import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { analyzeTranscriptWithClaude, deduplicateActionItems } from '../fathom-sync/aiAnalysis.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  meetingId: string
  rerun?: boolean
}

async function ensureTranscriptAvailable(supabaseClient: any, authHeader: string, meetingId: string) {
  // Attempt to fetch transcript via existing edge function. This function will no-op if already present.
  try {
    const functionsBase = Deno.env.get('SUPABASE_URL')
    if (!functionsBase) return

    const res = await fetch(`${functionsBase}/functions/v1/fetch-transcript`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ meetingId }),
    })

    // 200 OK or 202 Accepted are fine; otherwise just proceed
    if (!res.ok && res.status !== 202) {
      // Log but don't fail hard; analysis may still proceed if transcript already present
      const txt = await res.text().catch(() => '')
      console.warn('[extract-action-items] fetch-transcript returned non-ok:', res.status, txt)
    }
  } catch (e) {
    console.warn('[extract-action-items] Failed to call fetch-transcript:', e)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { meetingId }: RequestBody = await req.json()
    if (!meetingId) {
      return new Response(
        JSON.stringify({ error: 'meetingId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with RLS using the caller's token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Load meeting with minimal fields we need
    const { data: meeting, error: meetingErr } = await supabaseClient
      .from('meetings')
      .select('id, title, meeting_start, transcript_text, owner_email')
      .eq('id', meetingId)
      .single()

    if (meetingErr || !meeting) {
      return new Response(
        JSON.stringify({ error: 'Meeting not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ensure transcript exists (best-effort)
    if (!meeting.transcript_text) {
      await ensureTranscriptAvailable(supabaseClient, authHeader, meetingId)
    }

    // Re-fetch to get latest transcript_text after ensure step
    const { data: meeting2 } = await supabaseClient
      .from('meetings')
      .select('id, title, meeting_start, transcript_text, owner_email')
      .eq('id', meetingId)
      .single()

    const transcriptText = meeting2?.transcript_text || meeting.transcript_text || ''

    if (!transcriptText || transcriptText.trim().length < 10) {
      return new Response(
        JSON.stringify({ itemsCreated: 0, message: 'Transcript not available yet' }),
        { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Analyze transcript for action items using existing analyzer
    const analysis = await analyzeTranscriptWithClaude(transcriptText, {
      id: meeting.id,
      title: meeting.title,
      meeting_start: meeting.meeting_start,
      owner_email: meeting.owner_email,
    })

    // Optional: also consider any existing Fathom action items to deduplicate
    // We don't have Fathom payload here, so dedupe against DB by title and timestamp
    const aiItems = analysis.actionItems

    let createdCount = 0
    for (const item of aiItems) {
      const title = String(item.title || '').trim()
      if (!title) continue

      // Check for existing similar item in DB for this meeting
      const { data: existing } = await supabaseClient
        .from('meeting_action_items')
        .select('id')
        .eq('meeting_id', meetingId)
        .eq('title', title)
        .limit(1)

      if (existing && existing.length > 0) {
        continue
      }

      // Map AI fields to DB schema
      const deadline_at = item.deadline ? new Date(item.deadline).toISOString() : null
      const priority = item.priority || 'medium'
      const category = item.category || 'other'

      // Assign to owner by default for rep tasks (if no email present)
      const assignee_email = item.assignedToEmail || meeting.owner_email || null
      const assignee_name = item.assignedTo || null

      const insertPayload: Record<string, any> = {
        meeting_id: meetingId,
        title,
        assignee_name,
        assignee_email,
        priority,
        category,
        deadline_at,
        completed: false,
        ai_generated: true,
        ai_confidence: item.confidence ?? null,
        timestamp_seconds: null,
        playback_url: null,
      }

      const { error: insertErr } = await supabaseClient
        .from('meeting_action_items')
        .insert(insertPayload)

      if (!insertErr) {
        createdCount++
      } else {
        console.error('[extract-action-items] Insert error:', insertErr)
      }
    }

    return new Response(
      JSON.stringify({ itemsCreated: createdCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[extract-action-items] Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})


