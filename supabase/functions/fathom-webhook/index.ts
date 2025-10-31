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

  try {
    console.log('📡 Fathom webhook received')

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
    console.log('📦 Webhook payload received:', {
      title: payload.title,
      recording_id: payload.recording_id,
      recorded_by: payload.recorded_by?.email,
      has_transcript: !!payload.transcript,
      has_summary: !!payload.default_summary,
      has_action_items: Array.isArray(payload.action_items) && payload.action_items.length > 0,
      calendar_invitees_count: payload.calendar_invitees?.length || 0
    })

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

    console.log(`🎯 Processing webhook for recording: ${recordingId}`)

    // Determine user_id from recorded_by email
    let userId: string | null = null
    const recordedByEmail = payload.recorded_by?.email

    if (recordedByEmail) {
      console.log(`👤 Looking up user by email: ${recordedByEmail}`)

      // Look up user by email in fathom_integrations table
      const { data: integration } = await supabase
        .from('fathom_integrations')
        .select('user_id, fathom_user_email')
        .eq('fathom_user_email', recordedByEmail)
        .eq('is_active', true)
        .single()

      if (integration) {
        userId = integration.user_id
        console.log(`✅ Found active integration for ${recordedByEmail} → user_id: ${userId}`)
      } else {
        console.warn(`⚠️  No active Fathom integration found for ${recordedByEmail}`)

        // Try auth.users as fallback
        const { data: { users } } = await supabase.auth.admin.listUsers()
        const matchedUser = users.find(u => u.email === recordedByEmail)

        if (matchedUser) {
          userId = matchedUser.id
          console.log(`✅ Found user in auth.users: ${userId}`)
        } else {
          console.error(`❌ No user found for email: ${recordedByEmail}`)
        }
      }
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
    console.log('🔄 Calling fathom-sync edge function...')

    const syncUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/fathom-sync`

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

    if (!syncResponse.ok) {
      const errorText = await syncResponse.text()
      console.error(`❌ Sync function failed: ${syncResponse.status} - ${errorText}`)
      throw new Error(`Sync failed: ${errorText}`)
    }

    const syncResult = await syncResponse.json()
    console.log('✅ Sync completed:', syncResult)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook processed successfully',
        recording_id: recordingId,
        user_id: userId,
        sync_result: syncResult,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('❌ Webhook error:', error)

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
