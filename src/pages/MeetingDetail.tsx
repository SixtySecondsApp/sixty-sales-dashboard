import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase/clientV2';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, ExternalLink, Loader2, AlertCircle, Play, FileText, MessageSquare } from 'lucide-react';
import FathomPlayerV2, { FathomPlayerV2Handle } from '@/components/FathomPlayerV2';
import { AskAIChat } from '@/components/meetings/AskAIChat';
import { useActivitiesActions } from '@/lib/hooks/useActivitiesActions';
import { useEventEmitter } from '@/lib/communication/EventBus';
import { toast } from 'sonner';

interface Meeting {
  id: string;
  fathom_recording_id: string;
  title: string;
  meeting_start: string;
  meeting_end: string;
  duration_minutes: number;
  share_url: string;
  calls_url: string;
  transcript_doc_url: string | null;
  transcript_text: string | null;
  summary: string | null;
  sentiment_score: number | null;
  sentiment_reasoning: string | null;
  talk_time_rep_pct: number | null;
  talk_time_customer_pct: number | null;
  talk_time_judgement: string | null;
  owner_email: string | null;
  fathom_embed_url?: string | null;
  thumbnail_url?: string | null;
}

interface MeetingAttendee {
  id: string;
  name: string;
  email: string | null;
  is_external: boolean;
  role: string | null;
}

interface ActionItem {
  id: string;
  title: string;
  priority: string;
  category: string | null;
  completed: boolean;
  timestamp_seconds: number | null;
  playback_url: string | null;
  ai_generated: boolean | null;
  ai_confidence: number | null;
}

// Helper functions
function labelSentiment(score: number | null): string {
  if (score == null) return '—';
  if (score <= -0.25) return 'Challenging';
  if (score < 0.25) return 'Neutral';
  return 'Positive';
}

