/// <reference path="../deno.d.ts" />

/**
 * Google Calendar Sync Edge Function
 * 
 * Incremental sync of Google Calendar events with user_sync_status tracking
 * Designed to be called from api-copilot when calendar queries need fresh data
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { getGoogleIntegration } from '../_shared/googleOAuth.ts';

interface SyncRequest {
  action: 'incremental-sync';
  syncToken?: string;
  startDate?: string;
  endDate?: string;
  userId?: string; // For internal service role calls
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const authHeader = req.headers.get('Authorization');
    const isInternalCall = req.headers.get('X-Internal-Call') === 'true';
    
    // Parse body once
    const body: SyncRequest = await req.json();
    
    let user: any;
    
    // Handle internal service role calls
    if (isInternalCall && authHeader?.includes(supabaseServiceKey)) {
      if (!body.userId) {
        return new Response(
          JSON.stringify({ error: 'userId required for internal calls' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // For internal calls, use userId directly
      user = { id: body.userId };
    } else {
      // Standard user JWT authentication
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Authorization header with Bearer token required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const jwt = authHeader.replace('Bearer ', '');
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: { Authorization: authHeader },
        },
        auth: {
          persistSession: false,
        },
      });

      // Get user from JWT
      const { data: userData, error: authError } = await authClient.auth.getUser(jwt);
      if (authError || !userData) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired authentication token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      user = userData;
    }

    // Create service role client for database operations
    const client = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const { syncToken, startDate, endDate } = body;

    // Get or create user sync status
    let { data: syncStatus } = await client
      .from('user_sync_status')
      .select('calendar_sync_token, calendar_last_synced_at')
      .eq('user_id', user.id)
      .single();

    if (!syncStatus) {
      // Create initial sync status record
      const { data: newStatus } = await client
        .from('user_sync_status')
        .insert({
          user_id: user.id,
          calendar_last_synced_at: null,
          calendar_sync_token: null,
        })
        .select()
        .single();
      syncStatus = newStatus;
    }

    // Get Google OAuth tokens
    const { accessToken } = await getGoogleIntegration(client, user.id);

    // Determine sync parameters
    const calendarId = 'primary'; // Default to primary calendar
    let currentSyncToken = syncToken || syncStatus?.calendar_sync_token || undefined;
    let timeMin =
      startDate ||
      (currentSyncToken ? undefined : new Date(Date.now() - 90 * 86400000).toISOString());
    let timeMax =
      endDate ||
      (currentSyncToken ? undefined : new Date(Date.now() + 180 * 86400000).toISOString());

    // Get user's organization ID (optional - for future multi-tenancy support)
    // NOTE: Multi-tenancy not yet implemented, so org_id can be null
    let orgId: string | null = null;
    try {
      const { data: orgMembership } = await client
        .from('organization_memberships')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (orgMembership?.org_id) {
        orgId = orgMembership.org_id;
      } else {
        // Try to get default org
        const { data: defaultOrg } = await client
          .from('organizations')
          .select('id')
          .eq('is_default', true)
          .limit(1)
          .maybeSingle();
        orgId = defaultOrg?.id || null;
      }
    } catch (error) {
      console.error('[CALENDAR-SYNC] Failed to get org_id:', error);
      // Continue - org_id is optional for single-tenant mode
    }

    console.log('[CALENDAR-SYNC] org_id status:', {
      found: !!orgId,
      value: orgId,
      note: 'org_id is optional for single-tenant operation'
    });

    // Fetch calendar metadata to get timezone and name
    let detectedTimezone: string | null = null;
    let calendarName: string = 'Primary Calendar';
    try {
      const calendarMetaResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (calendarMetaResponse.ok) {
        const calendarMeta = await calendarMetaResponse.json();
        detectedTimezone = calendarMeta.timeZone || null;
        calendarName = calendarMeta.summary || calendarMeta.id || 'Primary Calendar';
        console.log('[CALENDAR-SYNC] Detected calendar metadata:', {
          name: calendarName,
          timezone: detectedTimezone
        });
      }
    } catch (error) {
      console.error('[CALENDAR-SYNC] Failed to fetch calendar metadata:', error);
      // Continue without metadata - will use defaults
    }

    // Ensure calendar record exists and update timezone if detected
    const calendarPayload: any = {
      user_id: user.id,
      external_id: calendarId,
      name: calendarName, // Required field
      sync_enabled: true,
    };
    if (detectedTimezone) {
      calendarPayload.timezone = detectedTimezone;
    }
    if (orgId) {
      calendarPayload.org_id = orgId;
    }

    // Try to find existing calendar first
    let calRecord: any = null;
    let queryBuilder = client
      .from('calendar_calendars')
      .select('id, timezone')
      .eq('user_id', user.id)
      .eq('external_id', calendarId);
    
    if (orgId) {
      queryBuilder = queryBuilder.eq('org_id', orgId);
    }
    
    const { data: existingCal } = await queryBuilder.maybeSingle();

    if (existingCal?.id) {
      // Update existing calendar
      const updatePayload: any = {
        name: calendarName,
        sync_enabled: true,
      };
      if (detectedTimezone) {
        updatePayload.timezone = detectedTimezone;
      }
      if (orgId && !existingCal.org_id) {
        updatePayload.org_id = orgId;
      }

      const { data: updatedCal, error: updateError } = await client
        .from('calendar_calendars')
        .update(updatePayload)
        .eq('id', existingCal.id)
        .select('id, timezone')
        .single();

      if (updateError || !updatedCal?.id) {
        console.error('[CALENDAR-SYNC] Update error:', updateError);
        throw new Error(`Failed to update calendar record: ${updateError?.message || 'Unknown error'}`);
      }
      calRecord = updatedCal;
    } else {
      // Insert new calendar
      const { data: insertedCal, error: insertError } = await client
        .from('calendar_calendars')
        .insert(calendarPayload)
        .select('id, timezone')
        .single();

      if (insertError || !insertedCal?.id) {
        console.error('[CALENDAR-SYNC] Insert error:', insertError);
        throw new Error(`Failed to create calendar record: ${insertError?.message || 'Unknown error'}. Payload: ${JSON.stringify(calendarPayload)}`);
      }
      calRecord = insertedCal;
    }

    if (!calRecord?.id) {
      throw new Error('Failed to create or find calendar record');
    }

    const calendarRecordId = calRecord.id;

    // Update user timezone preference if we detected a timezone
    if (detectedTimezone) {
      try {
        // Update user_settings preferences
        await client
          .from('user_settings')
          .upsert(
            {
              user_id: user.id,
              preferences: { timezone: detectedTimezone },
            },
            { onConflict: 'user_id' }
          )
          .select();
        console.log('[CALENDAR-SYNC] Updated user timezone preference:', detectedTimezone);
      } catch (error) {
        console.error('[CALENDAR-SYNC] Failed to update user timezone preference:', error);
        // Non-critical - continue with sync
      }
    }
    const stats = { created: 0, updated: 0, deleted: 0, skipped: 0 };
    let nextPageToken: string | undefined = undefined;
    let nextSyncToken: string | undefined = undefined;
    const now = new Date().toISOString();

    // Fetch events from Google Calendar API
    for (let page = 0; page < 50; page++) {
      // Safety cap to prevent infinite loops
      const params = new URLSearchParams();
      params.set('singleEvents', 'true');
      params.set('orderBy', 'startTime');
      params.set('maxResults', '2500'); // Google's max per page

      if (nextPageToken) {
        params.set('pageToken', nextPageToken);
      }

      if (currentSyncToken) {
        params.set('syncToken', currentSyncToken);
      } else {
        if (timeMin) params.set('timeMin', timeMin);
        if (timeMax) params.set('timeMax', timeMax);
      }

      const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
      const resp = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (resp.status === 410) {
        console.warn('[CALENDAR-SYNC] Sync token expired (410). Falling back to time-based sync.');
        nextPageToken = undefined;
        currentSyncToken = undefined;
        timeMin = new Date(Date.now() - 90 * 86400000).toISOString();
        timeMax = new Date(Date.now() + 180 * 86400000).toISOString();
        continue;
      }

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        console.error('[CALENDAR-SYNC] Google API error response', {
          status: resp.status,
          statusText: resp.statusText,
          error: errorData?.error || errorData,
          params: Object.fromEntries(params),
        });

        const errorMessage = errorData?.error?.message || resp.statusText;
        const looksLikeSyncTokenError =
          !!currentSyncToken &&
          typeof errorMessage === 'string' &&
          errorMessage.toLowerCase().includes('sync token');

        if (resp.status === 400 && looksLikeSyncTokenError) {
          console.warn('[CALENDAR-SYNC] Invalid sync token detected (400). Resetting token.');
          currentSyncToken = undefined;
          nextPageToken = undefined;
          timeMin = new Date(Date.now() - 90 * 86400000).toISOString();
          timeMax = new Date(Date.now() + 180 * 86400000).toISOString();
          continue;
        }

        throw new Error(`Google Calendar API error: ${errorMessage}`);
      }

      const data = await resp.json();
      const items = data.items || [];
      nextPageToken = data.nextPageToken;
      nextSyncToken = data.nextSyncToken || nextSyncToken;

      // Process events
      for (const ev of items) {
        try {
          const isCancelled = ev.status === 'cancelled';

          const payload: any = {
            user_id: user.id,
            calendar_id: calendarRecordId,
            external_id: ev.id,
            title: ev.summary || '(No title)',
            description: ev.description || null,
            location: ev.location || null,
            start_time: ev.start?.dateTime || ev.start?.date || now,
            end_time: ev.end?.dateTime || ev.end?.date || ev.start?.dateTime || now,
            all_day: !ev.start?.dateTime,
            status: ev.status || 'confirmed',
            meeting_url: ev.hangoutLink || null,
            attendees_count: Array.isArray(ev.attendees) ? ev.attendees.length : 0,
            color: ev.colorId || null,
            creator_email: ev.creator?.email || null,
            organizer_email: ev.organizer?.email || null,
            html_link: ev.htmlLink || null,
            hangout_link: ev.hangoutLink || null,
            etag: ev.etag || null,
            external_updated_at: ev.updated ? new Date(ev.updated).toISOString() : null,
            sync_status: isCancelled ? 'deleted' : 'synced',
            synced_at: now,
            raw_data: ev,
          };

          // Include org_id if available (optional - for future multi-tenancy)
          // NOTE: org_id is nullable in database, safe to omit for single-tenant mode
          if (orgId) {
            payload.org_id = orgId;
          }

          // Try upsert with ON CONFLICT first (works if migration is applied)
          // Fallback to manual check/update/insert if ON CONFLICT fails
          let upsertedEvent: any = null;
          let upsertError: any = null;

          // Always try upsert first, even without org_id
          const result = await client
            .from('calendar_events')
            .upsert(payload, { onConflict: 'user_id,external_id' })
            .select('id')
            .single();
          upsertedEvent = result.data;
          upsertError = result.error;

          // If ON CONFLICT failed (likely migration not applied or constraint issue), use manual upsert
          if (upsertError && (upsertError.code === '42P10' || upsertError.message?.includes('ON CONFLICT'))) {
            // Fallback: Check if event exists, then update or insert
            const { data: existing, error: checkError } = await client
              .from('calendar_events')
              .select('id')
              .eq('user_id', user.id)
              .eq('external_id', ev.id)
              .maybeSingle();

            if (checkError) {
              console.error('Error checking for existing event:', checkError);
              upsertError = checkError;
            } else if (existing) {
              // Update existing event
              const { data, error } = await client
                .from('calendar_events')
                .update(payload)
                .eq('id', existing.id)
                .select('id')
                .single();
              upsertedEvent = data;
              upsertError = error;
              if (error) {
                console.error('Error updating existing event:', error);
              }
            } else {
              // Insert new event
              const { data, error } = await client
                .from('calendar_events')
                .insert(payload)
                .select('id')
                .single();
              upsertedEvent = data;
              upsertError = error;
              if (error) {
                console.error('Error inserting new event:', error);
              }
            }
          }

          if (upsertError || !upsertedEvent) {
            // Improved error logging with full context
            console.error('[CALENDAR-SYNC] Failed to upsert event:', {
              // Error details
              errorObject: upsertError,
              errorType: typeof upsertError,
              errorCode: upsertError?.code,
              errorMessage: upsertError?.message,
              errorDetails: upsertError?.details,
              errorHint: upsertError?.hint,
              // Event context
              eventId: ev.id,
              eventTitle: ev.summary,
              eventStart: ev.start?.dateTime || ev.start?.date,
              // Payload context
              userId: user.id,
              calendarId: calendarRecordId,
              hasOrgId: !!orgId,
              orgId: orgId,
              // Helpful debug info
              payloadKeys: Object.keys(payload),
              hasUpsertedEvent: !!upsertedEvent,
              // Full error serialization
              errorSerialized: JSON.stringify(upsertError, null, 2)
            });
            stats.skipped++;
            continue;
          }

          const eventDbId = upsertedEvent.id;

          // Track stats (rough estimate - we don't know if it was created or updated)
          if (isCancelled) {
            stats.deleted++;
          } else {
            stats.created++;
          }

          // Upsert attendees
          if (Array.isArray(ev.attendees) && ev.attendees.length > 0) {
            for (const attendee of ev.attendees) {
              await client
                .from('calendar_attendees')
                .upsert(
                  {
                    event_id: eventDbId,
                    email: attendee.email,
                    name: attendee.displayName || null,
                    is_organizer: attendee.organizer === true,
                    is_required: attendee.optional !== true,
                    response_status: attendee.responseStatus || 'needsAction',
                    responded_at: attendee.responseStatus !== 'needsAction' ? now : null,
                  },
                  { onConflict: 'event_id,email' }
                )
                .catch(() => {
                  // Silently fail attendee upserts - event is more important
                });
            }
          }
        } catch (err) {
          console.error('Error processing event:', err);
          stats.skipped++;
        }
      }

      if (!nextPageToken) break;
    }

    // Update user_sync_status with new sync token and timestamp
    const updatePayload: any = {
      calendar_last_synced_at: now,
      updated_at: now,
    };
    if (nextSyncToken) {
      updatePayload.calendar_sync_token = nextSyncToken;
    }

    await client
      .from('user_sync_status')
      .update(updatePayload)
      .eq('user_id', user.id);

    // Also update calendar_calendars for backward compatibility
    await client
      .from('calendar_calendars')
      .update({
        last_synced_at: now,
        last_sync_token: nextSyncToken || undefined,
      })
      .eq('id', calendarRecordId);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        syncToken: nextSyncToken,
        syncedAt: now,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Calendar sync error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Calendar sync failed',
        details: error.stack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

