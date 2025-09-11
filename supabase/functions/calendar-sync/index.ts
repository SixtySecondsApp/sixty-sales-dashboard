import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

async function refreshAccessToken(refreshToken: string, supabase: any, userId: string): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID') || '';
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Failed to refresh token: ${errorData.error_description || 'Unknown error'}`);
  }

  const data = await response.json();

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 3600));

  const { error: updateError } = await supabase
    .from('google_integrations')
    .update({
      access_token: data.access_token,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (updateError) {
    throw new Error('Failed to update access token in database');
  }

  return data.access_token;
}

type SyncAction = 'sync-full' | 'sync-incremental' | 'sync-historical';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const sb = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await sb.auth.getUser(token);
    if (userError || !user) throw new Error('Invalid authentication token');

    const body = await req.json().catch(() => ({}));
    const action: SyncAction = body.action || 'sync-incremental';
    const calendarId: string = body.calendarId || 'primary';
    const startDate: string | undefined = body.startDate;
    const endDate: string | undefined = body.endDate;

    // Get integration tokens
    const { data: integration, error: integrationError } = await sb
      .from('google_integrations')
      .select('id, access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      throw new Error('Google integration not found. Please connect your Google account first.');
    }

    // Ensure access token is valid
    let accessToken: string = integration.access_token;
    const expiresAt = new Date(integration.expires_at);
    if (isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      accessToken = await refreshAccessToken(integration.refresh_token, sb, user.id);
    }

    // Ensure calendar record exists
    const { data: calRecord } = await sb
      .from('calendar_calendars')
      .upsert({
        user_id: user.id,
        external_id: calendarId,
        sync_enabled: true,
      }, { onConflict: 'user_id,external_id' })
      .select('id, last_sync_token, historical_sync_completed')
      .single();

    const calendarRecordId = calRecord?.id || null;
    
    if (!calendarRecordId) {
      console.error('Failed to get/create calendar record');
      throw new Error('Calendar record not found');
    }
    
    console.log('Using calendar record:', { calendarId, calendarRecordId });

    // Create sync log (started)
    const { data: logRow } = await sb
      .from('calendar_sync_logs')
      .insert({
        user_id: user.id,
        calendar_id: calendarRecordId,
        sync_type: action === 'sync-historical' ? 'historical' : (action === 'sync-full' ? 'full' : 'incremental'),
        sync_status: 'started',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    const logId = logRow?.id;

    // Compute time range for historical or provided range
    let timeMin: string | undefined = startDate;
    let timeMax: string | undefined = endDate;
    if (action === 'sync-historical') {
      const now = new Date();
      const min = new Date(now);
      min.setDate(min.getDate() - 90);
      const max = new Date(now);
      max.setDate(max.getDate() + 180);
      timeMin = timeMin || min.toISOString();
      timeMax = timeMax || max.toISOString();
    }

    // Fetch events from Google Calendar
    const stats = { created: 0, updated: 0, deleted: 0 } as Record<string, number>;

    // Basic incremental approach: if we have a last_sync_token, try to use it
    let nextPageToken: string | undefined = undefined;
    let nextSyncToken: string | undefined = undefined;

    for (let page = 0; page < 50; page++) { // safety cap
      const params = new URLSearchParams();
      params.set('singleEvents', 'true');
      params.set('orderBy', 'startTime');
      if (nextPageToken) params.set('pageToken', nextPageToken);

      if (action === 'sync-incremental' && calRecord?.last_sync_token) {
        params.set('syncToken', calRecord.last_sync_token);
      } else {
        if (timeMin) params.set('timeMin', timeMin);
        if (timeMax) params.set('timeMax', timeMax);
      }

      const resp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (resp.status === 410) {
        // syncToken expired, fallback to full time-bound sync
        nextPageToken = undefined;
        timeMin = new Date(Date.now() - 90 * 86400000).toISOString();
        timeMax = new Date(Date.now() + 180 * 86400000).toISOString();
        continue;
      }

      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(`Google Calendar error: ${e?.error?.message || resp.statusText}`);
      }

      const data = await resp.json();
      const items = data.items || [];
      nextPageToken = data.nextPageToken;
      nextSyncToken = data.nextSyncToken || nextSyncToken;

      // Upsert events into calendar_events
      for (const ev of items) {
        try {
          // Skip cancelled events by marking as deleted
          const isCancelled = ev.status === 'cancelled';

          const payload: any = {
            user_id: user.id,
            calendar_id: calendarRecordId, // CRITICAL: Add the calendar reference!
            external_id: ev.id,
            title: ev.summary || '(No title)',
            description: ev.description || null,
            location: ev.location || null,
            start_time: ev.start?.dateTime || ev.start?.date || new Date().toISOString(),
            end_time: ev.end?.dateTime || ev.end?.date || ev.start?.dateTime || new Date().toISOString(),
            all_day: !ev.start?.dateTime,
            status: ev.status || 'confirmed',
            meeting_url: ev.hangoutLink || null,
            attendees_count: Array.isArray(ev.attendees) ? ev.attendees.length : 0,
            color: ev.colorId || null,
            creator_email: ev.creator?.email || null,
            organizer_email: ev.organizer?.email || null,
            html_link: ev.htmlLink || null,
            etag: ev.etag || null,
            external_updated_at: ev.updated ? new Date(ev.updated).toISOString() : null,
            sync_status: isCancelled ? 'deleted' : 'synced',
            raw_data: ev,
          };

          const { data: upserted, error: upsertError } = await sb
            .from('calendar_events')
            .upsert(payload, { onConflict: 'external_id,user_id' })
            .select('id');

          if (upsertError) {
            // Log detailed error for debugging
            console.error('Failed to upsert event:', {
              eventId: ev.id,
              title: ev.summary,
              error: upsertError.message,
              details: upsertError
            });
            continue;
          }

          // Count stats roughly (created vs updated not perfectly known without inspect)
          stats.created += 1;
        } catch (err) {
          // Log individual item errors for debugging
          console.error('Error processing event:', err);
        }
      }

      if (!nextPageToken) break;
    }

    // Update calendar record with last_sync_token and mark historical complete if needed
    const updates: any = { last_synced_at: new Date().toISOString() };
    if (nextSyncToken) updates.last_sync_token = nextSyncToken;
    if (action === 'sync-historical') updates.historical_sync_completed = true;
    await sb.from('calendar_calendars').update(updates).eq('user_id', user.id).eq('external_id', calendarId);

    // Finish sync log
    if (logId) {
      await sb
        .from('calendar_sync_logs')
        .update({
          sync_status: 'completed',
          completed_at: new Date().toISOString(),
          events_created: stats.created,
          events_updated: stats.updated,
          events_deleted: stats.deleted,
        })
        .eq('id', logId);
    }

    return new Response(
      JSON.stringify({ success: true, stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message || 'Sync error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
