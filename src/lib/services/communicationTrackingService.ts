/**
 * Communication Tracking Service
 *
 * Tracks all communication events for pattern analysis and ghost detection.
 * Logs emails, meetings, calls, and other interactions.
 */

import { supabase } from '@/lib/supabase/clientV2';

// =====================================================
// Types
// =====================================================

export interface CommunicationEvent {
  id: string;
  user_id: string;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  event_type:
    | 'email_sent'
    | 'email_received'
    | 'email_opened'
    | 'email_clicked'
    | 'meeting_scheduled'
    | 'meeting_held'
    | 'meeting_cancelled'
    | 'meeting_rescheduled'
    | 'call_made'
    | 'call_received'
    | 'linkedin_message'
    | 'linkedin_connection'
    | 'linkedin_inmail'
    | 'proposal_sent'
    | 'proposal_viewed'
    | 'document_shared'
    | 'document_viewed';
  direction: 'outbound' | 'inbound' | 'system';
  subject: string | null;
  body: string | null;
  snippet: string | null;
  was_opened: boolean;
  was_clicked: boolean;
  was_replied: boolean;
  open_count: number;
  click_count: number;
  response_time_hours: number | null;
  sentiment_score: number | null;
  sentiment_label: 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive' | null;
  tone: string | null;
  thread_id: string | null;
  is_thread_start: boolean;
  thread_position: number | null;
  previous_event_id: string | null;
  external_id: string | null;
  external_source: string | null;
  metadata: any;
  event_timestamp: string;
  created_at: string;
}

export interface CreateCommunicationEventInput {
  contactId?: string;
  companyId?: string;
  dealId?: string;
  eventType: CommunicationEvent['event_type'];
  direction: 'outbound' | 'inbound' | 'system';
  subject?: string;
  body?: string;
  wasOpened?: boolean;
  wasClicked?: boolean;
  wasReplied?: boolean;
  threadId?: string;
  isThreadStart?: boolean;
  threadPosition?: number;
  previousEventId?: string;
  externalId?: string;
  externalSource?: string;
  eventTimestamp?: string;
  metadata?: any;
}

export interface CommunicationPattern {
  contactId: string;
  totalEvents: number;
  emailCount: number;
  meetingCount: number;
  callCount: number;
  avgResponseTimeHours: number | null;
  responseRate: number;
  lastContactDate: string | null;
  daysSinceLastContact: number | null;
  communicationFrequencyDays: number | null;
}

// =====================================================
// Event Creation
// =====================================================

/**
 * Create and store a communication event for a user.
 *
 * Computes an inbound response time when applicable, generates a body snippet, initializes counters/flags,
 * and for inbound events marks previous outbound messages to the same contact as replied.
 *
 * @param input - Event details (contact/company/deal references, event type/direction, subject/body, threading info, external references, event timestamp, and optional metadata)
 * @param userId - ID of the user who owns the event
 * @returns The inserted `CommunicationEvent` record, or `null` if insertion failed
 */
