/**
 * Custom hook for waitlist admin functionality
 * Handles fetching entries, stats, analytics, and admin operations
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import * as waitlistService from '../services/waitlistService';
import type {
  WaitlistEntry,
  WaitlistStats,
  ToolAnalytics,
  WaitlistFilters
} from '../types/waitlist';

interface UseWaitlistAdminReturn {
  entries: WaitlistEntry[];
  stats: WaitlistStats | null;
  analytics: ToolAnalytics | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  releaseUser: (id: string, notes?: string) => Promise<void>;
  unreleaseUser: (id: string, notes?: string) => Promise<void>;
  updateEntry: (id: string, updates: Partial<WaitlistEntry>) => Promise<void>;
  exportData: (filters?: WaitlistFilters) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
}

export function useWaitlistAdmin(filters?: WaitlistFilters): UseWaitlistAdminReturn {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [stats, setStats] = useState<WaitlistStats | null>(null);
  const [analytics, setAnalytics] = useState<ToolAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [entriesData, statsData, analyticsData] = await Promise.all([
        waitlistService.getWaitlistEntries(filters),
        waitlistService.getWaitlistStats(),
        waitlistService.getToolAnalytics()
      ]);

      setEntries(entriesData);
      setStats(statsData);
      setAnalytics(analyticsData);
    } catch (err) {
      const error = err as Error;
      setError(error);
      toast.error(error.message || 'Failed to load waitlist data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [JSON.stringify(filters)]);

  const releaseUser = async (id: string, notes?: string) => {
    try {
      await waitlistService.releaseWaitlistUser(id, notes);
      toast.success('User released from waitlist');
      await fetchData(); // Refresh data
    } catch (err) {
      const error = err as Error;
      toast.error(error.message || 'Failed to release user');
      throw error;
    }
  };

  const unreleaseUser = async (id: string, notes?: string) => {
    try {
      await waitlistService.unreleaseWaitlistUser(id, notes);
      toast.success('User put back on waitlist');
      await fetchData(); // Refresh data
    } catch (err) {
      const error = err as Error;
      toast.error(error.message || 'Failed to put user back on waitlist');
      throw error;
    }
  };

  const updateEntry = async (id: string, updates: Partial<WaitlistEntry>) => {
    try {
      await waitlistService.updateWaitlistEntry(id, updates);
      toast.success('Waitlist entry updated');
      await fetchData(); // Refresh data
    } catch (err) {
      const error = err as Error;
      toast.error(error.message || 'Failed to update entry');
      throw error;
    }
  };

  const exportData = async (exportFilters?: WaitlistFilters) => {
    try {
      const blob = await waitlistService.exportWaitlistCSV(exportFilters || filters);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `waitlist-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Waitlist data exported successfully');
    } catch (err) {
      const error = err as Error;
      toast.error(error.message || 'Failed to export data');
      throw error;
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      await waitlistService.deleteWaitlistEntry(id);
      toast.success('Waitlist entry deleted');
      await fetchData(); // Refresh data
    } catch (err) {
      const error = err as Error;
      toast.error(error.message || 'Failed to delete entry');
      throw error;
    }
  };

  return {
    entries,
    stats,
    analytics,
    isLoading,
    error,
    refetch: fetchData,
    releaseUser,
    unreleaseUser,
    updateEntry,
    exportData,
    deleteEntry
  };
}
