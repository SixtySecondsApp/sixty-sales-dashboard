/**
 * Bullhorn Integration Types
 *
 * Type definitions for Bullhorn REST API integration including entities,
 * authentication, webhooks, and synchronisation state management.
 */

// =============================================================================
// Error Types
// =============================================================================

/**
 * Custom error class for Bullhorn API errors with retry support
 */
export class BullhornError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterMs?: number,
    public readonly responseBody?: unknown
  ) {
    super(message);
    this.name = 'BullhornError';
    Object.setPrototypeOf(this, BullhornError.prototype);
  }

  /**
   * Check if the error is retryable (rate limit or temporary server error)
   */
  isRetryable(): boolean {
    return this.status === 429 || (this.status >= 500 && this.status < 600);
  }

  /**
   * Check if the error is an authentication error
   */
  isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

// =============================================================================
// Authentication Types
// =============================================================================

/**
 * Bullhorn OAuth credentials required for API access
 */
export interface BullhornCredentials {
  /** OAuth access token for authorisation */
  accessToken: string;
  /** OAuth refresh token for token renewal */
  refreshToken: string;
  /** Bullhorn REST API session token */
  bhRestToken: string;
  /** Base URL for REST API calls */
  restUrl: string;
  /** Corporate token identifying the Bullhorn instance */
  corpToken?: string;
  /** Token expiration timestamp (Unix milliseconds) */
  expiresAt: number;
}

/**
 * Current authentication state for a Bullhorn connection
 */
export interface BullhornAuthState {
  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;
  /** Current credentials if authenticated */
  credentials?: BullhornCredentials;
  /** Last authentication error message */
  error?: string;
  /** Timestamp of last successful authentication */
  lastAuthenticatedAt?: string;
  /** Whether a token refresh is in progress */
  isRefreshing?: boolean;
}

/**
 * OAuth configuration for Bullhorn app
 */
export interface BullhornOAuthConfig {
  /** Bullhorn OAuth client ID */
  clientId: string;
  /** Bullhorn OAuth client secret */
  clientSecret: string;
  /** OAuth callback URL */
  redirectUri: string;
  /** Bullhorn authorisation endpoint */
  authUrl: string;
  /** Bullhorn token endpoint */
  tokenUrl: string;
  /** Bullhorn login endpoint */
  loginUrl: string;
}

// =============================================================================
// Core Entity Types
// =============================================================================

/**
 * Base entity interface with common Bullhorn fields
 */
export interface BullhornEntity {
  /** Unique Bullhorn entity ID */
  id: number;
  /** Entity creation timestamp */
  dateAdded?: number;
  /** Last modification timestamp */
  dateLastModified?: number;
  /** Indicates if entity is soft-deleted */
  isDeleted?: boolean;
}

/**
 * Bullhorn Candidate entity - represents job seekers/consultants
 */
export interface BullhornCandidate extends BullhornEntity {
  firstName: string;
  lastName: string;
  name?: string;
  email?: string;
  email2?: string;
  email3?: string;
  phone?: string;
  phone2?: string;
  phone3?: string;
  mobile?: string;
  address?: BullhornAddress;
  status?: string;
  source?: string;

  // Employment details
  salary?: number;
  salaryLow?: number;
  dayRate?: number;
  dayRateLow?: number;
  hourlyRate?: number;
  hourlyRateLow?: number;
  payRate?: number;
  employeeType?: string;
  employmentPreference?: string;

  // Skills and experience
  skillSet?: string;
  primarySkills?: BullhornSkill[];
  secondarySkills?: BullhornSkill[];
  specialties?: BullhornSpecialty[];
  occupation?: string;
  experience?: number;
  yearsExperience?: number;

  // Availability
  dateAvailable?: number;
  dateLastComment?: number;
  dateLastModified?: number;
  dateOfBirth?: number;

  // Custom fields (Bullhorn allows up to 35 custom text fields)
  customText1?: string;
  customText2?: string;
  customText3?: string;
  customText4?: string;
  customText5?: string;
  customText6?: string;
  customText7?: string;
  customText8?: string;
  customText9?: string;
  customText10?: string;

  // Custom numeric fields
  customFloat1?: number;
  customFloat2?: number;
  customFloat3?: number;

  // Custom date fields
  customDate1?: number;
  customDate2?: number;
  customDate3?: number;

  // Relationships
  owner?: BullhornUserReference;
  businessSectors?: BullhornBusinessSector[];
  categories?: BullhornCategory[];

