import { useEffect } from 'react';
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
  '/debug-auth'
];

export function ProtectedRoute({ children, redirectTo = '/auth/login' }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isPublicRoute = publicRoutes.includes(location.pathname);
  const isPasswordRecovery = location.pathname === '/auth/reset-password' && 
    location.hash.includes('type=recovery');
  
  // TEMPORARY DEV: Allow roadmap access in development for ticket implementation
  const isDevModeBypass = process.env.NODE_ENV === 'development' && 
    location.pathname.startsWith('/roadmap');

  useEffect(() => {
    console.log('ProtectedRoute:', {
      pathname: location.pathname,
      isAuthenticated,
      loading,
      isPublicRoute
    });
    
    // Don't redirect while loading
    if (loading) return;

    // If user is authenticated and on a public route (except password recovery), redirect to app
    if (isAuthenticated && isPublicRoute && !isPasswordRecovery) {
      navigate('/');
      return;
    }

    // If user is not authenticated and trying to access protected route, redirect to login
    // TEMPORARY DEV: Skip redirect for roadmap in development
    if (!isAuthenticated && !isPublicRoute && !isPasswordRecovery && !isDevModeBypass) {
      // Store the intended destination for after login
      const intendedPath = location.pathname + location.search;
      navigate(redirectTo, { 
        state: { from: intendedPath },
        replace: true 
      });
      return;
    }
  }, [isAuthenticated, loading, isPublicRoute, isPasswordRecovery, isDevModeBypass, navigate, redirectTo, location]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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

  // This should not happen due to useEffect redirect, but just in case
  return null;
} 