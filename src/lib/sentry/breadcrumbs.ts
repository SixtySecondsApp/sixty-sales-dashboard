/**
 * Sentry Breadcrumb Strategy
 *
 * Provides structured breadcrumb creation for tracking user actions
 * and application state changes before errors occur.
 */

import * as Sentry from '@sentry/react';

// ============================================================
// Navigation Breadcrumbs
// ============================================================

/**
 * Record a navigation change
 */
export function addNavigationBreadcrumb(
  from: string,
  to: string,
  options?: { trigger?: 'link' | 'back' | 'forward' | 'programmatic' }
): void {
  Sentry.addBreadcrumb({
    category: 'navigation',
    message: `Navigated from ${from} to ${to}`,
    level: 'info',
    data: {
      from,
      to,
      trigger: options?.trigger || 'link',
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Record a route parameter change
 */
export function addRouteParamBreadcrumb(
  route: string,
  params: Record<string, string>
): void {
  Sentry.addBreadcrumb({
    category: 'navigation',
    message: `Route params changed: ${route}`,
    level: 'info',
    data: {
      route,
      params,
    },
  });
}

// ============================================================
// User Interaction Breadcrumbs
// ============================================================

/**
 * Record a key button/link click
 */
export function addClickBreadcrumb(
  element: string,
  action: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category: 'ui.click',
    message: `Clicked: ${element} - ${action}`,
    level: 'info',
    data: {
      element,
      action,
      ...data,
    },
  });
}

/**
 * Record a modal open/close
 */
export function addModalBreadcrumb(
  modalName: string,
  action: 'opened' | 'closed',
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category: 'ui.modal',
    message: `Modal ${action}: ${modalName}`,
    level: 'info',
    data: {
      modal: modalName,
      action,
      ...data,
    },
  });
}

/**
 * Record a dropdown/select interaction
 */
export function addSelectBreadcrumb(
  field: string,
  value: string | string[],
  previousValue?: string | string[]
): void {
  Sentry.addBreadcrumb({
    category: 'ui.select',
    message: `Selected: ${field}`,
    level: 'info',
    data: {
      field,
      value,
      previousValue,
    },
  });
}

// ============================================================
// Form Breadcrumbs
// ============================================================

/**
 * Record form lifecycle events
 */
export function addFormBreadcrumb(
  formName: string,
  event: 'started' | 'submitted' | 'validated' | 'validation_failed' | 'reset' | 'abandoned',
  data?: Record<string, unknown>
): void {
  const levelMap: Record<typeof event, Sentry.SeverityLevel> = {
    started: 'info',
    submitted: 'info',
    validated: 'info',
    validation_failed: 'warning',
    reset: 'info',
    abandoned: 'warning',
  };

  Sentry.addBreadcrumb({
    category: 'form',
    message: `Form ${event}: ${formName}`,
    level: levelMap[event],
    data: {
      form: formName,
      event,
      ...data,
    },
  });
}

/**
 * Record form field changes (for important fields only)
 */
export function addFormFieldBreadcrumb(
  formName: string,
  field: string,
  action: 'focused' | 'changed' | 'blurred' | 'error'
): void {
  Sentry.addBreadcrumb({
    category: 'form.field',
    message: `Field ${action}: ${formName}.${field}`,
    level: action === 'error' ? 'warning' : 'info',
    data: {
      form: formName,
      field,
      action,
    },
  });
}

// ============================================================
// Pipeline/Deal Breadcrumbs
// ============================================================

/**
 * Record pipeline stage transitions
 */
export function addPipelineBreadcrumb(
  dealId: string,
  dealName: string,
  fromStage: string | null,
  toStage: string,
  method: 'drag' | 'button' | 'wizard' | 'api' = 'button'
): void {
  Sentry.addBreadcrumb({
    category: 'pipeline',
    message: `Deal moved: ${dealName} ${fromStage ? `${fromStage} → ` : ''}${toStage}`,
    level: 'info',
    data: {
      deal_id: dealId,
      deal_name: dealName,
      from_stage: fromStage,
      to_stage: toStage,
      method,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Record deal CRUD operations
 */
export function addDealBreadcrumb(
  operation: 'created' | 'updated' | 'deleted' | 'viewed' | 'split' | 'merged',
  dealId: string,
  dealName?: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category: 'deal',
    message: `Deal ${operation}: ${dealName || dealId}`,
    level: operation === 'deleted' ? 'warning' : 'info',
    data: {
      operation,
      deal_id: dealId,
      deal_name: dealName,
      ...data,
    },
  });
}

/**
 * Record activity creation
 */
export function addActivityBreadcrumb(
  activityType: string,
  entityType: 'deal' | 'contact' | 'company',
  entityId: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category: 'activity',
    message: `Activity created: ${activityType} on ${entityType}`,
    level: 'info',
    data: {
      activity_type: activityType,
      entity_type: entityType,
      entity_id: entityId,
      ...data,
    },
  });
}

