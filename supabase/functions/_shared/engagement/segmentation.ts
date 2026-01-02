/**
 * User Segmentation - Smart Engagement Algorithm Phase 4
 *
 * Extended segmentation helpers for re-engagement logic,
 * including segment transitions, trends, and risk detection.
 */

import { ENGAGEMENT_CONFIG } from "./config.ts";
import type { UserMetrics, UserSegment } from "./types.ts";

/**
 * Segment transition rules - defines valid state transitions
 */
export const SEGMENT_TRANSITIONS: Record<UserSegment, UserSegment[]> = {
  power_user: ["regular", "at_risk"], // Can drop to regular or at_risk
  regular: ["power_user", "casual", "at_risk"], // Can improve or decline
  casual: ["regular", "at_risk", "dormant"], // Can improve or become inactive
  at_risk: ["casual", "regular", "dormant"], // Can recover or decline
  dormant: ["at_risk", "casual", "churned"], // Can wake up or churn
  churned: ["dormant"], // Can only come back to dormant first
};

/**
 * Re-engagement trigger configuration by segment
 */
export const REENGAGEMENT_TRIGGERS = {
  at_risk: {
    after_days: 5,
    max_attempts: 3,
    cooldown_days: 7,
    notification_types: ["value_reminder", "upcoming_meeting", "deal_update"],
  },
  dormant: {
    after_days: 3,
    max_attempts: 4,
    cooldown_days: 5,
    notification_types: ["gentle_nudge", "activity_summary", "upcoming_meeting"],
  },
  churned: {
    after_days: 14,
    max_attempts: 2,
    cooldown_days: 14,
    notification_types: ["win_back", "product_update", "champion_alert"],
  },
} as const;

export interface SegmentTransition {
  from: UserSegment;
  to: UserSegment;
  days_in_segment: number;
  trigger_event?: string;
}

export interface ReengagementCandidate {
  user_id: string;
  org_id: string;
  segment: UserSegment;
  days_inactive: number;
  reengagement_attempts: number;
  last_reengagement_at: string | null;
  suggested_trigger: string;
  suggested_content: ReengagementContent;
  priority: number; // 0-100
}

export interface ReengagementContent {
  type: string;
  subject: string;
  preview: string;
  context?: Record<string, unknown>;
}

/**
 * Calculate days since last activity
 */
export function getDaysSinceLastActivity(metrics: UserMetrics): number {
  const now = Date.now();
  const lastActive = Math.max(
    metrics.last_app_active_at
      ? new Date(metrics.last_app_active_at).getTime()
      : 0,
    metrics.last_slack_active_at
      ? new Date(metrics.last_slack_active_at).getTime()
      : 0
  );

  if (lastActive === 0) return 999; // Never active

  return Math.floor((now - lastActive) / (1000 * 60 * 60 * 24));
}

/**
 * Check if user is eligible for re-engagement
 */
