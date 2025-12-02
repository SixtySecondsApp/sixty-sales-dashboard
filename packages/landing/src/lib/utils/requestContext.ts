import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

/**
 * Request context system for tracking HTTP requests in audit logs
 * This system captures HTTP method, endpoint, headers, status, and timing information
 */

export interface RequestMetadata {
  method: string;
  endpoint: string;
  headers?: Record<string, string>;
  status?: number;
  duration?: number;
  startTime?: number;
}

let currentRequestContext: RequestMetadata | null = null;

/**
 * Sensitive headers that should be filtered out from audit logs
 */
const SENSITIVE_HEADERS = [
  'authorization',
  'x-api-key',
  'cookie',
  'x-auth-token',
  'x-access-token',
  'x-refresh-token',
  'x-session-token',
  'x-csrf-token',
  'x-xsrf-token',
  'x-supabase-auth',
  'apikey'
];

/**
 * Headers that are useful for audit logging
 */
const AUDIT_RELEVANT_HEADERS = [
  'user-agent',
  'referer',
  'origin',
  'x-forwarded-for',
  'x-real-ip',
  'x-client-ip',
  'content-type',
  'accept',
  'accept-language',
  'x-request-id',
  'x-correlation-id',
  'x-trace-id'
];

/**
 * Filter headers to remove sensitive information and keep only audit-relevant headers
 */
function filterHeaders(headers: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    
    // Skip sensitive headers
    if (SENSITIVE_HEADERS.includes(lowerKey)) {
      continue;
    }
    
    // Include audit-relevant headers
    if (AUDIT_RELEVANT_HEADERS.includes(lowerKey)) {
      filtered[key] = value;
    }
  }
  
  return filtered;
}

/**
 * Set request context for audit logging
 */
export async function setRequestContext(metadata: RequestMetadata): Promise<void> {
  currentRequestContext = {
    ...metadata,
    startTime: metadata.startTime || Date.now()
  };
  
  // Filter sensitive headers
  const filteredHeaders = metadata.headers ? filterHeaders(metadata.headers) : undefined;
  
  try {
    // Set request context in Supabase for use in audit triggers
    await supabase.rpc('set_request_context', {
      p_method: metadata.method,
      p_endpoint: metadata.endpoint,
      p_headers: filteredHeaders ? JSON.stringify(filteredHeaders) : null,
      p_status: metadata.status || null,
      p_duration: metadata.duration || null
    });
  } catch (error) {
    logger.error('Failed to set request context:', error);
  }
}

/**
 * Update request context with response information
 */
export async function updateRequestContext(
  status: number,
  additionalHeaders?: Record<string, string>
): Promise<void> {
  if (!currentRequestContext) {
    return;
  }
  
  const duration = Date.now() - (currentRequestContext.startTime || Date.now());
  
  currentRequestContext = {
    ...currentRequestContext,
    status,
    duration,
    headers: additionalHeaders 
      ? { ...currentRequestContext.headers, ...filterHeaders(additionalHeaders) }
      : currentRequestContext.headers
  };
  
  try {
    // Update request context in Supabase
    await supabase.rpc('set_request_context', {
      p_method: currentRequestContext.method,
      p_endpoint: currentRequestContext.endpoint,
      p_headers: currentRequestContext.headers ? JSON.stringify(currentRequestContext.headers) : null,
      p_status: status,
      p_duration: duration
    });
  } catch (error) {
    logger.error('Failed to update request context:', error);
  }
}

/**
 * Get current request context
 */
export function getCurrentRequestContext(): RequestMetadata | null {
  return currentRequestContext;
}

/**
 * Clear request context
 */
export function clearRequestContext(): void {
  currentRequestContext = null;
}

/**
 * Execute a function with request context
 */
export async function withRequestContext<T>(
  metadata: RequestMetadata,
  operation: () => Promise<T>
): Promise<T> {
  const previousContext = getCurrentRequestContext();
  
  try {
    await setRequestContext(metadata);
    const result = await operation();
    return result;
  } finally {
    if (previousContext) {
      await setRequestContext(previousContext);
    } else {
      clearRequestContext();
    }
  }
}

/**
 * Middleware wrapper for API routes to automatically track request context
 */
export function withRequestTracking<T extends any[], R>(
  handler: (...args: T) => Promise<R>,
  getMetadata: (...args: T) => RequestMetadata
) {
  return async (...args: T): Promise<R> => {
    const metadata = getMetadata(...args);
    return withRequestContext(metadata, () => handler(...args));
  };
}

