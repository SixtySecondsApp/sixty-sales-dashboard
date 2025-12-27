import { useMemo } from 'react';
import { useWorkingHours, useIsMinimalPollingMode } from './useWorkingHours';
import { useUserActivity, useActivityPollingMultiplier } from './useUserActivity';

/**
 * Polling tier configuration for different data types.
 * Higher tiers = more aggressive polling (more important data).
 */
export type PollingTier = 'critical' | 'important' | 'standard' | 'background' | 'static';

interface SmartPollingConfig {
  /** The calculated polling interval in milliseconds, or false to disable */
  interval: number | false;
  /** Whether polling should be enabled */
  enabled: boolean;
  /** Debug info about why this interval was chosen */
  reason: string;
  /** Whether we're in reduced polling mode */
  isReducedMode: boolean;
}

interface SmartPollingOptions {
  /** The base polling interval in milliseconds */
  baseInterval: number;
  /** The importance tier of this data */
  tier?: PollingTier;
  /** Force enable even outside working hours (use sparingly!) */
  alwaysEnabled?: boolean;
  /** Minimum interval even when slowed down */
  minInterval?: number;
  /** Maximum interval when slowed down */
  maxInterval?: number;
}

// Tier multipliers for different data importance levels
const TIER_MULTIPLIERS: Record<PollingTier, number> = {
  critical: 1,      // Always poll at base rate
  important: 1.5,   // Slightly slower
  standard: 2,      // 2x slower base
  background: 5,    // 5x slower base
  static: 10,       // 10x slower base
};

// During off-hours, all non-critical tiers are severely reduced
const OFF_HOURS_MULTIPLIERS: Record<PollingTier, number | false> = {
  critical: 2,      // Critical data still polls but slower
  important: 10,    // Much slower
  standard: false,  // Disabled
  background: false, // Disabled
  static: false,    // Disabled
};

/**
 * Smart polling hook that combines working hours and user activity
 * to determine optimal polling intervals.
 *
 * Features:
 * - Working hours awareness (disabled or slower outside hours)
 * - User activity detection (slower when idle)
 * - Tier-based configuration (critical vs background data)
 * - Tab visibility awareness
 *
 * @param options - Configuration options for smart polling
 * @returns SmartPollingConfig with calculated interval and status
 */
export function useSmartPolling(options: SmartPollingOptions): SmartPollingConfig {
  const {
    baseInterval,
    tier = 'standard',
    alwaysEnabled = false,
    minInterval = 10000,      // Never faster than 10s
    maxInterval = 30 * 60 * 1000, // Never slower than 30 minutes
  } = options;

  const { isWorkingHours, isWeekend } = useWorkingHours();
  const activityMultiplier = useActivityPollingMultiplier();
  const isMinimalMode = useIsMinimalPollingMode();

  return useMemo(() => {
    let interval: number | false = baseInterval;
    let reason = 'Base interval';
    let isReducedMode = false;

    // Step 1: Check if we're outside working hours
    if (!isWorkingHours && !alwaysEnabled) {
      const offHoursMultiplier = OFF_HOURS_MULTIPLIERS[tier];

      if (offHoursMultiplier === false) {
        return {
          interval: false,
          enabled: false,
          reason: `Disabled outside working hours (tier: ${tier})`,
          isReducedMode: true,
        };
      }

      interval = baseInterval * offHoursMultiplier;
      reason = `Off-hours mode (${tier} tier, ${offHoursMultiplier}x)`;
      isReducedMode = true;
    }

    // Step 2: Apply tier multiplier (during working hours)
    if (isWorkingHours && tier !== 'critical') {
      const tierMultiplier = TIER_MULTIPLIERS[tier];
      interval = (interval as number) * tierMultiplier;
      reason = `Working hours with ${tier} tier (${tierMultiplier}x)`;
    }

    // Step 3: Apply activity multiplier
    if (activityMultiplier === false) {
      // User is idle and tab is hidden
      if (tier === 'critical' || alwaysEnabled) {
        // Critical data still polls but very slowly
        interval = maxInterval;
        reason = `Critical data, user inactive + tab hidden (max interval)`;
        isReducedMode = true;
      } else {
        return {
          interval: false,
          enabled: false,
          reason: `Disabled: user inactive and tab hidden`,
          isReducedMode: true,
        };
      }
    } else if (activityMultiplier > 1) {
      // User is idle or tab is hidden
      interval = (interval as number) * activityMultiplier;
      reason = `${reason}, activity multiplier ${activityMultiplier}x`;
      isReducedMode = true;
    }

    // Step 4: Apply min/max bounds
    if (typeof interval === 'number') {
      if (interval < minInterval) {
        interval = minInterval;
        reason = `${reason} (clamped to min ${minInterval}ms)`;
      }
      if (interval > maxInterval) {
        interval = maxInterval;
        reason = `${reason} (clamped to max ${maxInterval}ms)`;
      }
    }

    return {
      interval,
      enabled: interval !== false,
      reason,
      isReducedMode,
    };
  }, [baseInterval, tier, alwaysEnabled, minInterval, maxInterval, isWorkingHours, activityMultiplier, isMinimalMode]);
}