function getSentimentColor(score: number | null): string {
  if (score == null) return 'bg-zinc-800 text-zinc-200';
  if (score > 0.25) return 'bg-emerald-900/60 text-emerald-300';
  if (score < -0.25) return 'bg-rose-900/60 text-rose-300';
  return 'bg-zinc-800 text-zinc-200';
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Enhanced markdown parser for Fathom summaries with beautiful styling
function parseMarkdownSummary(markdown: string): string {
  return markdown
    // Main headers (# Header) - Large, prominent
    .replace(/^# (.*?)$/gm, '<h1 class="text-2xl font-bold text-white mt-8 mb-4 pb-2 border-b border-white/10">$1</h1>')
    // Section headers (## Header) - Medium, spaced
    .replace(/^## (.*?)$/gm, '<h2 class="text-xl font-semibold text-white mt-6 mb-3">$1</h2>')
    // Sub-headers (### Header) - Smaller, colored accent
    .replace(/^### (.*?)$/gm, '<h3 class="text-base font-semibold text-blue-400 mt-4 mb-2">$1</h3>')
    // Bold text - White and prominent
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    // Timestamp links - Styled as clickable badges with play icon and consistent spacing
    .replace(/\[(.*?)\]\((https:\/\/fathom\.video\/share\/[^)]+timestamp=([0-9.]+)[^)]*)\)/g,
      '<span class="timestamp-link inline-block align-top px-2 py-1 mb-1 rounded-md bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 cursor-pointer transition-all text-xs font-medium max-w-[90%]" data-timestamp="$3" data-href="$2">' +
      '<svg class="w-3 h-3 inline-block mr-1.5 -mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>' +
      '$1' +
      '</span>')
    // Regular links - Subtle blue
    .replace(/\[(.*?)\]\((https:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 transition-colors">$1</a>')
    // Bullet points - Hidden bullet, consistent spacing with line-height fix
    .replace(/^ - (.*?)$/gm, '<div class="mb-1 text-gray-300 leading-relaxed min-h-[28px] flex items-start">$1</div>')
    // Numbered lists - Hidden numbers, consistent spacing with line-height fix
    .replace(/^ (\d+)\. (.*?)$/gm, '<div class="mb-1 text-gray-300 leading-relaxed min-h-[28px] flex items-start">$2</div>')
    // Paragraph breaks - Better spacing
    .replace(/\n\n/g, '<div class="mb-4"></div>')
    // Single line breaks - Smaller spacing
    .replace(/\n/g, '<br/>');
}

export function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const playerRef = useRef<FathomPlayerV2Handle>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const { addActivity } = useActivitiesActions();
  const emit = useEventEmitter();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTimestamp, setCurrentTimestamp] = useState(0);
  const [thumbnailEnsured, setThumbnailEnsured] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  const primaryExternal = attendees.find(a => a.is_external);

  const handleQuickAdd = async (type: 'meeting' | 'outbound' | 'proposal') => {
    if (!meeting) return;
    const clientName = primaryExternal?.name || attendees[0]?.name || meeting.title || 'Prospect';
    // Derive website from primary external attendee email domain when available
    let websiteFromEmail: string | undefined;
    const email = primaryExternal?.email || undefined;
    if (email && email.includes('@')) {
      const domain = email.split('@')[1]?.toLowerCase();
      const freeDomains = ['gmail.com','outlook.com','hotmail.com','yahoo.com','icloud.com','proton.me','aol.com'];
      if (domain && !freeDomains.includes(domain)) {
        websiteFromEmail = domain.startsWith('www.') ? domain : `www.${domain}`;
      }
    }

    // Open Quick Add modal with prefilled data
    await emit('modal:opened', {
      type: 'quick-add',
      context: {
        preselectAction: type,
        formId: 'quick-add',
        initialData: {
          client_name: clientName,
          details: `From Fathom: ${meeting.title || 'Meeting'}`,
          date: meeting.meeting_start,
          meeting_id: meeting.id,
          company_id: (meeting as any).company_id || null,
          contact_id: (meeting as any).primary_contact_id || null,
          company_website: websiteFromEmail
        }
      }
    });
  };

  useEffect(() => {
    if (!id) return;

    const fetchMeetingDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch meeting
        const { data: meetingData, error: meetingError } = await supabase
          .from('meetings')
          .select('*')
          .eq('id', id)
          .single();

        if (meetingError) throw meetingError;
        setMeeting(meetingData);

        // Fetch attendees - combine internal (meeting_attendees) and external (meeting_contacts via contacts)
        const { data: internalAttendeesData, error: internalError } = await supabase
          .from('meeting_attendees')
          .select('*')
          .eq('meeting_id', id);

        if (internalError) throw internalError;

        // Fetch external contacts via meeting_contacts junction
        const { data: externalContactsData, error: externalError } = await supabase
          .from('meeting_contacts')
          .select(`
            contact_id,
            is_primary,
            role,
            contacts (
              id,
              first_name,
              last_name,
              full_name,
              email
            )
          `)
          .eq('meeting_id', id);

        if (externalError) throw externalError;

        // Combine both internal and external attendees
        const combinedAttendees: MeetingAttendee[] = [
          ...(internalAttendeesData || []).map(a => ({
            id: a.id,
            name: a.name,
            email: a.email,
            is_external: false,
            role: a.role
          })),
          ...(externalContactsData || [])
            .filter(mc => mc.contacts) // Filter out null contacts
            .map(mc => {
              const c = mc.contacts as any;
              return {
                id: c.id,
                name: c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email,
                email: c.email,
                is_external: true,
                role: mc.is_primary ? 'Primary Contact' : (mc.role || 'attendee')
              };
            })
        ];

        setAttendees(combinedAttendees);

        // Fetch action items
        const { data: actionItemsData, error: actionItemsError } = await supabase
          .from('meeting_action_items')
          .select('*')
          .eq('meeting_id', id)
          .order('timestamp_seconds', { ascending: true });

        if (actionItemsError) throw actionItemsError;
        setActionItems(actionItemsData || []);
      } catch (err) {
        console.error('Error fetching meeting details:', err);
        setError(err instanceof Error ? err.message : 'Failed to load meeting');
      } finally {
        setLoading(false);
      }
    };

    fetchMeetingDetails();
  }, [id]);

  // Ensure thumbnail exists for this meeting
  useEffect(() => {
    const ensureThumbnail = async () => {
      if (!meeting || thumbnailEnsured) return;
      if (meeting.thumbnail_url) {
        setThumbnailEnsured(true);
        return;
      }

      try {
        // Build embed URL from share_url or recording id
        let embedUrl: string | null = null;
        if (meeting.share_url) {
          try {
            const u = new URL(meeting.share_url);
            const token = u.pathname.split('/').filter(Boolean).pop();
            if (token) embedUrl = `https://fathom.video/embed/${token}`;
          } catch {
            // ignore
          }
        }
        if (!embedUrl && meeting.fathom_recording_id) {
          embedUrl = `https://app.fathom.video/recording/${meeting.fathom_recording_id}`;
        }

        let thumbnailUrl: string | null = null;

        if (embedUrl) {
          // Try generation service first
          const { data, error } = await supabase.functions.invoke('generate-video-thumbnail', {
            body: {
              recording_id: meeting.fathom_recording_id,
              share_url: meeting.share_url,
              fathom_embed_url: embedUrl,
            },
          });

          if (!error && data?.success && data.thumbnail_url) {
            thumbnailUrl = data.thumbnail_url as string;
          }
        }

        // Fallback: placeholder
        if (!thumbnailUrl) {
          const firstLetter = (meeting.title || 'M')[0].toUpperCase();
          thumbnailUrl = `https://via.placeholder.com/640x360/1a1a1a/10b981?text=${encodeURIComponent(firstLetter)}`;
        }

        // Update meeting record (best effort; RLS must allow owner updates)
        await supabase
          .from('meetings')
          .update({ thumbnail_url: thumbnailUrl })
          .eq('id', meeting.id);

        // Update local state
        setMeeting({ ...meeting, thumbnail_url: thumbnailUrl });
      } catch (e) {
        // ignore errors; UI will continue without a thumbnail
      } finally {
        setThumbnailEnsured(true);
      }
    };

    ensureThumbnail();
  }, [meeting, thumbnailEnsured]);

  // Handle timestamp jumps in video player
  const handleTimestampJump = useCallback((seconds: number) => {
    setCurrentTimestamp(seconds);

    if (playerRef.current) {
      playerRef.current.seekToTimestamp(seconds);
    }
  }, []);

  // Handle action item extraction - defined before early returns to satisfy Rules of Hooks
  const handleGetActionItems = useCallback(async () => {
    if (!meeting) return;
    setIsExtracting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Call Edge Function to extract items
      const res = await fetch(`${supabase.supabaseUrl}/functions/v1/extract-action-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ meetingId: meeting.id }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to extract action items');
      }

      // Refresh action items list
      const { data: actionItemsData } = await supabase
        .from('meeting_action_items')
        .select('*')
        .eq('meeting_id', meeting.id)
        .order('timestamp_seconds', { ascending: true });
      setActionItems(actionItemsData || []);

      // Show empty state message if none created
      const created = Number(json?.itemsCreated || 0);
      if (created === 0) {
        toast.info('No Action Items From Meeting');
      } else {
        toast.success(`Added ${created} action item${created === 1 ? '' : 's'}`);
      }
    } catch (e) {
      console.error('[Get Action Items] Error:', e);
      toast.error(e instanceof Error ? e.message : 'Failed to extract action items');
    } finally {
      setIsExtracting(false);
    }
  }, [meeting]);

  // Attach click handlers to Fathom timestamp links in summary
  useEffect(() => {
    if (!summaryRef.current || !meeting?.summary) {
      return;
    }

    const handleSummaryLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if clicked element or its parent has data-timestamp attribute
      const timestampEl = target.closest('[data-timestamp]') as HTMLElement;
      if (timestampEl) {
        const timestamp = timestampEl.getAttribute('data-timestamp');
        if (timestamp) {
          e.preventDefault();
          e.stopPropagation();
          const seconds = parseFloat(timestamp);
          handleTimestampJump(seconds);
        }
      }
      // Fallback for old anchor tag format (if any remain)
      else if (target.tagName === 'A' && (target as HTMLAnchorElement).href?.includes('fathom.video')) {
        const url = new URL((target as HTMLAnchorElement).href);
        const timestamp = url.searchParams.get('timestamp');
        if (timestamp) {
          e.preventDefault();
          e.stopPropagation();
          const seconds = parseFloat(timestamp);
          handleTimestampJump(seconds);
        }
      }
    };

    const summaryEl = summaryRef.current;
    summaryEl.addEventListener('click', handleSummaryLinkClick);

    return () => {
      summaryEl.removeEventListener('click', handleSummaryLinkClick);
    };
  }, [meeting?.summary, handleTimestampJump]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || 'Meeting not found'}
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/meetings')} className="mt-4" variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Meetings
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate('/meetings')} variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
          <h1 className="text-3xl font-bold">{meeting.title}</h1>
          <p className="text-muted-foreground">
            {new Date(meeting.meeting_start).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })} • {Math.round(meeting.duration_minutes)} minutes
          </p>
        </div>

        <div className="flex gap-2">
          {meeting.sentiment_score !== null && (
            <Badge className={getSentimentColor(meeting.sentiment_score)}>
              {labelSentiment(meeting.sentiment_score)}
            </Badge>
          )}
          <Button size="sm" onClick={handleGetActionItems} disabled={isExtracting}>
            {isExtracting ? 'Getting Action Items…' : 'Get Action Items'}
          </Button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Video & Content */}
        <div className="lg:col-span-8 space-y-4">
          {/* Video Player */}
          {(meeting.fathom_recording_id || meeting.share_url) && (
            <div className="glassmorphism-card overflow-hidden">
              <FathomPlayerV2
                ref={playerRef}
                shareUrl={meeting.share_url}
                title={meeting.title}
                startSeconds={currentTimestamp}
                timeoutMs={10000}
                className="aspect-video"
                onLoad={() => console.log('[MeetingDetail] Video loaded successfully')}
                onError={() => console.error('[MeetingDetail] Video failed to load')}
              />
            </div>
          )}

          {/* AI Insights Section */}
          <div className="space-y-4">
            {/* Sentiment Analysis Card */}
            {meeting.sentiment_score !== null && meeting.sentiment_reasoning && (
              <div className="section-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold">Sentiment Analysis</div>
                  <Badge className={getSentimentColor(meeting.sentiment_score)}>
                    {labelSentiment(meeting.sentiment_score)} ({(meeting.sentiment_score * 100).toFixed(0)}%)
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {meeting.sentiment_reasoning}
                </p>
              </div>
            )}

            {/* Talk Time Analysis Card */}
            {meeting.talk_time_rep_pct !== null && meeting.talk_time_customer_pct !== null && (
              <div className="section-card">
                <div className="font-semibold mb-3">Talk Time Analysis</div>

                {/* Visual Bar Chart */}
                <div className="mb-3 flex h-8 rounded-lg overflow-hidden border border-zinc-700">
                  <div
                    className="bg-blue-600 flex items-center justify-center text-xs font-medium text-white"
                    style={{ width: `${meeting.talk_time_rep_pct}%` }}
                  >
                    {meeting.talk_time_rep_pct > 15 && `${meeting.talk_time_rep_pct.toFixed(0)}%`}
                  </div>
                  <div
                    className="bg-emerald-600 flex items-center justify-center text-xs font-medium text-white"
                    style={{ width: `${meeting.talk_time_customer_pct}%` }}
                  >
                    {meeting.talk_time_customer_pct > 15 && `${meeting.talk_time_customer_pct.toFixed(0)}%`}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex gap-4 text-xs mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-blue-600"></div>
                    <span className="text-muted-foreground">Rep: {meeting.talk_time_rep_pct.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-emerald-600"></div>
                    <span className="text-muted-foreground">Customer: {meeting.talk_time_customer_pct.toFixed(1)}%</span>
                  </div>
                </div>

                {/* AI Judgement */}
                {meeting.talk_time_judgement && (
                  <div className="glassmorphism-light p-3 rounded-lg">
                    <div className="text-xs font-medium text-emerald-400 mb-1">AI Assessment</div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {meeting.talk_time_judgement}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tabbed Interface: Summary, Transcript, Ask AI */}
            <div className="section-card">
              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="transcript">Transcript</TabsTrigger>
                  <TabsTrigger value="ask-ai">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Ask AI
                  </TabsTrigger>
                </TabsList>

                {/* Summary Tab */}
                <TabsContent value="summary" className="mt-0">
                  {/* Quick Actions */}
                  <div className="mb-4 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleQuickAdd('meeting')}>Add Meeting</Button>
                    <Button size="sm" variant="secondary" onClick={() => handleQuickAdd('outbound')}>Add Outbound</Button>
                    <Button size="sm" variant="secondary" onClick={() => handleQuickAdd('proposal')}>Add Proposal</Button>
                  </div>

                  {meeting.summary ? (
                    <div className="text-sm text-muted-foreground leading-relaxed">
                      {(() => {
                        try {
                          // Try to parse as JSON first (Fathom format)
                          const parsed = JSON.parse(meeting.summary);
                          if (parsed.markdown_formatted) {
                            // Parse and render markdown content
                            const html = parseMarkdownSummary(parsed.markdown_formatted);
                            return <div ref={summaryRef} dangerouslySetInnerHTML={{ __html: html }} />;
                          }
                          return <div ref={summaryRef} className="whitespace-pre-line">{meeting.summary}</div>;
                        } catch {
                          // If not JSON, just display as plain text
                          return <div ref={summaryRef} className="whitespace-pre-line">{meeting.summary}</div>;
                        }
                      })()}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Summary will be available after Fathom processes the recording (5-10 minutes after meeting ends).
                    </p>
                  )}

                  <div className="mt-3 flex gap-2 flex-wrap">
                    {meeting.transcript_doc_url && (
                      <Button asChild variant="outline" size="sm">
                        <a href={meeting.transcript_doc_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-3 w-3 mr-2" />
                          Open transcript
                          <ExternalLink className="h-3 w-3 ml-2" />
                        </a>
                      </Button>
                    )}
                    {meeting.share_url && (
                      <Button asChild variant="outline" size="sm">
                        <a href={meeting.share_url} target="_blank" rel="noopener noreferrer">
                          Open in Fathom
                          <ExternalLink className="h-3 w-3 ml-2" />
                        </a>
                      </Button>
                    )}
                  </div>
                </TabsContent>

                {/* Transcript Tab */}
                <TabsContent value="transcript" className="mt-0">
                  {meeting.transcript_text ? (
                    <div className="glassmorphism-light p-4 rounded-lg max-h-[600px] overflow-y-auto">
                      <div className="text-sm leading-relaxed space-y-3">
                        {meeting.transcript_text.split('\n').map((line, idx) => {
                          // Check if line starts with a speaker name (pattern: "Name: text")
                          const speakerMatch = line.match(/^([^:]+):\s*(.*)$/);
                          if (speakerMatch) {
                            const [, speaker, text] = speakerMatch;
                            return (
                              <div key={idx} className="flex gap-3">
                                <div className="font-semibold text-blue-400 min-w-[120px] shrink-0">{speaker}:</div>
                                <div className="text-muted-foreground flex-1">{text}</div>
                              </div>
                            );
                          }
                          // Plain text line (no speaker)
                          return line.trim() ? (
                            <div key={idx} className="text-muted-foreground">{line}</div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Transcript will be available after Fathom processes the recording.
                    </p>
                  )}
                </TabsContent>

                {/* Ask AI Tab */}
                <TabsContent value="ask-ai" className="mt-0">
                  <AskAIChat meetingId={meeting.id} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
        {/* End of Left Column */}

        {/* Right Column - Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          {/* Action Items */}
          <div className="section-card">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">
                Action Items ({actionItems.length})
              </div>
              {actionItems.some(item => item.ai_generated) && (
                <Badge variant="outline" className="text-xs bg-purple-900/30 text-purple-300 border-purple-700">
                  AI
                </Badge>
              )}
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {actionItems.length > 0 ? (
                actionItems.map((item) => (
                  <div
                    key={item.id}
                    className="glassmorphism-light p-3 rounded-xl"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="font-medium text-sm flex-1">{item.title}</div>
                      {item.ai_generated && item.ai_confidence && (
                        <Badge variant="outline" className="text-xs bg-purple-900/30 text-purple-300 border-purple-700 shrink-0">
                          {(item.ai_confidence * 100).toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={
                          item.priority === 'urgent' || item.priority === 'high'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="text-xs"
                      >
                        {item.priority}
                      </Badge>
                      {item.completed && (
                        <Badge className="bg-green-900/60 text-green-300 text-xs">
                          ✓
                        </Badge>
                      )}
                      {item.category && (
                        <span className="text-xs text-muted-foreground">{item.category}</span>
                      )}
                    </div>
                    {item.timestamp_seconds !== null && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTimestampJump(item.timestamp_seconds!)}
                        className="mt-2 w-full text-xs"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        {formatTimestamp(item.timestamp_seconds)}
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No action items identified.
                </p>
              )}
            </div>
          </div>

          {/* Attendees */}
          <div className="section-card">
            <div className="font-semibold mb-2">Attendees</div>
            <div className="space-y-2">
              {attendees.length > 0 ? (
                attendees.map((attendee) => {
                  const isExternal = attendee.is_external;
                  const contactId = isExternal ? attendee.id : null;
                  const content = (
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium">{attendee.name}</div>
                        {attendee.email && (
                          <div className="text-muted-foreground text-xs">{attendee.email}</div>
                        )}
                      </div>
                      {isExternal ? (
                        <Badge className="bg-amber-900/60 text-amber-300">
                          External
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Internal
                        </Badge>
                      )}
                    </div>
                  );

                  return contactId ? (
                    <Link
                      key={attendee.id}
                      to={`/crm/contacts/${contactId}`}
                      className="block hover:bg-zinc-900/40 rounded-lg px-2 -mx-2 transition-colors"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div key={attendee.id} className="flex items-center justify-between text-sm">
                      {content}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No attendees recorded</p>
              )}
            </div>
          </div>

          {/* Meeting Info */}
          <div className="section-card">
            <div className="font-semibold mb-2">Meeting Info</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration:</span>
                <span>{Math.round(meeting.duration_minutes)} minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Host:</span>
                <span className="truncate ml-2">{meeting.owner_email || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Start:</span>
                <span>{new Date(meeting.meeting_start).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">End:</span>
                <span>{new Date(meeting.meeting_end).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          {/* Debug Info */}
          <div className="section-card">
            <div className="font-semibold mb-2">Debug Info</div>
            <div className="text-xs font-mono text-muted-foreground space-y-1 break-all">
              <div>
                <span className="text-muted-foreground/70">Recording ID:</span>
                <br />
                {meeting.fathom_recording_id}
              </div>
              <div>
                <span className="text-muted-foreground/70">Share URL:</span>
                <br />
                {meeting.share_url}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
