/**
 * Sentry Error Monitoring Configuration
 * 
 * Provides centralized error monitoring and performance tracking.
 * Only initializes in production or when explicitly enabled.
 */

import * as Sentry from '@sentry/react';

// Get Sentry DSN from environment
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const IS_PRODUCTION = import.meta.env.PROD;
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '2.1.5';

// Only initialize Sentry if DSN is provided
export function initSentry() {
  if (!SENTRY_DSN) {
    if (IS_PRODUCTION) {
      console.warn('[Sentry] No SENTRY_DSN provided - error monitoring disabled');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    
    // Release tracking for error grouping
    release: `sixty-sales-dashboard@${APP_VERSION}`,
    
    // Environment tagging
    environment: IS_PRODUCTION ? 'production' : 'development',
    
    // Performance monitoring - sample 10% in production, 100% in dev
    tracesSampleRate: IS_PRODUCTION ? 0.1 : 1.0,
    
    // Session replay - capture 1% of sessions, 100% with errors
    replaysSessionSampleRate: IS_PRODUCTION ? 0.01 : 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    // Integrations
    integrations: [
      // Browser tracing for performance
      Sentry.browserTracingIntegration(),
      // Session replay for debugging
      Sentry.replayIntegration({
        // Mask all text and block all media for privacy
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    // Filter out noisy errors
    beforeSend(event, hint) {
      const error = hint.originalException;
      
      // Ignore chunk loading errors (handled by main.tsx)
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (
          message.includes('failed to fetch dynamically imported module') ||
          message.includes('loading chunk') ||
          message.includes('loading css chunk')
        ) {
          return null; // Don't send to Sentry
        }
        
        // Ignore network errors during offline scenarios
        if (message.includes('network error') || message.includes('fetch failed')) {
          // Only ignore if user is offline
          if (!navigator.onLine) {
            return null;
          }
        }
        
        // Ignore cancelled requests
        if (message.includes('aborted') || message.includes('cancelled')) {
          return null;
        }
      }
      
      return event;
    },
    
    // Don't send in development unless explicitly enabled
    enabled: IS_PRODUCTION || import.meta.env.VITE_SENTRY_ENABLED === 'true',
    
    // Attach user context when available
    beforeSendTransaction(event) {
      // Performance transactions get the same treatment
      return event;
    },
  });

  console.log('[Sentry] Initialized successfully', {
    environment: IS_PRODUCTION ? 'production' : 'development',
    release: `sixty-sales-dashboard@${APP_VERSION}`,
  });
}

/**
 * Set user context for Sentry
 * Call this after user authentication
 */
export function setSentryUser(user: {
  id: string;
  email?: string;
  name?: string;
  orgId?: string;
  orgName?: string;
  isAdmin?: boolean;
}) {
  if (!SENTRY_DSN) return;
  
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
  });
  
  // Set organization context
  if (user.orgId) {
    Sentry.setTag('org_id', user.orgId);
    Sentry.setTag('org_name', user.orgName || 'Unknown');
  }
  
  if (user.isAdmin !== undefined) {
    Sentry.setTag('is_admin', String(user.isAdmin));
  }
}

/**
 * Clear user context (call on logout)
 */
export function clearSentryUser() {
  if (!SENTRY_DSN) return;
  Sentry.setUser(null);
}

/**
 * Capture a custom error with additional context
 */
export function captureError(
  error: Error | string,
  context?: Record<string, any>
) {
  if (!SENTRY_DSN) {
    console.error('[Error]', error, context);
    return;
  }
  
  if (typeof error === 'string') {
    Sentry.captureMessage(error, {
      level: 'error',
      extra: context,
    });
  } else {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

/**
 * Capture a breadcrumb for debugging
 */
export function captureBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
) {
  if (!SENTRY_DSN) return;
  
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

/**
 * Start a performance transaction
 */
export function startTransaction(
  name: string,
  op: string,
  data?: Record<string, any>
) {
  if (!SENTRY_DSN) return null;
  
  return Sentry.startInactiveSpan({
    name,
    op,
    attributes: data,
  });
}

// Export Sentry for advanced usage
export { Sentry };

// Export error boundary component
export const SentryErrorBoundary = Sentry.ErrorBoundary;
