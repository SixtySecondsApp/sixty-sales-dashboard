/**
 * IntegrationCapabilities - Defines capabilities for each integration
 *
 * This file contains the capability definitions for each integration,
 * including what operations are supported, URL patterns for viewing
 * resources in 3rd party apps, and delete endpoints for cleanup.
 */

import {
  TestableIntegration,
  IntegrationCapability,
  ResourceType,
} from '@/lib/types/processMapTesting';

/**
 * HubSpot integration capabilities
 * Full CRUD support with view URLs for contacts, deals, and tasks
 */
export const HUBSPOT_CAPABILITY: IntegrationCapability = {
  integration: 'hubspot',
  displayName: 'HubSpot',
  supportsCreate: true,
  supportsRead: true,
  supportsUpdate: true,
  supportsDelete: true,
  resourceTypes: ['contact', 'deal', 'task', 'activity'],
  // Portal ID and region need to be substituted at runtime
  // Contact/Deal: /record/0-1/{id} or /record/0-3/{id}
  // Task: Uses /task/{id} format (different from other objects!)
  // Region: eu1 for EU, na1 for US (defaults to EU if not specified)
  viewUrlPattern: 'https://{subdomain}.hubspot.com/contacts/{portalId}/{objectPath}/{id}',
  deleteEndpoint: '/functions/v1/hubspot-delete-resource',
  notes: 'Full CRUD support. Contacts use /record/0-1/, Deals use /record/0-3/, Tasks use /task/',
};

/**
 * Fathom integration capabilities
 * Read-only - meeting recordings and transcripts cannot be deleted via API
 */
export const FATHOM_CAPABILITY: IntegrationCapability = {
  integration: 'fathom',
  displayName: 'Fathom',
  supportsCreate: false,
  supportsRead: true,
  supportsUpdate: false,
  supportsDelete: false,
  resourceTypes: ['meeting'],
  viewUrlPattern: 'https://app.fathom.video/calls/{id}',
  deleteEndpoint: null,
  notes: 'Read-only integration. Meetings are recorded externally and synced.',
};

/**
 * Google Calendar integration capabilities
 * Full CRUD support for calendar events
 */
export const GOOGLE_CALENDAR_CAPABILITY: IntegrationCapability = {
  integration: 'google_calendar',
  displayName: 'Google Calendar',
  supportsCreate: true,
  supportsRead: true,
  supportsUpdate: true,
  supportsDelete: true,
  resourceTypes: ['calendar_event'],
  // Calendar ID and event ID needed at runtime
  viewUrlPattern: 'https://calendar.google.com/calendar/event?eid={encodedId}',
  deleteEndpoint: '/functions/v1/google-calendar-delete-event',
  notes: 'Full CRUD support. Event IDs need base64 encoding for view URLs.',
};

/**
 * Google Email integration capabilities
 * Create (send) and read supported, but sent emails cannot be "unsent"
 */
export const GOOGLE_EMAIL_CAPABILITY: IntegrationCapability = {
  integration: 'google_email',
  displayName: 'Google Email',
  supportsCreate: true,
  supportsRead: true,
  supportsUpdate: false,
  supportsDelete: false,
  resourceTypes: ['email'],
  viewUrlPattern: 'https://mail.google.com/mail/u/0/#sent/{messageId}',
  deleteEndpoint: null,
  notes: 'Sent emails cannot be unsent. Cleanup will note that emails were sent.',
};

/**
 * Slack integration capabilities
 * Full CRUD support for messages
 */
export const SLACK_CAPABILITY: IntegrationCapability = {
  integration: 'slack',
  displayName: 'Slack',
  supportsCreate: true,
  supportsRead: true,
  supportsUpdate: true,
  supportsDelete: true,
  resourceTypes: ['message'],
  // Workspace and channel needed at runtime
  viewUrlPattern: 'https://{workspace}.slack.com/archives/{channel}/p{timestamp}',
  deleteEndpoint: '/functions/v1/slack-delete-message',
  notes: 'Full CRUD support. Messages can be deleted within the message deletion window.',
};

/**
 * JustCall integration capabilities
 * Read-only - call records are created by external calls
 */
export const JUSTCALL_CAPABILITY: IntegrationCapability = {
  integration: 'justcall',
  displayName: 'JustCall',
  supportsCreate: false,
  supportsRead: true,
  supportsUpdate: false,
  supportsDelete: false,
  resourceTypes: ['call'],
  viewUrlPattern: 'https://app.justcall.io/calls/{id}',
  deleteEndpoint: null,
  notes: 'Read-only integration. Calls are initiated externally.',
};

/**
 * SavvyCal integration capabilities
 * Full CRUD support for bookings
 */
export const SAVVYCAL_CAPABILITY: IntegrationCapability = {
  integration: 'savvycal',
  displayName: 'SavvyCal',
  supportsCreate: true,
  supportsRead: true,
  supportsUpdate: true,
  supportsDelete: true,
  resourceTypes: ['booking'],
  viewUrlPattern: 'https://savvycal.com/app/bookings/{id}',
  deleteEndpoint: '/functions/v1/savvycal-cancel-booking',
  notes: 'Full CRUD support. Bookings can be cancelled/deleted.',
};

/**
 * Supabase integration capabilities
 * Full CRUD support for database records
 */
