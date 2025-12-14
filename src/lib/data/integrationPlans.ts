/**
 * Integration Plans Data
 *
 * Contains detailed integration plans for platform integrations.
 *
 * Notes:
 * - The `/platform/integrations/roadmap` UI needs plans for *all* "coming soon" integrations
 *   listed on `/integrations`, not just a top-10.
 * - Some vendors require partner agreements / private APIs. For those, we keep docs/endpoints
 *   intentionally high-level or marked TBD to avoid guessing.
 * Used by the Integration Roadmap admin page.
 */

export type AuthType = 'oauth2' | 'api_key' | 'webhook_only' | 'partner_api';
export type Priority = 'critical' | 'high' | 'medium' | 'low';
export type ImpactScore = 'high' | 'medium' | 'low';
export type Complexity = 'low' | 'medium' | 'high';

export interface ApiEndpoint {
  endpoint: string;
  method: string;
  purpose: string;
}

export interface DataFlow {
  direction: 'inbound' | 'outbound' | 'bidirectional';
  sixtyEntity: string;
  externalEntity: string;
}

export interface IntegrationPlan {
  id: string;
  name: string;
  priority: Priority;
  priorityOrder: number; // 1..N (order in roadmap)
  category: string;
  logo?: string;

  // Use case
  useCase: string;
  useCaseDetails: string[];

  // API info
  authType: AuthType;
  apiDocsUrl?: string;
  baseUrl?: string;
  rateLimit?: string;
  scopes?: string[];
  webhookEvents?: string[];

  // API Assessment
  apiEndpoints: ApiEndpoint[];
  whatsPossible: string;
  limitations: string;

  // Data flows
  dataFlows: DataFlow[];

  // Effort & Impact
  estimatedDays: number;
  impactScore: ImpactScore;
  complexity: Complexity;
  popularity: number; // 1-5 stars
  revenueImpact: ImpactScore;
}

