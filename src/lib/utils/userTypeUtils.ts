/**
 * User Type Utilities
 *
 * Functions for determining user type from email and computing feature access.
 * Uses a whitelist approach - only emails in the internal_users table get internal access.
 * This is the single source of truth for user type classification.
 */

import {
  type UserType,
  type FeatureAccess,
  type ViewModeState,
  EXTERNAL_FEATURE_ACCESS,
  INTERNAL_FEATURE_ACCESS,
} from '@/lib/types/userTypes';
import { supabase } from '@/lib/supabase/clientV2';

// Cache for internal users whitelist loaded from database
let cachedInternalUsers: Set<string> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load internal users whitelist from database (with caching)
 * Returns empty set if database unavailable (safe default - external)
 */
export async function loadInternalUsers(): Promise<Set<string>> {
  const now = Date.now();

  // Return cached value if valid
  if (cachedInternalUsers && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('[Internal Users] Using cached whitelist:', Array.from(cachedInternalUsers));
    return cachedInternalUsers;
  }

  console.log('[Internal Users] Loading whitelist from database...');
  
  try {
    const { data, error } = await supabase
      .from('internal_users')
      .select('email')
      .eq('is_active', true);

    if (error) {
      console.error('[Internal Users] Failed to load from database:', error);
      return cachedInternalUsers || new Set();
    }

    console.log('[Internal Users] Raw data from database:', data);

    if (data && data.length > 0) {
      cachedInternalUsers = new Set(data.map(d => d.email.toLowerCase()));
      cacheTimestamp = now;
      console.log('[Internal Users] Loaded whitelist:', Array.from(cachedInternalUsers));
      return cachedInternalUsers;
    }

    // Empty whitelist = everyone is external
    console.warn('[Internal Users] No active users found in database!');
    cachedInternalUsers = new Set();
    cacheTimestamp = now;
    return cachedInternalUsers;
  } catch (error) {
    console.error('[Internal Users] Exception loading users:', error);
    return cachedInternalUsers || new Set();
  }
}

/**
 * Clear the internal users cache (call when whitelist is updated)
 */
export function clearInternalUsersCache(): void {
  cachedInternalUsers = null;
  cacheTimestamp = 0;
}

// Legacy alias for backwards compatibility
export const clearInternalDomainsCache = clearInternalUsersCache;

/**
 * Get currently cached internal users (synchronous, for initial render)
 * Returns empty set if cache is empty (safe default - external)
 */
export function getCachedInternalUsers(): Set<string> {
  return cachedInternalUsers || new Set();
}

/**
 * Determine user type based on email whitelist
 * Uses cached whitelist for synchronous access (call loadInternalUsers first for accuracy)
 * @param email - User's email address
 * @returns 'internal' if email is in whitelist, 'external' otherwise
 */
export function getUserTypeFromEmail(email: string | null | undefined): UserType {
  if (!email) return 'external';

  const normalizedEmail = email.toLowerCase();
  const internalUsers = getCachedInternalUsers();
  const isInternal = internalUsers.has(normalizedEmail);
  
  console.log('[Internal Users] Checking email:', normalizedEmail, '| In whitelist:', isInternal, '| Whitelist size:', internalUsers.size);

  return isInternal ? 'internal' : 'external';
}

/**
 * Async version of getUserTypeFromEmail that loads fresh whitelist from database
 */
export async function getUserTypeFromEmailAsync(email: string | null | undefined): Promise<UserType> {
  if (!email) return 'external';

  const normalizedEmail = email.toLowerCase();
  const internalUsers = await loadInternalUsers();

  return internalUsers.has(normalizedEmail) ? 'internal' : 'external';
}

/**
 * Check if email belongs to internal user
 */
export function isInternalUser(email: string | null | undefined): boolean {
  return getUserTypeFromEmail(email) === 'internal';
}

/**
 * Check if email belongs to external user
 */
export function isExternalUser(email: string | null | undefined): boolean {
  return getUserTypeFromEmail(email) === 'external';
}

/**
 * Get feature access based on user type, view mode, and admin status
 * @param userType - The actual user type
 * @param viewMode - Current view mode state (for "view as external" toggle)
 * @param isAdmin - Whether user has admin privileges
 * @returns Feature access flags
 */
