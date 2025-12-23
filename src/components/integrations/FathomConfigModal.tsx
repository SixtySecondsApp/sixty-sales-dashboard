import React, { useState } from 'react';
import {
  ConfigureModal,
  ConfigSection,
  DangerZone,
} from './ConfigureModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFathomIntegration } from '@/lib/hooks/useFathomIntegration';
import {
  Copy,
  Zap,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  Info,
  MoreHorizontal,
  Calendar,
  Play,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useOrgStore } from '@/lib/stores/orgStore';
import { ProcessMapButton } from '@/components/process-maps';

interface FathomConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FathomConfigModal({ open, onOpenChange }: FathomConfigModalProps) {
  const activeOrgId = useOrgStore((s) => s.activeOrgId);
  const WEBHOOK_URL = `${(import.meta as any)?.env?.VITE_PUBLIC_URL || window.location.origin}/api/webhooks/fathom${activeOrgId ? `?org_id=${encodeURIComponent(activeOrgId)}` : ''}`;

  const {
    integration,
    syncState,
    isSyncing,
    lifetimeMeetingsCount,
    disconnectFathom,
    triggerSync,
    canManage,
  } = useFathomIntegration();

  const [showWebhookDetails, setShowWebhookDetails] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncType, setSyncType] = useState<'initial' | 'incremental' | 'manual'>('manual');
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});
  const [syncing, setSyncing] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [deleteSyncedMeetings, setDeleteSyncedMeetings] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showAccountDetails, setShowAccountDetails] = useState(false);

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(WEBHOOK_URL);
      toast.success('Webhook URL copied!');
    } catch {
      toast.error('Failed to copy URL');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerSync({
        sync_type: syncType,
        start_date: dateRange.start,
        end_date: dateRange.end,
      });
      setShowSyncModal(false);
      toast.success('Sync started');
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleQuickSync = async () => {
    setSyncing(true);
    try {
      await triggerSync({ sync_type: 'manual' });
      toast.success('Syncing...');
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleTestSync = async () => {
    setSyncing(true);
    try {
      await triggerSync({ sync_type: 'manual', limit: 10 });
      toast.success('Test sync started');
    } catch {
      toast.error('Test sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectFathom(deleteSyncedMeetings);
      toast.success(
        deleteSyncedMeetings
          ? 'Fathom disconnected and meetings deleted'
          : 'Fathom disconnected'
      );
      setShowDisconnectDialog(false);
      setDeleteSyncedMeetings(false);
      onOpenChange(false);
    } catch {
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  // Fathom logo
  const FathomLogo = () => (
    <div className="flex items-center space-x-1">
      <span className="text-white font-bold text-xs">F</span>
      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 16C4 14 4 12 6 10C8 8 10 8 12 6C14 4 16 4 18 6C20 8 20 10 20 12"
          stroke="#00BEFF"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );

  return (
    <TooltipProvider>
      <ConfigureModal
        open={open}
        onOpenChange={onOpenChange}
        integrationId="fathom"
        integrationName="Fathom"
        connectedEmail={integration?.fathom_user_email || undefined}
        connectedAt={integration?.created_at}
        fallbackIcon={<FathomLogo />}
        showFooter={false}
      >
        {/* Compact Account Info with Expandable Details */}
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {integration?.fathom_user_email || 'Connected'}
              </span>
              <Badge variant="secondary" className="text-xs">
                {lifetimeMeetingsCount} meetings
              </Badge>
            </div>
            <button
              onClick={() => setShowAccountDetails(!showAccountDetails)}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {showAccountDetails ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          {showAccountDetails && (
            <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-700 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Connected:</span>{' '}
                <span className="text-gray-900 dark:text-white">
                  {integration && new Date(integration.created_at).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Last Sync:</span>{' '}
                <span className="text-gray-900 dark:text-white">
                  {integration?.last_sync_at ? new Date(integration.last_sync_at).toLocaleDateString() : 'Never'}
                </span>
              </div>
              {integration?.scopes && (
                <div className="col-span-2">
                  <span className="text-gray-500">Scopes:</span>{' '}
                  {integration.scopes.map((scope: string) => (
                    <Badge key={scope} variant="outline" className="text-xs ml-1">
                      {scope}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Webhook Setup - Compact */}
        <ConfigSection title="Instant Sync">
          <div className="rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Webhook URL
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    Add this URL to Fathom to get instant meeting sync instead of waiting for scheduled updates.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 px-2 py-1.5 font-mono text-xs text-gray-700 dark:text-gray-200 overflow-hidden text-ellipsis">
                {WEBHOOK_URL}
              </code>
              <Button onClick={copyWebhookUrl} variant="outline" size="sm" className="shrink-0">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>

            <button
              onClick={() => setShowWebhookDetails(!showWebhookDetails)}
              className="mt-2 text-xs text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1"
            >
              {showWebhookDetails ? 'Hide' : 'Show'} setup instructions
              {showWebhookDetails ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            {showWebhookDetails && (
              <ol className="mt-3 pt-2 border-t border-amber-200 dark:border-amber-700 list-decimal list-inside space-y-1 text-xs text-gray-700 dark:text-gray-300">
                <li>
                  Go to{' '}
                  <a
                    href="https://fathom.video/settings/integrations"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    Fathom Settings → Integrations <ExternalLink className="inline h-3 w-3" />
                  </a>
                </li>
                <li>Find Webhooks → Add Webhook</li>
                <li>Paste URL above, select "Recording Ready"</li>
                <li>Save</li>
              </ol>
            )}
          </div>
        </ConfigSection>

        {/* Sync Status - Compact with Tooltips */}
        {syncState && (
          <ConfigSection title="Sync Status">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-center cursor-help">
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {syncState.meetings_synced}
                      </div>
                      <div className="text-xs text-gray-500">synced</div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {syncState.total_meetings_found} total found in Fathom
                    </p>
                  </TooltipContent>
                </Tooltip>

                <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="cursor-help">
                      <Badge
                        variant={
                          syncState.sync_status === 'syncing'
                            ? 'default'
                            : syncState.sync_status === 'error'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="gap-1"
                      >
                        {syncState.sync_status === 'syncing' && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {syncState.sync_status}
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {syncState.last_sync_completed_at && (
                      <p className="text-xs">
                        Last sync: {new Date(syncState.last_sync_completed_at).toLocaleString()}
                      </p>
                    )}
                    {syncState.last_sync_error && (
                      <p className="text-xs text-red-400">{syncState.last_sync_error}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Sync Actions */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleQuickSync}
                  disabled={isSyncing || syncing}
                  size="sm"
                  className="gap-1.5"
                >
                  {isSyncing || syncing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Sync
                </Button>

                <ProcessMapButton
                  processType="integration"
                  processName="fathom"
                  variant="outline"
                  size="sm"
                  showLabel={false}
                />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="px-2">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleTestSync} disabled={isSyncing || syncing}>
                      <Play className="h-4 w-4 mr-2" />
                      Test (last 10)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowSyncModal(true)}
                      disabled={isSyncing || syncing}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Custom date range
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </ConfigSection>
        )}

        {/* Danger Zone */}
        <DangerZone
          title="Disconnect Fathom"
          description="Stops meeting sync."
          buttonText="Disconnect"
          onAction={() => setShowDisconnectDialog(true)}
          isLoading={disconnecting}
          disabled={!canManage}
        />
      </ConfigureModal>

      {/* Custom Sync Modal */}
      <Dialog open={showSyncModal} onOpenChange={setShowSyncModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Custom Sync</DialogTitle>
            <DialogDescription>
              Choose what to sync from Fathom
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sync-type">Sync Type</Label>
              <Select
                value={syncType}
                onValueChange={(value: 'initial' | 'incremental' | 'manual') => setSyncType(value)}
              >
                <SelectTrigger id="sync-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Last 30 days</SelectItem>
                  <SelectItem value="incremental">Last 24 hours</SelectItem>
                  <SelectItem value="initial">Custom range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {syncType === 'initial' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="start-date" className="text-xs">Start</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={dateRange.start || ''}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="end-date" className="text-xs">End</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={dateRange.end || ''}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    className="h-9"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSyncModal(false)} disabled={syncing}>
              Cancel
            </Button>
            <Button onClick={handleSync} disabled={syncing} className="gap-2">
              {syncing && <Loader2 className="h-4 w-4 animate-spin" />}
              Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation */}
      <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Disconnect Fathom?</DialogTitle>
            <DialogDescription>
              This will stop automatic meeting syncing.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteSyncedMeetings}
                onChange={(e) => setDeleteSyncedMeetings(e.target.checked)}
                className="mt-0.5 h-4 w-4 text-red-600 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Also delete all synced meeting data
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDisconnectDialog(false);
                setDeleteSyncedMeetings(false);
              }}
              disabled={disconnecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={disconnecting || !canManage}
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
