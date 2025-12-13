/**
 * Google Test Connection Edge Function
 * 
 * Provides a safe way to test Google integration by performing
 * lightweight API calls to verify tokens and scopes work correctly.
 * 
 * SECURITY:
 * - POST only
 * - User JWT authentication required (no service-role)
 * - Allowlist-based CORS
 * 
 * Tests:
 * - Google userinfo endpoint (basic connectivity)
 * - Gmail profile (if gmail scope present)
 * - Calendar list (if calendar scope present)
 * - Tasks list (if tasks scope present)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders, handleCorsPreflightRequest, jsonResponse, errorResponse } from '../_shared/corsHelper.ts';

async function refreshAccessToken(refreshToken: string, supabase: any, userId: string): Promise<string> {
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
    throw new Error(`Failed to refresh token: ${errorData.error_description || 'Unknown error'}`);
  }

  const data = await response.json();
  
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 3600));
  
  await supabase
    .from('google_integrations')
    .update({
      access_token: data.access_token,
      expires_at: expiresAt.toISOString(),
    })
    .eq('user_id', userId);
  
  return data.access_token;
}

interface ServiceTestResult {
  ok: boolean;
  message?: string;
  data?: any;
}

serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) {
    return preflightResponse;
  }

  // POST only
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed. Use POST.', req, 405);
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Server configuration error');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Get user from JWT - user authentication only (no service role)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Authorization required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid authentication token');
    }

    // Get user's Google integration
    const { data: integration, error: integrationError } = await supabase
      .from('google_integrations')
      .select('access_token, refresh_token, expires_at, email, scopes, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      return jsonResponse({
        success: false,
        connected: false,
        message: 'No Google integration found. Please connect your Google account.',
        services: {
          userinfo: { ok: false, message: 'Not connected' },
          gmail: { ok: false, message: 'Not connected' },
          calendar: { ok: false, message: 'Not connected' },
          tasks: { ok: false, message: 'Not connected' },
        },
      }, req);
    }

    // Check if token needs refresh
    let accessToken = integration.access_token;
    const expiresAt = new Date(integration.expires_at);
    const now = new Date();
    
    if (expiresAt <= now) {
      try {
        accessToken = await refreshAccessToken(integration.refresh_token, supabase, user.id);
      } catch (refreshError: any) {
        return jsonResponse({
          success: false,
          connected: true,
          message: 'Token refresh failed. Please reconnect your Google account.',
          error: refreshError.message,
          services: {
            userinfo: { ok: false, message: 'Token expired' },
            gmail: { ok: false, message: 'Token expired' },
            calendar: { ok: false, message: 'Token expired' },
            tasks: { ok: false, message: 'Token expired' },
          },
        }, req);
      }
    }

    // Parse scopes to determine which services to test
    const scopes = integration.scopes?.toLowerCase() || '';
    const hasGmailScope = scopes.includes('gmail') || scopes.includes('mail');
    const hasCalendarScope = scopes.includes('calendar');
    const hasTasksScope = scopes.includes('tasks');

    // Test results
    const results: {
      userinfo: ServiceTestResult;
      gmail: ServiceTestResult;
      calendar: ServiceTestResult;
      tasks: ServiceTestResult;
    } = {
      userinfo: { ok: false },
      gmail: { ok: false, message: hasGmailScope ? undefined : 'No Gmail scope' },
      calendar: { ok: false, message: hasCalendarScope ? undefined : 'No Calendar scope' },
      tasks: { ok: false, message: hasTasksScope ? undefined : 'No Tasks scope' },
    };

    // Test 1: Google userinfo (always test this)
    try {
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        results.userinfo = {
          ok: true,
          message: 'Connected',
          data: {
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
          },
        };
      } else {
        const error = await userInfoResponse.json().catch(() => ({}));
        results.userinfo = {
          ok: false,
          message: error.error?.message || `HTTP ${userInfoResponse.status}`,
        };
      }
    } catch (error: any) {
      results.userinfo = {
        ok: false,
        message: error.message || 'Connection failed',
      };
    }

    // Test 2: Gmail profile (if scope present)
    if (hasGmailScope) {
      try {
        const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (gmailResponse.ok) {
          const profile = await gmailResponse.json();
          results.gmail = {
            ok: true,
            message: 'Connected',
            data: {
              emailAddress: profile.emailAddress,
              messagesTotal: profile.messagesTotal,
              threadsTotal: profile.threadsTotal,
            },
          };
        } else {
          const error = await gmailResponse.json().catch(() => ({}));
          results.gmail = {
            ok: false,
            message: error.error?.message || `HTTP ${gmailResponse.status}`,
          };
        }
      } catch (error: any) {
        results.gmail = {
          ok: false,
          message: error.message || 'Connection failed',
        };
      }
    }

    // Test 3: Calendar list (if scope present)
    if (hasCalendarScope) {
      try {
        const calendarResponse = await fetch(
          'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1',
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        );

        if (calendarResponse.ok) {
          const calendars = await calendarResponse.json();
          results.calendar = {
            ok: true,
            message: 'Connected',
            data: {
              calendarCount: calendars.items?.length || 0,
              primaryCalendar: calendars.items?.find((c: any) => c.primary)?.summary || 'Unknown',
            },
          };
        } else {
          const error = await calendarResponse.json().catch(() => ({}));
          results.calendar = {
            ok: false,
            message: error.error?.message || `HTTP ${calendarResponse.status}`,
          };
        }
      } catch (error: any) {
        results.calendar = {
          ok: false,
          message: error.message || 'Connection failed',
        };
      }
    }

    // Test 4: Tasks list (if scope present)
    if (hasTasksScope) {
      try {
        const tasksResponse = await fetch(
          'https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=1',
          {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          }
        );

        if (tasksResponse.ok) {
          const taskLists = await tasksResponse.json();
          results.tasks = {
            ok: true,
            message: 'Connected',
            data: {
              taskListCount: taskLists.items?.length || 0,
            },
          };
        } else {
          const error = await tasksResponse.json().catch(() => ({}));
          results.tasks = {
            ok: false,
            message: error.error?.message || `HTTP ${tasksResponse.status}`,
          };
        }
      } catch (error: any) {
        results.tasks = {
          ok: false,
          message: error.message || 'Connection failed',
        };
      }
    }

    // Determine overall success
    const allOk = results.userinfo.ok && 
      (!hasGmailScope || results.gmail.ok) &&
      (!hasCalendarScope || results.calendar.ok) &&
      (!hasTasksScope || results.tasks.ok);

    // Log the test
    await supabase
      .from('google_service_logs')
      .insert({
        integration_id: null,
        service: 'test-connection',
        action: 'test',
        status: allOk ? 'success' : 'partial',
        request_data: { userId: user.id },
        response_data: results,
      }).catch(() => {
        // Non-critical
      });

    return jsonResponse({
      success: true,
      connected: true,
      email: integration.email,
      scopes: integration.scopes,
      allServicesOk: allOk,
      services: results,
      testedAt: new Date().toISOString(),
    }, req);

  } catch (error: any) {
    console.error('[google-test-connection] Error:', error.message);
    return errorResponse(error.message || 'Test connection failed', req, 400);
  }
});

