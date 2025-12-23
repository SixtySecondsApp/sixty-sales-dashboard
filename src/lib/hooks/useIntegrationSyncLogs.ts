/**
 * useIntegrationSyncLogs
 *
 * Hook for fetching and subscribing to real-time integration sync logs.
 * Used in the Integrations Dashboard Logs tab to show item-by-item sync activity.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/clientV2';
import { useOrgStore } from '@/lib/stores/orgStore';
import { useAuth } from '@/lib/contexts/AuthContext';

// Types
export type IntegrationName =
  | 'hubspot'
  | 'fathom'
  | 'google_calendar'
  | 'google_tasks'
  | 'savvycal'
  | 'slack';

export type SyncOperation =
  | 'sync'
  | 'create'
  | 'update'
  | 'delete'
  | 'push'
  | 'pull'
  | 'webhook'
  | 'error';

export type SyncDirection = 'inbound' | 'outbound';

export type SyncStatus = 'pending' | 'success' | 'failed' | 'skipped';

export interface IntegrationSyncLog {
  id: string;
  org_id: string | null;
  user_id: string | null;
  integration_name: IntegrationName;
  operation: SyncOperation;
  direction: SyncDirection | null;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  status: SyncStatus;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  batch_id: string | null;
}

export interface SyncLogFilters {
  integration?: IntegrationName | 'all';
  status?: SyncStatus | 'all';
  entityType?: string | 'all';
  timeRange?: 'hour' | 'day' | 'week' | 'all';
}

export interface UseIntegrationSyncLogsOptions {
  filters?: SyncLogFilters;
  pageSize?: number;
  enabled?: boolean;
}

export interface UseIntegrationSyncLogsResult {
  logs: IntegrationSyncLog[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: Error | null;
  hasMore: boolean;
  isLive: boolean;
  newLogsCount: number;

  // Actions
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  setIsLive: (live: boolean) => void;
  clearNewLogs: () => void;
}

const DEFAULT_PAGE_SIZE = 50;

/**
 * Main hook for integration sync logs
 */
