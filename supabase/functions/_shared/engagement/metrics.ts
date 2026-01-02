/**
 * Engagement metrics computation functions
 *
 * Calculates user engagement scores, segments, and activity patterns.
 */

import { ENGAGEMENT_CONFIG } from "./config.ts";
import type {
  UserMetrics,
  ComputedScores,
  UserSegment,
  ActivityEvent,
  NotificationInteraction,
} from "./types.ts";

/**
 * Calculate app engagement score (0-100) based on activity events
 */
export function calculateAppEngagementScore(
  events: ActivityEvent[],
  metrics: UserMetrics
): number {
  if (events.length === 0) {
    // Check if user was recently active
    if (metrics.last_app_active_at) {
      const daysSinceActive =
        (Date.now() - new Date(metrics.last_app_active_at).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysSinceActive < 1) return 60;
      if (daysSinceActive < 3) return 40;
      if (daysSinceActive < 7) return 20;
    }
    return 10;
  }

  const daysWithActivity = new Set(
    events.map((e) => e.event_at.split("T")[0])
  ).size;
  const totalEvents = events.length;
  const uniqueSessions = new Set(
    events.filter((e) => e.session_id).map((e) => e.session_id)
  ).size;

  // Score components
  const frequencyScore = Math.min(daysWithActivity / 7, 1) * 40; // Max 40 points for daily usage
  const intensityScore = Math.min(totalEvents / 50, 1) * 30; // Max 30 points for high activity
  const sessionScore = Math.min(uniqueSessions / 10, 1) * 30; // Max 30 points for multiple sessions

  return Math.round(frequencyScore + intensityScore + sessionScore);
}

/**
 * Calculate Slack engagement score (0-100) based on Slack activity
 */
export function calculateSlackEngagementScore(
  events: ActivityEvent[],
  metrics: UserMetrics
): number {
  if (events.length === 0) {
    if (metrics.last_slack_active_at) {
      const daysSinceActive =
        (Date.now() - new Date(metrics.last_slack_active_at).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysSinceActive < 1) return 50;
      if (daysSinceActive < 3) return 30;
      if (daysSinceActive < 7) return 15;
    }
    return 10;
  }

  const daysWithActivity = new Set(
    events.map((e) => e.event_at.split("T")[0])
  ).size;
  const totalEvents = events.length;

  // Score components
  const frequencyScore = Math.min(daysWithActivity / 7, 1) * 50; // Max 50 points for daily Slack usage
  const interactionScore = Math.min(totalEvents / 20, 1) * 50; // Max 50 points for button clicks

  return Math.round(frequencyScore + interactionScore);
}

/**
 * Calculate notification engagement score (0-100) based on click-through rates
 */
export function calculateNotificationEngagementScore(
  interactions: NotificationInteraction[]
): number {
  if (interactions.length === 0) return 50; // Neutral score if no notifications sent

  const totalNotifications = interactions.length;
  const clickedNotifications = interactions.filter((i) => i.clicked_at).length;
  const dismissedNotifications = interactions.filter(
    (i) => i.dismissed_at && !i.clicked_at
  ).length;

  // Calculate click-through rate
  const ctr =
    totalNotifications > 0 ? clickedNotifications / totalNotifications : 0;

  // Calculate average response time for clicked notifications
  const clickedWithTime = interactions.filter(
    (i) => i.clicked_at && i.time_to_interaction_seconds
  );
  const avgResponseTime =
    clickedWithTime.length > 0
      ? clickedWithTime.reduce(
          (sum, i) => sum + (i.time_to_interaction_seconds || 0),
          0
        ) / clickedWithTime.length
      : 3600; // Default to 1 hour if no data

  // Score components
  const ctrScore = ctr * 60; // Max 60 points for 100% CTR
  const responseTimeScore = Math.max(0, 25 - (avgResponseTime / 3600) * 25); // Max 25 points for quick responses
  const dismissalPenalty =
    (dismissedNotifications / Math.max(totalNotifications, 1)) * 15; // Up to 15 point penalty

  return Math.round(
    Math.max(0, Math.min(100, ctrScore + responseTimeScore - dismissalPenalty + 15))
  ); // Base 15 points
}

