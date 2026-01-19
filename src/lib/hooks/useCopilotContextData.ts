/**
 * useCopilotContextData Hook
 *
 * US-012: Fetches context data for the Copilot right panel
 * - HubSpot: Contact/deal data from database
 * - Fathom: Recent meeting transcripts
 * - Calendar: Upcoming meetings
 *
 * Updates in real-time as CopilotContext changes
 */

import { useQuery } from '@tanstack/react-query';
import { useCopilot } from '@/lib/contexts/CopilotContext';
import { supabase } from '@/lib/supabase/clientV2';
import { useOrg } from '@/lib/contexts/OrgContext';
import type {
  HubSpotContext,
  FathomContext,
  CalendarContext,
  ContextItem,
} from '@/components/copilot/CopilotRightPanel';

// ============================================================================
// Data Fetching
// ============================================================================

async function fetchContactContext(
  contactId: string,
  userId: string
): Promise<HubSpotContext | null> {
  const { data: contact } = await supabase
    .from('contacts')
    .select(`
      id,
      first_name,
      last_name,
      email,
      title,
      company_id,
      companies:company_id (id, name)
    `)
    .eq('id', contactId)
    .eq('owner_id', userId)
    .maybeSingle();

  if (!contact) return null;

  // Count activities for this contact
  const { count: activityCount } = await supabase
    .from('activities')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', contactId)
    .eq('owner_id', userId);

  const contactName = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(' ') || contact.email || 'Unknown';

  const companyName = (contact.companies as { name: string } | null)?.name || 'Unknown Company';

  return {
    type: 'hubspot',
    companyName,
    contactName,
    contactRole: contact.title || undefined,
    activityCount: activityCount || 0,
    hubspotUrl: undefined, // Could add HubSpot deep link if we have the external ID
  };
}

async function fetchDealContext(
  dealId: string,
  userId: string
): Promise<HubSpotContext | null> {
  const { data: deal } = await supabase
    .from('deals')
    .select(`
      id,
      name,
      value,
      company_id,
      companies:company_id (id, name)
    `)
    .eq('id', dealId)
    .eq('owner_id', userId)
    .maybeSingle();

  if (!deal) return null;

  const companyName = (deal.companies as { name: string } | null)?.name || 'Unknown Company';

  return {
    type: 'hubspot',
    companyName,
    dealName: deal.name,
    dealValue: deal.value || undefined,
    hubspotUrl: undefined,
  };
}

// Helper to extract a clean summary text from meeting data
function extractSummaryText(meeting: {
  summary_oneliner?: string | null;
  summary?: string | null;
  title?: string | null;
}): string | undefined {
  // Prefer the one-liner summary if available
  if (meeting.summary_oneliner && meeting.summary_oneliner.trim()) {
    return meeting.summary_oneliner.trim();
  }

  // Try to parse summary if it's JSON
  if (meeting.summary) {
    const summary = meeting.summary.trim();

    // Check if it looks like JSON
    if (summary.startsWith('{') || summary.startsWith('[')) {
      try {
        const parsed = JSON.parse(summary);
        // Try common JSON structures for summaries
        if (typeof parsed === 'object' && parsed !== null) {
          // Check for common summary fields
          const textFields = ['summary', 'text', 'content', 'description', 'overview'];
          for (const field of textFields) {
            if (parsed[field] && typeof parsed[field] === 'string') {
              return parsed[field].trim();
            }
          }
        }
        // If it's just a string wrapped in JSON, return it
        if (typeof parsed === 'string') {
          return parsed.trim();
        }
      } catch {
        // Not valid JSON, check if it's plain text that doesn't look like template
      }
    }

    // If it's plain text and doesn't look like a template/markdown header, use it
    if (!summary.startsWith('##') && !summary.startsWith('{') && !summary.includes('template_name')) {
      return summary;
    }
  }

  // Fall back to meeting title if no good summary
  if (meeting.title && meeting.title.trim()) {
    return `Meeting: ${meeting.title.trim()}`;
  }

  return undefined;
}

