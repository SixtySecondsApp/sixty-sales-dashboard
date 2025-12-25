import { useState, useEffect, useRef, useCallback } from 'react';

interface UserActivityState {
  isActive: boolean;
  lastActivityTime: number;
  idleTime: number;
  isTabVisible: boolean;
}

const DEFAULT_IDLE_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds
const ACTIVITY_CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds

/**
 * Hook to detect if the user is actively using the application.
 * Used for smart polling to reduce API calls when user is idle.
 *
 * Features:
 * - Tracks mouse, keyboard, scroll, and touch events
 * - Configurable idle threshold (default 5 minutes)
 * - Tab visibility detection
 * - Provides idle duration for graduated response
 *
 * @param idleThreshold - Time in milliseconds before user is considered idle (default: 5 minutes)
 * @returns UserActivityState with activity status and timing info
 */
export function useUserActivity(idleThreshold = DEFAULT_IDLE_THRESHOLD): UserActivityState {
  const [isActive, setIsActive] = useState(true);
  const [isTabVisible, setIsTabVisible] = useState(!document.hidden);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [idleTime, setIdleTime] = useState(0);

  const lastActivityRef = useRef(Date.now());
  const throttleRef = useRef<number | null>(null);

  // Throttled activity handler to prevent excessive state updates
  const handleActivity = useCallback(() => {
    const now = Date.now();

    // Throttle updates to every 1 second
    if (throttleRef.current && now - throttleRef.current < 1000) {
      return;
    }

    throttleRef.current = now;
    lastActivityRef.current = now;

    // Only update state if we were idle
    if (!isActive || idleTime > 0) {
      setIsActive(true);
      setLastActivityTime(now);
      setIdleTime(0);
    }
  }, [isActive, idleTime]);

  // Handle visibility change
  const handleVisibilityChange = useCallback(() => {
    const visible = !document.hidden;
    setIsTabVisible(visible);

    if (visible) {
      // When tab becomes visible, consider user active
      handleActivity();
    }
  }, [handleActivity]);

  useEffect(() => {
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'keypress',
      'scroll',
      'touchstart',
      'touchmove',
      'wheel',
      'click',
    ];

    // Add activity event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Check for idle status periodically
    const checkIdle = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;

      setIdleTime(elapsed);

      if (elapsed > idleThreshold) {
        setIsActive(false);
      }
    }, ACTIVITY_CHECK_INTERVAL);

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(checkIdle);
    };
  }, [handleActivity, handleVisibilityChange, idleThreshold]);

  return {
    isActive,
    lastActivityTime,
    idleTime,
    isTabVisible,
  };
}

/**
 * Simplified hook that just returns whether the user is active.
 * Use this for simple conditional logic.
 */
export function useIsUserActive(idleThreshold = DEFAULT_IDLE_THRESHOLD): boolean {
  const { isActive, isTabVisible } = useUserActivity(idleThreshold);
  // Consider user inactive if tab is not visible OR if they're idle
  return isActive && isTabVisible;
}

/**
 * Hook that returns a multiplier for polling intervals based on activity.
 * - Active user + visible tab: 1x (normal)
 * - Idle user + visible tab: 5x (slower)
 * - Hidden tab: 10x (much slower)
 * - Hidden tab + idle: false (disabled)
 */
export function useActivityPollingMultiplier(idleThreshold = DEFAULT_IDLE_THRESHOLD): number | false {
  const { isActive, isTabVisible, idleTime } = useUserActivity(idleThreshold);

  if (!isTabVisible && !isActive) {
    // Tab hidden and user idle - disable polling entirely
    return false;
  }

  if (!isTabVisible) {
    // Tab hidden but user was recently active
    return 10;
  }

  if (!isActive) {
    // Tab visible but user is idle
    // Graduated response based on how long they've been idle
    if (idleTime > idleThreshold * 2) {
      return 10; // Very idle (10+ minutes)
    }
    return 5; // Just idle (5-10 minutes)
  }

  // Active user, visible tab
  return 1;
}