// -----------------------------------------------------------------------------
// Tier 0: detailed plans (keep these rich)
// -----------------------------------------------------------------------------
const detailedPlans: IntegrationPlan[] = [
  // =====================================================
  // TIER 1: CRITICAL PRIORITY
  // =====================================================
  {
    id: 'hubspot',
    name: 'HubSpot',
    priority: 'critical',
    priorityOrder: 1,
    category: 'CRM',
    logo: 'hubspot',
    useCase:
      'Bi-directional sync of contacts, deals, activities, tasks, quotes, and custom objects (with form-to-lead routing)',
    useCaseDetails: [
      'Sync contacts bidirectionally using email as primary key',
      'Map Sixty deal stages to HubSpot deal pipelines',
      'Push activities to HubSpot timeline events',
      'Two-way task sync with due dates and associations',
      'Route HubSpot form submissions into Sixty leads with source/UTM capture and smart follow-up task generation',
      'Push meeting summaries and action items into HubSpot as Notes (associated to the right contact/deal)',
      'Sync quotes + line items, and reflect quote status back into Sixty (e.g. sent/viewed/accepted)',
      'Support custom objects + custom properties mapping (admin-configurable field mapping)',
      'Write back “custom intelligence” fields into mapped HubSpot properties (ICP fit, intent signals, next steps, last meeting summary)',
    ],
    authType: 'oauth2',
    apiDocsUrl: 'https://developers.hubspot.com/docs/api',
    baseUrl: 'https://api.hubapi.com',
    rateLimit: '100 requests/10 seconds',
    scopes: [
      'forms',
      'crm.objects.deals.read',
      'crm.objects.deals.write',
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.companies.read',
      'crm.objects.companies.write',
      'crm.objects.notes.read',
      'crm.objects.notes.write',
      'crm.objects.tasks.read',
      'crm.objects.tasks.write',
      'crm.objects.quotes.read',
      'crm.objects.quotes.write',
      'crm.objects.line_items.read',
      'crm.objects.line_items.write',
      'crm.objects.custom.read',
      'crm.objects.custom.write',
      'crm.schemas.quotes.read',
      'crm.schemas.line_items.read',
      'crm.schemas.custom.read',
    ],
    webhookEvents: ['contact.created', 'contact.updated', 'deal.created', 'deal.updated'],
    apiEndpoints: [
      { endpoint: '/marketing/v3/forms', method: 'GET', purpose: 'List forms + metadata for form-to-lead routing' },
      { endpoint: '/crm/v3/objects/contacts', method: 'GET/POST/PATCH', purpose: 'Sync contacts bidirectionally' },
      { endpoint: '/crm/v3/objects/deals', method: 'GET/POST/PATCH', purpose: 'Sync deals with stage mapping' },
      { endpoint: '/crm/v3/objects/tasks', method: 'GET/POST/PATCH', purpose: 'Bi-directional task sync' },
      { endpoint: '/crm/v3/objects/notes', method: 'GET/POST/PATCH', purpose: 'Write meeting summaries as Notes associated to contacts/deals' },
      { endpoint: '/crm/v3/objects/quotes', method: 'GET/POST/PATCH', purpose: 'Sync quotes and reflect status updates' },
      { endpoint: '/crm/v3/objects/line_items', method: 'GET/POST/PATCH', purpose: 'Sync quote line items (pricing, quantity, discounts)' },
      { endpoint: '/crm/v3/objects/deals/batch/read', method: 'POST', purpose: 'Bulk deal retrieval for sync' },
      { endpoint: '/crm/v3/associations/{fromObjectType}/{toObjectType}', method: 'PUT', purpose: 'Link contacts to deals' },
      { endpoint: '/crm/v3/properties/{objectType}', method: 'GET', purpose: 'Fetch properties for field mapping + intelligence writeback' },
      { endpoint: '/crm/v3/schemas', method: 'GET', purpose: 'Discover custom object schemas (for custom mapping)' },
      {
        endpoint: '/crm/v3/objects/{customObjectType}',
        method: 'GET/POST/PATCH',
        purpose: 'Sync custom objects and write intelligence into custom properties',
      },
      { endpoint: '/webhooks/v3/subscriptions', method: 'POST', purpose: 'Real-time change notifications' },
    ],
    whatsPossible:
      'Full CRUD on CRM objects (contacts, companies, deals, tasks, notes, quotes, line items), associations, timeline events, batch operations, plus custom object + property mapping',
    limitations:
      '100 requests/10 seconds rate limit. Some functionality (custom object schemas) requires enterprise features and/or partner/pilot access. Form submission ingestion may require polling or routing via contact create/update, depending on the HubSpot account setup.',
    dataFlows: [
      { direction: 'bidirectional', sixtyEntity: 'Contacts', externalEntity: 'HubSpot Contacts' },
      { direction: 'bidirectional', sixtyEntity: 'Deals', externalEntity: 'HubSpot Deals' },
      { direction: 'outbound', sixtyEntity: 'Activities', externalEntity: 'HubSpot Timeline Events' },
      { direction: 'bidirectional', sixtyEntity: 'Tasks', externalEntity: 'HubSpot Tasks' },
      { direction: 'inbound', sixtyEntity: 'Leads', externalEntity: 'HubSpot Form Submissions' },
      { direction: 'outbound', sixtyEntity: 'Meeting Summaries', externalEntity: 'HubSpot Notes' },
      { direction: 'bidirectional', sixtyEntity: 'Quotes', externalEntity: 'HubSpot Quotes' },
      { direction: 'bidirectional', sixtyEntity: 'Custom Objects', externalEntity: 'HubSpot Custom Objects' },
    ],
    estimatedDays: 10,
    impactScore: 'high',
    complexity: 'medium',
    popularity: 5,
    revenueImpact: 'high',
  },
  {
    id: 'calendly',
    name: 'Calendly',
    priority: 'critical',
    priorityOrder: 2,
    category: 'Calendar',
    logo: 'calendly',
    useCase: 'Auto-create contacts when meetings booked, track lead sources',
    useCaseDetails: [
      'Create contacts automatically from booking data',
      'Create meeting activities when events are scheduled',
      'Track lead sources by booking link',
      'Handle cancellations and reschedules',
    ],
    authType: 'oauth2',
    apiDocsUrl: 'https://developer.calendly.com',
    rateLimit: 'Standard REST API limits',
    webhookEvents: ['invitee.created', 'invitee.canceled'],
    apiEndpoints: [
      { endpoint: '/scheduled_events', method: 'GET', purpose: 'List booked meetings' },
      { endpoint: '/scheduled_events/{uuid}/invitees', method: 'GET', purpose: 'Get attendee details' },
      { endpoint: '/webhook_subscriptions', method: 'POST', purpose: 'Subscribe to booking events' },
      { endpoint: 'Webhook: invitee.created', method: '-', purpose: 'Trigger contact creation' },
      { endpoint: 'Webhook: invitee.canceled', method: '-', purpose: 'Update meeting status' },
    ],
    whatsPossible: 'Read scheduled events, invitee details, event types, webhook notifications',
    limitations: 'Webhooks require paid plan; no write operations on events',
    dataFlows: [
      { direction: 'inbound', sixtyEntity: 'Contacts', externalEntity: 'Calendly Invitees' },
      { direction: 'inbound', sixtyEntity: 'Meeting Activities', externalEntity: 'Calendly Events' },
    ],
    estimatedDays: 3,
    impactScore: 'high',
    complexity: 'low',
    popularity: 5,
    revenueImpact: 'high',
  },
  {
    id: 'slack',
    name: 'Slack',
    priority: 'critical',
    priorityOrder: 3,
    category: 'Communication',
    logo: 'slack',
    useCase: 'Slack notifications for meetings, daily digests, and deal room channels (already implemented)',
    useCaseDetails: [
      'AI Meeting Debriefs: post AI summary + action items + coaching insights after transcripts sync',
      'Pre-Meeting Prep Cards: send prep context shortly before a meeting (DM or channel)',
      'Daily Standup Digest: scheduled team/user digest with meetings + tasks + AI insights',
      'Deal Room Channels: auto-create and update channels for deal collaboration (stage/activity/win-probability events)',
      'Channel picker UI + user mapping UI (email → Slack user) for @mentions and DMs',
    ],
    authType: 'oauth2',
    apiDocsUrl: 'https://api.slack.com/methods',
    rateLimit: 'Rate limited (chat.postMessage + conversations.*); we handle retries/backoff in functions',
    scopes: [
      'chat:write',
      'chat:write.public',
      'channels:read',
      'channels:join',
      'channels:manage',
      'groups:read',
      'groups:write',
      'im:write',
      'users:read',
      'users:read.email',
    ],
    apiEndpoints: [
      { endpoint: 'oauth.v2.access', method: 'POST', purpose: 'OAuth exchange (Edge Function callback)' },
      { endpoint: 'chat.postMessage', method: 'POST', purpose: 'Post debrief/digest/prep/deal-room updates' },
      { endpoint: 'conversations.list', method: 'GET', purpose: 'Populate channel selector' },
      { endpoint: 'conversations.join', method: 'POST', purpose: 'Join channels automatically when needed' },
      { endpoint: 'users.list', method: 'GET', purpose: 'Create Slack user mappings for mentions/DM routing' },
    ],
    whatsPossible:
      'Rich Block Kit notifications, per-org configuration, channel + DM delivery, automated deal-room channels, and user mapping for mentions.',
    limitations:
      'External customer rollout requires Slack app distribution + production env configuration (OAuth redirect URLs, approved scopes). Private channels also require explicit bot access (invite).',
    dataFlows: [
      { direction: 'outbound', sixtyEntity: 'Meeting Intelligence', externalEntity: 'Slack Debrief Messages' },
      { direction: 'outbound', sixtyEntity: 'Upcoming Meetings', externalEntity: 'Slack Prep Messages' },
      { direction: 'outbound', sixtyEntity: 'Tasks + Meetings', externalEntity: 'Slack Daily Digest' },
      { direction: 'outbound', sixtyEntity: 'Deals + Activities', externalEntity: 'Deal Room Channel Messages' },
    ],
    estimatedDays: 1,
    impactScore: 'high',
    complexity: 'low',
    popularity: 5,
    revenueImpact: 'high',
  },
  {
    id: 'zapier',
    name: 'Zapier',
    priority: 'critical',
    priorityOrder: 4,
    category: 'Automation',
    logo: 'zapier',
    useCase: 'Connect to 5000+ apps without individual integrations',
    useCaseDetails: [
      'Expose Sixty as trigger source for deal/contact events',
      'Accept actions from other apps to create deals/contacts',
      'Enable custom automation workflows',
      'Universal connector for any app in Zapier ecosystem',
    ],
    authType: 'api_key',
    apiDocsUrl: 'https://platform.zapier.com',
    apiEndpoints: [
      { endpoint: 'Trigger: new_deal', method: 'Webhook', purpose: 'Notify when deal created' },
      { endpoint: 'Trigger: deal_stage_changed', method: 'Webhook', purpose: 'Notify on stage transitions' },
      { endpoint: 'Trigger: new_contact', method: 'Webhook', purpose: 'Notify on contact creation' },
      { endpoint: 'Trigger: new_activity', method: 'Webhook', purpose: 'Notify on activity logged' },
      { endpoint: 'Action: create_deal', method: 'REST', purpose: 'Create deal from external app' },
      { endpoint: 'Action: create_contact', method: 'REST', purpose: 'Create contact from external app' },
      { endpoint: 'Action: log_activity', method: 'REST', purpose: 'Log activity from external app' },
    ],
    whatsPossible: 'Expose Sixty as both trigger source and action target; instant webhooks',
    limitations: 'Requires Zapier Partner Program approval; ongoing maintenance',
    dataFlows: [
      { direction: 'outbound', sixtyEntity: 'Deal Events', externalEntity: 'Zapier Triggers' },
      { direction: 'outbound', sixtyEntity: 'Contact Events', externalEntity: 'Zapier Triggers' },
      { direction: 'inbound', sixtyEntity: 'Deals', externalEntity: 'Zapier Actions' },
      { direction: 'inbound', sixtyEntity: 'Contacts', externalEntity: 'Zapier Actions' },
    ],
    estimatedDays: 8,
    impactScore: 'high',
    complexity: 'medium',
    popularity: 5,
    revenueImpact: 'high',
  },

  // =====================================================
  // TIER 2: HIGH PRIORITY
  // =====================================================
  {
    id: 'zoom',
    name: 'Zoom',
    priority: 'high',
    priorityOrder: 5,
    category: 'Video',
    logo: 'zoom',
    useCase: 'Auto-log meeting activities, link recordings to contacts',
    useCaseDetails: [
      'Create meeting activities when meetings end',
      'Link recording URLs to contacts and deals',
      'Match attendees to contacts by email',
      'Track meeting duration for activity logging',
    ],
    authType: 'oauth2',
    apiDocsUrl: 'https://developers.zoom.us/docs/api',
    rateLimit: '10 requests/second',
    scopes: ['meeting:read', 'recording:read', 'user:read'],
    webhookEvents: ['meeting.started', 'meeting.ended', 'recording.completed'],
    apiEndpoints: [
      { endpoint: '/meetings/{meetingId}', method: 'GET', purpose: 'Get meeting details' },
      { endpoint: '/meetings/{meetingId}/recordings', method: 'GET', purpose: 'Get recording URLs' },
      { endpoint: '/past_meetings/{meetingUUID}/participants', method: 'GET', purpose: 'Get attendee list' },
      { endpoint: '/users/{userId}/meetings', method: 'GET', purpose: "List user's meetings" },
      { endpoint: 'Webhook: meeting.ended', method: '-', purpose: 'Trigger activity creation' },
      { endpoint: 'Webhook: recording.completed', method: '-', purpose: 'Link recording to contact' },
    ],
    whatsPossible: 'Read meetings, participants, recordings; real-time webhooks',
    limitations: '10 req/sec; Server-to-Server OAuth required (JWT deprecated)',
    dataFlows: [
      { direction: 'inbound', sixtyEntity: 'Meeting Activities', externalEntity: 'Zoom Meetings' },
      { direction: 'inbound', sixtyEntity: 'Recording Links', externalEntity: 'Zoom Recordings' },
    ],
    estimatedDays: 6,
    impactScore: 'medium',
    complexity: 'medium',
    popularity: 5,
    revenueImpact: 'medium',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    priority: 'high',
    priorityOrder: 6,
    category: 'Payments',
    logo: 'stripe',
    useCase: 'Auto-update deals when invoices paid, accurate revenue tracking',
    useCaseDetails: [
      'Update deal to "Signed" when invoice is paid',
      'Create recurring deals with MRR from subscriptions',
      'Alert sales owner when payment fails',
      'Match Stripe customers to contacts by email',
    ],
    authType: 'api_key',
    apiDocsUrl: 'https://docs.stripe.com/api',
    rateLimit: '100 requests/second in live mode',
    webhookEvents: ['invoice.paid', 'charge.succeeded', 'customer.subscription.created', 'payment_intent.succeeded'],
    apiEndpoints: [
      { endpoint: '/v1/invoices/{id}', method: 'GET', purpose: 'Get invoice details' },
      { endpoint: '/v1/customers/{id}', method: 'GET', purpose: 'Get customer for matching' },
      { endpoint: '/v1/subscriptions/{id}', method: 'GET', purpose: 'Get subscription for MRR' },
      { endpoint: 'Webhook: invoice.paid', method: '-', purpose: 'Update deal to "Signed"' },
      { endpoint: 'Webhook: customer.subscription.created', method: '-', purpose: 'Create recurring deal' },
      { endpoint: 'Webhook: payment_intent.succeeded', method: '-', purpose: 'Confirm payment received' },
    ],
    whatsPossible: 'Read invoices, subscriptions, customers; webhook notifications',
    limitations: 'Need to match Stripe customer to Sixty contact by email',
    dataFlows: [
      { direction: 'inbound', sixtyEntity: 'Deal Stage Updates', externalEntity: 'Stripe Invoice Events' },
      { direction: 'inbound', sixtyEntity: 'MRR Data', externalEntity: 'Stripe Subscriptions' },
    ],
    estimatedDays: 5,
    impactScore: 'high',
    complexity: 'medium',
    popularity: 4,
    revenueImpact: 'high',
  },
  {
    id: 'docusign',
    name: 'DocuSign',
    priority: 'high',
    priorityOrder: 7,
    category: 'E-Signature',
    logo: 'docusign',
    useCase: 'Auto-move deals to "Signed" when contracts executed',
    useCaseDetails: [
      'Move deal to "Signed" when envelope is completed',
      'Create "Proposal Sent" activity when envelope sent',
      'Log document view activity on timeline',
      'Match signers to contacts by email',
    ],
    authType: 'oauth2',
    apiDocsUrl: 'https://developers.docusign.com',
    scopes: ['signature', 'extended'],
    webhookEvents: ['envelope-sent', 'envelope-completed', 'recipient-signed'],
    apiEndpoints: [
      { endpoint: '/envelopes/{envelopeId}', method: 'GET', purpose: 'Get envelope status' },
      { endpoint: '/envelopes/{envelopeId}/recipients', method: 'GET', purpose: 'Get signer details' },
      { endpoint: 'Connect Webhook: envelope-sent', method: '-', purpose: 'Create "Proposal Sent" activity' },
      { endpoint: 'Connect Webhook: envelope-completed', method: '-', purpose: 'Move deal to "Signed"' },
      { endpoint: 'Connect Webhook: recipient-signed', method: '-', purpose: 'Log signing activity' },
    ],
    whatsPossible: 'Read envelopes, recipients, documents; Connect webhooks for all status changes',
    limitations: 'Requires DocuSign Connect (webhooks) setup; JWT auth recommended',
    dataFlows: [
      { direction: 'inbound', sixtyEntity: 'Deal Stage Updates', externalEntity: 'DocuSign Envelope Events' },
      { direction: 'inbound', sixtyEntity: 'Proposal Activities', externalEntity: 'DocuSign Send Events' },
    ],
    estimatedDays: 6,
    impactScore: 'high',
    complexity: 'medium',
    popularity: 4,
    revenueImpact: 'high',
  },
  {
    id: 'apollo',
    name: 'Apollo.io',
    priority: 'high',
    priorityOrder: 8,
    category: 'Outreach',
    logo: 'apollo',
    useCase: 'Enrich contacts, sync email sequences, import prospects',
    useCaseDetails: [
      'Enrich contacts with phone, title, company data',
      'Log email sequence activities on contact timeline',
      'Import prospects with enriched data',
      'Track email opens/clicks as engagement signals',
    ],
    authType: 'api_key',
    apiDocsUrl: 'https://docs.apollo.io/reference',
    rateLimit: '10 records per enrichment request',
    apiEndpoints: [
      { endpoint: '/people/match', method: 'POST', purpose: 'Enrich single contact' },
      { endpoint: '/people/bulk_match', method: 'POST', purpose: 'Bulk enrich contacts (up to 10)' },
      { endpoint: '/contacts/search', method: 'POST', purpose: 'Search Apollo database' },
      { endpoint: '/emailer/campaigns/{id}/contacts', method: 'GET', purpose: 'Get sequence contacts' },
      { endpoint: '/activities', method: 'GET', purpose: 'Get email/call activities' },
    ],
    whatsPossible: 'Contact enrichment (phone, title, company, social), prospect search, activity sync',
    limitations: '10 records per enrichment request; potential high bounce rates on data',
    dataFlows: [
      { direction: 'inbound', sixtyEntity: 'Contact Enrichment', externalEntity: 'Apollo Person Data' },
      { direction: 'inbound', sixtyEntity: 'Outbound Activities', externalEntity: 'Apollo Sequence Activities' },
    ],
    estimatedDays: 5,
    impactScore: 'medium',
    complexity: 'medium',
    popularity: 4,
    revenueImpact: 'medium',
  },
  {
    id: 'justcall',
    name: 'JustCall',
    priority: 'medium',
    priorityOrder: 14,
    category: 'Dialer',
    logo: 'justcall',
    useCase: 'Org-wide call sync: recordings + transcripts + activity logging + AI Conversation Intelligence',
    useCaseDetails: [
      'Backfill and incremental sync of calls (org-wide visibility)',
      'Fetch JustCall IQ transcripts with retry/backoff',
      'Log call activity into Sixty communication tracking (`call_made` / `call_received`)',
      'Webhook ingestion with dynamic signature verification + replay protection',
      'Secure audio streaming via proxy with HTTP Range support',
      'Index call transcripts into the same org File Search store as meetings (AI search)',
    ],
    authType: 'api_key',
    apiDocsUrl: 'https://developer.justcall.io/docs',
    baseUrl: 'https://api.justcall.io',
    rateLimit: 'Varies by endpoint/account (see JustCall docs)',
    scopes: ['API Key + API Secret (JustCall → APIs and Webhooks)'],
    webhookEvents: [
      'call.completed (recommended)',
      'call.updated / recording events (as configured in JustCall)',
    ],
    apiEndpoints: [
      { endpoint: '/v2.1/calls', method: 'GET', purpose: 'List calls for backfill + incremental sync (pagination supported)' },
      { endpoint: '/v2.1/calls/{id}', method: 'GET', purpose: 'Fetch call details (recording URL, metadata) when needed' },
      { endpoint: '/v1/justcalliq/transcription', method: 'POST', purpose: 'Fetch call transcript (id + platform=1)' },
      { endpoint: 'Webhook headers', method: '-', purpose: 'Dynamic signature verification using x-justcall-signature + x-justcall-request-timestamp + payload.webhook_url + payload.type' },
      { endpoint: '/api/webhooks/justcall?token=<webhook_token>', method: 'POST', purpose: 'Sixty branded webhook endpoint (proxies to Supabase Edge Function)' },
    ],
    whatsPossible:
      'Team-wide call library (recordings + transcripts), reliable ingestion (webhook + backfill), conversation-level search across calls + meetings, and activity logging for engagement analytics.',
    limitations:
      'Transcripts can lag behind call completion; not all calls have recordings; recording URLs may require authenticated proxying.',
    dataFlows: [
      { direction: 'inbound', sixtyEntity: 'Calls', externalEntity: 'JustCall Calls' },
      { direction: 'inbound', sixtyEntity: 'Call Transcripts', externalEntity: 'JustCall IQ Transcription' },
      { direction: 'inbound', sixtyEntity: 'Communication Events', externalEntity: 'JustCall Call Activity' },
      { direction: 'inbound', sixtyEntity: 'Conversation Intelligence Index', externalEntity: 'JustCall Call Transcripts' },
    ],
    estimatedDays: 5,
    impactScore: 'medium',
    complexity: 'medium',
    popularity: 3,
    revenueImpact: 'medium',
  },
  {
    id: 'linkedin-sales-navigator',
    name: 'LinkedIn Sales Navigator',
    priority: 'high',
    priorityOrder: 9,
    category: 'Intelligence',
    logo: 'linkedin-sales-navigator',
    useCase: 'Sync saved leads, track InMails, enrich contact data',
    useCaseDetails: [
      'Import saved leads as contacts',
      'Log InMail activity on contact timeline',
      'Sync notes from Sales Navigator',
      'Store LinkedIn profile URLs on contacts',
    ],
    authType: 'partner_api',
    apiDocsUrl: 'https://business.linkedin.com/sales-solutions',
    rateLimit: '12-hour sync intervals',
    apiEndpoints: [
      { endpoint: 'CRM Sync: Account Import', method: 'Inbound', purpose: 'Import saved accounts' },
      { endpoint: 'CRM Sync: Lead Import', method: 'Inbound', purpose: 'Import saved leads to contacts' },
      { endpoint: 'Activity Writeback', method: 'Outbound', purpose: 'Log InMails as activities' },
      { endpoint: 'Contact Creation', method: 'Outbound', purpose: 'Push new contacts to Sales Nav' },
      { endpoint: 'CRM Badges', method: 'UI', purpose: 'Show CRM status in Sales Nav' },
    ],
    whatsPossible: 'Bi-directional lead sync, activity writeback, embedded profiles',
    limitations: 'Requires Advanced Plus license AND partner agreement; 12-hour sync intervals',
    dataFlows: [
      { direction: 'inbound', sixtyEntity: 'Contacts', externalEntity: 'Sales Navigator Leads' },
      { direction: 'outbound', sixtyEntity: 'InMail Activities', externalEntity: 'Activity Writeback' },
    ],
    estimatedDays: 15,
    impactScore: 'medium',
    complexity: 'high',
    popularity: 4,
    revenueImpact: 'medium',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    priority: 'high',
    priorityOrder: 10,
    category: 'CRM',
    logo: 'salesforce',
    useCase: 'Bi-directional sync for enterprise teams using Salesforce',
    useCaseDetails: [
      'Sync contacts with Salesforce Contacts/Leads',
      'Map Sixty deals to Salesforce Opportunities',
      'Push activities to Salesforce Tasks/Events',
      'Support custom object field mapping',
    ],
    authType: 'oauth2',
    apiDocsUrl: 'https://developer.salesforce.com',
    rateLimit: 'Varies by edition, typically 100K calls/day',
    scopes: ['api', 'refresh_token', 'offline_access'],
    apiEndpoints: [
      { endpoint: '/sobjects/Contact', method: 'GET/POST/PATCH', purpose: 'Sync contacts' },
      { endpoint: '/sobjects/Opportunity', method: 'GET/POST/PATCH', purpose: 'Sync deals' },
      { endpoint: '/sobjects/Task', method: 'GET/POST/PATCH', purpose: 'Sync tasks' },
      { endpoint: '/sobjects/Event', method: 'GET/POST/PATCH', purpose: 'Sync activities' },
      { endpoint: '/composite/batch', method: 'POST', purpose: 'Batch operations' },
      { endpoint: 'Platform Events', method: 'Webhook', purpose: 'Real-time notifications' },
    ],
    whatsPossible: 'Full CRUD on all standard/custom objects, batch operations, real-time events',
    limitations: 'Complex OAuth; rate limits vary by edition; field mapping complexity',
    dataFlows: [
      { direction: 'bidirectional', sixtyEntity: 'Contacts', externalEntity: 'Salesforce Contacts/Leads' },
      { direction: 'bidirectional', sixtyEntity: 'Deals', externalEntity: 'Salesforce Opportunities' },
      { direction: 'outbound', sixtyEntity: 'Activities', externalEntity: 'Salesforce Tasks/Events' },
    ],
    estimatedDays: 15,
    impactScore: 'high',
    complexity: 'high',
    popularity: 4,
    revenueImpact: 'high',
  },
];

