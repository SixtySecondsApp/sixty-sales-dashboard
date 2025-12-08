/**
 * External Supabase Client
 *
 * Creates a Supabase client for the external (customer-facing) project.
 * Used when the frontend needs to query the external database directly.
 *
 * Note: Most operations go through Edge Functions on the internal project.
 * This client is for cases where direct external DB access is needed.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EXTERNAL_PROJECT_CONFIG } from './external-project-config';

let externalSupabaseClient: SupabaseClient | null = null;

/**
 * Get or create the external Supabase client
 * Returns null if external project is not configured
 */
export function getExternalSupabase(): SupabaseClient | null {
  if (!EXTERNAL_PROJECT_CONFIG.url || !EXTERNAL_PROJECT_CONFIG.anonKey) {
    console.warn('External Supabase project not configured');
    return null;
  }

  if (!externalSupabaseClient) {
    externalSupabaseClient = createClient(
      EXTERNAL_PROJECT_CONFIG.url,
      EXTERNAL_PROJECT_CONFIG.anonKey,
      {
        auth: {
          persistSession: false, // Don't persist - we use Clerk for auth
          autoRefreshToken: false,
        },
      }
    );
  }

  return externalSupabaseClient;
}

/**
 * Create an external Supabase client with a specific access token
 * Used when making authenticated requests with Clerk JWT
 */
export function createExternalSupabaseWithToken(accessToken: string): SupabaseClient | null {
  if (!EXTERNAL_PROJECT_CONFIG.url || !EXTERNAL_PROJECT_CONFIG.anonKey) {
    console.warn('External Supabase project not configured');
    return null;
  }

  return createClient(
    EXTERNAL_PROJECT_CONFIG.url,
    EXTERNAL_PROJECT_CONFIG.anonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

/**
 * Check if external project is configured
 */
export function isExternalProjectConfigured(): boolean {
  return Boolean(EXTERNAL_PROJECT_CONFIG.url && EXTERNAL_PROJECT_CONFIG.anonKey);
}
