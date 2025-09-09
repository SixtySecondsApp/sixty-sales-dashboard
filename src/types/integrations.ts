/**
 * Google Workspace Integration Types
 * Comprehensive type definitions for Google Workspace services integration
 */

// ============================================================================
// Core Integration Types
// ============================================================================

export type IntegrationStatus = 
  | 'disconnected'
  | 'connecting' 
  | 'connected'
  | 'error'
  | 'syncing'
  | 'sync_error';

export type GoogleWorkspaceService = 
  | 'gmail'
  | 'calendar'
  | 'docs'
  | 'drive'
  | 'contacts';

// ============================================================================
// Connection & Authentication Types
// ============================================================================

export interface IntegrationConnection {
  id: string;
  user_id: string;
  service: GoogleWorkspaceService;
  status: IntegrationStatus;
  connected_at: string | null;
  last_sync_at: string | null;
  error_message: string | null;
  scopes: string[];
  account_email: string | null;
  account_name: string | null;
  // No OAuth tokens in frontend - handled by backend
  created_at: string;
  updated_at: string;
}

export interface ConnectionRequest {
  service: GoogleWorkspaceService;
  scopes: string[];
  return_url?: string;
}

export interface ConnectionResponse {
  success: boolean;
  auth_url?: string; // OAuth URL from backend
  error?: string;
  connection_id?: string;
}

// ============================================================================
// Sync & Real-time Updates
// ============================================================================

export interface SyncStatus {
  service: GoogleWorkspaceService;
  status: 'idle' | 'syncing' | 'completed' | 'failed';
  progress?: number; // 0-100
  last_sync: string | null;
  items_synced?: number;
  errors?: SyncError[];
}

export interface SyncError {
  code: string;
  message: string;
  timestamp: string;
  retryable: boolean;
}

export interface SyncProgress {
  total_items: number;
  processed_items: number;
  current_item?: string;
  estimated_completion?: string;
}

// ============================================================================
// Gmail Integration Types
// ============================================================================

export interface GmailMessage {
  id: string;
  thread_id: string;
  subject: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  date: string;
  body_text: string;
  body_html: string;
  attachments?: GmailAttachment[];
  labels: string[];
  is_read: boolean;
  is_important: boolean;
  is_starred: boolean;
}

export interface EmailAddress {
  name?: string;
  email: string;
}

export interface GmailAttachment {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  // No content in frontend - handled by backend for security
}

export interface GmailThread {
  id: string;
  messages: GmailMessage[];
  participants: EmailAddress[];
  subject: string;
  last_message_date: string;
  message_count: number;
  labels: string[];
  is_unread: boolean;
}

export interface GmailSyncConfig {
  labels: string[];
  include_spam: boolean;
  include_trash: boolean;
  date_range: {
    start?: string;
    end?: string;
  };
  max_results: number;
}

// ============================================================================
// Calendar Integration Types  
// ============================================================================

export interface CalendarEvent {
  id: string;
  calendar_id: string;
  title: string;
  description?: string;
  start: CalendarDateTime;
  end: CalendarDateTime;
  attendees: CalendarAttendee[];
  location?: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  visibility: 'default' | 'public' | 'private';
  organizer: CalendarAttendee;
  created_at: string;
  updated_at: string;
  meeting_url?: string;
  recurrence?: RecurrenceRule;
}

export interface CalendarDateTime {
  date_time: string; // ISO 8601
  timezone: string;
  all_day?: boolean;
}

export interface CalendarAttendee {
  email: string;
  name?: string;
  response_status: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  is_organizer?: boolean;
  is_optional?: boolean;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  until?: string;
  count?: number;
  by_day?: string[];
}

export interface Calendar {
  id: string;
  name: string;
  description?: string;
  timezone: string;
  is_primary: boolean;
  access_role: 'owner' | 'writer' | 'reader';
  color: string;
}

// ============================================================================
// Docs Integration Types
// ============================================================================

export interface GoogleDocument {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  owner: EmailAddress;
  editors: EmailAddress[];
  viewers: EmailAddress[];
  content_preview: string; // First 500 chars
  word_count: number;
  revision_id: string;
  mime_type: string;
  web_view_link: string;
  // No full content in frontend for performance
}

export interface DocumentRevision {
  id: string;
  document_id: string;
  timestamp: string;
  author: EmailAddress;
  description: string;
}

// ============================================================================
// CRM Integration Types (Business Logic)
// ============================================================================

export interface CRMSyncMapping {
  id: string;
  service: GoogleWorkspaceService;
  google_id: string;
  crm_entity_type: 'contact' | 'company' | 'deal' | 'activity';
  crm_entity_id: string;
  last_synced_at: string;
  sync_direction: 'google_to_crm' | 'crm_to_google' | 'bidirectional';
  created_at: string;
}

export interface EmailToCRMMapping {
  email_id: string;
  contact_id?: string;
  company_id?: string;
  deal_id?: string;
  activity_id?: string;
  confidence_score: number; // 0-1 for ML matching
  mapping_type: 'automatic' | 'manual' | 'suggested';
}

export interface CalendarToCRMMapping {
  event_id: string;
  deal_id?: string;
  contact_ids: string[];
  activity_id?: string;
  meeting_type: 'discovery' | 'demo' | 'negotiation' | 'closing' | 'follow_up' | 'other';
}

