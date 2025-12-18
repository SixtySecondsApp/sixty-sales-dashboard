import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Import landing package styles (includes Inter font and landing-specific CSS)
import '../../packages/landing/src/styles/index.css';

// Note: Main app's Supabase client is set in App.tsx before this module loads

// Loading component for landing pages
const LandingLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-black">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
  </div>
);

// Lazy load landing pages from the landing package
// Only load in development mode to avoid bundling in production
const MeetingsLandingV4 = import.meta.env.DEV
  ? lazy(() => import('../../packages/landing/src/pages/MeetingsLandingV4').then(m => ({ default: m.MeetingsLandingV4 })))
  : () => <Navigate to="/" replace />;

const WaitlistLanding = import.meta.env.DEV
  ? lazy(() => import('../../packages/landing/src/pages/WaitlistLanding'))
  : () => <Navigate to="/" replace />;

const EarlyAccessLanding = import.meta.env.DEV
  ? lazy(() => import('../../packages/landing/src/pages/EarlyAccessLanding'))
  : () => <Navigate to="/" replace />;

const PricingPage = import.meta.env.DEV
  ? lazy(() => import('../../packages/landing/src/pages/PricingPage').then(m => ({ default: m.PricingPage })))
  : () => <Navigate to="/" replace />;

const WaitlistStatus = import.meta.env.DEV
  ? lazy(() => import('../../packages/landing/src/pages/WaitlistStatus'))
  : () => <Navigate to="/" replace />;

const LeaderboardLookup = import.meta.env.DEV
  ? lazy(() => import('../../packages/landing/src/pages/LeaderboardLookup'))
  : () => <Navigate to="/" replace />;

const WaitlistThankYouPage = import.meta.env.DEV
  ? lazy(() => import('../../packages/landing/src/pages/WaitlistThankYouPage'))
  : () => <Navigate to="/" replace />;

const IntroductionPage = import.meta.env.DEV
  ? lazy(() => import('../../packages/landing/src/pages/IntroductionPage').then(m => ({ default: m.IntroductionPage })))
  : () => <Navigate to="/" replace />;

const IntroPage = import.meta.env.DEV
  ? lazy(() => import('../../packages/landing/src/pages/IntroPage').then(m => ({ default: m.IntroPage })))
  : () => <Navigate to="/" replace />;

const LearnMore = lazy(() => import('../../packages/landing/src/pages/LearnMore').then(m => ({ default: m.LearnMore })));

/**
 * LandingWrapper - Development-only component for viewing landing pages locally
 *
 * In development: Serves landing pages at /landing, /landing/waitlist, /landing/pricing
 * In production: Redirects to home (landing pages are deployed separately)
 *
 * Usage:
 * - localhost:5175/landing - Main landing page
 * - localhost:5175/landing/waitlist - Waitlist page
 * - localhost:5175/landing/pricing - Pricing page
 */
export function LandingWrapper() {
  // In production, redirect away from landing routes
  if (!import.meta.env.DEV) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense fallback={<LandingLoader />}>
      <Routes>
        <Route index element={<MeetingsLandingV4 />} />
        <Route path="waitlist" element={<WaitlistLanding />} />
        <Route path="pricing" element={<PricingPage />} />
        {/* For /landing/* routes, redirect to /landing if unmatched */}
        <Route path="*" element={<Navigate to="/landing" replace />} />
      </Routes>
    </Suspense>
  );
}

// Standalone waitlist page wrapper for /waitlist route
export function WaitlistPageWrapper() {
  if (!import.meta.env.DEV) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense fallback={<LandingLoader />}>
      <Routes>
        <Route index element={<EarlyAccessLanding />} />
        <Route path="thank-you" element={<WaitlistThankYouPage />} />
        <Route path="status/:id" element={<WaitlistStatus />} />
        <Route path="leaderboard" element={<LeaderboardLookup />} />
      </Routes>
    </Suspense>
  );
}

// Waitlist status page wrapper (for /waitlist/status/:id route - standalone)
export function WaitlistStatusPage() {
  if (!import.meta.env.DEV) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense fallback={<LandingLoader />}>
      <WaitlistStatus />
    </Suspense>
  );
}

// Leaderboard page wrapper (for /leaderboard route - standalone)
export function LeaderboardPageWrapper() {
  if (!import.meta.env.DEV) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense fallback={<LandingLoader />}>
      <LeaderboardLookup />
    </Suspense>
  );
}

// Introduction page wrapper (for /introduction route - standalone)
export function IntroductionPageWrapper() {
  if (!import.meta.env.DEV) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense fallback={<LandingLoader />}>
      <IntroductionPage />
    </Suspense>
  );
}

// Intro page wrapper (for /intro route - standalone)
export function IntroPageWrapper() {
  if (!import.meta.env.DEV) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense fallback={<LandingLoader />}>
      <IntroPage />
    </Suspense>
  );
}

// Learn More page wrapper (for /learnmore route - always available)
export function LearnMorePageWrapper() {
  return (
    <Suspense fallback={<LandingLoader />}>
      <LearnMore />
    </Suspense>
  );
}
