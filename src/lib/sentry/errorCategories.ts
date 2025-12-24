/**
 * Error Categorization System
 *
 * Provides structured error categorization for better Sentry grouping
 * and analysis of error patterns.
 */

import * as Sentry from '@sentry/react';

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  /** Network/connection failures */
  NETWORK = 'network',
  /** Authentication/authorization errors */
  AUTH = 'auth',
  /** Input validation failures */
  VALIDATION = 'validation',
  /** Domain/business rule violations */
  BUSINESS_LOGIC = 'business_logic',
  /** Third-party service errors */
  INTEGRATION = 'integration',
  /** Supabase/PostgreSQL errors */
  DATABASE = 'database',
  /** Uncategorized errors */
  UNKNOWN = 'unknown',
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  /** User can retry, no data loss */
  LOW = 'low',
  /** Some functionality affected */
  MEDIUM = 'medium',
  /** Core functionality broken */
  HIGH = 'high',
  /** Data loss or security issue possible */
  CRITICAL = 'critical',
}

/**
 * Context for categorized errors
 */
export interface ErrorContext {
  /** The error category */
  category: ErrorCategory;
  /** Severity level */
  severity?: ErrorSeverity;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** User-facing message (if different from error message) */
  userMessage?: string;
  /** Whether this error is recoverable */
  recoverable?: boolean;
  /** Suggested recovery action */
  recoveryAction?: string;
}

// Pattern matchers for automatic categorization
const NETWORK_PATTERNS = [
  /fetch failed/i,
  /network error/i,
  /net::ERR_/i,
  /failed to fetch/i,
  /connection refused/i,
  /timeout/i,
  /ETIMEDOUT/i,
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /ERR_INTERNET_DISCONNECTED/i,
];

const AUTH_PATTERNS = [
  /unauthorized/i,
  /unauthenticated/i,
  /invalid.*token/i,
  /token.*expired/i,
  /session.*expired/i,
  /jwt.*expired/i,
  /invalid.*credentials/i,
  /access.*denied/i,
  /permission.*denied/i,
  /forbidden/i,
  /PGRST301/i, // Supabase auth error
];

const VALIDATION_PATTERNS = [
  /validation.*failed/i,
  /invalid.*input/i,
  /required.*field/i,
  /invalid.*format/i,
  /invalid.*type/i,
  /must.*be/i,
  /should.*be/i,
  /expected/i,
  /schema.*error/i,
];

const DATABASE_PATTERNS = [
  /PGRST/i, // Supabase/PostgREST errors
  /duplicate.*key/i,
  /unique.*constraint/i,
  /foreign.*key/i,
  /null.*constraint/i,
  /check.*constraint/i,
  /database.*error/i,
  /sql.*error/i,
  /relation.*does not exist/i,
  /column.*does not exist/i,
  /RLS/i,
  /row-level security/i,
];

const INTEGRATION_PATTERNS = [
  /fathom/i,
  /google/i,
  /slack/i,
  /hubspot/i,
  /stripe/i,
  /oauth/i,
  /api.*rate.*limit/i,
  /rate.*limited/i,
  /429/i,
  /external.*service/i,
  /third.*party/i,
];

const BUSINESS_LOGIC_PATTERNS = [
  /insufficient.*balance/i,
  /already.*exists/i,
  /not.*found/i,
  /invalid.*state/i,
  /operation.*not.*allowed/i,
  /cannot.*delete/i,
  /cannot.*modify/i,
  /limit.*exceeded/i,
  /quota.*exceeded/i,
];

/**
 * Categorize an error based on its message and properties
 */
export function categorizeError(error: unknown): ErrorCategory {
  const message = getErrorMessage(error);
  const errorCode = getErrorCode(error);

  // Check HTTP status codes first
  if (errorCode) {
    if (errorCode === 401 || errorCode === 403) return ErrorCategory.AUTH;
    if (errorCode === 400 || errorCode === 422) return ErrorCategory.VALIDATION;
    if (errorCode === 404) return ErrorCategory.BUSINESS_LOGIC;
    if (errorCode === 429) return ErrorCategory.INTEGRATION;
    if (errorCode >= 500 && errorCode < 600) return ErrorCategory.DATABASE;
  }

  // Check message patterns
  if (NETWORK_PATTERNS.some((p) => p.test(message))) return ErrorCategory.NETWORK;
  if (AUTH_PATTERNS.some((p) => p.test(message))) return ErrorCategory.AUTH;
  if (DATABASE_PATTERNS.some((p) => p.test(message))) return ErrorCategory.DATABASE;
  if (INTEGRATION_PATTERNS.some((p) => p.test(message))) return ErrorCategory.INTEGRATION;
  if (VALIDATION_PATTERNS.some((p) => p.test(message))) return ErrorCategory.VALIDATION;
  if (BUSINESS_LOGIC_PATTERNS.some((p) => p.test(message))) return ErrorCategory.BUSINESS_LOGIC;

  return ErrorCategory.UNKNOWN;
}

