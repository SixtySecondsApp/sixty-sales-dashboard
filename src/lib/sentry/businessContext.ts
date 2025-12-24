/**
 * Business Context Tagging for Sentry
 *
 * Provides utilities to add business-specific context to Sentry events,
 * making it easier to trace errors to specific deals, pipeline stages,
 * integrations, and operations.
 */

import * as Sentry from '@sentry/react';

// Pipeline stages for type safety
export type PipelineStage = 'SQL' | 'Opportunity' | 'Verbal' | 'Signed';

// Integration types
export type IntegrationType =
  | 'fathom'
  | 'google-calendar'
  | 'google-drive'
  | 'google-docs'
  | 'gmail'
  | 'slack'
  | 'hubspot'
  | 'stripe'
  | 'clerk'
  | 'gemini'
  | 'anthropic'
  | 'supabase';

// Operation types
export type OperationType =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'sync'
  | 'import'
  | 'export'
  | 'process'
  | 'notify'
  | 'analyze';

export interface BusinessContext {
  // Index signature for Sentry's setContext compatibility
  [key: string]: string | PipelineStage | IntegrationType | OperationType | undefined;
  deal_id?: string;
  deal_name?: string;
  pipeline_stage?: PipelineStage;
  company_id?: string;
  company_name?: string;
  contact_id?: string;
  contact_email?: string;
  meeting_id?: string;
  integration?: IntegrationType;
  operation?: OperationType;
  org_id?: string;
  feature?: string;
}

/**
 * Tag the current Sentry scope with business context.
 * Use this for adding context that persists across multiple events.
 *
 * @example
 * tagBusinessContext({
 *   deal_id: '123',
 *   pipeline_stage: 'Opportunity',
 *   operation: 'update'
 * });
 */
export function tagBusinessContext(context: BusinessContext): void {
  Sentry.withScope((scope) => {
    // Add as tags for easy filtering in Sentry
    if (context.deal_id) {
      scope.setTag('deal_id', context.deal_id);
    }
    if (context.deal_name) {
      scope.setTag('deal_name', context.deal_name.slice(0, 50)); // Truncate for tag limits
    }
    if (context.pipeline_stage) {
      scope.setTag('pipeline_stage', context.pipeline_stage);
    }
    if (context.company_id) {
      scope.setTag('company_id', context.company_id);
    }
    if (context.company_name) {
      scope.setTag('company_name', context.company_name.slice(0, 50));
    }
    if (context.contact_id) {
      scope.setTag('contact_id', context.contact_id);
    }
    if (context.contact_email) {
      scope.setTag('contact_email', context.contact_email);
    }
    if (context.meeting_id) {
      scope.setTag('meeting_id', context.meeting_id);
    }
    if (context.integration) {
      scope.setTag('integration', context.integration);
    }
    if (context.operation) {
      scope.setTag('operation', context.operation);
    }
    if (context.org_id) {
      scope.setTag('org_id', context.org_id);
    }
    if (context.feature) {
      scope.setTag('feature', context.feature);
    }

    // Add full context as extra data for detailed inspection
    scope.setContext('business', context);
  });
}

/**
 * Set global business context on the current scope.
 * This context will persist until cleared.
 */
export function setGlobalBusinessContext(context: BusinessContext): void {
  Object.entries(context).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      const tagValue = typeof value === 'string' ? value.slice(0, 200) : String(value);
      Sentry.setTag(key, tagValue);
    }
  });

  Sentry.setContext('business', context);
}

/**
 * Clear business context from the current scope.
 */
export function clearBusinessContext(): void {
  const keys = [
    'deal_id',
    'deal_name',
    'pipeline_stage',
    'company_id',
    'company_name',
    'contact_id',
    'contact_email',
    'meeting_id',
    'integration',
    'operation',
    'org_id',
    'feature',
  ];

  keys.forEach((key) => {
    Sentry.setTag(key, undefined as unknown as string);
  });

  Sentry.setContext('business', null);
}

