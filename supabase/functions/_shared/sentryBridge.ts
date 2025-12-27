/**
 * Sentry Bridge Shared Utilities
 *
 * Privacy redaction, payload formatting, and routing helpers for the Sentry Bridge.
 */

import { hmacSha256Hex, timingSafeEqual } from './use60Signing.ts';

// ============================================================================
// Types
// ============================================================================

export interface SentryIssuePayload {
  action: 'created' | 'resolved' | 'unresolved' | 'regression' | 'archived' | 'assigned';
  data: {
    issue: SentryIssue;
    event?: SentryEvent;
  };
  installation?: {
    uuid: string;
  };
  actor?: {
    type: 'user' | 'application';
    id?: string;
    name?: string;
  };
}

export interface SentryIssue {
  id: string;
  shortId: string; // e.g., "PROJ-123"
  title: string;
  culprit: string;
  level: 'error' | 'warning' | 'info' | 'debug' | 'fatal';
  status: 'unresolved' | 'resolved' | 'ignored';
  isPublic: boolean;
  platform: string;
  project: {
    id: string;
    name: string;
    slug: string;
  };
  type: string;
  metadata: {
    type?: string;
    value?: string;
    filename?: string;
    function?: string;
  };
  numComments: number;
  firstSeen: string;
  lastSeen: string;
  count?: number;
}

export interface SentryEvent {
  eventID: string;
  context?: Record<string, unknown>;
  contexts?: {
    browser?: { name: string; version: string };
    os?: { name: string; version: string };
    device?: { family: string; model: string };
    trace?: { trace_id: string; span_id: string };
  };
  entries?: Array<{
    type: 'exception' | 'breadcrumbs' | 'request' | 'message';
    data: unknown;
  }>;
  environment?: string;
  message?: string;
  platform: string;
  release?: string;
  sdk?: { name: string; version: string };
  tags?: Array<{ key: string; value: string }>;
  user?: {
    id?: string;
    email?: string;
    ip_address?: string;
    username?: string;
  };
  fingerprint?: string[];
}

export interface RoutingRule {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  test_mode: boolean;
  match_sentry_project?: string;
  match_error_type?: string;
  match_error_message?: string;
  match_culprit?: string;
  match_tags?: Record<string, string>;
  match_environment?: string;
  match_release_pattern?: string;
  target_dev_hub_project_id: string;
  target_owner_user_id?: string;
  target_priority: 'low' | 'medium' | 'high' | 'urgent';
  attach_runbook_urls?: string[];
  additional_labels?: string[];
  notify_slack_channel?: string;
}

export interface RoutingResult {
  projectId: string;
  ownerId?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  matchedRuleId?: string;
  matchedRuleName?: string;
  runbookUrls?: string[];
  labels?: string[];
  slackChannel?: string;
  isTestMode: boolean;
}

export interface TicketPayload {
  title: string;
  description: string;
  projectId: string;
  type: 'bug';
  status: 'todo';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate: string;
  aiContext?: string;
  aiGeneratedPrompt?: string;
}

export interface BridgeConfig {
  id: string;
  org_id: string;
  enabled: boolean;
  sentry_org_slug?: string;
  sentry_project_slugs?: string[];
  triage_mode_enabled: boolean;
  auto_create_devhub_tickets: boolean; // When false, skip MCP ticket creation
  default_dev_hub_project_id?: string;
  default_owner_user_id?: string;
  default_priority: 'low' | 'medium' | 'high' | 'urgent';
  max_tickets_per_hour: number;
  max_tickets_per_day: number;
  cooldown_same_issue_minutes: number;
  spike_threshold_count: number;
  spike_threshold_minutes: number;
  allowlisted_tags: string[];
  tag_allowlist?: string[]; // Alias for allowlisted_tags
  service_user_id?: string;
  circuit_breaker_tripped_at?: string;
}

export interface SentryBridgeQueueItem {
  id: string;
  org_id: string;
  webhook_event_id: string;
  sentry_issue_id: string;
  sentry_event_id: string;
  event_type: string;
  target_dev_hub_project_id: string;
  target_owner_user_id?: string;
  target_priority: string;
  routing_rule_id?: string;
  ticket_payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dlq';
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string;
  last_error?: string;
  locked_by?: string;
  locked_at?: string;
  created_at: string;
  processed_at?: string;
}

