import { google, calendar_v3 } from 'googleapis';
import { googleOAuthService } from './googleOAuthService';
import { supabase } from '../supabase/clientV2';

interface CalendarEvent {
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string; // For timed events
    date?: string; // For all-day events
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    optional?: boolean;
    responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  }>;
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  recurrence?: string[]; // RRULE strings
  colorId?: string;
  visibility?: 'default' | 'public' | 'private' | 'confidential';
  conferenceData?: {
    createRequest?: {
      requestId: string;
      conferenceSolutionKey: {
        type: string; // 'hangoutsMeet', 'eventHangout', etc.
      };
    };
  };
  variables?: Record<string, string>; // For template variable replacement
}

interface EventFilter {
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  q?: string; // Free text search
  maxResults?: number;
  orderBy?: 'startTime' | 'updated';
  singleEvents?: boolean;
  showDeleted?: boolean;
}

class GoogleCalendarService {
  /**
   * Create a calendar event
   */
  async createEvent(
    userId: string,
    event: CalendarEvent,
    calendarId: string = 'primary',
    sendNotifications: boolean = true
  ): Promise<string> {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const integration = await googleOAuthService.getTokens(userId);
    
    if (!integration) {
      throw new Error('No Google integration found');
    }

    const calendar = google.calendar({ version: 'v3', auth: authClient });

    try {
      // Replace variables in event fields
      const processedEvent = this.processEventVariables(event);

      // Create the event
      const response = await calendar.events.insert({
        calendarId,
        sendNotifications,
        conferenceDataVersion: event.conferenceData ? 1 : 0,
        requestBody: processedEvent as calendar_v3.Schema$Event
      });

      // Log the activity
      await googleOAuthService.logActivity(
        integration.id,
        'calendar',
        'create_event',
        'success',
        { summary: event.summary, calendarId },
        { eventId: response.data.id }
      );

      return response.data.id!;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      
      await googleOAuthService.logActivity(
        integration.id,
        'calendar',
        'create_event',
        'error',
        { summary: event.summary, calendarId },
        null,
        error.message
      );

      throw new Error('Failed to create calendar event');
    }
  }

