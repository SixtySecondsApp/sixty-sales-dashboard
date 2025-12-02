/**
 * Accessibility Utilities for Calendar Feature
 *
 * Provides helper functions for ARIA labels, keyboard navigation,
 * and screen reader announcements.
 */

import { format, isSameDay, isToday, isBefore, isAfter } from 'date-fns';

/**
 * Generate accessible label for calendar date cell
 */
export function getDateCellLabel(date: Date, eventCount: number = 0): string {
  const dateStr = format(date, 'EEEE, MMMM d, yyyy');

  if (isToday(date)) {
    return eventCount > 0
      ? `Today, ${dateStr}, ${eventCount} event${eventCount > 1 ? 's' : ''}`
      : `Today, ${dateStr}, no events`;
  }

  if (eventCount > 0) {
    return `${dateStr}, ${eventCount} event${eventCount > 1 ? 's' : ''}`;
  }

  return `${dateStr}, no events`;
}

/**
 * Generate accessible label for event item
 */
export function getEventLabel(event: {
  title: string;
  start: Date;
  end?: Date;
  location?: string;
  attendees?: string[];
}): string {
  const parts = [event.title];

  // Add time information
  if (event.end) {
    const duration = format(event.start, 'h:mm a') + ' to ' + format(event.end, 'h:mm a');
    parts.push(duration);
  } else {
    parts.push('at ' + format(event.start, 'h:mm a'));
  }

  // Add location if present
  if (event.location) {
    parts.push('location: ' + event.location);
  }

  // Add attendee count if present
  if (event.attendees && event.attendees.length > 0) {
    parts.push(`${event.attendees.length} attendee${event.attendees.length > 1 ? 's' : ''}`);
  }

  return parts.join(', ');
}

/**
 * Generate accessible label for calendar navigation buttons
 */
export function getNavigationLabel(action: 'prev' | 'next' | 'today', view: string, currentDate: Date): string {
  if (action === 'today') {
    return 'Go to today';
  }

  const month = format(currentDate, 'MMMM yyyy');

  if (action === 'prev') {
    return view === 'month'
      ? `Previous month, currently ${month}`
      : view === 'week'
      ? `Previous week`
      : `Previous day`;
  }

  return view === 'month'
    ? `Next month, currently ${month}`
    : view === 'week'
    ? `Next week`
    : `Next day`;
}

/**
 * Generate accessible label for time slot
 */
export function getTimeSlotLabel(time: Date, isAvailable: boolean = true): string {
  const timeStr = format(time, 'h:mm a');
  return isAvailable
    ? `${timeStr}, available`
    : `${timeStr}, busy`;
}

/**
 * Generate conflict warning for screen readers
 */
export function getConflictAnnouncement(conflictCount: number, severity: 'high' | 'medium' | 'low'): string {
  const severityText = severity === 'high' ? 'critical' : severity === 'medium' ? 'moderate' : 'minor';

  if (conflictCount === 0) {
    return 'No conflicts detected';
  }

  if (conflictCount === 1) {
    return `Warning: ${severityText} conflict detected with 1 existing event`;
  }

  return `Warning: ${severityText} conflicts detected with ${conflictCount} existing events`;
}

/**
 * Generate sync status announcement for screen readers
 */
export function getSyncStatusAnnouncement(status: {
  isRunning: boolean;
  eventsCreated?: number;
  eventsUpdated?: number;
  error?: string;
}): string {
  if (status.error) {
    return `Sync failed: ${status.error}`;
  }

  if (status.isRunning) {
    return 'Syncing calendar events';
  }

  const parts = [];
  if (status.eventsCreated) {
    parts.push(`${status.eventsCreated} new event${status.eventsCreated > 1 ? 's' : ''}`);
  }
  if (status.eventsUpdated) {
    parts.push(`${status.eventsUpdated} updated event${status.eventsUpdated > 1 ? 's' : ''}`);
  }

  if (parts.length > 0) {
    return `Sync complete: ${parts.join(', ')}`;
  }

  return 'Calendar synchronized';
}

/**
 * Generate event saved announcement for screen readers
 */
export function getEventSavedAnnouncement(event: {
  title: string;
  start: Date;
  isNew: boolean;
}): string {
  const action = event.isNew ? 'created' : 'updated';
  const date = format(event.start, 'EEEE, MMMM d');
  const time = format(event.start, 'h:mm a');

  return `Event ${action}: ${event.title} on ${date} at ${time}`;
}

/**
 * Generate event deleted announcement for screen readers
 */
export function getEventDeletedAnnouncement(title: string): string {
  return `Event deleted: ${title}`;
}

/**
 * Keyboard navigation key codes
 */
export const KEYBOARD_KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
} as const;

/**
 * Check if element should be trapped within modal
 */
