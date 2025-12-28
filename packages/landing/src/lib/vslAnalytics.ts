/**
 * VSL Video Analytics - Custom Supabase-based tracking
 *
 * Tracks video engagement events for split testing landing page videos.
 * Uses Supabase for storage with anonymous session tracking.
 */

import { supabase } from './supabase/clientV2';

// Session ID storage key
const SESSION_ID_KEY = 'vsl_session_id';

// Progress milestones to track
const PROGRESS_MILESTONES = [25, 50, 75, 90];

// VSL video configuration - maps routes to video data
export const VSL_VIDEO_CONFIG = {
  'intro-vsl': {
    publicId: '60 VSL - Waitlist/Videos for waitlist launch/VSL_Sales_Version_xmfmf0',
    name: 'Sales Rep Version',
    route: '/intro',
  },
  'introducing-vsl': {
    publicId: '60 VSL - Waitlist/Videos for waitlist launch/VSL_Founder_Version_gopdl9',
    name: 'Founder Version',
    route: '/introducing',
  },
  'introduction-vsl': {
    publicId: '60 VSL - Waitlist/Videos for waitlist launch/VSL_Drues_Version_jlhqog',
    name: 'Product Version',
    route: '/introduction',
  },
} as const;

export type VSLVariantId = keyof typeof VSL_VIDEO_CONFIG;

/**
 * Get or create anonymous session ID
 */
function getSessionId(): string {
  try {
    let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
    if (!sessionId) {
      sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      sessionStorage.setItem(SESSION_ID_KEY, sessionId);
    }
    return sessionId;
  } catch {
    // Fallback if sessionStorage not available
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }
}

/**
 * Extract public ID from a Cloudinary video URL
 */
export function extractPublicIdFromUrl(url: string): string | null {
  // Match pattern: https://res.cloudinary.com/sixty-seconds/video/upload/v1234567890/path/to/video.mp4
  const match = url.match(/\/video\/upload\/v\d+\/(.+)\.(mp4|webm|mov)$/);
  if (match) {
    // URL decode the path (handles spaces as %20)
    return decodeURIComponent(match[1]);
  }
  return null;
}

/**
 * Find the VSL variant ID based on the video URL
 */
export function getVariantIdFromUrl(url: string): VSLVariantId | null {
  const publicId = extractPublicIdFromUrl(url);
  if (!publicId) return null;

  for (const [variantId, config] of Object.entries(VSL_VIDEO_CONFIG)) {
    if (config.publicId === publicId) {
      return variantId as VSLVariantId;
    }
  }
  return null;
}

interface AnalyticsEvent {
  signup_source: string;
  video_public_id: string;
  event_type: 'view' | 'play' | 'pause' | 'progress' | 'ended' | 'seek';
  playback_time: number;
  duration: number;
  progress_percent: number;
  watch_time: number;
  session_id: string;
  user_agent: string | null;
  referrer: string | null;
  screen_width: number | null;
  screen_height: number | null;
}

/**
 * Send analytics event to Supabase
 */
async function trackEvent(event: AnalyticsEvent): Promise<void> {
  try {
    // Cast to any since vsl_video_analytics table is not in generated types
    const { error } = await (supabase as any)
      .from('vsl_video_analytics')
      .insert(event);

    if (error) {
      console.error('[VSLAnalytics] Failed to track event:', error.message);
    }
  } catch (err) {
    console.error('[VSLAnalytics] Error sending event:', err);
  }
}

interface TrackingState {
  hasTrackedView: boolean;
  hasTrackedPlay: boolean;
  trackedMilestones: Set<number>;
  lastProgressUpdate: number;
  watchStartTime: number | null;
  cumulativeWatchTime: number;
}

interface TrackingOptions {
  signupSource?: string;
  publicId?: string;
}

/**
 * Initialize video analytics tracking on an HTML5 video element.
 * Returns a cleanup function to remove event listeners.
 */
