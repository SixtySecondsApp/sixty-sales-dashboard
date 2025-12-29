import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from './useUser';
import { format, subDays } from 'date-fns';

export interface MetaAdSignup {
  id: string;
  email: string;
  name: string;
  company: string;
  date: string;
}

export interface MetaAdPerformance {
  source: string;
  source_name: string;
  medium: string;
  campaign_id: string | null;
  meta_campaign_id: string | null;
  creative_id: string | null;
  adset_id: string | null;
  landing_page: string;
  conversions: number;
  first_conversion: string;
  last_conversion: string;
  signups: MetaAdSignup[];
}

export interface MetaAdsDailySummary {
  date: string;
  source: string;
  landing_page: string;
  conversions: number;
  campaigns: number;
  creatives: number;
}

export interface MetaAdsStats {
  totalConversions: number;
  bySource: Record<string, number>;
  byLandingPage: Record<string, number>;
  byCampaign: Record<string, number>;
  byCreative: Record<string, number>;
  topPerformers: MetaAdPerformance[];
}

export function useMetaAdsAnalytics() {
  const { userData, isLoading: userLoading } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adPerformance, setAdPerformance] = useState<MetaAdPerformance[]>([]);
  const [dailySummary, setDailySummary] = useState<MetaAdsDailySummary[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 30),
    endDate: new Date(),
  });

  const isAdmin = userLoading ? null : (userData?.is_admin || false);

  const fetchAnalytics = useCallback(async () => {
    if (isAdmin === null) return;
    if (!isAdmin) {
      setError('Only administrators can view Meta Ads analytics');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch ad performance data
      const { data: performanceData, error: perfError } = await supabase
        .from('meta_ads_analytics')
        .select('*');

      if (perfError) throw new Error(perfError.message);

      // Fetch daily summary
      const { data: dailyData, error: dailyError } = await supabase
        .from('meta_ads_daily_summary')
        .select('*')
        .gte('date', format(dateRange.startDate, 'yyyy-MM-dd'))
        .lte('date', format(dateRange.endDate, 'yyyy-MM-dd'))
        .order('date', { ascending: false });

      if (dailyError) throw new Error(dailyError.message);

      setAdPerformance(performanceData || []);
      setDailySummary(dailyData || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch Meta Ads analytics';
      setError(message);
      console.error('[useMetaAdsAnalytics] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, dateRange]);

  // Calculate stats
  const stats: MetaAdsStats = {
    totalConversions: adPerformance.reduce((sum, ad) => sum + ad.conversions, 0),
    bySource: adPerformance.reduce((acc, ad) => {
      acc[ad.source_name] = (acc[ad.source_name] || 0) + ad.conversions;
      return acc;
    }, {} as Record<string, number>),
    byLandingPage: adPerformance.reduce((acc, ad) => {
      acc[ad.landing_page] = (acc[ad.landing_page] || 0) + ad.conversions;
      return acc;
    }, {} as Record<string, number>),
    byCampaign: adPerformance.reduce((acc, ad) => {
      const key = ad.meta_campaign_id || ad.campaign_id || 'Unknown';
      acc[key] = (acc[key] || 0) + ad.conversions;
      return acc;
    }, {} as Record<string, number>),
    byCreative: adPerformance.reduce((acc, ad) => {
      if (ad.creative_id) {
        acc[ad.creative_id] = (acc[ad.creative_id] || 0) + ad.conversions;
      }
      return acc;
    }, {} as Record<string, number>),
    topPerformers: [...adPerformance]
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 10),
  };

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
    adPerformance,
    dailySummary,
    stats,
    dateRange,
    setDateRange,
    refresh: fetchAnalytics,
  };
}

// Helper to get source icon/color
export function getSourceStyle(source: string): { color: string; bgColor: string } {
  const styles: Record<string, { color: string; bgColor: string }> = {
    'Facebook': { color: '#1877F2', bgColor: 'bg-blue-500/10' },
    'Instagram': { color: '#E4405F', bgColor: 'bg-pink-500/10' },
    'Audience Network': { color: '#4267B2', bgColor: 'bg-indigo-500/10' },
    'Messenger': { color: '#0084FF', bgColor: 'bg-sky-500/10' },
  };
  return styles[source] || { color: '#6B7280', bgColor: 'bg-gray-500/10' };
}

// Helper to format landing page name
export function formatLandingPage(page: string): string {
  const names: Record<string, string> = {
    '/waitlist': 'Waitlist',
    '/intro': 'Sales Rep VSL',
    '/introducing': 'Founder VSL',
    '/introduction': 'Product VSL',
  };
  return names[page] || page;
}
