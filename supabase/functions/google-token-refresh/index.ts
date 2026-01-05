/**
 * Google Token Refresh Edge Function
 *
 * Proactively refreshes Google OAuth tokens before they expire.
 * Detects revoked tokens and marks integrations as needing reconnection.
 *
 * This function should be called by a cron job every few hours.
 *
 * Similar to fathom-token-refresh and hubspot-token-refresh.
 */

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { legacyCorsHeaders as corsHeaders } from '../_shared/corsHelper.ts';

// =============================================================================
// Types
// =============================================================================

interface RefreshResult {
  user_id: string;
  email: string;
  status: 'refreshed' | 'skipped' | 'failed' | 'needs_reconnect';
  message: string;
  expires_at?: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  refresh_token?: string; // Only returned if access_type=offline and prompt=consent
}

interface GoogleTokenError {
  error: string;
  error_description?: string;
}

// =============================================================================
// Constants
// =============================================================================

// Refresh tokens that expire within this window (15 minutes)
const REFRESH_WINDOW_MS = 15 * 60 * 1000;

// Test connection endpoint
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// =============================================================================
// Main Handler
// =============================================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: RefreshResult[] = [];

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
    const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';

    if (!googleClientId || !googleClientSecret) {
      return new Response(
        JSON.stringify({ success: false, error: 'Google OAuth credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get all active Google integrations
    const { data: integrations, error: fetchError } = await supabase
      .from('google_integrations')
      .select('id, user_id, email, access_token, refresh_token, expires_at, token_status')
      .eq('is_active', true);

    if (fetchError) {
      throw new Error(`Failed to fetch integrations: ${fetchError.message}`);
    }

    if (!integrations || integrations.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active integrations to process',
          summary: { total: 0, refreshed: 0, skipped: 0, failed: 0, needs_reconnect: 0 },
          results: [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[google-token-refresh] Processing ${integrations.length} integrations`);

    for (const integration of integrations) {
      const { id, user_id, email, refresh_token, expires_at, token_status } = integration;

      // Skip if already marked as needing reconnect
      if (token_status === 'revoked' || token_status === 'needs_reconnect') {
        results.push({
          user_id,
          email: email || 'unknown',
          status: 'skipped',
          message: 'Already marked as needing reconnection',
        });
        continue;
      }

      // Skip if no refresh token
      if (!refresh_token) {
        results.push({
          user_id,
          email: email || 'unknown',
          status: 'needs_reconnect',
          message: 'No refresh token available',
        });

        // Mark as needing reconnect
        await supabase
          .from('google_integrations')
          .update({
            token_status: 'needs_reconnect',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        continue;
      }

      // Check if token needs refresh (expires within 15 minutes)
      const expiresAtDate = new Date(expires_at);
      const now = new Date();
      const timeUntilExpiry = expiresAtDate.getTime() - now.getTime();

      if (timeUntilExpiry > REFRESH_WINDOW_MS) {
        results.push({
          user_id,
          email: email || 'unknown',
          status: 'skipped',
          message: `Token valid for ${Math.round(timeUntilExpiry / 60000)} more minutes`,
          expires_at,
        });
        continue;
      }

      // Attempt token refresh
      try {
        console.log(`[google-token-refresh] Refreshing token for user ${user_id}`);

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: googleClientId,
            client_secret: googleClientSecret,
            refresh_token: refresh_token,
            grant_type: 'refresh_token',
          }),
        });

        if (!tokenResponse.ok) {
          const errorData: GoogleTokenError = await tokenResponse.json();
          const errorMessage = errorData.error_description || errorData.error || 'Unknown error';

          console.error(`[google-token-refresh] Token refresh failed for user ${user_id}: ${errorMessage}`);

          // Check for permanent failures that require reconnection
          const isPermFailure =
            errorData.error === 'invalid_grant' ||
            errorMessage.toLowerCase().includes('token has been expired or revoked') ||
            errorMessage.toLowerCase().includes('token has been revoked') ||
            tokenResponse.status === 400;

          if (isPermFailure) {
            // Mark integration as needing reconnection
            await supabase
              .from('google_integrations')
              .update({
                token_status: 'revoked',
                is_active: false,
                updated_at: new Date().toISOString(),
              })
              .eq('id', id);

            results.push({
              user_id,
              email: email || 'unknown',
              status: 'needs_reconnect',
              message: `Token revoked or expired: ${errorMessage}`,
            });

            // TODO: Send notification to user about reconnection needed
          } else {
            results.push({
              user_id,
              email: email || 'unknown',
              status: 'failed',
              message: `Token refresh failed: ${errorMessage}`,
            });
          }

          continue;
        }

        // Parse successful response
        const tokenData: GoogleTokenResponse = await tokenResponse.json();

        // Calculate new expiry
        const newExpiresAt = new Date();
        newExpiresAt.setSeconds(newExpiresAt.getSeconds() + (tokenData.expires_in || 3600));

        // Update the integration
        await supabase
          .from('google_integrations')
          .update({
            access_token: tokenData.access_token,
            expires_at: newExpiresAt.toISOString(),
            token_status: 'valid',
            last_token_refresh: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        results.push({
          user_id,
          email: email || 'unknown',
          status: 'refreshed',
          message: 'Token refreshed successfully',
          expires_at: newExpiresAt.toISOString(),
        });

        console.log(`[google-token-refresh] Successfully refreshed token for user ${user_id}`);
      } catch (error) {
        console.error(`[google-token-refresh] Error for user ${user_id}:`, error);
        results.push({
          user_id,
          email: email || 'unknown',
          status: 'failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Calculate summary
    const summary = {
      total: results.length,
      refreshed: results.filter((r) => r.status === 'refreshed').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: results.filter((r) => r.status === 'failed').length,
      needs_reconnect: results.filter((r) => r.status === 'needs_reconnect').length,
    };

    const duration = Date.now() - startTime;
    console.log(
      `[google-token-refresh] Complete: ${summary.refreshed} refreshed, ${summary.skipped} skipped, ${summary.failed} failed, ${summary.needs_reconnect} need reconnect (${duration}ms)`
    );

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        results,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[google-token-refresh] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        results,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
