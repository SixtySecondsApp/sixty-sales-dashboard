import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from './useUser';

/**
 * VSL Analytics data types
 */
export interface TrendData {
  date: string;
  views: number;
  watchTime: number;
}

export interface RetentionData {
  percentageWatched: number;
  viewerPercentage: number;
}

export interface VSLMetrics {
  variantId: string;
  name: string;
  route: string;
  publicId: string;
  totalViews: number;
  uniqueViewers: number;
  avgWatchTime: number;       // seconds
  completionRate: number;     // percentage
  viewersByCountry: Record<string, number>;
  viewersByDevice: Record<string, number>;
  trend: TrendData[];         // daily data
  retention: RetentionData[]; // drop-off curve
  rawData: any[];
  error?: string;
}

export interface VSLAnalyticsComparison {
  bestPerformer: string;
  totalViewsAcrossAll: number;
  avgCompletionRate: number;
}

export interface VSLAnalyticsResponse {
  success: boolean;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  variants: VSLMetrics[];
  comparison: VSLAnalyticsComparison;
  fetchedAt: string;
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
 * Format date to YYYY-MM-DD for API
 */
function formatDateForAPI(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Hook for fetching VSL analytics data from Cloudinary via our Edge Function
 */
export function useVSLAnalytics(initialDateRange?: DateRange) {
  const { userData, isLoading: userLoading } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<VSLAnalyticsResponse | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(initialDateRange || getDefaultDateRange());

  // Check if user is admin (only after user data has loaded)
  const isAdmin = userLoading ? null : (userData?.is_admin || false);

  /**
   * Fetch analytics data from the Edge Function
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
      // Get the session for auth token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        throw new Error('Not authenticated');
      }

      // Build the request URL with date parameters
      const params = new URLSearchParams({
        start_date: formatDateForAPI(currentRange.startDate),
        end_date: formatDateForAPI(currentRange.endDate),
      });

      // Call the Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cloudinary-analytics?${params}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch analytics: ${response.status}`);
      }

      const result: VSLAnalyticsResponse = await response.json();
      setData(result);
      return result;
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
   * Update the date range and refetch
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
    data,
    isAdmin,
    userLoading,
    dateRange,

    // Actions
    fetchAnalytics,
    updateDateRange,
    refresh: fetchAnalytics,

    // Preset helpers
    setLast7Days,
    setLast30Days,
    setLast90Days,
    setThisMonth,
    setLastMonth,

    // Computed
    variants: data?.variants || [],
    comparison: data?.comparison || null,
    hasData: !!data && data.variants.length > 0,
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
  const colors: Record<string, string> = {
    'intro-vsl': '#8b5cf6',      // Purple (brand-violet)
    'introducing-vsl': '#3b82f6', // Blue (brand-blue)
    'introduction-vsl': '#14b8a6', // Teal (brand-teal)
  };
  return colors[variantId] || '#6b7280';
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