// -----------------------------------------------------------------------------
// Tier 1+: generated plan skeletons for all other "coming soon" integrations.
// -----------------------------------------------------------------------------

type IntegrationSeed = {
  id: string;
  name: string;
  category: string;
  priority: Priority;
  authType: AuthType;
  // Optional: include a docs link when we are confident it's correct.
  apiDocsUrl?: string;
  // Optional: some vendors have known API base URLs.
  baseUrl?: string;
  // Optional: some vendors have known headline limits/scopes/events.
  rateLimit?: string;
  scopes?: string[];
  webhookEvents?: string[];
  complexity?: Complexity;
  impactScore?: ImpactScore;
  revenueImpact?: ImpactScore;
  popularity?: number;
};

type TemplateKey =
  | 'crm'
  | 'meeting_recorder'
  | 'video_conferencing'
  | 'calendar_booking'
  | 'dialer'
  | 'task_management'
  | 'automation'
  | 'communication'
  | 'email_outreach'
  | 'sales_intelligence'
  | 'esignature'
  | 'payments'
  | 'ai_productivity';

function templateKeyForCategory(category: string): TemplateKey {
  const c = category.toLowerCase();
  if (c.includes('crm')) return 'crm';
  if (c.includes('meeting recorder') || c.includes('meeting') || c.includes('recorder')) return 'meeting_recorder';
  if (c.includes('video')) return 'video_conferencing';
  if (c.includes('calendar') || c.includes('booking')) return 'calendar_booking';
  if (c.includes('dialer') || c.includes('phone')) return 'dialer';
  if (c.includes('task')) return 'task_management';
  if (c.includes('automation') || c.includes('no-code')) return 'automation';
  if (c.includes('communication') || c.includes('chat')) return 'communication';
  if (c.includes('outreach') || c.includes('email')) return 'email_outreach';
  if (c.includes('intelligence') || c.includes('enrich')) return 'sales_intelligence';
  if (c.includes('e-sign') || c.includes('signature') || c.includes('document')) return 'esignature';
  if (c.includes('payment') || c.includes('billing') || c.includes('accounting')) return 'payments';
  if (c.includes('ai')) return 'ai_productivity';
  return 'automation';
}

