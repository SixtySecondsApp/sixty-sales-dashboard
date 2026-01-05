/**
 * Auto-Join Scheduler Edge Function
 *
 * Automatically deploys recording bots to upcoming calendar events.
 * Runs every 1-2 minutes via Supabase cron or external scheduler.
 *
 * Features:
 * - Queries calendar events starting within configurable lead time
 * - Filters for events with video call links (Zoom, Meet, Teams)
 * - Optionally filters for external attendees only
 * - Deploys bots only if not already recording
 *
 * Endpoint: POST /functions/v1/auto-join-scheduler
 * (Called by cron job with service role key)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  handleCorsPreflightRequest,
  jsonResponse,
  errorResponse,
} from '../_shared/corsHelper.ts';
import {
  isValidMeetingUrl,
  detectMeetingPlatform,
  isInternalEmail,
} from '../_shared/meetingbaas.ts';

// =============================================================================
// Types
// =============================================================================

interface RecordingSettings {
  bot_name?: string;
  bot_image_url?: string | null;
  entry_message_enabled?: boolean;
  entry_message?: string;
  recordings_enabled?: boolean;
  auto_record_enabled?: boolean;
  auto_record_lead_time_minutes?: number;
  auto_record_external_only?: boolean;
  webhook_token?: string;
}

interface OrgWithSettings {
  id: string;
  name: string;
  company_domain: string | null;
  recording_settings: RecordingSettings | null;
}

interface CalendarEvent {
  id: string;
  user_id: string;
  org_id: string | null;
  title: string;
  start_time: string;
  end_time: string;
  meeting_url: string | null;
  attendees_count: number;
  organizer_email: string | null;
  raw_data: {
    attendees?: Array<{ email: string; responseStatus?: string }>;
  } | null;
}

interface SchedulerResult {
  success: boolean;
  processed_orgs: number;
  events_checked: number;
  bots_deployed: number;
  errors: string[];
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_LEAD_TIME_MINUTES = 2;
const SCHEDULER_WINDOW_MINUTES = 3; // Check events starting in the next 3 minutes

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract attendee emails from raw event data
 */
function getAttendeeEmails(event: CalendarEvent): string[] {
  if (!event.raw_data?.attendees) {
    return [];
  }
  return event.raw_data.attendees
    .filter(a => a.email)
    .map(a => a.email.toLowerCase());
}

/**
 * Check if event has external attendees
 */
function hasExternalAttendees(
  attendeeEmails: string[],
  internalDomain: string | null
): boolean {
  if (!internalDomain || attendeeEmails.length === 0) {
    return true; // If we can't determine, assume external
  }

  return attendeeEmails.some(email => !isInternalEmail(email, internalDomain));
}

/**
 * Check if a recording already exists for this calendar event
 */
async function hasExistingRecording(
  supabase: SupabaseClient,
  calendarEventId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('recordings')
    .select('id, status')
    .eq('calendar_event_id', calendarEventId)
    .not('status', 'eq', 'failed')
    .maybeSingle();

  return !!data;
}

/**
 * Deploy a recording bot for a calendar event
 */
