import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUserPermissions } from '@/contexts/UserPermissionsContext';

/**
 * ExternalAccessGate
 *
 * Centralized route protection for external users (and internal users who
 * toggle "view as external"). This prevents direct-URL access to internal/admin/debug
 * routes without having to wrap every route individually.
 */
export function ExternalAccessGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoading, canAccessRoute, getRedirectForUnauthorized } = useUserPermissions();

  useEffect(() => {
    if (isLoading) return;

    const pathname = location.pathname;
    if (!canAccessRoute(pathname)) {
      navigate(getRedirectForUnauthorized(), { replace: true });
    }
  }, [isLoading, location.pathname, canAccessRoute, getRedirectForUnauthorized, navigate]);

  return <>{children}</>;
}

export default ExternalAccessGate;

