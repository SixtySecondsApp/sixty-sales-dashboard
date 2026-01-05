/**
 * Activity Service
 *
 * Handles logging user activity events to the database for the Smart Engagement Algorithm.
 * Events are batched and sent periodically to minimize API overhead.
 *
 * @see supabase/migrations/20260102000016_user_engagement_tables.sql
 */

import { supabase } from '../supabase/clientV2';
import logger from '@/lib/utils/logger';

/**
 * NOTE ON UUIDS (IMPORTANT):
 * The DB functions/tables for engagement tracking expect UUIDs for:
 * - user_activity_events.session_id (uuid)
 * - log_user_activity_event(p_session_id uuid, p_entity_id uuid)
 *
 * Previously we generated session IDs like `${Date.now()}-${Math.random()...}`,
 * which is NOT a UUID and caused PostgREST 400s + Postgres "invalid input syntax for type uuid"
 * errors, leading to retry loops and excessive REST requests.
 */

// ============================================================================
// Types
// ============================================================================

export type EventSource = 'app' | 'slack' | 'email';

export type EventCategory =
  | 'deals'
  | 'meetings'
  | 'tasks'
  | 'contacts'
  | 'companies'
  | 'settings'
  | 'notifications'
  | 'copilot'
  | 'analytics'
  | 'navigation';

export interface ActivityEvent {
  event_type: string;           // app_pageview, app_action, app_click, etc.
  event_source: EventSource;
  event_category?: EventCategory;
  entity_type?: string;         // deal, contact, meeting, task, etc.
  /** UUID string when provided (will be validated before sending to DB) */
  entity_id?: string;
  action_detail?: string;       // Specific action (e.g., 'viewed_deal', 'created_task')
  metadata?: Record<string, any>;
}

interface QueuedEvent extends ActivityEvent {
  queued_at: number;
  /** UUIDv4 string (stored in DB as uuid) */
  session_id: string;
}

// ============================================================================
// Activity Service Class
// ============================================================================

class ActivityService {
  private static instance: ActivityService;
  private eventQueue: QueuedEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private sessionId: string;
  private isEnabled: boolean = true;
  private userId: string | null = null;
  private orgId: string | null = null;

