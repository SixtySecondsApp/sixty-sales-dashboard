/**
 * useBatchedDealMetadata Hook
 *
 * Efficiently fetches next actions and health scores for multiple deals in batched queries
 * to prevent N+1 query problems and resource exhaustion.
 *
 * Instead of making individual API calls per deal card, this hook:
 * 1. Fetches all next actions for all deals in ONE query
 * 2. Fetches all health scores for all deals in ONE query
 * 3. Indexes the results by deal_id for O(1) lookups
 * 4. Caches results with React Query
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/contexts/AuthContext';
import { supabase } from '@/lib/supabase/clientV2';

interface NextActionMetadata {
  pendingCount: number;
  highUrgencyCount: number;
}

interface HealthScoreMetadata {
  overall_health_score: number;
  health_status: 'healthy' | 'warning' | 'critical' | 'stalled';
}

interface BatchedDealMetadata {
  nextActions: Record<string, NextActionMetadata>;
  healthScores: Record<string, HealthScoreMetadata>;
}

/**
 * Fetch next action statistics for all deals in a single query
 */
async function fetchBatchedNextActions(
  userId: string,
  dealIds: string[]
): Promise<Record<string, NextActionMetadata>> {
  if (dealIds.length === 0) {
    return {};
  }

  try {
    // Fetch all pending next actions for these deals in ONE query
    const { data, error } = await supabase
      .from('next_action_suggestions')
      .select('deal_id, urgency, status')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .in('deal_id', dealIds);

    if (error) {
      return {};
    }

    // Index by deal_id for O(1) lookups
    const indexed: Record<string, NextActionMetadata> = {};

    dealIds.forEach(dealId => {
      const dealActions = (data || []).filter(action => action.deal_id === dealId);

      indexed[dealId] = {
        pendingCount: dealActions.length,
        highUrgencyCount: dealActions.filter(action => action.urgency === 'high').length,
      };
    });

    return indexed;
  } catch (error) {
    return {};
  }
}

/**
 * Fetch health scores for all deals in a single query
 */
async function fetchBatchedHealthScores(
  dealIds: string[]
): Promise<Record<string, HealthScoreMetadata>> {
  if (dealIds.length === 0) {
    return {};
  }

  try {
    // Check if table exists by attempting a count query first
    const { error: tableError } = await supabase
      .from('deal_health_scores')
      .select('id', { count: 'exact', head: true })
      .limit(0);

    // If table doesn't exist or RLS blocks access, return empty
    if (tableError) {
      return {};
    }

    // Fetch all health scores for these deals in ONE query
    const { data, error } = await supabase
      .from('deal_health_scores')
      .select('deal_id, overall_health_score, health_status')
      .in('deal_id', dealIds);

    if (error) {
      return {};
    }

    // Index by deal_id for O(1) lookups
    const indexed: Record<string, HealthScoreMetadata> = {};

    (data || []).forEach(score => {
      indexed[score.deal_id] = {
        overall_health_score: score.overall_health_score,
        health_status: score.health_status,
      };
    });

    return indexed;
  } catch (error) {
    return {};
  }
}

/**
 * Hook to batch-fetch metadata for multiple deals
 */
export function useBatchedDealMetadata(dealIds: string[]) {
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['batchedDealMetadata', dealIds.sort().join(','), user?.id],
    queryFn: async () => {
      if (!user) {
        return { nextActions: {}, healthScores: {} };
      }

      // Batch both queries in parallel
      const [nextActions, healthScores] = await Promise.all([
        fetchBatchedNextActions(user.id, dealIds),
        fetchBatchedHealthScores(dealIds),
      ]);

      return { nextActions, healthScores };
    },
    enabled: !!user && dealIds.length > 0,
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 60000, // Keep in cache for 1 minute after becoming stale
    refetchOnWindowFocus: false, // Prevent excessive refetching
  });

  return {
    data: data || { nextActions: {}, healthScores: {} },
    isLoading,
    error,
    refetch,
  };
}

/**
 * Helper hook to get metadata for a single deal from batched data
 */
export function useDealMetadata(dealId: string, batchedData: BatchedDealMetadata) {
  return {
    nextActions: batchedData.nextActions[dealId] || { pendingCount: 0, highUrgencyCount: 0 },
    healthScore: batchedData.healthScores[dealId] || null,
  };
}