export interface SentryIssueMappingRow {
  id: string;
  org_id: string;
  sentry_issue_id: string;
  sentry_project_slug: string;
  devhub_task_id: string;
  devhub_task_url?: string;
  dev_hub_project_id: string;
  error_hash?: string;
  sentry_status: string;
  dev_hub_status?: string;
  latest_sentry_event_id?: string;
  first_seen: string;
  last_seen: string;
  event_count: number;
  first_release?: string;
  latest_release?: string;
  sentry_external_issue_id?: string;
  sync_status?: string;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DevHubTicketPayload {
  title: string;
  description: string;
  project_id: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string;
  assignee_id?: string;
  sentry_issue_id: string;
  sentry_project: string;
  sentry_url: string;
  error_type: string;
  first_seen: string;
  last_seen: string;
  event_count: number;
  user_count?: number;
  environments?: string[];
  tags?: Array<{ key: string; value: string }>;
  correlation?: {
    trace_id?: string;
    tenant_id?: string;
    deal_id?: string;
  };
}

// Priority mapping from Sentry to Dev Hub
export const PRIORITY_MAP: Record<string, 'low' | 'medium' | 'high' | 'urgent'> = {
  debug: 'low',
  info: 'low',
  warning: 'medium',
  error: 'high',
  fatal: 'urgent',
};

// Status mapping from Sentry to Dev Hub
export const DEV_HUB_STATUS_MAP: Record<string, string> = {
  unresolved: 'todo',
  resolved: 'done',
  ignored: 'cancelled',
};

// ============================================================================
// Privacy Redaction
// ============================================================================

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN = /(\+?\d{1,4}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
const IP_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const JWT_PATTERN = /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;
const API_KEY_PATTERN = /(?:api[_-]?key|token|secret|password|auth)[=:]["']?([a-zA-Z0-9_-]{20,})["']?/gi;
const LONG_HEX_PATTERN = /\b[a-fA-F0-9]{32,}\b/g;
const LOCAL_PATH_PATTERN = /\/(?:Users|home|var|tmp)\/[^\s,;]+/g;
const WINDOWS_PATH_PATTERN = /[A-Z]:\\[^\s,;]+/g;

/**
 * Redact sensitive information from a string
 */
export function redactSensitiveData(text: string): string {
  if (!text || typeof text !== 'string') return text;

  return text
    .replace(EMAIL_PATTERN, '[EMAIL_REDACTED]')
    .replace(PHONE_PATTERN, (match) => {
      // Only redact if it looks like a phone number (7+ digits)
      const digits = match.replace(/\D/g, '');
      return digits.length >= 7 ? '[PHONE_REDACTED]' : match;
    })
    .replace(IP_PATTERN, '[IP_REDACTED]')
    .replace(JWT_PATTERN, '[JWT_REDACTED]')
    .replace(API_KEY_PATTERN, (match, key) => match.replace(key, '[API_KEY_REDACTED]'))
    .replace(LONG_HEX_PATTERN, (match) => {
      // Keep short hashes (like git shas), redact very long ones
      return match.length > 40 ? '[LONG_HEX_REDACTED]' : match;
    })
    .replace(LOCAL_PATH_PATTERN, (match) => {
      // Extract just the filename
      const parts = match.split('/');
      return `[PATH]/${parts[parts.length - 1]}`;
    })
    .replace(WINDOWS_PATH_PATTERN, (match) => {
      const parts = match.split('\\');
      return `[PATH]\\${parts[parts.length - 1]}`;
    });
}

/**
 * Redact an entire object recursively
 */
export function redactObject(obj: unknown): unknown {
  if (!obj) return obj;

  if (typeof obj === 'string') {
    return redactSensitiveData(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(redactObject);
  }

  if (typeof obj === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Skip sensitive fields entirely
      if (['password', 'secret', 'token', 'apiKey', 'api_key', 'authorization'].includes(key.toLowerCase())) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactObject(value);
      }
    }
    return redacted;
  }

  return obj;
}

/**
 * Filter tags to only include allowlisted ones
 */
export function filterTags(
  tags: Array<{ key: string; value: string }> | undefined,
  allowlist: string[]
): Array<{ key: string; value: string }> {
  if (!tags) return [];

  return tags
    .filter((tag) => allowlist.includes(tag.key))
    .map((tag) => ({
      key: tag.key,
      value: redactSensitiveData(tag.value).slice(0, 50), // Truncate values
    }));
}

/**
 * Sanitize user object (keep only ID)
 */
export function sanitizeUser(user: SentryEvent['user']): { id?: string } | undefined {
  if (!user) return undefined;
  return { id: user.id };
}

// ============================================================================
// Payload Formatting
// ============================================================================

/**
 * Extract top stack frames from exception entry
 */
function extractStackFrames(
  exceptionEntry: { data: { values?: Array<{ stacktrace?: { frames?: Array<unknown> } }> } } | undefined,
  limit = 5
): string[] {
  if (!exceptionEntry?.data?.values?.[0]?.stacktrace?.frames) return [];

  const frames = exceptionEntry.data.values[0].stacktrace.frames as Array<{
    filename?: string;
    function?: string;
    lineno?: number;
    colno?: number;
    in_app?: boolean;
  }>;

  // Prioritize in-app frames, take top N
  const inAppFrames = frames.filter((f) => f.in_app);
  const selectedFrames = inAppFrames.length > 0 ? inAppFrames : frames;

  return selectedFrames.slice(-limit).reverse().map((frame) => {
    const location = frame.filename ? `${frame.filename}:${frame.lineno || '?'}` : 'unknown';
    const fn = frame.function || '<anonymous>';
    return `  at ${fn} (${location})`;
  });
}

/**
 * Extract recent breadcrumbs
 */
function extractBreadcrumbs(
  breadcrumbEntry: { data: { values?: Array<{ message?: string; category?: string; timestamp?: number }> } } | undefined,
  limit = 5
): string[] {
  if (!breadcrumbEntry?.data?.values) return [];

  return breadcrumbEntry.data.values.slice(-limit).map((bc) => {
    const time = bc.timestamp ? new Date(bc.timestamp * 1000).toISOString().slice(11, 19) : '??:??:??';
    return `  [${time}] ${bc.category || 'default'}: ${bc.message || '(no message)'}`;
  });
}

/**
 * Generate error hash for similarity tracking
 */
export async function generateErrorHash(errorType: string, errorMessage: string, culprit: string): Promise<string> {
  const input = `${errorType}:${errorMessage}:${culprit}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Format a Sentry issue into a Dev Hub ticket payload
 */
export function formatTicketPayload(
  issue: SentryIssue,
  event: SentryEvent | undefined,
  routing: RoutingResult,
  allowlistedTags: string[]
): TicketPayload {
  const errorType = issue.metadata.type || issue.type || 'Error';
  const errorMessage = issue.metadata.value || issue.title;
  const environment = event?.environment || 'unknown';
  const release = event?.release || 'unknown';

  // Get exception and breadcrumb entries
  const exceptionEntry = event?.entries?.find((e) => e.type === 'exception') as
    | { data: { values?: Array<{ stacktrace?: { frames?: Array<unknown> } }> } }
    | undefined;
  const breadcrumbEntry = event?.entries?.find((e) => e.type === 'breadcrumbs') as
    | { data: { values?: Array<{ message?: string; category?: string; timestamp?: number }> } }
    | undefined;

  // Build stack trace section
  const stackFrames = extractStackFrames(exceptionEntry);
  const stackSection = stackFrames.length > 0
    ? `**Stack Trace (top ${stackFrames.length}):**\n\`\`\`\n${stackFrames.join('\n')}\n\`\`\``
    : '';

  // Build breadcrumbs section
  const breadcrumbs = extractBreadcrumbs(breadcrumbEntry);
  const breadcrumbSection = breadcrumbs.length > 0
    ? `**Recent Breadcrumbs:**\n\`\`\`\n${breadcrumbs.join('\n')}\n\`\`\``
    : '';

  // Filter and format tags
  const filteredTags = filterTags(event?.tags, allowlistedTags);
  const tagsSection = filteredTags.length > 0
    ? `**Tags:** ${filteredTags.map((t) => `\`${t.key}=${t.value}\``).join(', ')}`
    : '';

  // Correlation IDs
  const traceId = event?.contexts?.trace?.trace_id || 'N/A';
  const tenantId = filteredTags.find((t) => t.key === 'org_id')?.value || 'N/A';
  const dealId = filteredTags.find((t) => t.key === 'deal_id')?.value || 'N/A';

  // Sentry link
  const sentryLink = `https://sentry.io/issues/${issue.id}/`;