const templateDefaults: Record<
  TemplateKey,
  Pick<
    IntegrationPlan,
    | 'useCase'
    | 'useCaseDetails'
    | 'apiEndpoints'
    | 'whatsPossible'
    | 'limitations'
    | 'dataFlows'
    | 'estimatedDays'
    | 'impactScore'
    | 'complexity'
    | 'popularity'
    | 'revenueImpact'
  >
> = {
  crm: {
    useCase: 'Bi-directional sync of contacts, companies, deals, and activities',
    useCaseDetails: [
      'Sync contacts bidirectionally using email as stable identifier where possible',
      'Map Sixty deal stages to the external pipeline model',
      'Write activities to the external timeline / tasks / notes',
      'Support field mapping and conflict resolution for enterprise orgs',
    ],
    apiEndpoints: [
      { endpoint: 'GET/POST/PATCH Contacts (TBD)', method: 'REST', purpose: 'Create/update contacts and keep them in sync' },
      { endpoint: 'GET/POST/PATCH Deals (TBD)', method: 'REST', purpose: 'Sync deal stages and key financial fields' },
      { endpoint: 'Webhook / Change Events (TBD)', method: '-', purpose: 'Detect external updates in near real-time' },
    ],
    whatsPossible: 'Full CRUD on standard CRM objects; associations; timeline events; batch operations (vendor dependent)',
    limitations:
      'Every CRM has different pipeline models and field constraints; we’ll require a mapping layer and safe conflict resolution to prevent data clobbering.',
    dataFlows: [
      { direction: 'bidirectional', sixtyEntity: 'Contacts', externalEntity: 'Contacts / Leads' },
      { direction: 'bidirectional', sixtyEntity: 'Deals', externalEntity: 'Deals / Opportunities' },
      { direction: 'outbound', sixtyEntity: 'Activities', externalEntity: 'Timeline / Notes / Tasks' },
    ],
    estimatedDays: 12,
    impactScore: 'medium',
    complexity: 'high',
    popularity: 4,
    revenueImpact: 'high',
  },
  meeting_recorder: {
    useCase: 'Import transcripts, summaries, and action items into Meeting Intelligence',
    useCaseDetails: [
      'Ingest meeting transcripts and key takeaways',
      'Link meetings to contacts and deals using attendee emails',
      'Extract action items and create follow-up tasks automatically',
      'Index meetings for semantic search within the org',
    ],
    apiEndpoints: [
      { endpoint: 'GET Recordings / Meetings (TBD)', method: 'REST', purpose: 'List meetings and retrieve metadata' },
      { endpoint: 'GET Transcript / Notes (TBD)', method: 'REST', purpose: 'Fetch transcript and summaries' },
      { endpoint: 'Webhook: meeting.completed (TBD)', method: '-', purpose: 'Trigger near-real-time ingestion' },
    ],
    whatsPossible: 'Transcript ingestion, speaker attribution, highlights, and AI summaries (vendor dependent)',
    limitations:
      'Vendors vary widely in export formats, speaker metadata, and webhook reliability; we’ll build a resilient ingestion + mapping pipeline.',
    dataFlows: [
      { direction: 'inbound', sixtyEntity: 'Meetings', externalEntity: 'Meetings / Recordings' },
      { direction: 'inbound', sixtyEntity: 'Transcripts', externalEntity: 'Transcript / Notes' },
      { direction: 'inbound', sixtyEntity: 'Tasks', externalEntity: 'Action Items' },
    ],
    estimatedDays: 6,
    impactScore: 'medium',
    complexity: 'medium',
    popularity: 4,
    revenueImpact: 'medium',
  },
  video_conferencing: {
    useCase: 'Auto-log meetings and attach recordings to contact timelines',
    useCaseDetails: [
      'Create meeting activities when meetings end',
      'Link recording URLs to contacts and deals',
      'Match attendees to contacts by email',
      'Track duration/outcome for reporting and coaching',
    ],
    apiEndpoints: [
      { endpoint: 'GET Meeting Details (TBD)', method: 'REST', purpose: 'Fetch metadata and attendees' },
      { endpoint: 'GET Recordings (TBD)', method: 'REST', purpose: 'Attach recording links when available' },
      { endpoint: 'Webhook: meeting.ended (TBD)', method: '-', purpose: 'Trigger activity creation' },
    ],
    whatsPossible: 'Meeting metadata, participant lists, recordings, and webhook events',
    limitations: 'Recording availability and scopes differ by plan; some platforms require admin consent and tenant-wide configuration.',
    dataFlows: [
      { direction: 'inbound', sixtyEntity: 'Meeting Activities', externalEntity: 'Meetings' },
      { direction: 'inbound', sixtyEntity: 'Recording Links', externalEntity: 'Recordings' },
    ],
    estimatedDays: 6,
    impactScore: 'medium',
    complexity: 'medium',
    popularity: 4,
    revenueImpact: 'medium',
  },
  calendar_booking: {
    useCase: 'Create contacts from bookings and track lead sources from booking links',
    useCaseDetails: [
      'Create or update contacts from booking invitee details',
      'Create meeting activities and optionally calendar events',
      'Track lead sources by booking page/event type',
      'Handle cancellations/reschedules cleanly',
    ],
    apiEndpoints: [
      { endpoint: 'Webhook: booking.created (TBD)', method: '-', purpose: 'Create contact + meeting activity' },
      { endpoint: 'Webhook: booking.canceled (TBD)', method: '-', purpose: 'Update meeting status' },
      { endpoint: 'GET Booking Details (TBD)', method: 'REST', purpose: 'Backfill missing invitee metadata' },
    ],
    whatsPossible: 'High-signal lead capture from booking intent; reliable meeting outcome triggers',
    limitations: 'Some providers require paid tiers for webhooks; reschedule semantics differ across vendors.',
    dataFlows: [
      { direction: 'inbound', sixtyEntity: 'Contacts', externalEntity: 'Invitees / Attendees' },
      { direction: 'inbound', sixtyEntity: 'Meeting Activities', externalEntity: 'Bookings / Events' },
    ],
    estimatedDays: 4,
    impactScore: 'medium',
    complexity: 'medium',
    popularity: 4,
    revenueImpact: 'high',
  },
  dialer: {
    useCase: 'Log calls automatically and enable click-to-call from contact pages',
    useCaseDetails: [
      'Log outbound/inbound call activities with duration and outcome',
      'Attach call recordings when available',
      'Map phone numbers to contacts for automatic linking',
      'Enable click-to-call or deep-links to dialer UI',
    ],
    apiEndpoints: [
      { endpoint: 'Webhook: call.completed (TBD)', method: '-', purpose: 'Create call activity in Sixty' },
      { endpoint: 'GET Call Details (TBD)', method: 'REST', purpose: 'Backfill recordings/metadata' },
      { endpoint: 'GET Users/Agents (TBD)', method: 'REST', purpose: 'Map dialer users to Sixty owners' },
    ],
    whatsPossible: 'Call activity logging, recording links, dispositions/outcomes, coaching metrics (vendor dependent)',
    limitations: 'Call recordings and webhook payloads vary; phone-number normalization is critical to avoid mismatches.',
    dataFlows: [
      { direction: 'inbound', sixtyEntity: 'Call Activities', externalEntity: 'Calls' },
      { direction: 'inbound', sixtyEntity: 'Recording Links', externalEntity: 'Call Recordings' },
    ],
    estimatedDays: 7,
    impactScore: 'medium',
    complexity: 'medium',
    popularity: 4,
    revenueImpact: 'medium',
  },
  task_management: {
    useCase: 'Two-way task sync so follow-ups stay consistent across tools',
    useCaseDetails: [
      'Create tasks in external tools from Sixty workflows',
      'Update task completion status back into Sixty',
      'Sync due dates, priorities, and assignments (where supported)',
      'Link tasks to contacts/deals via deep links and metadata',
    ],
    apiEndpoints: [
      { endpoint: 'GET/POST Tasks (TBD)', method: 'REST', purpose: 'Create and sync tasks' },
      { endpoint: 'Webhook: task.updated (TBD)', method: '-', purpose: 'Keep status/due dates in sync' },
      { endpoint: 'GET Users / Assignees (TBD)', method: 'REST', purpose: 'Map external users to Sixty users' },
    ],
    whatsPossible: 'Bidirectional task sync, project/board associations, tags/labels (vendor dependent)',
    limitations: 'User mapping and permissions differ across tools; we’ll start with a minimal, reliable subset.',
    dataFlows: [
      { direction: 'bidirectional', sixtyEntity: 'Tasks', externalEntity: 'Tasks' },
      { direction: 'outbound', sixtyEntity: 'Follow-up Rules', externalEntity: 'Task Creation' },
    ],
    estimatedDays: 8,
    impactScore: 'medium',
    complexity: 'medium',
    popularity: 4,
    revenueImpact: 'medium',
  },
  automation: {
    useCase: 'Trigger workflows when deals change stages or activities are logged',
    useCaseDetails: [
      'Expose Sixty events (deal, contact, activity, meeting) as triggers',
      'Accept inbound actions to create/update records',
      'Allow customers to build automations without custom engineering',
      'Provide secure signing/verification for webhooks',
    ],
    apiEndpoints: [
      { endpoint: 'Outbound Webhook: deal.stage_changed', method: 'POST', purpose: 'Notify automation platform' },
      { endpoint: 'Outbound Webhook: contact.created', method: 'POST', purpose: 'Notify automation platform' },
      { endpoint: 'Inbound Action: create/update (TBD)', method: 'REST', purpose: 'Accept writes from automation platform' },
    ],
    whatsPossible: 'Universal integration surface area across thousands of apps',
    limitations: 'Partner onboarding may be required; we’ll start with our own webhooks + stable REST actions.',
    dataFlows: [
      { direction: 'outbound', sixtyEntity: 'Events', externalEntity: 'Automation Triggers' },
      { direction: 'inbound', sixtyEntity: 'Creates/Updates', externalEntity: 'Automation Actions' },
    ],
    estimatedDays: 6,
    impactScore: 'high',
    complexity: 'medium',
    popularity: 4,
    revenueImpact: 'high',
  },
  communication: {
    useCase: 'Send deal alerts and activity notifications into team channels',
    useCaseDetails: [
      'Notify on stage changes, wins/losses, and at-risk deals',
      'Post daily/weekly summaries to selected channels',
      'Allow per-org configuration of channels and message templates',
      'Support user mentions by mapping email to user IDs',
    ],
    apiEndpoints: [
      { endpoint: 'POST message (TBD)', method: 'REST', purpose: 'Send notifications' },
      { endpoint: 'GET channels (TBD)', method: 'REST', purpose: 'Let admins pick channels' },
      { endpoint: 'GET users (TBD)', method: 'REST', purpose: 'Map users for mentions' },
    ],
    whatsPossible: 'Rich messaging, interactive actions, threaded discussions (platform dependent)',
    limitations: 'Rate limits and admin approval are common; we’ll ship safe defaults and backoff handling.',
    dataFlows: [{ direction: 'outbound', sixtyEntity: 'Notifications', externalEntity: 'Channel Messages' }],
    estimatedDays: 5,
    impactScore: 'medium',
    complexity: 'low',
    popularity: 4,
    revenueImpact: 'medium',
  },
  email_outreach: {
    useCase: 'Sync outreach activity to contact timelines and track engagement signals',
    useCaseDetails: [
      'Log sequence sends/replies as outbound activities',
      'Track opens/clicks (where supported) as engagement signals on deals',
      'Associate sequence membership with contacts',
      'Use engagement to prioritize follow-up tasks',
    ],
    apiEndpoints: [
      { endpoint: 'GET Sequences/Campaigns (TBD)', method: 'REST', purpose: 'Discover campaigns and membership' },
      { endpoint: 'GET Activities/Events (TBD)', method: 'REST', purpose: 'Import email events' },
      { endpoint: 'Webhook: email.event (TBD)', method: '-', purpose: 'Near-real-time engagement ingestion' },
    ],
    whatsPossible: 'Engagement-driven prioritization and reporting',
    limitations: 'Vendors vary in event granularity and privacy controls; we’ll focus on high-signal events first.',
    dataFlows: [
      { direction: 'inbound', sixtyEntity: 'Outbound Activities', externalEntity: 'Email Events' },
      { direction: 'inbound', sixtyEntity: 'Engagement Signals', externalEntity: 'Opens/Clicks/Replies' },
    ],
    estimatedDays: 7,
    impactScore: 'medium',
    complexity: 'medium',
    popularity: 4,
    revenueImpact: 'medium',
  },
  sales_intelligence: {
    useCase: 'Enrich leads and keep contact/company data accurate over time',
    useCaseDetails: [
      'Enrich contacts with title, phone, LinkedIn URL, and company data',
      'Fill missing fields during import and on-demand',
      'Deduplicate by email/domain and keep profiles up to date',
      'Support bulk enrichment with rate-limit awareness',
    ],
    apiEndpoints: [
      { endpoint: 'POST Enrich Person (TBD)', method: 'REST', purpose: 'Enrich a single contact' },
      { endpoint: 'POST Enrich Company (TBD)', method: 'REST', purpose: 'Enrich a company by domain' },
      { endpoint: 'POST Bulk Enrich (TBD)', method: 'REST', purpose: 'Batch enrich imports' },
    ],
    whatsPossible: 'Higher conversion via better segmentation and personalization',
    limitations: 'Data quality varies; we’ll treat enrichment as assistive, never overwriting trusted user-entered fields by default.',
    dataFlows: [{ direction: 'inbound', sixtyEntity: 'Contact/Company Fields', externalEntity: 'Enrichment Data' }],
    estimatedDays: 6,
    impactScore: 'medium',
    complexity: 'medium',
    popularity: 4,
    revenueImpact: 'medium',
  },
  esignature: {
    useCase: 'Move deals to Signed automatically when contracts are executed',
    useCaseDetails: [
      'Create “Proposal Sent” activities when documents are sent',
      'Update deal stage on signature completion',
      'Log signer events on the timeline',
      'Match signers to contacts by email',
    ],
    apiEndpoints: [
      { endpoint: 'Webhook: document.sent (TBD)', method: '-', purpose: 'Create proposal activity' },
      { endpoint: 'Webhook: document.completed (TBD)', method: '-', purpose: 'Move deal to Signed' },
      { endpoint: 'GET Document Status (TBD)', method: 'REST', purpose: 'Backfill state and signers' },
    ],
    whatsPossible: 'Reliable close signals and contract event history',
    limitations: 'Webhook configuration and signature workflows differ by vendor; we’ll ship a robust envelope/document mapping layer.',
    dataFlows: [{ direction: 'inbound', sixtyEntity: 'Deal Stage Updates', externalEntity: 'Signature Events' }],
    estimatedDays: 6,
    impactScore: 'high',
    complexity: 'medium',
    popularity: 4,
    revenueImpact: 'high',
  },
  payments: {
    useCase: 'Reconcile deal values with real payments and subscription revenue',
    useCaseDetails: [
      'Mark deals as Signed when invoices are paid',
      'Track MRR via subscription objects',
      'Alert on failed payments and churn signals',
      'Match customers to contacts by email/domain',
    ],
    apiEndpoints: [
      { endpoint: 'Webhook: invoice.paid (TBD)', method: '-', purpose: 'Update deal stage and revenue flags' },
      { endpoint: 'GET Invoices/Payments (TBD)', method: 'REST', purpose: 'Backfill payment history' },
      { endpoint: 'GET Subscriptions (TBD)', method: 'REST', purpose: 'Derive MRR' },
    ],
    whatsPossible: 'Accurate revenue attribution and payment-aware forecasting',
    limitations: 'Customer matching can be ambiguous; we’ll add admin review tools and safe matching heuristics.',
    dataFlows: [{ direction: 'inbound', sixtyEntity: 'Revenue Metrics', externalEntity: 'Invoices/Subscriptions' }],
    estimatedDays: 6,
    impactScore: 'high',
    complexity: 'medium',
    popularity: 4,
    revenueImpact: 'high',
  },
  ai_productivity: {
    useCase: 'Bring your own AI provider for drafting, summarization, and coaching',
    useCaseDetails: [
      'Allow orgs to select provider and configure API keys safely',
      'Use provider to generate drafts (emails/proposals) and coaching tips',
      'Support model selection and prompt templates',
      'Enforce rate limits and cost controls per org',
    ],
    apiEndpoints: [
      { endpoint: 'POST /v1/chat/completions (or equivalent)', method: 'REST', purpose: 'Generate drafts and coaching insights' },
      { endpoint: 'POST /v1/embeddings (or equivalent)', method: 'REST', purpose: 'Power semantic search and similarity' },
      { endpoint: 'POST /v1/files (optional)', method: 'REST', purpose: 'Optional knowledge-base / RAG workflows' },
    ],
    whatsPossible: 'Provider flexibility + better latency/cost tradeoffs',
    limitations: 'Provider policies and pricing vary; we’ll keep an abstraction layer and clear cost monitoring.',
    dataFlows: [{ direction: 'outbound', sixtyEntity: 'Prompts', externalEntity: 'LLM Requests' }],
    estimatedDays: 4,
    impactScore: 'medium',
    complexity: 'medium',
    popularity: 4,
    revenueImpact: 'medium',
  },
};

