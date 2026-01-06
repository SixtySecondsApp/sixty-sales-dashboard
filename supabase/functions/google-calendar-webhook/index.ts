import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Google Calendar Push Notification Webhook
 *
 * Receives notifications from Google Calendar API when calendar events change.
 * Triggers incremental sync to update local calendar_events table.
 *
 * Google sends notifications to this endpoint when:
 * - New events are created
 * - Existing events are updated
 * - Events are deleted
 *
 * @see https://developers.google.com/calendar/api/guides/push
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface GooglePushNotification {
  // Resource state
  'X-Goog-Resource-State': 'sync' | 'exists' | 'not_exists';
  // Channel ID we created
  'X-Goog-Channel-Id': string;
  // Channel expiration time
  'X-Goog-Channel-Expiration': string;
  // Resource ID (calendar ID)
  'X-Goog-Resource-Id': string;
  // Resource URI
  'X-Goog-Resource-Uri': string;
  // Message number (incremental)
  'X-Goog-Message-Number': string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Goog-*',
      },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Log ALL headers for debugging
    const allHeaders: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      allHeaders[key] = value;
    });
    console.log('All webhook headers:', allHeaders);

    // Parse Google push notification headers (use lowercase to match actual headers)
    const resourceState = req.headers.get('x-goog-resource-state');
    const channelId = req.headers.get('x-goog-channel-id');
    const resourceId = req.headers.get('x-goog-resource-id');
    const messageNumber = req.headers.get('x-goog-message-number');

    console.log('Google Calendar webhook received:', {
      resourceState,
      channelId,
      resourceId,
      messageNumber,
    });

    // Ignore sync state (initial verification)
    if (resourceState === 'sync') {
      console.log('Sync notification received - webhook verified');
      return new Response(JSON.stringify({ success: true, message: 'Webhook verified' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find the user and org for this channel
    const { data: channel, error: channelError } = await supabase
      .from('google_calendar_channels')
      .select('user_id, org_id, calendar_id, last_message_number')
      .eq('channel_id', channelId || '')
      .eq('is_active', true)
      .maybeSingle();

    if (channelError || !channel) {
      console.error('Channel not found:', channelError);
      return new Response(
        JSON.stringify({ error: 'Channel not found or inactive' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Deduplication: Check if we've already processed this message number
    // Google sends incremental message numbers - we should only process newer messages
    const currentMessageNumber = messageNumber ? parseInt(messageNumber, 10) : 0;
    const lastMessageNumber = channel.last_message_number || 0;

    if (currentMessageNumber <= lastMessageNumber) {
      console.log('Skipping duplicate/old notification:', {
        currentMessageNumber,
        lastMessageNumber,
        channelId,
      });
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Duplicate notification skipped',
          messageNumber: currentMessageNumber,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing webhook for user:', channel.user_id, 'org:', channel.org_id, 'message:', currentMessageNumber);

    // Trigger incremental sync for this calendar
    // We call the google-calendar-sync function to perform the actual sync
    const { data: syncResult, error: syncError } = await supabase.functions.invoke(
      'google-calendar-sync',
      {
        body: {
          action: 'incremental-sync',
          userId: channel.user_id,
          orgId: channel.org_id,
          calendarId: channel.calendar_id || 'primary',
        },
      }
    );

    if (syncError) {
      console.error('Sync error:', syncError);
      // Still return success to Google so they don't retry
      return new Response(
        JSON.stringify({ success: true, warning: 'Sync failed but acknowledged' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sync completed:', syncResult);

    // Update last notification time and message number
    await supabase
      .from('google_calendar_channels')
      .update({
        last_notification_at: new Date().toISOString(),
        notification_count: supabase.raw('notification_count + 1'),
        last_message_number: currentMessageNumber,
      })
      .eq('channel_id', channelId || '');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook processed successfully',
        eventsProcessed: syncResult?.eventsProcessed || 0,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook processing error:', error);

    // Always return 200 to Google to prevent retries
    return new Response(
      JSON.stringify({
        success: true,
        warning: 'Error occurred but acknowledged',
        error: error.message,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
});
