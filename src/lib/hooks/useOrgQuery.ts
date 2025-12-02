/**
 * useOrgQuery - Organization-Aware Query Hook
 *
 * Provides organization context for data queries.
 * Works with RLS policies but also provides explicit org_id for queries
 * that need it for filtering or when RLS alone isn't sufficient.
 *
 * Usage:
 * ```ts
 * const { orgId, isReady, queryEnabled } = useOrgQuery();
 *
 * const { data } = useQuery({
 *   queryKey: ['deals', orgId],
 *   queryFn: () => fetchDeals(orgId),
 *   enabled: queryEnabled,
 * });
 * ```
 */

import { useMemo } from 'react';
import { useOrg } from '@/lib/contexts/OrgContext';
import { useAuth } from '@/lib/contexts/AuthContext';

export interface UseOrgQueryResult {
  // Organization ID (null if not loaded yet)
  orgId: string | null;

  // Whether org context is fully loaded and ready for queries
  isReady: boolean;

  // Convenience flag to pass to enabled in useQuery
  queryEnabled: boolean;

  // User ID for queries that still need it
  userId: string | null;

  // Whether the user is authenticated
  isAuthenticated: boolean;

  // Whether multi-tenant mode is enabled
  isMultiTenant: boolean;

  // Helper to add org_id filter to a query
  withOrgFilter: <T extends object>(query: T) => T & { org_id: string | null };

  // Helper to create query key with org context
  createQueryKey: (baseKey: (string | number | undefined)[]) => (string | number | null | undefined)[];
}

/**
 * Hook that provides organization context for data queries.
 *
 * The main purpose is to:
 * 1. Provide org_id for query keys (cache separation by org)
 * 2. Provide query enabled flag that waits for org context
 * 3. Helper functions for building org-aware queries
 *
 * Note: RLS policies handle most filtering automatically, but explicit
 * org_id in queries helps with:
 * - Cache key differentiation between orgs
 * - Explicit documentation of org boundaries
 * - Cases where RLS isn't applied (service role, etc.)
 */
export function useOrgQuery(): UseOrgQueryResult {
  const { activeOrgId, isLoading: orgLoading, isMultiTenant } = useOrg();
  const { userId, isAuthenticated, loading: authLoading } = useAuth();

  // Determine if org context is ready
  const isReady = useMemo(() => {
    // Not ready if auth is still loading
    if (authLoading) return false;

    // Not ready if not authenticated
    if (!isAuthenticated) return false;

    // In multi-tenant mode, wait for org to load
    if (isMultiTenant && orgLoading) return false;

    // In multi-tenant mode, must have an org ID
    if (isMultiTenant && !activeOrgId) return false;

    return true;
  }, [authLoading, isAuthenticated, isMultiTenant, orgLoading, activeOrgId]);

  // Helper to add org_id to a query object
  const withOrgFilter = useMemo(() => {
    return <T extends object>(query: T): T & { org_id: string | null } => ({
      ...query,
      org_id: activeOrgId,
    });
  }, [activeOrgId]);

  // Helper to create query key with org context
  const createQueryKey = useMemo(() => {
    return (baseKey: (string | number | undefined)[]): (string | number | null | undefined)[] => {
      // Add org_id to the beginning of the query key for cache separation
      return ['org', activeOrgId, ...baseKey];
    };
  }, [activeOrgId]);

  return {
    orgId: activeOrgId,
    isReady,
    queryEnabled: isReady,
    userId,
    isAuthenticated,
    isMultiTenant,
    withOrgFilter,
    createQueryKey,
  };
}

/**
 * Convenience hook for common query pattern:
 * Returns a query key and enabled flag
 */
export function useOrgQueryConfig(baseKey: string | string[]) {
  const { orgId, queryEnabled, createQueryKey } = useOrgQuery();

  const keyArray = Array.isArray(baseKey) ? baseKey : [baseKey];

  return {
    queryKey: createQueryKey(keyArray),
    enabled: queryEnabled,
    orgId,
  };
}

export default useOrgQuery;
