/**
 * Optimal Send Time Algorithm
 *
 * Calculates the best time to send notifications based on user activity patterns,
 * engagement history, and fatigue levels.
 */

import { ENGAGEMENT_CONFIG, SEGMENT_NOTIFICATION_PRIORITY } from "./config.ts";
import { getFatigueLevel } from "./metrics.ts";
import type {
  UserMetrics,
  NotificationPriority,
  OptimalSendTimeResult,
  UserSegment,
} from "./types.ts";

/**
 * Calculate the optimal send time for a notification
 */
export function calculateOptimalSendTime(
  metrics: UserMetrics,
  priority: NotificationPriority,
  now: Date = new Date()
): OptimalSendTimeResult {
  const { timing } = ENGAGEMENT_CONFIG;
  const currentHour = now.getHours();
  const currentDay = now.getDay(); // 0 = Sunday
  const isWeekend = currentDay === 0 || currentDay === 6;

  // Get user's typical active hours for today
  const typicalHours = metrics.typical_active_hours?.[currentDay] || [];
  const peakHour = metrics.peak_activity_hour;
  const fatigueLevel = getFatigueLevel(metrics.notification_fatigue_level || 0);
  const segment = (metrics.user_segment || "regular") as UserSegment;

  // Calculate factors
  const factors = {
    peak_activity_alignment: 0,
    historical_engagement: 0,
    fatigue_adjustment: 0,
    priority_boost: 0,
  };

  // Find candidate hours within lookahead window
  const candidateHours: Array<{ hour: number; score: number }> = [];

  for (let offset = 0; offset < timing.lookahead_hours; offset++) {
    const candidateHour = (currentHour + offset) % 24;

    // Skip if outside default business hours (unless urgent)
    if (
      priority !== "urgent" &&
      (candidateHour < timing.default_hours.start ||
        candidateHour > timing.default_hours.end)
    ) {
      continue;
    }

    let score = 50; // Base score

    // Factor 1: Peak activity alignment
    if (candidateHour === peakHour) {
      score += 30;
      factors.peak_activity_alignment = 30;
    } else if (typicalHours.includes(candidateHour)) {
      const position = typicalHours.indexOf(candidateHour);
      const alignmentBonus = Math.max(0, 25 - position * 5);
      score += alignmentBonus;
      factors.peak_activity_alignment = Math.max(
        factors.peak_activity_alignment,
        alignmentBonus
      );
    }

    // Factor 2: Historical engagement score
    const engagementBonus = Math.min(
      20,
      ((metrics.notification_engagement_score || 50) / 100) * 20
    );
    score += engagementBonus;
    factors.historical_engagement = engagementBonus;

    // Factor 3: Fatigue adjustment
    const fatigueMultiplier = ENGAGEMENT_CONFIG.fatigue.cooldown_multipliers[fatigueLevel];
    const fatiguePenalty = Math.min(25, (fatigueMultiplier - 1) * 20);
    score -= fatiguePenalty;
    factors.fatigue_adjustment = -fatiguePenalty;

    // Factor 4: Priority boost
    const priorityBoosts: Record<NotificationPriority, number> = {
      urgent: 30,
      high: 15,
      normal: 0,
      low: -10,
    };
    score += priorityBoosts[priority];
    factors.priority_boost = priorityBoosts[priority];

    // Factor 5: Weekend adjustment
    if (isWeekend && priority !== "urgent") {
      score *= timing.weekend_factor;
    }

    // Factor 6: Segment priority
    const segmentPriority = SEGMENT_NOTIFICATION_PRIORITY[segment] || 0.5;
    score *= segmentPriority;

    // Factor 7: Immediate vs delayed penalty
    // Slight preference for sending sooner rather than later
    score -= offset * 2;

    candidateHours.push({ hour: candidateHour, score: Math.max(0, score) });
  }

  // Sort by score and get best option
  candidateHours.sort((a, b) => b.score - a.score);

  // Build recommended time
  let recommendedHour: number;
  let confidence: number;

  if (candidateHours.length > 0 && candidateHours[0].score >= timing.min_confidence * 100) {
    recommendedHour = candidateHours[0].hour;
    confidence = Math.min(1, candidateHours[0].score / 100);
  } else if (priority === "urgent") {
    // Urgent: send now regardless
    recommendedHour = currentHour;
    confidence = 0.5;
  } else {
    // Default to next business hour or peak hour
    recommendedHour = peakHour ?? timing.default_hours.start;
    confidence = 0.3;
  }

  // Build the recommended datetime
  const recommendedTime = new Date(now);
  if (recommendedHour < currentHour) {
    // Next day
    recommendedTime.setDate(recommendedTime.getDate() + 1);
  }
  recommendedTime.setHours(recommendedHour, 0, 0, 0);

  // Build alternative times
  const alternativeTimes = candidateHours
    .slice(1, 4)
    .map((c) => {
      const altTime = new Date(now);
      if (c.hour < currentHour) {
        altTime.setDate(altTime.getDate() + 1);
      }
      altTime.setHours(c.hour, 0, 0, 0);
      return altTime.toISOString();
    });

  return {
    recommended_time: recommendedTime.toISOString(),
    confidence,
    factors,
    alternative_times: alternativeTimes,
  };
}

