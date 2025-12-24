/**
 * SSE Flow Tracing for Sentry
 *
 * Provides utilities for tracing Server-Sent Events (SSE) streams,
 * including connection lifecycle, message processing, and error handling.
 */

import * as Sentry from '@sentry/react';

// ============================================================
// Types
// ============================================================

export interface SSEConnectionInfo {
  url: string;
  action: string;
  startTime: number;
  messageCount: number;
  bytesReceived: number;
  lastMessageTime?: number;
  errorCount: number;
}

export interface SSEMessageMetrics {
  messageCount: number;
  totalBytes: number;
  averageChunkSize: number;
  duration: number;
  messagesPerSecond: number;
}

// ============================================================
// SSE Connection Tracking
// ============================================================

const activeConnections = new Map<string, SSEConnectionInfo>();

/**
 * Start tracking an SSE connection.
 * Creates a breadcrumb and initializes connection metrics.
 */
export function startSSEConnection(
  connectionId: string,
  url: string,
  action: string
): SSEConnectionInfo {
  const info: SSEConnectionInfo = {
    url,
    action,
    startTime: performance.now(),
    messageCount: 0,
    bytesReceived: 0,
    errorCount: 0,
  };

  activeConnections.set(connectionId, info);

  Sentry.addBreadcrumb({
    category: 'sse',
    message: `SSE connection started: ${action}`,
    level: 'info',
    data: {
      connection_id: connectionId,
      url: url.replace(/\/\/[^/]+/, '//***'), // Redact domain
      action,
      timestamp: new Date().toISOString(),
    },
  });

  return info;
}

/**
 * Record an SSE message received.
 * Updates metrics and creates breadcrumbs for significant events.
 */
export function recordSSEMessage(
  connectionId: string,
  messageType: 'chunk' | 'done' | 'error' | 'ping',
  byteSize: number
): void {
  const info = activeConnections.get(connectionId);
  if (!info) return;

  info.messageCount++;
  info.bytesReceived += byteSize;
  info.lastMessageTime = performance.now();

  // Create breadcrumb every 50 messages or for significant events
  if (info.messageCount % 50 === 0 || messageType === 'done' || messageType === 'error') {
    Sentry.addBreadcrumb({
      category: 'sse.message',
      message: `SSE ${messageType}: ${info.action}`,
      level: messageType === 'error' ? 'error' : 'info',
      data: {
        connection_id: connectionId,
        message_type: messageType,
        message_count: info.messageCount,
        bytes_received: info.bytesReceived,
        duration_ms: Math.round(performance.now() - info.startTime),
      },
    });
  }
}

/**
 * Record an SSE error.
 */
export function recordSSEError(
  connectionId: string,
  error: Error | string,
  context?: Record<string, unknown>
): void {
  const info = activeConnections.get(connectionId);
  if (info) {
    info.errorCount++;
  }

  const errorMessage = error instanceof Error ? error.message : error;

  Sentry.addBreadcrumb({
    category: 'sse.error',
    message: `SSE error: ${errorMessage}`,
    level: 'error',
    data: {
      connection_id: connectionId,
      error: errorMessage,
      message_count: info?.messageCount || 0,
      duration_ms: info ? Math.round(performance.now() - info.startTime) : 0,
      ...context,
    },
  });
}

/**
 * End an SSE connection and generate metrics.
 * Creates a summary breadcrumb and returns final metrics.
 */
export function endSSEConnection(
  connectionId: string,
  status: 'completed' | 'error' | 'timeout' | 'cancelled'
): SSEMessageMetrics | null {
  const info = activeConnections.get(connectionId);
  if (!info) return null;

  const duration = performance.now() - info.startTime;
  const metrics: SSEMessageMetrics = {
    messageCount: info.messageCount,
    totalBytes: info.bytesReceived,
    averageChunkSize: info.messageCount > 0 ? Math.round(info.bytesReceived / info.messageCount) : 0,
    duration,
    messagesPerSecond: duration > 0 ? (info.messageCount / duration) * 1000 : 0,
  };

  // Create summary breadcrumb
  Sentry.addBreadcrumb({
    category: 'sse',
    message: `SSE connection ${status}: ${info.action}`,
    level: status === 'error' ? 'error' : 'info',
    data: {
      connection_id: connectionId,
      status,
      action: info.action,
      message_count: metrics.messageCount,
      total_bytes: metrics.totalBytes,
      duration_ms: Math.round(duration),
      messages_per_second: metrics.messagesPerSecond.toFixed(2),
      error_count: info.errorCount,
    },
  });

  // Log slow connections as warnings
  if (duration > 30000 && status === 'completed') {
    Sentry.addBreadcrumb({
      category: 'sse.slow',
      message: `Slow SSE connection: ${info.action}`,
      level: 'warning',
      data: {
        connection_id: connectionId,
        duration_ms: Math.round(duration),
        threshold_ms: 30000,
      },
    });
  }

  activeConnections.delete(connectionId);
  return metrics;
}