async function deployBotForEvent(
  supabase: SupabaseClient,
  event: CalendarEvent,
  orgId: string
): Promise<{ success: boolean; recording_id?: string; error?: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  try {
    // Call the deploy-recording-bot function
    const response = await fetch(`${supabaseUrl}/functions/v1/deploy-recording-bot`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        // Pass the user context so the bot is associated with the right user
        'x-user-id': event.user_id,
      },
      body: JSON.stringify({
        meeting_url: event.meeting_url,
        meeting_title: event.title,
        calendar_event_id: event.id,
        // Auto-join doesn't pass attendees - the webhook will handle this
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      recording_id: result.recording_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process a single organization's upcoming events
 */
async function processOrgEvents(
  supabase: SupabaseClient,
  org: OrgWithSettings,
  windowStart: Date,
  windowEnd: Date
): Promise<{ events_checked: number; bots_deployed: number; errors: string[] }> {
  const result = { events_checked: 0, bots_deployed: 0, errors: [] as string[] };

  const settings = org.recording_settings || {};
  const externalOnly = settings.auto_record_external_only !== false; // Default true

  // Query calendar events for this org in the time window
  const { data: events, error } = await supabase
    .from('calendar_events')
    .select(`
      id,
      user_id,
      org_id,
      title,
      start_time,
      end_time,
      meeting_url,
      attendees_count,
      organizer_email,
      raw_data
    `)
    .eq('org_id', org.id)
    .gte('start_time', windowStart.toISOString())
    .lte('start_time', windowEnd.toISOString())
    .not('meeting_url', 'is', null);

  if (error) {
    result.errors.push(`Failed to query events for org ${org.id}: ${error.message}`);
    return result;
  }

  if (!events || events.length === 0) {
    return result;
  }

  for (const event of events as CalendarEvent[]) {
    result.events_checked++;

    // Skip if no valid meeting URL
    if (!event.meeting_url || !isValidMeetingUrl(event.meeting_url)) {
      continue;
    }

    // Skip if external-only mode and no external attendees
    if (externalOnly) {
      const attendeeEmails = getAttendeeEmails(event);
      if (!hasExternalAttendees(attendeeEmails, org.company_domain)) {
        console.log(`[AutoJoin] Skipping internal-only event: ${event.title}`);
        continue;
      }
    }

    // Skip if already recording
    const alreadyRecording = await hasExistingRecording(supabase, event.id);
    if (alreadyRecording) {
      console.log(`[AutoJoin] Skipping, already recording: ${event.title}`);
      continue;
    }

    // Deploy bot
    console.log(`[AutoJoin] Deploying bot for: ${event.title} (${event.meeting_url})`);
    const deployResult = await deployBotForEvent(supabase, event, org.id);

    if (deployResult.success) {
      result.bots_deployed++;
      console.log(`[AutoJoin] Bot deployed, recording_id: ${deployResult.recording_id}`);
    } else {
      result.errors.push(`Failed to deploy for event ${event.id}: ${deployResult.error}`);
    }
  }

  return result;
}

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) {
    return preflightResponse;
  }

  // Only allow POST (from cron) or GET (for manual testing)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return errorResponse('Method not allowed', req, 405);
  }

  const result: SchedulerResult = {
    success: true,
    processed_orgs: 0,
    events_checked: 0,
    bots_deployed: 0,
    errors: [],
  };

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

    // Use service role for cross-org access
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Calculate time window
    const now = new Date();
    const windowStart = now;
    const windowEnd = new Date(now.getTime() + SCHEDULER_WINDOW_MINUTES * 60 * 1000);

    console.log(`[AutoJoin] Checking events from ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);

    // Get all organizations with auto_record_enabled
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id, name, company_domain, recording_settings')
      .eq('recording_settings->>auto_record_enabled', 'true')
      .eq('recording_settings->>recordings_enabled', 'true');

    if (orgsError) {
      throw new Error(`Failed to fetch organizations: ${orgsError.message}`);
    }

    if (!orgs || orgs.length === 0) {
      console.log('[AutoJoin] No organizations with auto-record enabled');
      return jsonResponse(result, req);
    }

    console.log(`[AutoJoin] Processing ${orgs.length} organizations`);

    // Process each organization
    for (const org of orgs as OrgWithSettings[]) {
      result.processed_orgs++;

      const settings = org.recording_settings || {};
      const leadTime = settings.auto_record_lead_time_minutes ?? DEFAULT_LEAD_TIME_MINUTES;

      // Adjust window based on lead time
      // Events starting between (now + leadTime - 1min) and (now + leadTime + 2min)
      const orgWindowStart = new Date(now.getTime() + (leadTime - 1) * 60 * 1000);
      const orgWindowEnd = new Date(now.getTime() + (leadTime + SCHEDULER_WINDOW_MINUTES) * 60 * 1000);

      try {
        const orgResult = await processOrgEvents(supabase, org, orgWindowStart, orgWindowEnd);
        result.events_checked += orgResult.events_checked;
        result.bots_deployed += orgResult.bots_deployed;
        result.errors.push(...orgResult.errors);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Org ${org.id}: ${errorMsg}`);
      }
    }

    console.log(`[AutoJoin] Complete: ${result.bots_deployed} bots deployed, ${result.events_checked} events checked`);

    return jsonResponse(result, req);
  } catch (error) {
    console.error('[AutoJoin] Scheduler error:', error);
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return jsonResponse(result, req, 500);
  }
});
