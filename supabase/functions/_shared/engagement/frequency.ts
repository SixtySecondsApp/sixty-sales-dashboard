/**
 * Notification Frequency Limiter
 *
 * Enforces notification limits based on user preferences, fatigue levels,
 * and priority overrides.
 */

import { ENGAGEMENT_CONFIG } from "./config.ts";
import { getFatigueLevel } from "./metrics.ts";
import type {
  UserMetrics,
  NotificationPriority,
  NotificationFrequency,
  FrequencyLimitResult,
} from "./types.ts";

interface NotificationCount {
  hour: number;
  day: number;
  last_sent_at: string | null;
}

/**
 * Check if a notification can be sent based on frequency limits
 */
export function checkFrequencyLimit(
  metrics: UserMetrics,
  priority: NotificationPriority,
  recentCounts: NotificationCount,
  now: Date = new Date()
): FrequencyLimitResult {
  const frequency = (metrics.preferred_notification_frequency ||
    "moderate") as NotificationFrequency;
  const fatigueLevel = getFatigueLevel(metrics.notification_fatigue_level || 0);
  const thresholds = ENGAGEMENT_CONFIG.notification_thresholds[frequency];
  const priorityConfig = ENGAGEMENT_CONFIG.priority_overrides[priority];

  // Apply fatigue-based cooldown multiplier
  const fatigueMultiplier =
    ENGAGEMENT_CONFIG.fatigue.cooldown_multipliers[fatigueLevel];

  // Calculate effective limits (reduced by fatigue)
  const effectiveMaxPerHour = Math.max(
    1,
    Math.floor(thresholds.max_per_hour / fatigueMultiplier)
  );
  const effectiveMaxPerDay = Math.max(
    1,
    Math.floor(thresholds.max_per_day / fatigueMultiplier)
  );

  // Check hourly limit
  if (recentCounts.hour >= effectiveMaxPerHour) {
    // Check if priority allows override
    if (!priorityConfig.allow_exceed) {
      const nextAllowed = new Date(now);
      nextAllowed.setHours(nextAllowed.getHours() + 1, 0, 0, 0);

      return {
        allowed: false,
        reason: `Hourly limit reached (${recentCounts.hour}/${effectiveMaxPerHour})`,
        next_allowed_at: nextAllowed.toISOString(),
        current_count: {
          hour: recentCounts.hour,
          day: recentCounts.day,
        },
        limits: {
          max_per_hour: effectiveMaxPerHour,
          max_per_day: effectiveMaxPerDay,
        },
      };
    }
  }

  // Check daily limit
  if (recentCounts.day >= effectiveMaxPerDay) {
    if (!priorityConfig.allow_exceed) {
      const nextAllowed = new Date(now);
      nextAllowed.setDate(nextAllowed.getDate() + 1);
      nextAllowed.setHours(0, 0, 0, 0);

      return {
        allowed: false,
        reason: `Daily limit reached (${recentCounts.day}/${effectiveMaxPerDay})`,
        next_allowed_at: nextAllowed.toISOString(),
        current_count: {
          hour: recentCounts.hour,
          day: recentCounts.day,
        },
        limits: {
          max_per_hour: effectiveMaxPerHour,
          max_per_day: effectiveMaxPerDay,
        },
      };
    }
  }

  // Check cooldown period since last notification
  if (recentCounts.last_sent_at) {
    const lastSent = new Date(recentCounts.last_sent_at);
    const minutesSinceLast =
      (now.getTime() - lastSent.getTime()) / (1000 * 60);
    const effectiveCooldown = priorityConfig.cooldown_minutes * fatigueMultiplier;

    if (minutesSinceLast < effectiveCooldown) {
      // Only urgent can bypass cooldown
      if (priority !== "urgent") {
        const nextAllowed = new Date(lastSent);
        nextAllowed.setMinutes(
          nextAllowed.getMinutes() + Math.ceil(effectiveCooldown)
        );

        return {
          allowed: false,
          reason: `Cooldown active (${Math.ceil(effectiveCooldown - minutesSinceLast)} minutes remaining)`,
          next_allowed_at: nextAllowed.toISOString(),
          current_count: {
            hour: recentCounts.hour,
            day: recentCounts.day,
          },
          limits: {
            max_per_hour: effectiveMaxPerHour,
            max_per_day: effectiveMaxPerDay,
          },
        };
      }
    }
  }

  // Allowed
  return {
    allowed: true,
    current_count: {
      hour: recentCounts.hour,
      day: recentCounts.day,
    },
    limits: {
      max_per_hour: effectiveMaxPerHour,
      max_per_day: effectiveMaxPerDay,
    },
  };
}

