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
  orgId: string
): Promise<HubSpotContext | null> {
  const { data: contact } = await supabase
    .from('contacts')
    .select(`
      id,
      first_name,
      last_name,
      email,
      job_title,
      company_id,
      companies:company_id (id, name)
    `)
    .eq('id', contactId)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!contact) return null;

  // Count activities for this contact
  const { count: activityCount } = await supabase
    .from('activities')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', contactId)
    .eq('organization_id', orgId);

  const contactName = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(' ') || contact.email || 'Unknown';

  const companyName = (contact.companies as { name: string } | null)?.name || 'Unknown Company';

  return {
    type: 'hubspot',
    companyName,
    contactName,
    contactRole: contact.job_title || undefined,
    activityCount: activityCount || 0,
    hubspotUrl: undefined, // Could add HubSpot deep link if we have the external ID
  };
}

async function fetchDealContext(
  dealId: string,
  orgId: string
): Promise<HubSpotContext | null> {
  const { data: deal } = await supabase
    .from('deals')
    .select(`
      id,
      name,
      value,
      stage,
      company_id,
      companies:company_id (id, name)
    `)
    .eq('id', dealId)
    .eq('organization_id', orgId)
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

async function fetchFathomContext(
  orgId: string,
  contactId?: string
): Promise<FathomContext | null> {
  // Query meetings/transcripts - filter by contact if available
  let query = supabase
    .from('meetings')
    .select('id, title, start_time, end_time, summary, fathom_call_id')
    .eq('organization_id', orgId)
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

  // Calculate duration if end_time exists
  let lastCallDuration: string | undefined;
  if (lastMeeting.start_time && lastMeeting.end_time) {
    const durationMs =
      new Date(lastMeeting.end_time).getTime() -
      new Date(lastMeeting.start_time).getTime();
    const minutes = Math.round(durationMs / 60000);
    lastCallDuration = `${minutes} min`;
  }

  // Use summary as key insight
  const keyInsight = lastMeeting.summary
    ? lastMeeting.summary.slice(0, 150) + (lastMeeting.summary.length > 150 ? '...' : '')
    : undefined;

  return {
    type: 'fathom',
    callCount,
    lastCallDate,
    lastCallDuration,
    keyInsight,
    fathomUrl: lastMeeting.fathom_call_id
      ? `https://fathom.video/call/${lastMeeting.fathom_call_id}`
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
  const { context } = useCopilot();
  const { activeOrgId } = useOrg();

  const { contactId, dealIds, userId } = context;
  const primaryDealId = dealIds?.[0];

  // Fetch contact context
  const contactQuery = useQuery({
    queryKey: ['copilot-context', 'contact', contactId, activeOrgId],
    queryFn: () => fetchContactContext(contactId!, activeOrgId!),
    enabled: !!contactId && !!activeOrgId,
    staleTime: 30000, // 30 seconds
  });

  // Fetch deal context (only if no contact)
  const dealQuery = useQuery({
    queryKey: ['copilot-context', 'deal', primaryDealId, activeOrgId],
    queryFn: () => fetchDealContext(primaryDealId!, activeOrgId!),
    enabled: !!primaryDealId && !contactId && !!activeOrgId,
    staleTime: 30000,
  });

  // Fetch Fathom context
  const fathomQuery = useQuery({
    queryKey: ['copilot-context', 'fathom', activeOrgId, contactId],
    queryFn: () => fetchFathomContext(activeOrgId!, contactId),
    enabled: !!activeOrgId,
    staleTime: 60000, // 1 minute
  });

  // Fetch Calendar context
  const calendarQuery = useQuery({
    queryKey: ['copilot-context', 'calendar', userId],
    queryFn: () => fetchCalendarContext(userId!),
    enabled: !!userId,
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