export function initializeVideoTracking(
  videoElement: HTMLVideoElement,
  options: TrackingOptions = {}
): () => void {
  const videoUrl = videoElement.src || videoElement.currentSrc;
  const publicId = options.publicId || extractPublicIdFromUrl(videoUrl);

  if (!publicId) {
    console.warn('[VSLAnalytics] Could not extract public ID from video URL:', videoUrl);
    return () => {};
  }

  // Determine signup source from URL or options
  const signupSource = options.signupSource || getVariantIdFromUrl(videoUrl) || 'unknown';
  const sessionId = getSessionId();

  // Initialize tracking state
  const state: TrackingState = {
    hasTrackedView: false,
    hasTrackedPlay: false,
    trackedMilestones: new Set(),
    lastProgressUpdate: 0,
    watchStartTime: null,
    cumulativeWatchTime: 0,
  };

  // Helper to create base event data
  const createEventData = (eventType: AnalyticsEvent['event_type']): AnalyticsEvent => {
    const duration = videoElement.duration || 0;
    const currentTime = videoElement.currentTime || 0;
    const progressPercent = duration > 0 ? Math.round((currentTime / duration) * 100) : 0;

    // Calculate cumulative watch time
    let watchTime = state.cumulativeWatchTime;
    if (state.watchStartTime !== null) {
      watchTime += (Date.now() - state.watchStartTime) / 1000;
    }

    return {
      signup_source: signupSource,
      video_public_id: publicId,
      event_type: eventType,
      playback_time: Math.round(currentTime * 100) / 100,
      duration: Math.round(duration * 100) / 100,
      progress_percent: progressPercent,
      watch_time: Math.round(watchTime * 100) / 100,
      session_id: sessionId,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      referrer: typeof document !== 'undefined' ? document.referrer || null : null,
      screen_width: typeof window !== 'undefined' ? window.innerWidth : null,
      screen_height: typeof window !== 'undefined' ? window.innerHeight : null,
    };
  };

  // Track page view (video element loaded)
  const trackView = () => {
    if (!state.hasTrackedView) {
      state.hasTrackedView = true;
      trackEvent(createEventData('view'));
      console.log('[VSLAnalytics] Tracked view for:', signupSource);
    }
  };

  // Event handlers
  const handleLoadedMetadata = () => {
    trackView();
  };

  const handlePlay = () => {
    // Track first play
    if (!state.hasTrackedPlay) {
      state.hasTrackedPlay = true;
      trackEvent(createEventData('play'));
      console.log('[VSLAnalytics] Tracked play for:', signupSource);
    }

    // Start watch time tracking
    state.watchStartTime = Date.now();
  };

  const handlePause = () => {
    // Update cumulative watch time
    if (state.watchStartTime !== null) {
      state.cumulativeWatchTime += (Date.now() - state.watchStartTime) / 1000;
      state.watchStartTime = null;
    }

    trackEvent(createEventData('pause'));
  };

  const handleTimeUpdate = () => {
    if (!videoElement.duration) return;

    const currentTime = videoElement.currentTime;
    const duration = videoElement.duration;
    const progressPercent = Math.round((currentTime / duration) * 100);

    // Check for milestone progress (with 1% buffer for seeking)
    for (const milestone of PROGRESS_MILESTONES) {
      if (
        progressPercent >= milestone &&
        progressPercent < milestone + 5 &&
        !state.trackedMilestones.has(milestone)
      ) {
        state.trackedMilestones.add(milestone);
        trackEvent(createEventData('progress'));
        console.log(`[VSLAnalytics] Tracked ${milestone}% progress for:`, signupSource);
      }
    }
  };

  const handleEnded = () => {
    // Finalize watch time
    if (state.watchStartTime !== null) {
      state.cumulativeWatchTime += (Date.now() - state.watchStartTime) / 1000;
      state.watchStartTime = null;
    }

    trackEvent(createEventData('ended'));
    console.log('[VSLAnalytics] Tracked ended for:', signupSource);
  };

  const handleSeeking = () => {
    trackEvent(createEventData('seek'));
  };

  // Add event listeners
  videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
  videoElement.addEventListener('play', handlePlay);
  videoElement.addEventListener('pause', handlePause);
  videoElement.addEventListener('timeupdate', handleTimeUpdate);
  videoElement.addEventListener('ended', handleEnded);
  videoElement.addEventListener('seeking', handleSeeking);

  // Track view immediately if video already has metadata
  if (videoElement.readyState >= 1) {
    trackView();
  }

  console.log('[VSLAnalytics] Tracking initialized for:', signupSource, '| Public ID:', publicId);

  // Return cleanup function
  return () => {
    videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.removeEventListener('play', handlePlay);
    videoElement.removeEventListener('pause', handlePause);
    videoElement.removeEventListener('timeupdate', handleTimeUpdate);
    videoElement.removeEventListener('ended', handleEnded);
    videoElement.removeEventListener('seeking', handleSeeking);
    console.log('[VSLAnalytics] Tracking stopped for:', signupSource);
  };
}

/**
 * Get all available VSL variants for the dashboard
 */
export function getVSLVariants() {
  return Object.entries(VSL_VIDEO_CONFIG).map(([id, config]) => ({
    id: id as VSLVariantId,
    ...config,
  }));
}
