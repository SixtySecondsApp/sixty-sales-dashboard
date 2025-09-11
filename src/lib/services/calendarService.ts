import { supabase } from '@/lib/supabase/clientV2';
import { CalendarEvent } from '@/pages/Calendar';

export interface CalendarSyncStatus {
  isRunning: boolean;
  lastSyncedAt?: Date;
  eventsCreated?: number;
  eventsUpdated?: number;
  eventsDeleted?: number;
  error?: string;
}

export interface DatabaseCalendarEvent {
  id: string;
  external_id: string | null;
  calendar_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean;
  status: string;
  meeting_url: string | null;
  attendees_count: number;
  contact_id: string | null;
  contact_name: string | null;
  company_id: string | null;
  company_name: string | null;
  color: string | null;
  sync_status: string;
  creator_email: string | null;
  organizer_email: string | null;
  html_link: string | null;
  raw_data: any;
}

class CalendarService {
  /**
   * Sync calendar events from Google Calendar to database
   */
  async syncCalendarEvents(
    action: 'sync-full' | 'sync-incremental' | 'sync-historical' = 'sync-incremental',
    calendarId: string = 'primary',
    startDate?: string,
    endDate?: string
  ): Promise<CalendarSyncStatus> {
    try {
      const response = await supabase.functions.invoke('calendar-sync', {
        body: {
          action,
          calendarId,
          startDate,
          endDate,
        },
      });

      if (response.error) {
        throw response.error;
      }

      return {
        isRunning: false,
        lastSyncedAt: new Date(),
        eventsCreated: response.data.stats?.created || 0,
        eventsUpdated: response.data.stats?.updated || 0,
        eventsDeleted: response.data.stats?.deleted || 0,
      };
    } catch (error) {
      console.error('Calendar sync failed:', error);
      return {
        isRunning: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      };
    }
  }

