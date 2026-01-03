/**
 * User Type Utilities
 *
 * Functions for determining user type from email and computing feature access.
 * Uses an email-domain allowlist approach:
 * - Internal users: email domain matches an active record in `internal_email_domains`
 * - External users: everyone else
 *
 * Safe default: if domains cannot be loaded, treat everyone as external
 * (except for the hardcoded bootstrap domain `sixtyseconds.video`).
 */

import {
  type UserType,
  type FeatureAccess,
  type ViewModeState,
  EXTERNAL_FEATURE_ACCESS,
  INTERNAL_FEATURE_ACCESS,
} from '@/lib/types/userTypes';
import { supabase } from '@/lib/supabase/clientV2';

// Cache for internal email domains loaded from database
let cachedInternalDomains: Set<string> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const DEFAULT_INTERNAL_DOMAIN = 'sixtyseconds.video';

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@/, '');
}

function extractEmailDomain(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at <= 0 || at === normalized.length - 1) return null;
  return normalized.slice(at + 1);
}

/**
 * Load internal email domains from database (with caching).
 * Returns a set containing only DEFAULT_INTERNAL_DOMAIN if the table is missing.
 * Returns empty set if database unavailable (safe default - external).
 */
export async function loadInternalDomains(): Promise<Set<string>> {
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
      // If the table doesn't exist yet, fall back to the bootstrap domain.
      // (Supabase returns 42P01 for missing relations.)
      if ((error as any)?.code === '42P01') {
        cachedInternalDomains = new Set([DEFAULT_INTERNAL_DOMAIN]);
        cacheTimestamp = now;
        return cachedInternalDomains;
      }

      console.error('[Internal Domains] Failed to load from database:', error);
      return cachedInternalDomains || new Set();
    }

    if (data && data.length > 0) {
      cachedInternalDomains = new Set(data.map(d => normalizeDomain((d as any).domain)));
      cacheTimestamp = now;
      return cachedInternalDomains;
    }

    // Empty allowlist = everyone is external (safe default)
    cachedInternalDomains = new Set();
    cacheTimestamp = now;
    return cachedInternalDomains;
  } catch (error) {
    console.error('[Internal Domains] Exception loading domains:', error);
    return cachedInternalDomains || new Set();
  }
}

/**
 * Clear the internal domains cache (call when allowlist is updated).
 */
export function clearInternalDomainsCache(): void {
  cachedInternalDomains = null;
  cacheTimestamp = 0;
}

/**
 * Get currently cached internal domains (synchronous, for initial render).
 * Returns empty set if cache is empty (safe default - external).
 */
export function getCachedInternalDomainsSet(): Set<string> {
  return cachedInternalDomains || new Set();
}

/**
 * Determine user type based on email domain allowlist.
 * Uses cached allowlist for synchronous access (call loadInternalDomains first for accuracy).
 * @param email - User's email address
 * @returns 'internal' if email domain matches allowlist, 'external' otherwise
 */
export function getUserTypeFromEmail(email: string | null | undefined): UserType {
  if (!email) return 'external';

  const domain = extractEmailDomain(email);
  if (!domain) return 'external';

  const internalDomains = getCachedInternalDomainsSet();
  const isInternal = internalDomains.has(domain);

  return isInternal ? 'internal' : 'external';
}

/**
 * Async version of getUserTypeFromEmail that loads fresh whitelist from database
 */
export async function getUserTypeFromEmailAsync(email: string | null | undefined): Promise<UserType> {
  if (!email) return 'external';

  const domain = extractEmailDomain(email);
  if (!domain) return 'external';

  const internalDomains = await loadInternalDomains();
  return internalDomains.has(domain) ? 'internal' : 'external';
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
  '/insights',
  '/insights/team',
  '/insights/content-topics',
  '/integrations',
  '/copilot',
  '/profile',
  '/settings',
  '/onboarding',
];

// Routes that match with dynamic segments (e.g., /meetings/:id)
const EXTERNAL_ALLOWED_DYNAMIC_ROUTES = [
  '/meetings/', // Matches /meetings/:id
  '/settings/', // Matches /settings/*
];

// External users can generally use /settings/*, but must not access these.
const EXTERNAL_BLOCKED_ROUTE_PREFIXES = [
  '/platform',
  '/admin',
  '/saas-admin',
  '/debug',
  '/test-',
  '/freepik-flow',
  '/settings/team-members',
  '/settings/organization',
  '/settings/branding',
  '/settings/billing',
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
    // Block known internal/admin/debug routes even if they might match other rules
    if (EXTERNAL_BLOCKED_ROUTE_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))) {
      return false;
    }

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
export function getCachedInternalDomains(): string[] {
  return Array.from(getCachedInternalDomainsSet());
}

// Legacy alias for backwards compatibility (older code expects this name)
export const loadInternalUsers = loadInternalDomains;
