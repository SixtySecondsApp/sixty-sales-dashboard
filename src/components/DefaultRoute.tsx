import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useEffectiveUserType, usePermissionsLoading } from '@/contexts/UserPermissionsContext';
import { Loader2 } from 'lucide-react';

/**
 * DefaultRoute - Handles root path (/) routing ONLY
 *
 * This component should ONLY be rendered when the user is exactly on "/"
 * It should NOT affect any other routes like /dashboard, /crm, etc.
 *
 * - Authenticated users on "/" → /dashboard
 * - Unauthenticated users on "/" → /auth/login
 */
export function DefaultRoute() {
  const { isAuthenticated, loading } = useAuth();
  const effectiveUserType = useEffectiveUserType();
  const permissionsLoading = usePermissionsLoading();
  const location = useLocation();

  // Safety check: This should ONLY run for the root path
  // If somehow this component is rendered for another path, don't redirect
  if (location.pathname !== '/') {
    console.warn('[DefaultRoute] Rendered for non-root path:', location.pathname);
    return null;
  }

  // Show loading while checking auth status / permissions
  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.25),transparent)] pointer-events-none" />
        <Loader2 className="w-8 h-8 text-[#37bd7e] animate-spin" />
      </div>
    );
  }

  // Redirect based on authentication status
  if (isAuthenticated) {
    return <Navigate to={effectiveUserType === 'external' ? '/meetings' : '/dashboard'} replace />;
  }

  return <Navigate to="/auth/login" replace />;
}