  // Documents and files
  description?: string;
  resume?: string;
  companyName?: string;
  companyURL?: string;

  // Compliance and preferences
  workAuthorized?: boolean;
  willRelocate?: boolean;
  travelLimit?: number;
  preferredContact?: string;

  // External IDs for integration
  externalID?: string;
  customID?: number;
}

/**
 * Bullhorn Client Contact entity - contacts at client companies
 */
export interface BullhornClientContact extends BullhornEntity {
  firstName: string;
  lastName: string;
  name?: string;
  email?: string;
  email2?: string;
  email3?: string;
  phone?: string;
  phone2?: string;
  phone3?: string;
  mobile?: string;
  fax?: string;
  address?: BullhornAddress;

  // Role and status
  type?: string;
  status?: string;
  division?: string;
  department?: string;

  // Relationships
  clientCorporation?: BullhornClientCorporationReference;
  owner?: BullhornUserReference;

  // Communication preferences
  preferredContact?: string;
  dateLastComment?: number;
  dateLastVisit?: number;

  // Custom fields
  customText1?: string;
  customText2?: string;
  customText3?: string;
  customText4?: string;
  customText5?: string;

  customFloat1?: number;
  customFloat2?: number;
  customFloat3?: number;

  customDate1?: number;
  customDate2?: number;
  customDate3?: number;

  // Additional fields
  description?: string;
  source?: string;
  externalID?: string;
  isDeleted?: boolean;
}

/**
 * Bullhorn Client Corporation entity - companies/accounts
 */
export interface BullhornClientCorporation extends BullhornEntity {
  name: string;
  companyDescription?: string;
  companyURL?: string;
  status?: string;

  // Contact information
  phone?: string;
  fax?: string;
  address?: BullhornAddress;
  billingAddress?: BullhornAddress;

  // Business details
  annualRevenue?: number;
  numEmployees?: number;
  numOffices?: number;
  industry?: string;
  businessSectorList?: string;

  // Relationships
  parentClientCorporation?: BullhornClientCorporationReference;
  childClientCorporations?: BullhornClientCorporationReference[];
  clientContacts?: BullhornClientContactReference[];
  owner?: BullhornUserReference;

  // Financial settings
  invoiceFormat?: string;
  paymentTerms?: string;
  taxRate?: number;

  // Custom fields
  customText1?: string;
  customText2?: string;
  customText3?: string;
  customText4?: string;
  customText5?: string;

  customFloat1?: number;
  customFloat2?: number;
  customFloat3?: number;

  customDate1?: number;
  customDate2?: number;
  customDate3?: number;

  // External integration
  externalID?: string;
  notes?: string;
}

/**
 * Bullhorn Job Order entity - job requisitions/opportunities
 */
export interface BullhornJobOrder extends BullhornEntity {
  title: string;
  employmentType?: string;
  status?: string;

  // Client relationship
  clientContact?: BullhornClientContactReference;
  clientCorporation?: BullhornClientCorporationReference;

  // Position details
  description?: string;
  publicDescription?: string;
  numOpenings?: number;
  onSite?: string;
  address?: BullhornAddress;

  // Compensation
  salary?: number;
  salaryUnit?: string;
  payRate?: number;
  billRate?: number;
  hoursPerWeek?: number;

  // Dates
  startDate?: number;
  dateEnd?: number;
  dateClosed?: number;
  dateLastExport?: number;

  // Requirements
  skillList?: string;
  yearsRequired?: number;
  educationDegree?: string;
  certificationList?: string;

  // Relationships
  owner?: BullhornUserReference;
  assignedUsers?: BullhornUserReference[];
  categories?: BullhornCategory[];
  businessSectors?: BullhornBusinessSector[];

  // Workflow
  source?: string;
  reasonClosed?: string;
  isOpen?: boolean;
  isPublic?: number;
  isInterviewRequired?: boolean;

  // Custom fields
  customText1?: string;
  customText2?: string;
  customText3?: string;
  customText4?: string;
  customText5?: string;

  customFloat1?: number;
  customFloat2?: number;
  customFloat3?: number;

  customDate1?: number;
  customDate2?: number;
  customDate3?: number;

  // External integration
  externalID?: string;
  correlatedCustomText1?: string;
  correlatedCustomText2?: string;
}

/**
 * Bullhorn Note entity - activity notes and comments
 */
export interface BullhornNote extends BullhornEntity {
  action?: string;
  comments?: string;
  commentingPerson?: BullhornUserReference;

