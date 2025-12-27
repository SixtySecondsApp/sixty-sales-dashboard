/**
 * useAuthUser Hook
 *
 * React Query wrapper for getting the authenticated user.
 * This hook provides a cached auth user that is deduplicated across all components.
 *
 * Use this instead of calling supabase.auth.getUser() directly in components.
 * The cache prevents duplicate API calls when multiple components need the user.
 *
 * @example
 * const { data: user, isLoading } = useAuthUser();
 * if (user) {
 *   console.log('User ID:', user.id);
 * }
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/clientV2';
import { User } from '@supabase/supabase-js';

// Query key for the auth user
export const AUTH_USER_QUERY_KEY = ['auth', 'user'] as const;

/**
 * Fetches the current authenticated user from Supabase
 */
async function fetchAuthUser(): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    // Don't throw for auth errors - just return null (not authenticated)
    console.warn('Auth user fetch error:', error.message);
    return null;
  }

  return user;
}

/**
 * Hook to get the current authenticated user with React Query caching.
 *
 * Benefits:
 * - Automatic deduplication: Multiple components calling this hook = 1 API call
 * - Long stale time: Auth state rarely changes mid-session
 * - No refetch on focus: Prevents unnecessary calls on tab switch
 *
 * @returns Query result with user data
 */
export function useAuthUser() {
  return useQuery({
    queryKey: AUTH_USER_QUERY_KEY,
    queryFn: fetchAuthUser,
    staleTime: 30 * 60 * 1000, // 30 minutes - auth rarely changes mid-session
    gcTime: 60 * 60 * 1000, // 60 minutes - keep in cache longer
    refetchOnWindowFocus: false, // Don't refetch on tab switch
    refetchOnMount: false, // Use cached data if available
    refetchOnReconnect: false, // Don't refetch on network reconnect
    retry: false, // Don't retry auth calls
  });
}

/**
 * Hook to invalidate the auth user cache.
 * Call this when you know the auth state has changed (e.g., after sign-in/sign-out).
 *
 * @example
 * const invalidateAuthUser = useInvalidateAuthUser();
 * await signIn(email, password);
 * invalidateAuthUser();
 */
export function useInvalidateAuthUser() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: AUTH_USER_QUERY_KEY });
  };
}

export default useAuthUser;
