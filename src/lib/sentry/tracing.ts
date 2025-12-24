/**
 * Distributed Tracing Support
 *
 * Provides trace propagation headers for end-to-end correlation
 * between frontend and Supabase Edge Functions.
 */

import * as Sentry from '@sentry/react';

/**
 * Trace headers for distributed tracing
 */
export interface TraceHeaders {
  'sentry-trace': string;
  baggage: string;
}

/**
 * Get trace headers for propagation to backend
 *
 * These headers should be included in all API calls to enable
 * distributed tracing between frontend and Edge Functions.
 */
export function getTraceHeaders(): TraceHeaders | Record<string, never> {
  // Get current span for trace context
  const span = Sentry.getActiveSpan();

  if (!span) {
    return {};
  }

  // Generate trace headers from the span
  const headers: TraceHeaders = {
    'sentry-trace': Sentry.spanToTraceHeader(span),
    baggage: Sentry.spanToBaggageHeader(span) || '',
  };

  return headers;
}

/**
 * Check if distributed tracing is available
 */
export function isTracingEnabled(): boolean {
  return !!Sentry.getActiveSpan();
}

/**
 * Create a span for tracking an operation
 */
export function startSpan<T>(
  options: {
    name: string;
    op: string;
    attributes?: Record<string, string | number | boolean>;
  },
  callback: (span: Sentry.Span) => T
): T {
  return Sentry.startSpan(options, callback);
}

/**
 * Create a span for async operations
 */
export async function startSpanAsync<T>(
  options: {
    name: string;
    op: string;
    attributes?: Record<string, string | number | boolean>;
  },
  callback: (span: Sentry.Span) => Promise<T>
): Promise<T> {
  return Sentry.startSpan(options, async (span) => {
    try {
      return await callback(span);
    } catch (error) {
      span.setStatus({ code: 2, message: String(error) }); // SpanStatusCode.ERROR
      throw error;
    }
  });
}

/**
 * Wrap a fetch call with tracing headers
 *
 * Automatically injects sentry-trace and baggage headers
 * for distributed tracing.
 */
export async function tracedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const traceHeaders = getTraceHeaders();
  const existingHeaders = new Headers(init?.headers);

  // Merge trace headers
  Object.entries(traceHeaders).forEach(([key, value]) => {
    if (value) {
      existingHeaders.set(key, value);
    }
  });

  return fetch(input, {
    ...init,
    headers: existingHeaders,
  });
}

/**
 * Add trace headers to an existing Headers object
 */
export function injectTraceHeaders(headers: Headers): Headers {
  const traceHeaders = getTraceHeaders();

  Object.entries(traceHeaders).forEach(([key, value]) => {
    if (value) {
      headers.set(key, value);
    }
  });

  return headers;
}

/**
 * Add trace headers to a plain object
 */
export function mergeTraceHeaders(
  headers: Record<string, string>
): Record<string, string> {
  const traceHeaders = getTraceHeaders();

  return {
    ...headers,
    ...traceHeaders,
  };
}

// ============================================================
// Targeted Operation Wrappers (Phase 4B)
// ============================================================

/**
 * Slow operation threshold in milliseconds
 */
const SLOW_OPERATION_THRESHOLD_MS = 500;

/**
 * Track a deal save operation with detailed context
 */
export async function trackedDealSave<T>(
  deal: { id?: string; stage?: string; value?: number },
  saveFn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();

  return startSpanAsync(
    {
      name: deal.id ? `deal.update.${deal.id}` : 'deal.create',
      op: 'db.transaction',
      attributes: {
        'deal.id': deal.id || 'new',
        'deal.stage': deal.stage || 'unknown',
        'deal.value': deal.value || 0,
      },
    },
    async (span) => {
      try {
        const result = await saveFn();

        const duration = performance.now() - startTime;
        span.setAttribute('duration_ms', duration);

        // Warn on slow operations
        if (duration > SLOW_OPERATION_THRESHOLD_MS) {
          Sentry.addBreadcrumb({
            message: `Slow deal save: ${duration.toFixed(0)}ms`,
            category: 'performance',
            level: 'warning',
            data: {
              deal_id: deal.id,
              duration_ms: duration,
            },
          });
        }

        return result;
      } catch (error) {
        // Check for RLS violations
        if (isRlsViolation(error)) {
          Sentry.setTag('error.type', 'rls_violation');
          Sentry.addBreadcrumb({
            message: 'RLS violation on deal save',
            category: 'security',
            level: 'error',
            data: {
              deal_id: deal.id,
              error: String(error),
            },
          });
        }
        throw error;
      }
    }
  );
}

