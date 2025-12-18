/**
 * RouteGuard - Route-Level Access Control
 *
 * Protects routes based on the 3-tier permission system:
 * - Tier 1: User (all authenticated users)
 * - Tier 2: Org Admin (org owners/admins)
 * - Tier 3: Platform Admin (internal + is_admin)
 *
 * Silently redirects unauthorized users to an appropriate fallback route.
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

// Extended route access type for 3-tier system
export type RouteAccess =
  | 'any'           // All authenticated users
  | 'internal'      // Internal users only (legacy support)
  | 'external'      // External users only
  | 'admin'         // Legacy - maps to platformAdmin
  | 'orgAdmin'      // Org admins (owner/admin role) or platform admins
  | 'platformAdmin'; // Platform admins only (internal + is_admin)

interface RouteGuardProps {
  /** Content to render if user has access */
  children: React.ReactNode;
  /** Required access level for this route */
  requiredAccess?: RouteAccess;
  /** Route to redirect to if unauthorized (defaults to / or /meetings based on user type) */
  fallbackRoute?: string;
}

/**
 * Wrap routes that need access control
 *
 * @example
 * ```tsx
 * // Any authenticated user
 * <Route path="/settings" element={
 *   <RouteGuard requiredAccess="any">
 *     <SettingsPage />
 *   </RouteGuard>
 * } />
 *
 * // Org Admin route (team management)
 * <Route path="/team/team" element={
 *   <RouteGuard requiredAccess="orgAdmin">
 *     <TeamManagement />
 *   </RouteGuard>
 * } />
 *
 * // Platform Admin route (system configuration)
 * <Route path="/platform" element={
 *   <RouteGuard requiredAccess="platformAdmin">
 *     <PlatformDashboard />
 *   </RouteGuard>
 * } />
 * ```
 */
export function RouteGuard({
  children,
  requiredAccess = 'any',
  fallbackRoute,
}: RouteGuardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    isLoading: isPermissionsLoading,
    effectiveUserType,
    isAdmin,
    isPlatformAdmin,
    isOrgAdmin,
    getRedirectForUnauthorized,
  } = useUserPermissions();
  
  // Wait for user to be loaded AND permissions to be loaded before checking
  const isUserLoading = !user;
  const isFullyLoaded = !isUserLoading && !isPermissionsLoading;

  // Determine if user has access based on 3-tier model
  const hasAccess = React.useMemo(() => {
    // Wait for everything to load before checking permissions
    // During loading, we don't know yet - return undefined
    if (!isFullyLoaded) {
      return undefined; // Still loading
    }

    const access = (() => {
      switch (requiredAccess) {
        case 'any':
          return true;

        case 'internal':
          // Internal users only (legacy support)
          return effectiveUserType === 'internal';

        case 'external':
          // External users only
          return effectiveUserType === 'external';

        case 'admin':
        case 'platformAdmin':
          // Tier 3: Platform Admin (internal + is_admin)
          return isPlatformAdmin;

        case 'orgAdmin':
          // Tier 2: Org Admin (org role owner/admin) OR Platform Admin
          return isOrgAdmin || isPlatformAdmin;

        default:
          return true;
      }
    })();

    // Debug logging
    if (requiredAccess === 'platformAdmin') {
      console.log('[RouteGuard] Platform Admin Check:', {
        requiredAccess,
        isPlatformAdmin,
        effectiveUserType,
        isAdmin,
        hasAccess: access,
        isUserLoading,
        isPermissionsLoading,
        isFullyLoaded,
        pathname: window.location.pathname,
      });
    }

    return access;
  }, [requiredAccess, effectiveUserType, isPlatformAdmin, isOrgAdmin, isAdmin, isUserLoading, isPermissionsLoading, isFullyLoaded]);

  // Redirect if no access (only after fully loaded and confirmed no access)
  useEffect(() => {
    // Only redirect if we're fully loaded AND access is explicitly false
    // Don't redirect if hasAccess is undefined (still loading)
    if (isFullyLoaded && hasAccess === false) {
      const redirectTo = fallbackRoute || getRedirectForUnauthorized();
      // Use replace to avoid adding to history (user can't "back" into restricted page)
      navigate(redirectTo, { replace: true });
    }
  }, [hasAccess, fallbackRoute, getRedirectForUnauthorized, navigate, isFullyLoaded]);

  // Show loading spinner while permissions are loading
  if (hasAccess === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.25),transparent)] pointer-events-none" />
        <Loader2 className="w-8 h-8 text-[#37bd7e] animate-spin" />
      </div>
    );
  }

  // Don't render children while redirecting
  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Route guard specifically for internal-only routes (legacy support)
 */
export function InternalRouteGuard({
  children,
  fallbackRoute,
}: {
  children: React.ReactNode;
  fallbackRoute?: string;
}) {
  return (
    <RouteGuard requiredAccess="internal" fallbackRoute={fallbackRoute}>
      {children}
    </RouteGuard>
  );
}

/**
 * Route guard for Org Admin routes (Tier 2)
 * Allows org owners/admins and platform admins
 *
 * Use for: Team management, org branding, org settings
 */
export function OrgAdminRouteGuard({
  children,
  fallbackRoute = '/settings',
}: {
  children: React.ReactNode;
  fallbackRoute?: string;
}) {
  return (
    <RouteGuard requiredAccess="orgAdmin" fallbackRoute={fallbackRoute}>
      {children}
    </RouteGuard>
  );
}

/**
 * Route guard for Platform Admin routes (Tier 3)
 * Only allows internal users with is_admin flag
 *
 * Use for: System configuration, customer management, all admin features
 */
export function PlatformAdminRouteGuard({
  children,
  fallbackRoute = '/',
}: {
  children: React.ReactNode;
  fallbackRoute?: string;
}) {
  return (
    <RouteGuard requiredAccess="platformAdmin" fallbackRoute={fallbackRoute}>
      {children}
    </RouteGuard>
  );
}

/**
 * Hook to check route access without rendering a component
 * Useful for programmatic navigation decisions
 */
export function useRouteAccess(requiredAccess: RouteAccess): boolean {
  const {
    effectiveUserType,
    isPlatformAdmin,
    isOrgAdmin,
  } = useUserPermissions();

  switch (requiredAccess) {
    case 'any':
      return true;
    case 'internal':
      return effectiveUserType === 'internal';
    case 'external':
      return effectiveUserType === 'external';
    case 'admin':
    case 'platformAdmin':
      return isPlatformAdmin;
    case 'orgAdmin':
      return isOrgAdmin || isPlatformAdmin;
    default:
      return true;
  }
}

export default RouteGuard;
