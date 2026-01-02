/**
 * AI System Types - Phase 6: Smart AI & Engagement
 *
 * Types for retrieval-first context building, confidence-based routing,
 * and AI learning loop.
 */

// ============================================================================
// Context Building Types
// ============================================================================

export interface ContactContext {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  role: string | null;
  last_contacted: string | null;
  total_meetings: number;
  relationship_score: number | null;
  objections: string[];
  interests: string[];
  communication_style: string | null;
}

export interface DealContext {
  id: string;
  name: string;
  company: string | null;
  value: number;
  stage: string;
  probability: number | null;
  expected_close: string | null;
  days_in_stage: number;
  is_at_risk: boolean;
  stakeholders: ContactContext[];
  recent_activities: ActivityContext[];
  objections_raised: string[];
  next_steps: string[];
}

export interface MeetingContext {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  attendees: ContactContext[];
  related_deal: DealContext | null;
  previous_meetings: MeetingSummary[];
  agenda_items: string[];
  prep_notes: string | null;
}

export interface MeetingSummary {
  id: string;
  date: string;
  title: string;
  key_points: string[];
  action_items: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | null;
}

export interface ActivityContext {
  id: string;
  type: string;
  description: string;
  created_at: string;
  outcome: string | null;
}

export interface EmailContext {
  thread_id: string | null;
  subject: string | null;
  last_message_at: string | null;
  message_count: number;
  sentiment_trend: 'warming' | 'neutral' | 'cooling' | null;
}

/**
 * Complete context dossier for AI generation
 */
export interface ContextDossier {
  // Core entities
  contact: ContactContext | null;
  deal: DealContext | null;
  meeting: MeetingContext | null;

  // Relationship context
  email_history: EmailContext | null;

  // User context
  user: {
    id: string;
    name: string;
    role: string | null;
    org_id: string;
    preferences: UserAIPreferences;
  };

  // Organizational context
  org: {
    id: string;
    name: string;
    industry: string | null;
    tone_guidelines: string | null;
  };

  // Temporal context
  timing: {
    current_time: string;
    timezone: string;
    is_business_hours: boolean;
    urgency_level: 'immediate' | 'today' | 'this_week' | 'flexible';
  };

  // Metadata
  context_quality: number; // 0-100 completeness score
  context_sources: string[];
  generated_at: string;
}

// ============================================================================
// AI Action & Confidence Types
// ============================================================================

export type ActionType =
  | 'send_email'
  | 'draft_follow_up'
  | 'create_task'
  | 'log_activity'
  | 'update_deal'
  | 'schedule_meeting'
  | 'send_slack_message';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface AIRecommendation {
  action_type: ActionType;
  confidence: number; // 0-100
  confidence_level: ConfidenceLevel;

  // Action details
  title: string;
  description: string;
  draft_content: string | null;

  // Reasoning
  why: string;
  supporting_evidence: string[];

  // Related tasks
  suggested_tasks: SuggestedTask[];

  // Routing decision
  requires_hitl: boolean;
  auto_execute: boolean;

  // UI hints
  primary_cta: string;
  secondary_ctas: string[];
}

export interface SuggestedTask {
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'high' | 'medium' | 'low';
  related_entity_type: 'contact' | 'deal' | 'meeting' | null;
  related_entity_id: string | null;
}

export interface AIResponse {
  recommendations: AIRecommendation[];
  context_used: ContextDossier;
  clarifying_questions: ClarifyingQuestion[] | null;
  processing_time_ms: number;
  model_version: string;
}

export interface ClarifyingQuestion {
  question: string;
  options: string[];
  required: boolean;
  context_field: string; // Which field this would clarify
}

// ============================================================================
// Learning Loop Types
// ============================================================================

export type FeedbackAction = 'approved' | 'edited' | 'rejected' | 'ignored';

export interface AIFeedback {
  id: string;
  suggestion_id: string;
  user_id: string;
  org_id: string;

  // What happened
  action: FeedbackAction;

  // For edits, what changed
  original_content: string | null;
  edited_content: string | null;
  edit_delta: EditDelta | null;

  // Context at time of feedback
  action_type: ActionType;
  confidence_at_generation: number;
  context_quality_at_generation: number;

  // Outcome tracking
  outcome_measured: boolean;
  outcome_positive: boolean | null;
  outcome_type: string | null; // 'reply_received', 'meeting_booked', 'task_completed', etc.

  // Timing
  created_at: string;
  time_to_decision_seconds: number | null;
}

export interface EditDelta {
  // Tone changes
  tone_shift: 'more_formal' | 'more_casual' | 'same' | null;

  // Length changes
  length_change: 'shorter' | 'longer' | 'same';
  length_delta_percent: number;

  // Content changes
  added_cta: boolean;
  removed_cta: boolean;
  changed_subject: boolean;
  added_personalization: boolean;
  removed_personalization: boolean;

  // Structural changes
  added_bullet_points: boolean;
  simplified_language: boolean;
}

export interface UserAIPreferences {
  // Learned from feedback
  preferred_tone: 'formal' | 'professional' | 'casual' | 'friendly' | null;
  preferred_length: 'concise' | 'standard' | 'detailed' | null;
  prefers_ctas: boolean | null;
  prefers_bullet_points: boolean | null;

  // Explicit settings
  auto_approve_threshold: number; // Confidence level for auto-approval
  always_hitl_actions: ActionType[];
  never_auto_send: boolean;

  // Engagement preferences
  notification_frequency: 'high' | 'moderate' | 'low';
  preferred_channels: string[];

  // Stats
  total_suggestions: number;
  approval_rate: number;
  edit_rate: number;
  rejection_rate: number;
  avg_time_to_decision_seconds: number;
}

export interface OrgAIPreferences {
  // Organizational tone
  brand_voice: string | null;
  tone_guidelines: string | null;

  // Compliance
  required_disclaimers: string[];
  blocked_phrases: string[];

  // Settings
  enable_auto_send: boolean;
  min_confidence_for_auto: number;
  require_manager_approval_above: number; // Deal value threshold

  // Aggregate stats
  total_suggestions: number;
  org_approval_rate: number;
  most_edited_action_types: ActionType[];
}

// ============================================================================
// Confidence Routing Types
// ============================================================================

export interface ConfidenceRouting {
  action_type: ActionType;
  confidence: number;
  confidence_level: ConfidenceLevel;

  // Routing decision
  route: 'auto_execute' | 'hitl_approve' | 'hitl_edit' | 'clarify';

  // Why this route
  routing_factors: RoutingFactor[];

  // If clarify, what to ask
  clarifying_questions: ClarifyingQuestion[] | null;
}

export interface RoutingFactor {
  factor: string;
  weight: number;
  value: number;
  impact: 'positive' | 'negative' | 'neutral';
}

export const CONFIDENCE_THRESHOLDS = {
  high: 80,
  medium: 50,
  low: 0,
} as const;

export const DEFAULT_ROUTING_CONFIG = {
  // Which actions can be auto-executed
  auto_executable_actions: ['log_activity', 'create_task'] as ActionType[],

  // Never auto-execute these
  always_hitl_actions: ['send_email', 'send_slack_message'] as ActionType[],

  // Minimum confidence for auto-execution
  min_confidence_for_auto: 85,

  // Confidence boost from user approval history
  approval_history_weight: 0.2,

  // Confidence penalty for low context quality
  low_context_penalty: 0.3,
} as const;