// ============================================================================
// API Client Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: {
    total_count?: number;
    page?: number;
    limit?: number;
    has_more?: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
  retry_after?: number; // seconds
}

export interface BatchRequest {
  requests: BatchRequestItem[];
}

export interface BatchRequestItem {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: any;
  id: string; // For matching responses
}

export interface BatchResponse {
  responses: BatchResponseItem[];
}

export interface BatchResponseItem {
  id: string;
  status: number;
  body: any;
  error?: ApiError;
}

// ============================================================================
// Webhook & Real-time Types
// ============================================================================

export interface WebhookEvent {
  id: string;
  service: GoogleWorkspaceService;
  event_type: string;
  resource_id: string;
  resource_state: string;
  timestamp: string;
  data?: Record<string, any>;
}

export interface RealtimeUpdate {
  type: 'sync_progress' | 'sync_complete' | 'sync_error' | 'connection_status';
  service: GoogleWorkspaceService;
  data: any;
  timestamp: string;
}

// ============================================================================
// Configuration & Settings Types
// ============================================================================

export interface IntegrationSettings {
  auto_sync: boolean;
  sync_interval_minutes: number;
  gmail: GmailSyncConfig;
  calendar: CalendarSyncConfig;
  docs: DocsSyncConfig;
  notifications: NotificationSettings;
}

export interface CalendarSyncConfig {
  calendars: string[]; // Calendar IDs to sync
  event_types: string[];
  include_declined: boolean;
  date_range_days: number; // How many days ahead/behind
}

export interface DocsSyncConfig {
  folders: string[]; // Folder IDs to sync
  file_types: string[];
  shared_only: boolean;
  max_file_size_mb: number;
}

export interface NotificationSettings {
  email_sync: boolean;
  calendar_sync: boolean;
  document_changes: boolean;
  sync_errors: boolean;
  browser_notifications: boolean;
  in_app_notifications: boolean;
}

// ============================================================================
// Performance & Monitoring Types
// ============================================================================

export interface PerformanceMetrics {
  api_response_time: number;
  sync_duration: number;
  items_per_second: number;
  error_rate: number;
  cache_hit_rate: number;
}

export interface HealthCheck {
  service: GoogleWorkspaceService;
  status: 'healthy' | 'degraded' | 'down';
  response_time: number;
  last_check: string;
  error_message?: string;
}

// ============================================================================
// Component Props Types
// ============================================================================

export interface IntegrationCardProps {
  service: GoogleWorkspaceService;
  connection: IntegrationConnection | null;
  onConnect: (service: GoogleWorkspaceService) => Promise<void>;
  onDisconnect: (service: GoogleWorkspaceService) => Promise<void>;
  onSync: (service: GoogleWorkspaceService) => Promise<void>;
  loading?: boolean;
}

export interface SyncStatusProps {
  syncStatus: SyncStatus[];
  onRetry: (service: GoogleWorkspaceService) => Promise<void>;
  onCancel: (service: GoogleWorkspaceService) => Promise<void>;
}

export interface ConnectionStatusProps {
  connections: IntegrationConnection[];
  onRefresh: () => Promise<void>;
  loading?: boolean;
}

// ============================================================================
// Hook Return Types
// ============================================================================

export interface UseIntegrationsReturn {
  connections: IntegrationConnection[];
  syncStatuses: SyncStatus[];
  settings: IntegrationSettings;
  loading: boolean;
  error: ApiError | null;
  
  // Actions
  connect: (request: ConnectionRequest) => Promise<ConnectionResponse>;
  disconnect: (service: GoogleWorkspaceService) => Promise<void>;
  startSync: (service: GoogleWorkspaceService) => Promise<void>;
  cancelSync: (service: GoogleWorkspaceService) => Promise<void>;
  updateSettings: (settings: Partial<IntegrationSettings>) => Promise<void>;
  retry: (service: GoogleWorkspaceService) => Promise<void>;
  refresh: () => Promise<void>;
  
  // Utilities
  getConnection: (service: GoogleWorkspaceService) => IntegrationConnection | null;
  getSyncStatus: (service: GoogleWorkspaceService) => SyncStatus | null;
  isConnected: (service: GoogleWorkspaceService) => boolean;
  isSyncing: (service: GoogleWorkspaceService) => boolean;
}

// ============================================================================
// Store State Types (Zustand)
// ============================================================================

export interface IntegrationStore {
  connections: Map<GoogleWorkspaceService, IntegrationConnection>;
  syncStatuses: Map<GoogleWorkspaceService, SyncStatus>;
  settings: IntegrationSettings | null;
  loading: boolean;
  error: ApiError | null;
  
  // Actions
  setConnections: (connections: IntegrationConnection[]) => void;
  updateConnection: (service: GoogleWorkspaceService, connection: IntegrationConnection) => void;
  removeConnection: (service: GoogleWorkspaceService) => void;
  setSyncStatus: (service: GoogleWorkspaceService, status: SyncStatus) => void;
  setSettings: (settings: IntegrationSettings) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: ApiError | null) => void;
  reset: () => void;
}

// ============================================================================
// Utility Types
// ============================================================================

export type ServiceIcon = {
  [K in GoogleWorkspaceService]: string;
};

export type ServiceColors = {
  [K in GoogleWorkspaceService]: {
    primary: string;
    secondary: string;
    accent: string;
  };
};

export type ServiceLabels = {
  [K in GoogleWorkspaceService]: {
    name: string;
    description: string;
  };
};