  /**
   * Get calendar events
   */
  async getEvents(userId: string, filter: EventFilter = {}) {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    try {
      const response = await calendar.events.list({
        calendarId: filter.calendarId || 'primary',
        timeMin: filter.timeMin,
        timeMax: filter.timeMax,
        q: filter.q,
        maxResults: filter.maxResults || 10,
        orderBy: filter.orderBy,
        singleEvents: filter.singleEvents !== false,
        showDeleted: filter.showDeleted
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw new Error('Failed to fetch calendar events');
    }
  }

  /**
   * Update a calendar event
   */
  async updateEvent(
    userId: string,
    eventId: string,
    event: Partial<CalendarEvent>,
    calendarId: string = 'primary',
    sendNotifications: boolean = true
  ) {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const integration = await googleOAuthService.getTokens(userId);
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    try {
      const processedEvent = this.processEventVariables(event);

      const response = await calendar.events.patch({
        calendarId,
        eventId,
        sendNotifications,
        requestBody: processedEvent as calendar_v3.Schema$Event
      });

      await googleOAuthService.logActivity(
        integration!.id,
        'calendar',
        'update_event',
        'success',
        { eventId, calendarId },
        response.data
      );

      return response.data;
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw new Error('Failed to update calendar event');
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(
    userId: string,
    eventId: string,
    calendarId: string = 'primary',
    sendNotifications: boolean = true
  ) {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const integration = await googleOAuthService.getTokens(userId);
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    try {
      await calendar.events.delete({
        calendarId,
        eventId,
        sendNotifications
      });

      await googleOAuthService.logActivity(
        integration!.id,
        'calendar',
        'delete_event',
        'success',
        { eventId, calendarId },
        null
      );
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw new Error('Failed to delete calendar event');
    }
  }

  /**
   * Get list of calendars
   */
  async getCalendars(userId: string) {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const integration = await googleOAuthService.getTokens(userId);
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    try {
      const response = await calendar.calendarList.list();
      const calendars = response.data.items || [];

      // Cache calendars in database
      for (const cal of calendars) {
        await supabase
          .from('google_calendars')
          .upsert({
            integration_id: integration!.id,
            calendar_id: cal.id,
            name: cal.summary || cal.id || '',
            description: cal.description,
            time_zone: cal.timeZone,
            color_id: cal.colorId,
            is_primary: cal.primary || false,
            access_role: cal.accessRole,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'integration_id,calendar_id'
          });
      }

      return calendars;
    } catch (error) {
      console.error('Error fetching calendars:', error);
      throw new Error('Failed to fetch calendars');
    }
  }

  /**
   * Create a new calendar
   */
  async createCalendar(
    userId: string,
    summary: string,
    description?: string,
    timeZone?: string
  ) {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    try {
      const response = await calendar.calendars.insert({
        requestBody: {
          summary,
          description,
          timeZone: timeZone || 'America/New_York'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error creating calendar:', error);
      throw new Error('Failed to create calendar');
    }
  }

  /**
   * Check free/busy time
   */
  async getFreeBusy(
    userId: string,
    timeMin: string,
    timeMax: string,
    calendars: string[] = ['primary']
  ) {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    try {
      const items = calendars.map(id => ({ id }));

      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin,
          timeMax,
          items
        }
      });

      return response.data.calendars;
    } catch (error) {
      console.error('Error checking free/busy:', error);
      throw new Error('Failed to check free/busy time');
    }
  }

  /**
   * Create recurring event
   */
  async createRecurringEvent(
    userId: string,
    event: CalendarEvent,
    recurrenceRule: string,
    calendarId: string = 'primary'
  ): Promise<string> {
    // Add recurrence rule to event
    const recurringEvent = {
      ...event,
      recurrence: [recurrenceRule]
    };

    return this.createEvent(userId, recurringEvent, calendarId);
  }

  /**
   * Quick add event (using natural language)
   */
  async quickAddEvent(
    userId: string,
    text: string,
    calendarId: string = 'primary'
  ) {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const integration = await googleOAuthService.getTokens(userId);
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    try {
      const response = await calendar.events.quickAdd({
        calendarId,
        text
      });

      await googleOAuthService.logActivity(
        integration!.id,
        'calendar',
        'quick_add_event',
        'success',
        { text, calendarId },
        { eventId: response.data.id }
      );

      return response.data;
    } catch (error) {
      console.error('Error quick adding event:', error);
      throw new Error('Failed to quick add event');
    }
  }

  /**
   * Add attendees to existing event
   */
  async addAttendees(
    userId: string,
    eventId: string,
    attendees: Array<{ email: string; displayName?: string }>,
    calendarId: string = 'primary',
    sendNotifications: boolean = true
  ) {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    try {
      // Get current event
      const eventResponse = await calendar.events.get({
        calendarId,
        eventId
      });

      const currentAttendees = eventResponse.data.attendees || [];
      const updatedAttendees = [...currentAttendees, ...attendees];

      // Update event with new attendees
      const response = await calendar.events.patch({
        calendarId,
        eventId,
        sendNotifications,
        requestBody: {
          attendees: updatedAttendees
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error adding attendees:', error);
      throw new Error('Failed to add attendees');
    }
  }

  /**
   * Get upcoming events for next N days
   */
  async getUpcomingEvents(
    userId: string,
    days: number = 7,
    calendarId: string = 'primary'
  ) {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    return this.getEvents(userId, {
      calendarId,
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      orderBy: 'startTime',
      singleEvents: true
    });
  }

  /**
   * Helper: Process event variables
   */
  private processEventVariables(event: Partial<CalendarEvent>): Partial<CalendarEvent> {
    const processed = { ...event };

    if (event.variables) {
      if (processed.summary) {
        processed.summary = this.replaceVariables(processed.summary, event.variables);
      }
      if (processed.description) {
        processed.description = this.replaceVariables(processed.description, event.variables);
      }
      if (processed.location) {
        processed.location = this.replaceVariables(processed.location, event.variables);
      }
      
      // Remove variables from final event
      delete processed.variables;
    }

    return processed;
  }

  /**
   * Helper: Replace variables in text
   */
  private replaceVariables(text: string, variables: Record<string, string>): string {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }
}

export const googleCalendarService = new GoogleCalendarService();