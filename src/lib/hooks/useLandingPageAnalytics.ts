import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from './useUser';
import { format, subDays } from 'date-fns';

export interface LandingPageAnalytics {
  date: string;
  landing_page: string;
  source: string;
  campaign: string | null;
  creative_id: string | null;
  page_views: number;
  unique_sessions: number;
  unique_visitors: number;
  partial_signups: number;
  conversions: number;
  conversion_rate: number;
  lead_capture_rate: number;
}

export interface LandingPageStats {
  totalPageViews: number;
  totalUniqueVisitors: number;
  totalPartialSignups: number;
  totalConversions: number;
  overallConversionRate: number;
  overallLeadCaptureRate: number;
  byLandingPage: Record<string, {
    page_views: number;
    unique_visitors: number;
    partial_signups: number;
    conversions: number;
    conversion_rate: number;
    lead_capture_rate: number;
    has_video: boolean;
  }>;
  bySource: Record<string, {
    page_views: number;
    partial_signups: number;
    conversions: number;
    conversion_rate: number;
  }>;
  dailyTrend: {
    date: string;
    page_views: number;
    partial_signups: number;
    conversions: number;
  }[];
}

export function useLandingPageAnalytics() {
  const { userData, isLoading: userLoading } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<LandingPageAnalytics[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
  });

  const isAdmin = userLoading ? null : (userData?.is_admin || false);

  const fetchAnalytics = useCallback(async () => {
    if (isAdmin === null) return;
    if (!isAdmin) {
      setError('Only administrators can view landing page analytics');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('landing_page_analytics')
        .select('*')
        .gte('date', format(dateRange.startDate, 'yyyy-MM-dd'))
        .lte('date', format(dateRange.endDate, 'yyyy-MM-dd'))
        .order('date', { ascending: false });

      if (fetchError) throw new Error(fetchError.message);

      setAnalytics(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch landing page analytics';
      setError(message);
      console.error('[useLandingPageAnalytics] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, dateRange]);

  // Pages with VSL videos
  const videoPages = ['/intro', '/introducing', '/introduction'];

  // Calculate stats
  const stats: LandingPageStats = {
    totalPageViews: analytics.reduce((sum, row) => sum + row.page_views, 0),
    totalUniqueVisitors: analytics.reduce((sum, row) => sum + row.unique_visitors, 0),
    totalPartialSignups: analytics.reduce((sum, row) => sum + (row.partial_signups || 0), 0),
    totalConversions: analytics.reduce((sum, row) => sum + row.conversions, 0),
    overallConversionRate: 0,
    overallLeadCaptureRate: 0,
    byLandingPage: {},
    bySource: {},
    dailyTrend: [],
  };

  // Calculate overall conversion rate
  if (stats.totalUniqueVisitors > 0) {
    stats.overallConversionRate = Math.round((stats.totalConversions / stats.totalUniqueVisitors) * 10000) / 100;
    stats.overallLeadCaptureRate = Math.round((stats.totalPartialSignups / stats.totalUniqueVisitors) * 10000) / 100;
  }

  // Aggregate by landing page
  analytics.forEach(row => {
    if (!stats.byLandingPage[row.landing_page]) {
      stats.byLandingPage[row.landing_page] = {
        page_views: 0,
        unique_visitors: 0,
        partial_signups: 0,
        conversions: 0,
        conversion_rate: 0,
        lead_capture_rate: 0,
        has_video: videoPages.includes(row.landing_page),
      };
    }
    stats.byLandingPage[row.landing_page].page_views += row.page_views;
    stats.byLandingPage[row.landing_page].unique_visitors += row.unique_visitors;
    stats.byLandingPage[row.landing_page].partial_signups += row.partial_signups || 0;
    stats.byLandingPage[row.landing_page].conversions += row.conversions;
  });

  // Calculate landing page conversion rates
  Object.keys(stats.byLandingPage).forEach(page => {
    const { unique_visitors, partial_signups, conversions } = stats.byLandingPage[page];
    if (unique_visitors > 0) {
      stats.byLandingPage[page].conversion_rate = Math.round((conversions / unique_visitors) * 10000) / 100;
      stats.byLandingPage[page].lead_capture_rate = Math.round((partial_signups / unique_visitors) * 10000) / 100;
    }
  });

  // Aggregate by source
  analytics.forEach(row => {
    if (!stats.bySource[row.source]) {
      stats.bySource[row.source] = {
        page_views: 0,
        partial_signups: 0,
        conversions: 0,
        conversion_rate: 0,
      };
    }
    stats.bySource[row.source].page_views += row.page_views;
    stats.bySource[row.source].partial_signups += row.partial_signups || 0;
    stats.bySource[row.source].conversions += row.conversions;
  });

  // Calculate source conversion rates
  Object.keys(stats.bySource).forEach(source => {
    const { page_views, conversions } = stats.bySource[source];
    if (page_views > 0) {
      stats.bySource[source].conversion_rate = Math.round((conversions / page_views) * 10000) / 100;
    }
  });

  // Build daily trend
  const dailyMap = new Map<string, { page_views: number; partial_signups: number; conversions: number }>();
  analytics.forEach(row => {
    if (!dailyMap.has(row.date)) {
      dailyMap.set(row.date, { page_views: 0, partial_signups: 0, conversions: 0 });
    }
    const day = dailyMap.get(row.date)!;
    day.page_views += row.page_views;
    day.partial_signups += row.partial_signups || 0;
    day.conversions += row.conversions;
  });

  stats.dailyTrend = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  useEffect(() => {
    if (isAdmin === true) {
      fetchAnalytics();
    }
  }, [isAdmin, fetchAnalytics]);

  return {
    loading,
    error,
    isAdmin,
    userLoading,
    analytics,
    stats,
    dateRange,
    setDateRange,
    refresh: fetchAnalytics,
  };
}

// Helper to format landing page names for display
export function formatLandingPageName(page: string): string {
  const names: Record<string, string> = {
    '/landing': 'Homepage',
    '/waitlist': 'Waitlist',
    '/intro': 'Sales Rep VSL',
    '/introducing': 'Founder VSL',
    '/introduction': 'Product VSL',
    '/join': 'Join Popup',
    '/pricing': 'Pricing',
    '/learnmore': 'Learn More',
  };
  return names[page] || page;
}

// Helper to get source styling
export function getSourceStyle(source: string): { color: string; bgColor: string } {
  const styles: Record<string, { color: string; bgColor: string }> = {
    'facebook': { color: '#1877F2', bgColor: 'bg-blue-500/10' },
    'fb': { color: '#1877F2', bgColor: 'bg-blue-500/10' },
    'ig': { color: '#E4405F', bgColor: 'bg-pink-500/10' },
    'instagram': { color: '#E4405F', bgColor: 'bg-pink-500/10' },
    'google': { color: '#4285F4', bgColor: 'bg-blue-400/10' },
    'direct': { color: '#10B981', bgColor: 'bg-green-500/10' },
    'organic': { color: '#6366F1', bgColor: 'bg-indigo-500/10' },
  };
  return styles[source.toLowerCase()] || { color: '#6B7280', bgColor: 'bg-gray-500/10' };
}
