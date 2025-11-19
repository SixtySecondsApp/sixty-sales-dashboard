import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BackfillProgress {
  total: number
  processed: number
  successful: number
  failed: number
  skipped: number
  errors: Array<{ meeting_id: string; error: string }>
}

/**
 * Refresh OAuth access token if expired
 */
async function refreshAccessToken(supabase: any, integration: any): Promise<string> {
  const now = new Date()
  const expiresAt = new Date(integration.token_expires_at)

  // Check if token is expired or will expire within 5 minutes
  const bufferMs = 5 * 60 * 1000 // 5 minutes buffer
  if (expiresAt.getTime() - now.getTime() > bufferMs) {
    // Token is still valid
    return integration.access_token
  }
  // Get OAuth configuration
  const clientId = Deno.env.get('VITE_FATHOM_CLIENT_ID')
  const clientSecret = Deno.env.get('VITE_FATHOM_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error('Missing Fathom OAuth configuration for token refresh')
  }

  // Exchange refresh token for new access token
  const tokenParams = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: integration.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const tokenResponse = await fetch('https://fathom.video/external/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams.toString(),
  })

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text()
    throw new Error(`Token refresh failed: ${errorText}. Please reconnect your Fathom integration.`)
  }

  const tokenData = await tokenResponse.json()
  // Calculate new token expiry
  const expiresIn = tokenData.expires_in || 3600 // Default 1 hour
  const newTokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  // Update tokens in database
  const { error: updateError } = await supabase
    .from('fathom_integrations')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || integration.refresh_token, // Some OAuth providers don't issue new refresh tokens
      token_expires_at: newTokenExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', integration.id)

  if (updateError) {
    throw new Error(`Failed to update refreshed tokens: ${updateError.message}`)
  }
  return tokenData.access_token
}

/**
 * Fetch transcript from Fathom API
 * Uses dual authentication: X-Api-Key first, then Bearer fallback
 */
