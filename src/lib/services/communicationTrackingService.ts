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
 * Record a communication event
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
 * Mark previous outbound messages as replied
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
 * Track email opened
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
 * Track link clicked
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
 * Get communication history for a contact
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
 * Get recent communications for user
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
 * Get communication thread
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
 * Analyze communication patterns for a contact
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
 * Get unanswered outbound messages
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
 * Get active threads (conversations with recent activity)
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
 * Get last communication timestamp for a contact
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
 * Get days since last contact
 */
export async function getDaysSinceLastContact(contactId: string): Promise<number | null> {
  const lastDate = await getLastCommunicationDate(contactId);
  if (!lastDate) return null;

  return Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Import communication events from external source (e.g., Gmail, Outlook)
 * Placeholder for future email integration
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
