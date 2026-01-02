/**
 * Smart Engagement Algorithm - Feedback Module
 *
 * Handles bi-weekly feedback requests and per-notification feedback
 * to learn user preferences and adjust notification behavior.
 */

import { ENGAGEMENT_CONFIG } from "./config.ts";
import type { UserMetrics, NotificationFrequency } from "./types.ts";

// ============================================================================
// Types
// ============================================================================

export interface FeedbackCheckResult {
  shouldRequest: boolean;
  reason: string;
  daysSinceLastFeedback: number | null;
  notificationsSinceLastFeedback: number;
}

export interface FeedbackPreferenceUpdate {
  preferred_notification_frequency: NotificationFrequency;
  notification_fatigue_level: number;
  last_feedback_requested_at: string;
  notifications_since_last_feedback: number;
}

export type FrequencyFeedback = "more" | "just_right" | "less";
export type NotificationFeedback = "helpful" | "not_helpful";

// ============================================================================
// Feedback Request Logic
// ============================================================================

/**
 * Check if we should request feedback from the user
 */
export function shouldRequestFeedback(
  metrics: UserMetrics,
  now: Date = new Date()
): FeedbackCheckResult {
  const {
    last_feedback_requested_at,
    notifications_since_last_feedback,
  } = metrics;

  // Calculate days since last feedback
  let daysSinceLastFeedback: number | null = null;
  if (last_feedback_requested_at) {
    const lastFeedback = new Date(last_feedback_requested_at);
    daysSinceLastFeedback = Math.floor(
      (now.getTime() - lastFeedback.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  const notificationCount = notifications_since_last_feedback || 0;

  // Never requested feedback before and sent enough notifications
  if (
    daysSinceLastFeedback === null &&
    notificationCount >= ENGAGEMENT_CONFIG.min_notifications_before_feedback
  ) {
    return {
      shouldRequest: true,
      reason: "first_feedback_request",
      daysSinceLastFeedback,
      notificationsSinceLastFeedback: notificationCount,
    };
  }

  // Time-based check (every 14 days)
  if (
    daysSinceLastFeedback !== null &&
    daysSinceLastFeedback >= ENGAGEMENT_CONFIG.feedback_interval_days
  ) {
    return {
      shouldRequest: true,
      reason: "interval_elapsed",
      daysSinceLastFeedback,
      notificationsSinceLastFeedback: notificationCount,
    };
  }

  // High notification count (more than 2x the minimum threshold)
  if (notificationCount >= ENGAGEMENT_CONFIG.min_notifications_before_feedback * 2) {
    return {
      shouldRequest: true,
      reason: "high_notification_count",
      daysSinceLastFeedback,
      notificationsSinceLastFeedback: notificationCount,
    };
  }

  return {
    shouldRequest: false,
    reason: "not_due",
    daysSinceLastFeedback,
    notificationsSinceLastFeedback: notificationCount,
  };
}

// ============================================================================
// Slack Block Builders
// ============================================================================

/**
 * Build Slack blocks for bi-weekly feedback request
 */
export function buildFeedbackRequestBlocks(): Record<string, unknown>[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Hey! Just checking in - how are you finding the notifications from 60? :thinking_face:",
      },
    },
    {
      type: "actions",
      block_id: "notification_feedback_actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Want more", emoji: true },
          style: "primary",
          action_id: "notification_feedback_more",
          value: "more",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Just right", emoji: true },
          action_id: "notification_feedback_right",
          value: "just_right",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Too many", emoji: true },
          style: "danger",
          action_id: "notification_feedback_less",
          value: "less",
        },
      ],
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "_Your feedback helps me learn the right frequency for you_",
        },
      ],
    },
  ];
}

/**
 * Build subtle per-notification feedback buttons
 * These are added to individual notifications for quick feedback
 */
export function buildPerNotificationFeedbackButtons(
  notificationId: string
): Record<string, unknown> {
  return {
    type: "actions",
    block_id: `per_notif_feedback_${notificationId}`,
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: ":thumbsup:", emoji: true },
        action_id: "notification_helpful",
        value: JSON.stringify({ notification_id: notificationId, feedback: "helpful" }),
      },
      {
        type: "button",
        text: { type: "plain_text", text: ":thumbsdown:", emoji: true },
        action_id: "notification_not_helpful",
        value: JSON.stringify({ notification_id: notificationId, feedback: "not_helpful" }),
      },
    ],
  };
}

/**
 * Build minimal inline feedback using overflow menu
 * Less intrusive alternative to buttons
 */
