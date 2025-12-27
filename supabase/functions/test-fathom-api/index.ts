import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { recording_id, org_id, meeting_id, action } = await req.json()

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Action: check_integration - check Fathom integration details for an org
    if (action === 'check_integration' && org_id) {
      const { data: integration } = await adminClient
        .from('fathom_org_integrations')
        .select('*')
        .eq('org_id', org_id)
        .maybeSingle()

      const { data: credentials, error: credError } = await adminClient
        .from('fathom_org_credentials')
        .select('*')
        .eq('org_id', org_id)
        .maybeSingle()

      // Get user profile for the credential owner
      let credentialOwner = null
      if (credentials?.user_id) {
        const { data: profile } = await adminClient
          .from('profiles')
          .select('id, email, first_name, last_name')
          .eq('id', credentials.user_id)
          .maybeSingle()
        credentialOwner = profile
      }

      // Count meetings by owner_user_id for this org
      const { data: meetingsByOwner } = await adminClient
        .from('meetings')
        .select('owner_user_id')
        .eq('org_id', org_id)
        .not('fathom_recording_id', 'is', null)

      const ownerCounts: Record<string, number> = {}
      meetingsByOwner?.forEach(m => {
        ownerCounts[m.owner_user_id] = (ownerCounts[m.owner_user_id] || 0) + 1
      })

      return new Response(JSON.stringify({
        action: 'check_integration',
        org_id,
        integration,
        credentials: credentials ? {
          user_id: credentials.user_id,
          fathom_user_id: credentials.fathom_user_id,
          fathom_team_id: credentials.fathom_team_id,
          has_access_token: !!credentials.access_token,
          access_token_length: credentials.access_token?.length || 0,
          token_expires_at: credentials.token_expires_at,
          created_at: credentials.created_at,
          updated_at: credentials.updated_at
        } : null,
        credentials_error: credError?.message || null,
        credential_owner: credentialOwner,
        meetings_by_owner: ownerCounts
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: cleanup_test_meetings - delete meetings with test recording IDs
    if (action === 'cleanup_test_meetings' && org_id) {
      // Find meetings with test-prefixed recording IDs
      const { data: testMeetings } = await adminClient
        .from('meetings')
        .select('id, title, fathom_recording_id')
        .eq('org_id', org_id)
        .like('fathom_recording_id', 'test-%')

      if (!testMeetings || testMeetings.length === 0) {
        return new Response(JSON.stringify({
          action: 'cleanup_test_meetings',
          org_id,
          message: 'No test meetings found',
          deleted: 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Delete them
      const { error: deleteError } = await adminClient
        .from('meetings')
        .delete()
        .eq('org_id', org_id)
        .like('fathom_recording_id', 'test-%')

      return new Response(JSON.stringify({
        action: 'cleanup_test_meetings',
        org_id,
        deleted: testMeetings.length,
        deleted_meetings: testMeetings,
        error: deleteError?.message || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: clear_credentials - force delete credentials for an org
    if (action === 'clear_credentials' && org_id) {
      const { error: delError } = await adminClient
        .from('fathom_org_credentials')
        .delete()
        .eq('org_id', org_id)

      return new Response(JSON.stringify({
        action: 'clear_credentials',
        org_id,
        success: !delError,
        error: delError?.message || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: check_meeting_state - check a meeting's transcript state
    if (action === 'check_meeting_state' && meeting_id) {
      const { data: meeting, error: meetingError } = await adminClient
        .from('meetings')
        .select('id, title, org_id, owner_user_id, fathom_recording_id, fathom_user_id, transcript_text, meeting_start, created_at, updated_at')
        .eq('id', meeting_id)
        .maybeSingle()

      const { data: indexQueue } = await adminClient
        .from('meeting_index_queue')
        .select('*')
        .eq('meeting_id', meeting_id)
        .maybeSingle()

      return new Response(JSON.stringify({
        action: 'check_meeting_state',
        meeting_id,
        meeting: meeting ? {
          id: meeting.id,
          title: meeting.title,
          org_id: meeting.org_id,
          owner_user_id: meeting.owner_user_id,
          fathom_user_id: meeting.fathom_user_id,
          fathom_recording_id: meeting.fathom_recording_id,
          has_transcript: !!meeting.transcript_text,
          transcript_length: meeting.transcript_text?.length || 0,
          meeting_start: meeting.meeting_start,
          created_at: meeting.created_at,
          updated_at: meeting.updated_at
        } : null,
        index_queue: indexQueue,
        error: meetingError?.message || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: count_pending_transcripts - count meetings needing transcripts for an org
    if (action === 'count_pending_transcripts' && org_id) {
      const { count, error: countError } = await adminClient
        .from('meetings')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', org_id)
        .is('transcript_text', null)
        .not('fathom_recording_id', 'is', null)

      const { data: oldestPending } = await adminClient
        .from('meetings')
        .select('id, title, meeting_start, fathom_recording_id')
        .eq('org_id', org_id)
        .is('transcript_text', null)
        .not('fathom_recording_id', 'is', null)
        .order('meeting_start', { ascending: true })
        .limit(5)

      const { data: newestPending } = await adminClient
        .from('meetings')
        .select('id, title, meeting_start, fathom_recording_id')
        .eq('org_id', org_id)
        .is('transcript_text', null)
        .not('fathom_recording_id', 'is', null)
        .order('meeting_start', { ascending: false })
        .limit(5)

      return new Response(JSON.stringify({
        action: 'count_pending_transcripts',
        org_id,
        total_pending: count,
        oldest_pending: oldestPending,
        newest_pending: newestPending,
        error: countError?.message || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: check_sync_state - check and optionally reset sync state
    if (action === 'check_sync_state' && org_id) {
      const { data: syncState, error: syncError } = await adminClient
        .from('fathom_org_sync_state')
        .select('*')
        .eq('org_id', org_id)
        .maybeSingle()

      return new Response(JSON.stringify({
        action: 'check_sync_state',
        org_id,
        sync_state: syncState,
        error: syncError?.message || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: reset_sync_state - reset stuck sync state to idle
    if (action === 'reset_sync_state' && org_id) {
      const { data: updated, error: updateError } = await adminClient
        .from('fathom_org_sync_state')
        .update({ sync_status: 'idle' })
        .eq('org_id', org_id)
        .select()
        .maybeSingle()

      return new Response(JSON.stringify({
        action: 'reset_sync_state',
        org_id,
        success: !updateError,
        updated: updated,
        error: updateError?.message || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: preview_backfill - show what meetings would be processed by backfill
    if (action === 'preview_backfill' && org_id) {
      const limit = 50 // Same as backfill limit

      const { data: meetings, error: queryError } = await adminClient
        .from('meetings')
        .select('id, title, fathom_recording_id, meeting_start, transcript_text')
        .eq('org_id', org_id)
        .is('transcript_text', null)
        .not('fathom_recording_id', 'is', null)
        .order('meeting_start', { ascending: false })
        .limit(limit)

      // Check if target meeting is in the list
      const targetMeetingId = 'fd729ee9-0dd2-4ebe-8881-19068dc14807'
      const targetInList = meetings?.some(m => m.id === targetMeetingId) || false
      const targetPosition = meetings?.findIndex(m => m.id === targetMeetingId)

      return new Response(JSON.stringify({
        action: 'preview_backfill',
        org_id,
        total_returned: meetings?.length || 0,
        meetings: meetings?.map((m, i) => ({
          position: i + 1,
          id: m.id,
          title: m.title,
          fathom_recording_id: m.fathom_recording_id,
          meeting_start: m.meeting_start,
          has_transcript: !!m.transcript_text,
          is_target: m.id === targetMeetingId
        })),
        target_meeting_in_list: targetInList,
        target_position: targetPosition !== undefined && targetPosition >= 0 ? targetPosition + 1 : null,
        error: queryError?.message || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: batch_fetch_transcripts - process multiple meetings without auth
    if (action === 'batch_fetch_transcripts' && org_id) {
      const limit = 50
      const delay = 1500 // ms between requests (increased to avoid 429)

      // Get credentials for org
      const { data: creds } = await adminClient
        .from('fathom_org_credentials')
        .select('access_token')
        .eq('org_id', org_id)
        .maybeSingle()

      if (!creds?.access_token) {
        return new Response(JSON.stringify({
          action: 'batch_fetch_transcripts',
          error: 'No credentials for org'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Get meetings needing transcripts
      const { data: meetings, error: queryError } = await adminClient
        .from('meetings')
        .select('id, title, fathom_recording_id, owner_user_id')
        .eq('org_id', org_id)
        .is('transcript_text', null)
        .not('fathom_recording_id', 'is', null)
        .order('meeting_start', { ascending: false })
        .limit(limit)

      if (queryError || !meetings || meetings.length === 0) {
        return new Response(JSON.stringify({
          action: 'batch_fetch_transcripts',
          org_id,
          message: meetings?.length === 0 ? 'No meetings need transcripts' : 'Query failed',
          error: queryError?.message || null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const results: Array<{meeting_id: string, title: string, success: boolean, message: string, length?: number}> = []

      for (const meeting of meetings) {
        if (!meeting.fathom_recording_id || !/^\d+$/.test(meeting.fathom_recording_id)) {
          results.push({ meeting_id: meeting.id, title: meeting.title, success: false, message: 'Invalid recording ID' })
          continue
        }

        try {
          const url = `https://api.fathom.ai/external/v1/recordings/${meeting.fathom_recording_id}/transcript`
          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${creds.access_token}`,
              'Content-Type': 'application/json',
            },
          })

          if (response.status === 404) {
            results.push({ meeting_id: meeting.id, title: meeting.title, success: false, message: 'Transcript not available (404)' })
            continue
          }

          if (!response.ok) {
            results.push({ meeting_id: meeting.id, title: meeting.title, success: false, message: `API error: ${response.status}` })
            continue
          }

          const data = await response.json()
          let transcriptText: string | null = null

          if (Array.isArray(data.transcript)) {
            const lines = data.transcript.map((seg: any) => {
              const speaker = seg?.speaker?.display_name ? `${seg.speaker.display_name}: ` : ''
              return `${speaker}${seg?.text || ''}`.trim()
            })
            transcriptText = lines.join('\n')
          } else if (typeof data.transcript === 'string') {
            transcriptText = data.transcript
          }

          if (!transcriptText || transcriptText.trim().length === 0) {
            // Mark with placeholder so it doesn't appear in backfill queue again
            await adminClient
              .from('meetings')
              .update({
                transcript_text: '[No transcript content - meeting too short or no speech detected]',
                updated_at: new Date().toISOString()
              })
              .eq('id', meeting.id)
            results.push({ meeting_id: meeting.id, title: meeting.title, success: true, message: 'Marked as empty (no content)' })
            continue
          }

          const { error: updateError } = await adminClient
            .from('meetings')
            .update({ transcript_text: transcriptText, updated_at: new Date().toISOString() })
            .eq('id', meeting.id)

          if (updateError) {
            results.push({ meeting_id: meeting.id, title: meeting.title, success: false, message: `Save failed: ${updateError.message}` })
            continue
          }

          // Queue for indexing (ignore errors)
          try {
            await adminClient.from('meeting_index_queue').upsert({
              meeting_id: meeting.id,
              user_id: meeting.owner_user_id,
              priority: 5,
              attempts: 0,
              max_attempts: 3
            }, { onConflict: 'meeting_id,user_id' })
          } catch {}

          results.push({ meeting_id: meeting.id, title: meeting.title, success: true, message: 'OK', length: transcriptText.length })

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, delay))
        } catch (err) {
          results.push({ meeting_id: meeting.id, title: meeting.title, success: false, message: err instanceof Error ? err.message : String(err) })
        }
      }

      const succeeded = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length

      // Get remaining count
      const { count: remaining } = await adminClient
        .from('meetings')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', org_id)
        .is('transcript_text', null)
        .not('fathom_recording_id', 'is', null)

      return new Response(JSON.stringify({
        action: 'batch_fetch_transcripts',
        org_id,
        processed: results.length,
        succeeded,
        failed,
        remaining: remaining || 0,
        results
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: force_fetch_transcript - fetch and save transcript for a specific meeting
    if (action === 'force_fetch_transcript' && meeting_id) {
      // Get meeting details
      const { data: meeting, error: meetingError } = await adminClient
        .from('meetings')
        .select('id, title, org_id, fathom_recording_id, transcript_text, owner_user_id')
        .eq('id', meeting_id)
        .maybeSingle()

      if (meetingError || !meeting) {
        return new Response(JSON.stringify({
          action: 'force_fetch_transcript',
          error: 'Meeting not found',
          details: meetingError?.message
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (meeting.transcript_text) {
        return new Response(JSON.stringify({
          action: 'force_fetch_transcript',
          meeting_id,
          message: 'Meeting already has transcript',
          transcript_length: meeting.transcript_text.length
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      if (!meeting.fathom_recording_id) {
        return new Response(JSON.stringify({
          action: 'force_fetch_transcript',
          meeting_id,
          error: 'Meeting has no fathom_recording_id'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Get credentials for org
      const { data: creds } = await adminClient
        .from('fathom_org_credentials')
        .select('access_token')
        .eq('org_id', meeting.org_id)
        .maybeSingle()

      if (!creds?.access_token) {
        return new Response(JSON.stringify({
          action: 'force_fetch_transcript',
          error: 'No credentials for org'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Fetch transcript from Fathom
      const url = `https://api.fathom.ai/external/v1/recordings/${meeting.fathom_recording_id}/transcript`
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${creds.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        return new Response(JSON.stringify({
          action: 'force_fetch_transcript',
          meeting_id,
          error: `Fathom API error: ${response.status}`,
          details: errorText.substring(0, 300)
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()

      // Parse transcript
      let transcriptText: string | null = null
      if (Array.isArray(data.transcript)) {
        const lines = data.transcript.map((segment: any) => {
          const speaker = segment?.speaker?.display_name ? `${segment.speaker.display_name}: ` : ''
          const text = segment?.text || ''
          return `${speaker}${text}`.trim()
        })
        transcriptText = lines.join('\n')
      } else if (typeof data.transcript === 'string') {
        transcriptText = data.transcript
      }

      if (!transcriptText) {
        return new Response(JSON.stringify({
          action: 'force_fetch_transcript',
          meeting_id,
          error: 'Could not parse transcript from Fathom response',
          response_preview: JSON.stringify(data).substring(0, 300)
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Save transcript to meeting
      const { error: updateError } = await adminClient
        .from('meetings')
        .update({
          transcript_text: transcriptText,
          updated_at: new Date().toISOString()
        })
        .eq('id', meeting_id)

      if (updateError) {
        return new Response(JSON.stringify({
          action: 'force_fetch_transcript',
          meeting_id,
          error: 'Failed to save transcript',
          details: updateError.message
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Queue for indexing
      await adminClient.from('meeting_index_queue').upsert({
        meeting_id: meeting.id,
        user_id: meeting.owner_user_id,
        priority: 10, // High priority for manual fetch
        attempts: 0,
        max_attempts: 3
      }, { onConflict: 'meeting_id,user_id' })

      return new Response(JSON.stringify({
        action: 'force_fetch_transcript',
        meeting_id,
        title: meeting.title,
        success: true,
        transcript_length: transcriptText.length,
        message: 'Transcript fetched and saved successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: test_transcript_fetch - directly test fetching transcript for a recording
    if (action === 'test_transcript_fetch' && org_id && recording_id) {
      // Get credentials for org
      const { data: creds } = await adminClient
        .from('fathom_org_credentials')
        .select('access_token')
        .eq('org_id', org_id)
        .maybeSingle()

      if (!creds?.access_token) {
        return new Response(JSON.stringify({
          action: 'test_transcript_fetch',
          error: 'No credentials for org'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const url = `https://api.fathom.ai/external/v1/recordings/${recording_id}/transcript`

      // Try Bearer auth
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${creds.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      const body = await response.text()
      let parsed = null
      try { parsed = JSON.parse(body) } catch {}

      // If we got a transcript, check its structure
      let transcriptInfo = null
      if (parsed?.transcript && Array.isArray(parsed.transcript)) {
        transcriptInfo = {
          type: 'array',
          segment_count: parsed.transcript.length,
          first_segment: parsed.transcript[0] ? {
            speaker: parsed.transcript[0]?.speaker?.display_name,
            text_preview: parsed.transcript[0]?.text?.substring(0, 100)
          } : null,
          total_chars: parsed.transcript.reduce((sum: number, seg: any) => sum + (seg?.text?.length || 0), 0)
        }
      } else if (typeof parsed?.transcript === 'string') {
        transcriptInfo = {
          type: 'string',
          length: parsed.transcript.length,
          preview: parsed.transcript.substring(0, 200)
        }
      }

      return new Response(JSON.stringify({
        action: 'test_transcript_fetch',
        org_id,
        recording_id,
        status: response.status,
        ok: response.ok,
        has_transcript: !!transcriptInfo,
        transcript_info: transcriptInfo,
        response_preview: !transcriptInfo ? body.substring(0, 500) : null,
        error: response.ok ? null : `HTTP ${response.status}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: check_oauth_states - debug OAuth states table
    if (action === 'check_oauth_states') {
      const { data: states, error: statesError } = await adminClient
        .from('fathom_oauth_states')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      // Check if org_id column exists by looking at the data
      const columnInfo = states && states.length > 0 ? Object.keys(states[0]) : []

      return new Response(JSON.stringify({
        action: 'check_oauth_states',
        columns: columnInfo,
        has_org_id_column: columnInfo.includes('org_id'),
        recent_states: states?.map(s => ({
          state: s.state?.substring(0, 8) + '...',
          user_id: s.user_id,
          org_id: s.org_id,
          expires_at: s.expires_at,
          created_at: s.created_at
        })),
        error: statesError?.message || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: test_api - test Fathom API directly
    if (action === 'test_api' && org_id) {
      // Get credentials for org
      const { data: creds } = await adminClient
        .from('fathom_org_credentials')
        .select('access_token')
        .eq('org_id', org_id)
        .maybeSingle()

      if (!creds?.access_token) {
        return new Response(JSON.stringify({ error: 'No credentials for org' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Test meetings endpoint
      const response = await fetch('https://api.fathom.ai/external/v1/meetings?limit=3', {
        headers: {
          'Authorization': `Bearer ${creds.access_token}`,
        },
      })

      const body = await response.text()
      let parsed = null
      try { parsed = JSON.parse(body) } catch {}

      return new Response(JSON.stringify({
        action: 'test_api',
        org_id,
        status: response.status,
        ok: response.ok,
        recordings_preview: parsed ? (Array.isArray(parsed) ? parsed.slice(0, 3) : parsed) : body.substring(0, 500)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: full_reset - completely reset Fathom integration for an org
    if (action === 'full_reset' && org_id) {
      const results: any = { action: 'full_reset', org_id, steps: [] }

      // 1. Delete credentials
      const { error: credsErr } = await adminClient
        .from('fathom_org_credentials')
        .delete()
        .eq('org_id', org_id)
      results.steps.push({ step: 'delete_credentials', error: credsErr?.message || null })

      // 2. Delete sync state
      const { error: syncErr } = await adminClient
        .from('fathom_org_sync_state')
        .delete()
        .eq('org_id', org_id)
      results.steps.push({ step: 'delete_sync_state', error: syncErr?.message || null })

      // 3. Delete integration
      const { error: intErr } = await adminClient
        .from('fathom_org_integrations')
        .delete()
        .eq('org_id', org_id)
      results.steps.push({ step: 'delete_integration', error: intErr?.message || null })

      // 4. Check if all cleared
      const { data: remaining } = await adminClient
        .from('fathom_org_integrations')
        .select('id')
        .eq('org_id', org_id)
        .maybeSingle()
      results.fully_cleared = !remaining

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: check_credentials - list all orgs with Fathom credentials
    if (action === 'check_credentials') {
      const { data: creds, error: credsError } = await adminClient
        .from('fathom_org_credentials')
        .select('org_id, token_expires_at')

      // Get org names
      const orgIds = creds?.map(c => c.org_id) || []
      const { data: orgs } = await adminClient
        .from('organizations')
        .select('id, name')
        .in('id', orgIds)

      const orgsMap = new Map(orgs?.map(o => [o.id, o.name]) || [])

      // Get integrations too
      const { data: integrations } = await adminClient
        .from('fathom_org_integrations')
        .select('org_id, is_active, fathom_user_email, connected_by_user_id, created_at')

      return new Response(JSON.stringify({
        action: 'check_credentials',
        credentials: creds?.map(c => ({
          org_id: c.org_id,
          org_name: orgsMap.get(c.org_id) || 'Unknown',
          token_expires_at: c.token_expires_at
        })),
        integrations: integrations?.map(i => ({
          org_id: i.org_id,
          org_name: orgsMap.get(i.org_id) || 'Unknown',
          is_active: i.is_active,
          fathom_user_email: i.fathom_user_email,
          connected_by_user_id: i.connected_by_user_id,
          created_at: i.created_at
        })),
        error: credsError?.message || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Action: check_orgs - list user's org memberships
    if (action === 'check_orgs' && org_id) {
      // org_id here is actually the user_id we want to check
      const { data: memberships, error: membError } = await adminClient
        .from('organization_memberships')
        .select('org_id, role, created_at')
        .eq('user_id', org_id)
        .order('created_at', { ascending: true })

      // Get org names
      const orgIds = memberships?.map(m => m.org_id) || []
      const { data: orgs } = await adminClient
        .from('organizations')
        .select('id, name')
        .in('id', orgIds)

      const orgsMap = new Map(orgs?.map(o => [o.id, o.name]) || [])

      return new Response(JSON.stringify({
        action: 'check_orgs',
        user_id: org_id,
        memberships: memberships?.map(m => ({
          org_id: m.org_id,
          org_name: orgsMap.get(m.org_id) || 'Unknown',
          role: m.role,
          created_at: m.created_at
        })),
        error: membError?.message || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let targetOrgId = org_id
    let targetRecordingId = recording_id

    // If meeting_id provided, look up org and recording from meeting
    if (meeting_id) {
      const { data: meeting, error: meetingError } = await adminClient
        .from('meetings')
        .select('org_id, fathom_recording_id')
        .eq('id', meeting_id)
        .single()

      if (meetingError || !meeting) {
        return new Response(JSON.stringify({
          error: 'Meeting not found',
          details: meetingError?.message
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      targetOrgId = meeting.org_id
      targetRecordingId = meeting.fathom_recording_id
    }

    if (!targetRecordingId || !targetOrgId) {
      return new Response(JSON.stringify({ error: 'Missing recording_id/org_id or meeting_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // List ALL orgs with Fathom credentials
    const { data: allCreds, error: allCredsError } = await adminClient
      .from('fathom_org_credentials')
      .select('org_id, substring(access_token, 1, 20) as token_preview')

    // Get credentials for target org
    const { data: credentials, error: credsError } = await adminClient
      .from('fathom_org_credentials')
      .select('access_token')
      .eq('org_id', targetOrgId)
      .single()

    if (credsError || !credentials) {
      return new Response(JSON.stringify({
        error: 'No credentials found',
        target_org_id: targetOrgId,
        all_orgs_with_creds: allCreds,
        details: credsError?.message
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const accessToken = credentials.access_token
    const url = `https://api.fathom.ai/external/v1/recordings/${targetRecordingId}/transcript`

    // Test with Bearer auth
    const bearerResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    const bearerBody = await bearerResponse.text()

    // Test with X-Api-Key
    const apiKeyResponse = await fetch(url, {
      headers: {
        'X-Api-Key': accessToken,
        'Content-Type': 'application/json',
      },
    })

    const apiKeyBody = await apiKeyResponse.text()

    return new Response(JSON.stringify({
      success: true,
      org_id: targetOrgId,
      recording_id: targetRecordingId,
      token_length: accessToken.length,
      token_start: accessToken.substring(0, 20),
      token_end: accessToken.substring(accessToken.length - 20),
      all_orgs_with_creds: allCreds,
      bearer_test: {
        status: bearerResponse.status,
        body_preview: bearerBody.substring(0, 300),
      },
      api_key_test: {
        status: apiKeyResponse.status,
        body_preview: apiKeyBody.substring(0, 300),
      }
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Test failed',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