export async function recordCommunicationEvent(
  input: CreateCommunicationEventInput,
  userId: string
): Promise<CommunicationEvent | null> {
  try {
    // Calculate response time if this is an inbound message
    let responseTimeHours: number | null = null;

    if (input.direction === 'inbound' && input.contactId) {
      // Find last outbound message to this contact
      const { data: lastOutbound } = await supabase
        .from('communication_events')
        .select('event_timestamp')
        .eq('user_id', userId)
        .eq('contact_id', input.contactId)
        .eq('direction', 'outbound')
        .order('event_timestamp', { ascending: false })
        .limit(1)
        .single();

      if (lastOutbound) {
        const timeDiff =
          new Date(input.eventTimestamp || new Date()).getTime() -
          new Date(lastOutbound.event_timestamp).getTime();
        responseTimeHours = timeDiff / (1000 * 60 * 60);
      }
    }

    // Create snippet from body
    const snippet = input.body ? input.body.substring(0, 200) : null;

    const { data, error } = await supabase
      .from('communication_events')
      .insert({
        user_id: userId,
        contact_id: input.contactId || null,
        company_id: input.companyId || null,
        deal_id: input.dealId || null,
        event_type: input.eventType,
        direction: input.direction,
        subject: input.subject || null,
        body: input.body || null,
        snippet,
        was_opened: input.wasOpened || false,
        was_clicked: input.wasClicked || false,
        was_replied: input.wasReplied || false,
        open_count: 0,
        click_count: 0,
        response_time_hours: responseTimeHours,
        thread_id: input.threadId || null,
        is_thread_start: input.isThreadStart || false,
        thread_position: input.threadPosition || null,
        previous_event_id: input.previousEventId || null,
        external_id: input.externalId || null,
        external_source: input.externalSource || null,
        metadata: input.metadata || {},
        event_timestamp: input.eventTimestamp || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording communication event:', error);
      return null;
    }

    // If this is an inbound message, mark previous outbound as replied
    if (input.direction === 'inbound' && input.contactId) {
      await markPreviousAsReplied(userId, input.contactId);
    }

    return data;
  } catch (error) {
    console.error('Error in recordCommunicationEvent:', error);
    return null;
  }
}

/**
 * Flag previous outbound communication events to a contact as replied for the given user.
 *
 * @param userId - The ID of the user who owns the messages
 * @param contactId - The ID of the contact whose outbound messages should be marked as replied
 */
async function markPreviousAsReplied(userId: string, contactId: string): Promise<void> {
  try {
    await supabase
      .from('communication_events')
      .update({ was_replied: true })
      .eq('user_id', userId)
      .eq('contact_id', contactId)
      .eq('direction', 'outbound')
      .eq('was_replied', false);
  } catch (error) {
    console.error('Error marking previous as replied:', error);
  }
}

/**
 * Mark an email event as opened and increment its open count.
 *
 * @param eventId - The identifier of the communication event to update
 * @returns `true` if the record was updated successfully (including incrementing the open count), `false` otherwise (e.g., if the event does not exist or the update failed)
 */
export async function trackEmailOpened(eventId: string): Promise<boolean> {
  try {
    const { data: event } = await supabase
      .from('communication_events')
      .select('open_count')
      .eq('id', eventId)
      .single();

    if (!event) return false;

    const { error } = await supabase
      .from('communication_events')
      .update({
        was_opened: true,
        open_count: (event.open_count || 0) + 1,
      })
      .eq('id', eventId);

    return !error;
  } catch (error) {
    console.error('Error tracking email opened:', error);
    return false;
  }
}

/**
 * Mark a communication event as having a clicked link and increment its click count.
 *
 * @param eventId - Identifier of the communication event to update
 * @returns `true` if the event was updated successfully, `false` otherwise.
 */
export async function trackLinkClicked(eventId: string): Promise<boolean> {
  try {
    const { data: event } = await supabase
      .from('communication_events')
      .select('click_count')
      .eq('id', eventId)
      .single();

    if (!event) return false;

    const { error } = await supabase
      .from('communication_events')
      .update({
        was_clicked: true,
        click_count: (event.click_count || 0) + 1,
      })
      .eq('id', eventId);

    return !error;
  } catch (error) {
    console.error('Error tracking link clicked:', error);
    return false;
  }
}

// =====================================================
// Event Retrieval
// =====================================================

/**
 * Fetches recent communication events for a contact.
 *
 * @param contactId - The ID of the contact whose communication history to retrieve
 * @param limit - Maximum number of events to return (defaults to 50)
 * @returns An array of CommunicationEvent objects ordered by most recent `event_timestamp` first; returns an empty array if none are found or on error
 */
export async function getContactCommunications(
  contactId: string,
  limit: number = 50
): Promise<CommunicationEvent[]> {
  try {
    const { data, error } = await supabase
      .from('communication_events')
      .select('*')
      .eq('contact_id', contactId)
      .order('event_timestamp', { ascending: false })
      .limit(limit);

    if (error) return [];
    return data || [];
  } catch (error) {
    return [];
  }
}

/**
 * Fetches a user's communications within the past `days` days.
 *
 * @param days - Time window in days to include (default: 30)
 * @returns An array of CommunicationEvent records ordered by `event_timestamp` descending; empty array if none or on error.
 */
export async function getRecentCommunications(
  userId: string,
  days: number = 30
): Promise<CommunicationEvent[]> {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('communication_events')
      .select('*')
      .eq('user_id', userId)
      .gte('event_timestamp', startDate)
      .order('event_timestamp', { ascending: false });

    if (error) return [];
    return data || [];
  } catch (error) {
    return [];
  }
}

/**
 * Fetches all communication events belonging to a thread, ordered by event timestamp ascending.
 *
 * @param threadId - The thread identifier to retrieve events for
 * @returns An array of CommunicationEvent objects for the thread ordered by `event_timestamp` ascending; an empty array if there are no events or the thread cannot be retrieved
 */
