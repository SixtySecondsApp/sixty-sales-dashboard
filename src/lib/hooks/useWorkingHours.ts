import { useMemo, useState, useEffect } from 'react';
import { useUser } from './useUser';

interface WorkingHoursConfig {
  isWorkingHours: boolean;
  isWeekend: boolean;
  timezone: string;
  workingHoursStart: number;
  workingHoursEnd: number;
  currentHour: number;
  nextWorkingHoursStart: Date | null;
}

/**
 * Hook to detect if the current time falls within the user's working hours.
 * Used for smart polling to reduce API calls outside working hours.
 *
 * Features:
 * - Timezone-aware (uses user profile or auto-detects from browser)
 * - Customizable working hours (default 8 AM - 6 PM)
 * - Weekend detection (Saturday/Sunday = minimal polling mode)
 * - Auto-refreshes every minute to track time changes
 *
 * @returns WorkingHoursConfig with current working status and configuration
 */
export function useWorkingHours(): WorkingHoursConfig {
  const { userData } = useUser();
  const [currentTime, setCurrentTime] = useState(new Date());

  // Refresh current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  return useMemo(() => {
    // Get timezone from user profile or auto-detect from browser
    const timezone = userData?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Get working hours from user profile or use defaults
    const workingHoursStart = (userData as any)?.working_hours_start ?? 8;
    const workingHoursEnd = (userData as any)?.working_hours_end ?? 18;

    // Get current hour in user's timezone
    const localHour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: timezone,
      }).format(currentTime)
    );

    // Get current day of week in user's timezone (0 = Sunday, 6 = Saturday)
    const localDayOfWeek = parseInt(
      new Intl.DateTimeFormat('en-US', {
        weekday: 'narrow',
        timeZone: timezone,
      }).format(currentTime) === 'S'
        ? // Need more specific check for Saturday vs Sunday
          new Date(currentTime.toLocaleString('en-US', { timeZone: timezone })).getDay().toString()
        : new Date(currentTime.toLocaleString('en-US', { timeZone: timezone })).getDay().toString()
    );

    const isWeekend = localDayOfWeek === 0 || localDayOfWeek === 6;
    const isWorkingHours = !isWeekend && localHour >= workingHoursStart && localHour < workingHoursEnd;

    // Calculate next working hours start time (for scheduling purposes)
    let nextWorkingHoursStart: Date | null = null;
    if (!isWorkingHours) {
      const now = new Date(currentTime.toLocaleString('en-US', { timeZone: timezone }));

      if (isWeekend) {
        // Find next Monday
        const daysUntilMonday = localDayOfWeek === 0 ? 1 : (8 - localDayOfWeek);
        nextWorkingHoursStart = new Date(now);
        nextWorkingHoursStart.setDate(now.getDate() + daysUntilMonday);
        nextWorkingHoursStart.setHours(workingHoursStart, 0, 0, 0);
      } else if (localHour < workingHoursStart) {
        // Before working hours today
        nextWorkingHoursStart = new Date(now);
        nextWorkingHoursStart.setHours(workingHoursStart, 0, 0, 0);
      } else {
        // After working hours today - next day
        nextWorkingHoursStart = new Date(now);
        nextWorkingHoursStart.setDate(now.getDate() + 1);
        nextWorkingHoursStart.setHours(workingHoursStart, 0, 0, 0);

        // Check if next day is weekend
        const nextDayOfWeek = nextWorkingHoursStart.getDay();
        if (nextDayOfWeek === 0) {
          // Sunday -> skip to Monday
          nextWorkingHoursStart.setDate(nextWorkingHoursStart.getDate() + 1);
        } else if (nextDayOfWeek === 6) {
          // Saturday -> skip to Monday
          nextWorkingHoursStart.setDate(nextWorkingHoursStart.getDate() + 2);
        }
      }
    }

    return {
      isWorkingHours,
      isWeekend,
      timezone,
      workingHoursStart,
      workingHoursEnd,
      currentHour: localHour,
      nextWorkingHoursStart,
    };
  }, [userData, currentTime]);
}

/**
 * Simplified hook that just returns whether it's currently working hours.
 * Use this for simple conditional logic.
 */
export function useIsWorkingHours(): boolean {
  const { isWorkingHours } = useWorkingHours();
  return isWorkingHours;
}

/**
 * Hook that returns whether we're in minimal polling mode (weekends or off-hours).
 * In minimal mode, only critical data (notifications) should be polled.
 */
export function useIsMinimalPollingMode(): boolean {
  const { isWorkingHours } = useWorkingHours();
  return !isWorkingHours;
}