/**
 * Calculate overall engagement score (weighted average)
 */
export function calculateOverallEngagementScore(
  appScore: number,
  slackScore: number,
  notificationScore: number
): number {
  const { weights } = ENGAGEMENT_CONFIG;
  return Math.round(
    appScore * weights.app_activity +
      slackScore * weights.slack_activity +
      notificationScore * weights.notification_engagement
  );
}

/**
 * Determine user segment based on engagement and activity
 */
export function determineUserSegment(
  overallScore: number,
  metrics: UserMetrics,
  events: ActivityEvent[]
): UserSegment {
  const now = Date.now();
  const lastActive = Math.max(
    metrics.last_app_active_at
      ? new Date(metrics.last_app_active_at).getTime()
      : 0,
    metrics.last_slack_active_at
      ? new Date(metrics.last_slack_active_at).getTime()
      : 0
  );

  const daysSinceActive = (now - lastActive) / (1000 * 60 * 60 * 24);
  const { segments } = ENGAGEMENT_CONFIG;

  // Check for churned first (30+ days inactive)
  if (daysSinceActive >= segments.churned.max_days_inactive) {
    return "churned";
  }

  // Check for dormant (14+ days inactive)
  if (daysSinceActive >= segments.dormant.max_days_inactive) {
    return "dormant";
  }

  // Check for at_risk (7+ days inactive OR very low score)
  if (
    daysSinceActive >= segments.at_risk.max_days_inactive ||
    overallScore < segments.at_risk.max_score
  ) {
    return "at_risk";
  }

  // Calculate sessions per day for power user detection
  const uniqueDays = new Set(events.map((e) => e.event_at.split("T")[0])).size;
  const uniqueSessions = new Set(
    events.filter((e) => e.session_id).map((e) => e.session_id)
  ).size;
  const sessionsPerDay = uniqueDays > 0 ? uniqueSessions / uniqueDays : 0;

  // Check for power user
  if (
    overallScore >= segments.power_user.min_score &&
    sessionsPerDay >= segments.power_user.min_sessions_per_day
  ) {
    return "power_user";
  }

  // Check for regular user
  if (overallScore >= segments.regular.min_score) {
    return "regular";
  }

  // Check for casual user
  if (overallScore >= segments.casual.min_score) {
    return "casual";
  }

  return "at_risk";
}

/**
 * Calculate typical active hours and peak activity hour
 */
export function calculateActivityPatterns(events: ActivityEvent[]): {
  typicalActiveHours: Record<number, number[]>;
  peakHour: number | null;
} {
  if (events.length === 0) {
    return { typicalActiveHours: {}, peakHour: null };
  }

  // Group events by day of week and hour
  const hourCounts: Record<number, number> = {};
  const dayHourCounts: Record<number, Record<number, number>> = {};

  for (const event of events) {
    const hour = event.hour_of_day;
    const day = event.day_of_week;

    hourCounts[hour] = (hourCounts[hour] || 0) + 1;

    if (!dayHourCounts[day]) dayHourCounts[day] = {};
    dayHourCounts[day][hour] = (dayHourCounts[day][hour] || 0) + 1;
  }

  // Find peak hour
  let peakHour: number | null = null;
  let maxCount = 0;
  for (const [hour, count] of Object.entries(hourCounts)) {
    if (count > maxCount) {
      maxCount = count;
      peakHour = parseInt(hour);
    }
  }

  // Build typical active hours per day (top 5 hours per day)
  const typicalActiveHours: Record<number, number[]> = {};
  for (const [day, hours] of Object.entries(dayHourCounts)) {
    const sortedHours = Object.entries(hours)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([h]) => parseInt(h));
    typicalActiveHours[parseInt(day)] = sortedHours;
  }

  return { typicalActiveHours, peakHour };
}

/**
 * Calculate session metrics
 */
export function calculateSessionMetrics(events: ActivityEvent[]): {
  avgDailySessions: number;
} {
  if (events.length === 0) {
    return { avgDailySessions: 0 };
  }

  const uniqueDays = new Set(events.map((e) => e.event_at.split("T")[0])).size;
  const uniqueSessions = new Set(
    events.filter((e) => e.session_id).map((e) => e.session_id)
  ).size;

  return {
    avgDailySessions:
      uniqueDays > 0 ? Math.round((uniqueSessions / uniqueDays) * 100) / 100 : 0,
  };
}

