import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/clientV2';

export interface BulkEmailActionsOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useBulkEmailActions(options: BulkEmailActionsOptions = {}) {
  const { onSuccess, onError } = options;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPerformingAction, setIsPerformingAction] = useState(false);

  // Selection management
  const selectEmail = useCallback((id: string) => {
    setSelectedIds(prev => new Set(prev).add(id));
  }, []);

  const deselectEmail = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleEmailSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((emailIds: string[]) => {
    setSelectedIds(new Set(emailIds));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: string) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  // Bulk operations
  const bulkArchive = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsPerformingAction(true);
    try {
      const ids = Array.from(selectedIds);

      const { error } = await supabase
        .from('emails')
        .update({ folder: 'archive' })
        .in('id', ids);

      if (error) throw error;

      toast.success(`Archived ${selectedIds.size} email${selectedIds.size !== 1 ? 's' : ''}`);
      deselectAll();
      onSuccess?.();
    } catch (error) {
      const err = error as Error;
      toast.error('Failed to archive emails');
      onError?.(err);
    } finally {
      setIsPerformingAction(false);
    }
  }, [selectedIds, onSuccess, onError, deselectAll]);

  const bulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsPerformingAction(true);
    try {
      const ids = Array.from(selectedIds);

      // Move to trash instead of permanent deletion
      const { error } = await supabase
        .from('emails')
        .update({ folder: 'trash' })
        .in('id', ids);

      if (error) throw error;

      toast.success(`Moved ${selectedIds.size} email${selectedIds.size !== 1 ? 's' : ''} to trash`);
      deselectAll();
      onSuccess?.();
    } catch (error) {
      const err = error as Error;
      toast.error('Failed to delete emails');
      onError?.(err);
    } finally {
      setIsPerformingAction(false);
    }
  }, [selectedIds, onSuccess, onError, deselectAll]);

  const bulkPermanentDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`Permanently delete ${selectedIds.size} email${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) {
      return;
    }

    setIsPerformingAction(true);
    try {
      const ids = Array.from(selectedIds);

      const { error } = await supabase
        .from('emails')
        .delete()
        .in('id', ids);

      if (error) throw error;

      toast.success(`Permanently deleted ${selectedIds.size} email${selectedIds.size !== 1 ? 's' : ''}`);
      deselectAll();
      onSuccess?.();
    } catch (error) {
      const err = error as Error;
      toast.error('Failed to permanently delete emails');
      onError?.(err);
    } finally {
      setIsPerformingAction(false);
    }
  }, [selectedIds, onSuccess, onError, deselectAll]);

  const bulkStar = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsPerformingAction(true);
    try {
      const ids = Array.from(selectedIds);

      const { error } = await supabase
        .from('emails')
        .update({ is_starred: true })
        .in('id', ids);

      if (error) throw error;

      toast.success(`Starred ${selectedIds.size} email${selectedIds.size !== 1 ? 's' : ''}`);
      deselectAll();
      onSuccess?.();
    } catch (error) {
      const err = error as Error;
      toast.error('Failed to star emails');
      onError?.(err);
    } finally {
      setIsPerformingAction(false);
    }
  }, [selectedIds, onSuccess, onError, deselectAll]);

  const bulkUnstar = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsPerformingAction(true);
    try {
      const ids = Array.from(selectedIds);

      const { error } = await supabase
        .from('emails')
        .update({ is_starred: false })
        .in('id', ids);

      if (error) throw error;

      toast.success(`Unstarred ${selectedIds.size} email${selectedIds.size !== 1 ? 's' : ''}`);
      deselectAll();
      onSuccess?.();
    } catch (error) {
      const err = error as Error;
      toast.error('Failed to unstar emails');
      onError?.(err);
    } finally {
      setIsPerformingAction(false);
    }
  }, [selectedIds, onSuccess, onError, deselectAll]);

  const bulkMarkRead = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsPerformingAction(true);
    try {
      const ids = Array.from(selectedIds);

      const { error } = await supabase
        .from('emails')
        .update({ is_read: true })
        .in('id', ids);

      if (error) throw error;

      toast.success(`Marked ${selectedIds.size} email${selectedIds.size !== 1 ? 's' : ''} as read`);
      deselectAll();
      onSuccess?.();
    } catch (error) {
      const err = error as Error;
      toast.error('Failed to mark emails as read');
      onError?.(err);
    } finally {
      setIsPerformingAction(false);
    }
  }, [selectedIds, onSuccess, onError, deselectAll]);

  const bulkMarkUnread = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsPerformingAction(true);
    try {
      const ids = Array.from(selectedIds);

      const { error } = await supabase
        .from('emails')
        .update({ is_read: false })
        .in('id', ids);

      if (error) throw error;

      toast.success(`Marked ${selectedIds.size} email${selectedIds.size !== 1 ? 's' : ''} as unread`);
      deselectAll();
      onSuccess?.();
    } catch (error) {
      const err = error as Error;
      toast.error('Failed to mark emails as unread');
      onError?.(err);
    } finally {
      setIsPerformingAction(false);
    }
  }, [selectedIds, onSuccess, onError, deselectAll]);

  const bulkMoveToFolder = useCallback(async (folder: string) => {
    if (selectedIds.size === 0) return;

    setIsPerformingAction(true);
    try {
      const ids = Array.from(selectedIds);

      const { error } = await supabase
        .from('emails')
        .update({ folder })
        .in('id', ids);

      if (error) throw error;

      toast.success(`Moved ${selectedIds.size} email${selectedIds.size !== 1 ? 's' : ''} to ${folder}`);
      deselectAll();
      onSuccess?.();
    } catch (error) {
      const err = error as Error;
      toast.error(`Failed to move emails to ${folder}`);
      onError?.(err);
    } finally {
      setIsPerformingAction(false);
    }
  }, [selectedIds, onSuccess, onError, deselectAll]);

  // Computed values
  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);
  const hasSelection = useMemo(() => selectedIds.size > 0, [selectedIds]);

  return {
    // Selection state
    selectedIds,
    selectedCount,
    hasSelection,

    // Selection actions
    selectEmail,
    deselectEmail,
    toggleEmailSelection,
    selectAll,
    deselectAll,
    isSelected,

    // Bulk operations
    bulkArchive,
    bulkDelete,
    bulkPermanentDelete,
    bulkStar,
    bulkUnstar,
    bulkMarkRead,
    bulkMarkUnread,
    bulkMoveToFolder,

    // State
    isPerformingAction
  };
}
