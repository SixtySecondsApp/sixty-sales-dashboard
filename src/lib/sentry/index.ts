/**
 * Sentry Integration Module
 *
 * Unified exports for all Sentry-related functionality.
 */

// Re-export everything from sub-modules
export * from './errorCategories';
export * from './tracing';
export * from './businessContext';
// Breadcrumbs has some overlapping names with businessContext, so import selectively
export {
  addNavigationBreadcrumb,
  addRouteParamBreadcrumb,
  addClickBreadcrumb,
  addModalBreadcrumb,
  addSelectBreadcrumb,
  addFormBreadcrumb,
  addFormFieldBreadcrumb,
  addPipelineBreadcrumb,
  addDealBreadcrumb,
  addActivityBreadcrumb,
  addAuthBreadcrumb,
  addPermissionBreadcrumb,
  addExternalApiBreadcrumb,
  addMeetingBreadcrumb,
  addAiBreadcrumb,
  addDataBreadcrumb,
  addFilterBreadcrumb,
  addRiskyOperationBreadcrumb,
  addDebugBreadcrumb,
  // Note: addIntegrationBreadcrumb is exported from businessContext.ts
} from './breadcrumbs';
export * from './profiling';
export * from './sseTracing';

// Re-export core Sentry for convenience
export * as Sentry from '@sentry/react';
