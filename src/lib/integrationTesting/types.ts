/**
 * Integration Testing Framework - Types
 *
 * Provides type definitions for the integration testing system
 */

export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'error';
export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';
export type TriggerType = 'manual' | 'scheduled' | 'webhook' | 'onboarding';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertType = 'failure' | 'recovery' | 'degradation';

export interface IntegrationTest {
  id: string;
  name: string;
  description: string;
  category: string;
  timeout?: number; // ms, default 30000
  run: () => Promise<TestResult>;
}

export interface TestResult {
  testId: string;
  testName: string;
  status: TestStatus;
  message?: string;
  duration?: number; // ms
  errorDetails?: Record<string, unknown>;
  responseData?: Record<string, unknown>;
}

export interface IntegrationTestSuite {
  integrationName: string;
  displayName: string;
  description: string;
  icon: string;
  tests: IntegrationTest[];
  getConnectionStatus: () => Promise<ConnectionStatus>;
}

export interface ConnectionStatus {
  isConnected: boolean;
  connectedAt?: string;
  lastSyncAt?: string;
  accountInfo?: {
    email?: string;
    name?: string;
    id?: string;
  };
  error?: string;
}

export interface TestRunResult {
  integrationName: string;
  startedAt: Date;
  completedAt: Date;
  triggeredBy: TriggerType;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    error: number;
    passRate: number;
  };
}

export interface IntegrationHealthSummary {
  integration_name: string;
  passed_count: number;
  failed_count: number;
  error_count: number;
  total_tests: number;
  pass_rate: number;
  last_test_at: string | null;
  health_status: HealthStatus;
}

export interface IntegrationTestRecord {
  id: string;
  created_at: string;
  integration_name: string;
  test_name: string;
  test_category: string | null;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  duration_ms: number | null;
  message: string | null;
  error_details: Record<string, unknown> | null;
  response_data: Record<string, unknown> | null;
  triggered_by: TriggerType;
  triggered_by_user_id: string | null;
  org_id: string | null;
}

export interface IntegrationAlert {
  id: string;
  created_at: string;
  integration_name: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  test_result_id: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface IntegrationDefinition {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  category: 'meetings' | 'calendar' | 'communication' | 'crm' | 'other';
  docsUrl?: string;
  features: string[];
}

// Registry of all integrations
export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    name: 'fathom',
    displayName: 'Fathom',
    description: 'AI meeting recording and transcription',
    icon: 'Video',
    category: 'meetings',
    docsUrl: 'https://fathom.video/docs',
    features: [
      'Meeting sync',
      'Transcript extraction',
      'AI summaries',
      'Action item detection',
      'Webhook notifications',
    ],
  },
  {
    name: 'google',
    displayName: 'Google Workspace',
    description: 'Calendar, Gmail, and Tasks integration',
    icon: 'Mail',
    category: 'calendar',
    features: [
      'Calendar sync',
      'Email tracking',
      'Task sync',
      'Contact matching',
    ],
  },
  {
    name: 'slack',
    displayName: 'Slack',
    description: 'Team messaging and notifications',
    icon: 'MessageSquare',
    category: 'communication',
    features: [
      'Notifications',
      'Deal updates',
      'Task reminders',
    ],
  },
  {
    name: 'hubspot',
    displayName: 'HubSpot',
    description: 'CRM sync and contact management',
    icon: 'Users',
    category: 'crm',
    features: [
      'Contact sync',
      'Deal sync',
      'Activity logging',
    ],
  },
  {
    name: 'savvycal',
    displayName: 'SavvyCal',
    description: 'Scheduling and booking',
    icon: 'Calendar',
    category: 'calendar',
    features: [
      'Booking links',
      'Calendar availability',
      'Meeting scheduling',
    ],
  },
  {
    name: 'justcall',
    displayName: 'JustCall',
    description: 'Phone system and call tracking',
    icon: 'Phone',
    category: 'communication',
    features: [
      'Call logging',
      'SMS tracking',
      'Voicemail transcription',
    ],
  },
];
