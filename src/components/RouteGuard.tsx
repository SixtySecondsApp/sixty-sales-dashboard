/**
 * RouteGuard - Route-Level Access Control
 *
 * Protects routes based on user type (internal vs external) and admin status.
 * Silently redirects unauthorized users to an appropriate fallback route.
 */

import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';
import { type RouteAccess } from '@/lib/routes/routeConfig';

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
 * // Internal-only route
 * <Route path="/crm" element={
 *   <RouteGuard requiredAccess="internal">
 *     <CRMPage />
 *   </RouteGuard>
 * } />
 *
 * // Admin-only route
 * <Route path="/admin" element={
 *   <RouteGuard requiredAccess="admin">
 *     <AdminPage />
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
  const location = useLocation();
  const { effectiveUserType, isAdmin, getRedirectForUnauthorized } = useUserPermissions();

  // Determine if user has access
  const hasAccess = React.useMemo(() => {
    switch (requiredAccess) {
      case 'any':
        return true;
      case 'internal':
        return effectiveUserType === 'internal';
      case 'admin':
        return effectiveUserType === 'internal' && isAdmin;
      default:
        return true;
    }
  }, [requiredAccess, effectiveUserType, isAdmin]);

  // Redirect if no access
  useEffect(() => {
    if (!hasAccess) {
      const redirectTo = fallbackRoute || getRedirectForUnauthorized();
      // Use replace to avoid adding to history (user can't "back" into restricted page)
      navigate(redirectTo, { replace: true });
    }
  }, [hasAccess, fallbackRoute, getRedirectForUnauthorized, navigate]);

  // Don't render children while redirecting
  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Route guard specifically for internal-only routes
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
 * Route guard specifically for admin-only routes
 */
export function AdminRouteGuard({
  children,
  fallbackRoute,
}: {
  children: React.ReactNode;
  fallbackRoute?: string;
}) {
  return (
    <RouteGuard requiredAccess="admin" fallbackRoute={fallbackRoute}>
      {children}
    </RouteGuard>
  );
}

/**
 * Hook to check route access without rendering a component
 * Useful for programmatic navigation decisions
 */
export function useRouteAccess(requiredAccess: RouteAccess): boolean {
  const { effectiveUserType, isAdmin } = useUserPermissions();

  switch (requiredAccess) {
    case 'any':
      return true;
    case 'internal':
      return effectiveUserType === 'internal';
    case 'admin':
      return effectiveUserType === 'internal' && isAdmin;
    default:
      return true;
  }
}

export default RouteGuard;
