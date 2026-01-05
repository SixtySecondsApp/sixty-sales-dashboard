/**
 * Date utilities for timezone-aware relative date parsing
 * Used by copilot meeting queries to interpret "today", "this week", etc.
 */

import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  differenceInMinutes,
  isWithinInterval,
  parseISO,
  format,
} from 'date-fns';

// ============================================================================
// Types
// ============================================================================

export interface DateRange {
  start: Date;
  end: Date;
}

export type RelativeDateTerm =
  | 'today'
  | 'tomorrow'
  | 'yesterday'
  | 'this_week'
  | 'next_week'
  | 'last_week'
  | 'this_month'
  | 'next_month'
  | 'last_month';

export interface DateParsingOptions {
  /** IANA timezone identifier (e.g., 'Europe/London'). Defaults to browser timezone. */
  timezone?: string;
  /** 0 = Sunday, 1 = Monday. Defaults to 1 (Monday). */
  weekStartsOn?: 0 | 1;
  /** Reference time for "now". Defaults to current time. */
  referenceDate?: Date;
}

// ============================================================================
// Timezone Utilities
// ============================================================================

/**
 * Get the browser's timezone using Intl API
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Get the current time in a specific timezone as a Date object.
 * Note: JavaScript Date objects are always in UTC internally,
 * but this returns a Date that represents the wall clock time in the given timezone.
 */
export function getNowInTimezone(timezone: string): Date {
  const now = new Date();

  // Get the date/time string in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const getValue = (type: string) => parts.find(p => p.type === type)?.value || '0';

  // Create a new Date representing the wall clock time in that timezone
  // This will be interpreted as local time, which is what we want for date-fns operations
  return new Date(
    parseInt(getValue('year')),
    parseInt(getValue('month')) - 1,
    parseInt(getValue('day')),
    parseInt(getValue('hour')),
    parseInt(getValue('minute')),
    parseInt(getValue('second'))
  );
}

/**
 * Convert a Date to ISO string in a specific timezone
 */
export function toISOStringInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return `${formatter.format(date)}T${timeFormatter.format(date)}`;
}

// ============================================================================
// Relative Date Parsing
// ============================================================================

/**
 * Parse a relative date term into an absolute date range.
 * All dates are calculated relative to the user's timezone.
 *
 * @example
 * // Get today's date range in London timezone
 * const range = parseRelativeDate('today', { timezone: 'Europe/London' });
 * // Returns { start: 2024-01-15T00:00:00, end: 2024-01-15T23:59:59 }
 */
export function parseRelativeDate(
  term: RelativeDateTerm,
  options: DateParsingOptions = {}
): DateRange {
  const {
    timezone = getBrowserTimezone(),
    weekStartsOn = 1, // Monday
    referenceDate,
  } = options;

  // Get "now" in the user's timezone
  const now = referenceDate || getNowInTimezone(timezone);

  switch (term) {
    case 'today':
      return {
        start: startOfDay(now),
        end: endOfDay(now),
      };

    case 'tomorrow':
      const tomorrow = addDays(now, 1);
      return {
        start: startOfDay(tomorrow),
        end: endOfDay(tomorrow),
      };

    case 'yesterday':
      const yesterday = addDays(now, -1);
      return {
        start: startOfDay(yesterday),
        end: endOfDay(yesterday),
      };

    case 'this_week':
      return {
        start: startOfWeek(now, { weekStartsOn }),
        end: endOfWeek(now, { weekStartsOn }),
      };

    case 'next_week':
      const nextWeekStart = addWeeks(startOfWeek(now, { weekStartsOn }), 1);
      return {
        start: nextWeekStart,
        end: endOfWeek(nextWeekStart, { weekStartsOn }),
      };

    case 'last_week':
      const lastWeekStart = addWeeks(startOfWeek(now, { weekStartsOn }), -1);
      return {
        start: lastWeekStart,
        end: endOfWeek(lastWeekStart, { weekStartsOn }),
      };

    case 'this_month':
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
      };

    case 'next_month':
      const nextMonthStart = addMonths(startOfMonth(now), 1);
      return {
        start: nextMonthStart,
        end: endOfMonth(nextMonthStart),
      };

    case 'last_month':
      const lastMonthStart = addMonths(startOfMonth(now), -1);
      return {
        start: lastMonthStart,
        end: endOfMonth(lastMonthStart),
      };

    default:
      throw new Error(`Unknown relative date term: ${term}`);
  }
}

