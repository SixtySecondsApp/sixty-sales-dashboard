import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useOrgStore } from '@/lib/stores/orgStore';
import { toast } from 'sonner';

export interface FathomOrgIntegration {
  id: string;
  org_id: string;
  connected_by_user_id: string | null;
  fathom_user_id: string | null;
  fathom_user_email: string | null;
  scopes: string[];
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FathomOrgSyncState {
  id: string;
  org_id: string;
  integration_id: string;
  sync_status: 'idle' | 'syncing' | 'error';
  meetings_synced: number;
  total_meetings_found: number;
  last_sync_started_at: string | null;
  last_sync_completed_at: string | null;
  cursor_position: string | null;
  error_message: string | null;
}

export function useFathomIntegration() {
  const { user } = useAuth();
  const activeOrgId = useOrgStore((s) => s.activeOrgId);
  const activeOrgRole = useOrgStore((s) => s.activeOrgRole);
  const canManage = activeOrgRole === 'owner' || activeOrgRole === 'admin';

  const [integration, setIntegration] = useState<FathomOrgIntegration | null>(null);
  const [syncState, setSyncState] = useState<FathomOrgSyncState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lifetimeMeetingsCount, setLifetimeMeetingsCount] = useState<number>(0);
  const [syncInProgress, setSyncInProgress] = useState(false); // Track local sync operation

  // Fetch integration and sync state
  useEffect(() => {
    if (!user || !activeOrgId) {
      setIntegration(null);
      setSyncState(null);
      setLifetimeMeetingsCount(0);
      setLoading(false);
      return;
    }

    const fetchIntegration = async () => {
      try {
        setLoading(true);
        setError(null);
        // Get active org integration
        const { data: integrationData, error: integrationError } = await supabase
          .from('fathom_org_integrations')
          .select('*')
          .eq('org_id', activeOrgId)
          .eq('is_active', true)
          .maybeSingle();
        if (integrationError) {
          throw integrationError;
        }

        setIntegration(integrationData);

        // Get sync state if integration exists
        if (integrationData) {
          const { data: syncData, error: syncError } = await supabase
            .from('fathom_org_sync_state')
            .select('*')
            .eq('org_id', activeOrgId)
            .maybeSingle();

          if (syncError) {
            throw syncError;
          }

          setSyncState(syncData);

          // Compute lifetime count of org Fathom meetings
          const { count, error: countError } = await supabase
            .from('meetings')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', activeOrgId)
            .not('fathom_recording_id', 'is', null);
          if (!countError && typeof count === 'number') {
            setLifetimeMeetingsCount(count);
          }
        } else {
          setSyncState(null);
          setLifetimeMeetingsCount(0);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchIntegration();

    // Subscribe to real-time updates
    const integrationSubscription = supabase
      .channel('fathom_integrations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fathom_org_integrations',
          filter: `org_id=eq.${activeOrgId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setIntegration(null);
          } else {
            setIntegration(payload.new as FathomOrgIntegration);
          }
        }
      )
      .subscribe();

    const syncSubscription = supabase
      .channel('fathom_sync_state_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fathom_org_sync_state',
          filter: `org_id=eq.${activeOrgId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setSyncState(null);
          } else {
            setSyncState(payload.new as FathomOrgSyncState);
          }
        }
      )
      .subscribe();

    // Listen for new meetings to refresh lifetime count
    const meetingsSubscription = supabase
      .channel('meetings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meetings',
          filter: `org_id=eq.${activeOrgId}`,
        },
        async () => {
          const { count } = await supabase
            .from('meetings')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', activeOrgId)
            .not('fathom_recording_id', 'is', null);
          if (typeof count === 'number') setLifetimeMeetingsCount(count);
        }
      )
      .subscribe();

    return () => {
      integrationSubscription.unsubscribe();
      syncSubscription.unsubscribe();
      meetingsSubscription.unsubscribe();
    };
  }, [user, activeOrgId]);

  // Initiate OAuth flow
  const connectFathom = async (): Promise<boolean> => {
    try {
      setError(null);

      if (!activeOrgId) {
        throw new Error('No active organization selected');
      }
      if (!canManage) {
        throw new Error('Only organization owners/admins can connect Fathom');
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error('No active session');
      }

      const response = await supabase.functions.invoke('fathom-oauth-initiate', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: { org_id: activeOrgId },
      });

      if (response.error) {
        // Supabase Functions errors often hide the underlying JSON body for non-2xx responses.
        // Try to extract the response body for a human-readable message.
        const err: any = response.error;
        let message: string = err?.message || 'Failed to initiate OAuth';

        try {
          const resp = err?.context?.response as Response | undefined;
          if (resp) {
            const text = await resp.text();
            if (text) {
              try {
                const parsed = JSON.parse(text);
                message =
                  parsed?.message ||
                  parsed?.error ||
                  parsed?.details ||
                  message;
              } catch {
                // Not JSON
                message = text;
              }
            }
          }
        } catch {
          // ignore extraction errors
        }

        throw new Error(message);
      }

      const { authorization_url } = response.data;
      if (!authorization_url) throw new Error('Missing authorization_url from OAuth initiation');

      // Open OAuth popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authorization_url,
        'Fathom OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Listen for OAuth completion
      const handleMessage = async (event: MessageEvent) => {
        // Security: only accept messages from our own origin
        if (event.origin !== window.location.origin) return;
        // Security: only accept messages from the OAuth popup window
        if (popup && event.source !== popup) return;

        if (event.data?.type === 'fathom-oauth-success') {
          popup?.close();
          window.removeEventListener('message', handleMessage);

          // Show success notification
          toast.success('Fathom Connected!', {
            description: 'Your Fathom account has been successfully connected. Starting initial sync...'
          });

          // Refresh integration data
          try {
            const { data: integrationData } = await supabase
              .from('fathom_org_integrations')
              .select('*')
              .eq('org_id', activeOrgId)
              .eq('is_active', true)
              .maybeSingle();

            setIntegration(integrationData);

            // Get sync state
            const { data: syncData } = await supabase
              .from('fathom_org_sync_state')
              .select('*')
              .eq('org_id', activeOrgId)
              .maybeSingle();

            setSyncState(syncData);
          } catch (err) {
          }
        }
      };

      window.addEventListener('message', handleMessage);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect';
      setError(msg);
      toast.error(msg);
      return false;
    }
  };

