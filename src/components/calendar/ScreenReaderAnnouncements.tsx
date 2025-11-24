/**
 * Screen Reader Announcements Component
 *
 * Provides ARIA live regions for screen reader announcements
 * in the Calendar feature.
 */

import React, { useEffect, useState } from 'react';

export interface ScreenReaderAnnouncementsProps {
  /**
   * Announcement message to be read by screen readers
   */
  message?: string;

  /**
   * Priority level for the announcement
   * - polite: Wait for user to finish current task
   * - assertive: Interrupt current task immediately
   */
  priority?: 'polite' | 'assertive';

  /**
   * Clear message after specified milliseconds
   */
  clearAfter?: number;
}

/**
 * Screen Reader Announcements Component
 *
 * Invisible component that announces messages to screen readers via ARIA live regions.
 */
export const ScreenReaderAnnouncements: React.FC<ScreenReaderAnnouncementsProps> = ({
  message = '',
  priority = 'polite',
  clearAfter = 5000,
}) => {
  const [currentMessage, setCurrentMessage] = useState(message);

  useEffect(() => {
    if (message) {
      setCurrentMessage(message);

      // Clear message after specified time
      if (clearAfter > 0) {
        const timer = setTimeout(() => {
          setCurrentMessage('');
        }, clearAfter);

        return () => clearTimeout(timer);
      }
    }
  }, [message, clearAfter]);

  return (
    <>
      {/* Polite announcements - for non-critical updates */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="calendar-announcements-polite"
      >
        {priority === 'polite' ? currentMessage : ''}
      </div>

      {/* Assertive announcements - for critical updates */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
        id="calendar-announcements-assertive"
      >
        {priority === 'assertive' ? currentMessage : ''}
      </div>
    </>
  );
};

/**
 * Hook for managing screen reader announcements
 */
export function useScreenReaderAnnouncement() {
  const [announcement, setAnnouncement] = useState<{
    message: string;
    priority: 'polite' | 'assertive';
  }>({ message: '', priority: 'polite' });

  /**
   * Announce a message to screen readers
   */
  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    // Clear first to ensure announcement is always read
    setAnnouncement({ message: '', priority });

    setTimeout(() => {
      setAnnouncement({ message, priority });
    }, 100);
  };

  /**
   * Clear current announcement
   */
  const clear = () => {
    setAnnouncement({ message: '', priority: 'polite' });
  };

  return {
    announcement: announcement.message,
    priority: announcement.priority,
    announce,
    clear,
  };
}

/**
 * Screen Reader Only Text Component
 *
 * Content that is only visible to screen readers
 */
export const ScreenReaderOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <span className="sr-only">
      {children}
    </span>
  );
};

/**
 * Visually Hidden Component
 *
 * Content that is visually hidden but accessible to screen readers
 * Use this for additional context that doesn't need visual representation
 */
export const VisuallyHidden: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <span
      className={`absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0 ${className}`}
      style={{
        clip: 'rect(0, 0, 0, 0)',
        clipPath: 'inset(50%)',
      }}
    >
      {children}
    </span>
  );
};
