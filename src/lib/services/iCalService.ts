import { CalendarEvent } from '@/pages/Calendar';
import { format } from 'date-fns';
import logger from '@/lib/utils/logger';

/**
 * iCal Service
 *
 * Handles parsing and generating iCalendar (.ics) files according to RFC 5545
 * https://datatracker.ietf.org/doc/html/rfc5545
 */

interface ParsedICalEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: Date;
  end?: Date;
  allDay?: boolean;
  attendees?: string[];
  organizer?: string;
  status?: string;
  priority?: number;
}

export class ICalService {
  /**
   * Generate iCal (.ics) file content from calendar events
   */
  static generateICalFile(events: CalendarEvent[], calendarName: string = 'Sixty Sales Calendar'): string {
    const lines: string[] = [];

    // Calendar header
    lines.push('BEGIN:VCALENDAR');
    lines.push('VERSION:2.0');
    lines.push('PRODID:-//Sixty Sales//Calendar//EN');
    lines.push(`X-WR-CALNAME:${this.escapeText(calendarName)}`);
    lines.push('X-WR-TIMEZONE:UTC');
    lines.push('CALSCALE:GREGORIAN');
    lines.push('METHOD:PUBLISH');

    // Add each event
    events.forEach(event => {
      lines.push('BEGIN:VEVENT');

      // UID - Unique identifier
      lines.push(`UID:${event.id}@sixtysales.com`);

      // Timestamp
      lines.push(`DTSTAMP:${this.formatDateTime(new Date())}`);

      // Start and end times
      if (event.allDay) {
        lines.push(`DTSTART;VALUE=DATE:${this.formatDate(new Date(event.start))}`);
        if (event.end) {
          lines.push(`DTEND;VALUE=DATE:${this.formatDate(new Date(event.end))}`);
        }
      } else {
        lines.push(`DTSTART:${this.formatDateTime(new Date(event.start))}`);
        if (event.end) {
          lines.push(`DTEND:${this.formatDateTime(new Date(event.end))}`);
        }
      }

      // Summary (title)
      lines.push(`SUMMARY:${this.escapeText(event.title)}`);

      // Description
      if (event.description) {
        lines.push(`DESCRIPTION:${this.escapeText(event.description)}`);
      }

      // Location
      if (event.location) {
        lines.push(`LOCATION:${this.escapeText(event.location)}`);
      }

      // Category (using CATEGORIES field)
      lines.push(`CATEGORIES:${this.escapeText(event.category.toUpperCase())}`);

      // Priority (1=high, 5=medium, 9=low)
      if (event.priority) {
        const icalPriority = event.priority === 'high' ? 1 :
                            event.priority === 'medium' ? 5 : 9;
        lines.push(`PRIORITY:${icalPriority}`);
      }

      // Attendees
      if (event.attendees && event.attendees.length > 0) {
        event.attendees.forEach(attendee => {
          // Basic email format
          const email = attendee.includes('@') ? attendee : `${attendee}@example.com`;
          lines.push(`ATTENDEE;CN=${this.escapeText(attendee)}:mailto:${email}`);
        });
      }

      // Status
      lines.push('STATUS:CONFIRMED');

      // Recurring pattern if available
      if (event.recurring && event.recurringPattern) {
        lines.push(`RRULE:${event.recurringPattern}`);
      }

      // Custom fields for our app
      lines.push(`X-SIXTY-CATEGORY:${event.category}`);
      if (event.dealId) {
        lines.push(`X-SIXTY-DEAL-ID:${event.dealId}`);
      }
      if (event.contactId) {
        lines.push(`X-SIXTY-CONTACT-ID:${event.contactId}`);
      }
      if (event.companyId) {
        lines.push(`X-SIXTY-COMPANY-ID:${event.companyId}`);
      }

      lines.push('END:VEVENT');
    });

    // Calendar footer
    lines.push('END:VCALENDAR');

    return lines.join('\r\n');
  }

  /**
   * Parse iCal (.ics) file content and extract events
   */
  static parseICalFile(content: string): ParsedICalEvent[] {
    const events: ParsedICalEvent[] = [];
    const lines = content.split(/\r?\n/);

    let currentEvent: Partial<ParsedICalEvent> | null = null;
    let lastKey = '';

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // Handle line continuation (lines starting with space or tab)
      if (line.startsWith(' ') || line.startsWith('\t')) {
        if (lastKey && currentEvent) {
          // Append to previous value
          const value = line.substring(1);
          const currentValue = (currentEvent as any)[lastKey];
          (currentEvent as any)[lastKey] = currentValue + value;
        }
        continue;
      }

      // Split line into key and value
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const fullKey = line.substring(0, colonIndex);
      const value = line.substring(colonIndex + 1);

      // Extract base key (without parameters)
      const key = fullKey.split(';')[0];
      lastKey = key;

      // Process based on key
      switch (key) {
        case 'BEGIN':
          if (value === 'VEVENT') {
            currentEvent = {};
          }
          break;

        case 'END':
          if (value === 'VEVENT' && currentEvent) {
            // Validate and add event
            if (currentEvent.uid && currentEvent.summary && currentEvent.start) {
              events.push(currentEvent as ParsedICalEvent);
            }
            currentEvent = null;
          }
          break;

        case 'UID':
          if (currentEvent) currentEvent.uid = value;
          break;

        case 'SUMMARY':
          if (currentEvent) currentEvent.summary = this.unescapeText(value);
          break;

        case 'DESCRIPTION':
          if (currentEvent) currentEvent.description = this.unescapeText(value);
          break;

        case 'LOCATION':
          if (currentEvent) currentEvent.location = this.unescapeText(value);
          break;

        case 'DTSTART':
          if (currentEvent) {
            currentEvent.start = this.parseDateTime(value, fullKey);
            currentEvent.allDay = fullKey.includes('VALUE=DATE');
          }
          break;

        case 'DTEND':
          if (currentEvent) {
            currentEvent.end = this.parseDateTime(value, fullKey);
          }
          break;

        case 'ATTENDEE':
          if (currentEvent) {
            const email = value.replace('mailto:', '');
            if (!currentEvent.attendees) currentEvent.attendees = [];
            currentEvent.attendees.push(email);
          }
          break;

        case 'ORGANIZER':
          if (currentEvent) {
            currentEvent.organizer = value.replace('mailto:', '');
          }
          break;

        case 'STATUS':
          if (currentEvent) currentEvent.status = value;
          break;

        case 'PRIORITY':
          if (currentEvent) currentEvent.priority = parseInt(value);
          break;
      }
    }

