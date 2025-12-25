import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  globalTopicsService,
  type GetGlobalTopicsParams,
  type GlobalTopicsFilters,
  type GlobalTopicsSortBy,
  type AggregationMode,
} from '@/lib/services/globalTopicsService';
import { useSmartRefetchConfig } from './useSmartPolling';

// ============================================================================
// Query Keys
// ============================================================================

export const globalTopicsKeys = {
  all: ['global-topics'] as const,
  lists: () => [...globalTopicsKeys.all, 'list'] as const,
  list: (params: GetGlobalTopicsParams) =>
    [...globalTopicsKeys.lists(), params] as const,
  sources: (topicId: string) =>
    [...globalTopicsKeys.all, 'sources', topicId] as const,
  stats: () => [...globalTopicsKeys.all, 'stats'] as const,
  pendingCount: () => [...globalTopicsKeys.all, 'pending-count'] as const,
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch global topics with filtering and pagination
 *
 * @param params - Query parameters (filters, sort, pagination)
 * @param options - React Query options
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useGlobalTopics({
 *   filters: { search_query: 'pricing' },
 *   sort_by: 'relevance',
 *   page: 1,
 *   page_size: 20
 * });
 * ```
 */
export function useGlobalTopics(
  params: GetGlobalTopicsParams = {},
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchInterval?: number;
  }
) {
  return useQuery({
    queryKey: globalTopicsKeys.list(params),
    queryFn: () => globalTopicsService.getGlobalTopics(params),
    staleTime: options?.staleTime ?? 10 * 60 * 1000, // 10 minutes
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled !== false,
  });
}

/**
 * Hook to fetch sources for a specific global topic
 *
 * @param topicId - The global topic ID
 * @param limit - Number of sources to fetch
 * @param offset - Offset for pagination
 *
 * @example
 * ```tsx
 * const { data: sources } = useTopicSources('topic-123', 10, 0);
 * ```
 */
export function useTopicSources(
  topicId: string | null,
  limit: number = 10,
  offset: number = 0
) {
  return useQuery({
    queryKey: globalTopicsKeys.sources(topicId || ''),
    queryFn: () => globalTopicsService.getTopicSources(topicId!, limit, offset),
    enabled: !!topicId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch global topics statistics
 */
export function useGlobalTopicsStats() {
  return useQuery({
    queryKey: globalTopicsKeys.stats(),
    queryFn: () => globalTopicsService.getStats(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch pending aggregation count with smart polling.
 *
 * This is background/admin data - polling is reduced outside working hours
 * and when user is idle.
 */
export function usePendingAggregationCount() {
  // Use smart polling: 5 minute base for background data
  const refetchConfig = useSmartRefetchConfig(300_000, 'background');

  return useQuery({
    queryKey: globalTopicsKeys.pendingCount(),
    queryFn: () => globalTopicsService.getPendingAggregationCount(),
    staleTime: 60 * 1000, // 1 minute stale time
    ...refetchConfig,
  });
}

/**
 * Hook to trigger topic aggregation
 *
 * @example
 * ```tsx
 * const { mutate: aggregate, isLoading } = useAggregateTopics();
 * aggregate({ mode: 'incremental' });
 * ```
 */
export function useAggregateTopics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      mode = 'incremental',
      meetingId,
      similarityThreshold = 0.85,
    }: {
      mode?: AggregationMode;
      meetingId?: string;
      similarityThreshold?: number;
    }) => globalTopicsService.aggregateTopics(mode, meetingId, similarityThreshold),
    onSuccess: () => {
      // Invalidate all global topics queries
      queryClient.invalidateQueries({ queryKey: globalTopicsKeys.all });
    },
  });
}

/**
 * Hook to archive/unarchive a topic
 */
export function useToggleTopicArchive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      topicId,
      archive,
    }: {
      topicId: string;
      archive: boolean;
    }) => globalTopicsService.toggleTopicArchive(topicId, archive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: globalTopicsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: globalTopicsKeys.stats() });
    },
  });
}

/**
 * Hook to merge two topics
 */
export function useMergeTopics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sourceTopicId,
      targetTopicId,
    }: {
      sourceTopicId: string;
      targetTopicId: string;
    }) => globalTopicsService.mergeTopics(sourceTopicId, targetTopicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: globalTopicsKeys.all });
    },
  });
}

/**
 * Hook to update a topic
 */
export function useUpdateTopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      topicId,
      updates,
    }: {
      topicId: string;
      updates: { canonical_title?: string; canonical_description?: string };
    }) => globalTopicsService.updateTopic(topicId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: globalTopicsKeys.lists() });
    },
  });
}

/**
 * Hook to delete a topic
 */
export function useDeleteTopic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (topicId: string) => globalTopicsService.deleteTopic(topicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: globalTopicsKeys.all });
    },
  });
}

// ============================================================================
// Helper Hook for Filters
// ============================================================================

import { useState, useCallback } from 'react';

/**
 * Hook to manage global topics filters state
 *
 * @example
 * ```tsx
 * const { filters, setFilter, clearFilters, setDateRange } = useGlobalTopicsFilters();
 *
 * // Use with useGlobalTopics
 * const { data } = useGlobalTopics({ filters, sort_by: sortBy });
 * ```
 */
export function useGlobalTopicsFilters(initialFilters: GlobalTopicsFilters = {}) {
  const [filters, setFilters] = useState<GlobalTopicsFilters>(initialFilters);
  const [sortBy, setSortBy] = useState<GlobalTopicsSortBy>('relevance');
  const [page, setPage] = useState(1);

  const setFilter = useCallback(<K extends keyof GlobalTopicsFilters>(
    key: K,
    value: GlobalTopicsFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filter changes
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setPage(1);
  }, []);

  const setDateRange = useCallback((start: string | null, end: string | null) => {
    setFilters(prev => ({
      ...prev,
      date_range: start && end ? { start, end } : undefined,
    }));
    setPage(1);
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setFilters(prev => ({
      ...prev,
      search_query: query || undefined,
    }));
    setPage(1);
  }, []);

  const setCompanyFilter = useCallback((companyIds: string[]) => {
    setFilters(prev => ({
      ...prev,
      company_ids: companyIds.length > 0 ? companyIds : undefined,
    }));
    setPage(1);
  }, []);

  const setContactFilter = useCallback((contactIds: string[]) => {
    setFilters(prev => ({
      ...prev,
      contact_ids: contactIds.length > 0 ? contactIds : undefined,
    }));
    setPage(1);
  }, []);

  return {
    filters,
    sortBy,
    page,
    setFilter,
    clearFilters,
    setDateRange,
    setSearchQuery,
    setCompanyFilter,
    setContactFilter,
    setSortBy,
    setPage,
    // Build params for useGlobalTopics
    buildParams: useCallback((includeSources = false): GetGlobalTopicsParams => ({
      filters,
      sort_by: sortBy,
      page,
      page_size: 20,
      include_sources: includeSources,
    }), [filters, sortBy, page]),
  };
}
