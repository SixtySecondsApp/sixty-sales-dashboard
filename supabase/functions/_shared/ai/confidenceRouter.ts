/**
 * AI Confidence Router - Phase 6: Smart AI & Engagement
 *
 * Routes AI recommendations based on confidence levels:
 * - High confidence (80+) → Auto-execute (if allowed) or approve button
 * - Medium confidence (50-79) → HITL required with edit option
 * - Low confidence (<50) → Clarifying questions or reject
 */

import type {
  AIRecommendation,
  ConfidenceRouting,
  RoutingFactor,
  ActionType,
  ConfidenceLevel,
  ContextDossier,
  UserAIPreferences,
  ClarifyingQuestion,
} from './types.ts';
import { CONFIDENCE_THRESHOLDS, DEFAULT_ROUTING_CONFIG } from './types.ts';

interface RoutingOptions {
  force_hitl?: boolean;
  allow_auto_execute?: boolean;
  user_preferences?: UserAIPreferences;
}

/**
 * Determine routing for an AI recommendation
 */
export function routeRecommendation(
  recommendation: AIRecommendation,
  context: ContextDossier,
  options: RoutingOptions = {}
): ConfidenceRouting {
  const { force_hitl = false, allow_auto_execute = true, user_preferences } = options;
  const factors: RoutingFactor[] = [];

  // Start with base confidence
  let adjustedConfidence = recommendation.confidence;

  // Factor 1: Context quality adjustment
  const contextQualityFactor = calculateContextQualityFactor(context.context_quality);
  adjustedConfidence += contextQualityFactor.adjustment;
  factors.push({
    factor: 'context_quality',
    weight: 0.2,
    value: context.context_quality,
    impact: contextQualityFactor.adjustment >= 0 ? 'positive' : 'negative',
  });

  // Factor 2: User approval history
  if (user_preferences) {
    const historyFactor = calculateHistoryFactor(user_preferences, recommendation.action_type);
    adjustedConfidence += historyFactor.adjustment;
    factors.push({
      factor: 'approval_history',
      weight: DEFAULT_ROUTING_CONFIG.approval_history_weight,
      value: user_preferences.approval_rate,
      impact: historyFactor.adjustment >= 0 ? 'positive' : 'negative',
    });
  }

  // Factor 3: Action type risk level
  const riskFactor = calculateActionRiskFactor(recommendation.action_type);
  factors.push({
    factor: 'action_risk_level',
    weight: 0.15,
    value: riskFactor.risk_score,
    impact: riskFactor.risk_score > 50 ? 'negative' : 'positive',
  });

  // Factor 4: Deal value consideration (for external communications)
  if (context.deal && isExternalCommunication(recommendation.action_type)) {
    const dealValueFactor = calculateDealValueFactor(context.deal.value);
    factors.push({
      factor: 'deal_value',
      weight: 0.1,
      value: context.deal.value,
      impact: dealValueFactor.requires_extra_care ? 'negative' : 'neutral',
    });
    if (dealValueFactor.requires_extra_care) {
      adjustedConfidence -= 10;
    }
  }

  // Factor 5: Urgency level
  const urgencyFactor = calculateUrgencyFactor(context.timing.urgency_level);
  factors.push({
    factor: 'urgency_level',
    weight: 0.1,
    value: urgencyFactor.score,
    impact: urgencyFactor.impact,
  });

  // Clamp confidence to valid range
  adjustedConfidence = Math.max(0, Math.min(100, adjustedConfidence));

  // Determine confidence level
  const confidenceLevel = getConfidenceLevel(adjustedConfidence);

  // Determine routing
  const route = determineRoute({
    action_type: recommendation.action_type,
    confidence: adjustedConfidence,
    confidence_level: confidenceLevel,
    force_hitl,
    allow_auto_execute,
    user_preferences,
    context_quality: context.context_quality,
  });

  // Generate clarifying questions if needed
  let clarifyingQuestions: ClarifyingQuestion[] | null = null;
  if (route === 'clarify' || confidenceLevel === 'low') {
    clarifyingQuestions = generateClarifyingQuestions(context, recommendation);
  }

  return {
    action_type: recommendation.action_type,
    confidence: adjustedConfidence,
    confidence_level: confidenceLevel,
    route,
    routing_factors: factors,
    clarifying_questions: clarifyingQuestions,
  };
}

