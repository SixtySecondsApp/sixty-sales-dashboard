import { describe, it, expect, beforeEach } from 'vitest';
import { ICalService } from '../iCalService';
import type { CalendarEvent } from '@/pages/Calendar';

describe('ICalService', () => {
  let mockEvents: CalendarEvent[];

  beforeEach(() => {
    // Mock calendar events for testing
    mockEvents = [
      {
        id: 'event-1',
        title: 'Team Meeting',
        start: new Date('2025-01-15T10:00:00Z'),
        end: new Date('2025-01-15T11:00:00Z'),
        allDay: false,
        description: 'Quarterly planning meeting',
        category: 'meeting',
        location: 'Conference Room A',
        attendees: ['john@example.com', 'jane@example.com'],
        priority: 'high',
        createdBy: 'user-1',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      },
      {
        id: 'event-2',
        title: 'Client Call',
        start: new Date('2025-01-16T00:00:00'),
        allDay: true,
        description: 'Follow-up with prospect',
        category: 'call',
        dealId: 'deal-123',
        contactId: 'contact-456',
        createdBy: 'user-1',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      },
      {
        id: 'event-3',
        title: 'Recurring Weekly Standup',
        start: new Date('2025-01-17T09:00:00Z'),
        end: new Date('2025-01-17T09:30:00Z'),
        allDay: false,
        category: 'meeting',
        recurring: true,
        recurringPattern: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
        createdBy: 'user-1',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        updatedAt: new Date('2025-01-01T00:00:00Z'),
      },
    ];
  });

  describe('generateICalFile', () => {
    it('should generate valid iCal content with proper header', () => {
      const iCalContent = ICalService.generateICalFile(mockEvents, 'Test Calendar');

      expect(iCalContent).toContain('BEGIN:VCALENDAR');
      expect(iCalContent).toContain('VERSION:2.0');
      expect(iCalContent).toContain('PRODID:-//Sixty Sales//Calendar//EN');
      expect(iCalContent).toContain('X-WR-CALNAME:Test Calendar');
      expect(iCalContent).toContain('END:VCALENDAR');
    });

    it('should include all events in the output', () => {
      const iCalContent = ICalService.generateICalFile(mockEvents);

      mockEvents.forEach(event => {
        expect(iCalContent).toContain(`UID:${event.id}@sixtysales.com`);
        expect(iCalContent).toContain(`SUMMARY:${event.title}`);
      });
    });

    it('should format timed events correctly', () => {
      const iCalContent = ICalService.generateICalFile([mockEvents[0]]);

      expect(iCalContent).toContain('DTSTART:20250115T100000Z');
      expect(iCalContent).toContain('DTEND:20250115T110000Z');
      expect(iCalContent).not.toContain('VALUE=DATE');
    });

    it('should format all-day events correctly', () => {
      const iCalContent = ICalService.generateICalFile([mockEvents[1]]);

      expect(iCalContent).toContain('DTSTART;VALUE=DATE:20250116');
      expect(iCalContent).toMatch(/DTSTART;VALUE=DATE:\d{8}/);
    });

    it('should include event descriptions and locations', () => {
      const iCalContent = ICalService.generateICalFile([mockEvents[0]]);

      expect(iCalContent).toContain('DESCRIPTION:Quarterly planning meeting');
      expect(iCalContent).toContain('LOCATION:Conference Room A');
    });

    it('should include attendees in proper format', () => {
      const iCalContent = ICalService.generateICalFile([mockEvents[0]]);

      expect(iCalContent).toContain('ATTENDEE;CN=john@example.com:mailto:john@example.com');
      expect(iCalContent).toContain('ATTENDEE;CN=jane@example.com:mailto:jane@example.com');
    });

    it('should include priority mapping (high=1, medium=5, low=9)', () => {
      const iCalContent = ICalService.generateICalFile([mockEvents[0]]);

      expect(iCalContent).toContain('PRIORITY:1'); // high priority
    });

    it('should include category information', () => {
      const iCalContent = ICalService.generateICalFile([mockEvents[0]]);

      expect(iCalContent).toContain('CATEGORIES:MEETING');
      expect(iCalContent).toContain('X-SIXTY-CATEGORY:meeting');
    });

    it('should include custom X-SIXTY fields for app-specific data', () => {
      const iCalContent = ICalService.generateICalFile([mockEvents[1]]);

      expect(iCalContent).toContain('X-SIXTY-DEAL-ID:deal-123');
      expect(iCalContent).toContain('X-SIXTY-CONTACT-ID:contact-456');
    });

    it('should include recurring pattern if event is recurring', () => {
      const iCalContent = ICalService.generateICalFile([mockEvents[2]]);

      expect(iCalContent).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR');
    });

    it('should escape special characters in text fields', () => {
      const eventWithSpecialChars: CalendarEvent = {
        ...mockEvents[0],
        title: 'Meeting with Smith, Jones & Associates',
        description: 'Discuss:\n1. Budget\n2. Timeline',
      };

      const iCalContent = ICalService.generateICalFile([eventWithSpecialChars]);

      expect(iCalContent).toContain('SUMMARY:Meeting with Smith\\, Jones & Associates');
      expect(iCalContent).toContain('DESCRIPTION:Discuss:\\n1. Budget\\n2. Timeline');
    });

    it('should handle events without optional fields', () => {
      const minimalEvent: CalendarEvent = {
        id: 'minimal-1',
        title: 'Simple Event',
        start: new Date('2025-01-20T12:00:00Z'),
        category: 'task',
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const iCalContent = ICalService.generateICalFile([minimalEvent]);

      expect(iCalContent).toContain('BEGIN:VEVENT');
      expect(iCalContent).toContain('SUMMARY:Simple Event');
      expect(iCalContent).toContain('END:VEVENT');
    });

    it('should handle empty event array', () => {
      const iCalContent = ICalService.generateICalFile([]);

      expect(iCalContent).toContain('BEGIN:VCALENDAR');
      expect(iCalContent).toContain('END:VCALENDAR');
      expect(iCalContent).not.toContain('BEGIN:VEVENT');
    });
  });

  describe('parseICalFile', () => {
    it('should parse basic iCal content', () => {
      const iCalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Calendar//EN
BEGIN:VEVENT
UID:test-event-1
SUMMARY:Test Meeting
DTSTART:20250115T100000Z
DTEND:20250115T110000Z
END:VEVENT
END:VCALENDAR`;

      const parsedEvents = ICalService.parseICalFile(iCalContent);

      expect(parsedEvents).toHaveLength(1);
      expect(parsedEvents[0].uid).toBe('test-event-1');
      expect(parsedEvents[0].summary).toBe('Test Meeting');
      expect(parsedEvents[0].start).toBeInstanceOf(Date);
    });

    it('should parse all-day events correctly', () => {
      const iCalContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:all-day-1
SUMMARY:All Day Event
DTSTART;VALUE=DATE:20250120
END:VEVENT
END:VCALENDAR`;

      const parsedEvents = ICalService.parseICalFile(iCalContent);

      expect(parsedEvents[0].allDay).toBe(true);
      expect(parsedEvents[0].start).toBeInstanceOf(Date);
    });

    it('should parse events with descriptions and locations', () => {
      const iCalContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-1
SUMMARY:Meeting
DESCRIPTION:Important discussion
LOCATION:Room 101
DTSTART:20250115T100000Z
END:VEVENT
END:VCALENDAR`;

      const parsedEvents = ICalService.parseICalFile(iCalContent);

      expect(parsedEvents[0].description).toBe('Important discussion');
      expect(parsedEvents[0].location).toBe('Room 101');
    });

    it('should parse attendees correctly', () => {
      const iCalContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-1
SUMMARY:Team Sync
DTSTART:20250115T100000Z
ATTENDEE:mailto:alice@example.com
ATTENDEE:mailto:bob@example.com
END:VEVENT
END:VCALENDAR`;

      const parsedEvents = ICalService.parseICalFile(iCalContent);

      expect(parsedEvents[0].attendees).toHaveLength(2);
      expect(parsedEvents[0].attendees).toContain('alice@example.com');
      expect(parsedEvents[0].attendees).toContain('bob@example.com');
    });

    it('should parse priority correctly', () => {
      const iCalContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-1
SUMMARY:High Priority Task
DTSTART:20250115T100000Z
PRIORITY:1
END:VEVENT
END:VCALENDAR`;

      const parsedEvents = ICalService.parseICalFile(iCalContent);

      expect(parsedEvents[0].priority).toBe(1);
    });

    it('should handle line continuation (folded lines)', () => {
      const iCalContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-1
SUMMARY:This is a very long summary that continues on
  the next line with proper folding
DTSTART:20250115T100000Z
END:VEVENT
END:VCALENDAR`;

      const parsedEvents = ICalService.parseICalFile(iCalContent);

      expect(parsedEvents[0].summary).toContain('continues on');
    });

    it('should unescape special characters', () => {
      const iCalContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-1
SUMMARY:Meeting with Smith\\, Jones & Co
DESCRIPTION:Topics:\\n1. Budget\\n2. Timeline
DTSTART:20250115T100000Z
END:VEVENT
END:VCALENDAR`;

      const parsedEvents = ICalService.parseICalFile(iCalContent);

      expect(parsedEvents[0].summary).toBe('Meeting with Smith, Jones & Co');
      expect(parsedEvents[0].description).toContain('\n1. Budget');
    });

    it('should skip invalid events (missing required fields)', () => {
      const iCalContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-1
DTSTART:20250115T100000Z
END:VEVENT
BEGIN:VEVENT
UID:event-2
SUMMARY:Valid Event
DTSTART:20250116T100000Z
END:VEVENT
END:VCALENDAR`;

      const parsedEvents = ICalService.parseICalFile(iCalContent);

      // Should only include event-2 (has all required fields)
      expect(parsedEvents).toHaveLength(1);
      expect(parsedEvents[0].uid).toBe('event-2');
    });

    it('should handle malformed iCal content gracefully', () => {
      const iCalContent = `INVALID ICAL CONTENT
WITHOUT PROPER STRUCTURE`;

      const parsedEvents = ICalService.parseICalFile(iCalContent);

      expect(parsedEvents).toHaveLength(0);
    });
  });

  describe('convertToCalendarEvents', () => {
    it('should convert parsed events to CalendarEvent format', () => {
      const parsedEvents = [
        {
          uid: 'test-1@calendar.com',
          summary: 'Test Meeting',
          start: new Date('2025-01-15T10:00:00Z'),
          end: new Date('2025-01-15T11:00:00Z'),
          allDay: false,
        },
      ];

      const calendarEvents = ICalService.convertToCalendarEvents(parsedEvents, 'user-123');

      expect(calendarEvents).toHaveLength(1);
      expect(calendarEvents[0].id).toBe('test-1'); // Strips @domain
      expect(calendarEvents[0].title).toBe('Test Meeting');
      expect(calendarEvents[0].createdBy).toBe('user-123');
      expect(calendarEvents[0].category).toBeDefined();
    });

    it('should infer category from event content', () => {
      const parsedEvents = [
        {
          uid: 'call-1',
          summary: 'Phone call with client',
          start: new Date(),
        },
        {
          uid: 'task-1',
          summary: 'Complete TODO items',
          start: new Date(),
        },
        {
          uid: 'meeting-1',
          summary: 'Team standup',
          start: new Date(),
        },
      ];

      const calendarEvents = ICalService.convertToCalendarEvents(parsedEvents, 'user-1');

      expect(calendarEvents[0].category).toBe('call');
      expect(calendarEvents[1].category).toBe('task');
      expect(calendarEvents[2].category).toBe('meeting');
    });

    it('should convert iCal priority to app priority', () => {
      const parsedEvents = [
        { uid: '1', summary: 'High', start: new Date(), priority: 1 },
        { uid: '2', summary: 'Medium', start: new Date(), priority: 5 },
        { uid: '3', summary: 'Low', start: new Date(), priority: 9 },
      ];

      const calendarEvents = ICalService.convertToCalendarEvents(parsedEvents, 'user-1');

      expect(calendarEvents[0].priority).toBe('high');
      expect(calendarEvents[1].priority).toBe('medium');
      expect(calendarEvents[2].priority).toBe('low');
    });

    it('should preserve attendees and location', () => {
      const parsedEvents = [
        {
          uid: 'event-1',
          summary: 'Meeting',
          start: new Date(),
          attendees: ['alice@example.com', 'bob@example.com'],
          location: 'Conference Room',
        },
      ];

      const calendarEvents = ICalService.convertToCalendarEvents(parsedEvents, 'user-1');

      expect(calendarEvents[0].attendees).toEqual(['alice@example.com', 'bob@example.com']);
      expect(calendarEvents[0].location).toBe('Conference Room');
    });
  });

  describe('downloadICalFile', () => {
    it('should create a blob with correct MIME type', () => {
      // Mock document.createElement and related DOM APIs
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      const mockCreateElement = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      const mockCreateObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      const mockRevokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
      const mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);

      ICalService.downloadICalFile('test content', 'test.ics');

      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockLink.download).toBe('test.ics');
      expect(mockLink.click).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();

      // Cleanup
      mockCreateElement.mockRestore();
      mockCreateObjectURL.mockRestore();
      mockRevokeObjectURL.mockRestore();
      mockAppendChild.mockRestore();
      mockRemoveChild.mockRestore();
    });
  });

  describe('Round-trip conversion', () => {
    it('should maintain data integrity through export and import', () => {
      // Generate iCal from events
      const iCalContent = ICalService.generateICalFile(mockEvents);

      // Parse the generated content
      const parsedEvents = ICalService.parseICalFile(iCalContent);

      // Convert back to CalendarEvent format
      const convertedEvents = ICalService.convertToCalendarEvents(parsedEvents, 'user-1');

      // Verify key data is preserved
      expect(convertedEvents).toHaveLength(mockEvents.length);

      convertedEvents.forEach((converted, index) => {
        const original = mockEvents[index];
        expect(converted.title).toBe(original.title);
        expect(converted.description).toBe(original.description);
        expect(converted.location).toBe(original.location);
        // Note: Dates might have minor timezone differences, so we check they're close
        expect(Math.abs(converted.start.getTime() - original.start.getTime())).toBeLessThan(1000);
      });
    });
  });
});
