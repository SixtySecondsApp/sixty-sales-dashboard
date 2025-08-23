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
  '/auth/reset-password'
];

export function ProtectedRoute({ children, redirectTo = '/auth/login' }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isPublicRoute = publicRoutes.includes(location.pathname);
  const isPasswordRecovery = location.pathname === '/auth/reset-password' && 
    location.hash.includes('type=recovery');
  
  // TEMPORARY: Allow access in development mode for testing
  const isDevelopmentBypass = import.meta.env.DEV && (location.pathname === '/' || location.pathname === '/dashboard');
  
  // Debug logging
  if (import.meta.env.DEV) {
    console.log('ProtectedRoute Debug:', {
      pathname: location.pathname,
      isAuthenticated,
      loading,
      isPublicRoute,
      isDevelopmentBypass
    });
  }

  useEffect(() => {
    // TEMPORARY: Skip all redirects in development for testing
    if (import.meta.env.DEV) {
      return;
    }
    
    // Don't redirect while loading
    if (loading) return;

    // If user is authenticated and on a public route (except password recovery), redirect to app
    if (isAuthenticated && isPublicRoute && !isPasswordRecovery) {
      navigate('/');
      return;
    }

    // If user is not authenticated and trying to access protected route, redirect to login
    if (!isAuthenticated && !isPublicRoute && !isPasswordRecovery && !isDevelopmentBypass) {
      // Store the intended destination for after login
      const intendedPath = location.pathname + location.search;
      navigate(redirectTo, { 
        state: { from: intendedPath },
        replace: true 
      });
      return;
    }
  }, [isAuthenticated, loading, isPublicRoute, isPasswordRecovery, isDevelopmentBypass, navigate, redirectTo, location]);

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

  // TEMPORARY: Allow all access in development for testing
  if (import.meta.env.DEV) {
    return <>{children}</>;
  }
  
  // For protected routes, only show content if authenticated
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // This should not happen due to useEffect redirect, but just in case
  return null;
} 