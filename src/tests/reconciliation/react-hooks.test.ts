/**
 * React Hook Testing - Sales Activities and Pipeline Deals Reconciliation
 * 
 * Tests useReconciliation hooks functionality, data fetching/caching, error handling,
 * loading states, and progress tracking.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/clientV2';
import {
  useReconciliationOverview,
  useOrphanAnalysis,
  useMatchingAnalysis,
  useReconciliationAnalysis,
  useReconciliationFilters,
  useReconciliationExecution,
  useReconciliationActions,
  type ReconciliationFilters
} from '@/lib/hooks/useReconciliation';
import React from 'react';

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

// Mock fetch globally
global.fetch = vi.fn();

// Mock data
const mockOverviewData = {
  total_sales_activities: 100,
  total_won_deals: 80,
  orphan_activities: 15,
  orphan_deals: 10,
  total_activity_revenue: 500000,
  total_deal_revenue: 450000,
  activity_deal_linkage_rate: 85.0,
  overall_data_quality_score: 87.5
};

const mockOrphanData = {
  orphan_activities: [
    {
      id: 'act-1',
      client_name: 'Test Client',
      amount: 10000,
      date: '2024-01-15',
      issue_type: 'orphan_activity' as const,
      priority_level: 'revenue_risk' as const
    }
  ],
  orphan_deals: [
    {
      id: 'deal-1',
      name: 'Test Deal',
      company: 'Test Company',
      value: 15000,
      issue_type: 'orphan_deal' as const,
      priority_level: 'revenue_tracking' as const
    }
  ],
  summary: {
    total_orphan_activities: 1,
    total_orphan_deals: 1,
    total_orphan_activity_revenue: 10000,
    total_orphan_deal_revenue: 15000
  }
};

const mockMatchingData = {
  matches: {
    high_confidence: [
      {
        activity_id: 'act-1',
        deal_id: 'deal-1',
        total_confidence_score: 85,
        confidence_level: 'high_confidence' as const
      }
    ],
    medium_confidence: [],
    low_confidence: []
  },
  summary: {
    total_matches: 1,
    high_confidence_matches: 1,
    medium_confidence_matches: 0,
    low_confidence_matches: 0
  }
};

const mockExecutionResult = {
  success: true,
  summary: {
    totalProcessed: 10,
    highConfidenceLinks: 5,
    dealsCreated: 2,
    activitiesCreated: 1,
    errors: 0,
    successRate: 100
  }
};

const mockActionResult = {
  success: true,
  action: 'link_manual',
  activityId: 'act-1',
  dealId: 'deal-1',
  message: 'Activity successfully linked to deal'
};

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0
      }
    }
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Mock API response helper
const mockApiResponse = (data: any, error?: string, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(error ? { error } : { data }),
  text: vi.fn().mockResolvedValue(JSON.stringify(error ? { error } : { data }))
});

describe('React Hooks Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock authentication
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useReconciliationOverview', () => {
    it('should fetch overview data successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockOverviewData)
      );

      const { result } = renderHook(() => useReconciliationOverview(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockOverviewData);
      expect(result.current.error).toBeNull();
      expect(result.current.isSuccess).toBe(true);
    });

    it('should handle error states correctly', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Failed to fetch overview', 500)
      );

      const { result } = renderHook(() => useReconciliationOverview(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });

    it('should apply filters correctly', async () => {
      const filters: ReconciliationFilters = {
        userId: 'user-1',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockOverviewData)
      );

      const { result } = renderHook(() => useReconciliationOverview(filters), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify fetch was called with correct parameters
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('analysisType=overview&userId=user-1&startDate=2024-01-01&endDate=2024-01-31')
      );
    });

    it('should cache data with correct cache key', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockOverviewData)
      );

      const filters = { userId: 'user-1' };
      const { result, rerender } = renderHook(
        ({ filters }) => useReconciliationOverview(filters),
        {
          wrapper: createWrapper(),
          initialProps: { filters }
        }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Rerender with same filters should use cache
      rerender({ filters });
      
      // Should not fetch again
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle authentication errors', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      });

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Not authenticated', 401)
      );

      const { result } = renderHook(() => useReconciliationOverview(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.isError).toBe(true);
    });
  });

  describe('useOrphanAnalysis', () => {
    it('should fetch orphan data successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockOrphanData)
      );

      const { result } = renderHook(() => useOrphanAnalysis(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockOrphanData);
      expect(result.current.data?.orphan_activities).toHaveLength(1);
      expect(result.current.data?.orphan_deals).toHaveLength(1);
    });

    it('should handle empty orphan results', async () => {
      const emptyOrphanData = {
        orphan_activities: [],
        orphan_deals: [],
        summary: {
          total_orphan_activities: 0,
          total_orphan_deals: 0,
          total_orphan_activity_revenue: 0,
          total_orphan_deal_revenue: 0
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(emptyOrphanData)
      );

      const { result } = renderHook(() => useOrphanAnalysis(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.orphan_activities).toHaveLength(0);
      expect(result.current.data?.orphan_deals).toHaveLength(0);
      expect(result.current.data?.summary.total_orphan_activities).toBe(0);
    });
  });

  describe('useMatchingAnalysis', () => {
    it('should fetch matching data with confidence threshold', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockMatchingData)
      );

      const filters = { confidenceThreshold: 75 };
      const { result } = renderHook(() => useMatchingAnalysis(filters), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockMatchingData);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('confidenceThreshold=75')
      );
    });

    it('should group matches by confidence level correctly', async () => {
      const matchingDataWithLevels = {
        matches: {
          high_confidence: [
            { activity_id: 'act-1', deal_id: 'deal-1', total_confidence_score: 90 }
          ],
          medium_confidence: [
            { activity_id: 'act-2', deal_id: 'deal-2', total_confidence_score: 70 }
          ],
          low_confidence: [
            { activity_id: 'act-3', deal_id: 'deal-3', total_confidence_score: 45 }
          ]
        },
        summary: {
          total_matches: 3,
          high_confidence_matches: 1,
          medium_confidence_matches: 1,
          low_confidence_matches: 1
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(matchingDataWithLevels)
      );

      const { result } = renderHook(() => useMatchingAnalysis(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.matches.high_confidence).toHaveLength(1);
      expect(result.current.data?.matches.medium_confidence).toHaveLength(1);
      expect(result.current.data?.matches.low_confidence).toHaveLength(1);
      expect(result.current.data?.summary.total_matches).toBe(3);
    });
  });

  describe('useReconciliationAnalysis (Combined Hook)', () => {
    it('should fetch all analysis data types', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce(mockApiResponse(mockOverviewData))
        .mockResolvedValueOnce(mockApiResponse(mockOrphanData))
        .mockResolvedValueOnce(mockApiResponse({ duplicates: [], summary: {} }))
        .mockResolvedValueOnce(mockApiResponse(mockMatchingData))
        .mockResolvedValueOnce(mockApiResponse({ user_statistics: [], summary: {} }));

      const { result } = renderHook(() => useReconciliationAnalysis(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.overview).toEqual(mockOverviewData);
      expect(result.current.orphans).toEqual(mockOrphanData);
      expect(result.current.matching).toEqual(mockMatchingData);
      expect(result.current.isDataComplete).toBe(true);
    });

    it('should handle partial data loading', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce(mockApiResponse(mockOverviewData))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockApiResponse({ duplicates: [], summary: {} }))
        .mockResolvedValueOnce(mockApiResponse(mockMatchingData))
        .mockResolvedValueOnce(mockApiResponse({ user_statistics: [], summary: {} }));

      const { result } = renderHook(() => useReconciliationAnalysis(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.overview).toEqual(mockOverviewData);
      expect(result.current.orphans).toBeUndefined(); // Failed to load
      expect(result.current.matching).toEqual(mockMatchingData);
      expect(result.current.isDataComplete).toBe(false);
      expect(result.current.error).toBeTruthy();
    });

    it('should refresh all data correctly', async () => {
      // Initial data load
      (global.fetch as any)
        .mockResolvedValueOnce(mockApiResponse(mockOverviewData))
        .mockResolvedValueOnce(mockApiResponse(mockOrphanData))
        .mockResolvedValueOnce(mockApiResponse({ duplicates: [], summary: {} }))
        .mockResolvedValueOnce(mockApiResponse(mockMatchingData))
        .mockResolvedValueOnce(mockApiResponse({ user_statistics: [], summary: {} }))
        // Refresh calls
        .mockResolvedValueOnce(mockApiResponse({ ...mockOverviewData, total_sales_activities: 110 }))
        .mockResolvedValueOnce(mockApiResponse(mockOrphanData))
        .mockResolvedValueOnce(mockApiResponse({ duplicates: [], summary: {} }))
        .mockResolvedValueOnce(mockApiResponse(mockMatchingData))
        .mockResolvedValueOnce(mockApiResponse({ user_statistics: [], summary: {} }));

      const { result } = renderHook(() => useReconciliationAnalysis(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Refresh all data
      await result.current.refreshAll();

      await waitFor(() => {
        expect(result.current.overview?.total_sales_activities).toBe(110);
      });

      expect(toast.success).toHaveBeenCalledWith('Reconciliation data refreshed');
    });

    it('should handle refresh errors gracefully', async () => {
      // Initial successful load
      (global.fetch as any)
        .mockResolvedValueOnce(mockApiResponse(mockOverviewData))
        .mockResolvedValueOnce(mockApiResponse(mockOrphanData))
        .mockResolvedValueOnce(mockApiResponse({ duplicates: [], summary: {} }))
        .mockResolvedValueOnce(mockApiResponse(mockMatchingData))
        .mockResolvedValueOnce(mockApiResponse({ user_statistics: [], summary: {} }))
        // Refresh error
        .mockRejectedValueOnce(new Error('Refresh failed'));

      const { result } = renderHook(() => useReconciliationAnalysis(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Attempt refresh
      await result.current.refreshAll();

      expect(toast.error).toHaveBeenCalledWith('Failed to refresh reconciliation data');
    });
  });

  describe('useReconciliationFilters', () => {
    it('should initialize with default filters', () => {
      const initialFilters = { userId: 'user-1', startDate: '2024-01-01' };
      const { result } = renderHook(() => useReconciliationFilters(initialFilters));

      expect(result.current.filters).toEqual(initialFilters);
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should update individual filters', () => {
      const { result } = renderHook(() => useReconciliationFilters());

      result.current.updateFilter('userId', 'user-2');
      expect(result.current.filters.userId).toBe('user-2');

      result.current.updateFilter('confidenceThreshold', 75);
      expect(result.current.filters.confidenceThreshold).toBe(75);
    });

    it('should update multiple filters at once', () => {
      const { result } = renderHook(() => useReconciliationFilters());

      const newFilters = {
        userId: 'user-3',
        startDate: '2024-02-01',
        endDate: '2024-02-28'
      };

      result.current.updateFilters(newFilters);
      expect(result.current.filters).toEqual(newFilters);
    });

    it('should clear all filters', () => {
      const initialFilters = { userId: 'user-1', startDate: '2024-01-01' };
      const { result } = renderHook(() => useReconciliationFilters(initialFilters));

      result.current.clearFilters();
      expect(result.current.filters).toEqual({});
      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('should reset to default filters', () => {
      const initialFilters = { userId: 'user-1' };
      const { result } = renderHook(() => useReconciliationFilters(initialFilters));

      // Modify filters
      result.current.updateFilter('startDate', '2024-01-01');
      expect(result.current.filters.startDate).toBe('2024-01-01');

      // Reset to defaults
      result.current.resetToDefaults();
      expect(result.current.filters).toEqual(initialFilters);
    });
  });

  describe('useReconciliationExecution', () => {
    it('should execute reconciliation successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockExecutionResult)
      );

      const { result } = renderHook(() => useReconciliationExecution(), {
        wrapper: createWrapper()
      });

      result.current.execute({
        mode: 'safe',
        userId: 'user-1',
        batchSize: 100
      });

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });

      expect(result.current.executionResult).toEqual(mockExecutionResult);
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Reconciliation completed: 10 records processed')
      );
    });

    it('should handle execution errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(
        new Error('Execution failed')
      );

      const { result } = renderHook(() => useReconciliationExecution(), {
        wrapper: createWrapper()
      });

      result.current.execute({ mode: 'safe' });

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });

      expect(result.current.executionError).toBeTruthy();
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Reconciliation failed')
      );
    });

    it('should execute batch reconciliation', async () => {
      const batchResult = {
        success: true,
        totalProcessed: 150,
        batchesExecuted: 3,
        results: [
          { batch: 1, success: true, processed: 50 },
          { batch: 2, success: true, processed: 50 },
          { batch: 3, success: true, processed: 50 }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(batchResult)
      );

      const { result } = renderHook(() => useReconciliationExecution(), {
        wrapper: createWrapper()
      });

      result.current.executeBatch({
        mode: 'safe',
        batchSize: 50,
        maxBatches: 3
      });

      await waitFor(() => {
        expect(result.current.isBatchExecuting).toBe(false);
      });

      expect(result.current.batchExecutionResult).toEqual(batchResult);
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Batch reconciliation completed: 150 records processed')
      );
    });

    it('should monitor progress during execution', async () => {
      const progressData = {
        success: true,
        summary: { totalOrphanActivities: 5 }
      };

      (global.fetch as any)
        .mockResolvedValueOnce(mockApiResponse(mockExecutionResult))
        .mockResolvedValueOnce(mockApiResponse(progressData));

      const { result } = renderHook(() => useReconciliationExecution(), {
        wrapper: createWrapper()
      });

      result.current.execute({ mode: 'safe' });

      // Progress should be monitored during execution
      await waitFor(() => {
        expect(result.current.isExecuting).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });

      expect(result.current.progress).toBeDefined();
    });

    it('should handle rollback operations', async () => {
      const rollbackResult = {
        success: true,
        rollback: { entries_reverted: 5 }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(rollbackResult)
      );

      const { result } = renderHook(() => useReconciliationExecution(), {
        wrapper: createWrapper()
      });

      result.current.rollback({
        auditLogIds: [1, 2, 3],
        confirmRollback: true
      });

      await waitFor(() => {
        expect(result.current.isRollingBack).toBe(false);
      });

      expect(result.current.rollbackResult).toEqual(rollbackResult);
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Rollback completed: 5 entries reverted')
      );
    });

    it('should reset execution state', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockExecutionResult)
      );

      const { result } = renderHook(() => useReconciliationExecution(), {
        wrapper: createWrapper()
      });

      result.current.execute({ mode: 'safe' });

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });

      expect(result.current.executionResult).toBeDefined();

      // Reset state
      result.current.resetExecution();

      expect(result.current.executionResult).toBeUndefined();
      expect(result.current.executionProgress).toBeNull();
    });
  });

  describe('useReconciliationActions', () => {
    it('should execute manual linking action', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockActionResult)
      );

      const { result } = renderHook(() => useReconciliationActions(), {
        wrapper: createWrapper()
      });

      result.current.linkManually('act-1', 'deal-1', 95);

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });

      expect(result.current.result).toEqual(mockActionResult);
      expect(toast.success).toHaveBeenCalledWith('Records linked successfully');
    });

    it('should handle action execution errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(
        new Error('Action failed')
      );

      const { result } = renderHook(() => useReconciliationActions(), {
        wrapper: createWrapper()
      });

      result.current.linkManually('act-1', 'deal-1');

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to link manual')
      );
    });

    it('should create deal from activity', async () => {
      const createDealResult = {
        success: true,
        action: 'create_deal_from_activity',
        activityId: 'act-1',
        newDeal: {
          id: 'deal-new-1',
          company: 'Test Company',
          amount: 10000
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(createDealResult)
      );

      const { result } = renderHook(() => useReconciliationActions(), {
        wrapper: createWrapper()
      });

      result.current.createDealFromActivity('act-1', {
        companyName: 'Test Company',
        amount: 10000
      });

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });

      expect(result.current.result).toEqual(createDealResult);
      expect(toast.success).toHaveBeenCalledWith('Deal created from activity');
    });

    it('should create activity from deal', async () => {
      const createActivityResult = {
        success: true,
        action: 'create_activity_from_deal',
        dealId: 'deal-1',
        newActivity: {
          id: 'act-new-1',
          company_name: 'Test Company',
          amount: 10000
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(createActivityResult)
      );

      const { result } = renderHook(() => useReconciliationActions(), {
        wrapper: createWrapper()
      });

      result.current.createActivityFromDeal('deal-1', {
        companyName: 'Test Company',
        amount: 10000
      });

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });

      expect(result.current.result).toEqual(createActivityResult);
      expect(toast.success).toHaveBeenCalledWith('Activity created from deal');
    });

    it('should mark records as duplicate', async () => {
      const markDuplicateResult = {
        success: true,
        action: 'mark_duplicate',
        recordType: 'activities',
        recordId: 'act-1',
        keepRecordId: 'act-2'
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(markDuplicateResult)
      );

      const { result } = renderHook(() => useReconciliationActions(), {
        wrapper: createWrapper()
      });

      result.current.markAsDuplicate('activities', 'act-1', 'act-2');

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });

      expect(result.current.result).toEqual(markDuplicateResult);
      expect(toast.success).toHaveBeenCalledWith('Record marked as duplicate');
    });

    it('should undo previous actions', async () => {
      const undoResult = {
        success: true,
        action: 'undo_action',
        originalAction: 'MANUAL_LINK',
        auditLogId: 123,
        undoResult: {
          action: 'unlinked',
          activityId: 'act-1'
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(undoResult)
      );

      const { result } = renderHook(() => useReconciliationActions(), {
        wrapper: createWrapper()
      });

      result.current.undoAction(123);

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });

      expect(result.current.result).toEqual(undoResult);
      expect(toast.success).toHaveBeenCalledWith('Action undone successfully');
    });

    it('should reset action state', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockActionResult)
      );

      const { result } = renderHook(() => useReconciliationActions(), {
        wrapper: createWrapper()
      });

      result.current.linkManually('act-1', 'deal-1');

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });

      expect(result.current.result).toBeDefined();

      // Reset state
      result.current.reset();

      expect(result.current.result).toBeUndefined();
      expect(result.current.error).toBeNull();
    });
  });

  describe('Loading States and Progress Tracking', () => {
    it('should track loading states correctly', async () => {
      let resolvePromise: (value: any) => void;
      const promise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      (global.fetch as any).mockReturnValue(promise);

      const { result } = renderHook(() => useReconciliationOverview(), {
        wrapper: createWrapper()
      });

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      // Resolve the promise
      resolvePromise!(mockApiResponse(mockOverviewData));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockOverviewData);
      expect(result.current.isSuccess).toBe(true);
    });

    it('should handle loading states in combined hook', async () => {
      // Mock slow responses
      const slowPromises = Array(5).fill(null).map(() => 
        new Promise(resolve => setTimeout(() => resolve(mockApiResponse({})), 100))
      );

      (global.fetch as any)
        .mockReturnValueOnce(slowPromises[0])
        .mockReturnValueOnce(slowPromises[1])
        .mockReturnValueOnce(slowPromises[2])
        .mockReturnValueOnce(slowPromises[3])
        .mockReturnValueOnce(slowPromises[4]);

      const { result } = renderHook(() => useReconciliationAnalysis(), {
        wrapper: createWrapper()
      });

      // Should be loading initially
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 1000 });

      expect(result.current.isDataComplete).toBe(true);
    });

    it('should handle execution progress tracking', async () => {
      // Mock execution that returns progress updates
      const executionPromise = new Promise(resolve => {
        setTimeout(() => resolve(mockApiResponse(mockExecutionResult)), 200);
      });

      const progressPromise = new Promise(resolve => {
        setTimeout(() => resolve(mockApiResponse({
          success: true,
          summary: { totalOrphanActivities: 3 }
        })), 100);
      });

      (global.fetch as any)
        .mockReturnValueOnce(executionPromise)
        .mockReturnValue(progressPromise);

      const { result } = renderHook(() => useReconciliationExecution(), {
        wrapper: createWrapper()
      });

      result.current.execute({ mode: 'safe' });

      // Should be executing
      expect(result.current.isExecuting).toBe(true);

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false);
      });

      expect(result.current.executionResult).toBeDefined();
      expect(result.current.progress).toBeDefined();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useReconciliationOverview(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBeTruthy();
    });

    it('should retry failed requests', async () => {
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockApiResponse(mockOverviewData));

      const { result } = renderHook(() => useReconciliationOverview(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should eventually succeed after retries
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockOverviewData);
    });

    it('should handle authentication errors', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockRejectedValue(
        new Error('Authentication failed')
      );

      const { result } = renderHook(() => useReconciliationOverview(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(true);
    });

    it('should clear errors on successful retry', async () => {
      (global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockApiResponse(mockOverviewData));

      const { result } = renderHook(() => useReconciliationOverview(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Trigger refetch
      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.isError).toBe(false);
      });

      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockOverviewData);
    });
  });
});