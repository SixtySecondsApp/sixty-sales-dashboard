/**
 * JustCallSettings Page
 *
 * Org admin page for configuring JustCall (and Sales Dialer) integration.
 * Mirrors SlackSettings UX at /settings/integrations/slack.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, Copy, Info, Loader2, PhoneCall, RefreshCw, Search, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/clientV2';
import { getSupabaseAuthToken } from '@/lib/supabase/clientV2';
import { useJustCallIntegration } from '@/lib/hooks/useJustCallIntegration';
import { useOrg } from '@/lib/contexts/OrgContext';
import { useIsOrgAdmin } from '@/contexts/UserPermissionsContext';

function computePublicOrigin(): string {
  const envOrigin = String((import.meta as any)?.env?.VITE_PUBLIC_URL || '').trim();
  const isHttp = /^https?:\/\//i.test(envOrigin);
  const isLocal = envOrigin.includes('localhost') || envOrigin.includes('127.0.0.1') || envOrigin.includes('0.0.0.0');
  if (envOrigin && isHttp && !isLocal) return envOrigin.replace(/\/$/, '');
  return window.location.origin;
}

function formatUtcDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

export default function JustCallSettings() {
  const navigate = useNavigate();
  const { activeOrgId } = useOrg();
  const isAdmin = useIsOrgAdmin();

  const { status, isConnected, loading, disconnect, triggerSync, refreshStatus } = useJustCallIntegration();

  const origin = useMemo(() => computePublicOrigin(), []);
  const webhookUrl = useMemo(() => {
    const token = status?.integration?.webhook_token;
    if (!token) return null;
    return `${origin}/api/webhooks/justcall?token=${encodeURIComponent(token)}`;
  }, [origin, status?.integration?.webhook_token]);

  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [callSid, setCallSid] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<string>('');

  // Slack-style: if not connected, redirect back to Settings.
  useEffect(() => {
    if (!loading && !isConnected) {
      navigate('/settings', { replace: true });
    }
  }, [isConnected, loading, navigate]);

  if (loading) {
    return (
      <PageContainer maxWidth="4xl" className="py-8">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  if (!isConnected) return null;

  const handleCopy = async () => {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success('Webhook URL copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const authToken = await getSupabaseAuthToken();
      if (!authToken) {
        throw new Error('Unauthorized: auth token not available yet. Please refresh and try again.');
      }

      const now = new Date();
      const from = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);

      const fromDt = customFrom.trim() || formatUtcDateTime(from);
      const toDt = customTo.trim() || formatUtcDateTime(now);

      // invoke directly so we can pass from/to overrides
      const resp = await supabase.functions.invoke('justcall-sync', {
        headers: { Authorization: `Bearer ${authToken}` },
        body: {
          org_id: activeOrgId,
          sync_type: 'manual',
          limit: 2000,
          max_pages: 25,
          from_datetime: fromDt,
          to_datetime: toDt,
        },
      });
      if (resp.error) throw new Error(resp.error.message || 'Sync failed');
      // Let the hook toast do its normal messaging too
      await refreshStatus();
      toast.success('Sync request sent. Refreshing Calls…');
    } catch (e: any) {
      toast.error(e?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      navigate('/settings', { replace: true });
    } catch (e: any) {
      toast.error(e?.message || 'Disconnect failed');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      // Lightweight check: run a tiny Call SID search only if provided, otherwise just refresh status.
      await refreshStatus();
      toast.success('JustCall connection refreshed');
    } catch (e: any) {
      toast.error(e?.message || 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSearch = async () => {
    const sid = callSid.trim();
    if (!sid) return;
    setSearching(true);
    setSearchResult('');
    try {
      const authToken = await getSupabaseAuthToken();
      if (!authToken) {
        throw new Error('Unauthorized: auth token not available yet. Please refresh and try again.');
      }

      const now = new Date();
      const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const resp = await supabase.functions.invoke('justcall-search', {
        headers: { Authorization: `Bearer ${authToken}` },
        body: {
          org_id: activeOrgId,
          call_sid: sid,
          from_datetime: customFrom.trim() || formatUtcDateTime(from),
          to_datetime: customTo.trim() || formatUtcDateTime(now),
          max_pages: 25,
        },
      });
      if (resp.error) throw new Error(resp.error.message || 'Search failed');
      setSearchResult(JSON.stringify(resp.data, null, 2));
      toast.success('Search complete');
    } catch (e: any) {
      const msg = e?.message || 'Search failed';
      setSearchResult(JSON.stringify({ success: false, error: msg }, null, 2));
      toast.error(msg);
    } finally {
      setSearching(false);
    }
  };

  return (
    <PageContainer maxWidth="4xl" className="py-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">JustCall Integration</h1>
          <p className="text-muted-foreground mt-1">
            Configure call sync, Sales Dialer webhooks, and outbound activity logging.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg">JustCall Connection</CardTitle>
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
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleTest} disabled={testing}>
                  {testing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Send test
                    </>
                  )}
                </Button>
              </div>
            </div>
            <CardDescription>Organization-wide JustCall/Sales Dialer integration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium flex items-center gap-2">
                  <PhoneCall className="h-4 w-4" />
                  Calls + transcripts
                </div>
                {status?.integration?.last_sync_at ? (
                  <div className="text-sm text-muted-foreground">
                    Last sync: {new Date(status.integration.last_sync_at).toLocaleString()}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Not synced yet</div>
                )}
              </div>
              {isAdmin ? (
                <Button variant="destructive" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Webhook setup</CardTitle>
            <CardDescription>
              Add this URL in JustCall to keep calls up to date in real-time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {webhookUrl ? (
              <div className="flex items-center gap-2">
                <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                <Button variant="outline" onClick={handleCopy} className="gap-2">
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Webhook URL is not available yet. Re-open this page or re-connect JustCall.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <div className="text-sm font-medium">Recommended events to subscribe</div>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                <li>Call completed in JustCall</li>
                <li>Call updated in JustCall</li>
                <li>Call completed in Sales Dialer</li>
                <li>Call updated in Sales Dialer</li>
              </ul>
              <div className="text-xs text-muted-foreground">
                Enable Dynamic Webhook Signatures in JustCall. We verify signatures using your API Secret.
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sync & backfill</CardTitle>
            <CardDescription>
              Pull recent calls into Sixty. Sales Dialer calls are imported here and shown under Calls.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Backfill window:
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={rangeDays === 7 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRangeDays(7)}
                >
                  7d
                </Button>
                <Button
                  type="button"
                  variant={rangeDays === 30 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRangeDays(30)}
                >
                  30d
                </Button>
                <Button
                  type="button"
                  variant={rangeDays === 90 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRangeDays(90)}
                >
                  90d
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">from_datetime (optional override, UTC)</Label>
                <Input
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  placeholder="YYYY-MM-DD HH:MM:SS"
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">to_datetime (optional override, UTC)</Label>
                <Input
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  placeholder="YYYY-MM-DD HH:MM:SS"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                Uses JustCall + Sales Dialer APIs. Imports up to 2000 calls per run.
              </div>
              <Button variant="outline" onClick={handleSync} disabled={!isAdmin || syncing || !activeOrgId}>
              {syncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing…
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync now
                </>
              )}
            </Button>
            </div>
          </CardContent>
          {!isAdmin ? (
            <CardContent>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>Only org owners/admins can run sync or edit integration settings.</AlertDescription>
              </Alert>
            </CardContent>
          ) : null}
        </Card>

        {isAdmin ? (
          <>
            <Separator />
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Debug: find a call by SID</CardTitle>
                <CardDescription>
                  Paste a Call SID (e.g. <span className="font-mono">CA…</span>) to confirm the API can see it.
                  Uses the same org credentials stored in Sixty.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Call SID</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={callSid}
                      onChange={(e) => setCallSid(e.target.value)}
                      placeholder="CA2bbf0812c3e64d430dd98e66d350118e"
                      className="font-mono text-xs"
                    />
                    <Button type="button" variant="outline" onClick={handleSearch} disabled={searching || !callSid.trim()}>
                      {searching ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Searching…
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          Search
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Tip: adjust the from/to fields above if the call is outside the default window.
                  </div>
                </div>

                {searchResult ? (
                  <pre className="max-h-80 overflow-auto rounded-lg border border-slate-200/70 dark:border-white/10 bg-slate-950/5 dark:bg-black/20 p-3 text-xs text-slate-800 dark:text-slate-200">
                    {searchResult}
                  </pre>
                ) : null}
              </CardContent>
            </Card>
          </>
        ) : null}

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Outbound activity logging</CardTitle>
            <CardDescription>
              Sixty will log Sales Dialer outbound calls as outbound activities and communication events.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Outbound calls will appear in activity tracking as <span className="font-mono">type=outbound</span> with <span className="font-mono">outbound_type=call</span>.
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}