/**
 * Execute a function with deal context attached to any errors.
 * Context is automatically cleared after execution.
 *
 * @example
 * await withDealContext('deal-123', 'Opportunity', async () => {
 *   await updateDeal(dealData);
 * });
 */
export async function withDealContext<T>(
  dealId: string,
  stage: PipelineStage,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.withScope(async (scope) => {
    scope.setTag('deal_id', dealId);
    scope.setTag('pipeline_stage', stage);
    scope.setContext('deal', { deal_id: dealId, pipeline_stage: stage });

    try {
      return await fn();
    } catch (error) {
      // Add additional context before re-throwing
      scope.setExtra('deal_operation_failed', true);
      throw error;
    }
  });
}

/**
 * Execute a function with meeting context attached to any errors.
 *
 * @example
 * await withMeetingContext('meeting-456', async () => {
 *   await processMeetingTranscript(meetingId);
 * });
 */
export async function withMeetingContext<T>(meetingId: string, fn: () => Promise<T>): Promise<T> {
  return Sentry.withScope(async (scope) => {
    scope.setTag('meeting_id', meetingId);
    scope.setContext('meeting', { meeting_id: meetingId });

    try {
      return await fn();
    } catch (error) {
      scope.setExtra('meeting_operation_failed', true);
      throw error;
    }
  });
}

/**
 * Execute a function with integration context attached to any errors.
 *
 * @example
 * await withIntegrationContext('fathom', 'sync', async () => {
 *   await syncFathomMeetings();
 * });
 */
export async function withIntegrationContext<T>(
  integration: IntegrationType,
  operation: OperationType,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.withScope(async (scope) => {
    scope.setTag('integration', integration);
    scope.setTag('operation', operation);
    scope.setContext('integration', { integration, operation });

    try {
      return await fn();
    } catch (error) {
      scope.setExtra('integration_failed', true);
      throw error;
    }
  });
}

/**
 * Execute a function with company context attached to any errors.
 *
 * @example
 * await withCompanyContext('company-789', 'Acme Corp', async () => {
 *   await enrichCompanyData(companyId);
 * });
 */
export async function withCompanyContext<T>(
  companyId: string,
  companyName: string,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.withScope(async (scope) => {
    scope.setTag('company_id', companyId);
    scope.setTag('company_name', companyName.slice(0, 50));
    scope.setContext('company', { company_id: companyId, company_name: companyName });

    try {
      return await fn();
    } catch (error) {
      scope.setExtra('company_operation_failed', true);
      throw error;
    }
  });
}

/**
 * Create a breadcrumb for pipeline stage transitions.
 */
export function addPipelineTransitionBreadcrumb(
  dealId: string,
  fromStage: PipelineStage | null,
  toStage: PipelineStage
): void {
  Sentry.addBreadcrumb({
    category: 'pipeline',
    message: `Deal ${dealId} moved ${fromStage ? `from ${fromStage} ` : ''}to ${toStage}`,
    level: 'info',
    data: {
      deal_id: dealId,
      from_stage: fromStage,
      to_stage: toStage,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Create a breadcrumb for deal value changes.
 */
export function addDealValueBreadcrumb(
  dealId: string,
  previousValue: number | null,
  newValue: number,
  valueType: 'one_off' | 'mrr' | 'ltv'
): void {
  Sentry.addBreadcrumb({
    category: 'deal',
    message: `Deal ${dealId} ${valueType} changed from ${previousValue ?? 'null'} to ${newValue}`,
    level: 'info',
    data: {
      deal_id: dealId,
      value_type: valueType,
      previous_value: previousValue,
      new_value: newValue,
      change: previousValue !== null ? newValue - previousValue : newValue,
    },
  });
}

/**
 * Create a breadcrumb for integration events.
 */
export function addIntegrationBreadcrumb(
  integration: IntegrationType,
  operation: OperationType,
  message: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category: 'integration',
    message: `[${integration}:${operation}] ${message}`,
    level: 'info',
    data: {
      integration,
      operation,
      ...data,
    },
  });
}