export const SUPABASE_CAPABILITY: IntegrationCapability = {
  integration: 'supabase',
  displayName: 'Supabase (Database)',
  supportsCreate: true,
  supportsRead: true,
  supportsUpdate: true,
  supportsDelete: true,
  resourceTypes: ['contact', 'deal', 'task', 'activity', 'meeting', 'record'],
  viewUrlPattern: null, // Internal database, no external view
  deleteEndpoint: '/functions/v1/supabase-delete-record',
  notes: 'Internal database. All CRUD operations supported directly.',
};

/**
 * All integration capabilities indexed by integration type
 */
export const INTEGRATION_CAPABILITIES: Record<TestableIntegration, IntegrationCapability> = {
  hubspot: HUBSPOT_CAPABILITY,
  fathom: FATHOM_CAPABILITY,
  google_calendar: GOOGLE_CALENDAR_CAPABILITY,
  google_email: GOOGLE_EMAIL_CAPABILITY,
  slack: SLACK_CAPABILITY,
  justcall: JUSTCALL_CAPABILITY,
  savvycal: SAVVYCAL_CAPABILITY,
  supabase: SUPABASE_CAPABILITY,
};

/**
 * Get capability for an integration
 */
export function getIntegrationCapability(
  integration: TestableIntegration
): IntegrationCapability {
  return INTEGRATION_CAPABILITIES[integration];
}

/**
 * Check if an integration supports deletion (for cleanup)
 */
export function supportsCleanup(integration: TestableIntegration): boolean {
  return INTEGRATION_CAPABILITIES[integration].supportsDelete;
}

/**
 * Get integrations that support cleanup
 */
export function getCleanableIntegrations(): TestableIntegration[] {
  return Object.entries(INTEGRATION_CAPABILITIES)
    .filter(([, cap]) => cap.supportsDelete)
    .map(([integration]) => integration as TestableIntegration);
}

/**
 * Get integrations that are read-only
 */
export function getReadOnlyIntegrations(): TestableIntegration[] {
  return Object.entries(INTEGRATION_CAPABILITIES)
    .filter(([, cap]) => !cap.supportsDelete)
    .map(([integration]) => integration as TestableIntegration);
}

/**
 * Build a view URL for a resource
 * Returns null if the integration doesn't support view URLs
 */
export function buildViewUrl(
  integration: TestableIntegration,
  resourceType: ResourceType,
  externalId: string,
  context?: {
    portalId?: string;
    hubspotRegion?: 'eu1' | 'na1' | string;
    workspace?: string;
    channel?: string;
    timestamp?: string;
    calendarId?: string;
    encodedId?: string;
    messageId?: string;
  }
): string | null {
  const capability = INTEGRATION_CAPABILITIES[integration];

  if (!capability.viewUrlPattern) {
    return null;
  }

  let url = capability.viewUrlPattern;

  // Replace common placeholders
  url = url.replace('{id}', externalId);

  // HubSpot-specific replacements
  if (integration === 'hubspot') {
    if (!context?.portalId) {
      // Portal ID is required for HubSpot URLs
      return null;
    }

    // Determine the subdomain based on region (default to EU)
    // Regions: 'eu1' for EU, 'na1' for US, or just 'app' for default US
    const region = context.hubspotRegion || 'eu1';
    const subdomain = region === 'na1' ? 'app' : `app-${region}`;

    // IMPORTANT: Tasks use a completely different URL structure!
    // Tasks: https://app-eu1.hubspot.com/tasks/{portalId}/view/all/{taskId}
    // Other objects: https://app-eu1.hubspot.com/contacts/{portalId}/record/{objectType}/{id}
    if (resourceType === 'task') {
      return `https://${subdomain}.hubspot.com/tasks/${context.portalId}/view/all/${externalId}`;
    }

    // For non-task objects, use the standard /contacts/ URL pattern
    url = url.replace('{portalId}', context.portalId);
    url = url.replace('{subdomain}', subdomain);

    // Map resource type to HubSpot object path
    const objectPathMap: Partial<Record<ResourceType, string>> = {
      contact: 'record/0-1',
      deal: 'record/0-3',
      activity: 'record/0-4',
    };
    url = url.replace('{objectPath}', objectPathMap[resourceType] || 'record/0-1');
  }

  // Slack-specific replacements
  if (integration === 'slack') {
    if (context?.workspace) url = url.replace('{workspace}', context.workspace);
    if (context?.channel) url = url.replace('{channel}', context.channel);
    if (context?.timestamp) url = url.replace('{timestamp}', context.timestamp.replace('.', ''));
  }

  // Google Calendar-specific replacements
  if (integration === 'google_calendar' && context?.encodedId) {
    url = url.replace('{encodedId}', context.encodedId);
  }

  // Google Email-specific replacements
  if (integration === 'google_email' && context?.messageId) {
    url = url.replace('{messageId}', context.messageId);
  }

  return url;
}

/**
 * Get all supported resource types across all integrations
 */
export function getAllSupportedResourceTypes(): ResourceType[] {
  const types = new Set<ResourceType>();
  Object.values(INTEGRATION_CAPABILITIES).forEach(cap => {
    cap.resourceTypes.forEach(type => types.add(type));
  });
  return Array.from(types);
}

/**
 * Get integrations that support a specific resource type
 */
export function getIntegrationsForResourceType(
  resourceType: ResourceType
): TestableIntegration[] {
  return Object.entries(INTEGRATION_CAPABILITIES)
    .filter(([, cap]) => cap.resourceTypes.includes(resourceType))
    .map(([integration]) => integration as TestableIntegration);
}
