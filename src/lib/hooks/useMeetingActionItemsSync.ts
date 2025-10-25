/**
 * React Hook for Meeting Action Items to Tasks Sync
 *
 * Provides convenient methods and state management for syncing
 * Fathom meeting action items with CRM tasks.
 */

import { useState, useEffect, useCallback } from 'react';
import MeetingActionItemsSyncService, {
  MeetingActionItem,
  ActionItemSyncResult,
  MeetingSyncResult
} from '../services/meetingActionItemsSyncService';

interface UseMeetingActionItemsSyncOptions {
  meetingId?: string;
  autoFetch?: boolean;
}

export function useMeetingActionItemsSync(options?: UseMeetingActionItemsSyncOptions) {
  const { meetingId, autoFetch = true } = options || {};

  const [actionItems, setActionItems] = useState<MeetingActionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch action items for the meeting
   */
  const fetchActionItems = useCallback(async () => {
    if (!meetingId) return;

    setLoading(true);
    setError(null);

    try {
      const items = await MeetingActionItemsSyncService.getActionItemsWithTasks(meetingId);
      setActionItems(items);
    } catch (err) {
      console.error('Error fetching action items:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  /**
   * Sync a single action item to create a task
   */
  const syncActionItem = useCallback(async (actionItemId: string): Promise<ActionItemSyncResult> => {
    setSyncing(true);
    setError(null);

    try {
      const result = await MeetingActionItemsSyncService.syncActionItemToTask(actionItemId);

      // Refresh action items to show updated sync status
      if (meetingId) {
        await fetchActionItems();
      }

      return result;
    } catch (err) {
      console.error('Error syncing action item:', err);
      setError(err as Error);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    } finally {
      setSyncing(false);
    }
  }, [meetingId, fetchActionItems]);

  /**
   * Sync all action items for the meeting
   */
  const syncAllActionItems = useCallback(async (): Promise<MeetingSyncResult> => {
    if (!meetingId) {
      return {
        success: false,
        error: 'No meeting ID provided',
        synced: 0,
        failed: 0,
        excluded: 0,
        already_synced: 0
      };
    }

    setSyncing(true);
    setError(null);

    try {
      const result = await MeetingActionItemsSyncService.syncMeetingActionItems(meetingId);

      // Refresh action items to show updated sync status
      await fetchActionItems();

      return result;
    } catch (err) {
      console.error('Error syncing meeting action items:', err);
      setError(err as Error);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        synced: 0,
        failed: 0,
        excluded: 0,
        already_synced: 0
      };
    } finally {
      setSyncing(false);
    }
  }, [meetingId, fetchActionItems]);

  /**
   * Update action item completion status
   */
  const toggleActionItemCompletion = useCallback(async (actionItemId: string, completed: boolean) => {
    setError(null);

    try {
      await MeetingActionItemsSyncService.updateActionItemCompletion(actionItemId, completed);

      // Update local state immediately for responsive UI
      setActionItems(prev =>
        prev.map(item =>
          item.id === actionItemId ? { ...item, completed } : item
        )
      );
    } catch (err) {
      console.error('Error updating action item completion:', err);
      setError(err as Error);
      // Revert local state on error
      setActionItems(prev =>
        prev.map(item =>
          item.id === actionItemId ? { ...item, completed: !completed } : item
        )
      );
    }
  }, []);

  /**
   * Get sync statistics for the meeting
   */
  const getSyncStats = useCallback(() => {
    const stats = {
      total: actionItems.length,
      synced: actionItems.filter(item => item.sync_status === 'synced').length,
      pending: actionItems.filter(item => item.sync_status === 'pending').length,
      failed: actionItems.filter(item => item.sync_status === 'failed').length,
      excluded: actionItems.filter(item => item.sync_status === 'excluded').length,
      completed: actionItems.filter(item => item.completed).length
    };

    return stats;
  }, [actionItems]);

  /**
   * Filter action items by sales rep (internal) vs prospect (external)
   */
  const getFilteredActionItems = useCallback(() => {
    const salesRepItems = actionItems.filter(
      item => item.sync_status !== 'excluded'
    );

    const prospectItems = actionItems.filter(
      item => item.sync_status === 'excluded'
    );

    return {
      salesRepItems,
      prospectItems,
      allItems: actionItems
    };
  }, [actionItems]);

  /**
   * Retry failed syncs
   */
  const retryFailedSyncs = useCallback(async () => {
    if (!meetingId) return;

    setSyncing(true);
    setError(null);

    try {
      const result = await MeetingActionItemsSyncService.retryFailedSyncs(meetingId);

      // Refresh action items
      await fetchActionItems();

      return result;
    } catch (err) {
      console.error('Error retrying failed syncs:', err);
      setError(err as Error);
      return { retried: 0, succeeded: 0, failed: 0 };
    } finally {
      setSyncing(false);
    }
  }, [meetingId, fetchActionItems]);

  /**
   * Subscribe to real-time action item updates
   */
  useEffect(() => {
    if (!meetingId) return;

    const subscription = MeetingActionItemsSyncService.subscribeToActionItems(
      meetingId,
      (payload) => {
        console.log('Action item updated:', payload);
        // Refresh action items when changes occur
        fetchActionItems();
      }
    );

    return () => {
      MeetingActionItemsSyncService.unsubscribeFromActionItems(subscription);
    };
  }, [meetingId, fetchActionItems]);

  /**
   * Auto-fetch on mount if enabled
   */
  useEffect(() => {
    if (autoFetch && meetingId) {
      fetchActionItems();
    }
  }, [autoFetch, meetingId, fetchActionItems]);

  return {
    // State
    actionItems,
    loading,
    syncing,
    error,

    // Actions
    fetchActionItems,
    syncActionItem,
    syncAllActionItems,
    toggleActionItemCompletion,
    retryFailedSyncs,

    // Computed values
    syncStats: getSyncStats(),
    filteredItems: getFilteredActionItems()
  };
}

export default useMeetingActionItemsSync;