async function fetchTranscriptFromFathom(
  accessToken: string,
  recordingId: string
): Promise<string | null> {
  try {
    const url = `https://api.fathom.ai/external/v1/recordings/${recordingId}/transcript`
    console.log(`🔍 Fetching transcript from: ${url}`)
    console.log(`📝 Recording ID: ${recordingId} (type: ${typeof recordingId})`)
    
    // Try X-Api-Key first (preferred for Fathom API)
    let response = await fetch(url, {
      headers: {
        'X-Api-Key': accessToken,
        'Content-Type': 'application/json',
      },
    })
    
    console.log(`📡 First attempt status: ${response.status}`)
    
    // If X-Api-Key fails with 401, try Bearer (for OAuth tokens)
    if (response.status === 401) {
      console.log(`🔄 Trying Bearer token authentication...`)
      response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
      console.log(`📡 Bearer attempt status: ${response.status}`)
    }

    if (response.status === 404) {
      // Try to get more info about why 404
      const errorText = await response.text()
      console.log(`⚠️  404 Response body: ${errorText.substring(0, 500)}`)
      console.log(`ℹ️  Transcript not yet available for recording ${recordingId} (404)`)
      return null
    }

    if (!response.ok) {
      const errorText = await response.text()
      const errorMsg = `HTTP ${response.status}: ${errorText.substring(0, 200)}`
      console.error(`❌ Failed to fetch transcript for recording ${recordingId}: ${errorMsg}`)
      console.error(`📋 Full error response: ${errorText}`)
      throw new Error(errorMsg)
    }

    const data = await response.json()

    // CRITICAL FIX: Fathom returns an array of transcript objects, not a string
    // Format: { transcript: [{ speaker: { display_name: "..." }, text: "..." }] }
    if (!data) {
      console.log(`⚠️  Empty response for transcript of recording ${recordingId}`)
      return null
    }

    // Handle array format (most common)
    if (Array.isArray(data.transcript)) {
      const lines = data.transcript.map((segment: any) => {
        const speaker = segment?.speaker?.display_name ? `${segment.speaker.display_name}: ` : ''
        const text = segment?.text || ''
        return `${speaker}${text}`.trim()
      })
      const plaintext = lines.join('\n')
      return plaintext
    }

    // Handle string format (fallback)
    if (typeof data.transcript === 'string') {
      return data.transcript
    }

    // If data itself is a string
    if (typeof data === 'string') {
      return data
    }
    
    // If data has a different structure, log it for debugging
    console.log(`⚠️  Unexpected transcript format for recording ${recordingId}:`, JSON.stringify(data).substring(0, 200))
    return null
  } catch (error) {
    console.error(`❌ Error fetching transcript for recording ${recordingId}:`, error instanceof Error ? error.message : String(error))
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { batchSize = 50, dryRun = false, days = null } = await req.json().catch(() => ({}))
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Build query for meetings without transcripts
    let query = supabase
      .from('meetings')
      .select('id, title, fathom_recording_id, owner_user_id, meeting_start, transcript_text, transcript_fetch_attempts, last_transcript_fetch_at')
      .is('transcript_text', null)
      .not('fathom_recording_id', 'is', null)
      .order('meeting_start', { ascending: false })
      .limit(batchSize)

    // Add date filter if specified
    if (days) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      query = query.gte('meeting_start', cutoffDate.toISOString())
    }

    const { data: meetings, error: queryError } = await query

    if (queryError) {
      throw new Error(`Failed to query meetings: ${queryError.message}`)
    }

    if (!meetings || meetings.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No meetings require transcript backfill',
          progress: {
            total: 0,
            processed: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            errors: []
          }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const progress: BackfillProgress = {
      total: meetings.length,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: []
    }

    // Group meetings by owner to batch integration lookups
    const meetingsByOwner = new Map<string, typeof meetings>()
    for (const meeting of meetings) {
      if (!meeting.owner_user_id) {
        progress.skipped++
        progress.errors.push({
          meeting_id: meeting.id,
          error: 'No owner_user_id'
        })
        continue
      }
      const ownerId = meeting.owner_user_id
      if (!meetingsByOwner.has(ownerId)) {
        meetingsByOwner.set(ownerId, [])
      }
      meetingsByOwner.get(ownerId)!.push(meeting)
    }

    // Process each owner's meetings
    for (const [ownerId, ownerMeetings] of meetingsByOwner) {
      // Get Fathom integration for this owner
      const { data: integration, error: integrationError } = await supabase
        .from('fathom_integrations')
        .select('id, access_token, refresh_token, token_expires_at')
        .eq('user_id', ownerId)
        .eq('is_active', true)
        .single()

      if (integrationError || !integration) {
        console.log(`⚠️  No active Fathom integration found for user ${ownerId}`)
        progress.skipped += ownerMeetings.length
        for (const meeting of ownerMeetings) {
          progress.errors.push({
            meeting_id: meeting.id,
            error: 'No active Fathom integration'
          })
        }
        continue
      }

      // Refresh token if needed
      let accessToken = integration.access_token
      try {
        accessToken = await refreshAccessToken(supabase, integration)
      } catch (error) {
        console.error(`❌ Failed to refresh token for user ${ownerId}:`, error instanceof Error ? error.message : String(error))
        progress.skipped += ownerMeetings.length
        for (const meeting of ownerMeetings) {
          progress.errors.push({
            meeting_id: meeting.id,
            error: `Token refresh failed: ${error instanceof Error ? error.message : String(error)}`
          })
        }
        continue
      }

      // Process each meeting
      for (const meeting of ownerMeetings) {
        progress.processed++
        
        if (!meeting.fathom_recording_id) {
          progress.skipped++
          progress.errors.push({
            meeting_id: meeting.id,
            error: 'No fathom_recording_id'
          })
          continue
        }

        if (dryRun) {
          console.log(`[DRY RUN] Would fetch transcript for meeting ${meeting.id} (${meeting.title})`)
          continue
        }

        console.log(`📄 Fetching transcript for meeting ${meeting.id} (${meeting.title}) - recording ${meeting.fathom_recording_id}`)

        // Update fetch tracking BEFORE attempting fetch
        await supabase
          .from('meetings')
          .update({
            transcript_fetch_attempts: (meeting.transcript_fetch_attempts || 0) + 1,
            last_transcript_fetch_at: new Date().toISOString(),
          })
          .eq('id', meeting.id)

        // Fetch transcript
        const transcript = await fetchTranscriptFromFathom(accessToken, String(meeting.fathom_recording_id))

        if (!transcript) {
          console.log(`ℹ️  Transcript not yet available for meeting ${meeting.id} - will retry later`)
          progress.skipped++
          progress.errors.push({
            meeting_id: meeting.id,
            error: 'Transcript not yet available from Fathom (still processing)'
          })
          continue
        }

        console.log(`✅ Successfully fetched transcript for meeting ${meeting.id} (${transcript.length} characters)`)

        // Update meeting with transcript
        const { error: updateError } = await supabase
          .from('meetings')
          .update({
            transcript_text: transcript,
            updated_at: new Date().toISOString(),
          })
          .eq('id', meeting.id)

        if (updateError) {
          console.error(`❌ Failed to update meeting ${meeting.id}:`, updateError.message)
          progress.failed++
          progress.errors.push({
            meeting_id: meeting.id,
            error: `Update failed: ${updateError.message}`
          })
        } else {
          progress.successful++
          console.log(`✅ Successfully updated meeting ${meeting.id} with transcript`)
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${progress.processed} meetings`,
        progress
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('❌ Backfill error:', error)
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

