/**
 * ConnectionStatusCard Component
 *
 * Visual status card showing the current state of:
 * - Google Calendar connection
 * - Calendar selection
 * - MeetingBaaS auto-recording setup
 *
 * Provides clear visual feedback and quick actions to fix disconnected states.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertCircle, Link2, Calendar, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface ConnectionStatus {
  googleCalendar: {
    connected: boolean;
    accountEmail?: string;
  };
  calendarSelected: {
    selected: boolean;
    calendarName?: string;
  };
  botCalendarSync: {
    connected: boolean;
    platform?: 'google' | 'microsoft';
    calendarEmail?: string;
  };
  autoRecordingRules: {
    enabled: boolean;
  };
}

interface ConnectionStatusCardProps {
  status: ConnectionStatus;
  onConnectGoogle?: () => void;
  onSelectCalendar?: () => void;
  onConnectBotCalendarSync?: () => void;
  isLoading?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export const ConnectionStatusCard: React.FC<ConnectionStatusCardProps> = ({
  status,
  onConnectGoogle,
  onSelectCalendar,
  onConnectBotCalendarSync,
  isLoading = false,
}) => {
  const coreSetupConnected =
    status.googleCalendar.connected &&
    status.calendarSelected.selected &&
    status.botCalendarSync.connected;

  const automationEnabled = status.autoRecordingRules.enabled;

  const allConnected = coreSetupConnected && automationEnabled;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className={cn(
        allConnected
          ? 'border-emerald-200/50 dark:border-emerald-700/30 bg-emerald-50/30 dark:bg-emerald-900/10'
          : 'border-amber-200/50 dark:border-amber-700/30 bg-amber-50/30 dark:bg-amber-900/10'
      )}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            Recording Setup Status
          </CardTitle>
          <CardDescription>
            {allConnected
              ? 'All set! Your recording bot is ready to join meetings.'
              : 'Complete the setup so the bot can join meetings and you can enable recording automation.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Google Calendar Status */}
          <StatusRow
            icon={Calendar}
            label="Google Account"
            connected={status.googleCalendar.connected}
            detail={status.googleCalendar.accountEmail}
            action={
              !status.googleCalendar.connected && onConnectGoogle ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onConnectGoogle}
                  disabled={isLoading}
                >
                  Connect
                </Button>
              ) : undefined
            }
          />

          {/* Calendar Selection Status */}
          {status.googleCalendar.connected && (
            <StatusRow
              icon={Calendar}
              label="Calendar Watched"
              connected={status.calendarSelected.selected}
              detail={status.calendarSelected.calendarName}
              action={
                !status.calendarSelected.selected && onSelectCalendar ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSelectCalendar}
                    disabled={isLoading}
                  >
                    Select Calendar
                  </Button>
                ) : undefined
              }
            />
          )}

          {/* Bot Calendar Sync Status */}
          {status.googleCalendar.connected && (
            <StatusRow
              icon={Link2}
              label="Bot Calendar Sync"
              connected={status.botCalendarSync.connected}
              detail={
                status.botCalendarSync.connected
                  ? `${status.botCalendarSync.calendarEmail || 'Primary Calendar'} • ${status.botCalendarSync.platform === 'google' ? 'Google Calendar' : 'Microsoft Calendar'}`
                  : 'Required for the bot to auto-join your meetings'
              }
              action={
                !status.botCalendarSync.connected && onConnectBotCalendarSync ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onConnectBotCalendarSync}
                    disabled={isLoading}
                    className="bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
                  >
                    Connect
                  </Button>
                ) : undefined
              }
            />
          )}

          {/* Auto-Recording Rules Status */}
          {status.googleCalendar.connected && (
            <StatusRow
              icon={Link2}
              label="Auto-Recording"
              connected={automationEnabled}
              detail={
                !automationEnabled
                  ? 'Turn on “Auto-Record Matching Meetings” below to automate recordings'
                  : !status.botCalendarSync.connected
                    ? 'Enabled, but bot calendar sync is not connected yet'
                    : 'Enabled'
              }
            />
          )}

          {/* All Set Message */}
          {allConnected && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-700/30 mt-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              <div className="text-sm text-emerald-700 dark:text-emerald-300">
                <p className="font-medium mb-1">All set!</p>
                <p className="text-emerald-600/80 dark:text-emerald-400/80">
                  Your 60 Notetaker bot will automatically join scheduled meetings on your calendar.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

// =============================================================================
// StatusRow Component
// =============================================================================

interface StatusRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  connected: boolean;
  detail?: string;
  action?: React.ReactNode;
}

const StatusRow: React.FC<StatusRowProps> = ({ icon: Icon, label, connected, detail, action }) => (
  <div className="flex items-center justify-between p-3 rounded-lg bg-white/50 dark:bg-gray-800/30 border border-gray-200/50 dark:border-gray-700/30">
    <div className="flex items-center gap-3">
      <div className={cn(
        'h-10 w-10 rounded-full flex items-center justify-center',
        connected
          ? 'bg-emerald-100 dark:bg-emerald-900/40'
          : 'bg-gray-100 dark:bg-gray-800'
      )}>
        {connected ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        ) : (
          <XCircle className="h-5 w-5 text-gray-400" />
        )}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-500" />
          <p className="font-medium text-gray-900 dark:text-gray-100">{label}</p>
        </div>
        {detail && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{detail}</p>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2">
      {connected ? (
        <Badge variant="default" className="bg-emerald-600">
          Connected
        </Badge>
      ) : action ? (
        action
      ) : (
        <Badge variant="secondary">
          Not connected
        </Badge>
      )}
    </div>
  </div>
);

export default ConnectionStatusCard;
