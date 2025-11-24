/**
 * RelationshipTimeline Component
 *
 * Comprehensive timeline visualization of all relationship interactions.
 * Features:
 * - Communication events (emails, meetings, calls)
 * - Interventions sent and responses
 * - Health score changes over time
 * - Ghost signal detections
 * - Deal stage transitions
 */

import { useState, useMemo, useEffect } from 'react';
import { useCommunicationPattern } from '@/lib/hooks/useRelationshipHealth';
import type { CommunicationEvent } from '@/lib/services/communicationTrackingService';
import type { Intervention } from '@/lib/services/interventionService';
import type { GhostDetectionSignal } from '@/lib/services/ghostDetectionService';
import { supabase } from '@/lib/supabase/clientV2';
import { formatDistanceToNow } from 'date-fns';
import {
  Mail,
  Phone,
  Video,
  Calendar,
  FileText,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  MessageSquare,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Download,
} from 'lucide-react';

interface RelationshipTimelineProps {
  contactId: string;
  companyId?: string;
  userId: string;
  showHealthChanges?: boolean;
  showGhostSignals?: boolean;
  showInterventions?: boolean;
  maxItems?: number;
}

type TimelineEventType =
  | 'communication'
  | 'intervention'
  | 'health_change'
  | 'ghost_signal'
  | 'deal_stage';

interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  data?: any;
}

