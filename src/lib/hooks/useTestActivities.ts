/**
 * useTestActivities Hook
 *
 * Fetches activities categorized by quality tier for skill testing.
 * Uses activity type, status, recency, and amount for quality scoring.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuth } from '@/lib/contexts/AuthContext';
import {
  calculateActivityQualityScore,
  ACTIVITY_QUALITY_THRESHOLDS,
  type ActivityQualityScore,
  type ActivityType,
  type ActivityStatus,
  type ActivityPriority,
  type EngagementQuality,
} from '@/lib/utils/activityQualityScoring';
import { type QualityTier } from '@/lib/utils/entityTestTypes';

export interface TestActivity {
  id: string;
  type: ActivityType;
  status: ActivityStatus;
  priority: ActivityPriority | null;
  client_name: string;
  details: string | null;
  amount: number | null;
  date: string | null;
  deal_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  engagement_quality: EngagementQuality | null;
  sentiment_score: number | null;
  qualityScore: ActivityQualityScore;
}

interface UseTestActivitiesOptions {
  mode: QualityTier;
  enabled?: boolean;
  limit?: number;
}

interface UseTestActivitiesReturn {
  activities: TestActivity[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch activities by quality tier
 */
async function fetchActivitiesByTier(
  userId: string,
  tier: QualityTier,
  limit: number
): Promise<TestActivity[]> {
  // Build the query to get activities
  let query = supabase
    .from('activities')
    .select(`
      id,
      type,
      status,
      priority,
      client_name,
      details,
      amount,
      date,
      deal_id,
      contact_id,
      company_id,
      engagement_quality,
      sentiment_score
    `)
    .eq('user_id', userId)
    .order('date', { ascending: false, nullsFirst: false });

  // Apply tier-specific status/type filters for efficiency
  switch (tier) {
    case 'good':
      query = query
        .in('status', ACTIVITY_QUALITY_THRESHOLDS.good.statuses)
        .in('type', ACTIVITY_QUALITY_THRESHOLDS.good.types);
      break;
    case 'bad':
      // Bad includes cancelled activities
      query = query.in('status', ['cancelled', 'pending', 'completed']);
      break;
    // For 'average', we fetch all and filter by score
  }

  const { data, error } = await query.limit(limit * 3); // Fetch more to allow scoring filter

  if (error) {
    console.error('Error fetching test activities:', error);
    throw error;
  }

  if (!data) return [];

  // Transform and filter by tier
  const activitiesWithScores = data
    .map(activity => {
      const qualityScore = calculateActivityQualityScore({
        type: activity.type as ActivityType,
        status: activity.status as ActivityStatus,
        priority: activity.priority as ActivityPriority | null,
        date: activity.date,
        amount: activity.amount,
        engagement_quality: activity.engagement_quality as EngagementQuality | null,
        sentiment_score: activity.sentiment_score,
        deal_id: activity.deal_id,
      });

      return {
        id: activity.id,
        type: activity.type as ActivityType,
        status: activity.status as ActivityStatus,
        priority: activity.priority as ActivityPriority | null,
        client_name: activity.client_name,
        details: activity.details,
        amount: activity.amount,
        date: activity.date,
        deal_id: activity.deal_id,
        contact_id: activity.contact_id,
        company_id: activity.company_id,
        engagement_quality: activity.engagement_quality as EngagementQuality | null,
        sentiment_score: activity.sentiment_score,
        qualityScore,
      };
    })
    .filter(activity => activity.qualityScore.tier === tier)
    .slice(0, limit);

  // Sort by score (descending for good, ascending for bad)
  if (tier === 'bad') {
    activitiesWithScores.sort((a, b) => a.qualityScore.score - b.qualityScore.score);
  } else {
    activitiesWithScores.sort((a, b) => b.qualityScore.score - a.qualityScore.score);
  }

  return activitiesWithScores;
}

/**
 * Hook for fetching activities by quality tier
 */
export function useTestActivities(options: UseTestActivitiesOptions): UseTestActivitiesReturn {
  const { mode, enabled = true, limit = 10 } = options;
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['test-activities', mode, user?.id, limit],
    queryFn: () => fetchActivitiesByTier(user!.id, mode, limit),
    enabled: enabled && !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    activities: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/**
 * Search activities for custom selection
 */
export async function searchTestActivities(
  userId: string,
  searchQuery: string,
  limit: number = 10
): Promise<TestActivity[]> {
  if (!searchQuery.trim()) return [];

  const { data, error } = await supabase
    .from('activities')
    .select(`
      id,
      type,
      status,
      priority,
      client_name,
      details,
      amount,
      date,
      deal_id,
      contact_id,
      company_id,
      engagement_quality,
      sentiment_score
    `)
    .eq('user_id', userId)
    .or(`client_name.ilike.%${searchQuery}%,details.ilike.%${searchQuery}%`)
    .order('date', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error('Error searching activities:', error);
    throw error;
  }

  if (!data) return [];

  return data.map(activity => {
    const qualityScore = calculateActivityQualityScore({
      type: activity.type as ActivityType,
      status: activity.status as ActivityStatus,
      priority: activity.priority as ActivityPriority | null,
      date: activity.date,
      amount: activity.amount,
      engagement_quality: activity.engagement_quality as EngagementQuality | null,
      sentiment_score: activity.sentiment_score,
      deal_id: activity.deal_id,
    });

    return {
      id: activity.id,
      type: activity.type as ActivityType,
      status: activity.status as ActivityStatus,
      priority: activity.priority as ActivityPriority | null,
      client_name: activity.client_name,
      details: activity.details,
      amount: activity.amount,
      date: activity.date,
      deal_id: activity.deal_id,
      contact_id: activity.contact_id,
      company_id: activity.company_id,
      engagement_quality: activity.engagement_quality as EngagementQuality | null,
      sentiment_score: activity.sentiment_score,
      qualityScore,
    };
  });
}