export async function getCommunicationThread(threadId: string): Promise<CommunicationEvent[]> {
  try {
    const { data, error } = await supabase
      .from('communication_events')
      .select('*')
      .eq('thread_id', threadId)
      .order('event_timestamp', { ascending: true });

    if (error) return [];
    return data || [];
  } catch (error) {
    return [];
  }
}

// =====================================================
// Pattern Analysis
// =====================================================

/**
 * Compute aggregated communication metrics for a contact for a given user.
 *
 * Calculates totals and breakdowns by event type, average inbound response time (hours),
 * outbound response rate (percentage of outbound messages that were replied), the most recent
 * contact timestamp, days since last contact, and the average number of days between events.
 *
 * @param contactId - Identifier of the contact to analyze
 * @param userId - Identifier of the user who owns the communications
 * @returns A CommunicationPattern containing counts, averages, rates, last contact date, and frequency.
 *          If no events exist for the contact (or an error occurs), returns a pattern with zeros for counts
 *          and `null` for time-based metrics where appropriate.
 */
export async function analyzeContactCommunicationPattern(
  contactId: string,
  userId: string
): Promise<CommunicationPattern> {
  try {
    const { data: events } = await supabase
      .from('communication_events')
      .select('*')
      .eq('contact_id', contactId)
      .eq('user_id', userId)
      .order('event_timestamp', { ascending: false });

    if (!events || events.length === 0) {
      return {
        contactId,
        totalEvents: 0,
        emailCount: 0,
        meetingCount: 0,
        callCount: 0,
        avgResponseTimeHours: null,
        responseRate: 0,
        lastContactDate: null,
        daysSinceLastContact: null,
        communicationFrequencyDays: null,
      };
    }

    const emailCount = events.filter((e) => e.event_type.startsWith('email_')).length;
    const meetingCount = events.filter((e) => e.event_type.startsWith('meeting_')).length;
    const callCount = events.filter((e) => e.event_type.startsWith('call_')).length;

    // Calculate average response time
    const inboundEvents = events.filter(
      (e) => e.direction === 'inbound' && e.response_time_hours !== null
    );
    const avgResponseTimeHours =
      inboundEvents.length > 0
        ? inboundEvents.reduce((sum, e) => sum + (e.response_time_hours || 0), 0) / inboundEvents.length
        : null;

    // Calculate response rate
    const outboundEvents = events.filter((e) => e.direction === 'outbound');
    const repliedEvents = outboundEvents.filter((e) => e.was_replied);
    const responseRate =
      outboundEvents.length > 0 ? Math.round((repliedEvents.length / outboundEvents.length) * 100) : 0;

    // Last contact date
    const lastContactDate = events[0].event_timestamp;
    const daysSinceLastContact = Math.floor(
      (Date.now() - new Date(lastContactDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate communication frequency (average days between events)
    if (events.length >= 2) {
      const dates = events.map((e) => new Date(e.event_timestamp).getTime()).sort((a, b) => a - b);
      const gaps = dates.slice(1).map((date, i) => (date - dates[i]) / (1000 * 60 * 60 * 24));
      const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;

      return {
        contactId,
        totalEvents: events.length,
        emailCount,
        meetingCount,
        callCount,
        avgResponseTimeHours,
        responseRate,
        lastContactDate,
        daysSinceLastContact,
        communicationFrequencyDays: avgGap,
      };
    }

    return {
      contactId,
      totalEvents: events.length,
      emailCount,
      meetingCount,
      callCount,
      avgResponseTimeHours,
      responseRate,
      lastContactDate,
      daysSinceLastContact,
      communicationFrequencyDays: null,
    };
  } catch (error) {
    console.error('Error analyzing communication pattern:', error);
    return {
      contactId,
      totalEvents: 0,
      emailCount: 0,
      meetingCount: 0,
      callCount: 0,
      avgResponseTimeHours: null,
      responseRate: 0,
      lastContactDate: null,
      daysSinceLastContact: null,
      communicationFrequencyDays: null,
    };
  }
}

/**
 * Retrieve outbound messages to a contact that have not been replied to within a recent time window.
 *
 * @param contactId - The contact's identifier to filter messages
 * @param userId - The user's identifier owning the messages
 * @param days - Lookback window in days (default: 14)
 * @returns An array of outbound `CommunicationEvent` records for the contact with `was_replied = false` and `event_timestamp` within the lookback window
 */
export async function getUnansweredOutbound(
  contactId: string,
  userId: string,
  days: number = 14
): Promise<CommunicationEvent[]> {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('communication_events')
      .select('*')
      .eq('contact_id', contactId)
      .eq('user_id', userId)
      .eq('direction', 'outbound')
      .eq('was_replied', false)
      .gte('event_timestamp', startDate)
      .order('event_timestamp', { ascending: false});

    if (error) return [];
    return data || [];
  } catch (error) {
    return [];
  }
}

/**
 * Identify conversation threads for a user that had activity within the recent time window.
 *
 * @param userId - The ID of the user whose threads are being queried
 * @param days - Time window in days to consider for recent activity (defaults to 7)
 * @returns An array of thread summaries with `threadId`, `lastActivity` (ISO timestamp of the most recent event), and `messageCount` (number of events in the thread within the window)
 */
export async function getActiveThreads(
  userId: string,
  days: number = 7
): Promise<Array<{ threadId: string; lastActivity: string; messageCount: number }>> {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: events } = await supabase
      .from('communication_events')
      .select('thread_id, event_timestamp')
      .eq('user_id', userId)
      .not('thread_id', 'is', null)
      .gte('event_timestamp', startDate)
      .order('event_timestamp', { ascending: false });

    if (!events || events.length === 0) return [];

    // Group by thread
    const threads: Record<string, { lastActivity: string; count: number }> = {};
    events.forEach((event) => {
      if (!event.thread_id) return;
      if (!threads[event.thread_id]) {
        threads[event.thread_id] = {
          lastActivity: event.event_timestamp,
          count: 0,
        };
      }
      threads[event.thread_id].count += 1;
      if (new Date(event.event_timestamp) > new Date(threads[event.thread_id].lastActivity)) {
        threads[event.thread_id].lastActivity = event.event_timestamp;
      }
    });

    return Object.entries(threads).map(([threadId, info]) => ({
      threadId,
      lastActivity: info.lastActivity,
      messageCount: info.count,
    }));
  } catch (error) {
    console.error('Error getting active threads:', error);
    return [];
  }
}

