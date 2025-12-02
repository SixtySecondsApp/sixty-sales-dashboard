/**
 * RRULE (Recurrence Rule) Utilities for Calendar Events
 *
 * Handles generation and parsing of RRULE strings for recurring events
 * following the iCalendar specification (RFC 5545).
 */

export interface RecurrencePattern {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval?: number; // Every N days/weeks/months/years
  count?: number; // Number of occurrences
  until?: Date; // End date
  byWeekDay?: string[]; // Days of week (MO, TU, WE, TH, FR, SA, SU)
  byMonthDay?: number[]; // Days of month (1-31)
  byMonth?: number[]; // Months (1-12)
}

const WEEKDAY_MAP: Record<string, string> = {
  Sunday: 'SU',
  Monday: 'MO',
  Tuesday: 'TU',
  Wednesday: 'WE',
  Thursday: 'TH',
  Friday: 'FR',
  Saturday: 'SA',
};

const WEEKDAY_REVERSE_MAP: Record<string, string> = {
  SU: 'Sunday',
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
};

/**
 * Generate an RRULE string from a recurrence pattern
 *
 * @param pattern - The recurrence pattern
 * @returns RRULE string (e.g., "FREQ=DAILY;INTERVAL=1;COUNT=10")
 */
export function generateRRule(pattern: RecurrencePattern): string {
  const parts: string[] = [];

  // Frequency (required)
  parts.push(`FREQ=${pattern.frequency}`);

  // Interval (optional, default is 1)
  if (pattern.interval && pattern.interval > 1) {
    parts.push(`INTERVAL=${pattern.interval}`);
  }

  // Count or Until (mutually exclusive)
  if (pattern.count) {
    parts.push(`COUNT=${pattern.count}`);
  } else if (pattern.until) {
    // Format: YYYYMMDDTHHMMSSZ (UTC)
    const utcDate = new Date(pattern.until);
    const formatted = utcDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    parts.push(`UNTIL=${formatted}`);
  }

  // By week day (for weekly recurrence)
  if (pattern.byWeekDay && pattern.byWeekDay.length > 0) {
    parts.push(`BYDAY=${pattern.byWeekDay.join(',')}`);
  }

  // By month day (for monthly recurrence)
  if (pattern.byMonthDay && pattern.byMonthDay.length > 0) {
    parts.push(`BYMONTHDAY=${pattern.byMonthDay.join(',')}`);
  }

  // By month (for yearly recurrence)
  if (pattern.byMonth && pattern.byMonth.length > 0) {
    parts.push(`BYMONTH=${pattern.byMonth.join(',')}`);
  }

  return parts.join(';');
}

/**
 * Parse an RRULE string into a recurrence pattern
 *
 * @param rrule - RRULE string to parse
 * @returns RecurrencePattern object
 */