export function buildInlineFeedbackOverflow(
  notificationId: string
): Record<string, unknown> {
  return {
    type: "overflow",
    action_id: "notification_overflow_feedback",
    options: [
      {
        text: { type: "plain_text", text: ":thumbsup: Helpful", emoji: true },
        value: JSON.stringify({ notification_id: notificationId, feedback: "helpful" }),
      },
      {
        text: { type: "plain_text", text: ":thumbsdown: Not helpful", emoji: true },
        value: JSON.stringify({ notification_id: notificationId, feedback: "not_helpful" }),
      },
      {
        text: { type: "plain_text", text: ":no_bell: Less like this", emoji: true },
        value: JSON.stringify({ notification_id: notificationId, feedback: "less_like_this" }),
      },
    ],
  };
}

// ============================================================================
// Preference Adjustment Logic
// ============================================================================

/**
 * Calculate new preferences based on frequency feedback
 */
export function calculatePreferenceUpdate(
  currentMetrics: UserMetrics,
  feedback: FrequencyFeedback
): FeedbackPreferenceUpdate {
  const now = new Date().toISOString();

  switch (feedback) {
    case "more":
      return {
        preferred_notification_frequency: "high",
        notification_fatigue_level: Math.max(0, (currentMetrics.notification_fatigue_level || 0) - 20),
        last_feedback_requested_at: now,
        notifications_since_last_feedback: 0,
      };

    case "less":
      return {
        preferred_notification_frequency: "low",
        notification_fatigue_level: Math.min(100, (currentMetrics.notification_fatigue_level || 0) + 30),
        last_feedback_requested_at: now,
        notifications_since_last_feedback: 0,
      };

    case "just_right":
    default:
      // Keep current frequency, but reset counters
      return {
        preferred_notification_frequency: currentMetrics.preferred_notification_frequency || "moderate",
        notification_fatigue_level: currentMetrics.notification_fatigue_level || 0,
        last_feedback_requested_at: now,
        notifications_since_last_feedback: 0,
      };
  }
}

/**
 * Adjust fatigue level based on per-notification feedback
 */
export function adjustFatigueFromNotificationFeedback(
  currentFatigue: number,
  feedback: NotificationFeedback
): number {
  switch (feedback) {
    case "helpful":
      // Reduce fatigue slightly when user finds notification helpful
      return Math.max(0, currentFatigue - 5);

    case "not_helpful":
      // Increase fatigue when notification wasn't helpful
      return Math.min(100, currentFatigue + 10);

    default:
      return currentFatigue;
  }
}

/**
 * Calculate notification engagement adjustment based on feedback pattern
 * Used to adjust the notification_engagement_score
 */
export function calculateEngagementAdjustment(
  recentFeedback: Array<{ feedback: string; timestamp: Date }>
): number {
  if (recentFeedback.length === 0) return 0;

  // Count positive vs negative feedback in recent history
  const positive = recentFeedback.filter(
    (f) => f.feedback === "helpful" || f.feedback === "just_right" || f.feedback === "more"
  ).length;
  const negative = recentFeedback.filter(
    (f) => f.feedback === "not_helpful" || f.feedback === "less" || f.feedback === "less_like_this"
  ).length;

  const total = positive + negative;
  if (total === 0) return 0;

  // Calculate adjustment: positive feedback increases score, negative decreases
  const positiveRatio = positive / total;

  // Scale to -10 to +10 adjustment
  return Math.round((positiveRatio - 0.5) * 20);
}

// ============================================================================
// Response Messages
// ============================================================================

export const FEEDBACK_RESPONSES: Record<FrequencyFeedback, { emoji: string; message: string }> = {
  more: {
    emoji: ":rocket:",
    message: "Got it! I'll send you more updates to keep you in the loop.",
  },
  just_right: {
    emoji: ":ok_hand:",
    message: "Perfect! I'll keep the current frequency.",
  },
  less: {
    emoji: ":zipper_mouth_face:",
    message: "Understood! I'll dial back the notifications and only share the essentials.",
  },
};

export const PER_NOTIFICATION_RESPONSES: Record<NotificationFeedback, string> = {
  helpful: "Thanks for the feedback! :thumbsup:",
  not_helpful: "Got it, I'll try to do better. :pray:",
};

// ============================================================================
// Confirmation Block Builder
// ============================================================================

/**
 * Build confirmation blocks after user provides feedback
 */
export function buildFeedbackConfirmationBlocks(
  feedback: FrequencyFeedback
): Record<string, unknown>[] {
  const response = FEEDBACK_RESPONSES[feedback];

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${response.emoji} ${response.message}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "_You can always change this in Settings → Notifications_",
        },
      ],
    },
  ];
}
