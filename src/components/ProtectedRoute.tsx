import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useOnboardingProgress } from '@/lib/hooks/useOnboardingProgress';
import { supabase } from '@/lib/supabase/clientV2';
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
  '/auth/verify-email',
  '/debug-auth',
  '/auth/google/callback',
  '/oauth/fathom/callback',
  '/waitlist',
  '/pricing'
];

// Routes that require auth but should show loading instead of redirecting immediately
const authRequiredRoutes = [
  '/onboarding',
  '/meetings',
  '/dashboard',
  '/'
];

// Routes that should NOT trigger onboarding redirect (allow completing onboarding)
const onboardingExemptRoutes = [
  '/onboarding',
  '/auth',
  '/debug',
  '/oauth',
  '/platform/onboarding-simulator',
  '/platform/email-templates' // Allow access to email templates during onboarding
];

export function ProtectedRoute({ children, redirectTo = '/auth/login' }: ProtectedRouteProps) {
  const { isAuthenticated, loading, user } = useAuth();
  const { needsOnboarding, loading: onboardingLoading } = useOnboardingProgress();
  const navigate = useNavigate();
  const location = useLocation();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(true);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isPublicRoute = publicRoutes.includes(location.pathname);
  const isVerifyEmailRoute = location.pathname === '/auth/verify-email';
  const isPasswordRecovery = location.pathname === '/auth/reset-password' &&
    location.hash.includes('type=recovery');
  const isOAuthCallback = location.pathname.includes('/oauth/') || location.pathname.includes('/callback');
  const isAuthRequiredRoute = authRequiredRoutes.some(route =>
    location.pathname === route || location.pathname.startsWith(route + '/')
  );
  const isOnboardingExempt = onboardingExemptRoutes.some(route =>
    location.pathname === route || location.pathname.startsWith(route)
  );

  // TEMPORARY DEV: Allow roadmap access in development for ticket implementation
  const isDevModeBypass = process.env.NODE_ENV === 'development' &&
    location.pathname.startsWith('/roadmap');

  // Check email verification status
  useEffect(() => {
    const checkEmailVerification = async () => {
      // Skip check for public routes
      if (isPublicRoute) {
        setIsCheckingEmail(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setEmailVerified(!!session.user.email_confirmed_at);
        } else {
          setEmailVerified(null);
        }
      } catch (err) {
        console.error('Error checking email verification:', err);
        setEmailVerified(null);
      } finally {
        setIsCheckingEmail(false);
      }
    };

    if (!loading) {
      checkEmailVerification();
    }
  }, [loading, isPublicRoute]);

  useEffect(() => {
    // Clean up timeout on unmount
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Don't redirect while loading auth, onboarding status, or email verification
    if (loading || onboardingLoading || isCheckingEmail) return;

    // If user is authenticated but email is not verified, redirect to verify-email
    // Skip this for public routes and the verify-email page itself
    if (isAuthenticated && emailVerified === false && !isPublicRoute && !isVerifyEmailRoute) {
      const userEmail = user?.email || '';
      navigate(`/auth/verify-email?email=${encodeURIComponent(userEmail)}`, { replace: true });
      return;
    }

    // If user is authenticated (and email verified) and on a public route (except password recovery and OAuth callbacks), redirect to app
    if (isAuthenticated && emailVerified && isPublicRoute && !isPasswordRecovery && !isOAuthCallback && !isVerifyEmailRoute) {
      // If user needs onboarding, redirect to onboarding instead of app
      if (needsOnboarding) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/');
      }
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

    // If user is authenticated (with verified email) but hasn't completed onboarding, redirect to onboarding
    // Skip this check for onboarding-exempt routes (like the onboarding page itself)
    if (isAuthenticated && emailVerified && needsOnboarding && !isOnboardingExempt && !isPublicRoute) {
      navigate('/onboarding', { replace: true });
      return;
    }
  }, [isAuthenticated, loading, onboardingLoading, isCheckingEmail, emailVerified, needsOnboarding, isPublicRoute, isVerifyEmailRoute, isPasswordRecovery, isDevModeBypass, isAuthRequiredRoute, isOnboardingExempt, navigate, redirectTo, location, isRedirecting, user?.email]);

  // Show loading spinner while checking authentication, onboarding status, email verification, or during redirect delay
  if (loading || onboardingLoading || isCheckingEmail || isRedirecting) {
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