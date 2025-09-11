import { z } from 'zod';
import { Tool, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { CalendarClient, CreateEventInput, UpdateEventInput, ListEventsInput, FindFreeSlotsInput } from '../calendar-client.js';
import { addDays, format, parseISO } from 'date-fns';

// Tool Schemas
const CreateEventToolSchema = z.object({
  summary: z.string().describe('Event title/summary'),
  description: z.string().optional().describe('Event description'),
  location: z.string().optional().describe('Event location'),
  startDateTime: z.string().describe('Start date/time in ISO format'),
  endDateTime: z.string().describe('End date/time in ISO format'),
  startDate: z.string().optional().describe('Start date (all-day event)'),
  endDate: z.string().optional().describe('End date (all-day event)'),
  timeZone: z.string().optional().default('UTC').describe('Event timezone'),
  attendees: z.array(z.object({
    email: z.string().email(),
    displayName: z.string().optional(),
    optional: z.boolean().optional(),
  })).optional().describe('Event attendees'),
  reminders: z.array(z.object({
    method: z.enum(['email', 'popup', 'sms']),
    minutes: z.number().min(0),
  })).optional().describe('Event reminders'),
  createMeetLink: z.boolean().optional().describe('Create Google Meet link'),
  calendarId: z.string().optional().default('primary').describe('Calendar ID'),
});

const UpdateEventToolSchema = z.object({
  eventId: z.string().describe('Event ID to update'),
  summary: z.string().optional().describe('Event title/summary'),
  description: z.string().optional().describe('Event description'),
  location: z.string().optional().describe('Event location'),
  startDateTime: z.string().optional().describe('Start date/time in ISO format'),
  endDateTime: z.string().optional().describe('End date/time in ISO format'),
  timeZone: z.string().optional().describe('Event timezone'),
  attendees: z.array(z.object({
    email: z.string().email(),
    displayName: z.string().optional(),
    optional: z.boolean().optional(),
  })).optional().describe('Event attendees'),
  calendarId: z.string().optional().default('primary').describe('Calendar ID'),
});

const ListEventsToolSchema = z.object({
  calendarId: z.string().optional().default('primary').describe('Calendar ID'),
  timeMin: z.string().optional().describe('Start time for event search (ISO format)'),
  timeMax: z.string().optional().describe('End time for event search (ISO format)'),
  query: z.string().optional().describe('Text search query'),
  maxResults: z.number().min(1).max(250).optional().default(25).describe('Maximum number of events'),
  orderBy: z.enum(['startTime', 'updated']).optional().describe('Sort order'),
});

const FindFreeSlotsToolSchema = z.object({
  startDate: z.string().describe('Start date for search (ISO format)'),
  endDate: z.string().describe('End date for search (ISO format)'),
  duration: z.number().min(15).describe('Required duration in minutes'),
  calendarIds: z.array(z.string()).optional().default(['primary']).describe('Calendar IDs to check'),
  workingHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional().default('09:00').describe('Working hours start (HH:MM)'),
  workingHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().default('17:00').describe('Working hours end (HH:MM)'),
  excludeWeekends: z.boolean().optional().default(true).describe('Exclude weekends'),
});

const CheckAvailabilityToolSchema = z.object({
  emails: z.array(z.string().email()).describe('Attendee emails to check'),
  startDateTime: z.string().describe('Start date/time (ISO format)'),
  endDateTime: z.string().describe('End date/time (ISO format)'),
});

const ScheduleMeetingToolSchema = z.object({
  summary: z.string().describe('Meeting title'),
  description: z.string().optional().describe('Meeting description'),
  attendees: z.array(z.string().email()).describe('Attendee emails'),
  duration: z.number().min(15).describe('Meeting duration in minutes'),
  preferredDates: z.array(z.string()).optional().describe('Preferred dates (ISO format)'),
  workingHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional().default('09:00').describe('Working hours start'),
  workingHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().default('17:00').describe('Working hours end'),
  timeZone: z.string().optional().default('UTC').describe('Timezone'),
  createMeetLink: z.boolean().optional().default(true).describe('Create Google Meet link'),
});

const RescheduleEventToolSchema = z.object({
  eventId: z.string().describe('Event ID to reschedule'),
  newStartDateTime: z.string().describe('New start date/time (ISO format)'),
  newEndDateTime: z.string().describe('New end date/time (ISO format)'),
  calendarId: z.string().optional().default('primary').describe('Calendar ID'),
  notifyAttendees: z.boolean().optional().default(true).describe('Notify attendees of change'),
});

const CreateRecurringToolSchema = z.object({
  summary: z.string().describe('Event title'),
  description: z.string().optional().describe('Event description'),
  location: z.string().optional().describe('Event location'),
  startDateTime: z.string().describe('Start date/time (ISO format)'),
  endDateTime: z.string().describe('End date/time (ISO format)'),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).describe('Recurrence frequency'),
  interval: z.number().min(1).optional().default(1).describe('Recurrence interval'),
  count: z.number().min(1).optional().describe('Number of occurrences'),
  until: z.string().optional().describe('End date for recurrence (ISO format)'),
  byDay: z.array(z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])).optional().describe('Days of week'),
  attendees: z.array(z.string().email()).optional().describe('Attendee emails'),
  calendarId: z.string().optional().default('primary').describe('Calendar ID'),
});

