/**
 * Organization Query Utilities
 *
 * Utility functions for working with organization-scoped queries.
 * These help ensure proper cache invalidation and query key management
 * across multi-tenant data.
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Query key prefixes for org-scoped data.
 * When invalidating queries, these prefixes help ensure proper cache management.
 */
export const ORG_QUERY_KEYS = {
  // CRM Data
  DEALS: 'deals',
  CONTACTS: 'contacts',
  COMPANIES: 'companies',
  LEADS: 'leads',

  // Activities
  ACTIVITIES: 'activities',
  TASKS: 'tasks',
  MEETINGS: 'meetings',

  // Health & Analytics
  HEALTH_SCORES: 'health-scores',
  ANALYTICS: 'analytics',
  DASHBOARD: 'dashboard',

  // Workflows
  WORKFLOWS: 'workflows',
  AUTOMATION: 'automation',
} as const;

/**
 * Invalidate all org-scoped queries.
 * Call this when switching organizations.
 */
export function invalidateAllOrgQueries(queryClient: QueryClient): void {
  // Invalidate all queries - they will refetch with new RLS context
  Object.values(ORG_QUERY_KEYS).forEach((key) => {
    queryClient.invalidateQueries({ queryKey: [key] });
  });

  // Also invalidate any queries that might have org in the key
  queryClient.invalidateQueries({ queryKey: ['org'] });
}

/**
 * Create an org-scoped query key.
 * Use this to ensure queries are properly scoped by organization.
 */
export function createOrgQueryKey(
  orgId: string | null,
  ...baseKey: (string | number | null | undefined)[]
): (string | number | null | undefined)[] {
  return ['org', orgId, ...baseKey];
}

/**
 * Invalidate specific query types for the current org.
 */
export function invalidateOrgQueries(
  queryClient: QueryClient,
  keys: (keyof typeof ORG_QUERY_KEYS)[]
): void {
  keys.forEach((key) => {
    const queryKey = ORG_QUERY_KEYS[key];
    queryClient.invalidateQueries({ queryKey: [queryKey] });
  });
}

/**
 * Clear all cached data.
 * Call this on logout to prevent data leakage between users.
 */
export function clearAllQueryCache(queryClient: QueryClient): void {
  queryClient.clear();
}

/**
 * Prefetch common queries for a new org.
 * Call this after switching organizations for smoother UX.
 */
export async function prefetchOrgData(
  queryClient: QueryClient,
  _orgId: string
): Promise<void> {
  // Note: Actual prefetch implementations would go here
  // For now, just invalidate to trigger fresh fetches
  invalidateAllOrgQueries(queryClient);
}
