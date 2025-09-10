import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface CreateEventRequest {
  calendarId?: string;
  summary: string;
  description?: string;
  startTime: string; // ISO 8601 format
  endTime: string;   // ISO 8601 format
  attendees?: string[];
  location?: string;
}

interface ListEventsRequest {
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}

interface UpdateEventRequest {
  calendarId: string;
  eventId: string;
  summary?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  attendees?: string[];
  location?: string;
}

serve(async (req) => {
  console.log('[Google Calendar] Request method:', req.method);
  console.log('[Google Calendar] Request URL:', req.url);
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
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
      console.error('[Google Calendar] User verification failed:', userError);
      throw new Error('Invalid authentication token');
    }

    console.log('[Google Calendar] User verified:', user.id);

    // Get user's Google integration
    const { data: integration, error: integrationError } = await supabase
      .from('google_integrations')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.error('[Google Calendar] No active Google integration found:', integrationError);
      throw new Error('Google integration not found. Please connect your Google account first.');
    }

    // Check if token needs refresh
    const expiresAt = new Date(integration.expires_at);
    const now = new Date();
    if (expiresAt <= now) {
      // TODO: Implement token refresh logic
      throw new Error('Access token expired. Token refresh not yet implemented.');
    }

    // Parse request based on method and URL
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    let requestBody: any = {};
    if (req.method === 'POST') {
      requestBody = await req.json();
    }

    let response;

    switch (action) {
      case 'create-event':
        response = await createEvent(integration.access_token, requestBody as CreateEventRequest);
        break;
      
      case 'list-events':
        response = await listEvents(integration.access_token, requestBody as ListEventsRequest);
        break;
      
      case 'update-event':
        response = await updateEvent(integration.access_token, requestBody as UpdateEventRequest);
        break;
      
      case 'delete-event':
        response = await deleteEvent(integration.access_token, requestBody.calendarId, requestBody.eventId);
        break;
      
      case 'list-calendars':
        response = await listCalendars(integration.access_token);
        break;
      
      case 'availability':
        response = await checkAvailability(integration.access_token, requestBody);
        break;
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Log the successful operation
    await supabase
      .from('google_service_logs')
      .insert({
        integration_id: null, // We'd need to get this from the integration
        service: 'calendar',
        action: action || 'unknown',
        status: 'success',
        request_data: requestBody,
        response_data: { success: true },
      });

    return new Response(
      JSON.stringify(response),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );

  } catch (error) {
    console.error('[Google Calendar] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: 'Calendar service error'
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

async function createEvent(accessToken: string, request: CreateEventRequest): Promise<any> {
  console.log('[Google Calendar] Creating event:', request.summary);

  const calendarId = request.calendarId || 'primary';
  
  const eventData = {
    summary: request.summary,
    description: request.description,
    location: request.location,
    start: {
      dateTime: request.startTime,
      timeZone: 'UTC', // We should get this from user preferences
    },
    end: {
      dateTime: request.endTime,
      timeZone: 'UTC',
    },
    attendees: request.attendees?.map(email => ({ email })),
  };

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Google Calendar] Create event error:', errorData);
    throw new Error(`Calendar API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  console.log('[Google Calendar] Event created successfully:', data.id);
  
  return {
    success: true,
    eventId: data.id,
    htmlLink: data.htmlLink,
    hangoutLink: data.hangoutLink,
    startTime: data.start.dateTime,
    endTime: data.end.dateTime
  };
}

async function listEvents(accessToken: string, request: ListEventsRequest): Promise<any> {
  console.log('[Google Calendar] Listing events');

  const calendarId = request.calendarId || 'primary';
  const params = new URLSearchParams();
  
  if (request.timeMin) params.set('timeMin', request.timeMin);
  if (request.timeMax) params.set('timeMax', request.timeMax);
  if (request.maxResults) params.set('maxResults', request.maxResults.toString());
  params.set('singleEvents', 'true');
  params.set('orderBy', 'startTime');

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Google Calendar] List events error:', errorData);
    throw new Error(`Calendar API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  console.log('[Google Calendar] Found', data.items?.length || 0, 'events');
  
  return {
    events: data.items || [],
    nextSyncToken: data.nextSyncToken,
    timeZone: data.timeZone
  };
}

async function updateEvent(accessToken: string, request: UpdateEventRequest): Promise<any> {
  console.log('[Google Calendar] Updating event:', request.eventId);

  const updateData: any = {};
  if (request.summary) updateData.summary = request.summary;
  if (request.description) updateData.description = request.description;
  if (request.location) updateData.location = request.location;
  if (request.startTime) {
    updateData.start = {
      dateTime: request.startTime,
      timeZone: 'UTC',
    };
  }
  if (request.endTime) {
    updateData.end = {
      dateTime: request.endTime,
      timeZone: 'UTC',
    };
  }
  if (request.attendees) {
    updateData.attendees = request.attendees.map(email => ({ email }));
  }

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${request.calendarId}/events/${request.eventId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Google Calendar] Update event error:', errorData);
    throw new Error(`Calendar API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  console.log('[Google Calendar] Event updated successfully:', data.id);
  
  return {
    success: true,
    eventId: data.id,
    updated: data.updated
  };
}

async function deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<any> {
  console.log('[Google Calendar] Deleting event:', eventId);

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Google Calendar] Delete event error:', errorData);
    throw new Error(`Calendar API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  console.log('[Google Calendar] Event deleted successfully');
  
  return {
    success: true,
    deleted: true
  };
}

async function listCalendars(accessToken: string): Promise<any> {
  console.log('[Google Calendar] Listing calendars');

  const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Google Calendar] List calendars error:', errorData);
    throw new Error(`Calendar API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  console.log('[Google Calendar] Found', data.items?.length || 0, 'calendars');
  
  return {
    calendars: data.items || []
  };
}

async function checkAvailability(accessToken: string, request: any): Promise<any> {
  console.log('[Google Calendar] Checking availability');

  const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin: request.timeMin,
      timeMax: request.timeMax,
      items: [{ id: request.calendarId || 'primary' }]
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Google Calendar] Check availability error:', errorData);
    throw new Error(`Calendar API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  console.log('[Google Calendar] Availability checked successfully');
  
  return {
    timeMin: data.timeMin,
    timeMax: data.timeMax,
    calendars: data.calendars
  };
}