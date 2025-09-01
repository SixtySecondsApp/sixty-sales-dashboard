// Lazy loading hook for activities to improve performance
// Only loads data when explicitly requested

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/clientV2';
import type { Activity } from './useActivities';
import logger from '@/lib/utils/logger';

interface LazyActivitiesConfig {
  // Essential: Only fetch data when this is true
  enabled: boolean;
  // Date range filtering to limit data
  dateRange?: { start: Date; end: Date };
  // Limit number of records
  limit?: number;
  // Activity types to filter
  types?: Array<'sale' | 'outbound' | 'meeting' | 'proposal'>;
}

async function fetchLimitedActivities(config: LazyActivitiesConfig) {
  if (!config.enabled) {
    return [];
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = (supabase as any)
    .from('activities')
    .select(`
      *,
      deals (
        id,
        name,
        value,
        one_off_revenue,
        monthly_mrr,
        annual_value,
        stage_id
      )
    `)
    .eq('user_id', user.id);

  // Apply date range filter if provided
  if (config.dateRange) {
    // Remove logging to prevent issues
    
    query = query
      .gte('date', config.dateRange.start.toISOString())
      .lte('date', config.dateRange.end.toISOString());
  }

  // Apply type filter if provided
  if (config.types && config.types.length > 0) {
    query = query.in('type', config.types);
  }

  // Apply limit
  if (config.limit) {
    query = query.limit(config.limit);
  }

  query = query.order('date', { ascending: false });

  const { data, error } = await query;

  if (error) {
    logger.error('[fetchLimitedActivities] Query error:', error);
    throw error;
  }

  // Remove logging to prevent re-renders
  return data || [];
}

export function useLazyActivities(config: LazyActivitiesConfig = { enabled: false }) {
  const queryResult = useQuery({
    queryKey: ['activities-lazy', config],
    queryFn: () => fetchLimitedActivities(config),
    enabled: config.enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - prevent excessive refetching
    cacheTime: 10 * 60 * 1000, // 10 minutes - keep data in cache longer
    refetchOnWindowFocus: false, // Don't refetch on window focus to prevent flicker
    refetchOnMount: false, // Don't refetch on mount if we have cached data
    keepPreviousData: true, // Keep showing old data while fetching new data
  });

  return {
    ...queryResult,
    activities: queryResult.data || [],
  };
}

// Hook specifically for dashboard metrics with progressive loading
export function useDashboardActivities(currentMonth: Date, enabled: boolean = true) {
  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999);

  // Remove logging to prevent re-renders

  return useLazyActivities({
    enabled,
    dateRange: { start: startOfMonth, end: endOfMonth },
    // Removed limit to ensure all activities are fetched for accurate metrics
    // The dashboard needs all activities to calculate totals correctly
  });
}

// Hook for previous month data (loads after current month)
export function usePreviousMonthActivities(currentMonth: Date, enabled: boolean = false) {
  const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  const startOfPrevMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
  const endOfPrevMonth = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0, 23, 59, 59, 999);

  return useLazyActivities({
    enabled,
    dateRange: { start: startOfPrevMonth, end: endOfPrevMonth },
    // Removed limit to ensure all activities are fetched for accurate comparisons
  });
}

// Hook for progressive dashboard loading with comparisons
export function useProgressiveDashboardData(currentMonth: Date, enabled: boolean = true) {
  // Load current month first
  const currentMonthResult = useDashboardActivities(currentMonth, enabled);
  
  // Load previous month data after current month loads (for comparisons)
  const shouldLoadPrevious = Boolean(enabled && !currentMonthResult.isLoading && currentMonthResult.data);
  const previousMonthResult = usePreviousMonthActivities(currentMonth, shouldLoadPrevious);

  return {
    // Current month data
    currentMonth: {
      activities: currentMonthResult.activities,
      isLoading: currentMonthResult.isLoading,
      error: currentMonthResult.error,
    },
    // Previous month data
    previousMonth: {
      activities: previousMonthResult.activities,
      isLoading: previousMonthResult.isLoading,
      error: previousMonthResult.error,
    },
    // Overall loading state
    isInitialLoad: currentMonthResult.isLoading,
    isLoadingComparisons: previousMonthResult.isLoading,
    hasComparisons: previousMonthResult.data && previousMonthResult.data.length > 0,
  };
}

// Hook for recent deals (last 10 sales)
export function useRecentDeals(enabled: boolean = false) {
  return useLazyActivities({
    enabled,
    types: ['sale'],
    limit: 10,
  });
}