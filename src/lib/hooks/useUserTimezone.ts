/**
 * useUserTimezone Hook
 *
 * Manages user timezone preferences with auto-detection and manual override.
 * Used by copilot meeting queries to correctly interpret relative dates.
 *
 * Behavior:
 * 1. If profile has timezone set, use that
 * 2. Otherwise, auto-detect from browser and store in profile
 * 3. User can manually override in settings
 *
 * @example
 * const { timezone, weekStartsOn, setTimezone, setWeekStartsOn, isAutoDetected } = useUserTimezone();
 * // timezone: 'Europe/London'
 * // weekStartsOn: 1 (Monday)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuth } from '@/lib/contexts/AuthContext';
import { getBrowserTimezone } from '@/lib/utils/dateUtils';
import logger from '@/lib/utils/logger';
import { toast } from 'sonner';
import { useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface TimezonePreferences {
  timezone: string | null;
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
}

export interface UseUserTimezoneResult {
  /** Current effective timezone (from profile or auto-detected) */
  timezone: string;
  /** Week start preference (0 = Sunday, 1 = Monday) */
  weekStartsOn: 0 | 1;
  /** Whether the timezone was auto-detected vs stored in profile */
  isAutoDetected: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Update the user's timezone preference */
  setTimezone: (timezone: string) => Promise<void>;
  /** Update the week start preference */
  setWeekStartsOn: (day: 0 | 1) => Promise<void>;
  /** Force refresh preferences from server */
  refresh: () => void;
}

// ============================================================================
// Query Keys
// ============================================================================

const TIMEZONE_PREFS_KEY = ['user-timezone-preferences'] as const;

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch timezone preferences from profile
 */
async function fetchTimezonePreferences(userId: string): Promise<TimezonePreferences | null> {
  logger.log('🌍 useUserTimezone: Fetching timezone preferences for user:', userId);

  const { data, error } = await supabase
    .from('profiles')
    .select('timezone, week_starts_on')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    logger.warn('useUserTimezone: Error fetching preferences:', error.message);
    return null;
  }

  if (!data) {
    logger.log('useUserTimezone: No profile found');
    return null;
  }

  return {
    timezone: data.timezone ?? null,
    weekStartsOn: (data.week_starts_on ?? 1) as 0 | 1,
  };
}

/**
 * Update timezone preference in profile
 */
async function updateTimezonePreference(userId: string, timezone: string): Promise<void> {
  logger.log('🌍 useUserTimezone: Updating timezone to:', timezone);

  const { error } = await supabase
    .from('profiles')
    .update({ timezone, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to update timezone: ${error.message}`);
  }
}

/**
 * Update week start preference in profile
 */
async function updateWeekStartPreference(userId: string, weekStartsOn: 0 | 1): Promise<void> {
  logger.log('🌍 useUserTimezone: Updating week start to:', weekStartsOn === 0 ? 'Sunday' : 'Monday');

  const { error } = await supabase
    .from('profiles')
    .update({ week_starts_on: weekStartsOn, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to update week start preference: ${error.message}`);
  }
}

// ============================================================================
// Hook
// ============================================================================

export function useUserTimezone(): UseUserTimezoneResult {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  // Fetch timezone preferences from profile
  const {
    data: preferences,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [...TIMEZONE_PREFS_KEY, userId],
    queryFn: () => fetchTimezonePreferences(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Get browser timezone for fallback
  const browserTimezone = getBrowserTimezone();

  // Determine effective timezone
  const storedTimezone = preferences?.timezone;
  const effectiveTimezone = storedTimezone || browserTimezone;
  const isAutoDetected = !storedTimezone;

  // Auto-store timezone on first detection
  useEffect(() => {
    // Only auto-store if:
    // 1. User is authenticated
    // 2. Preferences have been loaded (not loading)
    // 3. No timezone is stored in profile
    // 4. We have a browser timezone to store
    if (userId && !isLoading && !storedTimezone && browserTimezone) {
      logger.log('🌍 useUserTimezone: Auto-storing detected timezone:', browserTimezone);

      // Fire and forget - don't block UI
      supabase
        .from('profiles')
        .update({ timezone: browserTimezone })
        .eq('id', userId)
        .then(({ error }) => {
          if (error) {
            logger.warn('useUserTimezone: Failed to auto-store timezone:', error.message);
          } else {
            logger.log('✅ useUserTimezone: Timezone auto-stored successfully');
            // Invalidate cache so next fetch gets the stored value
            queryClient.invalidateQueries({ queryKey: [...TIMEZONE_PREFS_KEY, userId] });
          }
        });
    }
  }, [userId, isLoading, storedTimezone, browserTimezone, queryClient]);

  // Mutation for updating timezone
  const timezoneMutation = useMutation({
    mutationFn: (timezone: string) => updateTimezonePreference(userId!, timezone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...TIMEZONE_PREFS_KEY, userId] });
      toast.success('Timezone updated');
    },
    onError: (error: Error) => {
      logger.error('useUserTimezone: Failed to update timezone:', error);
      toast.error(error.message);
    },
  });

  // Mutation for updating week start
  const weekStartMutation = useMutation({
    mutationFn: (day: 0 | 1) => updateWeekStartPreference(userId!, day),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...TIMEZONE_PREFS_KEY, userId] });
      toast.success('Week start preference updated');
    },
    onError: (error: Error) => {
      logger.error('useUserTimezone: Failed to update week start:', error);
      toast.error(error.message);
    },
  });

  return {
    timezone: effectiveTimezone,
    weekStartsOn: preferences?.weekStartsOn ?? 1,
    isAutoDetected,
    isLoading,
    setTimezone: async (timezone: string) => {
      if (!userId) {
        toast.error('Must be logged in to update preferences');
        return;
      }
      await timezoneMutation.mutateAsync(timezone);
    },
    setWeekStartsOn: async (day: 0 | 1) => {
      if (!userId) {
        toast.error('Must be logged in to update preferences');
        return;
      }
      await weekStartMutation.mutateAsync(day);
    },
    refresh: () => refetch(),
  };
}

// ============================================================================
// Common Timezones (for UI dropdowns)
// ============================================================================

export const COMMON_TIMEZONES = [
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
  { value: 'Europe/Dublin', label: 'Dublin (GMT/IST)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'Denver (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'America/Toronto', label: 'Toronto (EST/EDT)' },
  { value: 'America/Vancouver', label: 'Vancouver (PST/PDT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
] as const;

export default useUserTimezone;
