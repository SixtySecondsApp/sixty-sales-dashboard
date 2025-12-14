import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useOrgStore } from '@/lib/stores/orgStore';
import { toast } from 'sonner';

export type JustCallAuthType = 'api_key';

export interface JustCallIntegrationStatus {
  connected: boolean;
  integration?: {
    id: string;
    org_id: string;
    auth_type: JustCallAuthType;
    is_active: boolean;
    webhook_token: string | null;
    token_expires_at: string | null;
    last_sync_at: string | null;
    connected_by_user_id: string | null;
    created_at: string;
    updated_at: string;
  };
  secrets_summary?: {
    has_api_key: boolean;
    has_api_secret: boolean;
  };
}

export function useJustCallIntegration() {
  const { user, isAuthenticated } = useAuth();
  const activeOrgId = useOrgStore((s) => s.activeOrgId);
  const activeOrgRole = useOrgStore((s) => s.activeOrgRole);
  const canManage = activeOrgRole === 'owner' || activeOrgRole === 'admin';

  const [status, setStatus] = useState<JustCallIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const isEdgeFunctionUnavailable = (e: any) => {
    const msg = String(e?.message || '').toLowerCase();
    const statusCode = Number(e?.status || e?.statusCode || e?.context?.status || 0);
    return (
      statusCode === 404 ||
      msg.includes('failed to send a request to the edge function') ||
      msg.includes('edge function') && msg.includes('failed to send') ||
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
      const resp = await supabase.functions.invoke('justcall-config', {
        body: { action: 'status', org_id: activeOrgId },
      });

      if (resp.error) throw new Error(resp.error.message || 'Failed to load JustCall status');
      setStatus(resp.data as JustCallIntegrationStatus);
    } catch (e: any) {
      // If the function isn't deployed/configured yet, treat as "not connected" without spamming logs.
      if (isEdgeFunctionUnavailable(e)) {
        setStatus(null);
      } else {
        console.error('[useJustCallIntegration] status error:', e);
        setStatus(null);
      }
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, isAuthenticated, user]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const connectApiKey = useCallback(
    async (apiKey: string, apiSecret?: string) => {
      if (!activeOrgId) throw new Error('No active organization selected');
      if (!canManage) throw new Error('Only organization owners/admins can configure JustCall');
      if (!isAuthenticated) throw new Error('Please sign in to configure JustCall');

      const resp = await supabase.functions.invoke('justcall-config', {
        body: {
          action: 'connect_api_key',
          org_id: activeOrgId,
          api_key: apiKey,
          api_secret: apiSecret || '',
        },
      });

      if (resp.error) throw new Error(resp.error.message || 'Failed to save JustCall API credentials');
      toast.success('JustCall configured');
      await refreshStatus();
    },
    [activeOrgId, canManage, isAuthenticated, refreshStatus]
  );

  const disconnect = useCallback(async () => {
    if (!activeOrgId) throw new Error('No active organization selected');
    if (!canManage) throw new Error('Only organization owners/admins can disconnect JustCall');
    if (!isAuthenticated) throw new Error('Please sign in to disconnect JustCall');

    const resp = await supabase.functions.invoke('justcall-config', {
      body: { action: 'disconnect', org_id: activeOrgId },
    });

    if (resp.error) throw new Error(resp.error.message || 'Failed to disconnect JustCall');
    toast.success('JustCall disconnected');
    await refreshStatus();
  }, [activeOrgId, canManage, isAuthenticated, refreshStatus]);

  const triggerSync = useCallback(
    async (limit: number = 200) => {
      if (!activeOrgId) throw new Error('No active organization selected');
      if (!canManage) throw new Error('Only organization owners/admins can sync JustCall');

      const resp = await supabase.functions.invoke('justcall-sync', {
        body: { org_id: activeOrgId, sync_type: 'manual', limit },
      });

      if (resp.error) throw new Error(resp.error.message || 'JustCall sync failed');
      toast.success('JustCall sync started');
      await refreshStatus();
      return resp.data;
    },
    [activeOrgId, canManage, refreshStatus]
  );

  return {
    status,
    isConnected: Boolean(status?.connected),
    canManage,
    loading,
    refreshStatus,
    connectApiKey,
    disconnect,
    triggerSync,
  };
}