export function useIntegrationSyncLogs(
  options: UseIntegrationSyncLogsOptions = {}
): UseIntegrationSyncLogsResult {
  const { filters = {}, pageSize = DEFAULT_PAGE_SIZE, enabled = true } = options;

  const activeOrgId = useOrgStore((s) => s.activeOrgId);
  const { user } = useAuth();

  // State
  const [logs, setLogs] = useState<IntegrationSyncLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [newLogsCount, setNewLogsCount] = useState(0);

  // Refs for real-time
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pendingLogsRef = useRef<IntegrationSyncLog[]>([]);

  // Build the time filter
  const getTimeFilter = useCallback(() => {
    const now = new Date();
    switch (filters.timeRange) {
      case 'hour':
        return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return null;
    }
  }, [filters.timeRange]);

  // Fetch logs from database
  const fetchLogs = useCallback(
    async (cursor?: string) => {
      if (!enabled) return;

      try {
        let query = supabase
          .from('integration_sync_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(pageSize);

        // Apply org filter if available
        if (activeOrgId) {
          query = query.or(`org_id.eq.${activeOrgId},user_id.eq.${user?.id}`);
        } else if (user?.id) {
          query = query.eq('user_id', user.id);
        }

        // Apply integration filter
        if (filters.integration && filters.integration !== 'all') {
          query = query.eq('integration_name', filters.integration);
        }

        // Apply status filter
        if (filters.status && filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }

        // Apply entity type filter
        if (filters.entityType && filters.entityType !== 'all') {
          query = query.eq('entity_type', filters.entityType);
        }

        // Apply time filter
        const timeFilter = getTimeFilter();
        if (timeFilter) {
          query = query.gte('created_at', timeFilter);
        }

        // Apply cursor for pagination
        if (cursor) {
          query = query.lt('created_at', cursor);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        return data as IntegrationSyncLog[];
      } catch (err) {
        console.error('[useIntegrationSyncLogs] Fetch error:', err);
        throw err;
      }
    },
    [enabled, activeOrgId, user?.id, filters, pageSize, getTimeFilter]
  );

  // Initial load
  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchLogs();
      setLogs(data || []);
      setHasMore((data?.length || 0) >= pageSize);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load logs'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchLogs, pageSize]);

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || logs.length === 0) return;

    setIsLoadingMore(true);

    try {
      const lastLog = logs[logs.length - 1];
      const data = await fetchLogs(lastLog.created_at);

      if (data && data.length > 0) {
        setLogs((prev) => [...prev, ...data]);
        setHasMore(data.length >= pageSize);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('[useIntegrationSyncLogs] Load more error:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, logs, fetchLogs, pageSize]);

  // Refresh data
  const refresh = useCallback(async () => {
    await loadInitial();
    // Also merge any pending logs
    if (pendingLogsRef.current.length > 0) {
      setLogs((prev) => [...pendingLogsRef.current, ...prev]);
      pendingLogsRef.current = [];
      setNewLogsCount(0);
    }
  }, [loadInitial]);

  // Clear new logs indicator
  const clearNewLogs = useCallback(() => {
    setNewLogsCount(0);
    if (pendingLogsRef.current.length > 0) {
      setLogs((prev) => [...pendingLogsRef.current, ...prev]);
      pendingLogsRef.current = [];
    }
  }, []);

  // Handle incoming real-time log
  const handleNewLog = useCallback(
    (payload: { new: IntegrationSyncLog }) => {
      const newLog = payload.new;

      // Check if log matches current filters
      if (filters.integration && filters.integration !== 'all') {
        if (newLog.integration_name !== filters.integration) return;
      }
      if (filters.status && filters.status !== 'all') {
        if (newLog.status !== filters.status) return;
      }
      if (filters.entityType && filters.entityType !== 'all') {
        if (newLog.entity_type !== filters.entityType) return;
      }

      if (isLive) {
        // Add to logs immediately
        setLogs((prev) => {
          // Avoid duplicates
          if (prev.some((log) => log.id === newLog.id)) return prev;
          return [newLog, ...prev];
        });
      } else {
        // Queue for later
        if (!pendingLogsRef.current.some((log) => log.id === newLog.id)) {
          pendingLogsRef.current.unshift(newLog);
          setNewLogsCount((c) => c + 1);
        }
      }
    },
    [filters, isLive]
  );

  // Set up real-time subscription
  useEffect(() => {
    if (!enabled) return;

    // Build channel name based on context
    const channelName = activeOrgId
      ? `sync-logs-org-${activeOrgId}`
      : `sync-logs-user-${user?.id}`;

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create new channel with filter
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'integration_sync_logs',
          // Note: Supabase filters have limitations, so we filter in handleNewLog
        },
        handleNewLog
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useIntegrationSyncLogs] Subscribed to real-time updates');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, activeOrgId, user?.id, handleNewLog]);

  // Initial load and reload on filter changes
  useEffect(() => {
    if (enabled) {
      loadInitial();
    }
  }, [enabled, loadInitial]);

  // Clear pending logs when going live
  useEffect(() => {
    if (isLive && pendingLogsRef.current.length > 0) {
      setLogs((prev) => [...pendingLogsRef.current, ...prev]);
      pendingLogsRef.current = [];
      setNewLogsCount(0);
    }
  }, [isLive]);

  return {
    logs,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    isLive,
    newLogsCount,
    loadMore,
    refresh,
    setIsLive,
    clearNewLogs,
  };
}

/**
 * Hook to get distinct entity types from logs (for filter dropdown)
 */
export function useLogEntityTypes(): string[] {
  const [entityTypes, setEntityTypes] = useState<string[]>([]);

  useEffect(() => {
    const fetchEntityTypes = async () => {
      const { data, error } = await supabase
        .from('integration_sync_logs')
        .select('entity_type')
        .limit(1000);

      if (!error && data) {
        const unique = [...new Set(data.map((d) => d.entity_type))].sort();
        setEntityTypes(unique);
      }
    };

    fetchEntityTypes();
  }, []);

  return entityTypes;
}

/**
 * Integration display metadata
 */
export const INTEGRATION_DISPLAY: Record<
  IntegrationName,
  { label: string; color: string; icon: string }
> = {
  hubspot: { label: 'HubSpot', color: 'orange', icon: 'Users' },
  fathom: { label: 'Fathom', color: 'purple', icon: 'Video' },
  google_calendar: { label: 'Google Calendar', color: 'blue', icon: 'Calendar' },
  google_tasks: { label: 'Google Tasks', color: 'blue', icon: 'CheckSquare' },
  savvycal: { label: 'SavvyCal', color: 'cyan', icon: 'CalendarCheck' },
  slack: { label: 'Slack', color: 'purple', icon: 'MessageSquare' },
};

/**
 * Status display metadata
 */
export const STATUS_DISPLAY: Record<
  SyncStatus,
  { label: string; color: string; bgClass: string; textClass: string }
> = {
  pending: {
    label: 'Pending',
    color: 'gray',
    bgClass: 'bg-gray-500/10',
    textClass: 'text-gray-500',
  },
  success: {
    label: 'Success',
    color: 'green',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-500',
  },
  failed: {
    label: 'Failed',
    color: 'red',
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-500',
  },
  skipped: {
    label: 'Skipped',
    color: 'yellow',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-500',
  },
};

/**
 * Operation display metadata
 */
export const OPERATION_DISPLAY: Record<
  SyncOperation,
  { label: string; verb: string }
> = {
  sync: { label: 'Synced', verb: 'syncing' },
  create: { label: 'Created', verb: 'creating' },
  update: { label: 'Updated', verb: 'updating' },
  delete: { label: 'Deleted', verb: 'deleting' },
  push: { label: 'Pushed', verb: 'pushing' },
  pull: { label: 'Pulled', verb: 'pulling' },
  webhook: { label: 'Webhook', verb: 'processing webhook' },
  error: { label: 'Error', verb: 'error' },
};