  // Configuration
  private readonly FLUSH_INTERVAL_MS = 30000; // 30 seconds
  private readonly MAX_QUEUE_SIZE = 100;
  private readonly BATCH_SIZE = 50;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.startFlushInterval();

    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flush();
        }
      });
    }
  }

  static getInstance(): ActivityService {
    if (!ActivityService.instance) {
      ActivityService.instance = new ActivityService();
    }
    return ActivityService.instance;
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Initialize the service with user and org context
   */
  initialize(userId: string, orgId: string): void {
    this.userId = userId;
    this.orgId = orgId;
    logger.log('[ActivityService] Initialized for user:', userId, 'org:', orgId);
  }

  /**
   * Clear user context (on logout)
   */
  clear(): void {
    this.flush(); // Send any pending events
    this.userId = null;
    this.orgId = null;
    this.sessionId = this.generateSessionId(); // New session on next login
    logger.log('[ActivityService] Cleared user context');
  }

  /**
   * Enable/disable tracking
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.eventQueue = []; // Clear queue when disabled
    }
  }

  // ============================================================================
  // Event Tracking
  // ============================================================================

  /**
   * Track a generic activity event
   */
  trackEvent(event: ActivityEvent): void {
    if (!this.isEnabled || !this.userId || !this.orgId) {
      return;
    }

    const queuedEvent: QueuedEvent = {
      ...event,
      queued_at: Date.now(),
      session_id: this.sessionId,
    };

    this.eventQueue.push(queuedEvent);

    // Flush if queue is getting large
    if (this.eventQueue.length >= this.MAX_QUEUE_SIZE) {
      this.flush();
    }
  }

  /**
   * Track a page view
   */
  trackPageView(pageName: string, path: string, metadata?: Record<string, any>): void {
    this.trackEvent({
      event_type: 'app_pageview',
      event_source: 'app',
      event_category: this.inferCategory(path),
      action_detail: pageName,
      metadata: {
        path,
        ...metadata,
      },
    });
  }

  /**
   * Track a user action (button click, form submit, etc.)
   */
  trackAction(
    actionType: string,
    category: EventCategory,
    entityType?: string,
    entityId?: string,
    metadata?: Record<string, any>
  ): void {
    this.trackEvent({
      event_type: 'app_action',
      event_source: 'app',
      event_category: category,
      entity_type: entityType,
      entity_id: entityId,
      action_detail: actionType,
      metadata,
    });
  }

  /**
   * Track session start
   */
  trackSessionStart(): void {
    this.trackEvent({
      event_type: 'session_start',
      event_source: 'app',
      metadata: {
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        screen_width: typeof window !== 'undefined' ? window.innerWidth : undefined,
        screen_height: typeof window !== 'undefined' ? window.innerHeight : undefined,
      },
    });
  }

  /**
   * Track login event
   */
  trackLogin(): void {
    this.trackEvent({
      event_type: 'login',
      event_source: 'app',
    });
  }

  /**
   * Track logout event
   */
  trackLogout(): void {
    this.trackEvent({
      event_type: 'logout',
      event_source: 'app',
    });
    this.flush(); // Immediately flush on logout
  }

  // ============================================================================
  // Flush Logic
  // ============================================================================

  /**
   * Flush queued events to the database
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0 || !this.userId || !this.orgId) {
      return;
    }

    // Take events from queue
    const eventsToSend = this.eventQueue.splice(0, this.BATCH_SIZE);

    try {
      // Use the database function for efficient batch insert
      // Note: Type assertion needed until database types are regenerated
      const { error } = await (supabase as any).rpc('log_user_activity_event', {
        p_user_id: this.userId,
        p_org_id: this.orgId,
        p_event_type: eventsToSend[0].event_type,
        p_event_source: eventsToSend[0].event_source,
        p_event_category: eventsToSend[0].event_category || null,
        p_entity_type: eventsToSend[0].entity_type || null,
        // Validate UUID fields to avoid hard failures + retry loops
        p_entity_id: safeUuidOrNull(eventsToSend[0].entity_id),
        p_action_detail: eventsToSend[0].action_detail || null,
        p_session_id: safeUuidOrNull(eventsToSend[0].session_id),
        p_metadata: eventsToSend[0].metadata || {},
      });

      if (error) {
        logger.warn('[ActivityService] Failed to log activity event:', error);
        // Avoid infinite retry loops on client-side/data validation issues (400s).
        // If this is a bad payload, drop these events instead of hammering PostgREST.
        if (isNonRetriablePostgrestError(error)) {
          logger.warn('[ActivityService] Dropping activity events due to non-retriable error');
        } else {
          // Re-queue failed events (at the front) for transient failures
          this.eventQueue.unshift(...eventsToSend);
        }
      } else {
        // If we have more events, process them
        if (eventsToSend.length > 1) {
          // For batch events, use direct insert
          await this.batchInsertEvents(eventsToSend.slice(1));
        }
      }
    } catch (error) {
      logger.warn('[ActivityService] Error flushing events:', error);
      // Re-queue failed events
      this.eventQueue.unshift(...eventsToSend);
    }
  }

  /**
   * Batch insert multiple events directly
   */
  private async batchInsertEvents(events: QueuedEvent[]): Promise<void> {
    if (events.length === 0 || !this.userId || !this.orgId) {
      return;
    }

    const now = new Date();
    const dayOfWeek = now.getDay();
    const hourOfDay = now.getHours();

    const records = events.map(event => ({
      user_id: this.userId,
      org_id: this.orgId,
      event_type: event.event_type,
      event_source: event.event_source,
      event_category: event.event_category || null,
      entity_type: event.entity_type || null,
      entity_id: safeUuidOrNull(event.entity_id),
      action_detail: event.action_detail || null,
      session_id: safeUuidOrNull(event.session_id),
      metadata: event.metadata || {},
      day_of_week: dayOfWeek,
      hour_of_day: hourOfDay,
    }));

    // Note: Type assertion needed until database types are regenerated
    const { error } = await (supabase as any)
      .from('user_activity_events')
      .insert(records);

    if (error) {
      logger.warn('[ActivityService] Batch insert failed:', error);
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private generateSessionId(): string {
    // Must be a UUID (DB column type is uuid)
    return generateUuidV4();
  }

  private startFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushInterval = setInterval(() => this.flush(), this.FLUSH_INTERVAL_MS);
  }

  private inferCategory(path: string): EventCategory {
    if (path.includes('/deals') || path.includes('/pipeline')) return 'deals';
    if (path.includes('/meetings') || path.includes('/calls')) return 'meetings';
    if (path.includes('/tasks') || path.includes('/projects')) return 'tasks';
    if (path.includes('/contacts')) return 'contacts';
    if (path.includes('/companies') || path.includes('/crm')) return 'companies';
    if (path.includes('/settings') || path.includes('/preferences')) return 'settings';
    if (path.includes('/copilot')) return 'copilot';
    if (path.includes('/insights') || path.includes('/analytics')) return 'analytics';
    return 'navigation';
  }

  /**
   * Get current session ID (useful for correlating events)
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Cleanup on unmount
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush();
  }
}

// Export singleton instance
export const activityService = ActivityService.getInstance();

// Export class for testing
export { ActivityService };

// ============================================================================
// UUID helpers (no external deps)
// ============================================================================

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeUuidOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return UUID_REGEX.test(trimmed) ? trimmed : null;
}

function isNonRetriablePostgrestError(error: unknown): boolean {
  // PostgrestError shape usually includes: message, details, hint, code
  const e = error as { message?: unknown; status?: unknown; code?: unknown; details?: unknown };
  const status = typeof e?.status === 'number' ? e.status : undefined;
  const msg = typeof e?.message === 'string' ? e.message : '';
  const details = typeof e?.details === 'string' ? e.details : '';
  const combined = `${msg} ${details}`.toLowerCase();

  // Treat 4xx as non-retriable (bad payload / permissions), especially UUID issues.
  if (status && status >= 400 && status < 500) return true;
  if (combined.includes('invalid input syntax for type uuid')) return true;
  if (combined.includes('uuid')) return true;
  // PostgREST uses PGRSTxxx codes for many client-side issues
  if (typeof e?.code === 'string' && e.code.startsWith('PGRST')) return true;

  return false;
}

function generateUuidV4(): string {
  // Prefer crypto.randomUUID when available (modern browsers + Node 18+)
  const cryptoAny = globalThis.crypto as unknown as { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array } | undefined;
  if (cryptoAny?.randomUUID) return cryptoAny.randomUUID();

  // Fallback: RFC4122 v4 using getRandomValues if present
  if (cryptoAny?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoAny.getRandomValues(bytes);
    // Per RFC4122 section 4.4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Last-resort fallback (still produces a UUID-shaped string)
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${s4()}${s4()}-${s4()}-4${s4().slice(1)}-${((8 + Math.random() * 4) | 0).toString(16)}${s4().slice(1)}-${s4()}${s4()}${s4()}`.toLowerCase();
}