/**
 * Get notification counts from database
 * Returns counts for the current hour and day
 */
export async function getNotificationCounts(
  supabase: any,
  userId: string,
  now: Date = new Date()
): Promise<NotificationCount> {
  const hourStart = new Date(now);
  hourStart.setMinutes(0, 0, 0);

  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  // Get count for current hour
  const { count: hourCount } = await supabase
    .from("notification_interactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("delivered_at", hourStart.toISOString());

  // Get count for current day
  const { count: dayCount } = await supabase
    .from("notification_interactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("delivered_at", dayStart.toISOString());

  // Get last sent notification
  const { data: lastNotification } = await supabase
    .from("notification_interactions")
    .select("delivered_at")
    .eq("user_id", userId)
    .order("delivered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    hour: hourCount || 0,
    day: dayCount || 0,
    last_sent_at: lastNotification?.delivered_at || null,
  };
}

/**
 * Calculate remaining notification budget for user
 */
export function getRemainingBudget(
  metrics: UserMetrics,
  recentCounts: NotificationCount
): {
  remaining_hour: number;
  remaining_day: number;
  can_send: boolean;
} {
  const frequency = (metrics.preferred_notification_frequency ||
    "moderate") as NotificationFrequency;
  const fatigueLevel = getFatigueLevel(metrics.notification_fatigue_level || 0);
  const thresholds = ENGAGEMENT_CONFIG.notification_thresholds[frequency];
  const fatigueMultiplier =
    ENGAGEMENT_CONFIG.fatigue.cooldown_multipliers[fatigueLevel];

  const effectiveMaxPerHour = Math.max(
    1,
    Math.floor(thresholds.max_per_hour / fatigueMultiplier)
  );
  const effectiveMaxPerDay = Math.max(
    1,
    Math.floor(thresholds.max_per_day / fatigueMultiplier)
  );

  const remainingHour = Math.max(0, effectiveMaxPerHour - recentCounts.hour);
  const remainingDay = Math.max(0, effectiveMaxPerDay - recentCounts.day);

  return {
    remaining_hour: remainingHour,
    remaining_day: remainingDay,
    can_send: remainingHour > 0 && remainingDay > 0,
  };
}

/**
 * Adjust user's notification frequency preference based on fatigue
 * Returns recommended frequency if current setting seems too high
 */
export function recommendFrequencyAdjustment(
  metrics: UserMetrics
): NotificationFrequency | null {
  const currentFrequency = (metrics.preferred_notification_frequency ||
    "moderate") as NotificationFrequency;
  const fatigueLevel = getFatigueLevel(metrics.notification_fatigue_level || 0);

  // Recommend downgrade if fatigue is high
  if (fatigueLevel === "critical" && currentFrequency !== "low") {
    return "low";
  }

  if (fatigueLevel === "high" && currentFrequency === "high") {
    return "moderate";
  }

  return null; // No change needed
}

/**
 * Calculate delay until next notification slot
 */
export function calculateNextSlotDelay(
  limitResult: FrequencyLimitResult,
  now: Date = new Date()
): number {
  if (limitResult.allowed) {
    return 0;
  }

  if (limitResult.next_allowed_at) {
    const nextAllowed = new Date(limitResult.next_allowed_at);
    return Math.max(0, nextAllowed.getTime() - now.getTime());
  }

  // Default to 1 hour
  return 60 * 60 * 1000;
}

/**
 * Should downgrade notification priority based on fatigue?
 */
export function shouldDowngradePriority(
  priority: NotificationPriority,
  metrics: UserMetrics
): NotificationPriority {
  const fatigueLevel = getFatigueLevel(metrics.notification_fatigue_level || 0);

  // Never downgrade urgent
  if (priority === "urgent") {
    return priority;
  }

  // Critical fatigue: downgrade high to normal, normal to low
  if (fatigueLevel === "critical") {
    if (priority === "high") return "normal";
    if (priority === "normal") return "low";
  }

  // High fatigue: downgrade normal to low
  if (fatigueLevel === "high" && priority === "normal") {
    return "low";
  }

  return priority;
}
