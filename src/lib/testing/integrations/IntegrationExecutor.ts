/**
 * IntegrationExecutor - Executes real API calls for test_data mode
 *
 * This class handles the actual execution of integration operations,
 * calling edge functions and tracking the resources created.
 */

import { supabase } from '@/lib/supabase/clientV2';
import {
  TestableIntegration,
  ResourceType,
  TrackedResource,
} from '@/lib/types/processMapTesting';
import {
  INTEGRATION_CAPABILITIES,
  getIntegrationCapability,
  buildViewUrl,
} from './IntegrationCapabilities';
import { ResourceTracker, AddResourceOptions } from '../tracking/ResourceTracker';

/**
 * Operation type for integration calls
 */
export type IntegrationOperation = 'create' | 'read' | 'update' | 'delete';

/**
 * Context for step execution
 */
export interface StepExecutionContext {
  stepId: string;
  stepName: string;
  runId: string;
  orgId: string;
}

/**
 * Result of an integration execution
 */
export interface IntegrationExecutionResult {
  success: boolean;
  data?: Record<string, unknown>;
  resource?: TrackedResource;
  error?: string;
  errorDetails?: Record<string, unknown>;
}

/**
 * Options for creating a resource
 */
export interface CreateResourceOptions {
  integration: TestableIntegration;
  resourceType: ResourceType;
  data: Record<string, unknown>;
  stepContext: StepExecutionContext;
}

/**
 * Integration-specific context for URL building
 */
export interface IntegrationContext {
  // Organization
  orgId?: string;
  // HubSpot
  hubspotPortalId?: string;
  // Slack
  slackWorkspace?: string;
  slackChannel?: string;
  // Google
  googleCalendarId?: string;
}

/**
 * IntegrationExecutor class
 *
 * Executes integration operations and tracks created resources:
 * - Makes real API calls via edge functions
 * - Extracts external IDs from responses
 * - Builds view URLs for 3rd party apps
 * - Returns TrackedResource objects for tracking
 */
export class IntegrationExecutor {
  private resourceTracker: ResourceTracker;
  private integrationContext: IntegrationContext = {};

  constructor(resourceTracker: ResourceTracker) {
    this.resourceTracker = resourceTracker;
  }

  /**
   * Set integration context (portal IDs, workspace names, etc.)
   */
  setIntegrationContext(context: IntegrationContext): void {
    this.integrationContext = { ...this.integrationContext, ...context };
  }