/**
 * Track a pipeline stage move operation
 */
export async function trackedStageMove<T>(
  dealId: string,
  fromStage: string,
  toStage: string,
  moveFn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();

  return startSpanAsync(
    {
      name: `deal.stage_move.${dealId}`,
      op: 'deal.pipeline',
      attributes: {
        'deal.id': dealId,
        'pipeline.from_stage': fromStage,
        'pipeline.to_stage': toStage,
      },
    },
    async (span) => {
      try {
        const result = await moveFn();

        const duration = performance.now() - startTime;
        span.setAttribute('duration_ms', duration);

        // Add breadcrumb for pipeline movement
        Sentry.addBreadcrumb({
          message: `Deal ${dealId} moved: ${fromStage} → ${toStage}`,
          category: 'pipeline',
          level: 'info',
          data: {
            deal_id: dealId,
            from_stage: fromStage,
            to_stage: toStage,
            duration_ms: duration,
          },
        });

        // Warn on slow operations
        if (duration > SLOW_OPERATION_THRESHOLD_MS) {
          Sentry.addBreadcrumb({
            message: `Slow stage move: ${duration.toFixed(0)}ms`,
            category: 'performance',
            level: 'warning',
          });
        }

        return result;
      } catch (error) {
        // Check for RLS violations
        if (isRlsViolation(error)) {
          Sentry.setTag('error.type', 'rls_violation');
        }
        throw error;
      }
    }
  );
}

/**
 * Track a calendar sync operation
 */
export async function trackedCalendarSync<T>(
  syncFn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();

  return startSpanAsync(
    {
      name: 'calendar.sync',
      op: 'integration.google',
      attributes: {
        'integration.name': 'google_calendar',
      },
    },
    async (span) => {
      try {
        const result = await syncFn();

        const duration = performance.now() - startTime;
        span.setAttribute('duration_ms', duration);

        // Warn on slow syncs (calendar syncs can be slow, use higher threshold)
        if (duration > 3000) {
          Sentry.addBreadcrumb({
            message: `Slow calendar sync: ${duration.toFixed(0)}ms`,
            category: 'performance',
            level: 'warning',
            data: { duration_ms: duration },
          });
        }

        return result;
      } catch (error) {
        Sentry.addBreadcrumb({
          message: 'Calendar sync failed',
          category: 'integration',
          level: 'error',
          data: { error: String(error) },
        });
        throw error;
      }
    }
  );
}

/**
 * Track a generic API operation
 */
export async function trackedApiCall<T>(
  endpoint: string,
  method: string,
  callFn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();

  return startSpanAsync(
    {
      name: `api.${method.toLowerCase()}.${endpoint}`,
      op: 'http.client',
      attributes: {
        'http.method': method,
        'http.target': endpoint,
      },
    },
    async (span) => {
      const result = await callFn();

      const duration = performance.now() - startTime;
      span.setAttribute('http.response_time_ms', duration);

      // Warn on slow API calls
      if (duration > SLOW_OPERATION_THRESHOLD_MS) {
        Sentry.addBreadcrumb({
          message: `Slow API call: ${method} ${endpoint} (${duration.toFixed(0)}ms)`,
          category: 'performance',
          level: 'warning',
          data: {
            method,
            endpoint,
            duration_ms: duration,
          },
        });
      }

      return result;
    }
  );
}

/**
 * Check if an error is an RLS (Row Level Security) violation
 */
function isRlsViolation(error: unknown): boolean {
  if (!error) return false;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);

  return (
    /rls/i.test(message) ||
    /row.level.security/i.test(message) ||
    /new row violates row-level security/i.test(message) ||
    /permission denied/i.test(message)
  );
}