/**
 * Helper to extract request metadata from various sources
 */
export function extractRequestMetadata(
  req?: Request | any,
  endpoint?: string,
  method?: string
): RequestMetadata {
  const metadata: RequestMetadata = {
    method: method || req?.method || 'UNKNOWN',
    endpoint: endpoint || req?.url || req?.pathname || 'UNKNOWN',
    startTime: Date.now()
  };
  
  // Extract headers if available
  if (req?.headers) {
    if (typeof req.headers.get === 'function') {
      // Headers object with .get() method (like in Fetch API)
      const headers: Record<string, string> = {};
      AUDIT_RELEVANT_HEADERS.forEach(header => {
        const value = req.headers.get(header);
        if (value) {
          headers[header] = value;
        }
      });
      metadata.headers = headers;
    } else if (typeof req.headers === 'object') {
      // Plain object headers
      metadata.headers = filterHeaders(req.headers);
    }
  }
  
  return metadata;
}

/**
 * Helper to extract request metadata from window.location and navigator
 */
export function extractClientRequestMetadata(
  method: string = 'GET',
  endpoint?: string
): RequestMetadata {
  if (typeof window === 'undefined') {
    return {
      method,
      endpoint: endpoint || 'UNKNOWN',
      startTime: Date.now()
    };
  }
  
  const headers: Record<string, string> = {};
  
  // Add user agent
  if (navigator.userAgent) {
    headers['user-agent'] = navigator.userAgent;
  }
  
  // Add language
  if (navigator.language) {
    headers['accept-language'] = navigator.language;
  }
  
  // Add referrer
  if (document.referrer) {
    headers['referer'] = document.referrer;
  }
  
  // Add origin
  if (window.location.origin) {
    headers['origin'] = window.location.origin;
  }
  
  return {
    method,
    endpoint: endpoint || window.location.pathname + window.location.search,
    headers,
    startTime: Date.now()
  };
}

/**
 * React hook for request context in client-side components
 */
export function useRequestContext(
  method: string = 'GET',
  endpoint?: string
): {
  setContext: (metadata: RequestMetadata) => Promise<void>;
  updateContext: (status: number, additionalHeaders?: Record<string, string>) => Promise<void>;
  getCurrentContext: () => RequestMetadata | null;
  clearContext: () => void;
} {
  // Initialize with client-side metadata
  const clientMetadata = extractClientRequestMetadata(method, endpoint);
  
  return {
    setContext: setRequestContext,
    updateContext: updateRequestContext,
    getCurrentContext: getCurrentRequestContext,
    clearContext: clearRequestContext
  };
}

/**
 * Utility to track a database operation with request context
 */
export async function trackDatabaseOperation<T>(
  operation: () => Promise<T>,
  context?: {
    method?: string;
    endpoint?: string;
    description?: string;
  }
): Promise<T> {
  const metadata = context ? {
    method: context.method || 'DATABASE',
    endpoint: context.endpoint || context.description || 'database_operation',
    startTime: Date.now()
  } : null;
  
  if (metadata) {
    await setRequestContext(metadata);
  }
  
  try {
    const result = await operation();
    
    if (metadata) {
      await updateRequestContext(200);
    }
    
    return result;
  } catch (error) {
    if (metadata) {
      await updateRequestContext(500);
    }
    throw error;
  }
}

/**
 * Performance monitoring utilities
 */
export class RequestPerformanceMonitor {
  private startTime: number;
  private metadata: RequestMetadata;
  
  constructor(metadata: RequestMetadata) {
    this.startTime = Date.now();
    this.metadata = { ...metadata, startTime: this.startTime };
  }
  
  async start(): Promise<void> {
    await setRequestContext(this.metadata);
  }
  
  async end(status: number, additionalHeaders?: Record<string, string>): Promise<void> {
    const duration = Date.now() - this.startTime;
    await updateRequestContext(status, additionalHeaders);
    
    // Log performance metrics if duration is significant
    if (duration > 1000) { // Log slow requests (>1 second)
      logger.warn(`Slow request detected: ${this.metadata.method} ${this.metadata.endpoint} took ${duration}ms`);
    }
  }
}

export default {
  setRequestContext,
  updateRequestContext,
  getCurrentRequestContext,
  clearRequestContext,
  withRequestContext,
  withRequestTracking,
  extractRequestMetadata,
  extractClientRequestMetadata,
  useRequestContext,
  trackDatabaseOperation,
  RequestPerformanceMonitor
};