  /**
   * Get calendar events from database for a date range
   */
  async getEventsFromDB(
    startDate: Date,
    endDate: Date,
    calendarIds?: string[]
  ): Promise<CalendarEvent[]> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        throw new Error('User not authenticated');
      }

      // Call the database function to get events efficiently
      const { data, error } = await supabase.rpc('get_calendar_events_in_range', {
        p_user_id: user.user.id,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
        p_calendar_ids: calendarIds || null,
      });

      if (error) {
        throw error;
      }

      // Transform database events to CalendarEvent format
      return (data || []).map((event: DatabaseCalendarEvent) => ({
        id: event.external_id || event.id,
        title: event.title,
        description: event.description || undefined,
        location: event.location || undefined,
        start: new Date(event.start_time),
        end: new Date(event.end_time),
        allDay: event.all_day,
        category: this.determineCategory(event),
        priority: this.determinePriority(event),
        attendees: this.extractAttendees(event),
        createdBy: event.creator_email || 'unknown',
        createdAt: new Date(),
        updatedAt: new Date(),
        color: event.color || undefined,
        contactId: event.contact_id || undefined,
        contactName: event.contact_name || undefined,
        companyId: event.company_id || undefined,
        companyName: event.company_name || undefined,
        meetingUrl: event.meeting_url || undefined,
        htmlLink: event.html_link || undefined,
      }));
    } catch (error) {
      console.error('Failed to get events from database:', error);
      return [];
    }
  }

  /**
   * Link a calendar event to a CRM contact
   */
  async linkEventToContact(eventId: string, contactId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('calendar_events')
        .update({ contact_id: contactId })
        .eq('id', eventId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Failed to link event to contact:', error);
      return false;
    }
  }

  /**
   * Link a calendar event to a CRM deal
   */
  async linkEventToDeal(eventId: string, dealId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('calendar_events')
        .update({ deal_id: dealId })
        .eq('id', eventId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Failed to link event to deal:', error);
      return false;
    }
  }

  /**
   * Get calendar sync status
   */
  async getSyncStatus(calendarId: string = 'primary'): Promise<CalendarSyncStatus> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        throw new Error('User not authenticated');
      }

      // Get the last sync log
      const { data, error } = await supabase
        .from('calendar_sync_logs')
        .select('*')
        .eq('user_id', user.user.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned"
        throw error;
      }

      if (!data) {
        return {
          isRunning: false,
          lastSyncedAt: undefined,
        };
      }

      return {
        isRunning: data.sync_status === 'started',
        lastSyncedAt: data.completed_at ? new Date(data.completed_at) : undefined,
        eventsCreated: data.events_created || 0,
        eventsUpdated: data.events_updated || 0,
        eventsDeleted: data.events_deleted || 0,
        error: data.error_message || undefined,
      };
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return {
        isRunning: false,
        error: error instanceof Error ? error.message : 'Failed to get sync status',
      };
    }
  }

  /**
   * Check if initial historical sync has been completed
   */
  async isHistoricalSyncCompleted(calendarId: string = 'primary'): Promise<boolean> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        return false;
      }

      const { data, error } = await supabase
        .from('calendar_calendars')
        .select('historical_sync_completed')
        .eq('user_id', user.user.id)
        .eq('external_id', calendarId)
        .maybeSingle();

      if (error) {
        console.error('Failed to check historical sync status:', error);
        return false;
      }

      return !!data?.historical_sync_completed;
    } catch (error) {
      console.error('Failed to check historical sync status:', error);
      return false;
    }
  }

  /**
   * Auto-link events to contacts based on email matching
   */
  async autoLinkEventsToContacts(): Promise<number> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        throw new Error('User not authenticated');
      }

      // Get unlinked events with organizer emails
      const { data: events, error: eventsError } = await supabase
        .from('calendar_events')
        .select('id, organizer_email')
        .eq('user_id', user.user.id)
        .is('contact_id', null)
        .not('organizer_email', 'is', null)
        .limit(100);

      if (eventsError) {
        throw eventsError;
      }

      if (!events || events.length === 0) {
        return 0;
      }

      let linkedCount = 0;

      // Get all contacts for the user
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, email')
        .eq('user_id', user.user.id);

      if (contactsError) {
        throw contactsError;
      }

      if (!contacts || contacts.length === 0) {
        return 0;
      }

      // Create email to contact ID map
      const emailToContactId = new Map<string, string>();
      contacts.forEach(contact => {
        if (contact.email) {
          emailToContactId.set(contact.email.toLowerCase(), contact.id);
        }
      });

      // Link events to contacts
      for (const event of events) {
        const contactId = emailToContactId.get(event.organizer_email.toLowerCase());
        if (contactId) {
          const { error } = await supabase
            .from('calendar_events')
            .update({ contact_id: contactId })
            .eq('id', event.id);

          if (!error) {
            linkedCount++;
          }
        }
      }

      return linkedCount;
    } catch (error) {
      console.error('Failed to auto-link events to contacts:', error);
      return 0;
    }
  }

  // Helper methods
  private determineCategory(event: DatabaseCalendarEvent): CalendarEvent['category'] {
    const title = event.title.toLowerCase();
    const description = (event.description || '').toLowerCase();
    const combined = title + ' ' + description;

    if (combined.includes('call') || combined.includes('phone')) return 'call';
    if (combined.includes('task') || combined.includes('todo')) return 'task';
    if (combined.includes('follow') || combined.includes('follow-up')) return 'follow-up';
    if (combined.includes('deal') || combined.includes('sales')) return 'deal';
    if (combined.includes('personal') || combined.includes('lunch') || combined.includes('dinner')) return 'personal';
    
    return 'meeting';
  }

  private determinePriority(event: DatabaseCalendarEvent): 'low' | 'medium' | 'high' {
    // High priority if linked to deal or has many attendees
    if (event.company_id || event.attendees_count > 5) return 'high';
    
    // Medium priority for regular meetings
    if (event.attendees_count > 1) return 'medium';
    
    // Low priority for personal events or single attendee
    return 'low';
  }

  private extractAttendees(event: DatabaseCalendarEvent): string[] {
    // Extract attendees from raw_data if available
    if (event.raw_data?.attendees) {
      return event.raw_data.attendees.map((a: any) => a.email);
    }
    return [];
  }
}

// Export singleton instance
export const calendarService = new CalendarService();