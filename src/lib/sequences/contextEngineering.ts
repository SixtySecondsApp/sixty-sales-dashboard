/**
 * Context Engineering Types & Interfaces
 *
 * Core interfaces for agent sequences following the Context Engineering principles:
 * 1. Compaction: Pointers, Not Payloads - Store full data externally, pass references
 * 2. Isolation: Results, Not Context Dumps - Skills return contracts, not reasoning chains
 * 3. Offloading: Hierarchical Action Space - Level 1/2 tool routing
 * 4. Mutable State: Update state object, don't append history
 * 5. Cache-Friendly: Stable prefix + dynamic suffix
 *
 * @see docs/agent-sequences-architecture.md
 */

// =============================================================================
// SKILL RESULT CONTRACT
// =============================================================================

/**
 * Standard result contract returned by every skill.
 * Skills return this contract - no exceptions.
 *
 * Key principles:
 * - summary: Human-readable (<100 words)
 * - data: Machine-readable structured output
 * - references: Pointers to full payloads stored externally
 */
export interface SkillResult {
  /** Execution status */
  status: 'success' | 'partial' | 'failed';

  /** Error message (only if status !== 'success') */
  error?: string;

  /** Human-readable summary (<100 words) */
  summary: string;

  /** Machine-readable structured output */
  data: Record<string, unknown>;

  /** Pointers to full payloads stored externally */
  references: Reference[];

  /** Optional hints for orchestrator */
  hints?: SkillHints;

  /** Execution metadata */
  meta: SkillMeta;
}

/**
 * Reference to externally stored data
 * Follows compaction principle: pointers, not payloads
 */
export interface Reference {
  /** Type of referenced content */
  type:
    | 'transcript'
    | 'enrichment'
    | 'draft'
    | 'analysis'
    | 'raw_response'
    | 'image'
    | 'document';

  /** Storage location (s3://bucket/path or internal ref) */
  location: string;

  /** Optional preview/summary */
  summary?: string;

  /** Size in bytes */
  size_bytes?: number;

  /** Content type (mime type) */
  content_type?: string;
}

/**
 * Hints for the orchestrator to make intelligent decisions
 */
export interface SkillHints {
  /** Suggested next skills to execute */
  suggested_next_skills?: string[];

  /** Confidence score (0-1) */
  confidence?: number;

  /** Flags for special handling */
  flags?: SkillFlag[];
}

/** Skill execution flags */
export type SkillFlag =
  | 'needs_human_review'
  | 'high_value'
  | 'risk_detected'
  | 'competitor_mentioned'
  | 'budget_discussed'
  | 'timeline_mentioned'
  | 'champion_identified'
  | 'blocker_identified'
  | 'expansion_opportunity';

/**
 * Skill execution metadata
 */
export interface SkillMeta {
  /** Skill identifier */
  skill_id: string;

  /** Skill version */
  skill_version: string;

  /** Execution time in milliseconds */
  execution_time_ms: number;

  /** Tokens used (if applicable) */
  tokens_used?: number;

  /** Model used for execution */
  model?: string;

  /** Sources used (for web search skills) */
  sources?: Array<{ title?: string; uri?: string }>;
}

// =============================================================================
// SEQUENCE STATE
// =============================================================================

/**
 * Mutable state object maintained throughout sequence execution.
 * Gets UPDATED, not appended - following context engineering principles.
 */
export interface SequenceState {
  /** Sequence identity */
  sequence_id: string;
  sequence_type: SequenceType;
  instance_id: string; // Unique execution ID

  /** Trigger context */
  trigger: SequenceTrigger;

  /** Execution tracking */
  execution: ExecutionTracking;

  /** Accumulated state (compact summaries, not full payloads) */
  context: SequenceContext;

  /** Human-in-the-loop state */
  approval: ApprovalState;

  /** Outputs ready for delivery */
  outputs: SequenceOutputs;

  /** Token budget tracking */
  token_budget: TokenBudget;
}

/** Types of agent sequences */
export type SequenceType =
  | 'post_meeting_intelligence'
  | 'daily_pipeline_pulse'
  | 'pre_meeting_prep'
  | 'stalled_deal_revival'
  | 'prospect_to_campaign'
  | 'inbound_qualification'
  | 'champion_job_change'
  | 'event_follow_up'
  | 'custom';