/**
 * Calculate notification fatigue level (0-100)
 */
export function calculateNotificationFatigue(
  interactions: NotificationInteraction[],
  _metrics: UserMetrics
): number {
  if (interactions.length === 0) return 0;

  const recentInteractions = interactions.slice(0, 20); // Last 20 notifications
  const dismissedCount = recentInteractions.filter(
    (i) => i.dismissed_at && !i.clicked_at
  ).length;
  const ignoredCount = recentInteractions.filter(
    (i) => !i.clicked_at && !i.dismissed_at
  ).length;

  // Fatigue indicators
  const dismissalRate = dismissedCount / recentInteractions.length;
  const ignoreRate = ignoredCount / recentInteractions.length;

  // Calculate fatigue score
  const fatigueScore = Math.round((dismissalRate * 50 + ignoreRate * 50) * 100);

  return Math.min(100, fatigueScore);
}

/**
 * Check if feedback should be requested (every 2 weeks)
 */
export function checkShouldRequestFeedback(metrics: UserMetrics): boolean {
  const now = new Date();

  // If never requested, check if enough notifications have been sent
  if (!metrics.last_feedback_requested_at) {
    return (
      metrics.notifications_since_last_feedback >=
      ENGAGEMENT_CONFIG.min_notifications_before_feedback
    );
  }

  const lastFeedback = new Date(metrics.last_feedback_requested_at);
  const daysSinceFeedback =
    (now.getTime() - lastFeedback.getTime()) / (1000 * 60 * 60 * 24);

  return daysSinceFeedback >= ENGAGEMENT_CONFIG.feedback_interval_days;
}

/**
 * Get fatigue level category from score
 */
export function getFatigueLevel(
  fatigueScore: number
): "low" | "moderate" | "high" | "critical" {
  const { fatigue } = ENGAGEMENT_CONFIG;
  if (fatigueScore >= fatigue.critical) return "critical";
  if (fatigueScore >= fatigue.high) return "high";
  if (fatigueScore >= fatigue.moderate) return "moderate";
  return "low";
}

/**
 * Compute all engagement scores for a user
 */
export function computeEngagementScores(
  metrics: UserMetrics,
  activityEvents: ActivityEvent[],
  notificationInteractions: NotificationInteraction[]
): ComputedScores {
  // Separate events by source
  const appEvents = activityEvents.filter((e) => e.event_source === "app");
  const slackEvents = activityEvents.filter((e) => e.event_source === "slack");

  // Calculate individual scores
  const appEngagementScore = calculateAppEngagementScore(appEvents, metrics);
  const slackEngagementScore = calculateSlackEngagementScore(slackEvents, metrics);
  const notificationEngagementScore = calculateNotificationEngagementScore(
    notificationInteractions
  );

  // Calculate overall score
  const overallEngagementScore = calculateOverallEngagementScore(
    appEngagementScore,
    slackEngagementScore,
    notificationEngagementScore
  );

  // Determine segment
  const userSegment = determineUserSegment(
    overallEngagementScore,
    metrics,
    activityEvents
  );

  // Calculate patterns
  const activityPatterns = calculateActivityPatterns(activityEvents);
  const sessionMetrics = calculateSessionMetrics(activityEvents);

  // Calculate fatigue
  const notificationFatigueLevel = calculateNotificationFatigue(
    notificationInteractions,
    metrics
  );

  // Check feedback
  const shouldRequestFeedback = checkShouldRequestFeedback(metrics);

  return {
    app_engagement_score: appEngagementScore,
    slack_engagement_score: slackEngagementScore,
    notification_engagement_score: notificationEngagementScore,
    overall_engagement_score: overallEngagementScore,
    user_segment: userSegment,
    typical_active_hours: activityPatterns.typicalActiveHours,
    peak_activity_hour: activityPatterns.peakHour,
    avg_daily_sessions: sessionMetrics.avgDailySessions,
    notification_fatigue_level: notificationFatigueLevel,
    should_request_feedback: shouldRequestFeedback,
  };
}
