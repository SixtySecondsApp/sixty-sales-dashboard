/**
 * Calendar Event Conflict Detection Utilities
 *
 * Provides functions to detect and analyze conflicts between calendar events.
 * A conflict occurs when two events overlap in time.
 */

import { CalendarEvent } from '@/pages/Calendar';

export interface EventConflict {
  conflictingEvent: CalendarEvent;
  conflictType: 'overlap' | 'double_booking' | 'partial';
  overlapStart: Date;
  overlapEnd: Date;
  severity: 'low' | 'medium' | 'high';
}

export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: EventConflict[];
  message?: string;
}

/**
 * Check if two events overlap in time
 */
export function eventsOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && end1 > start2;
}

/**
 * Determine the type of conflict between two events
 */
export function determineConflictType(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): 'overlap' | 'double_booking' | 'partial' {
  // Double booking: exact same time
  if (start1.getTime() === start2.getTime() && end1.getTime() === end2.getTime()) {
    return 'double_booking';
  }

  // Full overlap: one event completely contains the other
  if (
    (start1 >= start2 && end1 <= end2) ||
    (start2 >= start1 && end2 <= end1)
  ) {
    return 'overlap';
  }

  // Partial overlap
  return 'partial';
}

/**
 * Determine conflict severity based on overlap duration and type
 */
export function determineConflictSeverity(
  conflictType: 'overlap' | 'double_booking' | 'partial',
  overlapDurationMinutes: number
): 'low' | 'medium' | 'high' {
  if (conflictType === 'double_booking') {
    return 'high';
  }

  if (conflictType === 'overlap') {
    return 'medium';
  }

  // Partial overlap severity based on duration
  if (overlapDurationMinutes > 30) {
    return 'medium';
  }

  return 'low';
}

/**
 * Calculate overlap duration in minutes
 */
export function calculateOverlapDuration(overlapStart: Date, overlapEnd: Date): number {
  return Math.round((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60));
}

/**
 * Check for conflicts with existing events
 *
 * @param targetEvent - The event to check for conflicts
 * @param existingEvents - Array of existing events to check against
 * @param excludeEventId - Optional event ID to exclude (for editing scenarios)
 * @returns ConflictCheckResult with conflict information
 */
export function checkConflicts(
  targetEvent: {
    id?: string;
    start: Date;
    end?: Date;
  },
  existingEvents: CalendarEvent[],
  excludeEventId?: string
): ConflictCheckResult {
  const targetStart = targetEvent.start;
  const targetEnd = targetEvent.end || targetEvent.start;

  const conflicts: EventConflict[] = [];

  for (const event of existingEvents) {
    // Skip the event being edited
    if (event.id === excludeEventId || event.id === targetEvent.id) {
      continue;
    }

    // Skip cancelled events
    if ('status' in event && (event as any).status === 'cancelled') {
      continue;
    }

    const eventStart = event.start;
    const eventEnd = event.end || event.start;

    // Check for overlap
    if (eventsOverlap(targetStart, targetEnd, eventStart, eventEnd)) {
      const overlapStart = new Date(Math.max(targetStart.getTime(), eventStart.getTime()));
      const overlapEnd = new Date(Math.min(targetEnd.getTime(), eventEnd.getTime()));

      const conflictType = determineConflictType(
        targetStart,
        targetEnd,
        eventStart,
        eventEnd
      );

      const overlapDuration = calculateOverlapDuration(overlapStart, overlapEnd);
      const severity = determineConflictSeverity(conflictType, overlapDuration);

      conflicts.push({
        conflictingEvent: event,
        conflictType,
        overlapStart,
        overlapEnd,
        severity,
      });
    }
  }

  // Sort conflicts by severity (high > medium > low) and start time
  conflicts.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];

    if (severityDiff !== 0) {
      return severityDiff;
    }

    return a.overlapStart.getTime() - b.overlapStart.getTime();
  });

  const hasConflicts = conflicts.length > 0;
  const message = hasConflicts
    ? `Found ${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''} with existing events`
    : undefined;

  return {
    hasConflicts,
    conflicts,
    message,
  };
}

/**
 * Find available time slots on a given day
 *
 * @param date - The date to check
 * @param events - Array of events on that date
 * @param startHour - Start of working hours (default: 9)
 * @param endHour - End of working hours (default: 17)
 * @param slotDuration - Duration of each slot in minutes (default: 30)
 * @returns Array of available time slots
 */
export function findAvailableSlots(
  date: Date,
  events: CalendarEvent[],
  startHour: number = 9,
  endHour: number = 17,
  slotDuration: number = 30
): { start: Date; end: Date; isAvailable: boolean }[] {
  const slots: { start: Date; end: Date; isAvailable: boolean }[] = [];

  const dayStart = new Date(date);
  dayStart.setHours(startHour, 0, 0, 0);

  const dayEnd = new Date(date);
  dayEnd.setHours(endHour, 0, 0, 0);

  let currentTime = dayStart;

  while (currentTime < dayEnd) {
    const slotStart = new Date(currentTime);
    const slotEnd = new Date(currentTime);
    slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

    // Check if this slot conflicts with any event
    const hasConflict = events.some(event => {
      const eventStart = event.start;
      const eventEnd = event.end || event.start;

      // Skip cancelled events
      if ('status' in event && (event as any).status === 'cancelled') {
        return false;
      }

      return eventsOverlap(slotStart, slotEnd, eventStart, eventEnd);
    });

    slots.push({
      start: slotStart,
      end: slotEnd,
      isAvailable: !hasConflict,
    });

    currentTime = new Date(currentTime);
    currentTime.setMinutes(currentTime.getMinutes() + slotDuration);
  }

  return slots;
}

/**
 * Format conflict message for display
 */
export function formatConflictMessage(conflict: EventConflict): string {
  const duration = calculateOverlapDuration(conflict.overlapStart, conflict.overlapEnd);
  const timeFormat = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const overlapTime = `${timeFormat.format(conflict.overlapStart)} - ${timeFormat.format(conflict.overlapEnd)}`;

  switch (conflict.conflictType) {
    case 'double_booking':
      return `Double-booked with "${conflict.conflictingEvent.title}" at the same time`;
    case 'overlap':
      return `Overlaps completely with "${conflict.conflictingEvent.title}" (${duration} min)`;
    case 'partial':
      return `Partially overlaps with "${conflict.conflictingEvent.title}" at ${overlapTime} (${duration} min)`;
    default:
      return `Conflicts with "${conflict.conflictingEvent.title}"`;
  }
}
