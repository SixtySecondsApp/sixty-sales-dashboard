import React, { useState } from 'react';
import { useFirefliesIntegration } from '@/lib/hooks/useFirefliesIntegration';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Calendar, Play, Copy, Zap, ExternalLink, ChevronDown, ChevronUp, Key, Mic } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

/**
 * FirefliesSettings Component
 * 
 * Per-user Fireflies.ai integration settings.
 * Pattern: Following FathomSettings.tsx
 */

export function FirefliesSettings() {
  const {
    integration,
    syncState,
    loading,
    error,
    isConnected,
    isSyncing,
    canManage,
    lifetimeMeetingsCount,
    connectFireflies,
    disconnectFireflies,
    triggerSync,
  } = useFirefliesIntegration();

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const [connecting, setConnecting] = useState(false);

  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncType, setSyncType] = useState<'initial' | 'incremental' | 'manual'>('manual');
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});
  const [syncing, setSyncing] = useState(false);

  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [deleteSyncedMeetings, setDeleteSyncedMeetings] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter your Fireflies API key');
      return;
    }

    setConnecting(true);
    try {
      const success = await connectFireflies(apiKey, email);
      if (success) {
        setShowConnectModal(false);
        setApiKey('');
        setEmail('');
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await triggerSync({
        sync_type: syncType,
        start_date: dateRange.start,
        end_date: dateRange.end,
      });
      if (result?.success) {
        toast.success(`Synced ${result.meetings_synced || 0} meetings`);
      }
      setShowSyncModal(false);
    } catch (err) {
      // Error already shown by hook
    } finally {
      setSyncing(false);
    }
  };

  const handleQuickSync = async () => {
    setSyncing(true);
    try {
      const result = await triggerSync({ sync_type: 'manual' });
      if (result?.success) {
        toast.success(`Synced ${result.meetings_synced || 0} meetings`);
      }
    } catch (err) {
      // Error already shown by hook
    } finally {
      setSyncing(false);
    }
  };

  const handleTestSync = async () => {
    setSyncing(true);
    try {
      const result = await triggerSync({ sync_type: 'manual', limit: 10 });
      if (result?.success) {
        toast.success(`Test sync: found ${result.total_found || 0} meetings, synced ${result.meetings_synced || 0}`);
      }
    } catch (err) {
      // Error already shown by hook
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-white dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-orange-500 px-3 py-2 rounded-lg flex items-center space-x-2 shadow-sm">
                <Mic className="w-5 h-5 text-white" />
                <span className="text-white font-bold text-lg tracking-wide">Fireflies</span>
              </div>
              <div>
                <CardTitle className="text-gray-900 dark:text-white">Fireflies.ai Integration</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Connect your Fireflies account to automatically sync meeting transcripts
                </CardDescription>
              </div>
            </div>
            {isConnected && (
              <Badge variant="default" className="flex items-center gap-1 bg-green-500 hover:bg-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!isConnected ? (
            <div className="rounded-lg border border-dashed border-gray-300 dark:border-slate-600 p-6 text-center">
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">No Fireflies Account Connected</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Connect your Fireflies account to enable automatic meeting transcript sync and AI-generated insights.
              </p>
              <Button
                onClick={() => setShowConnectModal(true)}
                disabled={!canManage}
                className="gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
              >
                <Key className="h-4 w-4" />
                {canManage ? 'Connect Fireflies Account' : 'Connect Fireflies (Admin only)'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Integration Details */}
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 p-4">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Connected As</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {integration?.fireflies_user_email || (
                      <span className="text-orange-600 dark:text-orange-400">
                        Email not set
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Last Sync</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {integration?.last_sync_at ? new Date(integration.last_sync_at).toLocaleDateString() : 'Never'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Connected On</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {integration?.created_at ? new Date(integration.created_at).toLocaleDateString() : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">API Key</div>
                  <div className="font-medium text-gray-900 dark:text-white font-mono text-xs">
                    ••••••••{integration?.api_key?.slice(-4) || '••••'}
                  </div>
                </div>
              </div>

              {/* Sync Status */}
              {syncState && (
                <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Sync Status</h4>
                    <Badge
                      variant={
                        syncState.sync_status === 'syncing'
                          ? 'default'
                          : syncState.sync_status === 'error'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {syncState.sync_status === 'syncing' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      {syncState.sync_status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-gray-600 dark:text-gray-400">Meetings Synced</div>
                      <div className="font-medium text-lg text-gray-900 dark:text-white">{syncState.meetings_synced}</div>
                    </div>
                    <div>
                      <div className="text-gray-600 dark:text-gray-400">Total Found</div>
                      <div className="font-medium text-lg text-gray-900 dark:text-white">{syncState.total_meetings_found}</div>
                    </div>
                    <div>
                      <div className="text-gray-600 dark:text-gray-400">Lifetime Meetings</div>
                      <div className="font-medium text-lg text-gray-900 dark:text-white">{lifetimeMeetingsCount}</div>
                    </div>
                  </div>

                  {syncState.last_successful_sync && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Last synced: {new Date(syncState.last_successful_sync).toLocaleString()}
                    </div>
                  )}

                  {syncState.error_message && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertDescription className="text-xs">{syncState.error_message}</AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={handleTestSync}
                  disabled={isSyncing || syncing}
                  variant="secondary"
                  className="gap-2"
                  size="sm"
                >
                  {(isSyncing || syncing) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Test Sync (Last 10)
                </Button>

                <Button
                  onClick={handleQuickSync}
                  disabled={isSyncing || syncing}
                  className="gap-2 bg-orange-500 hover:bg-orange-600"
                  size="sm"
                >
                  {(isSyncing || syncing) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Quick Sync
                </Button>

                <Button
                  onClick={() => setShowSyncModal(true)}
                  disabled={isSyncing || syncing}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Custom Sync Range
                </Button>
              </div>
            </div>
          )}
        </CardContent>

        {isConnected && (
          <CardFooter className="border-t border-gray-200 dark:border-slate-700 pt-4">
            <Button 
              variant="destructive" 
              onClick={() => setShowDisconnectDialog(true)} 
              size="sm"
              className="gap-2"
              disabled={!canManage}
            >
              <XCircle className="h-4 w-4" />
              {canManage ? 'Disconnect Fireflies' : 'Disconnect (Admin only)'}
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Connect Modal */}
      <Dialog open={showConnectModal} onOpenChange={setShowConnectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Fireflies.ai</DialogTitle>
            <DialogDescription>
              Enter your Fireflies API key to start syncing meeting transcripts
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your Fireflies API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Get your API key from{' '}
                <a
                  href="https://app.fireflies.ai/integrations/custom/api"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:underline inline-flex items-center gap-1"
                >
                  Fireflies Settings → Integrations → API
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Your Email (optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used to identify your meetings
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConnectModal(false)}
              disabled={connecting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConnect}
              disabled={connecting || !apiKey.trim()}
              className="gap-2 bg-orange-500 hover:bg-orange-600"
            >
              {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Fireflies Integration</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect your Fireflies account? This will stop automatic meeting syncing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start space-x-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start space-x-2 flex-1">
                <input
                  type="checkbox"
                  id="deleteMeetings"
                  checked={deleteSyncedMeetings}
                  onChange={(e) => setDeleteSyncedMeetings(e.target.checked)}
                  className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <label htmlFor="deleteMeetings" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <span className="font-medium">Also delete all synced meeting data</span>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    This will permanently delete all meetings that were synced from Fireflies. This action cannot be undone.
                  </p>
                </label>
              </div>
            </div>
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
              onClick={async () => {
                setDisconnecting(true);
                try {
                  await disconnectFireflies(deleteSyncedMeetings);
                  setShowDisconnectDialog(false);
                  setDeleteSyncedMeetings(false);
                } catch (error) {
                  // Error already shown by hook
                } finally {
                  setDisconnecting(false);
                }
              }}
              disabled={disconnecting || !canManage}
              className="gap-2"
            >
              {disconnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  Disconnect
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Sync Modal */}
      <Dialog open={showSyncModal} onOpenChange={setShowSyncModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Custom Sync Configuration</DialogTitle>
            <DialogDescription>
              Choose a sync type and date range to pull meetings from Fireflies
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sync-type">Sync Type</Label>
              <Select value={syncType} onValueChange={(value: any) => setSyncType(value)}>
                <SelectTrigger id="sync-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual (Last 30 days)</SelectItem>
                  <SelectItem value="incremental">Incremental (Since last sync)</SelectItem>
                  <SelectItem value="initial">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {syncType === 'initial' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={dateRange.start || ''}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={dateRange.end || ''}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  />
                </div>
              </>
            )}

            <Alert>
              <AlertDescription className="text-xs">
                {syncType === 'manual' && 'Syncs meetings from the last 30 days'}
                {syncType === 'incremental' && 'Syncs new meetings since your last sync'}
                {syncType === 'initial' && 'Syncs all meetings within the specified date range'}
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSyncModal(false)}
              disabled={syncing}
            >
              Cancel
            </Button>
            <Button onClick={handleSync} disabled={syncing} className="gap-2 bg-orange-500 hover:bg-orange-600">
              {syncing && <Loader2 className="h-4 w-4 animate-spin" />}
              Start Sync
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