async function fetchFathomContext(
  orgId: string,
  contactId?: string
): Promise<FathomContext | null> {
  // Query meetings/transcripts - filter by contact if available
  let query = supabase
    .from('meetings')
    .select('id, title, start_time, meeting_end, summary, summary_oneliner, fathom_recording_id')
    .eq('org_id', orgId)
    .order('start_time', { ascending: false })
    .limit(10);

  if (contactId) {
    query = query.eq('contact_id', contactId);
  }

  const { data: meetings } = await query;

  if (!meetings || meetings.length === 0) return null;

  const callCount = meetings.length;
  const lastMeeting = meetings[0];

  // Format date
  const lastCallDate = lastMeeting.start_time
    ? new Date(lastMeeting.start_time).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : undefined;

  // Calculate duration if meeting_end exists
  let lastCallDuration: string | undefined;
  if (lastMeeting.start_time && lastMeeting.meeting_end) {
    const durationMs =
      new Date(lastMeeting.meeting_end).getTime() -
      new Date(lastMeeting.start_time).getTime();
    const minutes = Math.round(durationMs / 60000);
    lastCallDuration = `${minutes} min`;
  }

  // Extract clean summary text
  const summaryText = extractSummaryText(lastMeeting);
  const keyInsight = summaryText
    ? summaryText.slice(0, 150) + (summaryText.length > 150 ? '...' : '')
    : undefined;

  return {
    type: 'fathom',
    callCount,
    lastCallDate,
    lastCallDuration,
    keyInsight,
    fathomUrl: lastMeeting.fathom_recording_id
      ? `https://fathom.video/call/${lastMeeting.fathom_recording_id}`
      : undefined,
  };
}

async function fetchCalendarContext(
  userId: string
): Promise<CalendarContext | null> {
  const now = new Date().toISOString();

  const { data: events } = await supabase
    .from('calendar_events')
    .select('id, title, start_time, end_time, html_link')
    .eq('user_id', userId)
    .gte('start_time', now)
    .order('start_time', { ascending: true })
    .limit(1);

  if (!events || events.length === 0) return null;

  const nextEvent = events[0];
  const startDate = new Date(nextEvent.start_time);

  return {
    type: 'calendar',
    nextMeetingTitle: nextEvent.title || 'Untitled Meeting',
    nextMeetingDate: startDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
    nextMeetingTime: startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    calendarUrl: nextEvent.html_link || undefined,
  };
}

// ============================================================================
// Main Hook
// ============================================================================

export interface UseCopilotContextDataReturn {
  contextItems: ContextItem[];
  isLoading: boolean;
  error: Error | null;
}

export function useCopilotContextData(): UseCopilotContextDataReturn {
  const { context, relevantContextTypes } = useCopilot();
  const { activeOrgId } = useOrg();

  const { contactId, dealIds, userId } = context;
  const primaryDealId = dealIds?.[0];

  // Only fetch data sources that are relevant to the current query
  const shouldFetchHubspot = relevantContextTypes.includes('hubspot');
  const shouldFetchFathom = relevantContextTypes.includes('fathom');
  const shouldFetchCalendar = relevantContextTypes.includes('calendar');

  // Fetch contact context (only when HubSpot context is relevant)
  const contactQuery = useQuery({
    queryKey: ['copilot-context', 'contact', contactId, userId],
    queryFn: () => fetchContactContext(contactId!, userId!),
    enabled: shouldFetchHubspot && !!contactId && !!userId,
    staleTime: 30000, // 30 seconds
  });

  // Fetch deal context (only if no contact and HubSpot context is relevant)
  const dealQuery = useQuery({
    queryKey: ['copilot-context', 'deal', primaryDealId, userId],
    queryFn: () => fetchDealContext(primaryDealId!, userId!),
    enabled: shouldFetchHubspot && !!primaryDealId && !contactId && !!userId,
    staleTime: 30000,
  });

  // Fetch Fathom context (only when Fathom context is relevant)
  const fathomQuery = useQuery({
    queryKey: ['copilot-context', 'fathom', activeOrgId, contactId],
    queryFn: () => fetchFathomContext(activeOrgId!, contactId),
    enabled: shouldFetchFathom && !!activeOrgId,
    staleTime: 60000, // 1 minute
  });

  // Fetch Calendar context (only when Calendar context is relevant)
  const calendarQuery = useQuery({
    queryKey: ['copilot-context', 'calendar', userId],
    queryFn: () => fetchCalendarContext(userId!),
    enabled: shouldFetchCalendar && !!userId,
    staleTime: 60000,
  });

  // Build context items array
  const contextItems: ContextItem[] = [];

  // Add HubSpot context (contact or deal)
  if (contactQuery.data) {
    contextItems.push(contactQuery.data);
  } else if (dealQuery.data) {
    contextItems.push(dealQuery.data);
  }

  // Add Fathom context
  if (fathomQuery.data) {
    contextItems.push(fathomQuery.data);
  }

  // Add Calendar context
  if (calendarQuery.data) {
    contextItems.push(calendarQuery.data);
  }

  const isLoading =
    contactQuery.isLoading ||
    dealQuery.isLoading ||
    fathomQuery.isLoading ||
    calendarQuery.isLoading;

  const error =
    contactQuery.error ||
    dealQuery.error ||
    fathomQuery.error ||
    calendarQuery.error;

  return {
    contextItems,
    isLoading,
    error: error as Error | null,
  };
}

export default useCopilotContextData;
