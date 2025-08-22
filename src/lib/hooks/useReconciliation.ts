// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/clientV2';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import logger from '@/lib/utils/logger';

// Types for reconciliation data
export interface ReconciliationOverview {
  total_sales_activities: number;
  total_won_deals: number;
  total_active_clients: number;
  orphan_activities: number;
  orphan_deals: number;
  total_activity_revenue: number;
  total_deal_revenue: number;
  total_mrr: number;
  activity_deal_linkage_rate: number;
  deal_activity_linkage_rate: number;
  overall_data_quality_score: number;
}

export interface OrphanActivity {
  id: string;
  client_name: string;
  amount: number;
  date: string;
  sales_rep: string;
  user_id: string;
  details: string;
  contact_identifier?: string;
  contact_identifier_type?: string;
  created_at: string;
  issue_type: 'orphan_activity';
  priority_level: 'revenue_risk' | 'data_integrity';
}

export interface OrphanDeal {
  id: string;
  name: string;
  company: string;
  value: number;
  one_off_revenue?: number;
  monthly_mrr?: number;
  annual_value?: number;
  owner_id: string;
  stage_changed_at: string;
  created_at: string;
  issue_type: 'orphan_deal';
  priority_level: 'revenue_tracking' | 'data_integrity';
}

export interface DuplicateGroup {
  client_name_clean: string;
  activity_date: string;
  activity_count: number;
  unique_deals: number;
  activity_ids: string[];
  deal_ids: string[];
  amounts: number[];
  sales_reps: string[];
  total_amount: number;
  issue_type: 'same_day_multiple_activities';
}

export interface PotentialMatch {
  activity_id: string;
  deal_id: string;
  client_name: string;
  company: string;
  amount: number;
  value: number;
  date: string;
  stage_changed_at: string;
  days_difference: number;
  name_match_score: number;
  date_proximity_score: number;
  amount_similarity_score: number;
  total_confidence_score: number;
  confidence_level: 'high_confidence' | 'medium_confidence' | 'low_confidence';
}

export interface UserStatistic {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  user_sales_activities: number;
  user_won_deals: number;
  user_active_clients: number;
  user_orphan_activities: number;
  user_orphan_deals: number;
  user_activity_revenue: number;
  user_deal_revenue: number;
  user_linkage_rate: number;
}

export interface ReconciliationFilters {
  userId?: string;
  startDate?: string;
  endDate?: string;
  confidenceThreshold?: number;
}

// API fetch functions
async function fetchReconciliationOverview(filters: ReconciliationFilters = {}): Promise<ReconciliationOverview> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const params = new URLSearchParams({
    analysisType: 'overview',
    ...(filters.userId && { userId: filters.userId }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate })
  });

  const response = await fetch(`/api/reconcile/analysis?${params}`);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch reconciliation overview');
  }

  const result = await response.json();
  return result.data;
}

async function fetchOrphanAnalysis(filters: ReconciliationFilters = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const params = new URLSearchParams({
    analysisType: 'orphans',
    ...(filters.userId && { userId: filters.userId }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate })
  });

  const response = await fetch(`/api/reconcile/analysis?${params}`);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch orphan analysis');
  }

  const result = await response.json();
  return result.data;
}

async function fetchDuplicateAnalysis(filters: ReconciliationFilters = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const params = new URLSearchParams({
    analysisType: 'duplicates',
    ...(filters.userId && { userId: filters.userId }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate })
  });

  const response = await fetch(`/api/reconcile/analysis?${params}`);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch duplicate analysis');
  }

  const result = await response.json();
  return result.data;
}

async function fetchMatchingAnalysis(filters: ReconciliationFilters = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const params = new URLSearchParams({
    analysisType: 'matching',
    confidenceThreshold: (filters.confidenceThreshold || 50).toString(),
    ...(filters.userId && { userId: filters.userId }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate })
  });

  const response = await fetch(`/api/reconcile/analysis?${params}`);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch matching analysis');
  }

  const result = await response.json();
  return result.data;
}

async function fetchUserStatistics(filters: ReconciliationFilters = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const params = new URLSearchParams({
    analysisType: 'statistics',
    ...(filters.userId && { userId: filters.userId }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate })
  });

  const response = await fetch(`/api/reconcile/analysis?${params}`);
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to fetch user statistics');
  }

  const result = await response.json();
  return result.data;
}

