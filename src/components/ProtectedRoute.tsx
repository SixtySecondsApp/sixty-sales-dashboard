import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

const publicRoutes = [
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/callback',
  '/auth/sso-callback',
  '/debug-auth',
  '/auth/google/callback',
  '/oauth/fathom/callback'
];

// Routes that require auth but should show loading instead of redirecting immediately
const authRequiredRoutes = [
  '/onboarding',
  '/meetings',
  '/dashboard',
  '/'
];

export function ProtectedRoute({ children, redirectTo = '/auth/login' }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isPublicRoute = publicRoutes.includes(location.pathname);
  const isPasswordRecovery = location.pathname === '/auth/reset-password' &&
    location.hash.includes('type=recovery');
  const isOAuthCallback = location.pathname.includes('/oauth/') || location.pathname.includes('/callback');
  const isAuthRequiredRoute = authRequiredRoutes.some(route =>
    location.pathname === route || location.pathname.startsWith(route + '/')
  );

  // TEMPORARY DEV: Allow roadmap access in development for ticket implementation
  const isDevModeBypass = process.env.NODE_ENV === 'development' &&
    location.pathname.startsWith('/roadmap');

  useEffect(() => {
    // Clean up timeout on unmount
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Don't redirect while loading
    if (loading) return;

    // If user is authenticated and on a public route (except password recovery and OAuth callbacks), redirect to app
    if (isAuthenticated && isPublicRoute && !isPasswordRecovery && !isOAuthCallback) {
      navigate('/');
      return;
    }

    // If user is not authenticated and trying to access protected route, redirect to login
    // TEMPORARY DEV: Skip redirect for roadmap in development
    if (!isAuthenticated && !isPublicRoute && !isPasswordRecovery && !isDevModeBypass) {
      // For auth-required routes, add a small delay to allow for race conditions
      // This helps when navigating from onboarding where auth state might momentarily be stale
      if (isAuthRequiredRoute && !isRedirecting) {
        setIsRedirecting(true);
        redirectTimeoutRef.current = setTimeout(() => {
          // Re-check auth state after delay
          if (!isAuthenticated) {
            const intendedPath = location.pathname + location.search;
            navigate(redirectTo, {
              state: { from: intendedPath },
              replace: true
            });
          }
          setIsRedirecting(false);
        }, 500); // Small delay to allow auth state to settle
        return;
      }

      // Store the intended destination for after login
      const intendedPath = location.pathname + location.search;
      navigate(redirectTo, {
        state: { from: intendedPath },
        replace: true
      });
      return;
    }
  }, [isAuthenticated, loading, isPublicRoute, isPasswordRecovery, isDevModeBypass, isAuthRequiredRoute, navigate, redirectTo, location, isRedirecting]);

  // Show loading spinner while checking authentication or during redirect delay
  if (loading || isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.25),transparent)] pointer-events-none" />
        <Loader2 className="w-8 h-8 text-[#37bd7e] animate-spin" />
      </div>
    );
  }

  // For password recovery, always show the content regardless of auth state
  if (isPasswordRecovery) {
    return <>{children}</>;
  }

  // For public routes, show content if not authenticated or if authenticated (AuthContext will handle redirect)
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // For protected routes, only show content if authenticated
  // TEMPORARY DEV: Allow roadmap access in development
  if (isAuthenticated || isDevModeBypass) {
    return <>{children}</>;
  }

  // Show loading instead of null to prevent flash
  // The useEffect will handle the redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.25),transparent)] pointer-events-none" />
      <Loader2 className="w-8 h-8 text-[#37bd7e] animate-spin" />
    </div>
  );
} 