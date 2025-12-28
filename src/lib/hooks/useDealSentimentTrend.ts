/**
 * React hooks for Deal Sentiment Trends
 *
 * Uses the deal_sentiment_trends view to aggregate sentiment data
 * across all meetings for a deal, showing how sentiment is trending over time.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { supabase } from '@/lib/supabase/clientV2';
import { useQuery } from '@tanstack/react-query';

// =====================================================
// Types
// =====================================================

export type TrendDirection = 'improving' | 'stable' | 'declining' | 'insufficient_data';

export interface DealSentimentTrend {
  deal_id: string;
  avg_sentiment: number | null;
  min_sentiment: number | null;
  max_sentiment: number | null;
  meeting_count: number;
  last_meeting_at: string | null;
  recent_avg: number | null;
  previous_avg: number | null;
  avg_talk_time_rep_pct: number | null;
  avg_coach_rating: number | null;
  sentiment_history: number[];
  trend_direction: TrendDirection;
  trend_delta: number;
}

export interface UseDealSentimentTrendResult {
  sentimentTrend: DealSentimentTrend | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface UseMultipleDealsSentimentResult {
  sentimentTrends: Map<string, DealSentimentTrend>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// =====================================================
// useDealSentimentTrend Hook
// =====================================================

/**
 * Hook to get sentiment trend for a specific deal
 */
export function useDealSentimentTrend(dealId: string | null): UseDealSentimentTrendResult {
  const [sentimentTrend, setSentimentTrend] = useState<DealSentimentTrend | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSentimentTrend = useCallback(async () => {
    if (!dealId) {
      setSentimentTrend(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('deal_sentiment_trends')
        .select('*')
        .eq('deal_id', dealId)
        .maybeSingle();

      if (queryError) throw queryError;

      setSentimentTrend(data as DealSentimentTrend | null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sentiment trend');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    fetchSentimentTrend();
  }, [fetchSentimentTrend]);

  return {
    sentimentTrend,
    loading,
    error,
    refresh: fetchSentimentTrend,
  };
}

// =====================================================
// useMultipleDealsSentiment Hook (with React Query)
// =====================================================

/**
 * Hook to get sentiment trends for multiple deals at once
 * Useful for pipeline views and deal lists
 */
export function useMultipleDealsSentiment(dealIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['deal-sentiment-trends', dealIds.sort().join(',')],
    queryFn: async () => {
      if (!dealIds.length) return new Map<string, DealSentimentTrend>();

      const { data, error } = await supabase
        .from('deal_sentiment_trends')
        .select('*')
        .in('deal_id', dealIds);

      if (error) throw error;

      // Convert to Map for easy lookup
      const trendsMap = new Map<string, DealSentimentTrend>();
      (data || []).forEach((trend: DealSentimentTrend) => {
        trendsMap.set(trend.deal_id, trend);
      });

      return trendsMap;
    },
    enabled: !!user && dealIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
}

// =====================================================
// useUserDealsSentiment Hook
// =====================================================

/**
 * Hook to get sentiment trends for all of the current user's deals
 */
export function useUserDealsSentiment() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-deals-sentiment-trends', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // First get user's deal IDs
      const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('id')
        .eq('owner_id', user.id)
        .not('stage', 'in', '("Closed Won","Closed Lost")');

      if (dealsError) throw dealsError;

      if (!deals?.length) return [];

      const dealIds = deals.map(d => d.id);

      // Get sentiment trends for these deals
      const { data: trends, error: trendsError } = await supabase
        .from('deal_sentiment_trends')
        .select('*')
        .in('deal_id', dealIds);

      if (trendsError) throw trendsError;

      return trends as DealSentimentTrend[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Get color for sentiment value
 * Sentiment ranges from -1 (negative) to +1 (positive)
 */
export function getSentimentColor(sentiment: number | null): string {
  if (sentiment === null) return 'gray';
  if (sentiment >= 0.3) return 'emerald';
  if (sentiment >= 0) return 'amber';
  if (sentiment >= -0.3) return 'orange';
  return 'red';
}

/**
 * Get color for trend direction
 */
export function getTrendColor(direction: TrendDirection): string {
  switch (direction) {
    case 'improving':
      return 'emerald';
    case 'stable':
      return 'blue';
    case 'declining':
      return 'red';
    case 'insufficient_data':
    default:
      return 'gray';
  }
}

/**
 * Get label for trend direction
 */
export function getTrendLabel(direction: TrendDirection): string {
  switch (direction) {
    case 'improving':
      return 'Improving';
    case 'stable':
      return 'Stable';
    case 'declining':
      return 'Declining';
    case 'insufficient_data':
    default:
      return 'Not enough data';
  }
}

/**
 * Get icon name for trend direction (for Lucide icons)
 */
export function getTrendIcon(direction: TrendDirection): string {
  switch (direction) {
    case 'improving':
      return 'TrendingUp';
    case 'stable':
      return 'Minus';
    case 'declining':
      return 'TrendingDown';
    case 'insufficient_data':
    default:
      return 'HelpCircle';
  }
}

/**
 * Format sentiment score as percentage
 * Converts -1 to +1 scale to 0-100%
 */
export function formatSentimentAsPercentage(sentiment: number | null): string {
  if (sentiment === null) return 'N/A';
  const percentage = Math.round(((sentiment + 1) / 2) * 100);
  return `${percentage}%`;
}

/**
 * Format sentiment score as label
 */
export function formatSentimentLabel(sentiment: number | null): string {
  if (sentiment === null) return 'Unknown';
  if (sentiment >= 0.5) return 'Very Positive';
  if (sentiment >= 0.2) return 'Positive';
  if (sentiment >= -0.2) return 'Neutral';
  if (sentiment >= -0.5) return 'Negative';
  return 'Very Negative';
}