export function getFeatureAccess(
  userType: UserType,
  viewMode: ViewModeState,
  isAdmin: boolean
): FeatureAccess {
  // Use effective user type (respects view toggle)
  const effectiveType = viewMode.effectiveUserType;

  // External users (or internal viewing as external) get limited access
  if (effectiveType === 'external') {
    return { ...EXTERNAL_FEATURE_ACCESS };
  }

  // Internal users get full access, admin features depend on is_admin flag
  return {
    ...INTERNAL_FEATURE_ACCESS,
    adminDashboard: isAdmin,
    saasAdmin: isAdmin,
    userManagement: isAdmin,
    systemSettings: isAdmin,
  };
}

// Route classifications
const EXTERNAL_ALLOWED_ROUTES = [
  '/', // Dashboard (Sentiment Analytics)
  '/meetings',
  '/meetings/intelligence',
  '/meetings/sentiment',
  '/insights/team',
  '/insights/content-topics',
  '/profile',
  '/settings',
  '/onboarding',
];

// Routes that match with dynamic segments (e.g., /meetings/:id)
const EXTERNAL_ALLOWED_DYNAMIC_ROUTES = [
  '/meetings/', // Matches /meetings/:id
];

const INTERNAL_ONLY_ROUTE_PREFIXES = [
  '/crm',
  '/pipeline',
  '/admin',
  '/saas-admin',
  '/tasks',
  '/projects',
  '/calendar',
  '/email',
  '/clients',
  '/workflows',
  '/integrations',
  '/leads',
  '/events',
  '/copilot',
  '/activity',
];

/**
 * Get list of routes allowed for a user type
 */
export function getAllowedRoutes(effectiveUserType: UserType, isAdmin: boolean): string[] {
  if (effectiveUserType === 'external') {
    return EXTERNAL_ALLOWED_ROUTES;
  }

  // Internal users get all routes
  const allRoutes = [
    ...EXTERNAL_ALLOWED_ROUTES,
    '/crm',
    '/pipeline',
    '/activity',
    '/tasks',
    '/projects',
    '/calendar',
    '/email',
    '/workflows',
    '/integrations',
    '/clients',
    '/leads',
    '/events',
    '/copilot',
  ];

  // Admin-only routes
  if (isAdmin) {
    allRoutes.push('/admin', '/saas-admin');
  }

  return allRoutes;
}

/**
 * Check if a specific route is allowed for the effective user type
 * @param pathname - The route pathname to check
 * @param effectiveUserType - The user type to check against
 * @param isAdmin - Whether user has admin privileges
 * @returns True if route is allowed
 */
export function isRouteAllowed(
  pathname: string,
  effectiveUserType: UserType,
  isAdmin: boolean
): boolean {
  // Normalize pathname
  const normalizedPath = pathname.toLowerCase();

  // External users - check against allowed routes
  if (effectiveUserType === 'external') {
    // Check exact matches
    if (EXTERNAL_ALLOWED_ROUTES.includes(normalizedPath)) {
      return true;
    }

    // Check dynamic routes (e.g., /meetings/123)
    for (const route of EXTERNAL_ALLOWED_DYNAMIC_ROUTES) {
      if (normalizedPath.startsWith(route)) {
        return true;
      }
    }

    // Check if it's an auth route (always allowed)
    if (normalizedPath.startsWith('/auth/')) {
      return true;
    }

    return false;
  }

  // Internal users - check against internal-only routes if not admin
  if (!isAdmin) {
    // Non-admin internal users can't access admin routes
    if (normalizedPath.startsWith('/admin') || normalizedPath.startsWith('/saas-admin')) {
      return false;
    }
  }

  // Internal users (and admins) have access to everything else
  return true;
}

/**
 * Get the default redirect route for unauthorized access
 * @param effectiveUserType - The user type
 * @returns The route to redirect to
 */
export function getUnauthorizedRedirect(effectiveUserType: UserType): string {
  return effectiveUserType === 'external' ? '/meetings' : '/';
}

/**
 * Check if a route is internal-only
 * @param pathname - The route pathname
 * @returns True if route requires internal access
 */
export function isInternalOnlyRoute(pathname: string): boolean {
  const normalizedPath = pathname.toLowerCase();
  return INTERNAL_ONLY_ROUTE_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));
}

// Legacy exports for backwards compatibility
export async function loadInternalDomains(): Promise<string[]> {
  // Return empty array - domains no longer used
  return [];
}

export function getCachedInternalDomains(): string[] {
  // Return empty array - domains no longer used
  return [];
}