/**
 * Check if current time is within user's active window
 */
export function isWithinActiveWindow(
  metrics: UserMetrics,
  now: Date = new Date()
): boolean {
  const currentHour = now.getHours();
  const currentDay = now.getDay();
  const typicalHours = metrics.typical_active_hours?.[currentDay] || [];

  if (typicalHours.length === 0) {
    // Fall back to default business hours
    const { timing } = ENGAGEMENT_CONFIG;
    return (
      currentHour >= timing.default_hours.start &&
      currentHour <= timing.default_hours.end
    );
  }

  return typicalHours.includes(currentHour);
}

/**
 * Get the next active window start time
 */
export function getNextActiveWindowStart(
  metrics: UserMetrics,
  now: Date = new Date()
): Date {
  const currentHour = now.getHours();
  const currentDay = now.getDay();

  // Check next 7 days
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const checkDay = (currentDay + dayOffset) % 7;
    const typicalHours = metrics.typical_active_hours?.[checkDay] || [];

    if (typicalHours.length > 0) {
      const firstActiveHour = Math.min(...typicalHours);

      // If same day, check if hour is still ahead
      if (dayOffset === 0 && firstActiveHour > currentHour) {
        const result = new Date(now);
        result.setHours(firstActiveHour, 0, 0, 0);
        return result;
      }

      // If future day
      if (dayOffset > 0) {
        const result = new Date(now);
        result.setDate(result.getDate() + dayOffset);
        result.setHours(firstActiveHour, 0, 0, 0);
        return result;
      }
    }
  }

  // Fallback: next business day at default start
  const { timing } = ENGAGEMENT_CONFIG;
  const result = new Date(now);
  result.setDate(result.getDate() + 1);
  result.setHours(timing.default_hours.start, 0, 0, 0);
  return result;
}

/**
 * Calculate delay for re-engagement notifications
 * Based on how long the user has been inactive
 */
export function calculateReengagementDelay(
  metrics: UserMetrics
): { delay_hours: number; message_type: string } {
  const lastActive = Math.max(
    metrics.last_app_active_at
      ? new Date(metrics.last_app_active_at).getTime()
      : 0,
    metrics.last_slack_active_at
      ? new Date(metrics.last_slack_active_at).getTime()
      : 0
  );

  const hoursSinceActive = (Date.now() - lastActive) / (1000 * 60 * 60);
  const daysSinceActive = hoursSinceActive / 24;

  // Progressive delay based on inactivity
  if (daysSinceActive < 3) {
    return { delay_hours: 24, message_type: "gentle_nudge" };
  } else if (daysSinceActive < 7) {
    return { delay_hours: 48, message_type: "value_reminder" };
  } else if (daysSinceActive < 14) {
    return { delay_hours: 72, message_type: "feature_highlight" };
  } else if (daysSinceActive < 30) {
    return { delay_hours: 168, message_type: "win_back" }; // 1 week
  } else {
    return { delay_hours: 336, message_type: "last_chance" }; // 2 weeks
  }
}

/**
 * Should batch notification with others?
 * Returns true if this notification should wait to be bundled
 */
export function shouldBatchNotification(
  priority: NotificationPriority,
  metrics: UserMetrics,
  pendingCount: number
): boolean {
  // Never batch urgent or high priority
  if (priority === "urgent" || priority === "high") {
    return false;
  }

  // Batch if user has high fatigue and there are pending notifications
  const fatigueLevel = getFatigueLevel(metrics.notification_fatigue_level || 0);
  if (fatigueLevel === "high" || fatigueLevel === "critical") {
    return pendingCount < 5; // Batch up to 5
  }

  // Batch low priority if there are already pending
  if (priority === "low" && pendingCount > 0) {
    return pendingCount < 3;
  }

  return false;
}