  /**
   * Execute an integration operation
   */
  async execute(
    integration: TestableIntegration,
    operation: IntegrationOperation,
    resourceType: ResourceType,
    data: Record<string, unknown>,
    stepContext: StepExecutionContext
  ): Promise<IntegrationExecutionResult> {
    const capability = getIntegrationCapability(integration);

    // Validate operation is supported
    if (!this.isOperationSupported(integration, operation)) {
      return {
        success: false,
        error: `Operation "${operation}" not supported for ${capability.displayName}`,
      };
    }

    try {
      // Route to appropriate handler based on integration
      switch (integration) {
        case 'hubspot':
          return await this.executeHubSpot(operation, resourceType, data, stepContext);
        case 'slack':
          return await this.executeSlack(operation, resourceType, data, stepContext);
        case 'google_calendar':
          return await this.executeGoogleCalendar(operation, resourceType, data, stepContext);
        case 'google_email':
          return await this.executeGoogleEmail(operation, resourceType, data, stepContext);
        case 'savvycal':
          return await this.executeSavvyCal(operation, resourceType, data, stepContext);
        case 'supabase':
          return await this.executeSupabase(operation, resourceType, data, stepContext);
        case 'fathom':
        case 'justcall':
          // Read-only integrations
          if (operation === 'read') {
            return await this.executeReadOnly(integration, resourceType, data, stepContext);
          }
          return {
            success: false,
            error: `${capability.displayName} is read-only`,
          };
        default:
          return {
            success: false,
            error: `Unknown integration: ${integration}`,
          };
      }
    } catch (error) {
      console.error(`[IntegrationExecutor] Error executing ${integration} ${operation}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: { originalError: error },
      };
    }
  }

  /**
   * Check if an operation is supported for an integration
   */
  private isOperationSupported(
    integration: TestableIntegration,
    operation: IntegrationOperation
  ): boolean {
    const capability = INTEGRATION_CAPABILITIES[integration];
    switch (operation) {
      case 'create':
        return capability.supportsCreate;
      case 'read':
        return capability.supportsRead;
      case 'update':
        return capability.supportsUpdate;
      case 'delete':
        return capability.supportsDelete;
      default:
        return false;
    }
  }

  /**
   * Execute HubSpot operations via hubspot-admin edge function
   */
  private async executeHubSpot(
    operation: IntegrationOperation,
    resourceType: ResourceType,
    data: Record<string, unknown>,
    stepContext: StepExecutionContext
  ): Promise<IntegrationExecutionResult> {
    // Map operation + resourceType to hubspot-admin action
    const action = this.getHubSpotAction(operation, resourceType);

    // Get org_id from integration context or data
    const orgId = this.integrationContext.orgId || data.org_id;
    if (!orgId) {
      return { success: false, error: 'org_id is required for HubSpot operations' };
    }

    // Build request body based on operation
    const body: Record<string, unknown> = {
      action,
      org_id: orgId,
    };

    if (operation === 'create') {
      // For create operations, pass properties
      body.properties = data.properties || this.buildHubSpotProperties(resourceType, data);
    } else if (operation === 'delete') {
      // For delete operations, pass record_id
      body.record_id = data.record_id || data.externalId || data.id;
    } else if (operation === 'read') {
      // For read operations, pass record_id if specified
      if (data.record_id || data.id) {
        body.record_id = data.record_id || data.id;
      }
    }

    console.log('[IntegrationExecutor] Calling hubspot-admin with:', { action, org_id: orgId });

    const { data: response, error } = await supabase.functions.invoke('hubspot-admin', {
      body,
    });

    if (error) {
      console.error('[IntegrationExecutor] HubSpot error:', error);
      return { success: false, error: error.message };
    }

    if (!response?.success) {
      console.error('[IntegrationExecutor] HubSpot returned error:', response?.error);
      return { success: false, error: response?.error || 'HubSpot operation failed' };
    }

    // Track created resources
    if (operation === 'create' && response?.id) {
      const viewUrl = buildViewUrl('hubspot', resourceType, response.id, {
        portalId: this.integrationContext.hubspotPortalId,
      });

      const resource = this.resourceTracker.addResource({
        integration: 'hubspot',
        resourceType,
        displayName: this.extractDisplayName(response, resourceType),
        externalId: response.id,
        viewUrl,
        createdByStepId: stepContext.stepId,
        createdByStepName: stepContext.stepName,
        rawData: response,
      });

      return { success: true, data: response, resource };
    }

    return { success: true, data: response };
  }

  /**
   * Get HubSpot admin action for operation + resource type
   */
  private getHubSpotAction(operation: IntegrationOperation, resourceType: ResourceType): string {
    const actionMap: Record<string, string> = {
      'create-contact': 'create_contact',
      'create-deal': 'create_deal',
      'delete-contact': 'delete_contact',
      'delete-deal': 'delete_deal',
      'read-status': 'status',
      'read-properties': 'get_properties',
      'read-pipelines': 'get_pipelines',
    };
    return actionMap[`${operation}-${resourceType}`] || `${operation}_${resourceType}`;
  }

  /**
   * Build HubSpot properties object from data
   */
  private buildHubSpotProperties(
    resourceType: ResourceType,
    data: Record<string, unknown>
  ): Record<string, unknown> {
    if (resourceType === 'contact') {
      return {
        email: data.email || `test-${Date.now()}@60test.com`,
        firstname: data.firstname || data.firstName || 'Test',
        lastname: data.lastname || data.lastName || 'Contact',
        phone: data.phone,
        company: data.company,
        ...(data.properties as Record<string, unknown> || {}),
      };
    }
    if (resourceType === 'deal') {
      return {
        dealname: data.dealname || data.name || `Test Deal ${Date.now()}`,
        amount: data.amount,
        pipeline: data.pipeline || 'default',
        dealstage: data.dealstage || data.stage,
        closedate: data.closedate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        ...(data.properties as Record<string, unknown> || {}),
      };
    }
    return data.properties as Record<string, unknown> || {};
  }

  /**
   * Execute Slack operations
   */
  private async executeSlack(
    operation: IntegrationOperation,
    resourceType: ResourceType,
    data: Record<string, unknown>,
    stepContext: StepExecutionContext
  ): Promise<IntegrationExecutionResult> {
    const { data: response, error } = await supabase.functions.invoke('slack-send-message', {
      body: { ...data, operation },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (operation === 'create' && response?.ts) {
      const viewUrl = buildViewUrl('slack', resourceType, response.ts, {
        workspace: this.integrationContext.slackWorkspace,
        channel: response.channel || data.channel as string,
        timestamp: response.ts,
      });

      const resource = this.resourceTracker.addResource({
        integration: 'slack',
        resourceType: 'message',
        displayName: `Slack message in #${response.channel || 'unknown'}`,
        externalId: response.ts,
        viewUrl,
        createdByStepId: stepContext.stepId,
        createdByStepName: stepContext.stepName,
        rawData: response,
      });

      return { success: true, data: response, resource };
    }

