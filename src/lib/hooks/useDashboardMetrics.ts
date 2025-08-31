// Cached dashboard metrics with progressive loading and comparison calculations
// Avoids recomputation until user activities change

import { useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDate, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useProgressiveDashboardData } from './useLazyActivities';
import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

interface DashboardMetrics {
  revenue: number;
  outbound: number;
  meetings: number;
  proposals: number;
}

interface DashboardComparisons {
  current: DashboardMetrics;
  previousToDate: DashboardMetrics;
  previousTotal: DashboardMetrics;
  trends: {
    revenue: number;
    outbound: number;
    meetings: number;
    proposals: number;
  };
  totalTrends: {
    revenue: number;
    outbound: number;
    meetings: number;
    proposals: number;
  };
}

// Calculate metrics from activities array
function calculateMetrics(activities: any[]): DashboardMetrics {
  if (!Array.isArray(activities)) return { revenue: 0, outbound: 0, meetings: 0, proposals: 0 };
  
  try {
    return {
      revenue: activities
        .filter(a => a.type === 'sale')
        .reduce((sum, a) => sum + (a.amount || 0), 0),
      outbound: activities
        .filter(a => a.type === 'outbound')
        .reduce((sum, a) => sum + (a.quantity || 1), 0),
      meetings: activities
        .filter(a => a.type === 'meeting')
        .reduce((sum, a) => sum + (a.quantity || 1), 0),
      proposals: activities
        .filter(a => a.type === 'proposal')
        .reduce((sum, a) => sum + (a.quantity || 1), 0),
    };
  } catch (error) {
    logger.error('Error calculating metrics:', error);
    return { revenue: 0, outbound: 0, meetings: 0, proposals: 0 };
  }
}

// Calculate trend percentage
function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function useDashboardMetrics(selectedMonth: Date, enabled: boolean = true) {
  const queryClient = useQueryClient();
  
  // Progressive data loading
  const { 
    currentMonth, 
    previousMonth, 
    isInitialLoad, 
    isLoadingComparisons,
    hasComparisons 
  } = useProgressiveDashboardData(selectedMonth, enabled);

  // Current day of month for same-day comparisons
  const currentDayOfMonth = useMemo(() => {
    try {
      return getDate(new Date());
    } catch (error) {
      logger.error('Error getting current day of month:', error);
      return 1;
    }
  }, []);

  // Cache key for metrics - includes timestamp to ensure invalidation works
  const cacheKey = [
    'dashboard-metrics', 
    selectedMonth.getFullYear(), 
    selectedMonth.getMonth(),
    currentMonth.activities?.length ?? 'loading',
    previousMonth.activities?.length ?? 'loading',
    currentDayOfMonth,
    // Add a timestamp component that changes when activities change
    currentMonth.activities ? JSON.stringify(currentMonth.activities.map(a => a.id)).slice(0, 20) : 'no-data'
  ];

  // Cached calculations - only recomputes when activities change
  const metricsQuery = useQuery({
    queryKey: cacheKey,
    queryFn: (): DashboardComparisons => {
      logger.log('🧮 Calculating dashboard metrics (cached)');
      
      // Current month metrics
      const current = calculateMetrics(currentMonth.activities || []);
      
      // Previous month activities (full month)
      const previousTotal = calculateMetrics(previousMonth.activities || []);
      
      // Previous month up to same date (for fair comparison)
      const previousToDate = calculateMetrics(
        (previousMonth.activities || []).filter(activity => {
          try {
            if (!activity?.date) return false;
            const activityDate = new Date(activity.date);
            const dayOfActivity = getDate(activityDate);
            return dayOfActivity <= currentDayOfMonth;
          } catch {
            return false;
          }
        })
      );

      // Calculate trends
      const trends = {
        revenue: calculateTrend(current.revenue, previousToDate.revenue),
        outbound: calculateTrend(current.outbound, previousToDate.outbound),
        meetings: calculateTrend(current.meetings, previousToDate.meetings),
        proposals: calculateTrend(current.proposals, previousToDate.proposals),
      };

      const totalTrends = {
        revenue: calculateTrend(current.revenue, previousTotal.revenue),
        outbound: calculateTrend(current.outbound, previousTotal.outbound),
        meetings: calculateTrend(current.meetings, previousTotal.meetings),
        proposals: calculateTrend(current.proposals, previousTotal.proposals),
      };

      return {
        current,
        previousToDate,
        previousTotal,
        trends,
        totalTrends,
      };
    },
    enabled: Boolean(enabled && currentMonth.activities !== undefined),
    staleTime: 5 * 60 * 1000, // 5 minutes - only recalculate if data actually changes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });

  // Invalidate cache when activities change
  const invalidateMetrics = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    queryClient.invalidateQueries({ queryKey: ['activities-lazy'] });
  };

  // Set up real-time subscription for activity updates
  useEffect(() => {
    if (!enabled) return;

    const setupRealtimeSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Subscribe to activities table changes for the current user
        const channel = supabase
          .channel('dashboard-activities-changes')
          .on(
            'postgres_changes',
            {
              event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
              schema: 'public',
              table: 'activities',
              filter: `user_id=eq.${user.id}`
            },
            (payload) => {
              logger.log('🔄 Real-time activity update received:', payload);
              
              // Log the type of change for debugging
              if (payload.eventType === 'INSERT') {
                logger.log('✅ New activity added:', {
                  type: payload.new?.type,
                  date: payload.new?.date,
                  amount: payload.new?.amount,
                  client: payload.new?.client_name
                });
              } else if (payload.eventType === 'UPDATE') {
                logger.log('📝 Activity updated:', payload.new);
              } else if (payload.eventType === 'DELETE') {
                logger.log('🗑️ Activity deleted:', payload.old);
              }
              
              // Invalidate queries to trigger refetch
              // Use setTimeout to ensure the database has processed the change
              setTimeout(() => {
                invalidateMetrics();
                logger.log('🔄 Invalidated metrics cache after real-time update');
              }, 100);
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              logger.log('✅ Dashboard real-time subscription active');
            }
          });

        // Cleanup subscription on unmount
        return () => {
          logger.log('🔌 Cleaning up dashboard real-time subscription');
          channel.unsubscribe();
        };
      } catch (error) {
        logger.error('Failed to set up real-time subscription:', error);
      }
    };

    const cleanupPromise = setupRealtimeSubscription();
    
    return () => {
      cleanupPromise.then(cleanup => cleanup?.());
    };
  }, [enabled, queryClient]);

  return {
    // Metrics data
    metrics: metricsQuery.data?.current || { revenue: 0, outbound: 0, meetings: 0, proposals: 0 },
    trends: metricsQuery.data?.trends || { revenue: 0, outbound: 0, meetings: 0, proposals: 0 },
    totalTrends: metricsQuery.data?.totalTrends || { revenue: 0, outbound: 0, meetings: 0, proposals: 0 },
    previousMonthTotals: metricsQuery.data?.previousTotal || { revenue: 0, outbound: 0, meetings: 0, proposals: 0 },
    
    // Loading states
    isInitialLoad, // Loading current month data
    isLoadingComparisons, // Loading previous month for comparisons
    isCalculating: metricsQuery.isLoading,
    
    // Status flags
    hasComparisons, // Whether we have previous month data
    hasMetrics: !!metricsQuery.data,
    
    // Utilities
    invalidateMetrics,
    
    // Raw data access (for other components)
    currentMonthActivities: currentMonth.activities || [],
  };
}