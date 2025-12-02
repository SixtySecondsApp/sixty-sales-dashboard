/**
 * useWaitlistBulkActions Hook
 * Manages bulk selection and actions for waitlist entries
 */

import { useState, useCallback, useMemo } from 'react';
import { bulkGrantAccess, type BulkGrantAccessParams, type BulkGrantAccessResult } from '@/lib/services/waitlistAdminService';
import type { WaitlistEntry } from '@/lib/types/waitlist';

export interface UseWaitlistBulkActionsReturn {
  selectedIds: Set<string>;
  selectedCount: number;
  selectedEntries: WaitlistEntry[];
  isProcessing: boolean;
  selectEntry: (id: string) => void;
  deselectEntry: (id: string) => void;
  toggleEntry: (id: string) => void;
  selectAll: (entries: WaitlistEntry[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  canSelect: (entry: WaitlistEntry) => boolean;
  grantAccess: (params: Omit<BulkGrantAccessParams, 'entryIds'>) => Promise<BulkGrantAccessResult>;
}

/**
 * Hook for managing bulk actions on waitlist entries
 */
export function useWaitlistBulkActions(
  adminUserId: string,
  entries: WaitlistEntry[] = []
): UseWaitlistBulkActionsReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Check if an entry can be selected
   * Only pending entries can be selected for bulk access granting
   */
  const canSelect = useCallback((entry: WaitlistEntry): boolean => {
    return entry.status === 'pending';
  }, []);

  /**
   * Select an entry by ID
   */
  const selectEntry = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const entry = entries.find((e) => e.id === id);
      if (entry && canSelect(entry)) {
        next.add(id);
      }
      return next;
    });
  }, [entries, canSelect]);

  /**
   * Deselect an entry by ID
   */
  const deselectEntry = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  /**
   * Toggle selection for an entry
   */
  const toggleEntry = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        const entry = entries.find((e) => e.id === id);
        if (entry && canSelect(entry)) {
          next.add(id);
        }
      }
      return next;
    });
  }, [entries, canSelect]);

  /**
   * Select all selectable entries
   */
  const selectAll = useCallback((entriesToSelect: WaitlistEntry[]) => {
    const selectableIds = entriesToSelect
      .filter(canSelect)
      .map((entry) => entry.id);
    setSelectedIds(new Set(selectableIds));
  }, [canSelect]);

  /**
   * Clear all selections
   */
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /**
   * Check if an entry is selected
   */
  const isSelected = useCallback((id: string): boolean => {
    return selectedIds.has(id);
  }, [selectedIds]);

  /**
   * Grant access to selected entries
   */
  const grantAccess = useCallback(async (
    params: Omit<BulkGrantAccessParams, 'entryIds'>
  ): Promise<BulkGrantAccessResult> => {
    if (selectedIds.size === 0) {
      return {
        success: false,
        granted: 0,
        failed: 0,
        total: 0,
        errors: [{ entryId: '', email: '', error: 'No entries selected' }],
      };
    }

    if (selectedIds.size > 50) {
      return {
        success: false,
        granted: 0,
        failed: 0,
        total: selectedIds.size,
        errors: [{ entryId: '', email: '', error: 'Cannot grant access to more than 50 users at once' }],
      };
    }

    setIsProcessing(true);

    try {
      const result = await bulkGrantAccess({
        ...params,
        entryIds: Array.from(selectedIds),
        adminUserId,
      });

      // Clear selection if all succeeded
      if (result.success && result.failed === 0) {
        clearSelection();
      } else if (result.success && result.failed > 0) {
        // Remove successfully granted entries from selection
        const failedIds = new Set(result.errors.map((e) => e.entryId));
        setSelectedIds((prev) => {
          const next = new Set<string>();
          prev.forEach((id) => {
            if (failedIds.has(id)) {
              next.add(id);
            }
          });
          return next;
        });
      }

      return result;
    } catch (error: any) {
      return {
        success: false,
        granted: 0,
        failed: selectedIds.size,
        total: selectedIds.size,
        errors: [{ entryId: '', email: '', error: error.message || 'Unknown error' }],
      };
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIds, adminUserId, clearSelection]);

  /**
   * Get selected entries with full details
   */
  const selectedEntries = useMemo(() => {
    return entries.filter((entry) => selectedIds.has(entry.id));
  }, [entries, selectedIds]);

  /**
   * Get count of selected entries
   */
  const selectedCount = selectedIds.size;

  return {
    selectedIds,
    selectedCount,
    selectedEntries,
    isProcessing,
    selectEntry,
    deselectEntry,
    toggleEntry,
    selectAll,
    clearSelection,
    isSelected,
    canSelect,
    grantAccess,
  };
}