// =====================================================
// Utility Functions
// =====================================================

/**
 * Retrieve the most recent communication timestamp for a contact.
 *
 * @returns The most recent event's `event_timestamp` as a string, or `null` if no events are found or an error occurs.
 */
export async function getLastCommunicationDate(contactId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('communication_events')
      .select('event_timestamp')
      .eq('contact_id', contactId)
      .order('event_timestamp', { ascending: false })
      .limit(1)
      .single();

    return data?.event_timestamp || null;
  } catch (error) {
    return null;
  }
}

/**
 * Compute the number of whole days since the most recent communication for a contact.
 *
 * @returns The number of whole days since the contact's last communication, or `null` if no communications exist.
 */
export async function getDaysSinceLastContact(contactId: string): Promise<number | null> {
  const lastDate = await getLastCommunicationDate(contactId);
  if (!lastDate) return null;

  return Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Import multiple external communication events for a user while avoiding duplicates by external ID.
 *
 * For each event, if an `externalId` is present and a record with the same `external_id` and `external_source`
 * already exists, the event is counted as skipped. Otherwise the event is recorded and counted as imported;
 * failures to record are counted as errors.
 *
 * @param userId - The owning user's ID
 * @param source - The external source of the events (`'gmail' | 'outlook' | 'linkedin'`)
 * @param events - Array of events to import
 * @returns An object with counts: `imported` for successfully recorded events, `skipped` for detected duplicates, and `errors` for failed insertions
 */
export async function importExternalCommunications(
  userId: string,
  source: 'gmail' | 'outlook' | 'linkedin',
  events: CreateCommunicationEventInput[]
): Promise<{ imported: number; skipped: number; errors: number }> {
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const event of events) {
    // Check if event already exists (by external_id)
    if (event.externalId) {
      const { data: existing } = await supabase
        .from('communication_events')
        .select('id')
        .eq('external_id', event.externalId)
        .eq('external_source', source)
        .single();

      if (existing) {
        skipped++;
        continue;
      }
    }

    const result = await recordCommunicationEvent(event, userId);
    if (result) {
      imported++;
    } else {
      errors++;
    }
  }

  return { imported, skipped, errors };
}