import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface SyncRequest {
  action: 'sync-full' | 'sync-incremental' | 'sync-historical';
  calendarId?: string;
  startDate?: string; // For historical sync
  endDate?: string; // For historical sync
}

interface GoogleEvent {
  id: string;
  etag: string;
  status: string;
  htmlLink: string;
  created: string;
  updated: string;
  summary?: string;
  description?: string;
  location?: string;
  colorId?: string;
  creator?: { email: string; displayName?: string };
  organizer?: { email: string; displayName?: string };
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  endTimeUnspecified?: boolean;
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: { date?: string; dateTime?: string };
  transparency?: string;
  visibility?: string;
  iCalUID?: string;
  sequence?: number;
  attendees?: Array<{
    email: string;
    displayName?: string;
    organizer?: boolean;
    responseStatus: string;
    optional?: boolean;
  }>;
  hangoutLink?: string;
  conferenceData?: any;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{ method: string; minutes: number }>;
  };
}

async function refreshAccessToken(refreshToken: string, supabase: any, userId: string): Promise<string> {
  console.log('[Calendar Sync] Refreshing access token...');
  
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID') || '';
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Calendar Sync] Token refresh failed:', errorData);
    throw new Error(`Failed to refresh token: ${errorData.error_description || 'Unknown error'}`);
  }

  const data = await response.json();
  
  // Update the stored access token
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 3600));
  
  const { error: updateError } = await supabase
    .from('google_integrations')
    .update({
      access_token: data.access_token,
      expires_at: expiresAt.toISOString(),
    })
    .eq('user_id', userId);
  
  if (updateError) {
    console.error('[Calendar Sync] Failed to update access token:', updateError);
    throw new Error('Failed to update access token in database');
  }
  
  console.log('[Calendar Sync] Access token refreshed successfully');
  return data.access_token;
}