/**
 * Simplified hook that returns just the polling interval.
 * Returns false to indicate polling should be disabled.
 *
 * Usage in React Query:
 * ```typescript
 * const pollingInterval = useSmartPollingInterval(60000, 'background');
 * useQuery({
 *   queryKey: ['data'],
 *   queryFn: fetchData,
 *   refetchInterval: pollingInterval,
 * });
 * ```
 */
export function useSmartPollingInterval(
  baseInterval: number,
  tier: PollingTier = 'standard'
): number | false {
  const { interval } = useSmartPolling({ baseInterval, tier });
  return interval;
}

/**
 * Hook that returns whether any polling should be enabled at all.
 * Useful for components that need to conditionally render polling indicators.
 */
export function useIsPollingEnabled(tier: PollingTier = 'standard'): boolean {
  const { enabled } = useSmartPolling({ baseInterval: 60000, tier });
  return enabled;
}

/**
 * Hook that returns a refetch configuration for React Query.
 * Includes both interval and background refetch settings.
 */
export function useSmartRefetchConfig(
  baseInterval: number,
  tier: PollingTier = 'standard'
): {
  refetchInterval: number | false;
  refetchIntervalInBackground: boolean;
  refetchOnWindowFocus: boolean;
} {
  const { interval, isReducedMode } = useSmartPolling({ baseInterval, tier });
  const { isTabVisible } = useUserActivity();

  return {
    refetchInterval: interval,
    // Only refetch in background for critical/important data
    refetchIntervalInBackground: tier === 'critical' || tier === 'important',
    // DISABLED: refetchOnWindowFocus was causing excessive refetches on tab switch
    // The global queryClient.ts setting is refetchOnWindowFocus: false - respect that
    // Previously this was: tier === 'background' || tier === 'static' || isReducedMode
    refetchOnWindowFocus: false,
  };
}

/**
 * Pre-configured polling intervals for common use cases.
 * These provide sensible defaults based on data type.
 */
export const POLLING_PRESETS = {
  /** Real-time critical data (notifications, alerts) */
  realtime: { baseInterval: 10000, tier: 'critical' as PollingTier },
  /** Important user data (activities, tasks) */
  userData: { baseInterval: 60000, tier: 'important' as PollingTier },
  /** Standard application data */
  standard: { baseInterval: 120000, tier: 'standard' as PollingTier },
  /** Background data (leads, analytics) */
  background: { baseInterval: 300000, tier: 'background' as PollingTier },
  /** Static/config data (settings, templates) */
  static: { baseInterval: 600000, tier: 'static' as PollingTier },
} as const;
