import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from './useUser';
import { startOfDay, format } from 'date-fns';

/**
 * VSL variant configuration
 */
export const VSL_VARIANTS = {
  'intro-vsl': {
    name: 'Sales Rep Version',
    route: '/intro',
    publicId: '60 VSL - Waitlist/Videos for waitlist launch/VSL_Sales_Version_xmfmf0',
    color: '#8B5CF6', // violet
  },
  'introducing-vsl': {
    name: 'Founder Version',
    route: '/introducing',
    publicId: '60 VSL - Waitlist/Videos for waitlist launch/VSL_Founder_Version_gopdl9',
    color: '#3B82F6', // blue
  },
  'introduction-vsl': {
    name: 'Product Version',
    route: '/introduction',
    publicId: '60 VSL - Waitlist/Videos for waitlist launch/VSL_Drues_Version_jlhqog',
    color: '#14B8A6', // teal
  },
} as const;

export type VSLVariantId = keyof typeof VSL_VARIANTS;

/**
 * VSL Analytics data types
 */
export interface TrendData {
  date: string;
  views: number;
  plays: number;
  completions: number;
  watchTime: number;
}

export interface RetentionData {
  milestone: number; // 25, 50, 75, 100
  viewerPercentage: number;
}

export interface VSLMetrics {
  variantId: VSLVariantId;
  name: string;
  route: string;
  publicId: string;
  color: string;
  // Totals
  totalViews: number;
  uniqueViews: number;
  totalPlays: number;
  uniquePlays: number;
  completions: number;
  // Rates
  playRate: number;       // percentage of views that played
  completionRate: number; // percentage of plays that completed
  // Watch metrics
  avgWatchTime: number;   // seconds
  avgCompletionPercent: number;
  // Milestone retention
  reached25: number;
  reached50: number;
  reached75: number;
  // Trend data
  trend: TrendData[];
  retention: RetentionData[];
}

export interface VSLAnalyticsComparison {
  bestByViews: VSLVariantId | null;
  bestByCompletionRate: VSLVariantId | null;
  bestByWatchTime: VSLVariantId | null;
  totalViewsAcrossAll: number;
  avgCompletionRate: number;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Default date range: Last 30 days
 */
function getDefaultDateRange(): DateRange {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  return { startDate, endDate };
}

/**
 * Hook for fetching VSL analytics data from Supabase
 */
export function useVSLAnalytics(initialDateRange?: DateRange) {
  const { userData, isLoading: userLoading } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawData, setRawData] = useState<any[] | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(initialDateRange || getDefaultDateRange());

  // Check if user is admin (only after user data has loaded)
  const isAdmin = userLoading ? null : (userData?.is_admin || false);