function makePlanFromSeed(seed: IntegrationSeed): IntegrationPlan {
  const tpl = templateDefaults[templateKeyForCategory(seed.category)];

  return {
    id: seed.id,
    name: seed.name,
    priority: seed.priority,
    priorityOrder: 0, // assigned later
    category: seed.category,
    logo: seed.id,

    useCase: tpl.useCase,
    useCaseDetails: tpl.useCaseDetails,

    authType: seed.authType,
    apiDocsUrl: seed.apiDocsUrl,
    baseUrl: seed.baseUrl,
    rateLimit: seed.rateLimit,
    scopes: seed.scopes,
    webhookEvents: seed.webhookEvents,

    apiEndpoints: tpl.apiEndpoints,
    whatsPossible: tpl.whatsPossible,
    limitations: tpl.limitations,

    dataFlows: tpl.dataFlows,

    estimatedDays: tpl.estimatedDays,
    impactScore: seed.impactScore ?? tpl.impactScore,
    complexity: seed.complexity ?? tpl.complexity,
    popularity: seed.popularity ?? tpl.popularity,
    revenueImpact: seed.revenueImpact ?? tpl.revenueImpact,
  };
}

// All additional "coming soon" + "suggested" integrations from `/integrations`
// (excluding those already in detailedPlans).
const generatedSeeds: IntegrationSeed[] = [
  // Meeting recorders
  { id: 'fireflies', name: 'Fireflies.ai', category: 'Meeting Recorder', priority: 'high', authType: 'oauth2', impactScore: 'high', popularity: 4 },
  { id: 'otter', name: 'Otter.ai', category: 'Meeting Recorder', priority: 'medium', authType: 'api_key', popularity: 4 },
  { id: 'granola', name: 'Granola', category: 'Meeting Recorder', priority: 'medium', authType: 'api_key', popularity: 3 },
  { id: 'gong', name: 'Gong', category: 'Meeting Recorder', priority: 'high', authType: 'partner_api', complexity: 'high', popularity: 5, revenueImpact: 'high' },
  { id: 'chorus', name: 'Chorus', category: 'Meeting Recorder', priority: 'medium', authType: 'partner_api', complexity: 'high', popularity: 4 },
  { id: 'avoma', name: 'Avoma', category: 'Meeting Recorder', priority: 'medium', authType: 'oauth2', popularity: 4 },
  { id: 'grain', name: 'Grain', category: 'Meeting Recorder', priority: 'low', authType: 'oauth2', popularity: 3 },

  // Video conferencing
  { id: 'teams', name: 'Microsoft Teams', category: 'Video', priority: 'high', authType: 'oauth2', impactScore: 'high', popularity: 5, revenueImpact: 'high' },
  { id: 'google-meet', name: 'Google Meet', category: 'Video', priority: 'medium', authType: 'oauth2', popularity: 4 },
  { id: 'webex', name: 'Webex', category: 'Video', priority: 'low', authType: 'oauth2', popularity: 3 },

  // CRM platforms
  { id: 'pipedrive', name: 'Pipedrive', category: 'CRM', priority: 'high', authType: 'oauth2', impactScore: 'high', popularity: 4, revenueImpact: 'high' },
  { id: 'zoho', name: 'Zoho CRM', category: 'CRM', priority: 'medium', authType: 'oauth2', popularity: 3 },
  { id: 'close', name: 'Close', category: 'CRM', priority: 'high', authType: 'api_key', popularity: 4 },
  { id: 'bullhorn', name: 'Bullhorn', category: 'CRM', priority: 'low', authType: 'partner_api', complexity: 'high', popularity: 3 },
  { id: 'highlevel', name: 'GoHighLevel', category: 'CRM', priority: 'medium', authType: 'api_key', popularity: 4 },
  { id: 'copper', name: 'Copper', category: 'CRM', priority: 'medium', authType: 'oauth2', popularity: 3 },
  { id: 'attio', name: 'Attio', category: 'CRM', priority: 'medium', authType: 'oauth2', popularity: 4 },
  { id: 'folk', name: 'Folk', category: 'CRM', priority: 'low', authType: 'oauth2', popularity: 3 },

  // Calendar & Booking
  { id: 'outlook', name: 'Microsoft Outlook', category: 'Calendar & Booking', priority: 'high', authType: 'oauth2', impactScore: 'high', popularity: 5, revenueImpact: 'high' },
  { id: 'cal-com', name: 'Cal.com', category: 'Calendar & Booking', priority: 'medium', authType: 'api_key', popularity: 3 },
  { id: 'acuity', name: 'Acuity', category: 'Calendar & Booking', priority: 'medium', authType: 'api_key', popularity: 3 },

  // Dialers
  { id: 'justcall', name: 'JustCall', category: 'Dialer', priority: 'medium', authType: 'api_key', popularity: 3 },
  { id: 'ringover', name: 'Ringover', category: 'Dialer', priority: 'low', authType: 'api_key', popularity: 3 },
  { id: 'cloudcall', name: 'CloudCall', category: 'Dialer', priority: 'low', authType: 'partner_api', popularity: 3 },
  { id: '8x8', name: '8x8', category: 'Dialer', priority: 'low', authType: 'oauth2', popularity: 3 },
  { id: 'aircall', name: 'Aircall', category: 'Dialer', priority: 'high', authType: 'oauth2', impactScore: 'high', popularity: 4 },
  { id: 'dialpad', name: 'Dialpad', category: 'Dialer', priority: 'medium', authType: 'oauth2', popularity: 4 },
  { id: 'ringcentral', name: 'RingCentral', category: 'Dialer', priority: 'medium', authType: 'oauth2', popularity: 4 },

  // Task management
  { id: 'notion', name: 'Notion', category: 'Task Management', priority: 'medium', authType: 'oauth2', popularity: 5 },
  { id: 'asana', name: 'Asana', category: 'Task Management', priority: 'medium', authType: 'oauth2', popularity: 4 },
  { id: 'monday', name: 'Monday.com', category: 'Task Management', priority: 'low', authType: 'oauth2', popularity: 4 },
  { id: 'clickup', name: 'ClickUp', category: 'Task Management', priority: 'low', authType: 'oauth2', popularity: 4 },
  { id: 'linear', name: 'Linear', category: 'Task Management', priority: 'low', authType: 'oauth2', popularity: 4 },
  { id: 'todoist', name: 'Todoist', category: 'Task Management', priority: 'low', authType: 'oauth2', popularity: 4 },
  { id: 'trello', name: 'Trello', category: 'Task Management', priority: 'low', authType: 'oauth2', popularity: 4 },
  { id: 'airtable', name: 'Airtable', category: 'Task Management', priority: 'low', authType: 'oauth2', popularity: 4 },

  // Automation & No-Code
  { id: 'make', name: 'Make', category: 'Automation', priority: 'medium', authType: 'api_key', popularity: 4 },
  { id: 'n8n', name: 'n8n', category: 'Automation', priority: 'medium', authType: 'api_key', popularity: 4 },
  { id: 'webhooks', name: 'Webhooks', category: 'Automation', priority: 'medium', authType: 'webhook_only', popularity: 3 },
  { id: 'tray', name: 'Tray.io', category: 'Automation', priority: 'low', authType: 'partner_api', popularity: 3 },

  // Team communication
  { id: 'discord', name: 'Discord', category: 'Communication', priority: 'low', authType: 'oauth2', popularity: 4 },
  { id: 'intercom', name: 'Intercom', category: 'Communication', priority: 'medium', authType: 'oauth2', popularity: 4 },

  // Suggested: Email & Outreach
  { id: 'lemlist', name: 'Lemlist', category: 'Email & Outreach', priority: 'low', authType: 'api_key', popularity: 3 },
  { id: 'outreach', name: 'Outreach', category: 'Email & Outreach', priority: 'medium', authType: 'oauth2', popularity: 4 },
  { id: 'salesloft', name: 'Salesloft', category: 'Email & Outreach', priority: 'medium', authType: 'oauth2', popularity: 4 },
  { id: 'instantly', name: 'Instantly', category: 'Email & Outreach', priority: 'low', authType: 'api_key', popularity: 4 },

  // Suggested: Sales Intelligence
  { id: 'zoominfo', name: 'ZoomInfo', category: 'Sales Intelligence', priority: 'medium', authType: 'partner_api', complexity: 'high', popularity: 4 },
  { id: 'clearbit', name: 'Clearbit', category: 'Sales Intelligence', priority: 'medium', authType: 'api_key', popularity: 4 },
  { id: 'lusha', name: 'Lusha', category: 'Sales Intelligence', priority: 'low', authType: 'api_key', popularity: 3 },
  { id: 'cognism', name: 'Cognism', category: 'Sales Intelligence', priority: 'low', authType: 'partner_api', popularity: 3 },

  // Suggested: E-Signature & Documents
  { id: 'pandadoc', name: 'PandaDoc', category: 'E-Signature', priority: 'medium', authType: 'oauth2', popularity: 4, impactScore: 'high', revenueImpact: 'high' },
  { id: 'hellosign', name: 'HelloSign', category: 'E-Signature', priority: 'low', authType: 'oauth2', popularity: 3, impactScore: 'medium' },
  { id: 'proposify', name: 'Proposify', category: 'E-Signature', priority: 'low', authType: 'api_key', popularity: 3 },

  // Suggested: Payments & Billing
  { id: 'quickbooks', name: 'QuickBooks', category: 'Payments', priority: 'medium', authType: 'oauth2', popularity: 4, impactScore: 'medium', revenueImpact: 'high' },
  { id: 'xero', name: 'Xero', category: 'Payments', priority: 'medium', authType: 'oauth2', popularity: 4, impactScore: 'medium', revenueImpact: 'high' },
  { id: 'chargebee', name: 'Chargebee', category: 'Payments', priority: 'low', authType: 'api_key', popularity: 3, impactScore: 'medium', revenueImpact: 'high' },

  // Suggested: AI & Productivity
  { id: 'openai', name: 'OpenAI / ChatGPT', category: 'AI', priority: 'medium', authType: 'api_key', popularity: 5 },
  { id: 'anthropic', name: 'Anthropic / Claude', category: 'AI', priority: 'medium', authType: 'api_key', popularity: 5 },
];