// ============================================================
// Authentication Breadcrumbs
// ============================================================

/**
 * Record authentication events
 */
export function addAuthBreadcrumb(
  event: 'login' | 'logout' | 'session_refresh' | 'session_expired' | 'impersonation_start' | 'impersonation_end',
  data?: Record<string, unknown>
): void {
  const levelMap: Record<typeof event, Sentry.SeverityLevel> = {
    login: 'info',
    logout: 'info',
    session_refresh: 'info',
    session_expired: 'warning',
    impersonation_start: 'warning',
    impersonation_end: 'info',
  };

  Sentry.addBreadcrumb({
    category: 'auth',
    message: `Auth event: ${event}`,
    level: levelMap[event],
    data: {
      event,
      timestamp: new Date().toISOString(),
      ...data,
    },
  });
}

/**
 * Record permission checks
 */
export function addPermissionBreadcrumb(
  permission: string,
  granted: boolean,
  resource?: string
): void {
  Sentry.addBreadcrumb({
    category: 'auth.permission',
    message: `Permission ${granted ? 'granted' : 'denied'}: ${permission}`,
    level: granted ? 'info' : 'warning',
    data: {
      permission,
      granted,
      resource,
    },
  });
}

// ============================================================
// Integration Breadcrumbs
// ============================================================

/**
 * Record integration events
 */
export function addIntegrationBreadcrumb(
  integration: string,
  event: 'connected' | 'disconnected' | 'sync_started' | 'sync_completed' | 'sync_failed' | 'webhook_received',
  data?: Record<string, unknown>
): void {
  const levelMap: Record<typeof event, Sentry.SeverityLevel> = {
    connected: 'info',
    disconnected: 'warning',
    sync_started: 'info',
    sync_completed: 'info',
    sync_failed: 'error',
    webhook_received: 'info',
  };

  Sentry.addBreadcrumb({
    category: 'integration',
    message: `[${integration}] ${event}`,
    level: levelMap[event],
    data: {
      integration,
      event,
      ...data,
    },
  });
}

/**
 * Record API calls to external services
 */
export function addExternalApiBreadcrumb(
  service: string,
  endpoint: string,
  method: string,
  status?: number,
  duration?: number
): void {
  Sentry.addBreadcrumb({
    category: 'http',
    message: `${method} ${service}${endpoint}`,
    level: status && status >= 400 ? 'error' : 'info',
    data: {
      service,
      endpoint,
      method,
      status,
      duration_ms: duration,
    },
  });
}

// ============================================================
// Meeting Intelligence Breadcrumbs
// ============================================================

/**
 * Record meeting events
 */
export function addMeetingBreadcrumb(
  event: 'viewed' | 'synced' | 'indexed' | 'analyzed' | 'scored' | 'searched',
  meetingId: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category: 'meeting',
    message: `Meeting ${event}: ${meetingId}`,
    level: 'info',
    data: {
      event,
      meeting_id: meetingId,
      ...data,
    },
  });
}

/**
 * Record AI analysis events
 */
export function addAiBreadcrumb(
  operation: 'query' | 'analysis' | 'generation' | 'embedding' | 'scoring',
  service: 'anthropic' | 'gemini' | 'openai',
  success: boolean,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category: 'ai',
    message: `AI ${operation} via ${service}: ${success ? 'success' : 'failed'}`,
    level: success ? 'info' : 'error',
    data: {
      operation,
      service,
      success,
      ...data,
    },
  });
}

// ============================================================
// Data Operations Breadcrumbs
// ============================================================

/**
 * Record data import/export operations
 */
export function addDataBreadcrumb(
  operation: 'import' | 'export' | 'bulk_update' | 'bulk_delete',
  entity: string,
  count: number,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category: 'data',
    message: `${operation}: ${count} ${entity}(s)`,
    level: operation.includes('delete') ? 'warning' : 'info',
    data: {
      operation,
      entity,
      count,
      ...data,
    },
  });
}

/**
 * Record filter/search changes
 */
export function addFilterBreadcrumb(
  view: string,
  filters: Record<string, unknown>,
  resultCount?: number
): void {
  Sentry.addBreadcrumb({
    category: 'filter',
    message: `Filters applied on ${view}`,
    level: 'info',
    data: {
      view,
      filters,
      result_count: resultCount,
    },
  });
}

// ============================================================
// Error Context Breadcrumbs
// ============================================================

/**
 * Record a custom breadcrumb before a potentially risky operation
 */
export function addRiskyOperationBreadcrumb(
  operation: string,
  context: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category: 'operation',
    message: `Starting risky operation: ${operation}`,
    level: 'warning',
    data: {
      operation,
      ...context,
    },
  });
}

/**
 * Record a debug breadcrumb (only in development)
 */
export function addDebugBreadcrumb(
  message: string,
  data?: Record<string, unknown>
): void {
  if (import.meta.env.DEV) {
    Sentry.addBreadcrumb({
      category: 'debug',
      message,
      level: 'debug',
      data,
    });
  }
}
