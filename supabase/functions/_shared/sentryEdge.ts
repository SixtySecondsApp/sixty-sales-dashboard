/**
 * Sentry Integration for Supabase Edge Functions (Deno)
 *
 * Provides:
 * - Distributed tracing continuation from frontend
 * - Error capturing with context
 * - Performance spans for operations
 * - Breadcrumbs for debugging
 *
 * Usage:
 * ```typescript
 * import { initSentry, withSentry, addBreadcrumb } from '../_shared/sentryEdge.ts';
 *
 * serve(async (req: Request) => {
 *   return withSentry(req, async () => {
 *     // Your handler logic
 *     addBreadcrumb('Processed request', 'http');
 *     return new Response('OK');
 *   });
 * });
 * ```
 */

// Environment configuration
const SENTRY_DSN = Deno.env.get('SENTRY_DSN');
const ENVIRONMENT = Deno.env.get('ENVIRONMENT') || 'development';
const FUNCTION_VERSION = Deno.env.get('FUNCTION_VERSION') || '1.0.0';

/**
 * Check if Sentry is configured
 */
export function isSentryEnabled(): boolean {
  return !!SENTRY_DSN && ENVIRONMENT !== 'development';
}

/**
 * Parsed trace context from incoming headers
 */
interface TraceContext {
  traceId: string;
  parentSpanId: string;
  sampled: boolean;
}

/**
 * Span for performance tracking
 */
interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  op: string;
  name: string;
  startTime: number;
  endTime?: number;
  status?: 'ok' | 'error' | 'cancelled';
  data?: Record<string, unknown>;
}

/**
 * Breadcrumb for debugging trail
 */
interface Breadcrumb {
  message: string;
  category: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  timestamp: number;
  data?: Record<string, unknown>;
}

/**
 * Sentry envelope for the wire protocol
 */
interface SentryEnvelope {
  event_id: string;
  sent_at: string;
  dsn: string;
  sdk: {
    name: string;
    version: string;
  };
}

// Current request context (thread-local simulation)
let currentTraceContext: TraceContext | null = null;
let currentSpan: Span | null = null;
const breadcrumbs: Breadcrumb[] = [];

/**
 * Parse sentry-trace header to continue distributed trace
 *
 * Format: {traceId}-{spanId}-{sampled}
 * Example: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
 */
export function parseTraceHeader(header: string | null): TraceContext | null {
  if (!header) return null;

  // Support both Sentry and W3C trace context formats
  const parts = header.split('-');

  if (parts.length >= 2) {
    return {
      traceId: parts[0].length === 32 ? parts[0] : parts[1],
      parentSpanId: parts.length === 4 ? parts[2] : parts[1],
      sampled: parts[parts.length - 1] === '1' || parts[parts.length - 1] === '01',
    };
  }

  return null;
}

/**
 * Parse baggage header for additional context
 */
export function parseBaggageHeader(
  header: string | null
): Record<string, string> {
  if (!header) return {};

  const baggage: Record<string, string> = {};
  const pairs = header.split(',');

  for (const pair of pairs) {
    const [key, value] = pair.split('=').map((s) => s.trim());
    if (key && value) {
      // Sentry baggage items start with 'sentry-'
      baggage[key] = decodeURIComponent(value);
    }
  }

  return baggage;
}

/**
 * Generate a random span ID
 */
function generateSpanId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a random trace ID
 */
function generateTraceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Start a new span for performance tracking
 */
export function startSpan(
  name: string,
  op: string,
  data?: Record<string, unknown>
): Span {
  const span: Span = {
    traceId: currentTraceContext?.traceId || generateTraceId(),
    spanId: generateSpanId(),
    parentSpanId: currentSpan?.spanId || currentTraceContext?.parentSpanId,
    op,
    name,
    startTime: Date.now(),
    data,
  };

  currentSpan = span;
  return span;
}

/**
 * End a span and record its duration
 */
export function endSpan(span: Span, status: 'ok' | 'error' = 'ok'): void {
  span.endTime = Date.now();
  span.status = status;

  // Log span for debugging (in production, would send to Sentry)
  if (isSentryEnabled()) {
    console.log(
      `[Sentry Span] ${span.op}:${span.name} - ${span.endTime - span.startTime}ms [${status}]`
    );
  }
}

/**
 * Add a breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, unknown>
): void {
  breadcrumbs.push({
    message,
    category,
    level,
    timestamp: Date.now(),
    data,
  });

  // Keep only last 20 breadcrumbs
  if (breadcrumbs.length > 20) {
    breadcrumbs.shift();
  }
}

/**
 * Capture an error and send to Sentry
 */
