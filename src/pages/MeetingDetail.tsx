import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase/clientV2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Users,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';

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

export function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [attendees, setAttendees] = useState<MeetingAttendee[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          <AlertDescription>{error || 'Meeting not found'}</AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/meetings')} className="mt-4" variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Meetings
        </Button>
      </div>
    );
  }

  const meetingDuration = `${Math.floor(meeting.duration_minutes / 60)}h ${meeting.duration_minutes % 60}m`;

  return (
    <div className="container mx-auto py-6 space-y-6">
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
            })}
          </p>
        </div>

        <div className="flex gap-2">
          {meeting.share_url && (
            <Button asChild variant="outline">
              <a href={meeting.share_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Watch Recording
              </a>
            </Button>
          )}
          {meeting.transcript_doc_url && (
            <Button asChild variant="outline">
              <a href={meeting.transcript_doc_url} target="_blank" rel="noopener noreferrer">
                <FileText className="h-4 w-4 mr-2" />
                View Transcript
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Duration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{meetingDuration}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Attendees
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendees.length}</div>
          </CardContent>
        </Card>

        {meeting.sentiment_score !== null && (
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Sentiment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">
                  {(meeting.sentiment_score * 100).toFixed(0)}%
                </div>
                <Badge variant={meeting.sentiment_score > 0.5 ? 'default' : 'secondary'}>
                  {meeting.sentiment_score > 0.5 ? 'Positive' : meeting.sentiment_score > 0 ? 'Neutral' : 'Negative'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Action Items
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {actionItems.filter((item) => item.completed).length} / {actionItems.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="attendees">Attendees ({attendees.length})</TabsTrigger>
          <TabsTrigger value="action-items">Action Items ({actionItems.length})</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          {meeting.summary ? (
            <Card>
              <CardHeader>
                <CardTitle>AI Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <p className="whitespace-pre-wrap">{meeting.summary}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <AlertDescription>No summary available for this meeting.</AlertDescription>
            </Alert>
          )}

          {meeting.share_url && (
            <Card>
              <CardHeader>
                <CardTitle>Recording</CardTitle>
              </CardHeader>
              <CardContent>
                <iframe
                  src={meeting.share_url}
                  className="w-full aspect-video rounded-lg border"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="attendees">
          <Card>
            <CardHeader>
              <CardTitle>Meeting Attendees</CardTitle>
              <CardDescription>People who attended this meeting</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {attendees.map((attendee) => (
                  <div
                    key={attendee.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <div className="font-medium">{attendee.name}</div>
                      {attendee.email && (
                        <div className="text-sm text-muted-foreground">{attendee.email}</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {attendee.role && <Badge variant="outline">{attendee.role}</Badge>}
                      {attendee.is_external && <Badge>External</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="action-items">
          <Card>
            <CardHeader>
              <CardTitle>Action Items</CardTitle>
              <CardDescription>Tasks and follow-ups from this meeting</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {actionItems.length > 0 ? (
                  actionItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between p-3 rounded-lg border"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{item.title}</div>
                          {item.completed && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                        </div>
                        {item.category && (
                          <div className="text-sm text-muted-foreground mt-1">
                            Category: {item.category}
                          </div>
                        )}
                        {item.timestamp_seconds !== null && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Mentioned at: {Math.floor(item.timestamp_seconds / 60)}:
                            {(item.timestamp_seconds % 60).toString().padStart(2, '0')}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Badge
                          variant={
                            item.priority === 'urgent'
                              ? 'destructive'
                              : item.priority === 'high'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {item.priority}
                        </Badge>
                        {item.playback_url && (
                          <Button asChild size="sm" variant="ghost">
                            <a href={item.playback_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <Alert>
                    <AlertDescription>No action items identified for this meeting.</AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {meeting.talk_time_rep_pct !== null && meeting.talk_time_customer_pct !== null && (
              <Card>
                <CardHeader>
                  <CardTitle>Talk Time Distribution</CardTitle>
                  <CardDescription>Speaking time breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Rep</span>
                        <span className="text-sm font-bold">{meeting.talk_time_rep_pct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2"
                          style={{ width: `${meeting.talk_time_rep_pct}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Customer</span>
                        <span className="text-sm font-bold">{meeting.talk_time_customer_pct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-blue-500 rounded-full h-2"
                          style={{ width: `${meeting.talk_time_customer_pct}%` }}
                        />
                      </div>
                    </div>
                    {meeting.talk_time_judgement && (
                      <Badge variant={meeting.talk_time_judgement === 'good' ? 'default' : 'secondary'}>
                        {meeting.talk_time_judgement.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Meeting Metadata</CardTitle>
                <CardDescription>Technical details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recording ID:</span>
                  <span className="font-mono text-xs">{meeting.fathom_recording_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Host:</span>
                  <span>{meeting.owner_email || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Start Time:</span>
                  <span>{new Date(meeting.meeting_start).toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">End Time:</span>
                  <span>{new Date(meeting.meeting_end).toLocaleTimeString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