// Hook for reconciliation overview
export function useReconciliationOverview(filters: ReconciliationFilters = {}) {
  const cacheKey = ['reconciliation', 'overview', filters];
  
  return useQuery({
    queryKey: cacheKey,
    queryFn: () => fetchReconciliationOverview(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    meta: {
      errorMessage: 'Failed to load reconciliation overview'
    }
  });
}

// Hook for orphan analysis
export function useOrphanAnalysis(filters: ReconciliationFilters = {}) {
  const cacheKey = ['reconciliation', 'orphans', filters];
  
  return useQuery({
    queryKey: cacheKey,
    queryFn: () => fetchOrphanAnalysis(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    meta: {
      errorMessage: 'Failed to load orphan analysis'
    }
  });
}

// Hook for duplicate analysis
export function useDuplicateAnalysis(filters: ReconciliationFilters = {}) {
  const cacheKey = ['reconciliation', 'duplicates', filters];
  
  return useQuery({
    queryKey: cacheKey,
    queryFn: () => fetchDuplicateAnalysis(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    meta: {
      errorMessage: 'Failed to load duplicate analysis'
    }
  });
}

// Hook for matching analysis
export function useMatchingAnalysis(filters: ReconciliationFilters = {}) {
  const cacheKey = ['reconciliation', 'matching', filters];
  
  return useQuery({
    queryKey: cacheKey,
    queryFn: () => fetchMatchingAnalysis(filters),
    staleTime: 3 * 60 * 1000, // 3 minutes (more frequent updates for matching)
    gcTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    meta: {
      errorMessage: 'Failed to load matching analysis'
    }
  });
}

// Hook for user statistics
export function useUserStatistics(filters: ReconciliationFilters = {}) {
  const cacheKey = ['reconciliation', 'statistics', filters];
  
  return useQuery({
    queryKey: cacheKey,
    queryFn: () => fetchUserStatistics(filters),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    meta: {
      errorMessage: 'Failed to load user statistics'
    }
  });
}

// Combined hook for comprehensive reconciliation analysis
export function useReconciliationAnalysis(filters: ReconciliationFilters = {}) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const overview = useReconciliationOverview(filters);
  const orphans = useOrphanAnalysis(filters);
  const duplicates = useDuplicateAnalysis(filters);
  const matching = useMatchingAnalysis(filters);
  const statistics = useUserStatistics(filters);

  // Refresh all data
  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reconciliation', 'overview'] }),
        queryClient.invalidateQueries({ queryKey: ['reconciliation', 'orphans'] }),
        queryClient.invalidateQueries({ queryKey: ['reconciliation', 'duplicates'] }),
        queryClient.invalidateQueries({ queryKey: ['reconciliation', 'matching'] }),
        queryClient.invalidateQueries({ queryKey: ['reconciliation', 'statistics'] })
      ]);
      toast.success('Reconciliation data refreshed');
    } catch (error) {
      toast.error('Failed to refresh reconciliation data');
      logger.error('Error refreshing reconciliation data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  // Clear cache and refetch
  const clearCacheAndRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.removeQueries({ queryKey: ['reconciliation'] });
      await refreshAll();
    } catch (error) {
      toast.error('Failed to clear cache and refresh');
      logger.error('Error clearing cache:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient, refreshAll]);

  // Calculate overall loading state
  const isLoading = overview.isLoading || orphans.isLoading || duplicates.isLoading || 
                   matching.isLoading || statistics.isLoading || isRefreshing;

  // Calculate overall error state
  const error = overview.error || orphans.error || duplicates.error || 
               matching.error || statistics.error;

  // Calculate overall data completeness
  const isDataComplete = overview.data && orphans.data && duplicates.data && 
                         matching.data && statistics.data;

  return {
    // Individual data sets
    overview: overview.data,
    orphans: orphans.data,
    duplicates: duplicates.data,
    matching: matching.data,
    statistics: statistics.data,

    // Loading states
    isLoading,
    isRefreshing,
    overviewLoading: overview.isLoading,
    orphansLoading: orphans.isLoading,
    duplicatesLoading: duplicates.isLoading,
    matchingLoading: matching.isLoading,
    statisticsLoading: statistics.isLoading,

    // Error states
    error,
    overviewError: overview.error,
    orphansError: orphans.error,
    duplicatesError: duplicates.error,
    matchingError: matching.error,
    statisticsError: statistics.error,

    // Data completeness
    isDataComplete,

    // Actions
    refreshAll,
    clearCacheAndRefresh,
    
    // Individual refresh functions
    refreshOverview: () => queryClient.invalidateQueries({ queryKey: ['reconciliation', 'overview'] }),
    refreshOrphans: () => queryClient.invalidateQueries({ queryKey: ['reconciliation', 'orphans'] }),
    refreshDuplicates: () => queryClient.invalidateQueries({ queryKey: ['reconciliation', 'duplicates'] }),
    refreshMatching: () => queryClient.invalidateQueries({ queryKey: ['reconciliation', 'matching'] }),
    refreshStatistics: () => queryClient.invalidateQueries({ queryKey: ['reconciliation', 'statistics'] })
  };
}

// Filter management hook
export function useReconciliationFilters(initialFilters: ReconciliationFilters = {}) {
  const [filters, setFilters] = useState<ReconciliationFilters>(initialFilters);

  const updateFilter = useCallback((key: keyof ReconciliationFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const updateFilters = useCallback((newFilters: Partial<ReconciliationFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  const resetToDefaults = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  return {
    filters,
    updateFilter,
    updateFilters,
    clearFilters,
    resetToDefaults,
    hasActiveFilters: Object.keys(filters).length > 0
  };
}

// Execution and Actions API functions
async function executeReconciliation(options: {
  mode?: 'safe' | 'aggressive' | 'dry_run';
  userId?: string;
  batchSize?: number;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const response = await fetch('/api/reconcile/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mode: options.mode || 'safe',
      userId: options.userId || user.id,
      batchSize: options.batchSize || 100
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to execute reconciliation');
  }

  return response.json();
}

async function executeBatchReconciliation(options: {
  mode?: 'safe' | 'aggressive' | 'dry_run';
  userId?: string;
  batchSize?: number;
  maxBatches?: number;
  delayBetweenBatches?: number;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const response = await fetch('/api/reconcile/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'batch',
      mode: options.mode || 'safe',
      userId: options.userId || user.id,
      batchSize: options.batchSize || 50,
      maxBatches: options.maxBatches || 10,
      delayBetweenBatches: options.delayBetweenBatches || 1000
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to execute batch reconciliation');
  }

  return response.json();
}

async function executeReconciliationAction(action: {
  action: 'link_manual' | 'create_deal_from_activity' | 'create_activity_from_deal' | 'mark_duplicate' | 'split_record' | 'merge_records' | 'undo_action';
  activityId?: string;
  dealId?: string;
  userId?: string;
  metadata?: any;
  confidence?: number;
  [key: string]: any;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const response = await fetch('/api/reconcile/actions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...action,
      userId: action.userId || user.id
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to execute reconciliation action');
  }

  return response.json();
}

async function getReconciliationProgress(userId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const params = new URLSearchParams();
  if (userId) params.append('userId', userId);

  const response = await fetch(`/api/reconcile/execute?${params}`, {
    method: 'GET'
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to get reconciliation progress');
  }

  return response.json();
}

async function rollbackReconciliation(options: {
  auditLogIds?: number[];
  timeThreshold?: string;
  confirmRollback: boolean;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const response = await fetch('/api/reconcile/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'rollback',
      ...options
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to rollback reconciliation');
  }

  return response.json();
}

// Hook for reconciliation execution
export function useReconciliationExecution() {
  const queryClient = useQueryClient();
  const [executionProgress, setExecutionProgress] = useState<any>(null);

  const executeMutation = useMutation({
    mutationFn: executeReconciliation,
    onSuccess: (data) => {
      toast.success(`Reconciliation completed: ${data.summary.totalProcessed} records processed`);
      setExecutionProgress(data);
      // Invalidate all reconciliation queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
    },
    onError: (error: Error) => {
      toast.error(`Reconciliation failed: ${error.message}`);
      logger.error('Reconciliation execution error:', error);
    }
  });

  const batchExecuteMutation = useMutation({
    mutationFn: executeBatchReconciliation,
    onSuccess: (data) => {
      toast.success(`Batch reconciliation completed: ${data.totalProcessed} records processed`);
      setExecutionProgress(data);
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
    },
    onError: (error: Error) => {
      toast.error(`Batch reconciliation failed: ${error.message}`);
      logger.error('Batch reconciliation error:', error);
    }
  });

  const rollbackMutation = useMutation({
    mutationFn: rollbackReconciliation,
    onSuccess: (data) => {
      toast.success(`Rollback completed: ${data.rollback.entries_reverted} entries reverted`);
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
    },
    onError: (error: Error) => {
      toast.error(`Rollback failed: ${error.message}`);
      logger.error('Reconciliation rollback error:', error);
    }
  });

  const progressQuery = useQuery({
    queryKey: ['reconciliation', 'progress'],
    queryFn: () => getReconciliationProgress(),
    refetchInterval: 5000, // Poll every 5 seconds during execution
    enabled: executeMutation.isPending || batchExecuteMutation.isPending,
    staleTime: 0 // Always fetch fresh data
  });

  return {
    // Execution functions
    execute: executeMutation.mutate,
    executeBatch: batchExecuteMutation.mutate,
    rollback: rollbackMutation.mutate,

    // Status
    isExecuting: executeMutation.isPending,
    isBatchExecuting: batchExecuteMutation.isPending,
    isRollingBack: rollbackMutation.isPending,
    
    // Results
    executionResult: executeMutation.data,
    batchExecutionResult: batchExecuteMutation.data,
    rollbackResult: rollbackMutation.data,
    progress: progressQuery.data,
    executionProgress,

    // Errors
    executionError: executeMutation.error,
    batchExecutionError: batchExecuteMutation.error,
    rollbackError: rollbackMutation.error,
    progressError: progressQuery.error,

    // Reset functions
    resetExecution: () => {
      executeMutation.reset();
      setExecutionProgress(null);
    },
    resetBatchExecution: () => {
      batchExecuteMutation.reset();
      setExecutionProgress(null);
    },
    resetRollback: rollbackMutation.reset
  };
}

// Hook for reconciliation actions (manual operations)
export function useReconciliationActions() {
  const queryClient = useQueryClient();

  const actionMutation = useMutation({
    mutationFn: executeReconciliationAction,
    onSuccess: (data, variables) => {
      const actionMessages = {
        'link_manual': 'Records linked successfully',
        'create_deal_from_activity': 'Deal created from activity',
        'create_activity_from_deal': 'Activity created from deal',
        'mark_duplicate': 'Record marked as duplicate',
        'split_record': 'Record split successfully',
        'merge_records': 'Records merged successfully',
        'undo_action': 'Action undone successfully'
      };
      
      toast.success(actionMessages[variables.action] || 'Action completed successfully');
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['reconciliation'] });
    },
    onError: (error: Error, variables) => {
      toast.error(`Failed to ${variables.action.replace('_', ' ')}: ${error.message}`);
      logger.error('Reconciliation action error:', error);
    }
  });

  // Individual action functions for better UX
  const linkManually = useCallback((activityId: string, dealId: string, confidence?: number) => {
    return actionMutation.mutate({
      action: 'link_manual',
      activityId,
      dealId,
      confidence
    });
  }, [actionMutation]);

  const createDealFromActivity = useCallback((activityId: string, dealData?: any) => {
    return actionMutation.mutate({
      action: 'create_deal_from_activity',
      activityId,
      dealData
    });
  }, [actionMutation]);

  const createActivityFromDeal = useCallback((dealId: string, activityData?: any) => {
    return actionMutation.mutate({
      action: 'create_activity_from_deal',
      dealId,
      activityData
    });
  }, [actionMutation]);

  const markAsDuplicate = useCallback((recordType: string, recordId: string, keepRecordId?: string) => {
    return actionMutation.mutate({
      action: 'mark_duplicate',
      recordType,
      recordId,
      keepRecordId
    });
  }, [actionMutation]);

  const splitRecord = useCallback((recordType: string, recordId: string, splitData: any[]) => {
    return actionMutation.mutate({
      action: 'split_record',
      recordType,
      recordId,
      splitData
    });
  }, [actionMutation]);

  const mergeRecords = useCallback((recordType: string, recordIds: string[], mergeInto?: string, mergeData?: any) => {
    return actionMutation.mutate({
      action: 'merge_records',
      recordType,
      recordIds,
      mergeInto,
      mergeData
    });
  }, [actionMutation]);

  const undoAction = useCallback((auditLogId: number) => {
    return actionMutation.mutate({
      action: 'undo_action',
      auditLogId
    });
  }, [actionMutation]);

  return {
    // Generic action executor
    executeAction: actionMutation.mutate,
    
    // Specific action functions
    linkManually,
    createDealFromActivity,
    createActivityFromDeal,
    markAsDuplicate,
    splitRecord,
    mergeRecords,
    undoAction,

    // Status
    isExecuting: actionMutation.isPending,
    
    // Results
    result: actionMutation.data,
    error: actionMutation.error,

    // Reset
    reset: actionMutation.reset
  };
}

// Export utility function for external use
export const reconciliationQueryKeys = {
  all: ['reconciliation'] as const,
  overview: (filters?: ReconciliationFilters) => ['reconciliation', 'overview', filters] as const,
  orphans: (filters?: ReconciliationFilters) => ['reconciliation', 'orphans', filters] as const,
  duplicates: (filters?: ReconciliationFilters) => ['reconciliation', 'duplicates', filters] as const,
  matching: (filters?: ReconciliationFilters) => ['reconciliation', 'matching', filters] as const,
  statistics: (filters?: ReconciliationFilters) => ['reconciliation', 'statistics', filters] as const,
  progress: () => ['reconciliation', 'progress'] as const,
};