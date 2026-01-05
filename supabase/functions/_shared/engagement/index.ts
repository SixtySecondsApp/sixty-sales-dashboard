/**
 * Smart Engagement Algorithm - Shared Module
 *
 * Provides engagement scoring, optimal timing, and frequency limiting
 * for intelligent notification delivery.
 */

// Configuration
export { ENGAGEMENT_CONFIG, SEGMENT_NOTIFICATION_PRIORITY, SEGMENT_CHANNEL_PREFERENCES } from "./config.ts";

// Types
export type {
  UserMetrics,
  ComputedScores,
  UserSegment,
  NotificationFrequency,
  NotificationPriority,
  NotificationChannel,
  ActivityEvent,
  NotificationInteraction,
  QueuedNotification,
  SendTimeWindow,
  FrequencyLimitResult,
  OptimalSendTimeResult,
} from "./types.ts";

// Metrics computation
export {
  calculateAppEngagementScore,
  calculateSlackEngagementScore,
  calculateNotificationEngagementScore,
  calculateOverallEngagementScore,
  determineUserSegment,
  calculateActivityPatterns,
  calculateSessionMetrics,
  calculateNotificationFatigue,
  checkShouldRequestFeedback,
  getFatigueLevel,
  computeEngagementScores,
} from "./metrics.ts";

// Optimal timing
export {
  calculateOptimalSendTime,
  isWithinActiveWindow,
  getNextActiveWindowStart,
  calculateReengagementDelay,
  shouldBatchNotification,
} from "./timing.ts";

// Frequency limiting
export {
  checkFrequencyLimit,
  getNotificationCounts,
  getRemainingBudget,
  recommendFrequencyAdjustment,
  calculateNextSlotDelay,
  shouldDowngradePriority,
} from "./frequency.ts";

// Feedback loop
export {
  shouldRequestFeedback,
  buildFeedbackRequestBlocks,
  buildPerNotificationFeedbackButtons,
  buildInlineFeedbackOverflow,
  calculatePreferenceUpdate,
  adjustFatigueFromNotificationFeedback,
  calculateEngagementAdjustment,
  buildFeedbackConfirmationBlocks,
  FEEDBACK_RESPONSES,
  PER_NOTIFICATION_RESPONSES,
} from "./feedback.ts";

export type {
  FeedbackCheckResult,
  FeedbackPreferenceUpdate,
  FrequencyFeedback,
  NotificationFeedback,
} from "./feedback.ts";

// Segmentation
export {
  SEGMENT_TRANSITIONS,
  REENGAGEMENT_TRIGGERS,
  getDaysSinceLastActivity,
  isEligibleForReengagement,
  isEngagementDeclining,
  getSuggestedTrigger,
  calculateReengagementPriority,
  getSegmentCooldownMultiplier,
  isValidSegmentTransition,
  getMessageTone,
  getPreferredReengagementChannel,
} from "./segmentation.ts";

export type {
  SegmentTransition,
  ReengagementCandidate,
  ReengagementContent,
} from "./segmentation.ts";

// Re-engagement
export {
  REENGAGEMENT_TYPES,
  buildReengagementSlackBlocks,
  buildReengagementEmailContent,
  selectReengagementType,
  isValidReengagementType,
  getReengagementChannel,
} from "./reengagement.ts";

export type {
  ReengagementType,
  ReengagementConfig,
  ReengagementContext,
} from "./reengagement.ts";