  /**
   * Fetch analytics data from Supabase
   */
  const fetchAnalytics = useCallback(async (range?: DateRange) => {
    if (isAdmin === null) {
      // User data still loading, wait
      return null;
    }
    if (!isAdmin) {
      setError('Only administrators can view VSL analytics');
      return null;
    }

    const currentRange = range || dateRange;
    setLoading(true);
    setError(null);

    try {
      // Query the summary view
      const { data, error: queryError } = await supabase
        .from('vsl_analytics_summary')
        .select('*')
        .gte('date', format(startOfDay(currentRange.startDate), 'yyyy-MM-dd'))
        .lte('date', format(startOfDay(currentRange.endDate), 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (queryError) {
        throw new Error(queryError.message);
      }

      setRawData(data || []);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch VSL analytics';
      setError(message);
      console.error('[useVSLAnalytics] Error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAdmin, dateRange]);

  /**
   * Process raw data into variant metrics
   */
  const variants = useMemo<VSLMetrics[]>(() => {
    if (!rawData) return [];

    // Group data by variant
    const variantDataMap = new Map<VSLVariantId, any[]>();

    for (const row of rawData) {
      const variantId = row.signup_source as VSLVariantId;
      if (!VSL_VARIANTS[variantId]) continue;

      if (!variantDataMap.has(variantId)) {
        variantDataMap.set(variantId, []);
      }
      variantDataMap.get(variantId)!.push(row);
    }

    // Calculate metrics for each variant
    return Object.entries(VSL_VARIANTS).map(([variantId, config]) => {
      const dailyData = variantDataMap.get(variantId as VSLVariantId) || [];

      // Aggregate totals
      const totals = dailyData.reduce(
        (acc, day) => ({
          uniqueViews: acc.uniqueViews + (day.unique_views || 0),
          totalViews: acc.totalViews + (day.total_views || 0),
          uniquePlays: acc.uniquePlays + (day.unique_plays || 0),
          totalPlays: acc.totalPlays + (day.total_plays || 0),
          completions: acc.completions + (day.completions || 0),
          reached25: acc.reached25 + (day.reached_25 || 0),
          reached50: acc.reached50 + (day.reached_50 || 0),
          reached75: acc.reached75 + (day.reached_75 || 0),
          watchTimeSum: acc.watchTimeSum + (day.avg_watch_time || 0),
          completionPercentSum: acc.completionPercentSum + (day.avg_completion_percent || 0),
          daysWithData: acc.daysWithData + (day.avg_watch_time !== null ? 1 : 0),
        }),
        {
          uniqueViews: 0,
          totalViews: 0,
          uniquePlays: 0,
          totalPlays: 0,
          completions: 0,
          reached25: 0,
          reached50: 0,
          reached75: 0,
          watchTimeSum: 0,
          completionPercentSum: 0,
          daysWithData: 0,
        }
      );

      // Calculate averages and rates
      const avgWatchTime =
        totals.daysWithData > 0 ? totals.watchTimeSum / totals.daysWithData : 0;
      const avgCompletionPercent =
        totals.daysWithData > 0 ? totals.completionPercentSum / totals.daysWithData : 0;
      const playRate =
        totals.uniqueViews > 0 ? (totals.uniquePlays / totals.uniqueViews) * 100 : 0;
      const completionRate =
        totals.uniquePlays > 0 ? (totals.completions / totals.uniquePlays) * 100 : 0;

      // Build trend data
      const trend: TrendData[] = dailyData.map((day) => ({
        date: day.date,
        views: day.unique_views || 0,
        plays: day.unique_plays || 0,
        completions: day.completions || 0,
        watchTime: day.avg_watch_time || 0,
      }));

      // Build retention curve
      const retention: RetentionData[] = totals.uniquePlays > 0
        ? [
            { milestone: 25, viewerPercentage: Math.round((totals.reached25 / totals.uniquePlays) * 100) },
            { milestone: 50, viewerPercentage: Math.round((totals.reached50 / totals.uniquePlays) * 100) },
            { milestone: 75, viewerPercentage: Math.round((totals.reached75 / totals.uniquePlays) * 100) },
            { milestone: 100, viewerPercentage: Math.round((totals.completions / totals.uniquePlays) * 100) },
          ]
        : [];

      return {
        variantId: variantId as VSLVariantId,
        name: config.name,
        route: config.route,
        publicId: config.publicId,
        color: config.color,
        totalViews: totals.totalViews,
        uniqueViews: totals.uniqueViews,
        totalPlays: totals.totalPlays,
        uniquePlays: totals.uniquePlays,
        completions: totals.completions,
        playRate: Math.round(playRate * 10) / 10,
        completionRate: Math.round(completionRate * 10) / 10,
        avgWatchTime: Math.round(avgWatchTime * 10) / 10,
        avgCompletionPercent: Math.round(avgCompletionPercent * 10) / 10,
        reached25: totals.reached25,
        reached50: totals.reached50,
        reached75: totals.reached75,
        trend,
        retention,
      };
    });
  }, [rawData]);

  /**
   * Calculate comparison metrics
   */
  const comparison = useMemo<VSLAnalyticsComparison>(() => {
    const variantsWithData = variants.filter((v) => v.uniqueViews > 0);

    const totalViewsAcrossAll = variants.reduce((sum, v) => sum + v.uniqueViews, 0);
    const avgCompletionRate =
      variantsWithData.length > 0
        ? variantsWithData.reduce((sum, v) => sum + v.completionRate, 0) / variantsWithData.length
        : 0;

    return {
      bestByViews: variantsWithData.length > 0
        ? variantsWithData.reduce((best, v) =>
            v.uniqueViews > best.uniqueViews ? v : best
          ).variantId
        : null,
      bestByCompletionRate: variantsWithData.length > 0
        ? variantsWithData.reduce((best, v) =>
            v.completionRate > best.completionRate ? v : best
          ).variantId
        : null,
      bestByWatchTime: variantsWithData.length > 0
        ? variantsWithData.reduce((best, v) =>
            v.avgWatchTime > best.avgWatchTime ? v : best
          ).variantId
        : null,
      totalViewsAcrossAll,
      avgCompletionRate: Math.round(avgCompletionRate * 10) / 10,
    };
  }, [variants]);

  /**
   * Update the date range
   */
  const updateDateRange = useCallback((newRange: DateRange) => {
    setDateRange(newRange);
  }, []);

  /**
   * Preset date range helpers
   */
  const setLast7Days = useCallback(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    setDateRange({ startDate, endDate });
  }, []);

  const setLast30Days = useCallback(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    setDateRange({ startDate, endDate });
  }, []);

  const setLast90Days = useCallback(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    setDateRange({ startDate, endDate });
  }, []);

  const setThisMonth = useCallback(() => {
    const endDate = new Date();
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    setDateRange({ startDate, endDate });
  }, []);

  const setLastMonth = useCallback(() => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
    setDateRange({ startDate, endDate });
  }, []);

  // Auto-fetch when date range changes (only after user data has loaded)
  useEffect(() => {
    if (isAdmin === true) {
      fetchAnalytics();
    }
  }, [dateRange, isAdmin, fetchAnalytics]);

  return {
    // State
    loading,
    error,
    isAdmin,
    userLoading,
    dateRange,

    // Data
    variants,
    comparison,
    hasData: variants.some((v) => v.uniqueViews > 0),

    // Actions
    fetchAnalytics,
    updateDateRange,
    refresh: () => fetchAnalytics(),

    // Preset helpers
    setLast7Days,
    setLast30Days,
    setLast90Days,
    setThisMonth,
    setLastMonth,
  };
}

/**
 * Helper to format watch time in human readable format
 */
export function formatWatchTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Helper to format percentage
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Get variant color for charts
 */
export function getVariantColor(variantId: string): string {
  const variant = VSL_VARIANTS[variantId as VSLVariantId];
  return variant?.color || '#6B7280';
}

/**
 * Get variant badge/label color classes
 */
export function getVariantColorClasses(variantId: string): string {
  const classes: Record<string, string> = {
    'intro-vsl': 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    'introducing-vsl': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'introduction-vsl': 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  };
  return classes[variantId] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
}
