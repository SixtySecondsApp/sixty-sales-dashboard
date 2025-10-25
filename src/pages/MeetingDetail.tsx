import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase/clientV2';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, ExternalLink, Loader2, AlertCircle, Play } from 'lucide-react';
import FathomPlayerV2, { FathomPlayerV2Handle } from '@/components/FathomPlayerV2';

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
  summary: string | null;
  sentiment_score: number | null;
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

export function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const playerRef = useRef<FathomPlayerV2Handle>(null);

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTimestamp, setCurrentTimestamp] = useState(0);

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

        // Fetch attendees
        const { data: attendeesData, error: attendeesError } = await supabase
          .from('meeting_attendees')
          .select('*')
          .eq('meeting_id', id);

        if (attendeesError) throw attendeesError;
        setAttendees(attendeesData || []);

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

  const handleTimestampJump = (seconds: number) => {
    console.log('[Timestamp Jump] Seeking to', seconds, 's');
    setCurrentTimestamp(seconds);
    if (playerRef.current) {
      playerRef.current.seekToTimestamp(seconds);
    }
  };

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

          {/* Summary & Action Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* AI Summary */}
            <div className="section-card">
              <div className="font-semibold mb-2">AI Summary</div>
              {meeting.summary ? (
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {meeting.summary}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No summary available for this meeting.</p>
              )}

              <div className="mt-3 flex gap-2">
                {meeting.transcript_doc_url && (
                  <Button asChild variant="outline" size="sm">
                    <a href={meeting.transcript_doc_url} target="_blank" rel="noopener noreferrer">
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
            </div>

            {/* Action Items */}
            <div className="section-card">
              <div className="font-semibold mb-2">
                Action Items ({actionItems.length})
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-none">
                {actionItems.length > 0 ? (
                  actionItems.map((item) => (
                    <div
                      key={item.id}
                      className="glassmorphism-light p-3 rounded-xl"
                    >
                      <div className="font-medium text-sm">{item.title}</div>
                      {item.category && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Category: {item.category}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant={
                            item.priority === 'urgent' || item.priority === 'high'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {item.priority}
                        </Badge>
                        {item.completed && (
                          <Badge className="bg-green-900/60 text-green-300">
                            Completed
                          </Badge>
                        )}
                      </div>

                      {item.timestamp_seconds !== null && (
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTimestampJump(item.timestamp_seconds!)}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Play from {formatTimestamp(item.timestamp_seconds)}
                          </Button>
                          {item.playback_url && (
                            <Button asChild size="sm" variant="ghost">
                              <a href={item.playback_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No action items identified for this meeting.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          {/* Attendees */}
          <div className="section-card">
            <div className="font-semibold mb-2">Attendees</div>
            <div className="space-y-2">
              {attendees.length > 0 ? (
                attendees.map((attendee) => (
                  <div key={attendee.id} className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{attendee.name}</div>
                      {attendee.email && (
                        <div className="text-muted-foreground text-xs">{attendee.email}</div>
                      )}
                    </div>
                    {attendee.is_external ? (
                      <Badge className="bg-amber-900/60 text-amber-300">
                        External
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        Internal
                      </Badge>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No attendees recorded</p>
              )}
            </div>
          </div>

          {/* Talk Time */}
          {meeting.talk_time_rep_pct !== null && meeting.talk_time_customer_pct !== null && (
            <div className="section-card">
              <div className="font-semibold mb-2">Talk Time</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rep:</span>
                  <span className="font-semibold">
                    {meeting.talk_time_rep_pct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-semibold">
                    {meeting.talk_time_customer_pct.toFixed(1)}%
                  </span>
                </div>
                {meeting.talk_time_judgement && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Judgement: {meeting.talk_time_judgement}
                  </div>
                )}
              </div>
            </div>
          )}

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
