/**
 * Keyboard Navigation Hook for Calendar
 *
 * Provides comprehensive keyboard shortcuts for calendar navigation,
 * event selection, and accessibility features.
 */

import { useEffect, useCallback, useRef } from 'react';
import { addDays, addWeeks, addMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { KEYBOARD_KEYS, announceToScreenReader } from '@/lib/utils/accessibilityUtils';

export interface KeyboardNavigationOptions {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onEventSelect?: (eventId: string) => void;
  onEventCreate?: () => void;
  onViewChange?: (view: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay') => void;
  currentView?: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay';
  enabled?: boolean;
}

/**
 * Hook for handling calendar keyboard navigation
 */
export function useKeyboardNavigation({
  selectedDate,
  onDateChange,
  onEventSelect,
  onEventCreate,
  onViewChange,
  currentView = 'dayGridMonth',
  enabled = true,
}: KeyboardNavigationOptions) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  /**
   * Navigate to previous period
   */
  const navigatePrevious = useCallback(() => {
    let newDate: Date;

    switch (currentView) {
      case 'dayGridMonth':
        newDate = addMonths(selectedDate, -1);
        announceToScreenReader(`Navigated to ${newDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
        break;
      case 'timeGridWeek':
        newDate = addWeeks(selectedDate, -1);
        announceToScreenReader('Navigated to previous week');
        break;
      case 'timeGridDay':
        newDate = addDays(selectedDate, -1);
        announceToScreenReader(`Navigated to ${newDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`);
        break;
      default:
        return;
    }

    onDateChange(newDate);
  }, [selectedDate, currentView, onDateChange]);

  /**
   * Navigate to next period
   */
  const navigateNext = useCallback(() => {
    let newDate: Date;

    switch (currentView) {
      case 'dayGridMonth':
        newDate = addMonths(selectedDate, 1);
        announceToScreenReader(`Navigated to ${newDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
        break;
      case 'timeGridWeek':
        newDate = addWeeks(selectedDate, 1);
        announceToScreenReader('Navigated to next week');
        break;
      case 'timeGridDay':
        newDate = addDays(selectedDate, 1);
        announceToScreenReader(`Navigated to ${newDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`);
        break;
      default:
        return;
    }

    onDateChange(newDate);
  }, [selectedDate, currentView, onDateChange]);

  /**
   * Navigate to today
   */
  const navigateToday = useCallback(() => {
    const today = new Date();
    onDateChange(today);
    announceToScreenReader('Navigated to today');
  }, [onDateChange]);

  /**
   * Navigate by arrow keys
   */
  const navigateByArrow = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    let newDate: Date;

    switch (currentView) {
      case 'dayGridMonth':
        // In month view: arrows navigate days, up/down navigates weeks
        switch (direction) {
          case 'left':
            newDate = addDays(selectedDate, -1);
            break;
          case 'right':
            newDate = addDays(selectedDate, 1);
            break;
          case 'up':
            newDate = addDays(selectedDate, -7);
            break;
          case 'down':
            newDate = addDays(selectedDate, 7);
            break;
        }
        break;

      case 'timeGridWeek':
        // In week view: left/right navigates days, up/down navigates hours
        switch (direction) {
          case 'left':
            newDate = addDays(selectedDate, -1);
            break;
          case 'right':
            newDate = addDays(selectedDate, 1);
            break;
          case 'up':
          case 'down':
            // Hour navigation would be handled by time grid component
            return;
        }
        break;

      case 'timeGridDay':
        // In day view: up/down navigates hours
        switch (direction) {
          case 'left':
          case 'right':
            // No horizontal navigation in day view
            return;
          case 'up':
          case 'down':
            // Hour navigation would be handled by time grid component
            return;
        }
        return;

      default:
        return;
    }

    onDateChange(newDate);
    announceToScreenReader(`Selected ${newDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`);
  }, [selectedDate, currentView, onDateChange]);

  /**
   * Navigate to start/end of period
   */
  const navigateBoundary = useCallback((boundary: 'start' | 'end') => {
    let newDate: Date;

    switch (currentView) {
      case 'dayGridMonth':
        newDate = boundary === 'start' ? startOfMonth(selectedDate) : endOfMonth(selectedDate);
        announceToScreenReader(`Navigated to ${boundary} of month`);
        break;
      case 'timeGridWeek':
        newDate = boundary === 'start' ? startOfWeek(selectedDate) : endOfWeek(selectedDate);
        announceToScreenReader(`Navigated to ${boundary} of week`);
        break;
      default:
        return;
    }

    onDateChange(newDate);
  }, [selectedDate, currentView, onDateChange]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Check if user is typing in an input field
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isInputField && !event.metaKey && !event.ctrlKey) {
        return; // Don't intercept typing
      }

      // Keyboard shortcuts
      switch (event.key) {
        // Navigation shortcuts
        case KEYBOARD_KEYS.ARROW_LEFT:
          event.preventDefault();
          navigateByArrow('left');
          break;

        case KEYBOARD_KEYS.ARROW_RIGHT:
          event.preventDefault();
          navigateByArrow('right');
          break;

        case KEYBOARD_KEYS.ARROW_UP:
          event.preventDefault();
          navigateByArrow('up');
          break;

        case KEYBOARD_KEYS.ARROW_DOWN:
          event.preventDefault();
          navigateByArrow('down');
          break;

        case KEYBOARD_KEYS.PAGE_UP:
          event.preventDefault();
          navigatePrevious();
          break;

        case KEYBOARD_KEYS.PAGE_DOWN:
          event.preventDefault();
          navigateNext();
          break;

        case KEYBOARD_KEYS.HOME:
          event.preventDefault();
          navigateBoundary('start');
          break;

        case KEYBOARD_KEYS.END:
          event.preventDefault();
          navigateBoundary('end');
          break;

        // Quick actions
        case 't':
        case 'T':
          if (!isInputField) {
            event.preventDefault();
            navigateToday();
          }
          break;

        case 'n':
        case 'N':
          if (!isInputField && onEventCreate) {
            event.preventDefault();
            onEventCreate();
            announceToScreenReader('Creating new event');
          }
          break;

        // View switching (with Ctrl/Cmd)
        case '1':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onViewChange?.('dayGridMonth');
            announceToScreenReader('Switched to month view');
          }
          break;

        case '2':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onViewChange?.('timeGridWeek');
            announceToScreenReader('Switched to week view');
          }
          break;

        case '3':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onViewChange?.('timeGridDay');
            announceToScreenReader('Switched to day view');
          }
          break;

        // Help shortcut
        case '?':
          if (!isInputField) {
            event.preventDefault();
            announceToScreenReader('Keyboard shortcuts: Arrow keys to navigate, T for today, N for new event, Ctrl+1/2/3 to switch views, Page Up/Down for previous/next period');
          }
          break;

        default:
          break;
      }
    },
    [
      enabled,
      navigateByArrow,
      navigatePrevious,
      navigateNext,
      navigateBoundary,
      navigateToday,
      onEventCreate,
      onViewChange,
    ]
  );

  /**
   * Set up keyboard event listeners
   */
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  /**
   * Store and restore focus
   */
  const storeFocus = useCallback(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
  }, []);

  const restoreFocus = useCallback(() => {
    if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
      setTimeout(() => {
        previousFocusRef.current?.focus();
      }, 100);
    }
  }, []);

  return {
    navigatePrevious,
    navigateNext,
    navigateToday,
    navigateByArrow,
    navigateBoundary,
    storeFocus,
    restoreFocus,
  };
}

/**
 * Hook for managing modal focus trap
 */
export function useFocusTrap(
  isOpen: boolean,
  containerRef: React.RefObject<HTMLElement>,
  onClose?: () => void
) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    // Store previous focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Get focusable elements
    const container = containerRef.current;
    const getFocusableElements = () => {
      const selector = [
        'a[href]',
        'button:not([disabled])',
        'textarea:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ');

      return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
    };

    // Focus first element
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      setTimeout(() => {
        focusableElements[0]?.focus();
      }, 100);
    }

    // Handle Tab key for focus trapping
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== KEYBOARD_KEYS.TAB) {
        if (event.key === KEYBOARD_KEYS.ESCAPE && onClose) {
          event.preventDefault();
          onClose();
        }
        return;
      }

      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      container.removeEventListener('keydown', handleKeyDown);

      // Restore focus
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        setTimeout(() => {
          previousFocusRef.current?.focus();
        }, 100);
      }
    };
  }, [isOpen, containerRef, onClose]);
}
