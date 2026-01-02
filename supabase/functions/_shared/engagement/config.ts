/**
 * Configuration for the Smart Engagement Algorithm
 */

export const ENGAGEMENT_CONFIG = {
  // Scoring weights for overall engagement
  weights: {
    app_activity: 0.35,
    slack_activity: 0.30,
    notification_engagement: 0.35,
  },

  // Segment thresholds
  segments: {
    power_user: { min_score: 80, min_sessions_per_day: 3 },
    regular: { min_score: 50, min_sessions_per_week: 3 },
    casual: { min_score: 25, min_sessions_per_week: 1 },
    at_risk: { max_score: 25, max_days_inactive: 7 },
    dormant: { max_days_inactive: 14 },
    churned: { max_days_inactive: 30 },
  },

  // Notification frequency thresholds by preference
  notification_thresholds: {
    high: { max_per_hour: 4, max_per_day: 15 },
    moderate: { max_per_hour: 2, max_per_day: 8 },
    low: { max_per_hour: 1, max_per_day: 3 },
  },

  // Priority-based overrides (can exceed normal limits)
  priority_overrides: {
    urgent: { allow_exceed: true, cooldown_minutes: 5 },
    high: { allow_exceed: false, cooldown_minutes: 15 },
    normal: { allow_exceed: false, cooldown_minutes: 30 },
    low: { allow_exceed: false, cooldown_minutes: 60 },
  },

  // Feedback timing: every 2 weeks (14 days)
  feedback_interval_days: 14,
  min_notifications_before_feedback: 10,

  // Time windows for analysis
  analysis_windows: {
    recent_activity_days: 7,
    notification_analysis_days: 30,
    session_analysis_days: 14,
  },

  // Optimal send time configuration
  timing: {
    // Default business hours (if no user data)
    default_hours: {
      start: 9, // 9 AM
      end: 18, // 6 PM
    },
    // Weekend adjustment (reduce by this factor)
    weekend_factor: 0.7,
    // Minimum confidence to use calculated time
    min_confidence: 0.3,
    // How many hours to look ahead for optimal time
    lookahead_hours: 4,
    // Penalty for sending during low-activity hours
    off_peak_penalty: 0.4,
  },

  // Fatigue thresholds
  fatigue: {
    // Fatigue score thresholds
    low: 20,
    moderate: 40,
    high: 60,
    critical: 80,
    // Cooldown adjustments based on fatigue
    cooldown_multipliers: {
      low: 1.0,
      moderate: 1.5,
      high: 2.0,
      critical: 3.0,
    },
  },

  // Queue processing
  queue: {
    batch_size: 50,
    max_retries: 3,
    retry_delay_minutes: 5,
    stale_threshold_minutes: 60,
  },
} as const;

// Segment priority for notification delivery
export const SEGMENT_NOTIFICATION_PRIORITY: Record<string, number> = {
  power_user: 1.0, // Full notifications
  regular: 0.9,
  casual: 0.7,
  at_risk: 0.5, // Reduced to prevent further disengagement
  dormant: 0.3, // Only re-engagement notifications
  churned: 0.1, // Minimal, high-value only
};

// Channel preferences by segment
export const SEGMENT_CHANNEL_PREFERENCES: Record<string, string[]> = {
  power_user: ["slack_dm", "in_app", "email"],
  regular: ["slack_dm", "email", "in_app"],
  casual: ["email", "slack_dm"],
  at_risk: ["email"], // Less intrusive
  dormant: ["email"],
  churned: ["email"],
};
