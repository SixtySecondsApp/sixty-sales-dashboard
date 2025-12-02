/**
 * User Type Utilities
 *
 * Functions for determining user type from email and computing feature access.
 * This is the single source of truth for user type classification.
 */

import {
  type UserType,
  type FeatureAccess,
  type ViewModeState,
  INTERNAL_DOMAINS,
  EXTERNAL_FEATURE_ACCESS,
  INTERNAL_FEATURE_ACCESS,
} from '@/lib/types/userTypes';
import { supabase } from '@/lib/supabase/clientV2';

// Cache for internal domains loaded from database
let cachedInternalDomains: string[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load internal domains from database (with caching)
 * Falls back to hardcoded INTERNAL_DOMAINS if database unavailable
 */
export async function loadInternalDomains(): Promise<string[]> {
  const now = Date.now();

  // Return cached value if valid
  if (cachedInternalDomains && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedInternalDomains;
  }

  try {
    const { data, error } = await supabase
      .from('internal_email_domains')
      .select('domain')
      .eq('is_active', true);

    if (error) {
      console.warn('Failed to load internal domains from database, using defaults:', error);
      return [...INTERNAL_DOMAINS];
    }

    if (data && data.length > 0) {
      cachedInternalDomains = data.map(d => d.domain.toLowerCase());
      cacheTimestamp = now;
      return cachedInternalDomains;
    }

    // Fallback to hardcoded if database is empty
    return [...INTERNAL_DOMAINS];
  } catch (error) {
    console.warn('Error loading internal domains:', error);
    return [...INTERNAL_DOMAINS];
  }
}

/**
 * Clear the internal domains cache (call when domains are updated)
 */
export function clearInternalDomainsCache(): void {
  cachedInternalDomains = null;
  cacheTimestamp = 0;
}

/**
 * Get currently cached internal domains (synchronous, for initial render)
 * Returns hardcoded defaults if cache is empty
 */
export function getCachedInternalDomains(): string[] {
  return cachedInternalDomains || [...INTERNAL_DOMAINS];
}

/**
 * Determine user type based on email domain
 * Uses cached domains for synchronous access (call loadInternalDomains first for accuracy)
 * @param email - User's email address
 * @returns 'internal' if email matches internal domain, 'external' otherwise
 */
export function getUserTypeFromEmail(email: string | null | undefined): UserType {
  if (!email) return 'external';

  const domain = email.toLowerCase().split('@')[1];
  if (!domain) return 'external';

  const internalDomains = getCachedInternalDomains();
  return internalDomains.some((d) => domain === d) ? 'internal' : 'external';
}

/**
 * Async version of getUserTypeFromEmail that loads fresh domains from database
 */
export async function getUserTypeFromEmailAsync(email: string | null | undefined): Promise<UserType> {
  if (!email) return 'external';

  const domain = email.toLowerCase().split('@')[1];
  if (!domain) return 'external';

  const internalDomains = await loadInternalDomains();
  return internalDomains.some((d) => domain === d) ? 'internal' : 'external';
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
  '/settings/user',
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
