/**
 * SlackSettings Page
 *
 * Team admin page for configuring Slack integration settings.
 * Allows configuration of notification features, channel selection, and user mappings.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Calendar,
  Users,
  Bell,
  RefreshCw,
  ExternalLink,
  Building2,
  Info,
} from 'lucide-react';

import { SlackChannelSelector } from '@/components/settings/SlackChannelSelector';
import { SlackUserMapping } from '@/components/settings/SlackUserMapping';
import {
  useSlackOrgSettings,
  useSlackNotificationSettings,
  useUpdateNotificationSettings,
  useSendTestNotification,
  useDisconnectSlack,
  type SlackFeature,
  type SlackNotificationSettings,
} from '@/lib/hooks/useSlackSettings';
import { useOrg } from '@/lib/contexts/OrgContext';
import { useIsOrgAdmin } from '@/contexts/UserPermissionsContext';
import { useAuth } from '@/lib/contexts/AuthContext';
import { slackOAuthService } from '@/lib/services/slackOAuthService';
import { toast } from 'sonner';

// Timezone options
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'UTC', label: 'UTC' },
];

// Time options for schedule
const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour = i.toString().padStart(2, '0');
  return { value: `${hour}:00`, label: `${hour}:00` };
});

// Feature configurations
const FEATURES = [
  {
    key: 'meeting_debrief' as SlackFeature,
    title: 'AI Meeting Debriefs',
    description: 'Post AI-generated meeting summaries with action items and coaching insights.',
    icon: MessageSquare,
    supportsDM: true,
    dmDescription: 'Send to meeting owner',
    channelDescription: 'Post to team channel',
  },
  {
    key: 'daily_digest' as SlackFeature,
    title: 'Daily Standup Digest',
    description: 'Morning digest with meetings, tasks, and AI insights.',
    icon: Calendar,
    supportsDM: true,
    dmDescription: 'Send personalized digest to each user',
    channelDescription: 'Post team-wide digest to channel',
    hasSchedule: true,
  },
  {
    key: 'meeting_prep' as SlackFeature,
    title: 'Pre-Meeting Prep Cards',
    description: 'Send prep cards with talking points 30 mins before meetings.',
    icon: Bell,
    supportsDM: true,
    dmDescription: 'Send to person with the meeting',
    channelDescription: 'Post to channel with @mention',
    defaultDM: true,
  },
  {
    key: 'deal_rooms' as SlackFeature,
    title: 'Deal Room Channels',
    description: 'Auto-create private channels for qualifying deals.',
    icon: Building2,
    supportsDM: false,
    hasThresholds: true,
  },
];

function FeatureSettingsCard({
  feature,
  settings,
  onUpdate,
  onTest,
  isUpdating,
  isTesting,
}: {
  feature: (typeof FEATURES)[0];
  settings: SlackNotificationSettings | undefined;
  onUpdate: (updates: Partial<SlackNotificationSettings>) => void;
  onTest: () => void;
  isUpdating: boolean;
  isTesting: boolean;
}) {
  const Icon = feature.icon;
  const isEnabled = settings?.is_enabled ?? false;
  const deliveryMethod = settings?.delivery_method || (feature.defaultDM ? 'dm' : 'channel');

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{feature.title}</CardTitle>
              <CardDescription className="text-sm">{feature.description}</CardDescription>
            </div>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={(checked) => onUpdate({ is_enabled: checked })}
            disabled={isUpdating}
          />
        </div>
      </CardHeader>

      {isEnabled && (
        <CardContent className="space-y-4">
          {feature.supportsDM && (
            <div className="space-y-3">
              <Label>Delivery Method</Label>
              <RadioGroup
                value={deliveryMethod}
                onValueChange={(value) => onUpdate({ delivery_method: value as 'channel' | 'dm' })}
                className="grid grid-cols-2 gap-4"
              >
                <div>
                  <RadioGroupItem value="channel" id={`${feature.key}-channel`} className="peer sr-only" />
                  <Label
                    htmlFor={`${feature.key}-channel`}
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Users className="mb-2 h-5 w-5" />
                    <span className="text-sm font-medium">Team Channel</span>
                    <span className="text-xs text-muted-foreground text-center mt-1">
                      {feature.channelDescription}
                    </span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="dm" id={`${feature.key}-dm`} className="peer sr-only" />
                  <Label
                    htmlFor={`${feature.key}-dm`}
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <MessageSquare className="mb-2 h-5 w-5" />
                    <span className="text-sm font-medium">Direct Message</span>
                    <span className="text-xs text-muted-foreground text-center mt-1">
                      {feature.dmDescription}
                    </span>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {deliveryMethod === 'channel' && (
            <div className="space-y-2">
              <Label>Channel</Label>
              <SlackChannelSelector
                value={settings?.channel_id || null}
                onChange={(channelId, channelName) =>
                  onUpdate({ channel_id: channelId, channel_name: channelName })
                }
              />
            </div>
          )}

          {feature.hasSchedule && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Send at</Label>
                <Select
                  value={settings?.schedule_time || '08:00'}
                  onValueChange={(value) => onUpdate({ schedule_time: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={time.value} value={time.value}>
                        {time.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select
                  value={settings?.schedule_timezone || 'UTC'}
                  onValueChange={(value) => onUpdate({ schedule_timezone: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {feature.hasThresholds && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Create deal room when:</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Deal value exceeds</span>
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      value={settings?.deal_value_threshold || 25000}
                      onChange={(e) =>
                        onUpdate({ deal_value_threshold: parseInt(e.target.value) || 25000 })
                      }
                      className="pl-7"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">OR deal stage reaches</span>
                  <Select
                    value={settings?.deal_stage_threshold || 'opportunity'}
                    onValueChange={(value) => onUpdate({ deal_stage_threshold: value })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sql">SQL</SelectItem>
                      <SelectItem value="opportunity">Opportunity</SelectItem>
                      <SelectItem value="verbal">Verbal</SelectItem>
                      <SelectItem value="signed">Signed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={onTest} disabled={isTesting}>
              {isTesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Test Notification
                </>
              )}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function SlackSettings() {
  const { activeOrgId } = useOrg();
  const isAdmin = useIsOrgAdmin();
  const { user } = useAuth();
  const { data: orgSettings, isLoading: settingsLoading } = useSlackOrgSettings();
  const { data: notificationSettings, isLoading: notificationsLoading } = useSlackNotificationSettings();
  const updateSettings = useUpdateNotificationSettings();
  const sendTest = useSendTestNotification();
  const disconnect = useDisconnectSlack();
  const [testingFeature, setTestingFeature] = useState<SlackFeature | null>(null);

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

  if (!isAdmin) {
    return (
      <div className="container max-w-4xl py-8">
        <Alert variant="destructive">
          <AlertDescription>
            You need admin permissions to access Slack settings.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (settingsLoading || notificationsLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const isConnected = orgSettings?.is_connected ?? false;

  const getSettingsForFeature = (feature: SlackFeature) => {
    return notificationSettings?.find((s) => s.feature === feature);
  };

  const handleUpdateSettings = async (feature: SlackFeature, updates: Partial<SlackNotificationSettings>) => {
    try {
      await updateSettings.mutateAsync({ feature, settings: updates });
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  const handleTestNotification = async (feature: SlackFeature) => {
    if (!activeOrgId) return;

    setTestingFeature(feature);
    try {
      await sendTest.mutateAsync({ feature, orgId: activeOrgId });
      toast.success('Test notification sent!');
    } catch (error) {
      toast.error('Failed to send test notification');
    } finally {
      setTestingFeature(null);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Slack? This will disable all Slack notifications.')) {
      return;
    }

    try {
      await disconnect.mutateAsync();
      toast.success('Slack disconnected');
    } catch (error) {
      toast.error('Failed to disconnect Slack');
    }
  };

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Slack Integration</h1>
        <p className="text-muted-foreground mt-1">
          Configure how Sixty sends notifications to your Slack workspace.
        </p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg">Slack Connection</CardTitle>
              {isConnected ? (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="h-3 w-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{orgSettings?.slack_team_name || 'Slack Workspace'}</p>
                  {orgSettings?.connected_at && (
                    <p className="text-sm text-muted-foreground">
                      Connected on {new Date(orgSettings.connected_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Button variant="outline" onClick={handleDisconnect} disabled={disconnect.isPending}>
                  {disconnect.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Disconnect'
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your Slack workspace to enable notifications.
              </p>
              <Button onClick={handleConnectSlack}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Connect Slack
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isConnected && (
        <>
          <Separator />

          {/* Notification Settings */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Notification Settings</h2>
            <div className="grid gap-4">
              {FEATURES.map((feature) => (
                <FeatureSettingsCard
                  key={feature.key}
                  feature={feature}
                  settings={getSettingsForFeature(feature.key)}
                  onUpdate={(updates) => handleUpdateSettings(feature.key, updates)}
                  onTest={() => handleTestNotification(feature.key)}
                  isUpdating={updateSettings.isPending}
                  isTesting={testingFeature === feature.key}
                />
              ))}
            </div>
          </div>

          <Separator />

          {/* User Mapping */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Mapping
              </CardTitle>
              <CardDescription>
                Map Slack users to Sixty users for @mentions and direct messages.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SlackUserMapping />
            </CardContent>
          </Card>

          {/* Info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Make sure to invite the Sixty bot to channels where you want to receive notifications.
              For private channels, you'll need to manually invite the bot using{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">/invite @Sixty</code>
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}