/**
 * Calculate confidence level from numeric score
 */
export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (confidence >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/**
 * Calculate context quality factor
 */
function calculateContextQualityFactor(contextQuality: number): { adjustment: number } {
  // Context quality below 50% penalizes confidence
  if (contextQuality < 30) {
    return { adjustment: -15 };
  }
  if (contextQuality < 50) {
    return { adjustment: -10 };
  }
  if (contextQuality >= 80) {
    return { adjustment: 5 };
  }
  return { adjustment: 0 };
}

/**
 * Calculate history factor based on user's past approvals
 */
function calculateHistoryFactor(
  prefs: UserAIPreferences,
  actionType: ActionType
): { adjustment: number } {
  // Need at least 10 suggestions for history to matter
  if (prefs.total_suggestions < 10) {
    return { adjustment: 0 };
  }

  // High approval rate boosts confidence
  if (prefs.approval_rate > 0.8) {
    return { adjustment: 10 };
  }

  // High rejection rate reduces confidence
  if (prefs.rejection_rate > 0.3) {
    return { adjustment: -15 };
  }

  // High edit rate suggests medium adjustment
  if (prefs.edit_rate > 0.4) {
    return { adjustment: -5 };
  }

  return { adjustment: 0 };
}

/**
 * Calculate action risk factor
 */
function calculateActionRiskFactor(actionType: ActionType): { risk_score: number } {
  const riskScores: Record<ActionType, number> = {
    send_email: 80,
    send_slack_message: 70,
    schedule_meeting: 60,
    update_deal: 40,
    create_task: 20,
    log_activity: 10,
    draft_follow_up: 30,
  };

  return { risk_score: riskScores[actionType] || 50 };
}

/**
 * Calculate deal value factor
 */
function calculateDealValueFactor(dealValue: number): { requires_extra_care: boolean } {
  // High-value deals require extra care
  return { requires_extra_care: dealValue > 100000 };
}

/**
 * Calculate urgency factor
 */
function calculateUrgencyFactor(
  urgency: string
): { score: number; impact: 'positive' | 'negative' | 'neutral' } {
  const urgencyScores: Record<string, { score: number; impact: 'positive' | 'negative' | 'neutral' }> = {
    immediate: { score: 100, impact: 'positive' }, // Boost for urgent items
    today: { score: 75, impact: 'positive' },
    this_week: { score: 50, impact: 'neutral' },
    flexible: { score: 25, impact: 'neutral' },
  };

  return urgencyScores[urgency] || { score: 50, impact: 'neutral' };
}

/**
 * Check if action is external communication
 */
function isExternalCommunication(actionType: ActionType): boolean {
  return ['send_email', 'send_slack_message', 'schedule_meeting'].includes(actionType);
}

/**
 * Determine final routing
 */
function determineRoute(params: {
  action_type: ActionType;
  confidence: number;
  confidence_level: ConfidenceLevel;
  force_hitl: boolean;
  allow_auto_execute: boolean;
  user_preferences?: UserAIPreferences;
  context_quality: number;
}): 'auto_execute' | 'hitl_approve' | 'hitl_edit' | 'clarify' {
  const {
    action_type,
    confidence,
    confidence_level,
    force_hitl,
    allow_auto_execute,
    user_preferences,
    context_quality,
  } = params;

  // Always HITL for certain actions
  if (DEFAULT_ROUTING_CONFIG.always_hitl_actions.includes(action_type)) {
    return confidence_level === 'low' ? 'hitl_edit' : 'hitl_approve';
  }

  // Force HITL if requested
  if (force_hitl) {
    return 'hitl_approve';
  }

  // User preference overrides
  if (user_preferences) {
    if (user_preferences.always_hitl_actions.includes(action_type)) {
      return 'hitl_approve';
    }
    if (user_preferences.never_auto_send && isExternalCommunication(action_type)) {
      return 'hitl_approve';
    }
  }

  // Low confidence or low context quality → clarify or edit
  if (confidence_level === 'low' || context_quality < 30) {
    return 'clarify';
  }

  // Medium confidence → HITL with edit option
  if (confidence_level === 'medium') {
    return 'hitl_edit';
  }

  // High confidence + auto-executable action + allowed → auto execute
  if (
    confidence_level === 'high' &&
    allow_auto_execute &&
    DEFAULT_ROUTING_CONFIG.auto_executable_actions.includes(action_type) &&
    confidence >= DEFAULT_ROUTING_CONFIG.min_confidence_for_auto
  ) {
    // Check user threshold
    const userThreshold = user_preferences?.auto_approve_threshold || DEFAULT_ROUTING_CONFIG.min_confidence_for_auto;
    if (confidence >= userThreshold) {
      return 'auto_execute';
    }
  }

  // Default to HITL approve
  return 'hitl_approve';
}

/**
 * Generate clarifying questions for low-confidence scenarios
 */
function generateClarifyingQuestions(
  context: ContextDossier,
  recommendation: AIRecommendation
): ClarifyingQuestion[] {
  const questions: ClarifyingQuestion[] = [];

  // Missing contact context
  if (!context.contact) {
    questions.push({
      question: 'Who should this be for?',
      options: ['Search contacts', 'Enter email manually', 'Skip contact'],
      required: true,
      context_field: 'contact',
    });
  }

  // Missing deal context for deal-related actions
  if (!context.deal && ['update_deal', 'log_activity'].includes(recommendation.action_type)) {
    questions.push({
      question: 'Which deal is this related to?',
      options: ['Search deals', 'No deal', 'Create new deal'],
      required: recommendation.action_type === 'update_deal',
      context_field: 'deal',
    });
  }

  // Ambiguous tone for external communications
  if (isExternalCommunication(recommendation.action_type)) {
    if (!context.user.preferences.preferred_tone) {
      questions.push({
        question: 'What tone should we use?',
        options: ['Professional', 'Friendly', 'Casual', 'Formal'],
        required: false,
        context_field: 'tone',
      });
    }
  }

  // Urgency clarification for tasks
  if (recommendation.action_type === 'create_task') {
    questions.push({
      question: 'When should this be done?',
      options: ['Today', 'This week', 'Next week', 'No deadline'],
      required: false,
      context_field: 'due_date',
    });
  }

  return questions.slice(0, 3); // Max 3 questions
}

/**
 * Determine primary CTA based on routing
 */
export function getPrimaryCTA(routing: ConfidenceRouting): string {
  switch (routing.route) {
    case 'auto_execute':
      return 'Sending...';
    case 'hitl_approve':
      return routing.confidence_level === 'high' ? 'Send Now' : 'Approve';
    case 'hitl_edit':
      return 'Review & Edit';
    case 'clarify':
      return 'Help Me Decide';
    default:
      return 'Review';
  }
}

/**
 * Determine secondary CTAs based on routing
 */
export function getSecondaryCTAs(routing: ConfidenceRouting): string[] {
  const ctas: string[] = [];

  if (routing.route !== 'auto_execute') {
    ctas.push('Edit');
    ctas.push('Reject');
  }

  if (routing.route === 'hitl_approve') {
    ctas.push('Schedule for later');
  }

  return ctas;
}

/**
 * Build Slack blocks for confidence display
 */
export function buildConfidenceIndicator(routing: ConfidenceRouting): {
  emoji: string;
  text: string;
  color: string;
} {
  switch (routing.confidence_level) {
    case 'high':
      return {
        emoji: ':white_check_mark:',
        text: `High confidence (${Math.round(routing.confidence)}%)`,
        color: '#36a64f', // Green
      };
    case 'medium':
      return {
        emoji: ':large_yellow_circle:',
        text: `Medium confidence (${Math.round(routing.confidence)}%) - Review recommended`,
        color: '#daa038', // Yellow
      };
    case 'low':
      return {
        emoji: ':warning:',
        text: `Low confidence (${Math.round(routing.confidence)}%) - Needs your input`,
        color: '#cc4444', // Red
      };
  }
}
