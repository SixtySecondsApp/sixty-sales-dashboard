/**
 * MeetingBaaS Connect Calendar
 *
 * Connects a user's Google Calendar to MeetingBaaS using their existing OAuth credentials.
 * This enables automatic bot deployment for calendar events.
 */

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { legacyCorsHeaders as corsHeaders } from '../_shared/corsHelper.ts';
import { captureException, addBreadcrumb } from '../_shared/sentryEdge.ts';

// =============================================================================
// Types
// =============================================================================

interface ConnectCalendarRequest {
  user_id: string;
  calendar_id?: string; // Default: 'primary'
  access_token?: string; // Optional fallback access token from frontend
}

interface MeetingBaaSCalendarResponse {
  id: string;
  platform: string;
  raw_calendar_id: string;
  name?: string;
  email?: string;
  created_at: string;
}

// =============================================================================
// MeetingBaaS API
// =============================================================================

const MEETINGBAAS_API_BASE = 'https://api.meetingbaas.com/v2';

async function createMeetingBaaSCalendar(
  apiKey: string,
  params: {
    oauth_client_id: string;
    oauth_client_secret: string;
    oauth_refresh_token: string;
    raw_calendar_id: string;
    calendar_platform: 'google' | 'microsoft';
  }
): Promise<{ data?: MeetingBaaSCalendarResponse; error?: string }> {
  try {
    console.log('[MeetingBaaS API] Creating calendar with params:', {
      raw_calendar_id: params.raw_calendar_id,
      calendar_platform: params.calendar_platform,
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length,
      hasClientId: !!params.oauth_client_id,
      hasClientSecret: !!params.oauth_client_secret,
      hasRefreshToken: !!params.oauth_refresh_token,
    });

    // MeetingBaaS API uses x-meeting-baas-api-key header, not Bearer token
    const response = await fetch(`${MEETINGBAAS_API_BASE}/calendars`, {
      method: 'POST',
      headers: {
        'x-meeting-baas-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();
    console.log('[MeetingBaaS API] Response:', {
      status: response.status,
      ok: response.ok,
      data: JSON.stringify(data).substring(0, 500),
    });

    if (!response.ok) {
      return { error: data.message || data.error || `HTTP ${response.status}` };
    }

    return { data };
  } catch (error) {
    console.error('[MeetingBaaS API] Exception:', error);
    return { error: error instanceof Error ? error.message : 'Network error' };
  }
}

async function listMeetingBaaSCalendars(
  apiKey: string
): Promise<{ data?: MeetingBaaSCalendarResponse[]; error?: string }> {
  try {
    const response = await fetch(`${MEETINGBAAS_API_BASE}/calendars`, {
      method: 'GET',
      headers: {
        'x-meeting-baas-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || `HTTP ${response.status}` };
    }

    return { data: data.calendars || data };
  } catch (error) {
    console.error('[MeetingBaaS API] List calendars exception:', error);
    return { error: error instanceof Error ? error.message : 'Network error' };
  }
}

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const meetingbaasApiKey = Deno.env.get('MEETINGBAAS_API_KEY') ?? '';
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
    const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';

    if (!meetingbaasApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'MeetingBaaS API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!googleClientId || !googleClientSecret) {
      return new Response(
        JSON.stringify({ success: false, error: 'Google OAuth credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get request body
    const body: ConnectCalendarRequest = await req.json();
    const { user_id, calendar_id = 'primary', access_token: fallbackAccessToken } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    addBreadcrumb(`Connecting calendar for user: ${user_id}`, 'meetingbaas');

    // Get user's Google integration
    const { data: googleIntegration, error: googleError } = await supabase
      .from('google_integrations')
      .select('refresh_token, email, is_active')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .maybeSingle();

    console.log('[MeetingBaaS Connect] Google integration lookup:', {
      found: !!googleIntegration,
      hasRefreshToken: !!googleIntegration?.refresh_token,
      error: googleError?.message,
      hasFallbackToken: !!fallbackAccessToken,
    });

    // Check if we have a refresh token (needed for MeetingBaaS)
    let refreshToken = googleIntegration?.refresh_token;
    let userEmail = googleIntegration?.email;

    if (!refreshToken) {
      // If we don't have a stored refresh token, provide helpful error
      console.warn('[MeetingBaaS Connect] No refresh token available for user:', user_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Google Calendar refresh token not found. Please reconnect Google Calendar with offline access enabled.',
          recovery: 'Visit the Integrations page and reconnect your Google Calendar to enable automatic recording setup.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if calendar already connected to MeetingBaaS
    const { data: existingConnection } = await supabase
      .from('meetingbaas_calendars')
      .select('id, meetingbaas_calendar_id')
      .eq('user_id', user_id)
      .eq('raw_calendar_id', calendar_id)
      .maybeSingle();

    if (existingConnection?.meetingbaas_calendar_id) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Calendar already connected to MeetingBaaS',
          calendar_id: existingConnection.meetingbaas_calendar_id
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create calendar in MeetingBaaS
    const { data: mbCalendar, error: mbError } = await createMeetingBaaSCalendar(
      meetingbaasApiKey,
      {
        oauth_client_id: googleClientId,
        oauth_client_secret: googleClientSecret,
        oauth_refresh_token: googleIntegration.refresh_token,
        raw_calendar_id: calendar_id,
        calendar_platform: 'google',
      }
    );

    if (mbError || !mbCalendar) {
      console.error('[MeetingBaaS Connect] Failed to create calendar:', mbError);
      return new Response(
        JSON.stringify({ success: false, error: mbError || 'Failed to connect calendar' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's org_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user_id)
      .single();

    const orgId = profile?.org_id;

    // Generate webhook token for the org if it doesn't exist
    let webhookToken: string | null = null;
    if (orgId) {
      const { data: org } = await supabase
        .from('organizations')
        .select('recording_settings')
        .eq('id', orgId)
        .single();

      const currentSettings = org?.recording_settings || {};
      webhookToken = currentSettings.webhook_token;

      // Generate a new webhook token if one doesn't exist
      if (!webhookToken) {
        webhookToken = crypto.randomUUID();

        const { error: updateError } = await supabase
          .from('organizations')
          .update({
            recording_settings: {
              ...currentSettings,
              webhook_token: webhookToken,
              meetingbaas_enabled: true,
            }
          })
          .eq('id', orgId);

        if (updateError) {
          console.error('[MeetingBaaS Connect] Failed to save webhook token:', updateError);
        } else {
          console.log(`[MeetingBaaS Connect] Generated webhook token for org ${orgId}`);
        }
      }
    }

    // Store the connection in our database
    const { error: insertError } = await supabase
      .from('meetingbaas_calendars')
      .upsert({
        user_id,
        org_id: orgId,
        meetingbaas_calendar_id: mbCalendar.id,
        raw_calendar_id: calendar_id,
        platform: 'google',
        email: googleIntegration.email || mbCalendar.email,
        name: mbCalendar.name,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,raw_calendar_id'
      });

    if (insertError) {
      console.error('[MeetingBaaS Connect] Failed to store connection:', insertError);
      // Don't fail - the MeetingBaaS connection is already made
    }

    // Build webhook URL for reference
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const webhookUrl = webhookToken
      ? `${supabaseUrl}/functions/v1/meetingbaas-webhook?token=${webhookToken}`
      : null;

    console.log(`[MeetingBaaS Connect] Calendar connected: ${mbCalendar.id} for user ${user_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Calendar connected to MeetingBaaS successfully',
        calendar: {
          id: mbCalendar.id,
          platform: mbCalendar.platform,
          raw_calendar_id: mbCalendar.raw_calendar_id,
          email: googleIntegration.email || mbCalendar.email,
        },
        webhook_url: webhookUrl,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[MeetingBaaS Connect] Error:', error);

    await captureException(error, {
      tags: {
        function: 'meetingbaas-connect-calendar',
        integration: 'meetingbaas',
      },
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