/**
 * Trigger information for the sequence
 */
export interface SequenceTrigger {
  /** Trigger type */
  type: string;

  /** When triggered (ISO 8601) */
  timestamp: string;

  /** Source of trigger */
  source: string;

  /** Trigger parameters */
  params: Record<string, unknown>;
}

/**
 * Execution tracking for the sequence
 */
export interface ExecutionTracking {
  /** When execution started (ISO 8601) */
  started_at: string;

  /** Current step index */
  current_step: number;

  /** Total number of steps */
  total_steps: number;

  /** Completed skill IDs */
  completed_skills: string[];

  /** Pending skill IDs */
  pending_skills: string[];

  /** Failed skills with error info */
  failed_skills: FailedSkill[];
}

/**
 * Information about a failed skill
 */
export interface FailedSkill {
  skill_id: string;
  error: string;
  recoverable: boolean;
  attempted_at: string;
}

/**
 * Accumulated context during sequence execution
 * Contains compact summaries, not full payloads
 */
export interface SequenceContext {
  /** Entities involved */
  entities: {
    contacts: ContactSummary[];
    companies: CompanySummary[];
    deals: DealSummary[];
  };

  /** Key findings from skills */
  findings: {
    key_facts: string[]; // Max 10 bullet points
    action_items: ActionItem[];
    risks: Risk[];
    opportunities: Opportunity[];
  };

  /** References to full data */
  references: Reference[];
}

/**
 * Compact contact summary for context
 */
export interface ContactSummary {
  id: string;
  name: string;
  role: string;
  company: string;
  stance?: 'champion' | 'neutral' | 'blocker' | 'unknown';
  last_contact?: string;
}

/**
 * Compact company summary for context
 */
export interface CompanySummary {
  id: string;
  name: string;
  size: number;
  industry: string;
  icp_score: number;
  key_signals: string[];
}

/**
 * Compact deal summary for context
 */
export interface DealSummary {
  id: string;
  name: string;
  value: number;
  stage: string;
  days_in_stage: number;
  health: 'on_track' | 'at_risk' | 'stalled';
}

/**
 * Action item identified during sequence
 */
export interface ActionItem {
  task: string;
  owner: 'internal' | 'prospect';
  due: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'completed' | 'blocked';
}

/**
 * Risk identified during sequence
 */
export interface Risk {
  type: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  mitigation?: string;
}

/**
 * Opportunity identified during sequence
 */
export interface Opportunity {
  type: string;
  description: string;
  potential_value?: number;
}

/**
 * Human-in-the-loop approval state
 */
export interface ApprovalState {
  required: boolean;
  status: 'not_required' | 'pending' | 'approved' | 'rejected' | 'modified';
  requested_at?: string;
  responded_at?: string;
  channel?: 'slack' | 'email' | 'app';
  modifications?: string;
}

/**
 * Outputs ready for delivery
 */
export interface SequenceOutputs {
  drafts: DraftOutput[];
  notifications: NotificationOutput[];
  crm_updates: CRMUpdate[];
  tasks_created: TaskOutput[];
}

export interface DraftOutput {
  type: 'email' | 'linkedin' | 'slack' | 'call_script';
  reference: string;
  summary: string;
  status: 'draft' | 'approved' | 'sent';
}

export interface NotificationOutput {
  channel: 'slack' | 'email';
  recipient: string;
  message_ref: string;
  status: 'pending' | 'sent' | 'failed';
}

export interface CRMUpdate {
  entity_type: 'contact' | 'company' | 'deal' | 'activity';
  entity_id: string;
  fields_updated: string[];
  status: 'pending' | 'applied' | 'failed';
}

export interface TaskOutput {
  id: string;
  title: string;
  due_date: string;
  assigned_to: string;
  crm_task_id?: string;
}

// =============================================================================
// TOKEN BUDGET TRACKING
// =============================================================================

/**
 * Token budget tracking per the context engineering guidelines
 *
 * Target budgets:
 * - System prompt (stable): ~2,000 tokens (cached)
 * - Sequence state object: ~500 tokens
 * - Current skill context: ~1,000 tokens
 * - Skill result: ~300 tokens
 * - Per-step total: ~3,800 tokens ceiling
 */
