import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuth } from '@/lib/contexts/AuthContext';

export interface FathomIntegration {
  id: string;
  user_id: string;
  fathom_user_id: string | null;
  fathom_user_email: string | null;
  scopes: string[];
  is_active: boolean;
  token_expires_at: string;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FathomSyncState {
  id: string;
  user_id: string;
  integration_id: string;
  sync_status: 'idle' | 'syncing' | 'error';
  meetings_synced: number;
  total_meetings_found: number;
  last_sync_started_at: string | null;
  last_sync_completed_at: string | null;
  last_sync_error: string | null;
  cursor_position: string | null;
}

export function useFathomIntegration() {
  const { user } = useAuth();
  const [integration, setIntegration] = useState<FathomIntegration | null>(null);
  const [syncState, setSyncState] = useState<FathomSyncState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch integration and sync state
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchIntegration = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get active integration
        const { data: integrationData, error: integrationError } = await supabase
          .from('fathom_integrations')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (integrationError && integrationError.code !== 'PGRST116') {
          throw integrationError;
        }

        setIntegration(integrationData);

        // Get sync state if integration exists
        if (integrationData) {
          const { data: syncData, error: syncError } = await supabase
            .from('fathom_sync_state')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (syncError && syncError.code !== 'PGRST116') {
            throw syncError;
          }

          setSyncState(syncData);
        }
      } catch (err) {
        console.error('Error fetching Fathom integration:', err);
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
          table: 'fathom_integrations',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Integration changed:', payload);
          if (payload.eventType === 'DELETE') {
            setIntegration(null);
          } else {
            setIntegration(payload.new as FathomIntegration);
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
          table: 'fathom_sync_state',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Sync state changed:', payload);
          if (payload.eventType === 'DELETE') {
            setSyncState(null);
          } else {
            setSyncState(payload.new as FathomSyncState);
          }
        }
      )
      .subscribe();

    return () => {
      integrationSubscription.unsubscribe();
      syncSubscription.unsubscribe();
    };
  }, [user]);

  // Initiate OAuth flow
  const connectFathom = async () => {
    try {
      setError(null);

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error('No active session');
      }

      const response = await supabase.functions.invoke('fathom-oauth-initiate', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to initiate OAuth');
      }

      const { authorization_url } = response.data;

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
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'fathom-oauth-success') {
          console.log('OAuth success:', event.data);
          popup?.close();
          window.removeEventListener('message', handleMessage);
          // Refresh integration data
          window.location.reload();
        }
      };

      window.addEventListener('message', handleMessage);
    } catch (err) {
      console.error('Error connecting Fathom:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  };

  // Disconnect Fathom
  const disconnectFathom = async () => {
    try {
      setError(null);

      if (!integration) {
        throw new Error('No integration to disconnect');
      }

      const { error: deleteError } = await supabase
        .from('fathom_integrations')
        .update({ is_active: false })
        .eq('id', integration.id);

      if (deleteError) {
        throw deleteError;
      }

      setIntegration(null);
      setSyncState(null);
    } catch (err) {
      console.error('Error disconnecting Fathom:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  // Trigger manual sync
  const triggerSync = async (params?: {
    sync_type?: 'initial' | 'incremental' | 'manual';
    start_date?: string;
    end_date?: string;
  }) => {
    try {
      setError(null);

      if (!integration) {
        throw new Error('No active integration');
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error('No active session');
      }

      const response = await supabase.functions.invoke('fathom-sync', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: {
          sync_type: params?.sync_type || 'manual',
          start_date: params?.start_date,
          end_date: params?.end_date,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Sync failed');
      }

      return response.data;
    } catch (err) {
      console.error('Error triggering sync:', err);
      setError(err instanceof Error ? err.message : 'Sync failed');
      throw err;
    }
  };

  return {
    integration,
    syncState,
    loading,
    error,
    isConnected: !!integration,
    isSyncing: syncState?.sync_status === 'syncing',
    connectFathom,
    disconnectFathom,
    triggerSync,
  };
}