  // Build runbook section
  const runbookSection = routing.runbookUrls?.length
    ? `**Attached Resources:**\n${routing.runbookUrls.map((url) => `- ${url}`).join('\n')}`
    : '';

  // Build description (compact, high-signal)
  const descriptionParts = [
    `**Error:** \`${redactSensitiveData(errorType)}\``,
    `**Message:** ${redactSensitiveData(errorMessage).slice(0, 200)}`,
    `**Location:** \`${redactSensitiveData(issue.culprit).slice(0, 100)}\``,
    `**Environment:** ${environment} | **Release:** ${release}`,
    `**First Seen:** ${issue.firstSeen} | **Count:** ${issue.count || 1}`,
    '',
    stackSection,
    breadcrumbSection,
    tagsSection,
    '',
    `**Correlation IDs:**`,
    `- Sentry Issue: [${issue.shortId}](${sentryLink})`,
    `- Trace ID: \`${traceId}\``,
    `- Tenant ID: \`${tenantId}\``,
    `- Deal ID: \`${dealId}\``,
    '',
    runbookSection,
  ].filter(Boolean);

  // Truncate description to 2000 chars
  let description = descriptionParts.join('\n');
  if (description.length > 2000) {
    description = description.slice(0, 1997) + '...';
  }

  // AI context (IDs only for efficiency)
  const aiContext = JSON.stringify({
    sentry_issue_id: issue.id,
    sentry_short_id: issue.shortId,
    sentry_project: issue.project.slug,
    trace_id: traceId,
    error_type: errorType,
    culprit: issue.culprit,
    environment,
    release,
    first_seen: issue.firstSeen,
    count: issue.count || 1,
  });

