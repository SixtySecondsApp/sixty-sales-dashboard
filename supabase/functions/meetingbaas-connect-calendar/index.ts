/**
 * MeetingBaaS Connect Calendar
 *
 * Connects a user's Google Calendar to MeetingBaaS using their existing OAuth credentials.
 * This enables automatic bot deployment for calendar events.
 */

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest, jsonResponse, errorResponse } from '../_shared/corsHelper.ts';
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
): Promise<{ data?: MeetingBaaSCalendarResponse; error?: string; errorData?: unknown }> {
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
      return {
        error: (data && (data.message || data.error)) || `HTTP ${response.status}`,
        errorData: data,
      };
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

    /**
     * MeetingBaaS API responses have varied over time.
     * Normalize to an array of calendars to avoid runtime crashes.
     */
    const calendarsCandidate =
      // common: { calendars: [...] }
      (data && typeof data === 'object' && 'calendars' in data ? (data as any).calendars : undefined) ??
      // sometimes: { data: [...] } or { data: { calendars: [...] } }
      (data && typeof data === 'object' && 'data' in data ? (data as any).data : undefined) ??
      // fallback: the response itself might be the array
      data;

    const calendars: MeetingBaaSCalendarResponse[] =
      Array.isArray(calendarsCandidate)
        ? calendarsCandidate
        : Array.isArray((calendarsCandidate as any)?.calendars)
          ? (calendarsCandidate as any).calendars
          : [];

    if (!Array.isArray(calendars)) {
      return { error: 'Unexpected MeetingBaaS calendars response format' };
    }

    return { data: calendars };
  } catch (error) {
    console.error('[MeetingBaaS API] List calendars exception:', error);
    return { error: error instanceof Error ? error.message : 'Network error' };
  }
}

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req) => {
  // Handle CORS preflight first (before any async operations)
  // This must be synchronous and never throw
  if (req.method === 'OPTIONS') {
    try {
      const preflightResponse = handleCorsPreflightRequest(req);
      if (preflightResponse) {
        return preflightResponse;
      }
      // Fallback if handleCorsPreflightRequest returns null (shouldn't happen)
      return new Response('ok', {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    } catch (error) {
      // Even if CORS helper fails, return a valid OPTIONS response
      console.error('[meetingbaas-connect-calendar] OPTIONS handler error:', error);
      return new Response('ok', {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }
  }

  console.log('[meetingbaas-connect-calendar] Request received:', {
    method: req.method,
    url: req.url,
    hasAuth: !!req.headers.get('authorization'),
    contentType: req.headers.get('content-type'),
  });

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const meetingbaasApiKey = Deno.env.get('MEETINGBAAS_API_KEY') ?? '';
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
    const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';

    console.log('[meetingbaas-connect-calendar] Environment check:', {
      hasServiceRoleKey: !!serviceRoleKey,
      hasSupabaseUrl: !!supabaseUrl,
      hasMeetingbaasApiKey: !!meetingbaasApiKey,
      hasGoogleClientId: !!googleClientId,
      hasGoogleClientSecret: !!googleClientSecret,
    });

    if (!meetingbaasApiKey) {
      return errorResponse('MeetingBaaS API key not configured', req, 500);
    }

    if (!googleClientId || !googleClientSecret) {
      return errorResponse('Google OAuth credentials not configured', req, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get request body
    const body: ConnectCalendarRequest = await req.json();
    const { user_id, calendar_id = 'primary', access_token: fallbackAccessToken } = body;

    if (!user_id) {
      return errorResponse('user_id is required', req, 400);
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

      return jsonResponse({
        success: false,
        error: 'Google Calendar refresh token not found. Please reconnect Google Calendar with offline access enabled.',
        recovery: 'Visit the Integrations page and reconnect your Google Calendar to enable automatic recording setup.',
      }, req, 400);
    }

    // Check if calendar already connected to MeetingBaaS
    const { data: existingConnection } = await supabase
      .from('meetingbaas_calendars')
      .select('id, meetingbaas_calendar_id')
      .eq('user_id', user_id)
      .eq('raw_calendar_id', calendar_id)
      .maybeSingle();

    if (existingConnection?.meetingbaas_calendar_id) {
      return jsonResponse({
        success: true,
        message: 'Calendar already connected to MeetingBaaS',
        calendar_id: existingConnection.meetingbaas_calendar_id
      }, req);
    }

    // Create calendar in MeetingBaaS
    const { data: mbCalendar, error: mbError, errorData: mbErrorData } = await createMeetingBaaSCalendar(
      meetingbaasApiKey,
      {
        oauth_client_id: googleClientId,
        oauth_client_secret: googleClientSecret,
        // Use the validated refresh token (googleIntegration may be null due to maybeSingle())
        oauth_refresh_token: refreshToken,
        raw_calendar_id: calendar_id,
        calendar_platform: 'google',
      }
    );

    // Handle case where calendar already exists in MeetingBaaS but not in our DB
    let finalMbCalendar = mbCalendar;
    if (mbError && mbError.includes('already exists')) {
      console.log('[MeetingBaaS Connect] Calendar already exists in MeetingBaaS, fetching existing calendars...');

      // Some MeetingBaaS error payloads include the existing calendar id — try to use it first
      const existingIdCandidate =
        (mbErrorData && typeof mbErrorData === 'object' && (mbErrorData as any).id) ||
        (mbErrorData && typeof mbErrorData === 'object' && (mbErrorData as any).calendar_id) ||
        (mbErrorData && typeof mbErrorData === 'object' && (mbErrorData as any).calendar?.id);

      if (typeof existingIdCandidate === 'string' && existingIdCandidate.length > 0) {
        finalMbCalendar = {
          id: existingIdCandidate,
          platform: 'google',
          raw_calendar_id: calendar_id,
          email: userEmail || undefined,
          created_at: new Date().toISOString(),
        };
        console.log('[MeetingBaaS Connect] Using existing calendar id from error payload:', existingIdCandidate);
      }
      
      // Try to find the existing calendar by listing all calendars
      const { data: existingCalendars, error: listError } = await listMeetingBaaSCalendars(meetingbaasApiKey);
      
      if (!listError && existingCalendars && !finalMbCalendar) {
        // Find the calendar matching our raw_calendar_id
        const matchingCalendar = existingCalendars.find((cal: any) => {
          const rawId =
            cal?.raw_calendar_id ??
            cal?.rawCalendarId ??
            cal?.raw_calendarId ??
            cal?.calendar_id ??
            cal?.calendarId ??
            null;
          const platform = String(cal?.platform ?? cal?.calendar_platform ?? '').toLowerCase();
          const isGoogle = !platform || platform.includes('google');
          return rawId === calendar_id && isGoogle;
        });
        
        if (matchingCalendar) {
          console.log('[MeetingBaaS Connect] Found existing calendar in MeetingBaaS:', matchingCalendar.id);
          finalMbCalendar = matchingCalendar;
        } else {
          console.error('[MeetingBaaS Connect] Calendar exists but could not find matching calendar');
          return errorResponse(
            'Calendar already exists in MeetingBaaS but could not be retrieved. Please disconnect/reconnect Google Calendar and try again.',
            req,
            409
          );
        }
      } else if (listError && !finalMbCalendar) {
        console.error('[MeetingBaaS Connect] Failed to list calendars:', listError);
        return errorResponse(mbError || 'Failed to connect calendar', req, 500);
      }
    } else if (mbError || !mbCalendar) {
      console.error('[MeetingBaaS Connect] Failed to create calendar:', mbError);
      return errorResponse(mbError || 'Failed to connect calendar', req, 500);
    }

    // Safety net: by here we must have a MeetingBaaS calendar
    if (!finalMbCalendar) {
      return errorResponse('Failed to connect calendar', req, 500);
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
        meetingbaas_calendar_id: finalMbCalendar.id,
        raw_calendar_id: calendar_id,
        platform: 'google',
        email: userEmail || finalMbCalendar.email,
        name: finalMbCalendar.name,
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
    const webhookUrl = webhookToken
      ? `${supabaseUrl}/functions/v1/meetingbaas-webhook?token=${webhookToken}`
      : null;

    console.log(`[MeetingBaaS Connect] Calendar connected: ${finalMbCalendar.id} for user ${user_id}`);

    return jsonResponse({
      success: true,
      message: 'Calendar connected to MeetingBaaS successfully',
      calendar: {
        id: finalMbCalendar.id,
        platform: finalMbCalendar.platform,
        raw_calendar_id: finalMbCalendar.raw_calendar_id,
        email: userEmail || finalMbCalendar.email,
      },
      webhook_url: webhookUrl,
    }, req);

  } catch (error) {
    console.error('[MeetingBaaS Connect] Error:', error);

    await captureException(error, {
      tags: {
        function: 'meetingbaas-connect-calendar',
        integration: 'meetingbaas',
      },
    });

    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    }, req, 500);
  }
});
