import React, { useState } from 'react';
import { useFathomIntegration } from '@/lib/hooks/useFathomIntegration';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Calendar, Play } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FathomTokenTest } from '@/components/FathomTokenTest';

export function FathomSettings() {
  const {
    integration,
    syncState,
    loading,
    error,
    isConnected,
    isSyncing,
    lifetimeMeetingsCount,
    connectFathom,
    disconnectFathom,
    triggerSync,
  } = useFathomIntegration();

  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncType, setSyncType] = useState<'initial' | 'incremental' | 'manual' | 'all_time'>('manual');
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerSync({
        sync_type: syncType,
        start_date: dateRange.start,
        end_date: dateRange.end,
      });
      setShowSyncModal(false);
      // Show success message
    } catch (err) {
    } finally {
      setSyncing(false);
    }
  };

  const handleQuickSync = async () => {
    setSyncing(true);
    try {
      await triggerSync({ sync_type: 'manual' });
    } catch (err) {
    } finally {
      setSyncing(false);
    }
  };

  const handleTestSync = async () => {
    setSyncing(true);
    try {
      // Test sync with only last 10 calls
      const result = await triggerSync({
        sync_type: 'manual',
        limit: 10
      });
    } catch (err) {
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
              <div className="bg-gray-900 dark:bg-[#1a1a1a] px-3 py-2 rounded-lg flex items-center space-x-2 shadow-sm">
                <span className="text-white font-bold text-lg tracking-wide">FATHOM</span>
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                  <path d="M4 16C4 14 4 12 6 10C8 8 10 8 12 6C14 4 16 4 18 6C20 8 20 10 20 12" stroke="#00BEFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 20C4 18 4 16 6 14C8 12 10 12 12 10C14 8 16 8 18 10C20 12 20 14 20 16" stroke="#00BEFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <CardTitle className="text-gray-900 dark:text-white">Fathom Integration</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Connect your Fathom account to automatically sync meeting recordings and insights
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
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">No Fathom Account Connected</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Connect your Fathom account to enable automatic meeting sync, transcription access, and AI-generated insights.
              </p>
              <Button onClick={connectFathom} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <Play className="h-4 w-4" />
                Connect Fathom Account
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Integration Details */}
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Connected As</div>
                  <div className="font-medium text-gray-900 dark:text-white">{integration.fathom_user_email || 'Unknown'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Permissions</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {integration.scopes.map((scope) => (
                      <Badge key={scope} variant="secondary" className="text-xs">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Connected On</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {new Date(integration.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Token Expires</div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {new Date(integration.token_expires_at).toLocaleDateString()}
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

                  {syncState.last_sync_completed_at && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Last synced: {new Date(syncState.last_sync_completed_at).toLocaleString()}
                    </div>
                  )}

                  {syncState.last_sync_error && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertDescription className="text-xs">{syncState.last_sync_error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Token Test */}
              <div className="rounded-lg border border-gray-200 dark:border-slate-700 p-4 space-y-3">
                <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Connection Diagnostics</h4>
                <FathomTokenTest />
              </div>

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
                  className="gap-2"
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
            <Button variant="destructive" onClick={disconnectFathom} size="sm">
              Disconnect Fathom
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Sync Modal */}
      <Dialog open={showSyncModal} onOpenChange={setShowSyncModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Custom Sync Configuration</DialogTitle>
            <DialogDescription>
              Choose a sync type and date range to pull meetings from Fathom
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
                  <SelectItem value="incremental">Incremental (Last 24 hours)</SelectItem>
                  <SelectItem value="all_time">All Time (Complete history)</SelectItem>
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
                {syncType === 'incremental' && 'Syncs new/updated meetings from the last 24 hours'}
                {syncType === 'all_time' && 'Syncs all meetings from your entire Fathom history. This may take several minutes.'}
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
            <Button onClick={handleSync} disabled={syncing} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              {syncing && <Loader2 className="h-4 w-4 animate-spin" />}
              Start Sync
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