export function isEligibleForReengagement(
  metrics: UserMetrics,
  reengagementAttempts: number,
  lastReengagementAt: string | null
): { eligible: boolean; reason: string } {
  const segment = metrics.user_segment;

  // Only at_risk, dormant, and churned are eligible
  if (!segment || !["at_risk", "dormant", "churned"].includes(segment)) {
    return { eligible: false, reason: "segment_not_eligible" };
  }

  const config = REENGAGEMENT_TRIGGERS[segment as keyof typeof REENGAGEMENT_TRIGGERS];
  if (!config) {
    return { eligible: false, reason: "no_config" };
  }

  // Check max attempts
  if (reengagementAttempts >= config.max_attempts) {
    return { eligible: false, reason: "max_attempts_reached" };
  }

  // Check cooldown
  if (lastReengagementAt) {
    const daysSinceLastAttempt =
      (Date.now() - new Date(lastReengagementAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastAttempt < config.cooldown_days) {
      return { eligible: false, reason: "cooldown_active" };
    }
  }

  // Check days inactive threshold
  const daysInactive = getDaysSinceLastActivity(metrics);
  const triggerDays = segment === "at_risk" ? 5 : segment === "dormant" ? 3 : 14;

  if (daysInactive < triggerDays) {
    return { eligible: false, reason: "not_inactive_long_enough" };
  }

  return { eligible: true, reason: "eligible" };
}

/**
 * Detect if user's engagement is declining (at_risk detection)
 */
export function isEngagementDeclining(
  currentScore: number,
  previousScore: number | null,
  scoreTrend: number[] | null
): boolean {
  // If no history, compare to current
  if (previousScore === null) return currentScore < 40;

  // Check for significant drop
  if (currentScore < previousScore - 15) return true;

  // Check for sustained decline
  if (scoreTrend && scoreTrend.length >= 3) {
    const isConsistentlyDecreasing = scoreTrend.every(
      (score, i) => i === 0 || score < scoreTrend[i - 1]
    );
    if (isConsistentlyDecreasing && scoreTrend[scoreTrend.length - 1] < 50) {
      return true;
    }
  }

  return false;
}

/**
 * Get the suggested re-engagement trigger type for a user
 */
export function getSuggestedTrigger(
  segment: UserSegment,
  availableContent: {
    hasUpcomingMeetings: boolean;
    hasDealUpdates: boolean;
    hasChampionChanges: boolean;
    hasNewEmails: boolean;
  }
): string {
  const config = REENGAGEMENT_TRIGGERS[segment as keyof typeof REENGAGEMENT_TRIGGERS];
  if (!config) return "gentle_nudge";

  // Prioritize content-driven triggers
  if (availableContent.hasUpcomingMeetings) return "upcoming_meeting";
  if (availableContent.hasDealUpdates) return "deal_update";
  if (availableContent.hasChampionChanges) return "champion_alert";
  if (availableContent.hasNewEmails) return "new_email_summary";

  // Fallback to segment-specific default
  return config.notification_types[0];
}

/**
 * Calculate re-engagement priority score (0-100)
 */
export function calculateReengagementPriority(
  metrics: UserMetrics,
  daysInactive: number,
  reengagementAttempts: number,
  hasContentTrigger: boolean
): number {
  let priority = 50;

  // Higher priority for users who were previously active
  const previousScore = metrics.overall_engagement_score || 50;
  if (previousScore > 70) priority += 15;
  else if (previousScore > 50) priority += 10;

  // Lower priority as more attempts are made
  priority -= reengagementAttempts * 10;

  // Boost for content-driven triggers
  if (hasContentTrigger) priority += 20;

  // Adjust based on days inactive
  if (daysInactive > 30) priority -= 10; // Likely churned
  else if (daysInactive > 14) priority -= 5; // Dormant
  else if (daysInactive < 7) priority += 5; // Just becoming at_risk

  return Math.max(0, Math.min(100, priority));
}

/**
 * Get segment-specific cooldown multiplier
 */
export function getSegmentCooldownMultiplier(segment: UserSegment): number {
  switch (segment) {
    case "power_user":
      return 0.5; // More frequent OK
    case "regular":
      return 1.0;
    case "casual":
      return 1.5;
    case "at_risk":
      return 2.0;
    case "dormant":
      return 2.5;
    case "churned":
      return 3.0;
    default:
      return 1.0;
  }
}

/**
 * Check if a segment transition is valid
 */
export function isValidSegmentTransition(
  fromSegment: UserSegment,
  toSegment: UserSegment
): boolean {
  const validTransitions = SEGMENT_TRANSITIONS[fromSegment];
  return validTransitions?.includes(toSegment) ?? false;
}

/**
 * Get the appropriate re-engagement message tone based on segment
 */
export function getMessageTone(segment: UserSegment): "friendly" | "value-focused" | "urgent" {
  switch (segment) {
    case "at_risk":
      return "value-focused";
    case "dormant":
      return "friendly";
    case "churned":
      return "value-focused";
    default:
      return "friendly";
  }
}

/**
 * Determine if we should use email vs Slack for re-engagement
 */
export function getPreferredReengagementChannel(
  segment: UserSegment,
  hasSlackConnected: boolean
): "email" | "slack_dm" {
  // Always prefer email for churned users (less intrusive)
  if (segment === "churned") return "email";

  // Dormant users - prefer email
  if (segment === "dormant") return "email";

  // At-risk with Slack - try Slack first
  if (segment === "at_risk" && hasSlackConnected) return "slack_dm";

  return "email";
}
