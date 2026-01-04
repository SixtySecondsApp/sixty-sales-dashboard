/**
 * NotetakerConfigModal
 *
 * Configuration modal for 60 Notetaker integration.
 * Allows users to enable/disable the notetaker and manage per-user settings.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  Calendar,
  Settings,
  Video,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';
import { useNotetakerIntegration } from '@/lib/hooks/useNotetakerIntegration';
import { cn } from '@/lib/utils';

interface NotetakerConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotetakerConfigModal({ open, onOpenChange }: NotetakerConfigModalProps) {
  const navigate = useNavigate();
  const {
    isLoading,
    isConnected,
    isOrgEnabled,
    isUserEnabled,
    needsCalendar,
    googleConnected,
    userSettings,
    enable,
    disable,
    updateSettings,
    isEnabling,
    isDisabling,
    isUpdating,
  } = useNotetakerIntegration();

  const handleToggleEnabled = async () => {
    if (isUserEnabled) {
      await disable();
    } else {
      await enable();
    }
  };

  const handleToggleAutoExternal = async () => {
    if (!userSettings) return;
    await updateSettings({
      auto_record_external: !userSettings.auto_record_external,
    });
  };

  const handleToggleAutoInternal = async () => {
    if (!userSettings) return;
    await updateSettings({
      auto_record_internal: !userSettings.auto_record_internal,
    });
  };

  const handleOpenSettings = () => {
    onOpenChange(false);
    navigate('/meetings/recordings/settings');
  };

  const handleConnectCalendar = () => {
    onOpenChange(false);
    navigate('/integrations');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <Bot className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <DialogTitle className="text-xl">60 Notetaker</DialogTitle>
              <DialogDescription>
                Automatically record and transcribe your meetings
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Status Section */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {isConnected ? 'Active' : needsCalendar ? 'Calendar Required' : 'Not Active'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isConnected
                    ? 'Your meetings are being recorded automatically'
                    : needsCalendar
                      ? 'Connect Google Calendar to enable'
                      : 'Enable to start recording meetings'}
                </p>
              </div>
            </div>
            <Badge
              variant={isConnected ? 'default' : 'secondary'}
              className={cn(
                isConnected && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              )}
            >
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>

          {/* Calendar Requirement Notice */}
          {needsCalendar && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/30">
              <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  Google Calendar Required
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  60 Notetaker needs access to your calendar to automatically join your meetings.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={handleConnectCalendar}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Connect Google Calendar
                </Button>
              </div>
            </div>
          )}

          {/* Org not enabled notice */}
          {!isOrgEnabled && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <Info className="h-5 w-5 text-gray-500 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  Feature Not Enabled
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  60 Notetaker has not been enabled for your organization. Contact your administrator to enable this feature.
                </p>
              </div>
            </div>
          )}

          {/* Settings Section - Only show if org is enabled and calendar is connected */}
          {isOrgEnabled && googleConnected && (
            <>
              <Separator />

              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable 60 Notetaker</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Automatically record your meetings
                  </p>
                </div>
                <Switch
                  checked={isUserEnabled}
                  onCheckedChange={handleToggleEnabled}
                  disabled={isLoading || isEnabling || isDisabling}
                />
              </div>

              {/* Recording Preferences - Only show if enabled */}
              {isUserEnabled && userSettings && (
                <>
                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Recording Preferences
                    </h4>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>External Meetings</Label>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Record meetings with external participants
                        </p>
                      </div>
                      <Switch
                        checked={userSettings.auto_record_external}
                        onCheckedChange={handleToggleAutoExternal}
                        disabled={isUpdating}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Internal Meetings</Label>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Record meetings with only team members
                        </p>
                      </div>
                      <Switch
                        checked={userSettings.auto_record_internal}
                        onCheckedChange={handleToggleAutoInternal}
                        disabled={isUpdating}
                      />
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Advanced Settings Link */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Advanced Settings</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Recording rules, bot customization, and more
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleOpenSettings}>
                  <Settings className="h-4 w-4 mr-2" />
                  Open Settings
                  <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              </div>
            </>
          )}

          {/* View Recordings Link */}
          {isConnected && (
            <>
              <Separator />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onOpenChange(false);
                  navigate('/meetings/recordings');
                }}
              >
                <Video className="h-4 w-4 mr-2" />
                View Recordings
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
