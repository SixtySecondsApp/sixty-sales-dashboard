/**
 * clerkClient.ts
 *
 * Supabase client factory for Clerk authentication integration.
 * Creates Supabase clients that use Clerk JWTs instead of Supabase Auth tokens.
 *
 * This enables:
 * 1. Shared authentication across all Supabase branches (production, dev, preview)
 * 2. RLS policies working with Clerk user IDs via clerk_user_mappings table
 * 3. Seamless migration from Supabase Auth to Clerk
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../database.types';
import logger from '@/lib/utils/logger';

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate required environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing required Supabase environment variables for Clerk integration.'
  );
}

// Type for Clerk's getToken function
type GetClerkToken = (options?: { template?: string }) => Promise<string | null>;

// Typed Supabase client
export type ClerkSupabaseClient = SupabaseClient<Database>;

/**
 * Creates a Supabase client that uses Clerk JWT for authentication.
 *
 * Usage:
 * ```typescript
 * import { useClerkSupabaseClient } from '@/lib/supabase/clerkClient';
 *
 * function MyComponent() {
 *   const supabase = useClerkSupabaseClient();
 *
 *   // Use supabase as normal - it will use Clerk JWT
 *   const { data } = await supabase.from('deals').select('*');
 * }
 * ```
 *
 * @param getToken - Clerk's getToken function from useAuth() hook
 * @returns Supabase client configured with Clerk JWT
 */
export function createClerkSupabaseClient(
  getToken: GetClerkToken
): ClerkSupabaseClient {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false, // Clerk manages sessions
      autoRefreshToken: false, // Clerk manages token refresh
      detectSessionInUrl: false, // Clerk handles OAuth callbacks
    },
    global: {
      headers: {
        'X-Client-Info': 'sales-dashboard-clerk-integration',
      },
      // Use Clerk token for all requests
      fetch: async (url: RequestInfo, init?: RequestInit) => {
        // Get JWT from Clerk's 'supabase' template
        const clerkToken = await getToken({ template: 'supabase' });

        const headers = new Headers(init?.headers);

        if (clerkToken) {
          // Use Clerk JWT for Supabase authentication
          headers.set('Authorization', `Bearer ${clerkToken}`);
          headers.set('apikey', supabaseAnonKey);
        }

        // Add performance headers
        headers.set('Connection', 'keep-alive');
        headers.set('Accept-Encoding', 'gzip, deflate, br');

        return fetch(url, {
          ...init,
          headers,
          signal: AbortSignal.timeout(25000), // 25 second timeout
        });
      },
    },
    // Real-time configuration
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
      heartbeatIntervalMs: 30000,
      reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 30000),
    },
  });
}

// Singleton instance for React context
let clerkSupabaseInstance: ClerkSupabaseClient | null = null;

/**
 * React hook to get a Supabase client with Clerk authentication.
 *
 * This hook should be used within components that need database access
 * when Clerk authentication is enabled.
 *
 * Usage:
 * ```typescript
 * import { useAuth } from '@clerk/clerk-react';
 * import { useClerkSupabaseClient } from '@/lib/supabase/clerkClient';
 *
 * function MyComponent() {
 *   const { getToken } = useAuth();
 *   const supabase = useClerkSupabaseClient(getToken);
 *
 *   useEffect(() => {
 *     const fetchData = async () => {
 *       const { data } = await supabase.from('deals').select('*');
 *     };
 *     fetchData();
 *   }, [supabase]);
 * }
 * ```
 */
export function getClerkSupabaseClient(getToken: GetClerkToken): ClerkSupabaseClient {
  // Create new instance (we need fresh token getter each time)
  // Note: In production, consider memoizing based on user session
  return createClerkSupabaseClient(getToken);
}

/**
 * Hook wrapper for React components - creates Supabase client with Clerk JWT
 *
 * @param getToken - getToken function from useAuth() Clerk hook
 * @returns Supabase client that uses Clerk JWT for auth
 */
export function useClerkSupabaseClient(getToken: GetClerkToken): ClerkSupabaseClient {
  // For now, create client on each call
  // This ensures fresh token is always used
  // React Query or similar will handle caching at the data layer
  return createClerkSupabaseClient(getToken);
}

/**
 * Creates a one-time Supabase client with a specific Clerk token.
 *
 * Useful for:
 * - Server-side operations where you have the token already
 * - API routes that receive the token in headers
 * - Edge functions
 *
 * @param token - Pre-fetched Clerk JWT token
 * @returns Supabase client configured with the provided token
 */
export function createClerkSupabaseClientWithToken(token: string): ClerkSupabaseClient {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'sales-dashboard-clerk-integration',
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
      fetch: async (url: RequestInfo, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        headers.set('Authorization', `Bearer ${token}`);
        headers.set('apikey', supabaseAnonKey);
        headers.set('Connection', 'keep-alive');
        headers.set('Accept-Encoding', 'gzip, deflate, br');

        return fetch(url, {
          ...init,
          headers,
          signal: AbortSignal.timeout(25000),
        });
      },
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
      heartbeatIntervalMs: 30000,
      reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 30000),
    },
  });
}

/**
 * Utility to check if Clerk authentication is enabled
 */
export function isClerkAuthEnabled(): boolean {
  return import.meta.env.VITE_USE_CLERK_AUTH === 'true';
}

/**
 * Get the appropriate Supabase client based on auth mode
 *
 * @param getClerkToken - Clerk's getToken function (optional, only needed if Clerk auth is enabled)
 * @returns Supabase client (either Clerk-based or standard)
 */
export async function getSupabaseClient(
  getClerkToken?: GetClerkToken
): Promise<ClerkSupabaseClient> {
  if (isClerkAuthEnabled() && getClerkToken) {
    logger.log('🔐 Using Clerk-authenticated Supabase client');
    return createClerkSupabaseClient(getClerkToken);
  }

  // Fall back to standard Supabase client
  // Import dynamically to avoid circular dependencies
  const { supabase } = await import('./clientV3-optimized');
  logger.log('🔐 Using standard Supabase client');
  return supabase as ClerkSupabaseClient;
}

export default {
  createClerkSupabaseClient,
  createClerkSupabaseClientWithToken,
  useClerkSupabaseClient,
  getClerkSupabaseClient,
  getSupabaseClient,
  isClerkAuthEnabled,
};