/**
 * Determine severity based on error category and context
 */
export function determineSeverity(
  category: ErrorCategory,
  error: unknown
): ErrorSeverity {
  const errorCode = getErrorCode(error);

  switch (category) {
    case ErrorCategory.AUTH:
      // 401s are usually low severity (user just needs to login)
      // 403s are higher (shouldn't happen in normal flow)
      return errorCode === 403 ? ErrorSeverity.HIGH : ErrorSeverity.LOW;

    case ErrorCategory.VALIDATION:
      return ErrorSeverity.LOW; // User can fix their input

    case ErrorCategory.NETWORK:
      return ErrorSeverity.MEDIUM; // Transient, might resolve

    case ErrorCategory.DATABASE:
      // Check for RLS violations (security concern)
      if (getErrorMessage(error).toLowerCase().includes('rls')) {
        return ErrorSeverity.CRITICAL;
      }
      return ErrorSeverity.HIGH;

    case ErrorCategory.INTEGRATION:
      return ErrorSeverity.MEDIUM; // External service issue

    case ErrorCategory.BUSINESS_LOGIC:
      return ErrorSeverity.MEDIUM;

    case ErrorCategory.UNKNOWN:
    default:
      return ErrorSeverity.HIGH; // Unknown errors are concerning
  }
}

/**
 * Get a user-friendly message for an error category
 */
export function getUserMessage(
  category: ErrorCategory,
  error: unknown
): string {
  switch (category) {
    case ErrorCategory.NETWORK:
      return 'Unable to connect. Please check your internet connection and try again.';

    case ErrorCategory.AUTH:
      return 'Your session has expired. Please sign in again.';

    case ErrorCategory.VALIDATION:
      return 'Please check your input and try again.';

    case ErrorCategory.DATABASE:
      return 'A data error occurred. Please try again or contact support.';

    case ErrorCategory.INTEGRATION:
      return 'An external service is unavailable. Please try again later.';

    case ErrorCategory.BUSINESS_LOGIC:
      return getErrorMessage(error) || 'This operation cannot be completed.';

    case ErrorCategory.UNKNOWN:
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Capture an error with category context to Sentry
 */
export function captureWithCategory(
  error: unknown,
  additionalContext?: Partial<ErrorContext>
): string {
  const category = additionalContext?.category ?? categorizeError(error);
  const severity = additionalContext?.severity ?? determineSeverity(category, error);

  // Map severity to Sentry level
  const sentryLevel = mapSeverityToSentryLevel(severity);

  // Build context
  const context: ErrorContext = {
    category,
    severity,
    userMessage: additionalContext?.userMessage ?? getUserMessage(category, error),
    recoverable:
      additionalContext?.recoverable ??
      (category !== ErrorCategory.AUTH && severity !== ErrorSeverity.CRITICAL),
    ...additionalContext,
  };

  // Set tags for filtering in Sentry
  Sentry.setTag('error.category', category);
  Sentry.setTag('error.severity', severity);
  if (context.recoverable !== undefined) {
    Sentry.setTag('error.recoverable', String(context.recoverable));
  }

  // Capture with context
  const eventId = Sentry.captureException(error, {
    level: sentryLevel,
    extra: {
      errorContext: context,
      ...context.metadata,
    },
  });

  return eventId;
}

/**
 * Helper: Get error message from various error types
 */
function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    if ('error' in error && typeof error.error === 'string') {
      return error.error;
    }
  }
  return String(error);
}

/**
 * Helper: Get HTTP error code if present
 */
function getErrorCode(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    if ('status' in error && typeof error.status === 'number') {
      return error.status;
    }
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return error.statusCode;
    }
    if ('code' in error && typeof error.code === 'number') {
      return error.code;
    }
  }
  return undefined;
}

/**
 * Helper: Map severity to Sentry level
 */
function mapSeverityToSentryLevel(
  severity: ErrorSeverity
): 'fatal' | 'error' | 'warning' | 'info' {
  switch (severity) {
    case ErrorSeverity.CRITICAL:
      return 'fatal';
    case ErrorSeverity.HIGH:
      return 'error';
    case ErrorSeverity.MEDIUM:
      return 'warning';
    case ErrorSeverity.LOW:
      return 'info';
    default:
      return 'error';
  }
}

/**
 * Create an error categorization wrapper for async functions
 */
export function withErrorCategory<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: Partial<ErrorContext>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureWithCategory(error, context);
      throw error;
    }
  }) as T;
}
