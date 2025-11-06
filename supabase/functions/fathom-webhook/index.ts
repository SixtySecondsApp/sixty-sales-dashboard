import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Fathom Unified Webhook Handler
 *
 * Purpose: Receive webhook events from Fathom when recordings are ready
 * This endpoint processes the complete meeting payload and triggers sync
 *
 * Webhook Event: recording.ready (or similar - check Fathom docs)
 * Payload: Complete meeting object with transcript, summary, action items
 */

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Get request metadata for logging
  const timestamp = new Date().toISOString()
  const requestId = crypto.randomUUID().substring(0, 8)

  console.log(`
╔════════════════════════════════════════════════════════════════
║ 📡 FATHOM WEBHOOK RECEIVED
║ Request ID: ${requestId}
║ Timestamp: ${timestamp}
║ Method: ${req.method}
║ User-Agent: ${req.headers.get('user-agent') || 'N/A'}
╚════════════════════════════════════════════════════════════════
  `)

  try {
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

    // Parse webhook payload
    const payload = await req.json()

    // Enhanced logging with full payload structure
    console.log(`
┌─────────────────────────────────────────────────────────────────
│ 📦 WEBHOOK PAYLOAD ANALYSIS (Request ${requestId})
├─────────────────────────────────────────────────────────────────
│ Recording ID: ${payload.recording_id || 'MISSING'}
│ Title: ${payload.title || payload.meeting_title || 'MISSING'}
│ Recorded By: ${payload.recorded_by?.email || 'MISSING'}
│ Team: ${payload.recorded_by?.team || 'N/A'}
│ Recording Start: ${payload.recording_start_time || 'MISSING'}
│ Recording End: ${payload.recording_end_time || 'MISSING'}
├─────────────────────────────────────────────────────────────────
│ Data Availability:
│ ✓ Transcript: ${!!payload.transcript ? 'YES' : 'NO'}
│ ✓ Summary: ${!!payload.default_summary ? 'YES' : 'NO'}
│ ✓ Action Items: ${Array.isArray(payload.action_items) && payload.action_items.length > 0 ? `YES (${payload.action_items.length})` : 'NO'}
│ ✓ Calendar Invitees: ${payload.calendar_invitees?.length || 0} participants
├─────────────────────────────────────────────────────────────────
│ Full Payload Keys: ${Object.keys(payload).join(', ')}
└─────────────────────────────────────────────────────────────────
    `)

    // Log raw payload for debugging (first 1000 chars)
    const payloadStr = JSON.stringify(payload, null, 2)
    console.log(`📋 Raw Payload Preview:\n${payloadStr.substring(0, 1000)}${payloadStr.length > 1000 ? '...' : ''}`)

    // Extract recording ID from payload
    // Try multiple possible field names based on Fathom's API
    const recordingId = payload.recording_id ||
                       payload.id ||
                       extractRecordingIdFromUrl(payload.share_url || payload.url)

    if (!recordingId) {
      console.error('❌ No recording_id found in webhook payload')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing recording_id in webhook payload'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log(`
┌─────────────────────────────────────────────────────────────────
│ 🎯 PROCESSING RECORDING
│ ID: ${recordingId}
│ Request ID: ${requestId}
└─────────────────────────────────────────────────────────────────
    `)

    // Determine user_id from recorded_by email
    let userId: string | null = null
    const recordedByEmail = payload.recorded_by?.email

    if (recordedByEmail) {
      console.log(`
┌─────────────────────────────────────────────────────────────────
│ 👤 USER LOOKUP (Request ${requestId})
│ Searching for: ${recordedByEmail}
├─────────────────────────────────────────────────────────────────
│ Step 1: Checking fathom_integrations table...
      `)

      // Look up user by email in fathom_integrations table
      const { data: integration, error: integrationError } = await supabase
        .from('fathom_integrations')
        .select('user_id, fathom_user_email, is_active, created_at')
        .eq('fathom_user_email', recordedByEmail)
        .eq('is_active', true)
        .single()

      if (integrationError) {
        console.log(`│ ⚠️  Integration query error: ${integrationError.message}`)
      }

      if (integration) {
        userId = integration.user_id
        console.log(`│ ✅ Found active integration!
│    Email: ${integration.fathom_user_email}
│    User ID: ${userId}
│    Created: ${integration.created_at}
└─────────────────────────────────────────────────────────────────
        `)
      } else {
        console.log(`│ ❌ No active integration found
├─────────────────────────────────────────────────────────────────
│ Step 2: Checking auth.users as fallback...
        `)

        // Try auth.users as fallback
        const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

        if (usersError) {
          console.log(`│ ⚠️  Auth users query error: ${usersError.message}`)
        }

        const matchedUser = users.find(u => u.email === recordedByEmail)

        if (matchedUser) {
          userId = matchedUser.id
          console.log(`│ ✅ Found user in auth.users!
│    Email: ${matchedUser.email}
│    User ID: ${userId}
│    Created: ${matchedUser.created_at}
└─────────────────────────────────────────────────────────────────
          `)
        } else {
          console.log(`│ ❌ No user found in auth.users
│ Total users checked: ${users.length}
└─────────────────────────────────────────────────────────────────
          `)
        }
      }
    } else {
      console.log(`
┌─────────────────────────────────────────────────────────────────
│ ❌ USER LOOKUP FAILED (Request ${requestId})
│ Reason: No recorded_by.email in payload
└─────────────────────────────────────────────────────────────────
      `)
    }

    if (!userId) {
      console.error('❌ Could not determine user_id for webhook')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unable to determine user_id from webhook payload'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Call the main fathom-sync function with webhook mode
    console.log(`
┌─────────────────────────────────────────────────────────────────
│ 🔄 CALLING SYNC FUNCTION (Request ${requestId})
│ URL: ${Deno.env.get('SUPABASE_URL')}/functions/v1/fathom-sync
│ User ID: ${userId}
│ Recording ID: ${recordingId}
└─────────────────────────────────────────────────────────────────
    `)

    const syncUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fathom-sync`
    const syncStartTime = Date.now()

    const syncResponse = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sync_type: 'webhook',
        user_id: userId,
        // Pass the entire webhook payload as the call object
        // The sync function will process it directly
        webhook_payload: payload,
      }),
    })

    const syncDuration = Date.now() - syncStartTime

    if (!syncResponse.ok) {
      const errorText = await syncResponse.text()
      console.error(`
┌─────────────────────────────────────────────────────────────────
│ ❌ SYNC FUNCTION FAILED (Request ${requestId})
│ Status: ${syncResponse.status}
│ Duration: ${syncDuration}ms
│ Error: ${errorText}
└─────────────────────────────────────────────────────────────────
      `)
      throw new Error(`Sync failed: ${errorText}`)
    }

    const syncResult = await syncResponse.json()
    console.log(`
┌─────────────────────────────────────────────────────────────────
│ ✅ SYNC COMPLETED (Request ${requestId})
│ Duration: ${syncDuration}ms
│ Meetings Synced: ${syncResult.meetings_synced || 0}
│ Errors: ${syncResult.errors?.length || 0}
├─────────────────────────────────────────────────────────────────
│ Result: ${JSON.stringify(syncResult, null, 2)}
└─────────────────────────────────────────────────────────────────
    `)

    console.log(`
╔════════════════════════════════════════════════════════════════
║ ✅ WEBHOOK PROCESSING COMPLETE
║ Request ID: ${requestId}
║ Recording ID: ${recordingId}
║ User ID: ${userId}
║ Total Duration: ${Date.now() - new Date(timestamp).getTime()}ms
╚════════════════════════════════════════════════════════════════
    `)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook processed successfully',
        recording_id: recordingId,
        user_id: userId,
        request_id: requestId,
        sync_duration_ms: syncDuration,
        sync_result: syncResult,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined

    console.error(`
╔════════════════════════════════════════════════════════════════
║ ❌ WEBHOOK ERROR
║ Request ID: ${requestId || 'N/A'}
║ Timestamp: ${new Date().toISOString()}
╠════════════════════════════════════════════════════════════════
║ Error: ${errorMessage}
║
║ Stack Trace:
║ ${errorStack || 'No stack trace available'}
╚════════════════════════════════════════════════════════════════
    `)

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        request_id: requestId || undefined,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

/**
 * Helper: Extract recording ID from Fathom URL
 */
function extractRecordingIdFromUrl(url?: string): string | null {
  if (!url) return null

  try {
    // Extract from share URL: https://fathom.video/share/xyz123
    const shareMatch = url.match(/share\/([^\/\?]+)/)
    if (shareMatch) return shareMatch[1]

    // Extract from calls URL: https://fathom.video/calls/123456
    const callsMatch = url.match(/calls\/(\d+)/)
    if (callsMatch) return callsMatch[1]

    return null
  } catch {
    return null
  }
}