  // Associated entities
  personReference?: BullhornPersonReference;
  jobOrder?: BullhornJobOrderReference;
  clientContact?: BullhornClientContactReference;

  // Timing
  dateAdded?: number;
  dateLastModified?: number;
  minutesSpent?: number;

  // Note type and visibility
  isDeleted?: boolean;
  externalID?: string;
}

/**
 * Bullhorn Task entity - scheduled activities and follow-ups
 */
export interface BullhornTask extends BullhornEntity {
  subject: string;
  description?: string;
  type?: string;

  // Scheduling
  dateBegin?: number;
  dateDue?: number;
  dateCompleted?: number;
  dateLastModified?: number;

  // Status
  isCompleted?: boolean;
  isPrivate?: boolean;
  isDeleted?: boolean;

  // Associations
  owner?: BullhornUserReference;
  candidate?: BullhornCandidateReference;
  clientContact?: BullhornClientContactReference;
  jobOrder?: BullhornJobOrderReference;
  placement?: BullhornPlacementReference;

  // Priority and notification
  priority?: number;
  notificationMinutes?: number;
  recurrencePattern?: string;

  // External integration
  externalID?: string;
}

/**
 * Bullhorn Placement entity - successful job placements
 */
export interface BullhornPlacement extends BullhornEntity {
  status?: string;

  // People and positions
  candidate?: BullhornCandidateReference;
  jobOrder?: BullhornJobOrderReference;

  // Dates
  dateBegin?: number;
  dateEnd?: number;
  dateAdded?: number;
  dateLastModified?: number;

  // Compensation
  salary?: number;
  salaryUnit?: string;
  payRate?: number;
  clientBillRate?: number;
  hoursPerDay?: number;
  daysGuaranteed?: number;

  // Fee and commission
  fee?: number;
  feeArrangement?: string;

  // Employment details
  employmentType?: string;
  workersCompensationRate?: BullhornWorkersCompRate;

  // Relationships
  owner?: BullhornUserReference;

  // Custom fields
  customText1?: string;
  customText2?: string;
  customText3?: string;

  customFloat1?: number;
  customFloat2?: number;
  customFloat3?: number;

  // External integration
  externalID?: string;
  correlatedCustomText1?: string;
}

/**
 * Bullhorn Sendout entity - candidate submissions/interviews
 */
export interface BullhornSendout extends BullhornEntity {
  status?: string;

  // Candidate and job
  candidate?: BullhornCandidateReference;
  jobOrder?: BullhornJobOrderReference;
  clientContact?: BullhornClientContactReference;
  clientCorporation?: BullhornClientCorporationReference;

  // Dates
  dateAdded?: number;
  dateSent?: number;
  dateLastModified?: number;

  // Interview details
  isRead?: boolean;

  // Relationships
  owner?: BullhornUserReference;

  // External integration
  externalID?: string;
}

/**
 * Bullhorn Appointment entity - calendar events
 */
export interface BullhornAppointment extends BullhornEntity {
  subject?: string;
  description?: string;
  type?: string;

  // Scheduling
  dateBegin?: number;
  dateEnd?: number;
  dateAdded?: number;
  dateLastModified?: number;

  // Location
  location?: string;
  isAllDay?: boolean;

  // Status
  isPrivate?: boolean;
  isDeleted?: boolean;

  // Associations
  owner?: BullhornUserReference;
  attendees?: BullhornUserReference[];
  candidate?: BullhornCandidateReference;
  clientContact?: BullhornClientContactReference;
  jobOrder?: BullhornJobOrderReference;
  placement?: BullhornPlacementReference;

  // Recurrence
  recurrencePattern?: string;

  // External integration
  externalID?: string;
}

// =============================================================================
// Supporting Types
// =============================================================================

/**
 * Address structure used across Bullhorn entities
 */
export interface BullhornAddress {
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  countryID?: number;
  countryName?: string;
  countryCode?: string;
}

/**
 * Skill reference type
 */
export interface BullhornSkill {
  id: number;
  name?: string;
}

/**
 * Specialty reference type
 */
export interface BullhornSpecialty {
  id: number;
  name?: string;
}

/**
 * Business sector reference type
 */
export interface BullhornBusinessSector {
  id: number;
  name?: string;
}

/**
 * Category reference type
 */
export interface BullhornCategory {
  id: number;
  name?: string;
  occupation?: string;
}

/**
 * Workers compensation rate structure
 */