  // Disconnect Fathom
  const disconnectFathom = async (deleteSyncedMeetings: boolean = false) => {
    try {
      setError(null);

      if (!integration) {
        throw new Error('No integration to disconnect');
      }
      if (!activeOrgId) {
        throw new Error('No active organization selected');
      }
      if (!canManage) {
        throw new Error('Only organization owners/admins can disconnect Fathom');
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error('No active session');
      }

      const response = await supabase.functions.invoke('fathom-disconnect', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: {
          org_id: activeOrgId,
          delete_synced_meetings: deleteSyncedMeetings,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to disconnect');
      }

      setIntegration(null);
      setSyncState(null);
      setLifetimeMeetingsCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  // Trigger manual sync
  const triggerSync = async (params?: {
    sync_type?: 'initial' | 'incremental' | 'manual' | 'onboarding_fast' | 'onboarding_background';
    start_date?: string;
    end_date?: string;
    limit?: number; // Optional limit for test syncs
    is_onboarding?: boolean; // Mark as onboarding sync (historical imports)
  }): Promise<{
    success: boolean;
    meetings_synced?: number;
    total_meetings_found?: number;
    upgrade_required?: boolean;
    limit_warning?: string;
    limits?: {
      is_free_tier: boolean;
      used: number;
      max: number;
      remaining: number;
      historical: number;
    };
    error?: string;
  } | null> => {
    try {
      setError(null);
      setSyncInProgress(true); // Immediately show syncing state in UI
      console.log('[useFathomIntegration] triggerSync called with params:', params);

      if (!integration) {
        console.error('[useFathomIntegration] No active integration');
        throw new Error('No active integration');
      }
      console.log('[useFathomIntegration] Integration found:', integration.id);

      if (!activeOrgId) {
        throw new Error('No active organization selected');
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        console.error('[useFathomIntegration] No active session:', sessionError);
        throw new Error('No active session');
      }
      console.log('[useFathomIntegration] Session valid, invoking fathom-sync...');

      const response = await supabase.functions.invoke('fathom-sync', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: {
          org_id: activeOrgId,
          sync_type: params?.sync_type || 'manual',
          start_date: params?.start_date,
          end_date: params?.end_date,
          limit: params?.limit, // Pass limit to Edge Function
          is_onboarding: params?.is_onboarding, // Mark as onboarding sync
        },
      });

      // Check for upgrade required response (402)
      if (response.data?.upgrade_required) {
        console.log('[useFathomIntegration] Upgrade required:', response.data);
        setSyncInProgress(false);
        return response.data;
      }

      console.log('[useFathomIntegration] Edge function response:', {
        error: response.error,
        data: response.data,
      });

      if (response.error) {
        console.error('[useFathomIntegration] Edge function returned error:', response.error);
        throw new Error(response.error.message || 'Sync failed');
      }

      // Log detailed sync results
      const syncResult = response.data;
      console.log('[useFathomIntegration] Sync result details:', {
        success: syncResult?.success,
        sync_type: syncResult?.sync_type,
        meetings_synced: syncResult?.meetings_synced,
        total_meetings_found: syncResult?.total_meetings_found,
        errors: syncResult?.errors,
      });

      // Refresh lifetime count after sync completes
      const { count, error: countError } = await supabase
        .from('meetings')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', activeOrgId)
        .not('fathom_recording_id', 'is', null);

      console.log('[useFathomIntegration] Count query result:', { count, countError });

      if (typeof count === 'number') {
        console.log('[useFathomIntegration] Updated lifetime count:', count);
        setLifetimeMeetingsCount(count);
      }

      console.log('[useFathomIntegration] Returning response.data:', response.data);
      return response.data;
    } catch (err) {
      console.error('[useFathomIntegration] triggerSync error:', err);
      setError(err instanceof Error ? err.message : 'Sync failed');
      throw err;
    } finally {
      setSyncInProgress(false); // Always reset sync state when operation completes
    }
  };

  return {
    integration,
    syncState,
    loading,
    error,
    isConnected: !!integration,
    canManage,
    // Combine local sync state (immediate feedback) with database sync state
    isSyncing: syncInProgress || syncState?.sync_status === 'syncing',
    syncInProgress, // Expose for components that need to differentiate
    lifetimeMeetingsCount,
    connectFathom,
    disconnectFathom,
    triggerSync,
  };
}
