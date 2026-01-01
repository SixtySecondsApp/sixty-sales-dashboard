/**
 * QuickAddVersionControl
 *
 * Admin control panel for setting the live Quick Add version.
 * Allows toggling between V1 (legacy) and V2 (chat-style) for internal vs external users.
 */
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Check, Loader2, Settings } from 'lucide-react';
import { useQuickAddVersion, type QuickAddVersion } from '@/lib/hooks/useQuickAddVersion';

export function QuickAddVersionControl() {
  const { internalVersion, externalVersion, loading, error, updateInternalVersion, updateExternalVersion } =
    useQuickAddVersion();
  const [isUpdating, setIsUpdating] = useState(false);
  const [confirm, setConfirm] = useState<{
    audience: 'internal' | 'external';
    version: QuickAddVersion;
  } | null>(null);

  const requestChange = (audience: 'internal' | 'external', version: QuickAddVersion) => {
    const current = audience === 'internal' ? internalVersion : externalVersion;
    if (current === version) return;
    setConfirm({ audience, version });
  };

  const confirmChange = async () => {
    if (!confirm) return;
    setIsUpdating(true);
    try {
      if (confirm.audience === 'internal') {
        await updateInternalVersion(confirm.version);
      } else {
        await updateExternalVersion(confirm.version);
      }
      setConfirm(null);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/30 bg-amber-50/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <Settings className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">Live Quick Add Version</CardTitle>
            <CardDescription>Control which Quick Add UI users experience</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                internalVersion === 'v2'
                  ? 'bg-violet-500/10 text-violet-500 border-violet-500/30'
                  : 'bg-gray-500/10 text-gray-500 border-gray-500/30'
              }
            >
              Internal: {internalVersion.toUpperCase()}
            </Badge>
            <Badge
              variant="outline"
              className={
                externalVersion === 'v2'
                  ? 'bg-violet-500/10 text-violet-500 border-violet-500/30'
                  : 'bg-gray-500/10 text-gray-500 border-gray-500/30'
              }
            >
              External: {externalVersion.toUpperCase()}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-500 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Error loading setting: {error.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Internal */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Internal Users</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => requestChange('internal', 'v1')}
                disabled={isUpdating}
                className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                  internalVersion === 'v1'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {internalVersion === 'v1' && (
                  <div className="absolute top-3 right-3">
                    <Check className="w-5 h-5 text-emerald-500" />
                  </div>
                )}
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">V1 - Legacy</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Grid-based Quick Add</p>
              </button>

              <button
                onClick={() => requestChange('internal', 'v2')}
                disabled={isUpdating}
                className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                  internalVersion === 'v2'
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {internalVersion === 'v2' && (
                  <div className="absolute top-3 right-3">
                    <Check className="w-5 h-5 text-violet-500" />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">V2 - Chat</h3>
                  <Badge className="text-xs bg-violet-500/20 text-violet-500 border-violet-500/30">New</Badge>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Chat-style Quick Add assistant</p>
              </button>
            </div>
          </div>

          {/* External */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">External Users</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => requestChange('external', 'v1')}
                disabled={isUpdating}
                className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                  externalVersion === 'v1'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {externalVersion === 'v1' && (
                  <div className="absolute top-3 right-3">
                    <Check className="w-5 h-5 text-emerald-500" />
                  </div>
                )}
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">V1 - Legacy</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Grid-based Quick Add</p>
              </button>

              <button
                onClick={() => requestChange('external', 'v2')}
                disabled={isUpdating}
                className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                  externalVersion === 'v2'
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                {externalVersion === 'v2' && (
                  <div className="absolute top-3 right-3">
                    <Check className="w-5 h-5 text-violet-500" />
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">V2 - Chat</h3>
                  <Badge className="text-xs bg-violet-500/20 text-violet-500 border-violet-500/30">New</Badge>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Chat-style Quick Add assistant</p>
              </button>
            </div>
          </div>
        </div>

        {/* Confirmation */}
        {confirm && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  Switch {confirm.audience} Quick Add to {confirm.version.toUpperCase()}?
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  This will immediately affect users in that audience.
                </p>
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    onClick={confirmChange}
                    disabled={isUpdating}
                    className={confirm.version === 'v2' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-gray-600 hover:bg-gray-700'}
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>Confirm Switch</>
                    )}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirm(null)} disabled={isUpdating}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-800">
          <p>
            <strong>Tip:</strong> Use the simulator above to preview V1 vs V2 before switching live.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

