/**
 * Meeting Intelligence Types
 *
 * Types for enhanced meeting intelligence features:
 * - Structured summaries
 * - Rep coaching scorecards
 * - Deal risk signals
 * - Aggregated insights
 */

// ============================================================================
// Structured Meeting Summaries
// ============================================================================

export interface KeyDecision {
  decision: string;
  context: string;
  importance: 'high' | 'medium' | 'low';
}

export interface Commitment {
  commitment: string;
  due_date?: string;
  priority?: 'high' | 'medium' | 'low';
  expectation?: string;
}

export interface StakeholderMention {
  name: string;
  role?: string;
  concerns: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface PricingDiscussion {
  mentioned: boolean;
  amount?: number;
  structure?: string;
  objections?: string[];
  notes?: string;
}

export interface TechnicalRequirement {
  requirement: string;
  priority: 'high' | 'medium' | 'low';
  notes?: string;
}

export interface OutcomeSignals {
  overall: 'positive' | 'negative' | 'neutral';
  positive_signals: string[];
  negative_signals: string[];
  next_steps: string[];
  forward_movement: boolean;
}

export interface StageIndicators {
  detected_stage: MeetingType;
  confidence: number; // 0-1
  signals: string[];
}

export interface CompetitorMention {
  name: string;
  context: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface Objection {
  objection: string;
  response?: string;
  resolved: boolean;
  category?: string;
}

export interface MeetingStructuredSummary {
  id: string;
  meeting_id: string;
  org_id: string;
  key_decisions: KeyDecision[];
  rep_commitments: Commitment[];
  prospect_commitments: Commitment[];
  stakeholders_mentioned: StakeholderMention[];
  pricing_discussed: PricingDiscussion;
  technical_requirements: TechnicalRequirement[];
  outcome_signals: OutcomeSignals;
  stage_indicators: StageIndicators;
  competitor_mentions: CompetitorMention[];
  objections: Objection[];
  ai_model_used?: string;
  tokens_used?: number;
  processing_time_ms?: number;
  version: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Rep Coaching Scorecards
// ============================================================================

export type MeetingType = 'discovery' | 'demo' | 'negotiation' | 'closing' | 'follow_up' | 'general';

export interface MetricConfig {
  id: string;
  name: string;
  weight: number;
  enabled: boolean;
  ideal_range?: {
    min: number;
    max: number;
  };
  description?: string;
}

export interface ChecklistItem {
  id: string;
  question: string;
  required: boolean;
  category?: string;
  order: number;
}

export interface ScriptStep {
  step_number: number;
  step_name: string;
  expected_topics: string[];
  required: boolean;
  max_duration_minutes?: number;
}

export interface CoachingScorecardTemplate {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  meeting_type: MeetingType;
  metrics: MetricConfig[];
  checklist_items: ChecklistItem[];
  script_flow: ScriptStep[];
  passing_score: number;
  excellence_score: number;
  is_active: boolean;
  is_default: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type ScorecardGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface MetricScore {
  score: number;
  raw_value: number | string | boolean;
  feedback?: string;
  weight: number;
}

export interface MonologueInstance {
  start_seconds: number;
  duration_seconds: number;
  transcript_snippet: string;
}

export interface ChecklistResult {
  covered: boolean;
  timestamp_seconds?: number;
  quote?: string;
  notes?: string;
}

export interface ScriptFlowAnalysis {
  steps_covered: string[];
  steps_missed: string[];
  order_followed: boolean;
  deviations: string[];
}

export interface KeyMoment {
  timestamp_seconds: number;
  type: 'positive' | 'negative' | 'coaching';
  description: string;
  quote?: string;
}

export interface MeetingScorecard {
  id: string;
  meeting_id: string;
  template_id?: string;
  org_id: string;
  rep_user_id: string;
  overall_score: number;
  grade: ScorecardGrade;
  metric_scores: Record<string, MetricScore>;
  talk_time_rep_pct: number;
  talk_time_customer_pct: number;
  discovery_questions_count: number;
  discovery_questions_examples: string[];
  next_steps_established: boolean;
  next_steps_details?: string;
  monologue_instances: MonologueInstance[];
  monologue_count: number;
  checklist_results: Record<string, ChecklistResult>;
  checklist_completion_pct: number;
  checklist_required_completion_pct: number;
  script_adherence_score?: number;
  script_flow_analysis: ScriptFlowAnalysis;
  strengths: string[];
  areas_for_improvement: string[];
  specific_feedback?: string;
  coaching_tips: string[];
  key_moments: KeyMoment[];
  detected_meeting_type?: MeetingType;
  ai_model_used?: string;
  tokens_used?: number;
  processing_time_ms?: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Deal Risk Signals
// ============================================================================

export type RiskSignalType =
  | 'timeline_slip'
  | 'budget_concern'
  | 'competitor_mention'
  | 'champion_silent'
  | 'sentiment_decline'
  | 'stalled_deal'
  | 'objection_unresolved'
  | 'stakeholder_concern'
  | 'scope_creep'
  | 'decision_delay';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface RiskEvidence {
  meeting_ids: string[];
  quotes: string[];
  dates: string[];
  context?: string;
}

export interface DealRiskSignal {
  id: string;
  deal_id: string;
  org_id: string;
  signal_type: RiskSignalType;
  severity: RiskSeverity;
  title: string;
  description: string;
  evidence: RiskEvidence;
  source_meeting_id?: string;
  confidence_score: number;
  is_resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  resolution_action?: string;
  auto_dismissed: boolean;
  dismissed_reason?: string;
  detected_at: string;
  created_at: string;
  updated_at: string;
}

export type SentimentTrend = 'improving' | 'stable' | 'declining' | 'unknown';
export type MeetingFrequencyTrend = 'increasing' | 'stable' | 'decreasing' | 'unknown';

export interface RecommendedAction {
  action: string;
  priority: 'high' | 'medium' | 'low';
  rationale: string;
  suggested_by?: string;
}

export interface DealRiskAggregate {
  id: string;
  deal_id: string;
  org_id: string;
  overall_risk_level: RiskSeverity;
  risk_score: number;
  active_signals_count: number;
  critical_signals_count: number;
  high_signals_count: number;
  medium_signals_count: number;
  low_signals_count: number;
  signal_breakdown: Record<RiskSignalType, number>;
  sentiment_trend: SentimentTrend;
  avg_sentiment_last_3_meetings?: number;
  sentiment_change_pct?: number;
  days_since_last_meeting?: number;
  days_since_champion_contact?: number;
  meeting_frequency_trend: MeetingFrequencyTrend;
  last_forward_movement_at?: string;
  days_without_forward_movement?: number;
  recommended_actions: RecommendedAction[];
  risk_summary?: string;
  last_calculated_at: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Aggregated Call Insights
// ============================================================================

export type MeetingOutcome = 'positive' | 'neutral' | 'negative' | 'unknown';

export interface MeetingClassification {
  id: string;
  meeting_id: string;
  org_id: string;
  has_forward_movement: boolean;
  has_proposal_request: boolean;
  has_pricing_discussion: boolean;
  has_competitor_mention: boolean;
  has_objection: boolean;
  has_demo_request: boolean;
  has_timeline_discussion: boolean;
  has_budget_discussion: boolean;
  has_decision_maker: boolean;
  has_next_steps: boolean;
  outcome: MeetingOutcome;
  detected_stage?: MeetingType;
  topics: Array<{ topic: string; confidence: number; mentions: number }>;
  objections: Objection[];
  competitors: CompetitorMention[];
  keywords: string[];
  objection_count: number;
  competitor_mention_count: number;
  positive_signal_count: number;
  negative_signal_count: number;
  created_at: string;
  updated_at: string;
}

export type PeriodType = 'day' | 'week' | 'month' | 'quarter';

export interface RepBreakdown {
  user_id: string;
  meeting_count: number;
  avg_score?: number;
  forward_movement_rate: number;
}

export interface TopObjection {
  objection: string;
  count: number;
  resolution_rate: number;
}

export interface TopCompetitor {
  name: string;
  count: number;
}

export interface MeetingAggregateMetrics {
  id: string;
  org_id: string;
  period_type: PeriodType;
  period_start: string;
  period_end: string;
  total_meetings: number;
  meetings_with_transcripts: number;
  meetings_analyzed: number;
  positive_sentiment_count: number;
  neutral_sentiment_count: number;
  negative_sentiment_count: number;
  avg_sentiment_score?: number;
  positive_outcome_count: number;
  neutral_outcome_count: number;
  negative_outcome_count: number;
  forward_movement_count: number;
  proposal_request_count: number;
  demo_request_count: number;
  next_steps_established_count: number;
  pricing_discussion_count: number;
  competitor_mention_count: number;
  timeline_discussion_count: number;
  budget_discussion_count: number;
  objection_count: number;
  top_objections: TopObjection[];
  top_competitors: TopCompetitor[];
  avg_rep_talk_time?: number;
  avg_customer_talk_time?: number;
  avg_scorecard_score?: number;
  avg_discovery_questions?: number;
  next_steps_rate?: number;
  stage_breakdown: Record<MeetingType, number>;
  rep_breakdown: RepBreakdown[];
  meetings_change_pct?: number;
  forward_movement_change_pct?: number;
  sentiment_change_pct?: number;
  last_calculated_at: string;
  created_at: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ProcessStructuredSummaryRequest {
  meetingId: string;
  forceReprocess?: boolean;
}

export interface ProcessStructuredSummaryResponse {
  success: boolean;
  summary?: MeetingStructuredSummary;
  error?: string;
}

export interface GenerateScorecardRequest {
  meetingId: string;
  templateId?: string;
}

export interface GenerateScorecardResponse {
  success: boolean;
  scorecard?: MeetingScorecard;
  error?: string;
}

export interface AnalyzeRiskSignalsRequest {
  meetingId?: string;
  dealId?: string;
}

export interface AnalyzeRiskSignalsResponse {
  success: boolean;
  signals?: DealRiskSignal[];
  aggregate?: DealRiskAggregate;
  error?: string;
}

export type ClassificationFilterType =
  | 'forward_movement'
  | 'proposal_request'
  | 'competitor'
  | 'pricing'
  | 'objection'
  | 'demo_request'
  | 'positive'
  | 'negative'
  | 'next_steps';

export interface AggregateInsightsFilter {
  has_forward_movement?: boolean;
  has_proposal_request?: boolean;
  has_pricing_discussion?: boolean;
  has_competitor_mention?: boolean;
  has_objection?: boolean;
  sentiment?: 'positive' | 'negative' | 'neutral';
  date_from?: string;
  date_to?: string;
  owner_user_id?: string;
}

export interface AggregateInsightsQueryRequest {
  query_type: 'count' | 'list' | 'stats' | 'natural_language';
  filter?: AggregateInsightsFilter;
  natural_query?: string;
  response_format?: 'json' | 'markdown' | 'slack';
  limit?: number;
}

export interface MeetingListItem {
  meeting_id: string;
  meeting_title: string;
  meeting_date: string;
  owner_user_id: string;
  owner_name?: string;
  company_name?: string;
  outcome?: MeetingOutcome;
  topics?: Array<{ topic: string; confidence: number }>;
  objections?: Objection[];
  competitors?: CompetitorMention[];
}

export interface AggregateInsightsCountResponse {
  total_meetings: number;
  forward_movement_count: number;
  proposal_request_count: number;
  pricing_discussion_count: number;
  competitor_mention_count: number;
  objection_count: number;
  demo_request_count: number;
  positive_outcome_count: number;
  negative_outcome_count: number;
  next_steps_count: number;
}

export interface AggregateInsightsQueryResponse {
  success: boolean;
  query_type: string;
  counts?: AggregateInsightsCountResponse;
  meetings?: MeetingListItem[];
  stats?: MeetingAggregateMetrics;
  natural_response?: string;
  error?: string;
}

// ============================================================================
// Default Scorecard Templates
// ============================================================================

export const DEFAULT_METRICS: MetricConfig[] = [
  {
    id: 'talk_ratio',
    name: 'Talk-to-Listen Ratio',
    weight: 25,
    enabled: true,
    ideal_range: { min: 30, max: 45 },
    description: 'Percentage of time rep speaks vs prospect (ideal: 30-45%)',
  },
  {
    id: 'discovery_questions',
    name: 'Discovery Questions',
    weight: 25,
    enabled: true,
    ideal_range: { min: 5, max: 15 },
    description: 'Number of open-ended questions asked',
  },
  {
    id: 'next_steps',
    name: 'Next Steps Established',
    weight: 25,
    enabled: true,
    description: 'Whether clear next steps were agreed upon',
  },
  {
    id: 'monologue_detection',
    name: 'Monologue Avoidance',
    weight: 25,
    enabled: true,
    ideal_range: { min: 0, max: 2 },
    description: 'Number of times rep spoke for over 60 seconds',
  },
];

export const DEFAULT_DISCOVERY_CHECKLIST: ChecklistItem[] = [
  { id: 'pain_points', question: 'Asked about current pain points/challenges', required: true, category: 'discovery', order: 1 },
  { id: 'decision_makers', question: 'Identified decision makers', required: true, category: 'discovery', order: 2 },
  { id: 'budget', question: 'Discussed budget/timeline', required: false, category: 'qualification', order: 3 },
  { id: 'success_criteria', question: 'Uncovered success criteria', required: false, category: 'discovery', order: 4 },
  { id: 'competitors', question: 'Asked about alternatives considered', required: false, category: 'competitive', order: 5 },
];

export const DEFAULT_DEMO_CHECKLIST: ChecklistItem[] = [
  { id: 'confirm_attendees', question: 'Confirmed attendees and roles', required: true, category: 'setup', order: 1 },
  { id: 'recap_pain', question: 'Recapped pain points from discovery', required: true, category: 'context', order: 2 },
  { id: 'tailored_demo', question: 'Tailored demo to stated pain points', required: true, category: 'demo', order: 3 },
  { id: 'feedback', question: 'Asked for feedback during demo', required: false, category: 'engagement', order: 4 },
  { id: 'objections', question: 'Addressed questions/objections', required: false, category: 'handling', order: 5 },
  { id: 'next_steps', question: 'Established clear next steps', required: true, category: 'close', order: 6 },
];

export const DEFAULT_NEGOTIATION_CHECKLIST: ChecklistItem[] = [
  { id: 'decision_process', question: 'Confirmed decision process', required: true, category: 'process', order: 1 },
  { id: 'concerns', question: 'Addressed outstanding concerns', required: true, category: 'objections', order: 2 },
  { id: 'pricing', question: 'Discussed pricing/terms', required: true, category: 'commercial', order: 3 },
  { id: 'blockers', question: 'Identified blockers to signing', required: true, category: 'risk', order: 4 },
  { id: 'timeline', question: 'Agreed on timeline to close', required: true, category: 'close', order: 5 },
];

export const DEFAULT_CLOSING_CHECKLIST: ChecklistItem[] = [
  { id: 'final_objections', question: 'Final objection handling', required: true, category: 'objections', order: 1 },
  { id: 'terms_confirmed', question: 'Contract terms confirmed', required: true, category: 'commercial', order: 2 },
  { id: 'implementation', question: 'Implementation timeline set', required: true, category: 'onboarding', order: 3 },
  { id: 'signoff', question: 'Stakeholder sign-off confirmed', required: true, category: 'approval', order: 4 },
  { id: 'onboarding', question: 'Onboarding next steps defined', required: true, category: 'onboarding', order: 5 },
];

// ============================================================================
// Risk Signal Configuration
// ============================================================================

export interface RiskSignalConfig {
  type: RiskSignalType;
  name: string;
  patterns: string[];
  base_severity: RiskSeverity;
  late_stage_multiplier?: number;
  requires_unresolved?: boolean;
  engagement_threshold_days?: number;
}

export const RISK_SIGNAL_CONFIGS: RiskSignalConfig[] = [
  {
    type: 'timeline_slip',
    name: 'Timeline Slipping',
    patterns: ['timeline pushed', 'delayed', 'postpone', 'next quarter', 'not until', 'pushed back', 'defer'],
    base_severity: 'medium',
  },
  {
    type: 'budget_concern',
    name: 'Budget Concerns',
    patterns: ['budget', 'expensive', 'cost concern', 'price too high', 'ROI', 'afford', 'cut backs'],
    base_severity: 'high',
    requires_unresolved: true,
  },
  {
    type: 'competitor_mention',
    name: 'Competitor Mentioned',
    patterns: ['competitor', 'alternative', 'also looking at', 'comparing', 'other vendors', 'evaluating'],
    base_severity: 'medium',
    late_stage_multiplier: 1.5,
  },
  {
    type: 'champion_silent',
    name: 'Champion Gone Silent',
    patterns: [],
    base_severity: 'high',
    engagement_threshold_days: 14,
  },
  {
    type: 'sentiment_decline',
    name: 'Sentiment Declining',
    patterns: [],
    base_severity: 'high',
  },
  {
    type: 'stalled_deal',
    name: 'Deal Stalled',
    patterns: [],
    base_severity: 'critical',
  },
  {
    type: 'objection_unresolved',
    name: 'Unresolved Objection',
    patterns: [],
    base_severity: 'medium',
    requires_unresolved: true,
  },
  {
    type: 'stakeholder_concern',
    name: 'New Stakeholder Concerns',
    patterns: ['boss', 'manager', 'leadership', 'board', 'CFO', 'CTO', 'CEO', 'concerns from'],
    base_severity: 'medium',
  },
  {
    type: 'scope_creep',
    name: 'Scope Creep',
    patterns: ['also need', 'additionally', 'expand scope', 'more features', 'requirement changed'],
    base_severity: 'medium',
  },
  {
    type: 'decision_delay',
    name: 'Decision Delayed',
    patterns: ['decision pushed', 'need more time', 'revisit later', 'not ready to decide', 'hold off'],
    base_severity: 'high',
  },
];