export function isTabTrappedElement(element: Element, container: Element): boolean {
  const focusableElements = getFocusableElements(container);
  return focusableElements.includes(element as HTMLElement);
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: Element): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll(selector)) as HTMLElement[];
}

/**
 * Trap focus within a modal dialog
 */
export function trapFocus(event: KeyboardEvent, container: Element): void {
  if (event.key !== KEYBOARD_KEYS.TAB) return;

  const focusableElements = getFocusableElements(container);
  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  // Shift + Tab
  if (event.shiftKey) {
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
}

/**
 * Restore focus to previously focused element
 */
export function restoreFocus(previousElement: HTMLElement | null): void {
  if (previousElement && typeof previousElement.focus === 'function') {
    // Use setTimeout to ensure focus happens after modal closes
    setTimeout(() => {
      previousElement.focus();
    }, 100);
  }
}

/**
 * Announce message to screen readers via live region
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
  // Get or create live region
  let liveRegion = document.getElementById('calendar-announcements');

  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'calendar-announcements';
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.className = 'sr-only';
    document.body.appendChild(liveRegion);
  }

  // Update aria-live if priority changed
  if (liveRegion.getAttribute('aria-live') !== priority) {
    liveRegion.setAttribute('aria-live', priority);
  }

  // Clear and set new message
  liveRegion.textContent = '';
  setTimeout(() => {
    liveRegion!.textContent = message;
  }, 100);
}

/**
 * Generate accessible description for recurring event
 */
export function getRecurrenceDescription(pattern: {
  frequency: string;
  interval?: number;
  endDate?: Date;
  endAfterOccurrences?: number;
}): string {
  const parts = [];

  // Frequency
  if (pattern.interval && pattern.interval > 1) {
    parts.push(`Every ${pattern.interval} ${pattern.frequency}s`);
  } else {
    parts.push(`${pattern.frequency}ly`);
  }

  // End condition
  if (pattern.endDate) {
    parts.push(`until ${format(pattern.endDate, 'MMMM d, yyyy')}`);
  } else if (pattern.endAfterOccurrences) {
    parts.push(`for ${pattern.endAfterOccurrences} occurrence${pattern.endAfterOccurrences > 1 ? 's' : ''}`);
  }

  return parts.join(', ');
}

/**
 * Generate accessible filter status announcement
 */
export function getFilterStatusAnnouncement(
  selectedCategories: string[],
  searchTerm: string,
  resultCount: number
): string {
  const parts = [];

  if (searchTerm) {
    parts.push(`searching for "${searchTerm}"`);
  }

  if (selectedCategories.length > 0) {
    parts.push(`filtered by ${selectedCategories.length} categor${selectedCategories.length > 1 ? 'ies' : 'y'}`);
  }

  const filterText = parts.length > 0 ? parts.join(', ') : 'showing all events';

  return `${filterText}, ${resultCount} event${resultCount !== 1 ? 's' : ''} found`;
}

/**
 * Check if element is visible to screen readers
 */
export function isAriaHidden(element: Element): boolean {
  if (element.getAttribute('aria-hidden') === 'true') {
    return true;
  }

  const parent = element.parentElement;
  if (parent) {
    return isAriaHidden(parent);
  }

  return false;
}

/**
 * Generate accessible label for view switcher
 */
export function getViewSwitcherLabel(view: string, isActive: boolean): string {
  const viewName = view === 'dayGridMonth' ? 'Month' :
                   view === 'timeGridWeek' ? 'Week' :
                   view === 'timeGridDay' ? 'Day' :
                   'Agenda';

  return isActive
    ? `${viewName} view, currently selected`
    : `Switch to ${viewName} view`;
}

/**
 * EMAIL ACCESSIBILITY UTILITIES
 */

/**
 * Generate accessible label for email item
 */
export function getEmailLabel(email: {
  from: string;
  subject: string;
  preview: string;
  timestamp: Date;
  read: boolean;
  starred: boolean;
  attachments?: number;
}): string {
  const parts = [
    email.read ? 'Read' : 'Unread',
    email.starred ? 'Starred' : '',
    `From ${email.from}`,
    `Subject: ${email.subject}`,
    format(email.timestamp, 'MMMM d, h:mm a'),
  ].filter(Boolean);

  if (email.attachments && email.attachments > 0) {
    parts.push(`${email.attachments} attachment${email.attachments > 1 ? 's' : ''}`);
  }

  return parts.join(', ');
}

/**
 * Generate accessible label for email composer buttons
 */
export function getComposerButtonLabel(action: string): string {
  const labels: Record<string, string> = {
    send: 'Send email',
    save: 'Save draft',
    minimize: 'Minimize composer',
    close: 'Close composer',
    attach: 'Attach file',
    template: 'Insert template',
    aiTemplate: 'AI-powered templates',
    aiSuggestion: 'AI suggestions',
    schedule: 'Schedule send',
    format: 'Format text',
    emoji: 'Insert emoji',
    cc: 'Show CC field',
    bcc: 'Show BCC field',
  };

  return labels[action] || action;
}

/**
 * Generate announcement for email action
 */
export function getEmailActionAnnouncement(
  action: 'sent' | 'draft' | 'scheduled' | 'archived' | 'deleted' | 'starred' | 'unstarred' | 'read' | 'unread',
  count: number = 1
): string {
  const actionText: Record<string, string> = {
    sent: 'sent',
    draft: 'saved as draft',
    scheduled: 'scheduled',
    archived: 'archived',
    deleted: 'deleted',
    starred: 'starred',
    unstarred: 'unstarred',
    read: 'marked as read',
    unread: 'marked as unread',
  };

  const text = actionText[action] || action;

  if (count === 1) {
    return `Email ${text}`;
  }

  return `${count} emails ${text}`;
}

/**
 * Generate accessible label for email folder
 */
export function getEmailFolderLabel(folder: string, unreadCount?: number): string {
  const folderName = folder.charAt(0).toUpperCase() + folder.slice(1);

  if (unreadCount && unreadCount > 0) {
    return `${folderName}, ${unreadCount} unread`;
  }

  return folderName;
}

/**
 * Generate announcement for bulk selection
 */
export function getBulkSelectionAnnouncement(
  selectedCount: number,
  totalCount: number,
  action?: 'selected' | 'deselected' | 'all'
): string {
  if (action === 'all') {
    return `All ${totalCount} emails selected`;
  }

  if (selectedCount === 0) {
    return 'All emails deselected';
  }

  if (selectedCount === totalCount) {
    return `All ${totalCount} emails selected`;
  }

  return `${selectedCount} of ${totalCount} emails selected`;
}

/**
 * Generate accessible label for email thread
 */
export function getEmailThreadLabel(threadCount: number, collapsed: boolean): string {
  if (collapsed) {
    return `Email thread with ${threadCount} message${threadCount > 1 ? 's' : ''}, collapsed. Press Enter to expand.`;
  }

  return `Email thread with ${threadCount} message${threadCount > 1 ? 's' : ''}, expanded. Press Enter to collapse.`;
}

/**
 * Generate accessible label for formatting button
 */
export function getFormattingButtonLabel(format: string, isActive: boolean): string {
  const labels: Record<string, string> = {
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    link: 'Insert link',
    list: 'Bullet list',
    orderedList: 'Numbered list',
    quote: 'Quote',
    code: 'Code block',
  };

  const label = labels[format] || format;

  return isActive ? `${label}, active` : label;
}

/**
 * Generate announcement for email loading state
 */
export function getEmailLoadingAnnouncement(isLoading: boolean, count?: number): string {
  if (isLoading) {
    return 'Loading emails';
  }

  if (count !== undefined) {
    return `${count} email${count !== 1 ? 's' : ''} loaded`;
  }

  return 'Emails loaded';
}

/**
 * Generate announcement for search results
 */
export function getSearchResultsAnnouncement(query: string, count: number): string {
  if (count === 0) {
    return `No results found for "${query}"`;
  }

  if (count === 1) {
    return `1 result found for "${query}"`;
  }

  return `${count} results found for "${query}"`;
}

/**
 * Generate accessible label for attachment
 */
export function getAttachmentLabel(
  filename: string,
  size?: number,
  type?: string
): string {
  const parts = [filename];

  if (type) {
    parts.push(type);
  }

  if (size) {
    const sizeKB = Math.round(size / 1024);
    const sizeMB = Math.round(sizeKB / 1024);

    if (sizeMB > 1) {
      parts.push(`${sizeMB} MB`);
    } else {
      parts.push(`${sizeKB} KB`);
    }
  }

  return parts.join(', ');
}

/**
 * React hook for focus trap in email modals
 */
export function useEmailFocusTrap(
  isOpen: boolean,
  containerRef: React.RefObject<HTMLElement>,
  initialFocusRef?: React.RefObject<HTMLElement>
) {
  const previousActiveElementRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    // Store previous focus
    previousActiveElementRef.current = document.activeElement as HTMLElement;

    // Focus initial element
    const initialElement = initialFocusRef?.current || getFocusableElements(containerRef.current)[0];
    initialElement?.focus();

    // Trap focus
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === KEYBOARD_KEYS.TAB && containerRef.current) {
        trapFocus(e, containerRef.current);
      }

      if (e.key === KEYBOARD_KEYS.ESCAPE) {
        // Let parent handle close
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus
      restoreFocus(previousActiveElementRef.current);
    };
  }, [isOpen, containerRef, initialFocusRef]);
}

// Import React for the hook
import * as React from 'react';
