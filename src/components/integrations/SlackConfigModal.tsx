import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ConfigureModal,
  ConfigSection,
  DangerZone,
} from './ConfigureModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSlackIntegration } from '@/lib/hooks/useSlackIntegration';
import {
  useSlackNotificationSettings,
  type SlackNotificationSettings,
} from '@/lib/hooks/useSlackSettings';
import {
  Settings,
  MessageSquare,
  Calendar,
  Bell,
  Building2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';

interface SlackConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Slack logo SVG component
const SlackLogo = () => (
  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#E01E5A"/>
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z" fill="#36C5F0"/>
    <path d="M6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#2EB67D"/>
    <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834z" fill="#ECB22E"/>
    <path d="M8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#E01E5A"/>
    <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834z" fill="#36C5F0"/>
    <path d="M17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D"/>
    <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52z" fill="#ECB22E"/>
    <path d="M15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#E01E5A"/>
  </svg>
);

// Feature status component
function FeatureStatus({ 
  icon: Icon, 
  name, 
  isEnabled,
  description,
}: { 
  icon: React.ElementType; 
  name: string; 
  isEnabled: boolean;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <div className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded-md">
          <Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">{name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </div>
      <Badge variant={isEnabled ? 'default' : 'secondary'} className={isEnabled ? 'bg-green-600' : ''}>
        {isEnabled ? 'Enabled' : 'Disabled'}
      </Badge>
    </div>
  );
}

export function SlackConfigModal({ open, onOpenChange }: SlackConfigModalProps) {
  const navigate = useNavigate();
  const {
    orgSettings,
    teamName,
    connectedAt,
    disconnectSlack,
    isDisconnecting,
  } = useSlackIntegration();
  const { data: notificationSettings } = useSlackNotificationSettings();

  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Get feature settings
  const getFeatureSettings = (feature: string): SlackNotificationSettings | undefined => {
    return notificationSettings?.find((s) => s.feature === feature);
  };

  const meetingDebriefSettings = getFeatureSettings('meeting_debrief');
  const dailyDigestSettings = getFeatureSettings('daily_digest');
  const meetingPrepSettings = getFeatureSettings('meeting_prep');
  const dealRoomSettings = getFeatureSettings('deal_rooms');

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectSlack();
      toast.success('Slack disconnected successfully');
      setShowDisconnectDialog(false);
      onOpenChange(false);
    } catch {
      toast.error('Failed to disconnect Slack');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleOpenSettings = () => {
    onOpenChange(false);
    navigate('/settings/integrations/slack');
  };

  return (
    <TooltipProvider>
      <ConfigureModal
        open={open}
        onOpenChange={onOpenChange}
        integrationId="slack"
        integrationName="Slack"
        connectedEmail={teamName || undefined}
        connectedAt={connectedAt || undefined}
        fallbackIcon={<SlackLogo />}
        showFooter={false}
      >
        {/* Workspace Info */}
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {teamName || 'Slack Workspace'}
              </p>
              {connectedAt && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Connected on {new Date(connectedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Feature Overview */}
        <ConfigSection title="Notification Features">
          <div className="space-y-1 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <FeatureStatus
              icon={MessageSquare}
              name="AI Meeting Debriefs"
              isEnabled={meetingDebriefSettings?.is_enabled ?? false}
              description="Post meeting summaries with action items"
            />
            <FeatureStatus
              icon={Calendar}
              name="Daily Standup Digest"
              isEnabled={dailyDigestSettings?.is_enabled ?? false}
              description="Morning digest with meetings and tasks"
            />
            <FeatureStatus
              icon={Bell}
              name="Pre-Meeting Prep Cards"
              isEnabled={meetingPrepSettings?.is_enabled ?? false}
              description="Prep cards 30 mins before meetings"
            />
            <FeatureStatus
              icon={Building2}
              name="Deal Room Channels"
              isEnabled={dealRoomSettings?.is_enabled ?? false}
              description="Auto-create channels for qualifying deals"
            />
          </div>
        </ConfigSection>

        {/* Configure Button */}
        <div className="pt-2">
          <Button 
            onClick={handleOpenSettings} 
            className="w-full gap-2"
            variant="outline"
          >
            <Settings className="h-4 w-4" />
            Configure Slack Settings
            <ExternalLink className="h-3 w-3 ml-auto" />
          </Button>
        </div>

        {/* Danger Zone */}
        <DangerZone
          title="Disconnect Slack"
          description="Stops all Slack notifications."
          buttonText="Disconnect"
          onAction={() => setShowDisconnectDialog(true)}
          isLoading={isDisconnecting}
        />
      </ConfigureModal>

      {/* Disconnect Confirmation */}
      <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Disconnect Slack?</DialogTitle>
            <DialogDescription>
              This will stop all Slack notifications for your organization. You can reconnect at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDisconnectDialog(false)}
              disabled={disconnecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                'Disconnect'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}





