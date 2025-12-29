import React, { useMemo, useState } from 'react';
import { ConfigureModal, ConfigSection, DangerZone } from './ConfigureModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Copy, RefreshCw, PhoneCall, KeyRound, Link2Off } from 'lucide-react';
import { toast } from 'sonner';
import { useJustCallIntegration } from '@/lib/hooks/useJustCallIntegration';
import { ProcessMapButton } from '@/components/process-maps';
import { supabase } from '@/lib/supabase/clientV2';

interface JustCallConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JustCallConfigModal({ open, onOpenChange }: JustCallConfigModalProps) {
  const origin = useMemo(() => {
    const envOrigin = String((import.meta as any)?.env?.VITE_PUBLIC_URL || '').trim();
    const isHttp = /^https?:\/\//i.test(envOrigin);
    const isLocal =
      envOrigin.includes('localhost') ||
      envOrigin.includes('127.0.0.1') ||
      envOrigin.includes('0.0.0.0');

    // If env is set but points to localhost, it's almost always an accidental prod misconfig.
    // Prefer the runtime origin (e.g. https://use60.com) in that case.
    if (envOrigin && isHttp && !isLocal) return envOrigin.replace(/\/$/, '');
    return window.location.origin;
  }, []);

  const {
    status,
    canManage,
    loading,
    connectApiKey,
    disconnect,
    triggerSync,
  } = useJustCallIntegration();

  const webhookUrl = useMemo(() => {
    const token = status?.integration?.webhook_token;
    if (!token) return null;
    return `${origin}/api/webhooks/justcall?token=${encodeURIComponent(token)}`;
  }, [origin, status?.integration?.webhook_token]);

  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [debugCallSid, setDebugCallSid] = useState('');
  const [debugResult, setDebugResult] = useState<string>('');
  const [debugging, setDebugging] = useState(false);

  const copyWebhook = async () => {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success('Webhook URL copied');
    } catch {
      toast.error('Failed to copy webhook URL');
    }
  };

  const handleSaveApiKey = async () => {
    setSaving(true);
    try {
      await connectApiKey(apiKey.trim(), apiSecret.trim() || undefined);
      setApiKey('');
      setApiSecret('');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerSync(300);
    } catch (e: any) {
      toast.error(e?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnect();
    } catch (e: any) {
      toast.error(e?.message || 'Disconnect failed');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleDebugSearch = async () => {
    const sid = debugCallSid.trim();
    if (!sid) return;
    setDebugging(true);
    setDebugResult('');
    try {
      const resp = await supabase.functions.invoke('justcall-search', {
        body: { call_sid: sid },
      });
      if (resp.error) throw new Error(resp.error.message || 'Search failed');
      setDebugResult(JSON.stringify(resp.data, null, 2));
    } catch (e: any) {
      setDebugResult(JSON.stringify({ success: false, error: e?.message || 'Search failed' }, null, 2));
      toast.error(e?.message || 'Search failed');
    } finally {
      setDebugging(false);
    }
  };

  return (
    <ConfigureModal
      open={open}
      onOpenChange={onOpenChange}
      integrationId="justcall"
      integrationName="JustCall"
      connectedAt={status?.integration?.created_at}
      fallbackIcon={<PhoneCall className="w-6 h-6 text-emerald-500" />}
      showFooter={false}
    >
      <ConfigSection title="Connection">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Status:{' '}
              <span className="font-semibold">
                {loading ? 'Loading…' : status?.connected ? 'Connected' : 'Not connected'}
              </span>
            </div>
            {status?.connected ? (
              <Badge className="bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-500/30">
                Active
              </Badge>
            ) : (
              <Badge className="bg-gray-100/80 dark:bg-gray-800/50 text-gray-700 dark:text-gray-200 border-gray-200/50 dark:border-gray-700/30">
                Inactive
              </Badge>
            )}
          </div>

          {status?.integration?.auth_type && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Auth: <span className="font-medium">API key</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSync}
              disabled={!canManage || syncing}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              Sync
            </Button>
            <ProcessMapButton
              processType="integration"
              processName="justcall"
              variant="outline"
              size="sm"
              showLabel={false}
            />
          </div>

          {!canManage && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Only org owners/admins can configure JustCall.
            </div>
          )}
        </div>
      </ConfigSection>

      <ConfigSection title="Webhook">
        <div className="space-y-3">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Set this URL in JustCall webhooks to keep calls up to date in real-time.
          </div>
          {webhookUrl ? (
            <div className="flex items-center gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={copyWebhook} className="gap-2">
                <Copy className="w-4 h-4" />
                Copy
              </Button>
            </div>
          ) : (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Save API credentials to generate your webhook URL.
            </div>
          )}
        </div>
      </ConfigSection>

      <ConfigSection title="API Key">
        <div className="space-y-3">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            JustCall does not support OAuth. Configure an API key/secret for this org.
          </div>

          <div className="space-y-2">
            <Label htmlFor="justcall_api_key">API Key</Label>
            <Input
              id="justcall_api_key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste JustCall API key"
              disabled={!canManage}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="justcall_api_secret">API Secret (optional)</Label>
            <Input
              id="justcall_api_secret"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="Paste JustCall API secret"
              disabled={!canManage}
              type="password"
            />
          </div>

          <Button
            type="button"
            onClick={handleSaveApiKey}
            disabled={!canManage || saving || !apiKey.trim()}
            className="gap-2"
          >
            <KeyRound className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save API credentials'}
          </Button>
        </div>
      </ConfigSection>

      <DangerZone
        title="Disconnect"
        description="Disables JustCall for this organization and clears stored credentials."
        confirmText="Disconnect JustCall"
        confirmVariant="destructive"
        onConfirm={handleDisconnect}
        confirmDisabled={!canManage || disconnecting}
        icon={<Link2Off className="w-4 h-4" />}
      />

      {canManage ? (
        <ConfigSection title="Debug: find a call by SID">
          <div className="space-y-3">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Paste a JustCall/Sales Dialer <span className="font-mono">Call SID</span> (e.g. <span className="font-mono">CA…</span>) to confirm the API can see it.
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={debugCallSid}
                onChange={(e) => setDebugCallSid(e.target.value)}
                placeholder="CA2bbf0812c3e64d430dd98e66d350118e"
                className="font-mono text-xs"
              />
              <Button type="button" variant="outline" onClick={handleDebugSearch} disabled={debugging || !debugCallSid.trim()}>
                {debugging ? 'Searching…' : 'Search'}
              </Button>
            </div>
            {debugResult ? (
              <pre className="max-h-64 overflow-auto rounded-lg border border-slate-200/70 dark:border-white/10 bg-slate-950/5 dark:bg-black/20 p-3 text-xs text-slate-800 dark:text-slate-200">
                {debugResult}
              </pre>
            ) : null}
          </div>
        </ConfigSection>
      ) : null}
    </ConfigureModal>
  );
}