    return events;
  }

  /**
   * Convert parsed iCal events to CalendarEvent format
   */
  static convertToCalendarEvents(
    parsedEvents: ParsedICalEvent[],
    userId: string
  ): Partial<CalendarEvent>[] {
    return parsedEvents.map(event => ({
      id: event.uid.split('@')[0], // Extract ID before @
      title: event.summary,
      description: event.description,
      location: event.location,
      start: event.start,
      end: event.end,
      allDay: event.allDay || false,
      category: this.inferCategory(event.summary, event.description),
      attendees: event.attendees,
      priority: event.priority ? (
        event.priority <= 3 ? 'high' :
        event.priority <= 6 ? 'medium' : 'low'
      ) as 'low' | 'medium' | 'high' : undefined,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  /**
   * Download iCal file
   */
  static downloadICalFile(content: string, filename: string = 'calendar.ics') {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logger.log(`📅 Downloaded iCal file: ${filename}`);
  }

  /**
   * Read iCal file from upload
   */
  static async readICalFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    });
  }

  // ===== Helper Methods =====

  /**
   * Format date-time for iCal (UTC)
   * Format: YYYYMMDDTHHmmssZ
   */
  private static formatDateTime(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');

    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  }

  /**
   * Format date only for iCal (all-day events)
   * Format: YYYYMMDD
   */
  private static formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}${month}${day}`;
  }

  /**
   * Parse iCal date-time string
   */
  private static parseDateTime(value: string, fullKey: string): Date {
    // Remove any non-numeric characters except T and Z
    const cleaned = value.replace(/[^0-9TZ]/g, '');

    // Check if it's a date-only value (all-day event)
    if (fullKey.includes('VALUE=DATE') || cleaned.length === 8) {
      // Format: YYYYMMDD
      const year = parseInt(cleaned.substring(0, 4));
      const month = parseInt(cleaned.substring(4, 6)) - 1;
      const day = parseInt(cleaned.substring(6, 8));
      return new Date(year, month, day);
    }

    // Format: YYYYMMDDTHHmmssZ or YYYYMMDDTHHmmss
    const year = parseInt(cleaned.substring(0, 4));
    const month = parseInt(cleaned.substring(4, 6)) - 1;
    const day = parseInt(cleaned.substring(6, 8));
    const hours = parseInt(cleaned.substring(9, 11)) || 0;
    const minutes = parseInt(cleaned.substring(11, 13)) || 0;
    const seconds = parseInt(cleaned.substring(13, 15)) || 0;

    // If ends with Z, it's UTC
    if (cleaned.endsWith('Z')) {
      return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
    }

    // Otherwise, local time
    return new Date(year, month, day, hours, minutes, seconds);
  }

  /**
   * Escape special characters for iCal text fields
   */
  private static escapeText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')   // Backslash
      .replace(/;/g, '\\;')      // Semicolon
      .replace(/,/g, '\\,')      // Comma
      .replace(/\n/g, '\\n')     // Newline
      .replace(/\r/g, '');       // Remove carriage returns
  }

  /**
   * Unescape special characters from iCal text fields
   */
  private static unescapeText(text: string): string {
    return text
      .replace(/\\n/g, '\n')     // Newline
      .replace(/\\,/g, ',')      // Comma
      .replace(/\\;/g, ';')      // Semicolon
      .replace(/\\\\/g, '\\');   // Backslash
  }

  /**
   * Infer event category from title and description
   */
  private static inferCategory(
    title: string,
    description?: string
  ): CalendarEvent['category'] {
    const text = `${title} ${description || ''}`.toLowerCase();

    if (text.match(/\b(call|phone|dial)\b/)) return 'call';
    if (text.match(/\b(task|todo|action|complete)\b/)) return 'task';
    if (text.match(/\b(deal|proposal|contract|sale)\b/)) return 'deal';
    if (text.match(/\b(follow.?up|followup)\b/)) return 'follow-up';
    if (text.match(/\b(personal|private|birthday|anniversary)\b/)) return 'personal';

    // Default to meeting
    return 'meeting';
  }
}
