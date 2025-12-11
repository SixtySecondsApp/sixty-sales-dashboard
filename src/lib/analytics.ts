/**
 * Lightweight Analytics Service
 * 
 * Tracks page views and key user actions.
 * Logs to database and optionally integrates with external analytics.
 */

import { supabase } from '@/lib/supabase/clientV2';
import { captureBreadcrumb } from '@/lib/sentry';

// Analytics event types
export type AnalyticsEvent = 
  // Navigation
  | 'page_view'
  // Onboarding
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  // Fathom Integration
  | 'fathom_connect_started'
  | 'fathom_connect_completed'
  | 'fathom_sync_started'
  | 'fathom_sync_completed'
  // Meeting Intelligence
  | 'meeting_viewed'
  | 'meeting_summary_viewed'
  | 'meeting_transcript_viewed'
  | 'ai_question_asked'
  // Proposals
  | 'proposal_created'
  | 'proposal_viewed'
  | 'proposal_shared'
  // Tasks
  | 'task_created'
  | 'task_completed'
  // Upgrade
  | 'pricing_viewed'
  | 'upgrade_started'
  | 'upgrade_completed'
  // Errors
  | 'error_occurred';

interface AnalyticsPayload {
  event: AnalyticsEvent;
  properties?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  timestamp?: string;
}

// Session ID for tracking user journey
let sessionId: string | null = null;
let currentUserId: string | null = null;

/**
 * Initialize analytics with user context
 */
export function initAnalytics(userId?: string) {
  // Generate session ID if not exists
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  if (userId) {
    currentUserId = userId;
  }
}

/**
 * Track an analytics event
 */
export async function track(
  event: AnalyticsEvent,
  properties?: Record<string, any>
): Promise<void> {
  const payload: AnalyticsPayload = {
    event,
    properties: {
      ...properties,
      url: window.location.pathname,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
    },
    userId: currentUserId || undefined,
    sessionId: sessionId || undefined,
    timestamp: new Date().toISOString(),
  };

  // Log to console in development
  if (import.meta.env.DEV) {
    console.log('[Analytics]', event, properties);
  }

  // Add breadcrumb to Sentry for debugging
  captureBreadcrumb(
    `Analytics: ${event}`,
    'analytics',
    properties
  );

  // Track in Encharge if user is identified
  if (currentUserId && window.EncTracking) {
    try {
      window.EncTracking.track({
        event,
        ...properties,
      });
    } catch (e) {
      // Silently fail - analytics shouldn't break the app
    }
  }

  // Log to database (fire and forget)
  try {
    // Use edge function to avoid RLS issues
    await supabase.functions.invoke('analytics-track', {
      body: payload,
    }).catch(() => {
      // Silently fail if edge function doesn't exist
    });
  } catch (e) {
    // Silently fail - analytics shouldn't break the app
  }
}

/**
 * Track a page view
 */
export function trackPageView(pageName?: string, properties?: Record<string, any>) {
  track('page_view', {
    page: pageName || window.location.pathname,
    title: document.title,
    ...properties,
  });
}

/**
 * Track meeting interactions
 */
export function trackMeetingView(meetingId: string, properties?: Record<string, any>) {
  track('meeting_viewed', { meetingId, ...properties });
}

export function trackSummaryView(meetingId: string, properties?: Record<string, any>) {
  track('meeting_summary_viewed', { meetingId, ...properties });
}

export function trackAIQuestion(question: string, meetingId?: string) {
  track('ai_question_asked', { 
    questionLength: question.length,
    meetingId,
  });
}

/**
 * Track proposal interactions
 */
export function trackProposalCreated(proposalId: string, type?: string) {
  track('proposal_created', { proposalId, type });
}

export function trackProposalShared(proposalId: string) {
  track('proposal_shared', { proposalId });
}

/**
 * Track task interactions
 */
export function trackTaskCreated(taskId: string, source?: string) {
  track('task_created', { taskId, source });
}

export function trackTaskCompleted(taskId: string) {
  track('task_completed', { taskId });
}

/**
 * Track upgrade funnel
 */
export function trackPricingViewed(source?: string) {
  track('pricing_viewed', { source });
}

export function trackUpgradeStarted(plan?: string) {
  track('upgrade_started', { plan });
}

export function trackUpgradeCompleted(plan?: string) {
  track('upgrade_completed', { plan });
}

/**
 * Track errors
 */
export function trackError(error: Error | string, context?: Record<string, any>) {
  track('error_occurred', {
    message: typeof error === 'string' ? error : error.message,
    stack: typeof error === 'string' ? undefined : error.stack?.slice(0, 500),
    ...context,
  });
}

/**
 * Set user ID for tracking
 */
export function identify(userId: string, traits?: Record<string, any>) {
  currentUserId = userId;
  
  // Identify in Encharge
  if (window.EncTracking) {
    try {
      window.EncTracking.identify({
        userId,
        ...traits,
      });
    } catch (e) {
      // Silently fail
    }
  }
}

/**
 * Clear user ID on logout
 */
export function reset() {
  currentUserId = null;
  // Keep session ID to track anonymous behavior after logout
}

// Declare global Encharge tracking
declare global {
  interface Window {
    EncTracking?: {
      track: (props: Record<string, any>) => void;
      identify: (props: Record<string, any>) => void;
    };
  }
}
