/**
 * SlackDemo Page
 *
 * Admin demo page for testing all Slack integration events.
 * Allows manually triggering each notification type with sample data.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  MessageSquare,
  Calendar,
  Bell,
  Building2,
  Play,
  CheckCircle,
  XCircle,
  RefreshCw,
  ArrowRight,
  Trophy,
  AlertTriangle,
  Activity,
  Send,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/clientV2';
import { useOrg } from '@/lib/contexts/OrgContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useSlackOrgSettings } from '@/lib/hooks/useSlackSettings';
import { slackOAuthService } from '@/lib/services/slackOAuthService';
import { toast } from 'sonner';

interface TestResult {
  success: boolean;
  message: string;
  data?: unknown;
  timestamp: Date;
}

type MeetingPickerItem = {
  id: string;
  title: string | null;
  meeting_start: string | null;
  owner_email: string | null;
  company?: { name?: string | null } | null;
};

function TestCard({
  title,
  description,
  icon: Icon,
  children,
  onTest,
  isLoading,
  lastResult,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onTest: () => Promise<void>;
  isLoading: boolean;
  lastResult: TestResult | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-sm">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}

        <div className="flex items-center gap-4 pt-2">
          <Button onClick={onTest} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Test
              </>
            )}
          </Button>

          {lastResult && (
            <div className="flex items-center gap-2 text-sm">
              {lastResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className={lastResult.success ? 'text-green-600' : 'text-red-600'}>
                {lastResult.message}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SlackDemo() {
  const { activeOrgId, activeOrg } = useOrg();
  const { user } = useAuth();
  const { data: slackSettings, isLoading: settingsLoading } = useSlackOrgSettings();

  const handleConnectSlack = () => {
    if (!user?.id) {
      toast.error('You must be logged in to connect Slack');
      return;
    }
    if (!activeOrgId) {
      toast.error('No organization selected');
      return;
    }
    const oauthUrl = slackOAuthService.initiateOAuth(user.id, activeOrgId);
    window.location.href = oauthUrl;
  };

  // Test states
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, TestResult>>({});

  // Meeting Debrief form state
  const [meetingDebriefData, setMeetingDebriefData] = useState({
    meetingId: '',
  });

  // Daily Digest form state
  const [dailyDigestData, setDailyDigestData] = useState({
    date: new Date().toISOString().split('T')[0],
  });

  // Meeting Prep form state
  const [meetingPrepData, setMeetingPrepData] = useState({
    meetingId: '',
    minutesBefore: '30',
  });

  // Deal Room form state
  const [dealRoomData, setDealRoomData] = useState({
    dealId: '',
    action: 'create' as 'create' | 'stage_change' | 'activity' | 'win_probability' | 'deal_won' | 'deal_lost',
    previousStage: 'sql',
    newStage: 'opportunity',
    activityType: 'call',
    activityDescription: 'Discussed pricing and timeline',
    previousProbability: '65',
    newProbability: '45',
  });

  // Quick testing + meeting selection helpers
  const [connectionTestLoading, setConnectionTestLoading] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<TestResult | null>(null);

  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [meetingSearch, setMeetingSearch] = useState('');
  const [recentMeetings, setRecentMeetings] = useState<MeetingPickerItem[]>([]);

  const setLoadingState = (key: string, value: boolean) => {
    setLoading((prev) => ({ ...prev, [key]: value }));
  };

  const setResult = (key: string, result: TestResult) => {
    setResults((prev) => ({ ...prev, [key]: result }));
  };

  const invokeFunction = async (functionName: string, body: unknown) => {
    const { data, error } = await supabase.functions.invoke(functionName, { body });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  };

  const loadRecentMeetings = async () => {
    if (!user?.id) return;
    setMeetingsLoading(true);
    try {
      let q = supabase
        .from('meetings')
        .select('id, title, meeting_start, owner_email, company:companies(name)')
        .order('meeting_start', { ascending: false })
        .limit(75);

      if (activeOrgId) {
        q = q.eq('org_id', activeOrgId);
      } else if ((user as any)?.email) {
        q = q.or(`owner_user_id.eq.${user.id},owner_email.eq.${(user as any).email}`);
      } else {
        q = q.eq('owner_user_id', user.id);
      }

      const { data, error } = await q;
      if (error) throw error;
      setRecentMeetings((data as any[]) || []);
    } catch (e: any) {
      // Non-fatal: meeting picker is just a convenience
      setRecentMeetings([]);
      toast.error(e?.message || 'Failed to load meetings');
    } finally {
      setMeetingsLoading(false);
    }
  };

  useEffect(() => {
    if (!slackSettings?.is_connected) return;
    void loadRecentMeetings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slackSettings?.is_connected, activeOrgId, user?.id]);

  const filteredMeetings = useMemo(() => {
    const q = meetingSearch.trim().toLowerCase();
    if (!q) return recentMeetings;
    return recentMeetings.filter((m) => {
      const title = (m.title || '').toLowerCase();
      const company = (m.company?.name || '').toLowerCase();
      const email = (m.owner_email || '').toLowerCase();
      return title.includes(q) || company.includes(q) || email.includes(q) || m.id.toLowerCase().includes(q);
    });
  }, [meetingSearch, recentMeetings]);

  const testSlackConnectionQuick = async () => {
    if (!user?.id) {
      toast.error('You must be logged in');
      return;
    }
    if (!activeOrgId) {
      toast.error('No organization selected');
      return;
    }
    if (!slackSettings?.is_connected) {
      toast.error('Slack is not connected for this org');
      return;
    }

    setConnectionTestLoading(true);
    try {
      // Prefer a real channel ID (Slack APIs are much happier with IDs)
      const channelsRes = await invokeFunction('slack-list-channels', { orgId: activeOrgId });
      const channels = (channelsRes as any)?.channels as Array<{ id: string; name: string }> | undefined;

      const preferred =
        channels?.find((c) => c.name === 'general') ||
        channels?.find((c) => c.name === 'random') ||
        (channels && channels.length ? channels[0] : null);

      if (!preferred?.id) {
        throw new Error('No Slack channels available (invite the bot to at least one channel)');
      }

      await slackOAuthService.sendMessage(
        user.id,
        preferred.id,
        {
          text: '✅ Sixty Slack connection test: bot can post messages successfully.',
        },
        slackSettings.slack_team_id || undefined
      );

      const result: TestResult = {
        success: true,
        message: `Test message sent to #${preferred.name}`,
        timestamp: new Date(),
      };
      setConnectionTestResult(result);
      toast.success(result.message);
    } catch (e: any) {
      const result: TestResult = {
        success: false,
        message: e?.message || 'Slack connection test failed',
        timestamp: new Date(),
      };
      setConnectionTestResult(result);
      toast.error(result.message);
    } finally {
      setConnectionTestLoading(false);
    }
  };

  // Test handlers
  const testMeetingDebrief = async () => {
    setLoadingState('meetingDebrief', true);
    try {
      const result = await invokeFunction('slack-post-meeting', {
        meetingId: meetingDebriefData.meetingId || 'test-meeting-id',
        orgId: activeOrgId,
        isTest: true,
      });

      setResult('meetingDebrief', {
        success: result.success,
        message: result.success ? 'Meeting debrief sent!' : result.error || 'Failed',
        data: result,
        timestamp: new Date(),
      });
      toast.success('Meeting debrief test sent');
    } catch (error: any) {
      setResult('meetingDebrief', {
        success: false,
        message: error.message,
        timestamp: new Date(),
      });
      toast.error(`Failed: ${error.message}`);
    } finally {
      setLoadingState('meetingDebrief', false);
    }
  };

  const testDailyDigest = async () => {
    setLoadingState('dailyDigest', true);
    try {
      const result = await invokeFunction('slack-daily-digest', {
        orgId: activeOrgId,
        date: dailyDigestData.date,
        isTest: true,
      });

      setResult('dailyDigest', {
        success: result.success,
        message: result.success ? 'Daily digest sent!' : result.error || 'Failed',
        data: result,
        timestamp: new Date(),
      });
      toast.success('Daily digest test sent');
    } catch (error: any) {
      setResult('dailyDigest', {
        success: false,
        message: error.message,
        timestamp: new Date(),
      });
      toast.error(`Failed: ${error.message}`);
    } finally {
      setLoadingState('dailyDigest', false);
    }
  };

  const testMeetingPrep = async () => {
    setLoadingState('meetingPrep', true);
    try {
      const result = await invokeFunction('slack-meeting-prep', {
        meetingId: meetingPrepData.meetingId || 'test-meeting-id',
        orgId: activeOrgId,
        minutesBefore: parseInt(meetingPrepData.minutesBefore),
        isTest: true,
      });

      setResult('meetingPrep', {
        success: result.success,
        message: result.success ? 'Meeting prep sent!' : result.error || 'Failed',
        data: result,
        timestamp: new Date(),
      });
      toast.success('Meeting prep test sent');
    } catch (error: any) {
      setResult('meetingPrep', {
        success: false,
        message: error.message,
        timestamp: new Date(),
      });
      toast.error(`Failed: ${error.message}`);
    } finally {
      setLoadingState('meetingPrep', false);
    }
  };

  const testDealRoom = async () => {
    setLoadingState('dealRoom', true);
    try {
      let result;

      if (dealRoomData.action === 'create') {
        result = await invokeFunction('slack-deal-room', {
          dealId: dealRoomData.dealId || 'test-deal-id',
          orgId: activeOrgId,
          isTest: true,
        });
      } else {
        const updateData: Record<string, unknown> = {
          dealId: dealRoomData.dealId || 'test-deal-id',
          orgId: activeOrgId,
          updateType: dealRoomData.action,
          isTest: true,
          data: {},
        };

        switch (dealRoomData.action) {
          case 'stage_change':
            updateData.data = {
              dealName: 'Test Deal',
              previousStage: dealRoomData.previousStage,
              newStage: dealRoomData.newStage,
              updatedBy: 'Test User',
            };
            break;
          case 'activity':
            updateData.data = {
              dealName: 'Test Deal',
              activityType: dealRoomData.activityType,
              description: dealRoomData.activityDescription,
              createdBy: 'Test User',
            };
            break;
          case 'win_probability':
            updateData.data = {
              dealName: 'Test Deal',
              previousProbability: parseInt(dealRoomData.previousProbability),
              newProbability: parseInt(dealRoomData.newProbability),
              factors: ['No recent activity', 'Competitor mentioned'],
              suggestedActions: ['Schedule follow-up call', 'Send case study'],
            };
            break;
          case 'deal_won':
            updateData.data = {
              dealName: 'Test Deal',
              dealValue: 50000,
              companyName: 'Test Company',
              closedBy: 'Test User',
              daysInPipeline: 30,
            };
            break;
          case 'deal_lost':
            updateData.data = {
              dealName: 'Test Deal',
              dealValue: 50000,
              companyName: 'Test Company',
              lostReason: 'Budget constraints',
              closedBy: 'Test User',
            };
            break;
        }

        result = await invokeFunction('slack-deal-room-update', updateData);
      }

      setResult('dealRoom', {
        success: result.success,
        message: result.success
          ? dealRoomData.action === 'create'
            ? 'Deal room created!'
            : 'Update sent!'
          : result.error || 'Failed',
        data: result,
        timestamp: new Date(),
      });
      toast.success('Deal room test sent');
    } catch (error: any) {
      setResult('dealRoom', {
        success: false,
        message: error.message,
        timestamp: new Date(),
      });
      toast.error(`Failed: ${error.message}`);
    } finally {
      setLoadingState('dealRoom', false);
    }
  };

  if (settingsLoading) {
    return (
      <div className="container max-w-4xl py-8 px-4 sm:px-6">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!slackSettings?.is_connected) {
    return (
      <div className="container max-w-4xl py-8 px-4 sm:px-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Slack Integration Demo</h1>
          <p className="text-muted-foreground mt-1">
            Connect your Slack workspace to test notification features.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[#4A154B]/10 rounded-lg">
                <MessageSquare className="h-6 w-6 text-[#4A154B]" />
              </div>
              <div>
                <CardTitle>Connect Slack</CardTitle>
                <CardDescription>
                  Link your Slack workspace to enable notifications for meetings, deals, and daily digests.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span>AI Meeting Debriefs</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span>Daily Standup Digest</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span>Pre-Meeting Prep Cards</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span>Deal Room Channels</span>
              </div>
            </div>

            <Separator />

            <Button onClick={handleConnectSlack} className="w-full" size="lg">
              <MessageSquare className="mr-2 h-5 w-5" />
              Connect Slack Workspace
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              You'll be redirected to Slack to authorize the connection.
              {activeOrg && <span> Connecting for: <strong>{activeOrg.name}</strong></span>}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 px-4 sm:px-6 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Slack Integration Demo</h1>
          <p className="text-muted-foreground mt-1">
            Quickly verify Slack connection, then test each notification type (real Slack messages).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void loadRecentMeetings()} disabled={meetingsLoading}>
            {meetingsLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading meetings…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh meetings
              </>
            )}
          </Button>
          <Button onClick={() => void testSlackConnectionQuick()} disabled={connectionTestLoading}>
            {connectionTestLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing…
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Test Slack connection
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      <Alert>
        <CheckCircle className="h-4 w-4 text-green-500" />
        <AlertDescription className="flex items-center gap-2">
          Connected to <Badge variant="secondary">{slackSettings.slack_team_name}</Badge>
          {activeOrg && (
            <>
              <span className="text-muted-foreground">•</span>
              <span>Org: {activeOrg.name}</span>
            </>
          )}
        </AlertDescription>
      </Alert>

      {connectionTestResult && (
        <Alert variant={connectionTestResult.success ? 'default' : 'destructive'}>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>
              <span className="font-medium">Connection test:</span> {connectionTestResult.message}
            </span>
            <span className="text-xs text-muted-foreground">
              {connectionTestResult.timestamp.toLocaleTimeString()}
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Test Cards */}
      <div className="grid gap-6">
        {/* Meeting Debrief */}
        <TestCard
          title="AI Meeting Debrief"
          description="Test the post-meeting summary with AI analysis, action items, and coaching insights."
          icon={MessageSquare}
          onTest={testMeetingDebrief}
          isLoading={loading.meetingDebrief}
          lastResult={results.meetingDebrief}
        >
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Meeting (optional)</Label>
              <Input
                placeholder="Search recent meetings by title/company/email/id…"
                value={meetingSearch}
                onChange={(e) => setMeetingSearch(e.target.value)}
              />
              <Select
                value={meetingDebriefData.meetingId || undefined}
                onValueChange={(value) => setMeetingDebriefData({ ...meetingDebriefData, meetingId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={meetingsLoading ? 'Loading meetings…' : 'Select a meeting (optional)'} />
                </SelectTrigger>
                <SelectContent>
                  {filteredMeetings.slice(0, 75).map((m) => {
                    const dt = m.meeting_start ? new Date(m.meeting_start).toLocaleString() : '';
                    const company = m.company?.name ? ` • ${m.company.name}` : '';
                    return (
                      <SelectItem key={m.id} value={m.id}>
                        {(m.title || 'Untitled meeting') + company + (dt ? ` • ${dt}` : '')}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Or paste meeting ID</Label>
                <Input
                  placeholder="Leave empty for test data"
                  value={meetingDebriefData.meetingId}
                  onChange={(e) => setMeetingDebriefData({ ...meetingDebriefData, meetingId: e.target.value })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Pick a real meeting to use transcript data (best), or leave empty for sample data.
              </p>
            </div>
          </div>
        </TestCard>

        {/* Daily Digest */}
        <TestCard
          title="Daily Standup Digest"
          description="Test the morning digest with meetings, tasks, and AI insights."
          icon={Calendar}
          onTest={testDailyDigest}
          isLoading={loading.dailyDigest}
          lastResult={results.dailyDigest}
        >
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={dailyDigestData.date}
                onChange={(e) => setDailyDigestData({ ...dailyDigestData, date: e.target.value })}
              />
            </div>
          </div>
        </TestCard>

        {/* Meeting Prep */}
        <TestCard
          title="Pre-Meeting Prep Cards"
          description="Test the meeting prep notification with attendee info and talking points."
          icon={Bell}
          onTest={testMeetingPrep}
          isLoading={loading.meetingPrep}
          lastResult={results.meetingPrep}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Meeting (optional)</Label>
              <Select
                value={meetingPrepData.meetingId || undefined}
                onValueChange={(value) => setMeetingPrepData({ ...meetingPrepData, meetingId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={meetingsLoading ? 'Loading meetings…' : 'Select a meeting (optional)'} />
                </SelectTrigger>
                <SelectContent>
                  {filteredMeetings.slice(0, 75).map((m) => {
                    const dt = m.meeting_start ? new Date(m.meeting_start).toLocaleString() : '';
                    const company = m.company?.name ? ` • ${m.company.name}` : '';
                    return (
                      <SelectItem key={m.id} value={m.id}>
                        {(m.title || 'Untitled meeting') + company + (dt ? ` • ${dt}` : '')}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Input
                placeholder="Or paste meeting ID"
                value={meetingPrepData.meetingId}
                onChange={(e) => setMeetingPrepData({ ...meetingPrepData, meetingId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Minutes Before</Label>
              <Select
                value={meetingPrepData.minutesBefore}
                onValueChange={(value) =>
                  setMeetingPrepData({ ...meetingPrepData, minutesBefore: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TestCard>

        {/* Deal Room */}
        <TestCard
          title="Deal Room Events"
          description="Test deal room creation and various update events."
          icon={Building2}
          onTest={testDealRoom}
          isLoading={loading.dealRoom}
          lastResult={results.dealRoom}
        >
          <Tabs
            value={dealRoomData.action}
            onValueChange={(value) =>
              setDealRoomData({ ...dealRoomData, action: value as typeof dealRoomData.action })
            }
          >
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="create" className="text-xs">
                Create
              </TabsTrigger>
              <TabsTrigger value="stage_change" className="text-xs">
                Stage
              </TabsTrigger>
              <TabsTrigger value="activity" className="text-xs">
                Activity
              </TabsTrigger>
              <TabsTrigger value="win_probability" className="text-xs">
                Win %
              </TabsTrigger>
              <TabsTrigger value="deal_won" className="text-xs">
                Won
              </TabsTrigger>
              <TabsTrigger value="deal_lost" className="text-xs">
                Lost
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Deal ID (optional)</Label>
                <Input
                  placeholder="Leave empty for test data"
                  value={dealRoomData.dealId}
                  onChange={(e) => setDealRoomData({ ...dealRoomData, dealId: e.target.value })}
                />
              </div>

              <TabsContent value="stage_change" className="mt-0 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From Stage</Label>
                    <Select
                      value={dealRoomData.previousStage}
                      onValueChange={(value) =>
                        setDealRoomData({ ...dealRoomData, previousStage: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sql">SQL</SelectItem>
                        <SelectItem value="opportunity">Opportunity</SelectItem>
                        <SelectItem value="verbal">Verbal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>To Stage</Label>
                    <Select
                      value={dealRoomData.newStage}
                      onValueChange={(value) =>
                        setDealRoomData({ ...dealRoomData, newStage: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="opportunity">Opportunity</SelectItem>
                        <SelectItem value="verbal">Verbal</SelectItem>
                        <SelectItem value="signed">Signed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="mt-0 space-y-4">
                <div className="space-y-2">
                  <Label>Activity Type</Label>
                  <Select
                    value={dealRoomData.activityType}
                    onValueChange={(value) =>
                      setDealRoomData({ ...dealRoomData, activityType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                      <SelectItem value="note">Note</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Activity description..."
                    value={dealRoomData.activityDescription}
                    onChange={(e) =>
                      setDealRoomData({ ...dealRoomData, activityDescription: e.target.value })
                    }
                  />
                </div>
              </TabsContent>

              <TabsContent value="win_probability" className="mt-0 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Previous Probability (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={dealRoomData.previousProbability}
                      onChange={(e) =>
                        setDealRoomData({ ...dealRoomData, previousProbability: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>New Probability (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={dealRoomData.newProbability}
                      onChange={(e) =>
                        setDealRoomData({ ...dealRoomData, newProbability: e.target.value })
                      }
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="deal_won" className="mt-0">
                <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                  <Trophy className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700 dark:text-green-400">
                    This will post a "Deal Won" celebration message and mark the channel for
                    archiving.
                  </AlertDescription>
                </Alert>
              </TabsContent>

              <TabsContent value="deal_lost" className="mt-0">
                <Alert className="bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700 dark:text-red-400">
                    This will post a "Deal Lost" message and mark the channel for archiving.
                  </AlertDescription>
                </Alert>
              </TabsContent>
            </div>
          </Tabs>
        </TestCard>
      </div>

      {/* Recent Results */}
      {Object.keys(results).length > 0 && (
        <>
          <Separator />

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Recent Test Results</h2>
            <div className="space-y-2">
              {Object.entries(results)
                .sort((a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime())
                .map(([key, result]) => (
                  <div
                    key={key}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      result.success
                        ? 'bg-green-50 dark:bg-green-950/30'
                        : 'bg-red-50 dark:bg-red-950/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {result.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="mx-2 text-muted-foreground">•</span>
                        <span
                          className={result.success ? 'text-green-600' : 'text-red-600'}
                        >
                          {result.message}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {result.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