export interface TokenBudget {
  /** System prompt tokens (stable, cached) */
  system_prompt: number;

  /** Current sequence state tokens */
  state_tokens: number;

  /** Accumulated skill result tokens */
  skill_result_tokens: number;

  /** Total tokens used this execution */
  total_used: number;

  /** Budget ceiling per step */
  per_step_ceiling: number;

  /** Whether we're over budget */
  over_budget: boolean;

  /** Warnings if approaching limits */
  warnings: string[];
}

/** Default token budget limits */
export const TOKEN_BUDGET_DEFAULTS: TokenBudget = {
  system_prompt: 2000,
  state_tokens: 0,
  skill_result_tokens: 0,
  total_used: 0,
  per_step_ceiling: 3800,
  over_budget: false,
  warnings: [],
};

// =============================================================================
// ORCHESTRATOR TOOLS (LEVEL 1)
// =============================================================================

/**
 * Level 1 tools available to the orchestrator
 * These abstract away the complexity of individual API calls
 */
export type OrchestratorTool =
  | 'research'
  | 'enrich'
  | 'draft'
  | 'crm_action'
  | 'notify'
  | 'execute';

/**
 * Research tool parameters
 */
export interface ResearchParams {
  target: string;
  depth: 'quick' | 'standard' | 'deep';
  focus_areas?: string[];
}

/**
 * Enrich tool parameters
 */
export interface EnrichParams {
  entity_type: 'contact' | 'company';
  identifier: string;
  sources?: string[];
}

/**
 * Draft tool parameters
 */
export interface DraftParams {
  type: 'email' | 'linkedin' | 'slack' | 'call_script';
  context: DraftContext;
}

export interface DraftContext {
  recipient?: ContactSummary;
  company?: CompanySummary;
  deal?: DealSummary;
  purpose: string;
  tone?: 'formal' | 'casual' | 'consultative';
  key_points?: string[];
  previous_conversation_summary?: string;
}

/**
 * CRM action tool parameters
 */
export interface CRMActionParams {
  action: 'read' | 'update' | 'create';
  entity_type: 'contact' | 'company' | 'deal' | 'activity' | 'task';
  entity_id?: string;
  data?: Record<string, unknown>;
}

/**
 * Notify tool parameters
 */
export interface NotifyParams {
  channel: 'slack' | 'email';
  recipient: string;
  message: string;
  blocks?: unknown[]; // Slack blocks
  priority?: 'high' | 'normal' | 'low';
}

/**
 * Execute tool parameters (for approved actions)
 */
export interface ExecuteParams {
  action_type: 'send_email' | 'send_linkedin' | 'create_task' | 'book_meeting' | 'start_campaign';
  params: Record<string, unknown>;
  approval_id?: string;
}

// =============================================================================
// LEVEL 2 INTERNAL ROUTING (Hidden from orchestrator)
// =============================================================================

/**
 * Internal skill routing map
 * The orchestrator doesn't see these - they're resolved internally
 */
export const SKILL_ROUTING: Record<OrchestratorTool, string[]> = {
  research: [
    'apollo_company_search',
    'apollo_contact_search',
    'apify_linkedin_profile',
    'apify_linkedin_posts',
    'apify_linkedin_job_changes',
    'gemini_news_search',
    'gemini_company_analysis',
  ],
  enrich: ['apollo_enrichment', 'gemini_enrichment', 'reoon_email_validation'],
  draft: ['copywriter_email', 'copywriter_linkedin', 'copywriter_slack', 'copywriter_call_script'],
  crm_action: ['hubspot_read', 'hubspot_write', 'bullhorn_read', 'bullhorn_write'],
  notify: ['slack_blocks_sender', 'email_notification'],
  execute: [
    'email_sender',
    'linkedin_sender',
    'instantly_campaign',
    'crm_task_creator',
    'calendar_booker',
  ],
};

// =============================================================================
// CONTEXT ENGINEERING RULES
// =============================================================================

/**
 * Context Engineering Rules
 * These rules ensure sequences follow best practices
 */
