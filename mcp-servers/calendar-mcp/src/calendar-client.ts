import { google, calendar_v3 } from 'googleapis';
import { SimpleOAuth as CalendarOAuth, type OAuthConfig, type Token } from './auth/simple-oauth.js';
import { z } from 'zod';
import { addDays, addMinutes, format, parseISO, startOfDay, endOfDay } from 'date-fns';

// Calendar Event Schemas
const DateTimeSchema = z.object({
  dateTime: z.string().optional(),
  date: z.string().optional(),
  timeZone: z.string().optional(),
});

const AttendeeSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
  responseStatus: z.enum(['needsAction', 'declined', 'tentative', 'accepted']).optional(),
  optional: z.boolean().optional(),
  organizer: z.boolean().optional(),
});

const EventReminderSchema = z.object({
  method: z.enum(['email', 'popup', 'sms']),
  minutes: z.number().min(0),
});

const RecurrenceRuleSchema = z.object({
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  interval: z.number().min(1).optional(),
  count: z.number().min(1).optional(),
  until: z.string().optional(),
  byDay: z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).optional(),
  byMonthDay: z.array(z.number().min(1).max(31)).optional(),
});

const CreateEventSchema = z.object({
  summary: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  start: DateTimeSchema,
  end: DateTimeSchema,
  attendees: z.array(AttendeeSchema).optional(),
  reminders: z.array(EventReminderSchema).optional(),
  recurrence: RecurrenceRuleSchema.optional(),
  calendarId: z.string().optional().default('primary'),
  conferenceData: z.object({
    createRequest: z.object({
      requestId: z.string(),
      conferenceSolutionKey: z.object({
        type: z.enum(['hangoutsMeet', 'addOn']),
      }),
    }),
  }).optional(),
});

const UpdateEventSchema = CreateEventSchema.partial().extend({
  eventId: z.string(),
});

const ListEventsSchema = z.object({
  calendarId: z.string().optional().default('primary'),
  timeMin: z.string().optional(),
  timeMax: z.string().optional(),
  q: z.string().optional(),
  maxResults: z.number().min(1).max(2500).optional().default(250),
  orderBy: z.enum(['startTime', 'updated']).optional(),
  showDeleted: z.boolean().optional().default(false),
  singleEvents: z.boolean().optional().default(true),
});

const FindFreeSlotsSchema = z.object({
  calendarIds: z.array(z.string()).optional().default(['primary']),
  timeMin: z.string(),
  timeMax: z.string(),
  duration: z.number().min(15), // minutes
  workingHours: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM format
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }).optional().default({ start: '09:00', end: '17:00' }),
  excludeWeekends: z.boolean().optional().default(true),
});

export type CreateEventInput = z.infer<typeof CreateEventSchema>;
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;
export type ListEventsInput = z.infer<typeof ListEventsSchema>;
export type FindFreeSlotsInput = z.infer<typeof FindFreeSlotsSchema>;
export type Attendee = z.infer<typeof AttendeeSchema>;
export type RecurrenceRule = z.infer<typeof RecurrenceRuleSchema>;

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Attendee[];
  organizer?: {
    email: string;
    displayName?: string;
  };
  status: 'confirmed' | 'tentative' | 'cancelled';
  created: string;
  updated: string;
  htmlLink: string;
  recurringEventId?: string;
  recurrence?: string[];
}

export interface FreeBusyInfo {
  calendar: string;
  busy: Array<{
    start: string;
    end: string;
  }>;
}

export interface FreeSlot {
  start: string;
  end: string;
  duration: number;
}

export class CalendarClient {
  private oauth: CalendarOAuth;
  private calendar: calendar_v3.Calendar;