    return { success: true, data: response };
  }

  /**
   * Execute Google Calendar operations
   */
  private async executeGoogleCalendar(
    operation: IntegrationOperation,
    resourceType: ResourceType,
    data: Record<string, unknown>,
    stepContext: StepExecutionContext
  ): Promise<IntegrationExecutionResult> {
    const { data: response, error } = await supabase.functions.invoke('google-calendar-create-event', {
      body: { ...data, operation },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (operation === 'create' && response?.id) {
      // Create encoded ID for Google Calendar URL
      const encodedId = response.htmlLink
        ? response.htmlLink.split('eid=')[1]
        : btoa(`${response.id} ${this.integrationContext.googleCalendarId || 'primary'}`);

      const viewUrl = buildViewUrl('google_calendar', resourceType, response.id, {
        encodedId,
      });

      const resource = this.resourceTracker.addResource({
        integration: 'google_calendar',
        resourceType: 'calendar_event',
        displayName: response.summary || 'Calendar Event',
        externalId: response.id,
        viewUrl: response.htmlLink || viewUrl,
        createdByStepId: stepContext.stepId,
        createdByStepName: stepContext.stepName,
        rawData: response,
      });

      return { success: true, data: response, resource };
    }

    return { success: true, data: response };
  }

  /**
   * Execute Google Email operations
   */
  private async executeGoogleEmail(
    operation: IntegrationOperation,
    resourceType: ResourceType,
    data: Record<string, unknown>,
    stepContext: StepExecutionContext
  ): Promise<IntegrationExecutionResult> {
    const { data: response, error } = await supabase.functions.invoke('google-send-email', {
      body: data,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (operation === 'create' && response?.id) {
      const viewUrl = buildViewUrl('google_email', resourceType, response.id, {
        messageId: response.id,
      });

      const resource = this.resourceTracker.addResource({
        integration: 'google_email',
        resourceType: 'email',
        displayName: `Email to ${data.to || 'recipient'}`,
        externalId: response.id,
        viewUrl,
        createdByStepId: stepContext.stepId,
        createdByStepName: stepContext.stepName,
        rawData: response,
      });

      return { success: true, data: response, resource };
    }

    return { success: true, data: response };
  }

  /**
   * Execute SavvyCal operations
   */
  private async executeSavvyCal(
    operation: IntegrationOperation,
    resourceType: ResourceType,
    data: Record<string, unknown>,
    stepContext: StepExecutionContext
  ): Promise<IntegrationExecutionResult> {
    const { data: response, error } = await supabase.functions.invoke('savvycal-create-booking', {
      body: { ...data, operation },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (operation === 'create' && response?.id) {
      const viewUrl = buildViewUrl('savvycal', resourceType, response.id);

      const resource = this.resourceTracker.addResource({
        integration: 'savvycal',
        resourceType: 'booking',
        displayName: response.title || 'SavvyCal Booking',
        externalId: response.id,
        viewUrl,
        createdByStepId: stepContext.stepId,
        createdByStepName: stepContext.stepName,
        rawData: response,
      });

      return { success: true, data: response, resource };
    }

    return { success: true, data: response };
  }

  /**
   * Execute Supabase (internal database) operations
   */
  private async executeSupabase(
    operation: IntegrationOperation,
    resourceType: ResourceType,
    data: Record<string, unknown>,
    stepContext: StepExecutionContext
  ): Promise<IntegrationExecutionResult> {
    const tableName = this.getSupabaseTable(resourceType);

    if (operation === 'create') {
      const { data: response, error } = await supabase
        .from(tableName)
        .insert(data)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      const resource = this.resourceTracker.addResource({
        integration: 'supabase',
        resourceType,
        displayName: this.extractDisplayName(response, resourceType),
        externalId: response.id,
        viewUrl: null, // Internal database
        createdByStepId: stepContext.stepId,
        createdByStepName: stepContext.stepName,
        rawData: response,
      });

      return { success: true, data: response, resource };
    }

    if (operation === 'read') {
      const { data: response, error } = await supabase
        .from(tableName)
        .select('*')
        .match(data as Record<string, string>);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: { records: response } };
    }

    return { success: false, error: `Supabase ${operation} not implemented` };
  }

  /**
   * Execute read-only integration operations (Fathom, JustCall)
   */
  private async executeReadOnly(
    integration: TestableIntegration,
    resourceType: ResourceType,
    data: Record<string, unknown>,
    stepContext: StepExecutionContext
  ): Promise<IntegrationExecutionResult> {
    const endpoint = integration === 'fathom' ? 'fathom-get-calls' : 'justcall-get-calls';

    const { data: response, error } = await supabase.functions.invoke(endpoint, {
      body: data,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // For read operations, we might still want to track what was accessed
    // but these won't need cleanup
    return { success: true, data: response };
  }

  /**
   * Get HubSpot edge function endpoint based on operation and resource type
   */
  private getHubSpotEndpoint(operation: IntegrationOperation, resourceType: ResourceType): string {
    const endpoints: Record<string, string> = {
      'create-contact': 'hubspot-create-contact',
      'create-deal': 'hubspot-create-deal',
      'create-task': 'hubspot-create-task',
      'read-contact': 'hubspot-get-contact',
      'read-deal': 'hubspot-get-deal',
      default: 'hubspot-api',
    };

    return endpoints[`${operation}-${resourceType}`] || endpoints.default;
  }

  /**
   * Get Supabase table name for a resource type
   */
  private getSupabaseTable(resourceType: ResourceType): string {
    const tables: Record<ResourceType, string> = {
      contact: 'contacts',
      deal: 'deals',
      task: 'tasks',
      activity: 'activities',
      meeting: 'meetings',
      calendar_event: 'calendar_events',
      email: 'emails',
      message: 'messages',
      call: 'calls',
      booking: 'bookings',
      record: 'records',
    };
    return tables[resourceType];
  }

  /**
   * Extract a display name from response data
   */
  private extractDisplayName(data: Record<string, unknown>, resourceType: ResourceType): string {
    // Try common name fields
    const nameFields = ['name', 'title', 'subject', 'summary', 'firstName', 'email'];

    for (const field of nameFields) {
      if (data[field] && typeof data[field] === 'string') {
        return data[field] as string;
      }
    }

    // Combine first and last name for contacts
    if (data.firstName || data.lastName) {
      return `${data.firstName || ''} ${data.lastName || ''}`.trim();
    }

    // Fallback
    return `${resourceType} ${data.id || 'unknown'}`;
  }

  /**
   * Get the resource tracker
   */
  getResourceTracker(): ResourceTracker {
    return this.resourceTracker;
  }
}