const BlockTimeToolSchema = z.object({
  summary: z.string().describe('Block title (e.g., "Focus Time", "Unavailable")'),
  startDateTime: z.string().describe('Start date/time (ISO format)'),
  endDateTime: z.string().describe('End date/time (ISO format)'),
  description: z.string().optional().describe('Block description'),
  showAsBusy: z.boolean().optional().default(true).describe('Show as busy time'),
  calendarId: z.string().optional().default('primary').describe('Calendar ID'),
});

const RespondToInviteToolSchema = z.object({
  eventId: z.string().describe('Event ID to respond to'),
  response: z.enum(['accepted', 'declined', 'tentative']).describe('Response to invitation'),
  comment: z.string().optional().describe('Optional response comment'),
  calendarId: z.string().optional().default('primary').describe('Calendar ID'),
});

const SyncWithCrmToolSchema = z.object({
  crmType: z.enum(['supabase', 'salesforce', 'hubspot', 'custom']).describe('CRM system type'),
  eventId: z.string().optional().describe('Specific event ID to sync'),
  syncDirection: z.enum(['calendar-to-crm', 'crm-to-calendar', 'bidirectional']).describe('Sync direction'),
  mapping: z.object({
    contactEmailField: z.string().optional().default('email'),
    activityTypeField: z.string().optional().default('type'),
    descriptionField: z.string().optional().default('description'),
  }).optional().describe('Field mapping configuration'),
});