  // AI prompt (short, actionable)
  const aiPrompt = `Investigate Sentry error ${issue.shortId}: "${errorType}" in ${issue.culprit}. Error occurred ${issue.count || 1} times since ${issue.firstSeen}. Check trace ${traceId} for distributed context.`;

  // Due date: 3 days from now
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3);

  return {
    title: `[${issue.shortId}] ${redactSensitiveData(issue.title).slice(0, 120)}`,
    description,
    projectId: routing.projectId,
    type: 'bug',
    status: 'todo',
    priority: routing.priority,
    dueDate: dueDate.toISOString(),
    aiContext,
    aiGeneratedPrompt: aiPrompt,
  };
}

// ============================================================================
// Routing Engine
// ============================================================================

/**
 * Match a Sentry issue against routing rules
 */
export function matchRoutingRules(
  issue: SentryIssue,
  event: SentryEvent | undefined,
  rules: RoutingRule[]
): RoutingResult | null {
  // Sort by priority (lower = higher priority)
  const sortedRules = [...rules].filter((r) => r.enabled).sort((a, b) => a.priority - b.priority);

  for (const rule of sortedRules) {
    if (ruleMatches(issue, event, rule)) {
      return {
        projectId: rule.target_dev_hub_project_id,
        ownerId: rule.target_owner_user_id,
        priority: rule.target_priority,
        matchedRuleId: rule.id,
        matchedRuleName: rule.name,
        runbookUrls: rule.attach_runbook_urls,
        labels: rule.additional_labels,
        slackChannel: rule.notify_slack_channel,
        isTestMode: rule.test_mode,
      };
    }
  }

  return null;
}

/**
 * Check if a rule matches an issue
 */
function ruleMatches(issue: SentryIssue, event: SentryEvent | undefined, rule: RoutingRule): boolean {
  // Match project
  if (rule.match_sentry_project && issue.project.slug !== rule.match_sentry_project) {
    return false;
  }

  // Match error type (regex)
  if (rule.match_error_type) {
    const errorType = issue.metadata.type || issue.type || '';
    if (!new RegExp(rule.match_error_type, 'i').test(errorType)) {
      return false;
    }
  }

  // Match error message (regex)
  if (rule.match_error_message) {
    const errorMessage = issue.metadata.value || issue.title || '';
    if (!new RegExp(rule.match_error_message, 'i').test(errorMessage)) {
      return false;
    }
  }

  // Match culprit (regex)
  if (rule.match_culprit) {
    if (!new RegExp(rule.match_culprit, 'i').test(issue.culprit || '')) {
      return false;
    }
  }

  // Match environment
  if (rule.match_environment && event?.environment !== rule.match_environment) {
    return false;
  }

  // Match release pattern
  if (rule.match_release_pattern && event?.release) {
    if (!new RegExp(rule.match_release_pattern, 'i').test(event.release)) {
      return false;
    }
  }

  // Match tags
  if (rule.match_tags && event?.tags) {
    const tagMap = new Map(event.tags.map((t) => [t.key, t.value]));
    for (const [key, value] of Object.entries(rule.match_tags)) {
      if (tagMap.get(key) !== value) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Get default routing from config
 */
export function getDefaultRouting(config: BridgeConfig): RoutingResult | null {
  if (!config.default_dev_hub_project_id) {
    return null;
  }

  return {
    projectId: config.default_dev_hub_project_id,
    ownerId: config.default_owner_user_id,
    priority: config.default_priority,
    isTestMode: false,
  };
}

// ============================================================================
// Signature Verification
// ============================================================================

/**
 * Verify the Use60 proxy signature
 */
export async function verifyUse60Signature(
  secret: string,
  timestamp: string,
  signature: string,
  body: string
): Promise<boolean> {
  // signature format: v1=<hmac>
  const sigParts = signature.split('=');
  if (sigParts.length !== 2 || sigParts[0] !== 'v1') {
    return false;
  }

  const providedSig = sigParts[1];
  const signedPayload = `v1:${timestamp}:${body}`;
  const expectedSig = await hmacSha256Hex(secret, signedPayload);

  return timingSafeEqual(providedSig, expectedSig);
}

/**
 * Check if timestamp is within acceptable range (5 minutes)
 */
export function isTimestampValid(timestamp: string): boolean {
  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - ts) < 300;
}