export function RelationshipTimeline({
  contactId,
  userId,
  showHealthChanges = true,
  showGhostSignals = true,
  showInterventions = true,
  maxItems,
}: RelationshipTimelineProps) {
  const { communications, isLoading: loadingCommunications } = useCommunicationPattern(contactId);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [loadingDeals, setLoadingDeals] = useState(false);

  const isLoading = loadingCommunications || loadingMeetings || loadingDeals;

  const [selectedTypes, setSelectedTypes] = useState<Set<TimelineEventType>>(
    new Set(['communication', 'intervention', 'health_change', 'ghost_signal', 'deal_stage'])
  );
  const [showOnlySignificant, setShowOnlySignificant] = useState(false);

  // Fetch meetings from meetings table
  useEffect(() => {
    if (!contactId || !userId) return;

    const fetchMeetings = async () => {
      setLoadingMeetings(true);
      try {
        // First get contact's company_id
        const { data: contact } = await supabase
          .from('contacts')
          .select('company_id')
          .eq('id', contactId)
          .single();

        const companyId = contact?.company_id;

        // Fetch meetings linked to this contact (by primary_contact_id or company_id)
        let query = supabase
          .from('meetings')
          .select('id, title, meeting_start, meeting_end, duration_minutes, summary, sentiment_score, share_url')
          .eq('owner_user_id', userId)
          .eq('primary_contact_id', contactId);

        const { data: meetingsByContact, error: contactError } = await query
          .order('meeting_start', { ascending: false })
          .limit(50);

        // Also fetch meetings by company if contact has a company
        let meetingsByCompany: any[] = [];
        if (companyId) {
          const { data: companyMeetings, error: companyError } = await supabase
            .from('meetings')
            .select('id, title, meeting_start, meeting_end, duration_minutes, summary, sentiment_score, share_url')
            .eq('owner_user_id', userId)
            .eq('company_id', companyId)
            .order('meeting_start', { ascending: false })
            .limit(50);

          if (!companyError && companyMeetings) {
            meetingsByCompany = companyMeetings;
          }
        }

        // Combine and deduplicate meetings
        const allMeetings = [...(meetingsByContact || []), ...meetingsByCompany];
        const uniqueMeetings = Array.from(
          new Map(allMeetings.map(m => [m.id, m])).values()
        );

        if (!contactError) {
          setMeetings(uniqueMeetings);
        }
      } catch (error) {
        console.error('Error fetching meetings:', error);
      } finally {
        setLoadingMeetings(false);
      }
    };

    fetchMeetings();
  }, [contactId, userId]);

  // Fetch deals and stage transitions
  useEffect(() => {
    if (!contactId || !userId) return;

    const fetchDeals = async () => {
      setLoadingDeals(true);
      try {
        // First get contact email
        const { data: contact } = await supabase
          .from('contacts')
          .select('email')
          .eq('id', contactId)
          .single();

        const contactEmail = contact?.email;

        // Fetch deals linked to this contact
        let query = supabase
          .from('deals')
          .select(`
            id,
            name,
            value,
            stage_id,
            updated_at,
            created_at,
            deal_stages!inner(name, color)
          `)
          .eq('owner_id', userId);

        // Build OR condition for contact matching
        if (contactEmail) {
          query = query.or(`primary_contact_id.eq.${contactId},contact_email.eq.${contactEmail}`);
        } else {
          query = query.eq('primary_contact_id', contactId);
        }

        const { data: dealsData, error } = await query
          .order('updated_at', { ascending: false })
          .limit(50);

        if (!error && dealsData) {
          setDeals(dealsData);
        }
      } catch (error) {
        console.error('Error fetching deals:', error);
      } finally {
        setLoadingDeals(false);
      }
    };

    fetchDeals();
  }, [contactId, userId]);

  // Build timeline events from all data sources
  const timelineEvents = useMemo(() => {
    const events: TimelineEvent[] = [];

    // Add communication events (emails, calls, etc.)
    if (selectedTypes.has('communication') && communications) {
      communications.forEach((comm) => {
        events.push(createCommunicationEvent(comm));
      });
    }

    // Add meetings from meetings table
    if (selectedTypes.has('communication') && meetings.length > 0) {
      meetings.forEach((meeting) => {
        events.push(createMeetingEvent(meeting));
      });
    }

    // Add deal stage transitions
    if (selectedTypes.has('deal_stage') && deals.length > 0) {
      deals.forEach((deal) => {
        events.push(createDealStageEvent(deal));
      });
    }

    // Sort by timestamp descending
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Filter significant events if requested
    if (showOnlySignificant) {
      return events.filter((e) => isSignificantEvent(e));
    }

    // Limit items if specified
    if (maxItems && events.length > maxItems) {
      return events.slice(0, maxItems);
    }

    return events;
  }, [communications, meetings, deals, selectedTypes, showOnlySignificant, maxItems]);

  const toggleType = (type: TimelineEventType) => {
    const newTypes = new Set(selectedTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setSelectedTypes(newTypes);
  };

  const exportTimeline = () => {
    const csvContent = timelineEvents
      .map((event) => {
        return `${event.timestamp},${event.type},${event.title},"${event.description.replace(/"/g, '""')}"`;
      })
      .join('\n');

    const blob = new Blob([`Timestamp,Type,Title,Description\n${csvContent}`], {
      type: 'text/csv',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relationship-timeline-${contactId}-${new Date().toISOString()}.csv`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Relationship Timeline</h2>
          <p className="text-sm text-gray-400 mt-1">
            {timelineEvents.length} events tracked
          </p>
        </div>
        <button
          onClick={exportTimeline}
          className="flex items-center gap-2 px-3 py-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-colors text-sm"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-lg">
        <Filter className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-400">Show:</span>

        <FilterChip
          label="Communications"
          active={selectedTypes.has('communication')}
          onClick={() => toggleType('communication')}
          color="blue"
        />
        {showInterventions && (
          <FilterChip
            label="Interventions"
            active={selectedTypes.has('intervention')}
            onClick={() => toggleType('intervention')}
            color="purple"
          />
        )}
        {showHealthChanges && (
          <FilterChip
            label="Health Changes"
            active={selectedTypes.has('health_change')}
            onClick={() => toggleType('health_change')}
            color="green"
          />
        )}
        {showGhostSignals && (
          <FilterChip
            label="Ghost Signals"
            active={selectedTypes.has('ghost_signal')}
            onClick={() => toggleType('ghost_signal')}
            color="red"
          />
        )}
        <FilterChip
          label="Deal Stages"
          active={selectedTypes.has('deal_stage')}
          onClick={() => toggleType('deal_stage')}
          color="orange"
        />

        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlySignificant}
              onChange={(e) => setShowOnlySignificant(e.target.checked)}
              className="rounded border-gray-600 bg-white/5 text-blue-500 focus:ring-blue-500"
            />
            Significant only
          </label>
        </div>
      </div>

      {/* Timeline */}
      {timelineEvents.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No events found</p>
          <p className="text-sm text-gray-500 mt-1">
            Try adjusting your filters
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-white/10" />

          {/* Events */}
          <div className="space-y-4">
            {timelineEvents.map((event, index) => (
              <TimelineEventCard
                key={event.id}
                event={event}
                isFirst={index === 0}
                isLast={index === timelineEvents.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  color: 'blue' | 'purple' | 'green' | 'red';
}

function FilterChip({ label, active, onClick, color }: FilterChipProps) {
  const colors = {
    blue: active ? 'bg-blue-500 text-white' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20',
    purple: active ? 'bg-purple-500 text-white' : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20',
    green: active ? 'bg-green-500 text-white' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20',
    red: active ? 'bg-red-500 text-white' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20',
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-sm transition-colors ${colors[color]}`}
    >
      {label}
    </button>
  );
}

interface TimelineEventCardProps {
  event: TimelineEvent;
  isFirst: boolean;
  isLast: boolean;
}

function TimelineEventCard({ event, isFirst }: TimelineEventCardProps) {
  const Icon = event.icon;
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="relative pl-14 pb-4">
      {/* Icon */}
      <div
        className={`absolute left-3 w-6 h-6 rounded-full flex items-center justify-center ${event.bgColor}`}
      >
        <Icon className={`w-3.5 h-3.5 ${event.iconColor}`} />
      </div>

      {/* Content Card */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/[0.07] transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-white font-medium">{event.title}</h3>
              {isFirst && (
                <span className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-400 rounded">
                  Latest
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400 mb-2">{event.description}</p>
            <p className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {event.data && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                {isExpanded ? 'Less' : 'More'}
              </button>
            )}
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && event.data && (
          <div className="mt-4 pt-4 border-t border-white/10">
            {renderEventDetails(event)}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper functions

function createCommunicationEvent(comm: CommunicationEvent): TimelineEvent {
  const isInbound = comm.direction === 'inbound';
  const eventTypeMap: Record<string, { icon: React.ElementType; title: string }> = {
    email_sent: { icon: Mail, title: 'Email Sent' },
    email_received: { icon: Mail, title: 'Email Received' },
    meeting_held: { icon: Video, title: 'Meeting Held' },
    call_made: { icon: Phone, title: 'Call Made' },
    call_received: { icon: Phone, title: 'Call Received' },
    proposal_sent: { icon: FileText, title: 'Proposal Sent' },
    linkedin_message: { icon: MessageSquare, title: 'LinkedIn Message' },
  };

  const eventInfo = eventTypeMap[comm.event_type] || { icon: Mail, title: 'Communication' };

  return {
    id: comm.id,
    type: 'communication',
    timestamp: comm.event_timestamp,
    title: eventInfo.title,
    description: comm.snippet || comm.subject || 'No subject',
    icon: eventInfo.icon,
    iconColor: isInbound ? 'text-green-400' : 'text-blue-400',
    bgColor: isInbound ? 'bg-green-500/10' : 'bg-blue-500/10',
    data: {
      direction: comm.direction,
      subject: comm.subject,
      body: comm.body,
      wasOpened: comm.was_opened,
      wasClicked: comm.was_clicked,
      wasReplied: comm.was_replied,
      responseTimeHours: comm.response_time_hours,
    },
  };
}

function createMeetingEvent(meeting: any): TimelineEvent {
  const duration = meeting.duration_minutes 
    ? `${Math.round(meeting.duration_minutes)} min`
    : 'Duration unknown';
  
  return {
    id: `meeting-${meeting.id}`,
    type: 'communication',
    timestamp: meeting.meeting_start,
    title: meeting.title || 'Meeting',
    description: meeting.summary || `Meeting held (${duration})`,
    icon: Video,
    iconColor: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    data: {
      meetingId: meeting.id,
      title: meeting.title,
      summary: meeting.summary,
      duration: meeting.duration_minutes,
      sentimentScore: meeting.sentiment_score,
      shareUrl: meeting.share_url,
      startTime: meeting.meeting_start,
      endTime: meeting.meeting_end,
    },
  };
}

function createDealStageEvent(deal: any): TimelineEvent {
  const stageName = deal.deal_stages?.name || 'Unknown Stage';
  const dealValue = deal.value ? `$${deal.value.toLocaleString()}` : '';
  
  return {
    id: `deal-${deal.id}-${deal.updated_at}`,
    type: 'deal_stage',
    timestamp: deal.updated_at || deal.created_at,
    title: `Deal: ${deal.name || 'Unnamed Deal'}`,
    description: `Moved to ${stageName}${dealValue ? ` (${dealValue})` : ''}`,
    icon: FileText,
    iconColor: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    data: {
      dealId: deal.id,
      dealName: deal.name,
      stageName: stageName,
      stageColor: deal.deal_stages?.color,
      value: deal.value,
      updatedAt: deal.updated_at,
    },
  };
}

function isSignificantEvent(event: TimelineEvent): boolean {
  // Define what makes an event "significant"
  if (event.type === 'intervention') return true;
  if (event.type === 'ghost_signal') return true;
  if (event.type === 'health_change') {
    // Only show major health changes
    return true;
  }
  if (event.type === 'communication') {
    // Meetings, proposals, replies are significant
    const significantTypes = [
      'meeting_held',
      'proposal_sent',
      'proposal_viewed',
      'email_replied',
    ];
    return event.data?.wasReplied || significantTypes.some((t) => event.title.includes(t));
  }
  return false;
}

function renderEventDetails(event: TimelineEvent) {
  if (event.type === 'communication') {
    // Meeting event details
    if (event.data.meetingId) {
      return (
        <div className="space-y-2 text-sm">
          {event.data.summary && (
            <div>
              <span className="text-gray-400">Summary:</span>
              <p className="text-white mt-1 p-2 bg-white/5 rounded text-xs">
                {event.data.summary}
              </p>
            </div>
          )}
          <div className="flex items-center gap-4 text-xs">
            {event.data.duration && (
              <span className="text-gray-400">
                Duration: {Math.round(event.data.duration)} min
              </span>
            )}
            {event.data.sentimentScore !== null && (
              <span className={`${event.data.sentimentScore > 0 ? 'text-green-400' : event.data.sentimentScore < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                Sentiment: {event.data.sentimentScore > 0 ? '+' : ''}{event.data.sentimentScore.toFixed(2)}
              </span>
            )}
            {event.data.shareUrl && (
              <a
                href={event.data.shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
              >
                <ExternalLink className="w-3 h-3" />
                View Recording
              </a>
            )}
          </div>
        </div>
      );
    }

    // Email/communication event details
    return (
      <div className="space-y-2 text-sm">
        {event.data.subject && (
          <div>
            <span className="text-gray-400">Subject:</span>{' '}
            <span className="text-white">{event.data.subject}</span>
          </div>
        )}
        {event.data.body && (
          <div>
            <span className="text-gray-400">Preview:</span>
            <p className="text-white mt-1 p-2 bg-white/5 rounded text-xs">
              {event.data.body.substring(0, 200)}
              {event.data.body.length > 200 ? '...' : ''}
            </p>
          </div>
        )}
        <div className="flex items-center gap-4 text-xs">
          {event.data.wasOpened && (
            <span className="flex items-center gap-1 text-green-400">
              <CheckCircle2 className="w-3 h-3" />
              Opened
            </span>
          )}
          {event.data.wasClicked && (
            <span className="flex items-center gap-1 text-blue-400">
              <ExternalLink className="w-3 h-3" />
              Clicked
            </span>
          )}
          {event.data.wasReplied && (
            <span className="flex items-center gap-1 text-purple-400">
              <MessageSquare className="w-3 h-3" />
              Replied
            </span>
          )}
          {event.data.responseTimeHours && (
            <span className="text-gray-400">
              Response time: {Math.round(event.data.responseTimeHours)}h
            </span>
          )}
        </div>
      </div>
    );
  }

  if (event.type === 'deal_stage') {
    return (
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-gray-400">Deal:</span>{' '}
          <span className="text-white font-medium">{event.data.dealName}</span>
        </div>
        {event.data.value && (
          <div>
            <span className="text-gray-400">Value:</span>{' '}
            <span className="text-white">${event.data.value.toLocaleString()}</span>
          </div>
        )}
        {event.data.stageName && (
          <div>
            <span className="text-gray-400">Stage:</span>{' '}
            <span 
              className="text-white px-2 py-1 rounded text-xs"
              style={{ backgroundColor: event.data.stageColor ? `${event.data.stageColor}20` : undefined }}
            >
              {event.data.stageName}
            </span>
          </div>
        )}
      </div>
    );
  }

  return null;
}