function priorityRank(p: Priority): number {
  switch (p) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'medium':
      return 2;
    case 'low':
      return 3;
  }
}

const detailedIds = new Set(detailedPlans.map((p) => p.id));
const generatedPlans: IntegrationPlan[] = generatedSeeds
  .filter((s) => !detailedIds.has(s.id))
  .map(makePlanFromSeed);

export const integrationPlans: IntegrationPlan[] = [...detailedPlans, ...generatedPlans]
  .sort((a, b) => {
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    // keep detailed top items stable, then alphabetical within tier to reduce churn
    const aDetailed = detailedIds.has(a.id) ? 0 : 1;
    const bDetailed = detailedIds.has(b.id) ? 0 : 1;
    if (aDetailed !== bDetailed) return aDetailed - bDetailed;
    return a.name.localeCompare(b.name);
  })
  .map((p, idx) => ({
    ...p,
    priorityOrder: idx + 1,
  }));

// Helper functions
export function getIntegrationById(id: string): IntegrationPlan | undefined {
  return integrationPlans.find((plan) => plan.id === id);
}

export function getIntegrationsByPriority(priority: Priority): IntegrationPlan[] {
  return integrationPlans.filter((plan) => plan.priority === priority);
}

export function getCriticalIntegrations(): IntegrationPlan[] {
  return getIntegrationsByPriority('critical');
}

export function getHighPriorityIntegrations(): IntegrationPlan[] {
  return getIntegrationsByPriority('high');
}

// Summary stats
export const integrationStats = {
  total: integrationPlans.length,
  critical: integrationPlans.filter((p) => p.priority === 'critical').length,
  high: integrationPlans.filter((p) => p.priority === 'high').length,
  totalDays: integrationPlans.reduce((sum, p) => sum + p.estimatedDays, 0),
};