// ============================================================
// Traced SSE Wrapper
// ============================================================

/**
 * Execute a streaming SSE operation with full Sentry tracing.
 * Automatically tracks connection lifecycle, messages, and errors.
 *
 * @example
 * const result = await tracedSSEOperation(
 *   'generate-proposal',
 *   'generate_goals',
 *   async (onProgress) => {
 *     // Your SSE streaming logic here
 *     return await streamFromEndpoint(url, onProgress);
 *   }
 * );
 */
export async function tracedSSEOperation<T>(
  operationName: string,
  action: string,
  fn: (onProgress: (bytes: number) => void) => Promise<T>,
  options?: {
    tags?: Record<string, string>;
  }
): Promise<T> {
  const connectionId = `${operationName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return Sentry.startSpan(
    {
      name: `sse.${operationName}`,
      op: 'sse.stream',
      attributes: {
        'sse.action': action,
        'sse.connection_id': connectionId,
        ...options?.tags,
      },
    },
    async (span) => {
      const info = startSSEConnection(connectionId, operationName, action);

      try {
        const result = await fn((bytes: number) => {
          recordSSEMessage(connectionId, 'chunk', bytes);
        });

        recordSSEMessage(connectionId, 'done', 0);
        const metrics = endSSEConnection(connectionId, 'completed');

        // Add metrics to span
        if (metrics && span) {
          span.setAttribute('sse.message_count', metrics.messageCount);
          span.setAttribute('sse.total_bytes', metrics.totalBytes);
          span.setAttribute('sse.duration_ms', Math.round(metrics.duration));
        }

        return result;
      } catch (error) {
        recordSSEError(connectionId, error instanceof Error ? error : String(error));
        endSSEConnection(connectionId, 'error');

        // Re-throw for caller to handle
        throw error;
      }
    }
  );
}

// ============================================================
// SSE Stream Processor with Tracing
// ============================================================

/**
 * Process an SSE stream with automatic Sentry tracing.
 * Wraps the standard SSE parsing logic with metrics collection.
 */
export async function processTracedSSEStream<T>(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  options: {
    connectionId: string;
    onChunk?: (text: string) => void;
    onDone?: (content: string) => T;
    onError?: (error: Error) => void;
  }
): Promise<{ content: string; metrics: SSEMessageMetrics | null }> {
  const { connectionId, onChunk, onDone, onError } = options;
  let accumulatedContent = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      const chunk = value ? decoder.decode(value, { stream: !done }) : '';
      buffer += chunk;

      // Track bytes received
      if (value) {
        recordSSEMessage(connectionId, 'chunk', value.length);
      }

      // Split on SSE event boundaries
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        const lines = event.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'chunk' && parsed.text) {
                accumulatedContent += parsed.text;
                if (onChunk) {
                  onChunk(parsed.text);
                }
              } else if (parsed.type === 'done') {
                recordSSEMessage(connectionId, 'done', 0);
                const finalContent = parsed.content || accumulatedContent;
                if (onDone) {
                  onDone(finalContent);
                }
                const metrics = endSSEConnection(connectionId, 'completed');
                return { content: finalContent, metrics };
              } else if (parsed.type === 'error') {
                const error = new Error(parsed.error || 'SSE error');
                recordSSEError(connectionId, error);
                if (onError) {
                  onError(error);
                }
                throw error;
              }
            } catch (parseError) {
              // Skip invalid JSON - may be partial data
            }
          }
        }
      }

      if (done) break;
    }

    // Stream ended without 'done' event
    const metrics = endSSEConnection(connectionId, 'completed');
    return { content: accumulatedContent, metrics };
  } catch (error) {
    recordSSEError(connectionId, error instanceof Error ? error : String(error));
    endSSEConnection(connectionId, 'error');
    throw error;
  }
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Get all active SSE connections (for debugging).
 */
export function getActiveSSEConnections(): Map<string, SSEConnectionInfo> {
  return new Map(activeConnections);
}

/**
 * Get count of active SSE connections.
 */
export function getActiveSSEConnectionCount(): number {
  return activeConnections.size;
}

/**
 * Clear all tracked SSE connections (for cleanup/testing).
 */
export function clearSSEConnections(): void {
  activeConnections.clear();
}

/**
 * Generate a unique connection ID for SSE tracking.
 */
export function generateSSEConnectionId(prefix: string = 'sse'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Create a breadcrumb for SSE reconnection attempts.
 */
export function addSSEReconnectBreadcrumb(
  connectionId: string,
  attemptNumber: number,
  delay: number
): void {
  Sentry.addBreadcrumb({
    category: 'sse.reconnect',
    message: `SSE reconnect attempt ${attemptNumber}`,
    level: 'warning',
    data: {
      connection_id: connectionId,
      attempt: attemptNumber,
      delay_ms: delay,
    },
  });
}