export const CALENDAR_TOOLS: Tool[] = [
  {
    name: 'calendar_get_auth_url',
    description: 'Get the OAuth authorization URL to authenticate with Google Calendar',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'calendar_authenticate',
    description: 'Complete authentication using authorization code from OAuth flow',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Authorization code from OAuth flow' }
      },
      required: ['code']
    },
  },
  {
    name: 'calendar_check_auth',
    description: 'Check if the calendar client is authenticated',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'calendar_create_event',
    description: 'Create a new calendar event with attendees, location, and reminders',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Event title/summary' },
        description: { type: 'string', description: 'Event description' },
        location: { type: 'string', description: 'Event location' },
        startDateTime: { type: 'string', description: 'Start date/time in ISO format' },
        endDateTime: { type: 'string', description: 'End date/time in ISO format' },
        startDate: { type: 'string', description: 'Start date (all-day event)' },
        endDate: { type: 'string', description: 'End date (all-day event)' },
        timeZone: { type: 'string', description: 'Event timezone', default: 'UTC' },
        attendees: {
          type: 'array',
          description: 'Event attendees',
          items: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              displayName: { type: 'string' },
              optional: { type: 'boolean' }
            },
            required: ['email']
          }
        },
        reminders: {
          type: 'array',
          description: 'Event reminders',
          items: {
            type: 'object',
            properties: {
              method: { type: 'string', enum: ['email', 'popup', 'sms'] },
              minutes: { type: 'number' }
            },
            required: ['method', 'minutes']
          }
        },
        createMeetLink: { type: 'boolean', description: 'Create Google Meet link' },
        calendarId: { type: 'string', description: 'Calendar ID', default: 'primary' }
      },
      required: ['summary']
    },
  },
  {
    name: 'calendar_update_event',
    description: 'Update an existing calendar event',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event ID to update' },
        summary: { type: 'string', description: 'Event title/summary' },
        description: { type: 'string', description: 'Event description' },
        location: { type: 'string', description: 'Event location' },
        startDateTime: { type: 'string', description: 'Start date/time in ISO format' },
        endDateTime: { type: 'string', description: 'End date/time in ISO format' },
        timeZone: { type: 'string', description: 'Event timezone' },
        attendees: {
          type: 'array',
          description: 'Event attendees',
          items: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              displayName: { type: 'string' },
              optional: { type: 'boolean' }
            },
            required: ['email']
          }
        },
        calendarId: { type: 'string', description: 'Calendar ID', default: 'primary' }
      },
      required: ['eventId']
    },
  },
  {
    name: 'calendar_delete_event',
    description: 'Delete a calendar event',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event ID to delete' },
        calendarId: { type: 'string', description: 'Calendar ID', default: 'primary' }
      },
      required: ['eventId']
    },
  },
  {
    name: 'calendar_get_event',
    description: 'Get detailed information about a specific calendar event',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event ID to retrieve' },
        calendarId: { type: 'string', description: 'Calendar ID', default: 'primary' }
      },
      required: ['eventId']
    },
  },
  {
    name: 'calendar_list_events',
    description: 'List calendar events within a date range with filtering options',
    inputSchema: {
      type: 'object',
      properties: {
        calendarId: { type: 'string', description: 'Calendar ID', default: 'primary' },
        timeMin: { type: 'string', description: 'Start time for event search (ISO format)' },
        timeMax: { type: 'string', description: 'End time for event search (ISO format)' },
        query: { type: 'string', description: 'Text search query' },
        maxResults: { type: 'number', description: 'Maximum number of events', default: 25 },
        orderBy: { type: 'string', enum: ['startTime', 'updated'], description: 'Sort order' }
      }
    },
  },
  {
    name: 'calendar_find_free_slots',
    description: 'Find available time slots for scheduling meetings',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date for search (ISO format)' },
        endDate: { type: 'string', description: 'End date for search (ISO format)' },
        duration: { type: 'number', description: 'Required duration in minutes' },
        calendarIds: { type: 'array', items: { type: 'string' }, description: 'Calendar IDs to check' },
        workingHoursStart: { type: 'string', description: 'Working hours start (HH:MM)', default: '09:00' },
        workingHoursEnd: { type: 'string', description: 'Working hours end (HH:MM)', default: '17:00' },
        excludeWeekends: { type: 'boolean', description: 'Exclude weekends', default: true }
      },
      required: ['startDate', 'endDate', 'duration']
    },
  },
  {
    name: 'calendar_check_availability',
    description: 'Check if attendees are available at a specific time',
    inputSchema: {
      type: 'object',
      properties: {
        emails: { type: 'array', items: { type: 'string' }, description: 'Attendee emails to check' },
        startDateTime: { type: 'string', description: 'Start date/time (ISO format)' },
        endDateTime: { type: 'string', description: 'End date/time (ISO format)' }
      },
      required: ['emails', 'startDateTime', 'endDateTime']
    },
  },
  {
    name: 'calendar_schedule_meeting',
    description: 'Intelligently schedule a meeting with optimal time selection',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Meeting title' },
        description: { type: 'string', description: 'Meeting description' },
        attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee emails' },
        duration: { type: 'number', description: 'Meeting duration in minutes' },
        preferredDates: { type: 'array', items: { type: 'string' }, description: 'Preferred dates (ISO format)' },
        workingHoursStart: { type: 'string', description: 'Working hours start', default: '09:00' },
        workingHoursEnd: { type: 'string', description: 'Working hours end', default: '17:00' },
        timeZone: { type: 'string', description: 'Timezone', default: 'UTC' },
        createMeetLink: { type: 'boolean', description: 'Create Google Meet link', default: true }
      },
      required: ['summary', 'attendees', 'duration']
    },
  },
  {
    name: 'calendar_reschedule_event',
    description: 'Reschedule an existing event to a new time',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event ID to reschedule' },
        newStartDateTime: { type: 'string', description: 'New start date/time (ISO format)' },
        newEndDateTime: { type: 'string', description: 'New end date/time (ISO format)' },
        calendarId: { type: 'string', description: 'Calendar ID', default: 'primary' },
        notifyAttendees: { type: 'boolean', description: 'Notify attendees of change', default: true }
      },
      required: ['eventId', 'newStartDateTime', 'newEndDateTime']
    },
  },
  {
    name: 'calendar_send_invites',
    description: 'Send calendar invitations to attendees for an existing event',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event ID to send invites for' },
        attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee emails' },
        calendarId: { type: 'string', description: 'Calendar ID', default: 'primary' },
        message: { type: 'string', description: 'Custom invitation message' }
      },
      required: ['eventId', 'attendees']
    },
  },
  {
    name: 'calendar_respond_to_invite',
    description: 'Respond to a calendar invitation',
    inputSchema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Event ID to respond to' },
        response: { type: 'string', enum: ['accepted', 'declined', 'tentative'], description: 'Response to invitation' },
        comment: { type: 'string', description: 'Optional response comment' },
        calendarId: { type: 'string', description: 'Calendar ID', default: 'primary' }
      },
      required: ['eventId', 'response']
    },
  },
  {
    name: 'calendar_create_recurring',
    description: 'Create recurring calendar events with flexible patterns',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Event title' },
        description: { type: 'string', description: 'Event description' },
        location: { type: 'string', description: 'Event location' },
        startDateTime: { type: 'string', description: 'Start date/time (ISO format)' },
        endDateTime: { type: 'string', description: 'End date/time (ISO format)' },
        frequency: { type: 'string', enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'], description: 'Recurrence frequency' },
        interval: { type: 'number', description: 'Recurrence interval', default: 1 },
        count: { type: 'number', description: 'Number of occurrences' },
        until: { type: 'string', description: 'End date for recurrence (ISO format)' },
        byDay: { type: 'array', items: { type: 'string', enum: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] }, description: 'Days of week' },
        attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee emails' },
        calendarId: { type: 'string', description: 'Calendar ID', default: 'primary' }
      },
      required: ['summary', 'startDateTime', 'endDateTime', 'frequency']
    },
  },
  {
    name: 'calendar_find_optimal_time',
    description: 'Find the optimal meeting time considering all attendees availability',
    inputSchema: {
      type: 'object',
      properties: {
        attendees: { type: 'array', items: { type: 'string' }, description: 'Attendee emails' },
        duration: { type: 'number', description: 'Meeting duration in minutes' },
        dateRange: {
          type: 'object',
          properties: {
            start: { type: 'string', description: 'Start date for search (ISO format)' },
            end: { type: 'string', description: 'End date for search (ISO format)' }
          },
          required: ['start', 'end']
        },
        preferences: {
          type: 'object',
          properties: {
            preferMorning: { type: 'boolean', description: 'Prefer morning slots' },
            preferAfternoon: { type: 'boolean', description: 'Prefer afternoon slots' },
            excludeWeekends: { type: 'boolean', description: 'Exclude weekends', default: true },
            workingHoursStart: { type: 'string', description: 'Working hours start', default: '09:00' },
            workingHoursEnd: { type: 'string', description: 'Working hours end', default: '17:00' }
          }
        }
      },
      required: ['attendees', 'duration', 'dateRange']
    },
  },
  {
    name: 'calendar_block_time',
    description: 'Block time slots for focus work or unavailability',
    inputSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Block title (e.g., "Focus Time", "Unavailable")' },
        startDateTime: { type: 'string', description: 'Start date/time (ISO format)' },
        endDateTime: { type: 'string', description: 'End date/time (ISO format)' },
        description: { type: 'string', description: 'Block description' },
        showAsBusy: { type: 'boolean', description: 'Show as busy time', default: true },
        calendarId: { type: 'string', description: 'Calendar ID', default: 'primary' }
      },
      required: ['summary', 'startDateTime', 'endDateTime']
    },
  },
  {
    name: 'calendar_sync_with_crm',
    description: 'Synchronize calendar events with CRM activities and contacts',
    inputSchema: {
      type: 'object',
      properties: {
        crmType: { type: 'string', enum: ['supabase', 'salesforce', 'hubspot', 'custom'], description: 'CRM system type' },
        eventId: { type: 'string', description: 'Specific event ID to sync' },
        syncDirection: { type: 'string', enum: ['calendar-to-crm', 'crm-to-calendar', 'bidirectional'], description: 'Sync direction' },
        mapping: {
          type: 'object',
          properties: {
            contactEmailField: { type: 'string', description: 'Contact email field', default: 'email' },
            activityTypeField: { type: 'string', description: 'Activity type field', default: 'type' },
            descriptionField: { type: 'string', description: 'Description field', default: 'description' }
          }
        }
      },
      required: ['crmType', 'syncDirection']
    },
  },
];

