/**
 * useActivityTracker Hook
 *
 * Provides automatic activity tracking for the Smart Engagement Algorithm.
 * Tracks page views, session duration, and user interactions.
 *
 * Features:
 * - Automatic page view tracking on route changes
 * - Session start/end tracking
 * - Time-on-page tracking
 * - Integration with activityService for batched event sending
 *
 * @see src/lib/services/activityService.ts
 * @see supabase/migrations/20260102000016_user_engagement_tables.sql
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useOrg } from '@/lib/contexts/OrgContext';
import { activityService, EventCategory } from '@/lib/services/activityService';
import logger from '@/lib/utils/logger';

// Page name mappings for friendly names
const PAGE_NAMES: Record<string, string> = {
  '/': 'Home',
  '/dashboard': 'Dashboard',
  '/copilot': 'Copilot',
  '/meetings': 'Meetings',
  '/calls': 'Calls',
  '/tasks': 'Tasks',
  '/projects': 'Projects',
  '/pipeline': 'Pipeline',
  '/crm': 'CRM',
  '/contacts': 'Contacts',
  '/companies': 'Companies',
  '/leads': 'Leads',
  '/clients': 'Clients',
  '/settings': 'Settings',
  '/profile': 'Profile',
  '/preferences': 'Preferences',
  '/integrations': 'Integrations',
  '/insights': 'Insights',
  '/activity': 'Activity Log',
  '/events': 'Events',
  '/workflows': 'Workflows',
  '/platform': 'Platform Admin',
  '/platform/skills': 'Skills Admin',
  '/platform/customers': 'Customers',
  '/platform/audit': 'Audit Logs',
  '/onboarding': 'Onboarding',
  '/roadmap': 'Roadmap',
  '/releases': 'Releases',
};

/**
 * Get friendly page name from path
 */
function getPageName(pathname: string): string {
  // Direct match
  if (PAGE_NAMES[pathname]) {
    return PAGE_NAMES[pathname];
  }

  // Check for dynamic routes
  if (pathname.startsWith('/meetings/')) return 'Meeting Detail';
  if (pathname.startsWith('/calls/')) return 'Call Detail';
  if (pathname.startsWith('/crm/deals/')) return 'Deal Detail';
  if (pathname.startsWith('/crm/contacts/')) return 'Contact Detail';
  if (pathname.startsWith('/companies/')) return 'Company Detail';
  if (pathname.startsWith('/crm/companies/')) return 'Company Detail';
  if (pathname.startsWith('/settings/')) return 'Settings';
  if (pathname.startsWith('/platform/skills/')) return 'Skill Detail';
  if (pathname.startsWith('/platform/integrations/')) return 'Integration Settings';
  if (pathname.startsWith('/platform/')) return 'Platform Admin';
  if (pathname.startsWith('/roadmap/')) return 'Roadmap Item';

  // Fallback: capitalize path segments
  return pathname
    .split('/')
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' '))
    .join(' > ') || 'Home';
}

// ============================================================================
// Main Hook
// ============================================================================

interface UseActivityTrackerOptions {
  enabled?: boolean;
  trackPageViews?: boolean;
  trackSessionDuration?: boolean;
}

/**
 * Main activity tracker hook - add to App.tsx
 */
export function useActivityTracker(options: UseActivityTrackerOptions = {}): void {
  const {
    enabled = true,
    trackPageViews = true,
    trackSessionDuration = true,
  } = options;

  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { activeOrgId } = useOrg();

  const lastPageRef = useRef<string | null>(null);
  const pageEntryTimeRef = useRef<number>(Date.now());
  const sessionStartedRef = useRef<boolean>(false);

  // Initialize activity service when user logs in
  useEffect(() => {
    if (!enabled) return;

    if (isAuthenticated && user?.id && activeOrgId) {
      activityService.initialize(user.id, activeOrgId);

      // Track session start only once per session
      if (!sessionStartedRef.current) {
        activityService.trackSessionStart();
        activityService.trackLogin();
        sessionStartedRef.current = true;
        logger.log('[useActivityTracker] Session started');
      }
    } else {
      // User logged out
      if (sessionStartedRef.current) {
        activityService.trackLogout();
        activityService.clear();
        sessionStartedRef.current = false;
        logger.log('[useActivityTracker] Session ended');
      }
    }
  }, [enabled, isAuthenticated, user?.id, activeOrgId]);

  // Track page views on route change
  useEffect(() => {
    if (!enabled || !trackPageViews || !isAuthenticated) return;

    const currentPath = location.pathname;

    // Skip if same page (prevents duplicate tracking)
    if (lastPageRef.current === currentPath) return;

    // Track time spent on previous page
    if (trackSessionDuration && lastPageRef.current) {
      const timeOnPage = Date.now() - pageEntryTimeRef.current;
      if (timeOnPage > 1000) { // Only track if > 1 second
        activityService.trackAction(
          'page_time',
          'navigation',
          undefined,
          undefined,
          {
            previous_page: lastPageRef.current,
            time_ms: timeOnPage,
          }
        );
      }
    }

    // Track new page view
    const pageName = getPageName(currentPath);
    activityService.trackPageView(pageName, currentPath, {
      search: location.search,
      hash: location.hash,
      referrer: lastPageRef.current,
    });

    // Update refs
    lastPageRef.current = currentPath;
    pageEntryTimeRef.current = Date.now();
  }, [enabled, trackPageViews, trackSessionDuration, isAuthenticated, location.pathname, location.search]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (trackSessionDuration && lastPageRef.current) {
        const timeOnPage = Date.now() - pageEntryTimeRef.current;
        if (timeOnPage > 1000) {
          activityService.trackAction(
            'page_time',
            'navigation',
            undefined,
            undefined,
            {
              previous_page: lastPageRef.current,
              time_ms: timeOnPage,
            }
          );
        }
      }
    };
  }, [trackSessionDuration]);
}

