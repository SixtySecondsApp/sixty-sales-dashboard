import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useOrgStore } from '@/lib/stores/orgStore';
import { toast } from 'sonner';

export interface SavvyCalIntegrationStatus {
  connected: boolean;
  integration?: {
    id: string;
    org_id: string;
    is_active: boolean;
    webhook_token: string | null;
    webhook_url: string | null;
    webhook_configured_at: string | null;
    webhook_last_received_at: string | null;
    webhook_last_event_id: string | null;
    last_sync_at: string | null;
    connected_by_user_id: string | null;
    created_at: string;
    updated_at: string;
  };
  secrets_summary?: {
    has_api_token: boolean;
    has_webhook_secret: boolean;
  };
}

export interface WebhookCheckResult {
  webhook_configured: boolean;
  webhooks: Array<{ id: string; url: string; events: string[] }>;
}

export function useSavvyCalIntegration() {
  const { user, isAuthenticated } = useAuth();
  const activeOrgId = useOrgStore((s) => s.activeOrgId);
  const activeOrgRole = useOrgStore((s) => s.activeOrgRole);
  const canManage = activeOrgRole === 'owner' || activeOrgRole === 'admin';

  const [status, setStatus] = useState<SavvyCalIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const isEdgeFunctionUnavailable = (e: any) => {
    const msg = String(e?.message || '').toLowerCase();
    const statusCode = Number(e?.status || e?.statusCode || e?.context?.status || 0);
    return (
      statusCode === 404 ||
      msg.includes('failed to send a request to the edge function') ||
      (msg.includes('edge function') && msg.includes('failed to send')) ||
      msg.includes('not found')
    );
  };

  const refreshStatus = useCallback(async () => {
    try {
      if (!isAuthenticated || !user || !activeOrgId) {
        setStatus(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const resp = await supabase.functions.invoke('savvycal-config', {
        body: { action: 'status', org_id: activeOrgId },
      });

      if (resp.error) throw new Error(resp.error.message || 'Failed to load SavvyCal status');
      setStatus(resp.data as SavvyCalIntegrationStatus);
    } catch (e: any) {
      if (isEdgeFunctionUnavailable(e)) {
        setStatus(null);
      } else {
        console.error('[useSavvyCalIntegration] status error:', e);
        setStatus(null);
      }
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, isAuthenticated, user]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const connectApiToken = useCallback(
    async (apiToken: string, webhookSecret?: string) => {
      if (!activeOrgId) throw new Error('No active organization selected');
      if (!canManage) throw new Error('Only organization owners/admins can configure SavvyCal');
      if (!isAuthenticated) throw new Error('Please sign in to configure SavvyCal');

      const resp = await supabase.functions.invoke('savvycal-config', {
        body: {
          action: 'connect_api_token',
          org_id: activeOrgId,
          api_token: apiToken,
          webhook_secret: webhookSecret || '',
        },
      });

      if (resp.error) throw new Error(resp.error.message || 'Failed to save SavvyCal API token');
      
      const data = resp.data;
      if (data?.error) throw new Error(data.error);
      
      toast.success('SavvyCal configured successfully');
      await refreshStatus();
      return data;
    },
    [activeOrgId, canManage, isAuthenticated, refreshStatus]
  );

  const disconnect = useCallback(async () => {
    if (!activeOrgId) throw new Error('No active organization selected');
    if (!canManage) throw new Error('Only organization owners/admins can disconnect SavvyCal');
    if (!isAuthenticated) throw new Error('Please sign in to disconnect SavvyCal');

    const resp = await supabase.functions.invoke('savvycal-config', {
      body: { action: 'disconnect', org_id: activeOrgId },
    });

    if (resp.error) throw new Error(resp.error.message || 'Failed to disconnect SavvyCal');
    toast.success('SavvyCal disconnected');
    await refreshStatus();
  }, [activeOrgId, canManage, isAuthenticated, refreshStatus]);

  const updateWebhookSecret = useCallback(
    async (webhookSecret: string) => {
      if (!activeOrgId) throw new Error('No active organization selected');
      if (!canManage) throw new Error('Only organization owners/admins can update webhook secret');
      if (!isAuthenticated) throw new Error('Please sign in to update webhook secret');

      const resp = await supabase.functions.invoke('savvycal-config', {
        body: {
          action: 'update_webhook_secret',
          org_id: activeOrgId,
          webhook_secret: webhookSecret,
        },
      });

      if (resp.error) throw new Error(resp.error.message || 'Failed to update webhook secret');

      const data = resp.data;
      if (data?.error) throw new Error(data.error);

      toast.success('Webhook secret updated');
      await refreshStatus();
      return data;
    },
    [activeOrgId, canManage, isAuthenticated, refreshStatus]
  );

  const checkWebhook = useCallback(async (): Promise<WebhookCheckResult | null> => {
    if (!activeOrgId) throw new Error('No active organization selected');
    if (!canManage) throw new Error('Only organization owners/admins can check webhook');

    setChecking(true);
    try {
      const resp = await supabase.functions.invoke('savvycal-config', {
        body: { action: 'check_webhook', org_id: activeOrgId },
      });

      if (resp.error) throw new Error(resp.error.message || 'Failed to check webhook');
      
      const data = resp.data as WebhookCheckResult;
      if (data?.webhook_configured) {
        toast.success('Webhook verified! SavvyCal is sending events to your organization.');
        await refreshStatus();
      } else {
        toast.warning('Webhook not found. Please add the webhook URL in SavvyCal settings.');
      }
      return data;
    } finally {
      setChecking(false);
    }
  }, [activeOrgId, canManage, refreshStatus]);

  const triggerSync = useCallback(
    async (sinceHours: number = 24) => {
      if (!activeOrgId) throw new Error('No active organization selected');
      if (!canManage) throw new Error('Only organization owners/admins can sync SavvyCal');

      setSyncing(true);
      try {
        const resp = await supabase.functions.invoke('savvycal-config', {
          body: { action: 'trigger_sync', org_id: activeOrgId, since_hours: sinceHours },
        });

        if (resp.error) throw new Error(resp.error.message || 'SavvyCal sync failed');
        
        const result = resp.data;
        if (result?.stats) {
          const { totalSynced, totalNew } = result.stats;
          if (totalNew === 0) {
            toast.info('No new events to sync');
          } else {
            toast.success(`Synced ${totalSynced} of ${totalNew} new events`);
          }
        } else {
          toast.success('SavvyCal sync completed');
        }
        await refreshStatus();
        return result;
      } finally {
        setSyncing(false);
      }
    },
    [activeOrgId, canManage, refreshStatus]
  );

  // Compute webhook URL from origin
  const getWebhookUrl = useCallback(() => {
    if (!status?.integration?.webhook_token) return null;
    
    // Prefer PUBLIC_URL env var, fallback to window.location.origin
    const origin = typeof window !== 'undefined' 
      ? (import.meta.env.VITE_PUBLIC_URL || window.location.origin)
      : '';
    
    return `${origin}/api/webhooks/savvycal?token=${encodeURIComponent(status.integration.webhook_token)}`;
  }, [status?.integration?.webhook_token]);

  return {
    status,
    isConnected: Boolean(status?.connected),
    hasApiToken: Boolean(status?.secrets_summary?.has_api_token),
    hasWebhookSecret: Boolean(status?.secrets_summary?.has_webhook_secret),
    webhookUrl: status?.integration?.webhook_url || getWebhookUrl(),
    webhookVerified: Boolean(status?.integration?.webhook_configured_at),
    webhookLastReceived: status?.integration?.webhook_last_received_at,
    lastSyncAt: status?.integration?.last_sync_at,
    canManage,
    loading,
    checking,
    syncing,
    refreshStatus,
    connectApiToken,
    disconnect,
    updateWebhookSecret,
    checkWebhook,
    triggerSync,
  };
}