  constructor(config: OAuthConfig) {
    this.oauth = new CalendarOAuth(config);
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth.getAuthClient() });
  }

  // OAuth Management
  generateAuthUrl(): string {
    return this.oauth.generateAuthUrl();
  }

  async authenticate(code: string): Promise<Token> {
    return this.oauth.getAccessToken(code);
  }

  setTokens(tokens: Token): void {
    this.oauth.setTokens(tokens);
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth.getAuthClient() });
  }

  async refreshTokens(): Promise<Token> {
    return this.oauth.refreshAccessToken();
  }

  isAuthenticated(): boolean {
    return this.oauth.isTokenValid();
  }

  // Calendar Operations

  /**
   * Create a new calendar event
   */
  async createEvent(input: CreateEventInput): Promise<CalendarEvent> {
    const validatedInput = CreateEventSchema.parse(input);
    
    try {
      const eventData: calendar_v3.Schema$Event = {
        summary: validatedInput.summary,
        description: validatedInput.description,
        location: validatedInput.location,
        start: validatedInput.start,
        end: validatedInput.end,
        attendees: validatedInput.attendees,
        conferenceData: validatedInput.conferenceData,
      };

      // Handle recurrence
      if (validatedInput.recurrence) {
        eventData.recurrence = this.buildRecurrenceRule(validatedInput.recurrence);
      }

      // Handle reminders
      if (validatedInput.reminders) {
        eventData.reminders = {
          useDefault: false,
          overrides: validatedInput.reminders.map(r => ({
            method: r.method,
            minutes: r.minutes,
          })),
        };
      }

      const response = await this.calendar.events.insert({
        calendarId: validatedInput.calendarId,
        requestBody: eventData,
        conferenceDataVersion: validatedInput.conferenceData ? 1 : undefined,
        sendUpdates: validatedInput.attendees?.length ? 'all' : 'none',
      });

      if (!response.data) {
        throw new Error('Failed to create event');
      }

      return this.transformEvent(response.data);
    } catch (error) {
      throw new Error(`Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(input: UpdateEventInput): Promise<CalendarEvent> {
    const validatedInput = UpdateEventSchema.parse(input);
    
    try {
      const eventData: calendar_v3.Schema$Event = {};

      // Only include fields that are being updated
      if (validatedInput.summary !== undefined) eventData.summary = validatedInput.summary;
      if (validatedInput.description !== undefined) eventData.description = validatedInput.description;
      if (validatedInput.location !== undefined) eventData.location = validatedInput.location;
      if (validatedInput.start !== undefined) eventData.start = validatedInput.start;
      if (validatedInput.end !== undefined) eventData.end = validatedInput.end;
      if (validatedInput.attendees !== undefined) eventData.attendees = validatedInput.attendees;

      // Handle recurrence
      if (validatedInput.recurrence !== undefined) {
        eventData.recurrence = this.buildRecurrenceRule(validatedInput.recurrence);
      }

      // Handle reminders
      if (validatedInput.reminders !== undefined) {
        eventData.reminders = {
          useDefault: false,
          overrides: validatedInput.reminders.map(r => ({
            method: r.method,
            minutes: r.minutes,
          })),
        };
      }

      const response = await this.calendar.events.update({
        calendarId: validatedInput.calendarId || 'primary',
        eventId: validatedInput.eventId,
        requestBody: eventData,
        conferenceDataVersion: validatedInput.conferenceData ? 1 : undefined,
        sendUpdates: validatedInput.attendees ? 'all' : 'none',
      });

      if (!response.data) {
        throw new Error('Failed to update event');
      }

      return this.transformEvent(response.data);
    } catch (error) {
      throw new Error(`Failed to update event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(eventId: string, calendarId: string = 'primary'): Promise<void> {
    try {
      await this.calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates: 'all',
      });
    } catch (error) {
      throw new Error(`Failed to delete event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a specific calendar event
   */
  async getEvent(eventId: string, calendarId: string = 'primary'): Promise<CalendarEvent> {
    try {
      const response = await this.calendar.events.get({
        calendarId,
        eventId,
      });

      if (!response.data) {
        throw new Error('Event not found');
      }

      return this.transformEvent(response.data);
    } catch (error) {
      throw new Error(`Failed to get event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List calendar events
   */
  async listEvents(input: ListEventsInput): Promise<CalendarEvent[]> {
    const validatedInput = ListEventsSchema.parse(input);
    
    try {
      const response = await this.calendar.events.list({
        calendarId: validatedInput.calendarId,
        timeMin: validatedInput.timeMin,
        timeMax: validatedInput.timeMax,
        q: validatedInput.q,
        maxResults: validatedInput.maxResults,
        orderBy: validatedInput.orderBy,
        showDeleted: validatedInput.showDeleted,
        singleEvents: validatedInput.singleEvents,
      });

      const events = response.data.items || [];
      return events.map(event => this.transformEvent(event));
    } catch (error) {
      throw new Error(`Failed to list events: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find free time slots
   */
  async findFreeSlots(input: FindFreeSlotsInput): Promise<FreeSlot[]> {
    const validatedInput = FindFreeSlotsSchema.parse(input);
    
    try {
      // Get free/busy information
      const freeBusyResponse = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: validatedInput.timeMin,
          timeMax: validatedInput.timeMax,
          items: validatedInput.calendarIds.map(id => ({ id })),
        },
      });

      const busyTimes: Array<{ start: Date; end: Date }> = [];

      // Collect all busy times
      const calendars = freeBusyResponse.data.calendars || {};
      Object.values(calendars).forEach((calendar: any) => {
        (calendar.busy || []).forEach((busySlot: any) => {
          if (busySlot.start && busySlot.end) {
            busyTimes.push({
              start: parseISO(busySlot.start),
              end: parseISO(busySlot.end),
            });
          }
        });
      });

      // Generate free slots
      return this.generateFreeSlots(
        parseISO(validatedInput.timeMin),
        parseISO(validatedInput.timeMax),
        busyTimes,
        validatedInput.duration,
        validatedInput.workingHours,
        validatedInput.excludeWeekends
      );
    } catch (error) {
      throw new Error(`Failed to find free slots: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check availability for specific attendees
   */
  async checkAvailability(
    emails: string[],
    startTime: string,
    endTime: string
  ): Promise<{ [email: string]: { available: boolean; conflicts: Array<{ start: string; end: string }> } }> {
    try {
      const freeBusyResponse = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: startTime,
          timeMax: endTime,
          items: emails.map(email => ({ id: email })),
        },
      });

      const availability: { [email: string]: { available: boolean; conflicts: Array<{ start: string; end: string }> } } = {};

      emails.forEach(email => {
        const calendar = freeBusyResponse.data.calendars?.[email];
        const busy = calendar?.busy || [];
        
        availability[email] = {
          available: busy.length === 0,
          conflicts: busy.map((slot: any) => ({
            start: slot.start || '',
            end: slot.end || '',
          })),
        };
      });

      return availability;
    } catch (error) {
      throw new Error(`Failed to check availability: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get calendar list
   */
  async getCalendars(): Promise<Array<{ id: string; summary: string; primary?: boolean }>> {
    try {
      const response = await this.calendar.calendarList.list();
      
      return (response.data.items || []).map(calendar => ({
        id: calendar.id ?? '',
        summary: calendar.summary ?? '',
        primary: calendar.primary ?? false,
      }));
    } catch (error) {
      throw new Error(`Failed to get calendars: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private helper methods

  private transformEvent(event: calendar_v3.Schema$Event): CalendarEvent {
    return {
      id: event.id ?? '',
      summary: event.summary ?? '',
      description: event.description ?? undefined,
      location: event.location ?? undefined,
      start: {
        dateTime: event.start?.dateTime ?? undefined,
        date: event.start?.date ?? undefined,
        timeZone: event.start?.timeZone ?? undefined,
      },
      end: {
        dateTime: event.end?.dateTime ?? undefined,
        date: event.end?.date ?? undefined,
        timeZone: event.end?.timeZone ?? undefined,
      },
      attendees: event.attendees?.map(a => ({
        email: a.email ?? '',
        displayName: a.displayName ?? undefined,
        responseStatus: a.responseStatus as any,
        optional: a.optional ?? undefined,
        organizer: a.organizer ?? undefined,
      })),
      organizer: event.organizer ? {
        email: event.organizer.email ?? '',
        displayName: event.organizer.displayName ?? undefined,
      } : undefined,
      status: (event.status as any) || 'confirmed',
      created: event.created ?? '',
      updated: event.updated ?? '',
      htmlLink: event.htmlLink ?? '',
      recurringEventId: event.recurringEventId ?? undefined,
      recurrence: event.recurrence ?? undefined,
    };
  }

  private buildRecurrenceRule(rule: RecurrenceRule): string[] {
    let rrule = `FREQ=${rule.frequency}`;
    
    if (rule.interval && rule.interval > 1) {
      rrule += `;INTERVAL=${rule.interval}`;
    }
    
    if (rule.count) {
      rrule += `;COUNT=${rule.count}`;
    }
    
    if (rule.until) {
      rrule += `;UNTIL=${rule.until}`;
    }
    
    if (rule.byDay && rule.byDay.length > 0) {
      rrule += `;BYDAY=${rule.byDay.join(',')}`;
    }
    
    if (rule.byMonthDay && rule.byMonthDay.length > 0) {
      rrule += `;BYMONTHDAY=${rule.byMonthDay.join(',')}`;
    }

    return [`RRULE:${rrule}`];
  }

  private generateFreeSlots(
    startTime: Date,
    endTime: Date,
    busyTimes: Array<{ start: Date; end: Date }>,
    durationMinutes: number,
    workingHours: { start: string; end: string },
    excludeWeekends: boolean
  ): FreeSlot[] {
    const freeSlots: FreeSlot[] = [];
    let currentTime = new Date(startTime);

    // Sort busy times
    busyTimes.sort((a, b) => a.start.getTime() - b.start.getTime());

    while (currentTime < endTime) {
      const dayStart = startOfDay(currentTime);
      const dayEnd = endOfDay(currentTime);

      // Skip weekends if requested
      if (excludeWeekends && (currentTime.getDay() === 0 || currentTime.getDay() === 6)) {
        currentTime = addDays(dayStart, 1);
        continue;
      }

      // Calculate working hours for this day
      const [workStartHour, workStartMin] = workingHours.start.split(':').map(Number);
      const [workEndHour, workEndMin] = workingHours.end.split(':').map(Number);

      const workStart = new Date(dayStart);
      workStart.setHours(workStartHour, workStartMin, 0, 0);

      const workEnd = new Date(dayStart);
      workEnd.setHours(workEndHour, workEndMin, 0, 0);

      // Find free slots in this day
      const dayBusyTimes = busyTimes.filter(
        busy => busy.start < dayEnd && busy.end > dayStart
      );

      let slotStart = new Date(Math.max(currentTime.getTime(), workStart.getTime()));

      dayBusyTimes.forEach(busyTime => {
        const busyStart = new Date(Math.max(busyTime.start.getTime(), workStart.getTime()));
        const busyEnd = new Date(Math.min(busyTime.end.getTime(), workEnd.getTime()));

        if (slotStart < busyStart) {
          const slotDuration = (busyStart.getTime() - slotStart.getTime()) / (1000 * 60);
          if (slotDuration >= durationMinutes) {
            freeSlots.push({
              start: slotStart.toISOString(),
              end: busyStart.toISOString(),
              duration: slotDuration,
            });
          }
        }

        slotStart = new Date(Math.max(slotStart.getTime(), busyEnd.getTime()));
      });

      // Check if there's a free slot at the end of the work day
      if (slotStart < workEnd) {
        const slotDuration = (workEnd.getTime() - slotStart.getTime()) / (1000 * 60);
        if (slotDuration >= durationMinutes) {
          freeSlots.push({
            start: slotStart.toISOString(),
            end: workEnd.toISOString(),
            duration: slotDuration,
          });
        }
      }

      currentTime = addDays(dayStart, 1);
    }

    return freeSlots;
  }
}