export async function captureException(
  error: Error | unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    user?: { id: string; email?: string };
  }
): Promise<string | null> {
  if (!isSentryEnabled() || !SENTRY_DSN) {
    console.error('[Sentry] Error captured (not sent - disabled):', error);
    return null;
  }

  const eventId = crypto.randomUUID().replace(/-/g, '');
  const timestamp = new Date().toISOString();

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  const event = {
    event_id: eventId,
    timestamp,
    platform: 'javascript',
    level: 'error',
    environment: ENVIRONMENT,
    release: `sixty-edge-functions@${FUNCTION_VERSION}`,
    exception: {
      values: [
        {
          type: error instanceof Error ? error.name : 'Error',
          value: errorMessage,
          stacktrace: errorStack
            ? {
                frames: parseStackTrace(errorStack),
              }
            : undefined,
        },
      ],
    },
    breadcrumbs: {
      values: breadcrumbs.map((b) => ({
        ...b,
        timestamp: b.timestamp / 1000, // Sentry expects seconds
      })),
    },
    tags: {
      runtime: 'deno',
      ...context?.tags,
    },
    extra: context?.extra,
    user: context?.user,
    contexts: {
      trace: currentTraceContext
        ? {
            trace_id: currentTraceContext.traceId,
            span_id: currentSpan?.spanId,
            parent_span_id: currentTraceContext.parentSpanId,
          }
        : undefined,
      runtime: {
        name: 'Deno',
        version: Deno.version.deno,
      },
    },
  };

  try {
    const dsn = new URL(SENTRY_DSN);
    const projectId = dsn.pathname.replace('/', '');
    const publicKey = dsn.username;

    const envelopeUrl = `https://${dsn.host}/api/${projectId}/envelope/`;

    const envelope = [
      JSON.stringify({
        event_id: eventId,
        sent_at: timestamp,
        dsn: SENTRY_DSN,
        sdk: { name: 'sentry.javascript.deno', version: '1.0.0' },
      }),
      JSON.stringify({ type: 'event' }),
      JSON.stringify(event),
    ].join('\n');

    const response = await fetch(envelopeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=sentry.javascript.deno/1.0.0, sentry_key=${publicKey}`,
      },
      body: envelope,
    });

    if (!response.ok) {
      console.error('[Sentry] Failed to send event:', response.status);
      return null;
    }

    console.log(`[Sentry] Event captured: ${eventId}`);
    return eventId;
  } catch (sendError) {
    console.error('[Sentry] Failed to send event:', sendError);
    return null;
  }
}

/**
 * Parse a stack trace string into Sentry frame format
 */
function parseStackTrace(
  stack: string
): Array<{ filename: string; lineno?: number; colno?: number; function?: string }> {
  const lines = stack.split('\n');
  const frames: Array<{
    filename: string;
    lineno?: number;
    colno?: number;
    function?: string;
  }> = [];

  for (const line of lines) {
    // Match patterns like "at functionName (file:line:col)" or "at file:line:col"
    const match = line.match(/at\s+(?:(.+?)\s+\()?(.+):(\d+):(\d+)\)?/);
    if (match) {
      frames.push({
        function: match[1] || '<anonymous>',
        filename: match[2],
        lineno: parseInt(match[3], 10),
        colno: parseInt(match[4], 10),
      });
    }
  }

  // Sentry expects frames in reverse order (oldest first)
  return frames.reverse();
}

/**
 * Wrapper for Edge Function handlers with Sentry integration
 *
 * Automatically:
 * - Continues traces from incoming headers
 * - Creates a span for the request
 * - Captures any errors
 * - Adds request context
 */
export async function withSentry(
  req: Request,
  handler: () => Promise<Response>
): Promise<Response> {
  // Clear previous request state
  breadcrumbs.length = 0;
  currentTraceContext = null;
  currentSpan = null;

  // Parse incoming trace context
  const sentryTrace = req.headers.get('sentry-trace');
  const baggage = req.headers.get('baggage');

  currentTraceContext = parseTraceHeader(sentryTrace);
  const baggageData = parseBaggageHeader(baggage);

  // Start request span
  const url = new URL(req.url);
  const span = startSpan(`${req.method} ${url.pathname}`, 'http.server', {
    'http.method': req.method,
    'http.url': url.pathname,
    'http.query': url.search,
  });

  // Add initial breadcrumb
  addBreadcrumb(`Received ${req.method} ${url.pathname}`, 'http', 'info', {
    method: req.method,
    path: url.pathname,
    has_trace: !!sentryTrace,
  });

  try {
    const response = await handler();

    // Add response breadcrumb
    addBreadcrumb(`Response ${response.status}`, 'http', 'info', {
      status: response.status,
    });

    endSpan(span, 'ok');
    return response;
  } catch (error) {
    endSpan(span, 'error');

    // Capture the error to Sentry
    await captureException(error, {
      tags: {
        'http.method': req.method,
        'http.path': url.pathname,
      },
      extra: {
        baggage: baggageData,
        url: req.url,
      },
    });

    // Re-throw to let the Edge Function handle the response
    throw error;
  }
}

/**
 * Simplified handler wrapper that catches errors and returns JSON response
 */
export async function withSentryHandler(
  req: Request,
  corsHeaders: Record<string, string>,
  handler: () => Promise<Response>
): Promise<Response> {
  try {
    return await withSentry(req, handler);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; orgId?: string }): void {
  addBreadcrumb(`User identified: ${user.id}`, 'auth', 'info', {
    user_id: user.id,
    org_id: user.orgId,
  });
}

/**
 * Clear user context (on logout)
 */
export function clearUser(): void {
  addBreadcrumb('User cleared', 'auth', 'info');
}

/**
 * Capture a message (non-error event)
 */
export async function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info'
): Promise<string | null> {
  if (!isSentryEnabled()) {
    console.log(`[Sentry Message] [${level}] ${message}`);
    return null;
  }

  // Create a synthetic error to get a stack trace
  const syntheticError = new Error(message);
  syntheticError.name = 'SentryMessage';

  return captureException(syntheticError, {
    tags: { level },
    extra: { originalLevel: level },
  });
}

// Export for convenience
export { SENTRY_DSN, ENVIRONMENT, FUNCTION_VERSION };