export function parseRRule(rrule: string): RecurrencePattern | null {
  if (!rrule || !rrule.startsWith('FREQ=')) {
    return null;
  }

  const pattern: RecurrencePattern = {
    frequency: 'DAILY', // Default
  };

  const parts = rrule.split(';');

  for (const part of parts) {
    const [key, value] = part.split('=');

    switch (key) {
      case 'FREQ':
        if (['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(value)) {
          pattern.frequency = value as RecurrencePattern['frequency'];
        }
        break;

      case 'INTERVAL':
        pattern.interval = parseInt(value, 10);
        break;

      case 'COUNT':
        pattern.count = parseInt(value, 10);
        break;

      case 'UNTIL':
        // Parse UTC date format: YYYYMMDDTHHMMSSZ
        const year = parseInt(value.substr(0, 4), 10);
        const month = parseInt(value.substr(4, 2), 10) - 1; // Month is 0-indexed
        const day = parseInt(value.substr(6, 2), 10);
        const hour = parseInt(value.substr(9, 2), 10);
        const minute = parseInt(value.substr(11, 2), 10);
        const second = parseInt(value.substr(13, 2), 10);

        pattern.until = new Date(Date.UTC(year, month, day, hour, minute, second));
        break;

      case 'BYDAY':
        pattern.byWeekDay = value.split(',');
        break;

      case 'BYMONTHDAY':
        pattern.byMonthDay = value.split(',').map(v => parseInt(v, 10));
        break;

      case 'BYMONTH':
        pattern.byMonth = value.split(',').map(v => parseInt(v, 10));
        break;
    }
  }

  return pattern;
}

/**
 * Generate a human-readable description of a recurrence pattern
 *
 * @param pattern - The recurrence pattern
 * @returns Human-readable description (e.g., "Every 2 weeks on Monday, Wednesday")
 */
export function describeRecurrence(pattern: RecurrencePattern): string {
  const parts: string[] = [];

  // Frequency and interval
  const interval = pattern.interval || 1;
  const frequencyText = {
    DAILY: interval === 1 ? 'day' : `${interval} days`,
    WEEKLY: interval === 1 ? 'week' : `${interval} weeks`,
    MONTHLY: interval === 1 ? 'month' : `${interval} months`,
    YEARLY: interval === 1 ? 'year' : `${interval} years`,
  };

  parts.push(`Every ${frequencyText[pattern.frequency]}`);

  // By week day
  if (pattern.byWeekDay && pattern.byWeekDay.length > 0) {
    const dayNames = pattern.byWeekDay.map(day => WEEKDAY_REVERSE_MAP[day] || day);
    parts.push(`on ${dayNames.join(', ')}`);
  }

  // By month day
  if (pattern.byMonthDay && pattern.byMonthDay.length > 0) {
    parts.push(`on day${pattern.byMonthDay.length > 1 ? 's' : ''} ${pattern.byMonthDay.join(', ')}`);
  }

  // By month
  if (pattern.byMonth && pattern.byMonth.length > 0) {
    const monthNames = pattern.byMonth.map(m => {
      const date = new Date(2000, m - 1, 1);
      return date.toLocaleString('en-US', { month: 'long' });
    });
    parts.push(`in ${monthNames.join(', ')}`);
  }

  // Count or until
  if (pattern.count) {
    parts.push(`for ${pattern.count} occurrence${pattern.count > 1 ? 's' : ''}`);
  } else if (pattern.until) {
    const dateStr = pattern.until.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    parts.push(`until ${dateStr}`);
  }

  return parts.join(' ');
}

/**
 * Create a simple recurrence pattern from a UI-friendly format
 *
 * @param frequency - Daily, Weekly, Monthly, or Yearly
 * @param options - Additional options
 * @returns RecurrencePattern object
 */
export function createSimpleRecurrence(
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly',
  options: {
    interval?: number;
    weekDays?: string[]; // Full day names (Monday, Tuesday, etc.)
    monthDay?: number;
    endDate?: Date;
    occurrences?: number;
  } = {}
): RecurrencePattern {
  const pattern: RecurrencePattern = {
    frequency: frequency.toUpperCase() as RecurrencePattern['frequency'],
    interval: options.interval || 1,
  };

  if (options.weekDays && options.weekDays.length > 0) {
    pattern.byWeekDay = options.weekDays.map(day => WEEKDAY_MAP[day] || day);
  }

  if (options.monthDay) {
    pattern.byMonthDay = [options.monthDay];
  }

  if (options.endDate) {
    pattern.until = options.endDate;
  } else if (options.occurrences) {
    pattern.count = options.occurrences;
  }

  return pattern;
}

/**
 * Validate a recurrence pattern
 *
 * @param pattern - The recurrence pattern to validate
 * @returns Validation result with errors if any
 */
export function validateRecurrence(pattern: RecurrencePattern): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Frequency is required
  if (!pattern.frequency) {
    errors.push('Frequency is required');
  }

  // Interval must be positive
  if (pattern.interval && pattern.interval < 1) {
    errors.push('Interval must be at least 1');
  }

  // Count must be positive
  if (pattern.count && pattern.count < 1) {
    errors.push('Count must be at least 1');
  }

  // Cannot have both count and until
  if (pattern.count && pattern.until) {
    errors.push('Cannot specify both count and end date');
  }

  // Week days validation
  if (pattern.byWeekDay && pattern.byWeekDay.length > 0) {
    const validDays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
    const invalidDays = pattern.byWeekDay.filter(day => !validDays.includes(day));
    if (invalidDays.length > 0) {
      errors.push(`Invalid week days: ${invalidDays.join(', ')}`);
    }
  }

  // Month days validation
  if (pattern.byMonthDay && pattern.byMonthDay.length > 0) {
    const invalidDays = pattern.byMonthDay.filter(day => day < 1 || day > 31);
    if (invalidDays.length > 0) {
      errors.push('Month days must be between 1 and 31');
    }
  }

  // Months validation
  if (pattern.byMonth && pattern.byMonth.length > 0) {
    const invalidMonths = pattern.byMonth.filter(month => month < 1 || month > 12);
    if (invalidMonths.length > 0) {
      errors.push('Months must be between 1 and 12');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Convert a Google Calendar recurrence array to RRULE
 *
 * Google Calendar uses an array like: ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"]
 *
 * @param recurrence - Google Calendar recurrence array
 * @returns RRULE string
 */
export function googleRecurrenceToRRule(recurrence?: string[]): string | null {
  if (!recurrence || recurrence.length === 0) {
    return null;
  }

  const rruleLine = recurrence.find(line => line.startsWith('RRULE:'));
  if (!rruleLine) {
    return null;
  }

  return rruleLine.replace('RRULE:', '');
}

/**
 * Convert an RRULE string to Google Calendar recurrence format
 *
 * @param rrule - RRULE string
 * @returns Google Calendar recurrence array
 */
export function rruleToGoogleRecurrence(rrule: string): string[] {
  if (!rrule) {
    return [];
  }

  return [`RRULE:${rrule}`];
}