export const CONTEXT_ENGINEERING_RULES = {
  /** Maximum key facts to keep in context */
  MAX_KEY_FACTS: 10,

  /** Maximum action items to track */
  MAX_ACTION_ITEMS: 10,

  /** Maximum risks to track */
  MAX_RISKS: 5,

  /** Maximum opportunities to track */
  MAX_OPPORTUNITIES: 5,

  /** Maximum summary length in words */
  MAX_SUMMARY_WORDS: 100,

  /** Token budget per component */
  TOKEN_BUDGETS: {
    system_prompt: 2000,
    sequence_state: 500,
    skill_context: 1000,
    skill_result: 300,
    per_step_ceiling: 3800,
  },

  /** Compaction triggers */
  COMPACT_WHEN: {
    /** Compact when total tokens exceed this */
    total_tokens_exceed: 5000,

    /** Compact when key facts exceed this */
    key_facts_exceed: 10,

    /** Compact when references exceed this count */
    references_exceed: 20,
  },
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create an empty SequenceState for a new sequence execution
 */
export function createInitialSequenceState(
  sequenceId: string,
  sequenceType: SequenceType,
  trigger: SequenceTrigger
): SequenceState {
  const instanceId = `${sequenceType}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  return {
    sequence_id: sequenceId,
    sequence_type: sequenceType,
    instance_id: instanceId,
    trigger,
    execution: {
      started_at: new Date().toISOString(),
      current_step: 0,
      total_steps: 0,
      completed_skills: [],
      pending_skills: [],
      failed_skills: [],
    },
    context: {
      entities: {
        contacts: [],
        companies: [],
        deals: [],
      },
      findings: {
        key_facts: [],
        action_items: [],
        risks: [],
        opportunities: [],
      },
      references: [],
    },
    approval: {
      required: false,
      status: 'not_required',
    },
    outputs: {
      drafts: [],
      notifications: [],
      crm_updates: [],
      tasks_created: [],
    },
    token_budget: { ...TOKEN_BUDGET_DEFAULTS },
  };
}

/**
 * Create a successful SkillResult
 */
export function createSkillResult(
  skillId: string,
  summary: string,
  data: Record<string, unknown>,
  options?: {
    references?: Reference[];
    hints?: SkillHints;
    executionTimeMs?: number;
    tokensUsed?: number;
    model?: string;
  }
): SkillResult {
  return {
    status: 'success',
    summary,
    data,
    references: options?.references || [],
    hints: options?.hints,
    meta: {
      skill_id: skillId,
      skill_version: '1.0.0',
      execution_time_ms: options?.executionTimeMs || 0,
      tokens_used: options?.tokensUsed,
      model: options?.model,
    },
  };
}

/**
 * Create a failed SkillResult
 */
export function createFailedSkillResult(
  skillId: string,
  error: string,
  options?: {
    executionTimeMs?: number;
    partialData?: Record<string, unknown>;
  }
): SkillResult {
  return {
    status: options?.partialData ? 'partial' : 'failed',
    error,
    summary: `Skill ${skillId} failed: ${error}`,
    data: options?.partialData || {},
    references: [],
    meta: {
      skill_id: skillId,
      skill_version: '1.0.0',
      execution_time_ms: options?.executionTimeMs || 0,
    },
  };
}

/**
 * Estimate token count for a string or object
 * Uses rough approximation: ~4 chars per token
 */
export function estimateTokens(content: unknown): number {
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  return Math.ceil(str.length / 4);
}

/**
 * Validate that a SkillResult follows the contract
 */
export function validateSkillResult(result: unknown): result is SkillResult {
  if (!result || typeof result !== 'object') return false;

  const r = result as Record<string, unknown>;

  // Required fields
  if (!['success', 'partial', 'failed'].includes(r.status as string)) return false;
  if (typeof r.summary !== 'string') return false;
  if (typeof r.data !== 'object') return false;
  if (!Array.isArray(r.references)) return false;
  if (!r.meta || typeof r.meta !== 'object') return false;

  // Validate meta
  const meta = r.meta as Record<string, unknown>;
  if (typeof meta.skill_id !== 'string') return false;
  if (typeof meta.skill_version !== 'string') return false;
  if (typeof meta.execution_time_ms !== 'number') return false;

  return true;
}

/**
 * Compact a summary to fit within word limits
 */
export function compactSummary(summary: string, maxWords: number = 100): string {
  const words = summary.split(/\s+/);
  if (words.length <= maxWords) return summary;

  return words.slice(0, maxWords).join(' ') + '...';
}