export interface BullhornWorkersCompRate {
  id: number;
  name?: string;
  rate?: number;
}

// =============================================================================
// Reference Types (for nested relationships)
// =============================================================================

/**
 * User reference for owner/assignee fields
 */
export interface BullhornUserReference {
  id: number;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
}

/**
 * Candidate reference for associations
 */
export interface BullhornCandidateReference {
  id: number;
  firstName?: string;
  lastName?: string;
  name?: string;
}

/**
 * Client contact reference for associations
 */
export interface BullhornClientContactReference {
  id: number;
  firstName?: string;
  lastName?: string;
  name?: string;
}

/**
 * Client corporation reference for associations
 */
export interface BullhornClientCorporationReference {
  id: number;
  name?: string;
}

/**
 * Job order reference for associations
 */
export interface BullhornJobOrderReference {
  id: number;
  title?: string;
}

/**
 * Placement reference for associations
 */
export interface BullhornPlacementReference {
  id: number;
  status?: string;
}

/**
 * Generic person reference (can be candidate or contact)
 */
export interface BullhornPersonReference {
  id: number;
  _subtype?: 'Candidate' | 'ClientContact';
  firstName?: string;
  lastName?: string;
  name?: string;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Standard Bullhorn API list response
 */
export interface BullhornListResponse<T> {
  data: T[];
  count: number;
  start: number;
  total?: number;
}

/**
 * Standard Bullhorn API single entity response
 */
export interface BullhornEntityResponse<T> {
  data: T;
  meta?: {
    entity: string;
    id: number;
  };
}

/**
 * Bullhorn API error response
 */
export interface BullhornErrorResponse {
  errorCode?: string;
  errorMessage: string;
  errorMessageKey?: string;
  errors?: Array<{
    propertyName: string;
    severity: string;
    type: string;
  }>;
}

/**
 * Bullhorn search response
 */
export interface BullhornSearchResponse<T> {
  data: T[];
  count: number;
  start: number;
  total: number;
}

// =============================================================================
// Webhook Types
// =============================================================================

/**
 * Bullhorn webhook event payload
 */
export interface BullhornWebhookEvent {
  /** Event type (ENTITY_INSERTED, ENTITY_UPDATED, ENTITY_DELETED) */
  eventType: BullhornWebhookEventType;
  /** Entity type (Candidate, ClientContact, JobOrder, etc.) */
  entityType: BullhornEntityType;
  /** Entity ID that triggered the event */
  entityId: number;
  /** User ID who triggered the event */
  updatingUserId?: number;
  /** Timestamp of the event */
  eventTimestamp: number;
  /** Properties that were updated (for UPDATE events) */
  updatedProperties?: string[];
  /** Transaction ID for correlation */
  transactionId?: string;
  /** Corporation ID */
  corporationId?: number;
}

/**
 * Webhook event types
 */
export type BullhornWebhookEventType =
  | 'ENTITY_INSERTED'
  | 'ENTITY_UPDATED'
  | 'ENTITY_DELETED';

/**
 * Supported Bullhorn entity types
 */
export type BullhornEntityType =
  | 'Candidate'
  | 'ClientContact'
  | 'ClientCorporation'
  | 'JobOrder'
  | 'JobSubmission'
  | 'Placement'
  | 'Sendout'
  | 'Note'
  | 'Task'
  | 'Appointment';

/**
 * Bullhorn webhook subscription configuration
 */
export interface BullhornSubscription {
  id?: string;
  /** Subscription name */
  subscriptionId: string;
  /** Entity types to subscribe to */
  entityTypes: BullhornEntityType[];
  /** Event types to subscribe to */
  eventTypes: BullhornWebhookEventType[];
  /** Webhook delivery URL */
  url: string;
  /** Whether the subscription is active */
  enabled: boolean;
  /** Date subscription was created */
  dateCreated?: string;
  /** Date subscription was last modified */
  dateLastModified?: string;
}

// =============================================================================
// Sync Types
// =============================================================================

/**
 * Synchronisation state for a Bullhorn integration
 */
export interface BullhornSyncState {
  /** Integration ID this state belongs to */
  integrationId: string;
  /** Last successful sync timestamp */
  lastSyncAt?: string;
  /** Last sync error if any */
  lastSyncError?: string;
  /** Sync status */
  status: BullhornSyncStatus;
  /** Per-entity sync cursors */
  cursors: Record<BullhornEntityType, BullhornSyncCursor>;
  /** Number of records synced in last run */
  lastSyncCount?: number;
  /** Next scheduled sync time */
  nextSyncAt?: string;
}

/**
 * Sync status values
 */
export type BullhornSyncStatus =
  | 'idle'
  | 'syncing'
  | 'error'
  | 'paused'
  | 'initialising';

/**
 * Sync cursor for pagination and incremental sync
 */
export interface BullhornSyncCursor {
  /** Last synced entity ID */
  lastId?: number;
  /** Last sync timestamp for this entity type */
  lastModifiedAt?: number;
  /** Total records synced for this entity type */
  totalSynced: number;
  /** Whether initial sync is complete */
  initialSyncComplete: boolean;
}

/**
 * Object mapping between Bullhorn and use60 entities
 */
export interface BullhornObjectMapping {
  /** Bullhorn entity type */
  bullhornEntity: BullhornEntityType;
  /** use60 table name */
  use60Table: string;
  /** Field mappings (Bullhorn field -> use60 field) */
  fieldMappings: Record<string, string>;
  /** Whether this mapping is enabled */
  enabled: boolean;
  /** Sync direction */
  direction: 'bullhorn_to_use60' | 'use60_to_bullhorn' | 'bidirectional';
  /** Custom transformation function name */
  transformFunction?: string;
}

// =============================================================================
// Integration Types
// =============================================================================

/**
 * Bullhorn integration configuration
 */
export interface BullhornIntegration {
  /** Unique integration ID */
  id: string;
  /** Organisation ID this integration belongs to */
  organisationId: string;
  /** User ID who created the integration */
  userId: string;
  /** Integration name/label */
  name: string;
  /** Whether the integration is enabled */
  enabled: boolean;
  /** Integration creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Current authentication state */
  authState: BullhornAuthState;
  /** Integration settings */
  settings: BullhornSettings;
  /** Current sync state */
  syncState?: BullhornSyncState;
}

/**
 * Bullhorn integration settings
 */
export interface BullhornSettings {
  /** Automatic sync enabled */
  autoSync: boolean;
  /** Sync interval in minutes */
  syncIntervalMinutes: number;
  /** Entity types to sync */
  enabledEntityTypes: BullhornEntityType[];
  /** Object mappings configuration */
  objectMappings: BullhornObjectMapping[];
  /** Webhook settings */
  webhookSettings: BullhornWebhookSettings;
  /** Field mapping overrides */
  fieldMappingOverrides?: Record<string, Record<string, string>>;
  /** Custom filters for sync */
  syncFilters?: BullhornSyncFilters;
  /** Conflict resolution strategy */
  conflictResolution: 'bullhorn_wins' | 'use60_wins' | 'newest_wins';
}

/**
 * Webhook configuration settings
 */
export interface BullhornWebhookSettings {
  /** Whether webhooks are enabled */
  enabled: boolean;
  /** Webhook secret for signature verification */
  webhookSecret?: string;
  /** Subscriptions configuration */
  subscriptions: BullhornSubscription[];
}

/**
 * Sync filter configuration
 */
export interface BullhornSyncFilters {
  /** Only sync candidates with these statuses */
  candidateStatuses?: string[];
  /** Only sync job orders with these statuses */
  jobOrderStatuses?: string[];
  /** Only sync records modified after this date */
  modifiedAfter?: string;
  /** Only sync records owned by these user IDs */
  ownerUserIds?: number[];
  /** Custom WHERE clause for advanced filtering */
  customFilter?: string;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Bullhorn API query parameters
 */
export interface BullhornQueryParams {
  fields?: string;
  where?: string;
  query?: string;
  count?: number;
  start?: number;
  orderBy?: string;
  sort?: 'asc' | 'desc';
  showEditable?: boolean;
  meta?: 'basic' | 'full' | 'off';
}

/**
 * Bullhorn entity create/update payload
 */
export type BullhornEntityPayload<T extends BullhornEntity> = Omit<T, 'id' | 'dateAdded' | 'dateLastModified'>;

/**
 * Bullhorn batch operation result
 */
export interface BullhornBatchResult {
  changedEntityType: string;
  changedEntityId: number;
  changeType: 'INSERT' | 'UPDATE' | 'DELETE';
  data?: Record<string, unknown>;
}

/**
 * Rate limit information from API response headers
 */
export interface BullhornRateLimitInfo {
  /** Remaining API calls in current window */
  remaining: number;
  /** Total limit for current window */
  limit: number;
  /** Seconds until limit resets */
  resetInSeconds: number;
}
