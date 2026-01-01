/**
 * useTestDeals Hook
 *
 * Fetches deals categorized by quality tier for skill testing.
 * Uses deal health scores to determine quality (good/average/bad).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuth } from '@/lib/contexts/AuthContext';
import {
  calculateDealQualityScore,
  DEAL_QUALITY_THRESHOLDS,
  type DealQualityScore,
} from '@/lib/utils/dealQualityScoring';
import { type QualityTier } from '@/lib/utils/entityTestTypes';

export interface TestDeal {
  id: string;
  name: string;
  company: string | null;
  contact_name: string | null;
  value: number;
  stage_name: string | null;
  stage_id: string | null;
  health_status: string | null;
  overall_health_score: number | null;
  days_in_current_stage: number | null;
  meeting_count_last_30_days: number | null;
  qualityScore: DealQualityScore;
}

interface UseTestDealsOptions {
  mode: QualityTier;
  enabled?: boolean;
  limit?: number;
}

interface UseTestDealsReturn {
  deals: TestDeal[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch deals by quality tier
 */
async function fetchDealsByTier(
  userId: string,
  tier: QualityTier,
  limit: number
): Promise<TestDeal[]> {
  // Build the query to get deals with health scores and stage info
  let query = supabase
    .from('deals')
    .select(`
      id,
      name,
      company,
      contact_name,
      value,
      stage_id,
      deal_stages!stage_id(id, name),
      deal_health_scores(
        overall_health_score,
        health_status,
        stage_velocity_score,
        engagement_score,
        sentiment_score,
        days_in_current_stage,
        meeting_count_last_30_days
      )
    `)
    .eq('owner_id', userId)
    .eq('status', 'active');

  // Exclude terminal stages (Signed/Lost)
  query = query.not('deal_stages.name', 'in', '("Signed","Lost")');

  // We'll filter by health status after fetching since it's a nested relation
  const { data, error } = await query.limit(limit * 3); // Fetch more to allow filtering

  if (error) {
    console.error('Error fetching test deals:', error);
    throw error;
  }

  if (!data) return [];

  // Transform and filter by tier
  const dealsWithScores = data
    .map(deal => {
      const healthData = Array.isArray(deal.deal_health_scores)
        ? deal.deal_health_scores[0]
        : deal.deal_health_scores;
      const stageData = deal.deal_stages as { id: string; name: string } | null;

      const qualityScore = calculateDealQualityScore({
        overall_health_score: healthData?.overall_health_score ?? null,
        health_status: healthData?.health_status ?? null,
        stage_velocity_score: healthData?.stage_velocity_score ?? null,
        engagement_score: healthData?.engagement_score ?? null,
        sentiment_score: healthData?.sentiment_score ?? null,
        days_in_current_stage: healthData?.days_in_current_stage ?? null,
        meeting_count_last_30_days: healthData?.meeting_count_last_30_days ?? null,
      });

      return {
        id: deal.id,
        name: deal.name,
        company: deal.company,
        contact_name: deal.contact_name,
        value: deal.value ?? 0,
        stage_id: deal.stage_id,
        stage_name: stageData?.name ?? null,
        health_status: healthData?.health_status ?? null,
        overall_health_score: healthData?.overall_health_score ?? null,
        days_in_current_stage: healthData?.days_in_current_stage ?? null,
        meeting_count_last_30_days: healthData?.meeting_count_last_30_days ?? null,
        qualityScore,
      };
    })
    .filter(deal => deal.qualityScore.tier === tier)
    .slice(0, limit);

  // Sort by score (descending for good, ascending for bad)
  if (tier === 'bad') {
    dealsWithScores.sort((a, b) => a.qualityScore.score - b.qualityScore.score);
  } else {
    dealsWithScores.sort((a, b) => b.qualityScore.score - a.qualityScore.score);
  }

  return dealsWithScores;
}

/**
 * Hook for fetching deals by quality tier
 */
export function useTestDeals(options: UseTestDealsOptions): UseTestDealsReturn {
  const { mode, enabled = true, limit = 10 } = options;
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['test-deals', mode, user?.id, limit],
    queryFn: () => fetchDealsByTier(user!.id, mode, limit),
    enabled: enabled && !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    deals: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/**
 * Search deals for custom selection
 */
export async function searchTestDeals(
  userId: string,
  searchQuery: string,
  limit: number = 10
): Promise<TestDeal[]> {
  if (!searchQuery.trim()) return [];

  const { data, error } = await supabase
    .from('deals')
    .select(`
      id,
      name,
      company,
      contact_name,
      value,
      stage_id,
      deal_stages!stage_id(id, name),
      deal_health_scores(
        overall_health_score,
        health_status,
        stage_velocity_score,
        engagement_score,
        sentiment_score,
        days_in_current_stage,
        meeting_count_last_30_days
      )
    `)
    .eq('owner_id', userId)
    .eq('status', 'active')
    .or(`name.ilike.%${searchQuery}%,company.ilike.%${searchQuery}%,contact_name.ilike.%${searchQuery}%`)
    .order('value', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error('Error searching deals:', error);
    throw error;
  }

  if (!data) return [];

  return data.map(deal => {
    const healthData = Array.isArray(deal.deal_health_scores)
      ? deal.deal_health_scores[0]
      : deal.deal_health_scores;
    const stageData = deal.deal_stages as { id: string; name: string } | null;

    const qualityScore = calculateDealQualityScore({
      overall_health_score: healthData?.overall_health_score ?? null,
      health_status: healthData?.health_status ?? null,
      stage_velocity_score: healthData?.stage_velocity_score ?? null,
      engagement_score: healthData?.engagement_score ?? null,
      sentiment_score: healthData?.sentiment_score ?? null,
      days_in_current_stage: healthData?.days_in_current_stage ?? null,
      meeting_count_last_30_days: healthData?.meeting_count_last_30_days ?? null,
    });

    return {
      id: deal.id,
      name: deal.name,
      company: deal.company,
      contact_name: deal.contact_name,
      value: deal.value ?? 0,
      stage_id: deal.stage_id,
      stage_name: stageData?.name ?? null,
      health_status: healthData?.health_status ?? null,
      overall_health_score: healthData?.overall_health_score ?? null,
      days_in_current_stage: healthData?.days_in_current_stage ?? null,
      meeting_count_last_30_days: healthData?.meeting_count_last_30_days ?? null,
      qualityScore,
    };
  });
}
