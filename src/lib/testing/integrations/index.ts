/**
 * Integrations module for test_data mode
 *
 * Provides integration capabilities and execution for real API calls.
 */

export {
  INTEGRATION_CAPABILITIES,
  HUBSPOT_CAPABILITY,
  FATHOM_CAPABILITY,
  GOOGLE_CALENDAR_CAPABILITY,
  GOOGLE_EMAIL_CAPABILITY,
  SLACK_CAPABILITY,
  JUSTCALL_CAPABILITY,
  SAVVYCAL_CAPABILITY,
  SUPABASE_CAPABILITY,
  getIntegrationCapability,
  supportsCleanup,
  getCleanableIntegrations,
  getReadOnlyIntegrations,
  buildViewUrl,
  getAllSupportedResourceTypes,
  getIntegrationsForResourceType,
} from './IntegrationCapabilities';

export {
  IntegrationExecutor,
  type IntegrationOperation,
  type RawIntegrationOperation,
  type StepExecutionContext,
  type IntegrationExecutionResult,
  type CreateResourceOptions,
  type IntegrationContext,
} from './IntegrationExecutor';
