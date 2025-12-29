/**
 * Page View Tracker
 * Lightweight page view tracking with UTM parameters for landing pages
 * Works alongside GA4 for additional first-party data collection
 */

import { supabase } from './supabase/clientV2';

interface PageViewData {
  session_id: string;
  visitor_id: string | null;
  landing_page: string;
  full_url: string;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  utm_id: string | null;
  fbclid: string | null;
  device_type: string;
  browser: string | null;
}

/**
 * Generate a unique session ID (stored in sessionStorage)
 */
function getOrCreateSessionId(): string {
  const key = 'use60_session_id';
  let sessionId = sessionStorage.getItem(key);

  if (!sessionId) {
    sessionId = `s_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem(key, sessionId);
  }

  return sessionId;
}

/**
 * Generate a persistent visitor ID (stored in localStorage)
 * This helps track unique visitors across sessions
 */
function getOrCreateVisitorId(): string | null {
  try {
    const key = 'use60_visitor_id';
    let visitorId = localStorage.getItem(key);

    if (!visitorId) {
      visitorId = `v_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem(key, visitorId);
    }

    return visitorId;
  } catch {
    // localStorage might be blocked
    return null;
  }
}

/**
 * Extract UTM parameters from URL
 */
function extractUTMParams(url: URL): {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  utm_id: string | null;
  fbclid: string | null;
} {
  return {
    utm_source: url.searchParams.get('utm_source'),
    utm_medium: url.searchParams.get('utm_medium'),
    utm_campaign: url.searchParams.get('utm_campaign'),
    utm_content: url.searchParams.get('utm_content'),
    utm_term: url.searchParams.get('utm_term'),
    utm_id: url.searchParams.get('utm_id'),
    fbclid: url.searchParams.get('fbclid'),
  };
}

/**
 * Detect device type based on screen width and user agent
 */
function getDeviceType(): string {
  const width = window.innerWidth;
  const ua = navigator.userAgent.toLowerCase();

  // Check for mobile indicators in user agent
  const isMobileUA = /mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua);
  const isTabletUA = /tablet|ipad/i.test(ua);

  if (isTabletUA || (isMobileUA && width >= 768)) {
    return 'tablet';
  }
  if (isMobileUA || width < 768) {
    return 'mobile';
  }
  return 'desktop';
}

/**
 * Get browser name from user agent
 */
function getBrowserName(): string | null {
  const ua = navigator.userAgent;

  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';

  return null;
}

/**
 * Normalize landing page path for consistent tracking
 */
function normalizeLandingPage(pathname: string): string {
  // Remove trailing slashes
  let normalized = pathname.replace(/\/+$/, '') || '/';

  // Map known variations
  const pageMap: Record<string, string> = {
    '/': '/landing',
    '/landing': '/landing',
    '/waitlist': '/waitlist',
    '/intro': '/intro',
    '/introducing': '/introducing',
    '/introduction': '/introduction',
    '/join': '/join',
    '/pricing': '/pricing',
    '/learnmore': '/learnmore',
  };

  return pageMap[normalized] || normalized;
}

/**
 * Store UTM params in sessionStorage for conversion attribution
 * These will be passed to the waitlist form for accurate tracking
 */
function storeUTMParams(utmParams: ReturnType<typeof extractUTMParams>): void {
  try {
    // Only store if we have UTM params
    const hasParams = Object.values(utmParams).some(v => v !== null);
    if (hasParams) {
      sessionStorage.setItem('use60_utm_params', JSON.stringify(utmParams));
    }
  } catch {
    // sessionStorage might be blocked
  }
}

/**
 * Get stored UTM params for form attribution
 */
export function getStoredUTMParams(): ReturnType<typeof extractUTMParams> | null {
  try {
    const stored = sessionStorage.getItem('use60_utm_params');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

/**
 * Track a page view
 * This is fire-and-forget - it won't block page rendering
 */
export async function trackPageView(): Promise<void> {
  // Don't track in development or if SSR
  if (typeof window === 'undefined') return;
  if (window.location.hostname === 'localhost') return;

  try {
    const url = new URL(window.location.href);
    const utmParams = extractUTMParams(url);

    // Store UTM params for later conversion attribution
    storeUTMParams(utmParams);

    const pageViewData: PageViewData = {
      session_id: getOrCreateSessionId(),
      visitor_id: getOrCreateVisitorId(),
      landing_page: normalizeLandingPage(url.pathname),
      full_url: window.location.href,
      referrer: document.referrer || null,
      ...utmParams,
      device_type: getDeviceType(),
      browser: getBrowserName(),
    };

    // Fire and forget - don't await
    supabase
      .from('page_views')
      .insert(pageViewData)
      .then(({ error }) => {
        if (error) {
          console.warn('[PageView] Failed to track:', error.message);
        }
      })
      .catch((err) => {
        console.warn('[PageView] Error:', err);
      });

  } catch (error) {
    // Silently fail - tracking should never break the page
    console.warn('[PageView] Tracking error:', error);
  }
}

/**
 * React hook for page view tracking
 * Call this in your page components
 */
export function usePageViewTracking(): void {
  // Using dynamic import to avoid SSR issues
  if (typeof window !== 'undefined') {
    // Track on first render only
    const tracked = sessionStorage.getItem(`use60_tracked_${window.location.pathname}`);
    if (!tracked) {
      trackPageView();
      sessionStorage.setItem(`use60_tracked_${window.location.pathname}`, 'true');
    }
  }
}

/**
 * Track a partial signup (email entered but form not completed)
 * Call this onBlur of the email field when email is valid
 */
export async function trackPartialSignup(email: string, formStep: string = 'email'): Promise<void> {
  // Don't track in development or if SSR
  if (typeof window === 'undefined') return;
  if (window.location.hostname === 'localhost') return;
  if (!email || !email.includes('@')) return;

  try {
    const url = new URL(window.location.href);
    const utmParams = extractUTMParams(url);
    const sessionId = getOrCreateSessionId();

    const partialSignupData = {
      email: email.toLowerCase().trim(),
      session_id: sessionId,
      visitor_id: getOrCreateVisitorId(),
      landing_page: normalizeLandingPage(url.pathname),
      form_step: formStep,
      ...utmParams,
    };

    // Upsert - update if email+session exists, insert if not
    supabase
      .from('partial_signups')
      .upsert(partialSignupData, {
        onConflict: 'email,session_id',
        ignoreDuplicates: false,
      })
      .then(({ error }) => {
        if (error) {
          console.warn('[PartialSignup] Failed to track:', error.message);
        }
      })
      .catch((err) => {
        console.warn('[PartialSignup] Error:', err);
      });

  } catch (error) {
    console.warn('[PartialSignup] Tracking error:', error);
  }
}

/**
 * Mark a partial signup as converted (called on successful form submission)
 */
export async function markPartialSignupConverted(email: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.location.hostname === 'localhost') return;
  if (!email) return;

  try {
    const sessionId = getOrCreateSessionId();

    supabase
      .from('partial_signups')
      .update({
        converted: true,
        converted_at: new Date().toISOString(),
      })
      .eq('email', email.toLowerCase().trim())
      .eq('session_id', sessionId)
      .then(({ error }) => {
        if (error) {
          console.warn('[PartialSignup] Failed to mark converted:', error.message);
        }
      })
      .catch((err) => {
        console.warn('[PartialSignup] Error:', err);
      });

  } catch (error) {
    console.warn('[PartialSignup] Conversion tracking error:', error);
  }
}
