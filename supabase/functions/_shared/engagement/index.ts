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