// ============================================================================
// Action Tracking Hooks
// ============================================================================

/**
 * Hook for tracking specific user actions
 * Use this in components to track button clicks, form submissions, etc.
 */
export function useTrackAction() {
  const trackAction = useCallback((
    actionType: string,
    category: EventCategory,
    entityType?: string,
    entityId?: string,
    metadata?: Record<string, any>
  ) => {
    activityService.trackAction(actionType, category, entityType, entityId, metadata);
  }, []);

  return { trackAction };
}

/**
 * Hook for tracking deal-related actions
 */
export function useTrackDealAction() {
  const trackDealView = useCallback((dealId: string, dealName?: string) => {
    activityService.trackAction('view_deal', 'deals', 'deal', dealId, { deal_name: dealName });
  }, []);

  const trackDealEdit = useCallback((dealId: string, field: string, oldValue?: any, newValue?: any) => {
    activityService.trackAction('edit_deal', 'deals', 'deal', dealId, { field, old_value: oldValue, new_value: newValue });
  }, []);

  const trackDealStageChange = useCallback((dealId: string, fromStage: string, toStage: string) => {
    activityService.trackAction('stage_change', 'deals', 'deal', dealId, { from_stage: fromStage, to_stage: toStage });
  }, []);

  return { trackDealView, trackDealEdit, trackDealStageChange };
}

/**
 * Hook for tracking meeting-related actions
 */
export function useTrackMeetingAction() {
  const trackMeetingView = useCallback((meetingId: string) => {
    activityService.trackAction('view_meeting', 'meetings', 'meeting', meetingId);
  }, []);

  const trackMeetingPrepView = useCallback((meetingId: string) => {
    activityService.trackAction('view_prep', 'meetings', 'meeting', meetingId);
  }, []);

  const trackTranscriptView = useCallback((meetingId: string) => {
    activityService.trackAction('view_transcript', 'meetings', 'meeting', meetingId);
  }, []);

  return { trackMeetingView, trackMeetingPrepView, trackTranscriptView };
}

/**
 * Hook for tracking task-related actions
 */
export function useTrackTaskAction() {
  const trackTaskCreate = useCallback((taskId: string, source?: string) => {
    activityService.trackAction('create_task', 'tasks', 'task', taskId, { source });
  }, []);

  const trackTaskComplete = useCallback((taskId: string) => {
    activityService.trackAction('complete_task', 'tasks', 'task', taskId);
  }, []);

  const trackTaskView = useCallback((taskId: string) => {
    activityService.trackAction('view_task', 'tasks', 'task', taskId);
  }, []);

  return { trackTaskCreate, trackTaskComplete, trackTaskView };
}

/**
 * Hook for tracking copilot interactions
 */
export function useTrackCopilotAction() {
  const trackCopilotQuery = useCallback((queryType: string, metadata?: Record<string, any>) => {
    activityService.trackAction('copilot_query', 'copilot', undefined, undefined, { query_type: queryType, ...metadata });
  }, []);

  const trackCopilotSuggestionAccepted = useCallback((suggestionType: string) => {
    activityService.trackAction('accept_suggestion', 'copilot', undefined, undefined, { suggestion_type: suggestionType });
  }, []);

  return { trackCopilotQuery, trackCopilotSuggestionAccepted };
}

/**
 * Hook for tracking notification interactions (from in-app notifications)
 */
export function useTrackNotificationAction() {
  const trackNotificationClick = useCallback((notificationId: string, notificationType: string) => {
    activityService.trackAction('click_notification', 'notifications', 'notification', notificationId, { type: notificationType });
  }, []);

  const trackNotificationDismiss = useCallback((notificationId: string, notificationType: string) => {
    activityService.trackAction('dismiss_notification', 'notifications', 'notification', notificationId, { type: notificationType });
  }, []);

  return { trackNotificationClick, trackNotificationDismiss };
}

export default useActivityTracker;