/**
 * Parse natural language date input into a RelativeDateTerm
 *
 * @example
 * parseNaturalDateTerm('this week') // 'this_week'
 * parseNaturalDateTerm('tomorrow')  // 'tomorrow'
 */
export function parseNaturalDateTerm(input: string): RelativeDateTerm | null {
  const normalized = input.toLowerCase().trim();

  const mappings: Record<string, RelativeDateTerm> = {
    'today': 'today',
    'tomorrow': 'tomorrow',
    'yesterday': 'yesterday',
    'this week': 'this_week',
    'this_week': 'this_week',
    'next week': 'next_week',
    'next_week': 'next_week',
    'last week': 'last_week',
    'last_week': 'last_week',
    'this month': 'this_month',
    'this_month': 'this_month',
    'next month': 'next_month',
    'next_month': 'next_month',
    'last month': 'last_month',
    'last_month': 'last_month',
  };

  return mappings[normalized] || null;
}

// ============================================================================
// Meeting Deduplication Utilities
// ============================================================================

/**
 * Check if two time ranges overlap within a tolerance
 * Used for deduplicating meetings from different sources (e.g., SavvyCal + Google Calendar)
 *
 * @param range1 First date range
 * @param range2 Second date range
 * @param toleranceMinutes Maximum difference in start times to consider overlapping (default: 5)
 */
export function doRangesOverlap(
  range1: DateRange,
  range2: DateRange,
  toleranceMinutes: number = 5
): boolean {
  // Check if start times are within tolerance
  const startDiff = Math.abs(differenceInMinutes(range1.start, range2.start));
  if (startDiff <= toleranceMinutes) {
    return true;
  }

  // Check for actual time overlap
  return (
    isWithinInterval(range1.start, { start: range2.start, end: range2.end }) ||
    isWithinInterval(range2.start, { start: range1.start, end: range1.end })
  );
}

// ============================================================================
// Date Range Utilities
// ============================================================================

/**
 * Convert a DateRange to ISO strings for API calls
 */
export function dateRangeToISO(range: DateRange): { startISO: string; endISO: string } {
  return {
    startISO: range.start.toISOString(),
    endISO: range.end.toISOString(),
  };
}

/**
 * Format a DateRange for display
 */
export function formatDateRange(range: DateRange, formatStr: string = 'PPP'): string {
  const startStr = format(range.start, formatStr);
  const endStr = format(range.end, formatStr);

  if (startStr === endStr) {
    return startStr;
  }

  return `${startStr} - ${endStr}`;
}

/**
 * Get a human-readable label for a date range
 */
export function getDateRangeLabel(term: RelativeDateTerm): string {
  const labels: Record<RelativeDateTerm, string> = {
    today: 'Today',
    tomorrow: 'Tomorrow',
    yesterday: 'Yesterday',
    this_week: 'This Week',
    next_week: 'Next Week',
    last_week: 'Last Week',
    this_month: 'This Month',
    next_month: 'Next Month',
    last_month: 'Last Month',
  };

  return labels[term];
}

// ============================================================================
// Duration Utilities
// ============================================================================

/**
 * Calculate duration in minutes between two dates
 */
export function getDurationMinutes(start: Date | string, end: Date | string): number {
  const startDate = typeof start === 'string' ? parseISO(start) : start;
  const endDate = typeof end === 'string' ? parseISO(end) : end;

  return differenceInMinutes(endDate, startDate);
}

/**
 * Format duration in minutes to human-readable string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}