async function fetchGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
  syncToken?: string | null,
  timeMin?: string,
  timeMax?: string,
  pageToken?: string
): Promise<any> {
  const params = new URLSearchParams();
  
  if (syncToken) {
    // For incremental sync
    params.set('syncToken', syncToken);
  } else {
    // For full sync or historical sync
    if (timeMin) params.set('timeMin', timeMin);
    if (timeMax) params.set('timeMax', timeMax);
    params.set('singleEvents', 'true');
    params.set('orderBy', 'startTime');
    params.set('maxResults', '250'); // Max allowed by Google
  }
  
  if (pageToken) {
    params.set('pageToken', pageToken);
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Calendar Sync] Failed to fetch events:', errorData);
    throw new Error(`Calendar API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  return response.json();
}

async function syncEventsToDatabase(
  supabase: any,
  userId: string,
  calendarId: string,
  events: GoogleEvent[],
  syncLogId: string
): Promise<{ created: number; updated: number; deleted: number; skipped: number }> {
  const stats = { created: 0, updated: 0, deleted: 0, skipped: 0 };

  // Get the calendar record
  const { data: calendar } = await supabase
    .from('calendar_calendars')
    .select('id')
    .eq('user_id', userId)
    .eq('external_id', calendarId)
    .single();

  if (!calendar) {
    // Create calendar if it doesn't exist
    const { data: newCalendar, error: calendarError } = await supabase
      .from('calendar_calendars')
      .insert({
        user_id: userId,
        external_id: calendarId,
        name: calendarId === 'primary' ? 'Primary Calendar' : calendarId,
        is_primary: calendarId === 'primary',
      })
      .select()
      .single();

    if (calendarError) {
      console.error('[Calendar Sync] Failed to create calendar:', calendarError);
      throw calendarError;
    }
    
    calendar.id = newCalendar.id;
  }

  for (const event of events) {
    try {
      // Skip cancelled events unless we're updating an existing one
      if (event.status === 'cancelled') {
        // Mark as deleted if it exists
        const { error } = await supabase
          .from('calendar_events')
          .update({ sync_status: 'deleted', updated_at: new Date().toISOString() })
          .eq('external_id', event.id)
          .eq('user_id', userId);
        
        if (!error) stats.deleted++;
        continue;
      }

      // Parse dates
      const startTime = event.start?.dateTime 
        ? new Date(event.start.dateTime)
        : event.start?.date 
          ? new Date(event.start.date + 'T00:00:00Z')
          : null;

      const endTime = event.end?.dateTime
        ? new Date(event.end.dateTime)
        : event.end?.date
          ? new Date(event.end.date + 'T00:00:00Z')
          : startTime;

      if (!startTime || !endTime) {
        console.warn(`[Calendar Sync] Skipping event without valid dates: ${event.id}`);
        stats.skipped++;
        continue;
      }

      const eventData = {
        external_id: event.id,
        calendar_id: calendar.id,
        user_id: userId,
        title: event.summary || '(No title)',
        description: event.description || null,
        location: event.location || null,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        all_day: !event.start?.dateTime,
        status: event.status === 'tentative' ? 'tentative' : 'confirmed',
        visibility: event.visibility || 'default',
        busy_status: event.transparency === 'transparent' ? 'free' : 'busy',
        meeting_url: event.hangoutLink || null,
        color: event.colorId || null,
        attendees_count: event.attendees?.length || 0,
        external_updated_at: event.updated ? new Date(event.updated).toISOString() : null,
        etag: event.etag,
        html_link: event.htmlLink,
        hangout_link: event.hangoutLink || null,
        creator_email: event.creator?.email || null,
        organizer_email: event.organizer?.email || null,
        transparency: event.transparency || 'opaque',
        recurrence_rule: event.recurrence ? event.recurrence[0] : null,
        raw_data: event,
        sync_status: 'synced',
        updated_at: new Date().toISOString(),
      };

      // Check if event exists
      const { data: existingEvent } = await supabase
        .from('calendar_events')
        .select('id, etag')
        .eq('external_id', event.id)
        .eq('user_id', userId)
        .single();

      if (existingEvent) {
        // Update only if etag changed
        if (existingEvent.etag !== event.etag) {
          const { error } = await supabase
            .from('calendar_events')
            .update(eventData)
            .eq('id', existingEvent.id);

          if (error) {
            console.error(`[Calendar Sync] Failed to update event ${event.id}:`, error);
            stats.skipped++;
          } else {
            stats.updated++;
          }
        } else {
          stats.skipped++;
        }
      } else {
        // Create new event
        const { error } = await supabase
          .from('calendar_events')
          .insert(eventData);

        if (error) {
          console.error(`[Calendar Sync] Failed to create event ${event.id}:`, error);
          stats.skipped++;
        } else {
          stats.created++;

          // Also create attendees
          if (event.attendees && event.attendees.length > 0) {
            const attendeesData = event.attendees.map(attendee => ({
              event_id: eventData.external_id,
              email: attendee.email,
              name: attendee.displayName || null,
              is_organizer: attendee.organizer || false,
              is_required: !attendee.optional,
              response_status: attendee.responseStatus || 'needsAction',
            }));

            await supabase
              .from('calendar_attendees')
              .insert(attendeesData)
              .select();
          }
        }
      }
    } catch (error) {
      console.error(`[Calendar Sync] Error processing event ${event.id}:`, error);
      stats.skipped++;
    }
  }

  return stats;
}

serve(async (req) => {
  console.log('[Calendar Sync] Request method:', req.method);
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Verify the JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[Calendar Sync] User verification failed:', userError);
      throw new Error('Invalid authentication token');
    }

    console.log('[Calendar Sync] User verified:', user.id);

    // Parse request body
    const requestBody: SyncRequest = await req.json();
    const { action, calendarId = 'primary', startDate, endDate } = requestBody;

    // Get user's Google integration
    const { data: integration, error: integrationError } = await supabase
      .from('google_integrations')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.error('[Calendar Sync] No active Google integration found:', integrationError);
      throw new Error('Google integration not found. Please connect your Google account first.');
    }

    // Check if token needs refresh
    const expiresAt = new Date(integration.expires_at);
    const now = new Date();
    let accessToken = integration.access_token;
    
    if (expiresAt <= now) {
      console.log('[Calendar Sync] Token expired, refreshing...');
      accessToken = await refreshAccessToken(integration.refresh_token, supabase, user.id);
    }

    // Create sync log entry
    const { data: syncLog, error: syncLogError } = await supabase
      .from('calendar_sync_logs')
      .insert({
        user_id: user.id,
        sync_type: action === 'sync-full' ? 'full' : action === 'sync-incremental' ? 'incremental' : 'historical',
        sync_status: 'started',
        metadata: { calendarId, startDate, endDate },
      })
      .select()
      .single();

    if (syncLogError) {
      console.error('[Calendar Sync] Failed to create sync log:', syncLogError);
      throw new Error('Failed to create sync log');
    }

    // Get the calendar's sync token for incremental sync
    let syncToken = null;
    if (action === 'sync-incremental') {
      const { data: calendar } = await supabase
        .from('calendar_calendars')
        .select('last_sync_token')
        .eq('user_id', user.id)
        .eq('external_id', calendarId)
        .single();
      
      syncToken = calendar?.last_sync_token;
    }

    // Perform the sync
    let allEvents: GoogleEvent[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;
    let totalStats = { created: 0, updated: 0, deleted: 0, skipped: 0 };

    // Set time range for historical sync
    let timeMin = startDate;
    let timeMax = endDate;
    
    if (action === 'sync-historical' && !timeMin) {
      // Default to 2 years of history
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      timeMin = twoYearsAgo.toISOString();
      timeMax = new Date().toISOString();
    }

    do {
      const response = await fetchGoogleCalendarEvents(
        accessToken,
        calendarId,
        syncToken,
        timeMin,
        timeMax,
        pageToken
      );

      if (response.items) {
        allEvents = allEvents.concat(response.items);
        
        // Process events in batches of 100
        if (allEvents.length >= 100) {
          const batch = allEvents.splice(0, 100);
          const stats = await syncEventsToDatabase(supabase, user.id, calendarId, batch, syncLog.id);
          totalStats.created += stats.created;
          totalStats.updated += stats.updated;
          totalStats.deleted += stats.deleted;
          totalStats.skipped += stats.skipped;
        }
      }

      pageToken = response.nextPageToken;
      nextSyncToken = response.nextSyncToken;
    } while (pageToken);

    // Process remaining events
    if (allEvents.length > 0) {
      const stats = await syncEventsToDatabase(supabase, user.id, calendarId, allEvents, syncLog.id);
      totalStats.created += stats.created;
      totalStats.updated += stats.updated;
      totalStats.deleted += stats.deleted;
      totalStats.skipped += stats.skipped;
    }

    // Update calendar with new sync token and timestamp
    if (nextSyncToken) {
      await supabase
        .from('calendar_calendars')
        .update({
          last_sync_token: nextSyncToken,
          last_synced_at: new Date().toISOString(),
          historical_sync_completed: action === 'sync-historical' ? true : undefined,
        })
        .eq('user_id', user.id)
        .eq('external_id', calendarId);
    }

    // Update sync log with results
    await supabase
      .from('calendar_sync_logs')
      .update({
        sync_status: 'completed',
        events_created: totalStats.created,
        events_updated: totalStats.updated,
        events_deleted: totalStats.deleted,
        events_skipped: totalStats.skipped,
        sync_token_after: nextSyncToken,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLog.id);

    console.log('[Calendar Sync] Sync completed:', totalStats);

    return new Response(
      JSON.stringify({
        success: true,
        stats: totalStats,
        syncToken: nextSyncToken,
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );

  } catch (error) {
    console.error('[Calendar Sync] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: 'Calendar sync error'
      }),
      {
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );
  }
});