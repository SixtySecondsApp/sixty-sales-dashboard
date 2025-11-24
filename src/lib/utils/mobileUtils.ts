/**
 * Mobile Utilities for Touch Gestures
 *
 * Provides utilities for handling swipe gestures and touch interactions
 * in email components with proper accessibility considerations.
 */

import React from 'react';

export interface SwipeConfig {
  threshold?: number; // Minimum distance for swipe (default: 100px)
  timeout?: number; // Maximum time for swipe (default: 300ms)
  restraint?: number; // Maximum perpendicular movement (default: 100px)
}

export interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

export type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null;

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  distX: number;
  distY: number;
  elapsedTime: number;
  direction: SwipeDirection;
}

/**
 * Create touch event handlers for swipe gestures
 */
export function createSwipeHandlers(
  handlers: SwipeHandlers,
  config: SwipeConfig = {}
) {
  const threshold = config.threshold ?? 100;
  const timeout = config.timeout ?? 300;
  const restraint = config.restraint ?? 100;

  let touchState: TouchState = {
    startX: 0,
    startY: 0,
    startTime: 0,
    distX: 0,
    distY: 0,
    elapsedTime: 0,
    direction: null,
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchState = {
      startX: touch.pageX,
      startY: touch.pageY,
      startTime: Date.now(),
      distX: 0,
      distY: 0,
      elapsedTime: 0,
      direction: null,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!e.touches[0]) return;

    const touch = e.touches[0];
    const currentDistX = touch.pageX - touchState.startX;
    const currentDistY = touch.pageY - touchState.startY;

    // Prevent default to avoid scrolling while swiping horizontally
    if (Math.abs(currentDistX) > 30 && Math.abs(currentDistX) > Math.abs(currentDistY)) {
      e.preventDefault();
    }

    // Update state for visual feedback if needed
    touchState.distX = currentDistX;
    touchState.distY = currentDistY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];

    touchState.distX = touch.pageX - touchState.startX;
    touchState.distY = touch.pageY - touchState.startY;
    touchState.elapsedTime = Date.now() - touchState.startTime;

    // Check if swipe meets threshold requirements
    if (touchState.elapsedTime <= timeout) {
      // Horizontal swipe
      if (Math.abs(touchState.distX) >= threshold && Math.abs(touchState.distY) <= restraint) {
        touchState.direction = touchState.distX < 0 ? 'left' : 'right';

        if (touchState.direction === 'left' && handlers.onSwipeLeft) {
          handlers.onSwipeLeft();
        } else if (touchState.direction === 'right' && handlers.onSwipeRight) {
          handlers.onSwipeRight();
        }
      }
      // Vertical swipe
      else if (Math.abs(touchState.distY) >= threshold && Math.abs(touchState.distX) <= restraint) {
        touchState.direction = touchState.distY < 0 ? 'up' : 'down';

        if (touchState.direction === 'up' && handlers.onSwipeUp) {
          handlers.onSwipeUp();
        } else if (touchState.direction === 'down' && handlers.onSwipeDown) {
          handlers.onSwipeDown();
        }
      }
    }

    // Reset state
    touchState = {
      startX: 0,
      startY: 0,
      startTime: 0,
      distX: 0,
      distY: 0,
      elapsedTime: 0,
      direction: null,
    };
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
}

/**
 * Check if device is mobile/touch-enabled
 */
export function isTouchDevice(): boolean {
  // Only run on client side
  if (typeof window === 'undefined') return false;

  return (
    'ontouchstart' in window ||
    (window.navigator && navigator.maxTouchPoints > 0) ||
    // @ts-ignore - legacy property
    (window.navigator && navigator.msMaxTouchPoints > 0)
  );
}

/**
 * Get optimal touch target size based on device
 */
export function getTouchTargetSize(): number {
  // WCAG 2.1 AA recommends minimum 44x44px touch targets
  return isTouchDevice() ? 44 : 32;
}

/**
 * Check if element meets minimum touch target size
 */
export function meetsMinimumTouchTarget(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  const minSize = getTouchTargetSize();
  return rect.width >= minSize && rect.height >= minSize;
}

/**
 * Haptic feedback for touch interactions (if supported)
 */
export function hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  if ('vibrate' in navigator) {
    const patterns = {
      light: 10,
      medium: 20,
      heavy: 30,
    };
    navigator.vibrate(patterns[style]);
  }
}

/**
 * Debounce touch events to prevent duplicate actions
 */
export function debounceTouchEvent<T extends (...args: any[]) => any>(
  func: T,
  wait: number = 300
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Prevent double-tap zoom on mobile
 */
export function preventDoubleTapZoom(element: HTMLElement): void {
  let lastTouchEnd = 0;

  element.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, false);
}

/**
 * Get swipe icon and color based on direction
 */
export function getSwipeIndicator(direction: SwipeDirection): {
  icon: string;
  color: string;
  action: string;
} {
  switch (direction) {
    case 'left':
      return {
        icon: 'Archive',
        color: 'bg-emerald-500',
        action: 'Archive',
      };
    case 'right':
      return {
        icon: 'Star',
        color: 'bg-yellow-500',
        action: 'Star',
      };
    default:
      return {
        icon: '',
        color: '',
        action: '',
      };
  }
}