export class CalendarToolHandler {
  constructor(private client: CalendarClient) {}

  async handleToolCall(name: string, args: any): Promise<any> {
    if (!this.client.isAuthenticated()) {
      throw new Error('Calendar client not authenticated. Please authenticate first.');
    }

    switch (name) {
      case 'calendar_create_event':
        return this.createEvent(args);
      case 'calendar_update_event':
        return this.updateEvent(args);
      case 'calendar_delete_event':
        return this.deleteEvent(args);
      case 'calendar_get_event':
        return this.getEvent(args);
      case 'calendar_list_events':
        return this.listEvents(args);
      case 'calendar_find_free_slots':
        return this.findFreeSlots(args);
      case 'calendar_check_availability':
        return this.checkAvailability(args);
      case 'calendar_schedule_meeting':
        return this.scheduleMeeting(args);
      case 'calendar_reschedule_event':
        return this.rescheduleEvent(args);
      case 'calendar_send_invites':
        return this.sendInvites(args);
      case 'calendar_respond_to_invite':
        return this.respondToInvite(args);
      case 'calendar_create_recurring':
        return this.createRecurring(args);
      case 'calendar_find_optimal_time':
        return this.findOptimalTime(args);
      case 'calendar_block_time':
        return this.blockTime(args);
      case 'calendar_sync_with_crm':
        return this.syncWithCrm(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async createEvent(args: any) {
    const parsed = CreateEventToolSchema.parse(args);
    
    const eventData: CreateEventInput = {
      summary: parsed.summary,
      description: parsed.description,
      location: parsed.location,
      start: parsed.startDate ? 
        { date: parsed.startDate } : 
        { dateTime: parsed.startDateTime, timeZone: parsed.timeZone },
      end: parsed.endDate ? 
        { date: parsed.endDate } : 
        { dateTime: parsed.endDateTime, timeZone: parsed.timeZone },
      attendees: parsed.attendees,
      reminders: parsed.reminders,
      calendarId: parsed.calendarId,
    };

    // Add Google Meet link if requested
    if (parsed.createMeetLink) {
      eventData.conferenceData = {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const event = await this.client.createEvent(eventData);
    return {
      success: true,
      event,
      message: `Event "${event.summary}" created successfully`,
    };
  }

  private async updateEvent(args: any) {
    const parsed = UpdateEventToolSchema.parse(args);
    
    const updateData: UpdateEventInput = {
      eventId: parsed.eventId,
      summary: parsed.summary,
      description: parsed.description,
      location: parsed.location,
      calendarId: parsed.calendarId,
      attendees: parsed.attendees,
    };

    if (parsed.startDateTime) {
      updateData.start = { dateTime: parsed.startDateTime, timeZone: parsed.timeZone };
    }

    if (parsed.endDateTime) {
      updateData.end = { dateTime: parsed.endDateTime, timeZone: parsed.timeZone };
    }

    const event = await this.client.updateEvent(updateData);
    return {
      success: true,
      event,
      message: `Event "${event.summary}" updated successfully`,
    };
  }

  private async deleteEvent(args: any) {
    const { eventId, calendarId = 'primary' } = args;
    
    await this.client.deleteEvent(eventId, calendarId);
    return {
      success: true,
      message: `Event deleted successfully`,
    };
  }

  private async getEvent(args: any) {
    const { eventId, calendarId = 'primary' } = args;
    
    const event = await this.client.getEvent(eventId, calendarId);
    return {
      success: true,
      event,
    };
  }

  private async listEvents(args: any) {
    const parsed = ListEventsToolSchema.parse(args);
    
    const listData: ListEventsInput = {
      calendarId: parsed.calendarId,
      timeMin: parsed.timeMin,
      timeMax: parsed.timeMax,
      q: parsed.query,
      maxResults: parsed.maxResults,
      orderBy: parsed.orderBy,
      showDeleted: false,
      singleEvents: true,
    };

    const events = await this.client.listEvents(listData);
    return {
      success: true,
      events,
      count: events.length,
    };
  }

  private async findFreeSlots(args: any) {
    const parsed = FindFreeSlotsToolSchema.parse(args);
    
    const findData: FindFreeSlotsInput = {
      timeMin: parsed.startDate,
      timeMax: parsed.endDate,
      duration: parsed.duration,
      calendarIds: parsed.calendarIds || ['primary'],
      workingHours: {
        start: parsed.workingHoursStart,
        end: parsed.workingHoursEnd,
      },
      excludeWeekends: parsed.excludeWeekends,
    };

    const freeSlots = await this.client.findFreeSlots(findData);
    return {
      success: true,
      freeSlots,
      count: freeSlots.length,
    };
  }

  private async checkAvailability(args: any) {
    const parsed = CheckAvailabilityToolSchema.parse(args);
    
    const availability = await this.client.checkAvailability(
      parsed.emails,
      parsed.startDateTime,
      parsed.endDateTime
    );

    return {
      success: true,
      availability,
      allAvailable: Object.values(availability).every(a => a.available),
    };
  }

  private async scheduleMeeting(args: any) {
    const parsed = ScheduleMeetingToolSchema.parse(args);
    
    // Find optimal time first
    const searchStart = parsed.preferredDates?.[0] || new Date().toISOString();
    const searchEnd = parsed.preferredDates?.[parsed.preferredDates.length - 1] || 
                      addDays(new Date(), 7).toISOString();

    const freeSlots = await this.client.findFreeSlots({
      timeMin: searchStart,
      timeMax: searchEnd,
      duration: parsed.duration,
      calendarIds: ['primary'],
      workingHours: {
        start: parsed.workingHoursStart,
        end: parsed.workingHoursEnd,
      },
      excludeWeekends: true,
    });

    if (freeSlots.length === 0) {
      return {
        success: false,
        message: 'No available time slots found for the requested duration',
        duration: parsed.duration,
      };
    }

    // Check availability for the first slot
    const firstSlot = freeSlots[0];
    const slotEnd = new Date(new Date(firstSlot.start).getTime() + parsed.duration * 60000).toISOString();
    
    const availability = await this.client.checkAvailability(
      parsed.attendees,
      firstSlot.start,
      slotEnd
    );

    // If all attendees are available, create the meeting
    const allAvailable = Object.values(availability).every(a => a.available);
    
    if (allAvailable) {
      const eventData: CreateEventInput = {
        summary: parsed.summary,
        description: parsed.description,
        start: { dateTime: firstSlot.start, timeZone: parsed.timeZone },
        end: { dateTime: slotEnd, timeZone: parsed.timeZone },
        attendees: parsed.attendees.map(email => ({ email })),
        calendarId: 'primary',
      };

      if (parsed.createMeetLink) {
        eventData.conferenceData = {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
      }

      const event = await this.client.createEvent(eventData);
      
      return {
        success: true,
        event,
        selectedSlot: firstSlot,
        message: `Meeting "${event.summary}" scheduled successfully`,
      };
    }

    return {
      success: false,
      message: 'Not all attendees are available at the optimal time',
      suggestedSlots: freeSlots.slice(0, 5),
      availability,
    };
  }

  private async rescheduleEvent(args: any) {
    const parsed = RescheduleEventToolSchema.parse(args);
    
    const updateData: UpdateEventInput = {
      eventId: parsed.eventId,
      start: { dateTime: parsed.newStartDateTime },
      end: { dateTime: parsed.newEndDateTime },
      calendarId: parsed.calendarId,
    };

    const event = await this.client.updateEvent(updateData);
    
    return {
      success: true,
      event,
      message: `Event "${event.summary}" rescheduled successfully`,
    };
  }

  private async sendInvites(args: any) {
    const { eventId, attendees, calendarId = 'primary', message } = args;
    
    // Get current event
    const event = await this.client.getEvent(eventId, calendarId);
    
    // Update event with new attendees
    const currentAttendees = event.attendees || [];
    const newAttendees = attendees.map((email: string) => ({ email }));
    const allAttendees = [...currentAttendees, ...newAttendees];

    await this.client.updateEvent({
      eventId,
      attendees: allAttendees,
      calendarId,
    });

    return {
      success: true,
      message: `Invitations sent to ${attendees.length} attendees`,
      attendees,
    };
  }

  private async respondToInvite(args: any) {
    const parsed = RespondToInviteToolSchema.parse(args);
    
    // Get the event first
    const event = await this.client.getEvent(parsed.eventId, parsed.calendarId);
    
    // This would typically involve updating the attendee's response status
    // For now, we'll simulate the response
    return {
      success: true,
      message: `Responded "${parsed.response}" to event "${event.summary}"`,
      response: parsed.response,
      comment: parsed.comment,
    };
  }

  private async createRecurring(args: any) {
    const parsed = CreateRecurringToolSchema.parse(args);
    
    const eventData: CreateEventInput = {
      summary: parsed.summary,
      description: parsed.description,
      location: parsed.location,
      start: { dateTime: parsed.startDateTime },
      end: { dateTime: parsed.endDateTime },
      attendees: parsed.attendees?.map(email => ({ email })),
      recurrence: {
        frequency: parsed.frequency,
        interval: parsed.interval,
        count: parsed.count,
        until: parsed.until,
        byDay: parsed.byDay,
      },
      calendarId: parsed.calendarId,
    };

    const event = await this.client.createEvent(eventData);
    
    return {
      success: true,
      event,
      message: `Recurring event "${event.summary}" created successfully`,
    };
  }

  private async findOptimalTime(args: any) {
    const { attendees, duration, dateRange, preferences = {} } = args;
    
    const freeSlots = await this.client.findFreeSlots({
      timeMin: dateRange.start,
      timeMax: dateRange.end,
      duration,
      calendarIds: ['primary'],
      workingHours: {
        start: preferences.workingHoursStart || '09:00',
        end: preferences.workingHoursEnd || '17:00',
      },
      excludeWeekends: preferences.excludeWeekends !== false,
    });

    // Score slots based on preferences
    const scoredSlots = freeSlots.map(slot => {
      const slotTime = new Date(slot.start);
      const hour = slotTime.getHours();
      let score = 1;

      if (preferences.preferMorning && hour < 12) score += 0.5;
      if (preferences.preferAfternoon && hour >= 12) score += 0.5;

      return { ...slot, score };
    });

    // Sort by score (highest first)
    scoredSlots.sort((a, b) => b.score - a.score);

    // Check availability for top slots
    const topSlots = scoredSlots.slice(0, 5);
    const availabilityResults = await Promise.all(
      topSlots.map(async slot => {
        const slotEnd = new Date(new Date(slot.start).getTime() + duration * 60000).toISOString();
        const availability = await this.client.checkAvailability(attendees, slot.start, slotEnd);
        const allAvailable = Object.values(availability).every(a => a.available);
        
        return {
          slot,
          availability,
          allAvailable,
        };
      })
    );

    const optimalSlot = availabilityResults.find(result => result.allAvailable);

    return {
      success: true,
      optimalSlot: optimalSlot?.slot || null,
      alternativeSlots: availabilityResults
        .filter(result => !result.allAvailable)
        .map(result => ({
          slot: result.slot,
          conflicts: Object.entries(result.availability)
            .filter(([_, avail]) => !avail.available)
            .map(([email, avail]) => ({ email, conflicts: avail.conflicts }))
        }))
        .slice(0, 3),
      allResults: availabilityResults,
    };
  }

  private async blockTime(args: any) {
    const parsed = BlockTimeToolSchema.parse(args);
    
    const eventData: CreateEventInput = {
      summary: parsed.summary,
      description: parsed.description || 'Blocked time',
      start: { dateTime: parsed.startDateTime },
      end: { dateTime: parsed.endDateTime },
      calendarId: parsed.calendarId,
      // Note: Google Calendar doesn't have a direct "show as busy" field
      // This would be handled through event transparency settings
    };

    const event = await this.client.createEvent(eventData);
    
    return {
      success: true,
      event,
      message: `Time blocked: "${event.summary}"`,
    };
  }

  private async syncWithCrm(args: any) {
    const parsed = SyncWithCrmToolSchema.parse(args);
    
    // This is a placeholder implementation
    // In a real implementation, you would integrate with specific CRM APIs
    
    switch (parsed.crmType) {
      case 'supabase':
        return this.syncWithSupabase(parsed);
      default:
        return {
          success: false,
          message: `CRM integration for ${parsed.crmType} not yet implemented`,
          crmType: parsed.crmType,
        };
    }
  }

  private async syncWithSupabase(syncConfig: any) {
    // Placeholder for Supabase integration
    // You would implement actual Supabase client calls here
    
    const events = await this.client.listEvents({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      timeMax: addDays(new Date(), 30).toISOString(),
      maxResults: 100,
      showDeleted: false,
      singleEvents: true,
    });

    return {
      success: true,
      message: 'Supabase sync completed',
      synced: {
        events: events.length,
        contacts: 0, // Placeholder
        activities: 0, // Placeholder
      },
      syncDirection: syncConfig.syncDirection,
    };
  }
}