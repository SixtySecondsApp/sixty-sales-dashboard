/**
 * React hooks for Deal Health Monitoring
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { supabase } from '@/lib/supabase/clientV2';
import {
  calculateDealHealth,
  calculateAllDealsHealth,
  getDealHealthScore,
  getUserDealsHealthScores,
  type DealHealthScore,
} from '@/lib/services/dealHealthService';
import {
  generateAlertsForDeal,
  generateAlertsForAllDeals,
  getActiveAlerts,
  getDealAlerts,
  acknowledgeAlert,
  resolveAlert,
  dismissAlert,
  getAlertStats,
  type DealHealthAlert,
} from '@/lib/services/dealHealthAlertService';
import { toast } from 'sonner';

// =====================================================
// useDealHealthScore Hook
// =====================================================

/**
 * Hook to get and manage health score for a specific deal
 */
export function useDealHealthScore(dealId: string | null) {
  const [healthScore, setHealthScore] = useState<DealHealthScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch health score
  const fetchHealthScore = useCallback(async () => {
    if (!dealId) {
      setHealthScore(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const score = await getDealHealthScore(dealId);
      setHealthScore(score);
    } catch (err) {
      console.error('[useDealHealthScore] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch health score');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  // Calculate health score (refresh)
  const calculateHealth = useCallback(async () => {
    if (!dealId) return;

    try {
      setLoading(true);
      setError(null);

      const score = await calculateDealHealth(dealId);
      setHealthScore(score);

      // Generate alerts based on new score
      if (score) {
        await generateAlertsForDeal(dealId, score);
      }

      toast.success('Health score updated');
    } catch (err) {
      console.error('[useDealHealthScore] Error calculating:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate health score');
      toast.error('Failed to update health score');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!dealId) return;

    fetchHealthScore();

    const channel = supabase
      .channel(`deal_health:${dealId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deal_health_scores',
          filter: `deal_id=eq.${dealId}`,
        },
        (payload) => {
          console.log('[useDealHealthScore] Real-time update:', payload);
          if (payload.eventType === 'DELETE') {
            setHealthScore(null);
          } else {
            setHealthScore(payload.new as DealHealthScore);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [dealId, fetchHealthScore]);

  return {
    healthScore,
    loading,
    error,
    refresh: fetchHealthScore,
    calculateHealth,
  };
}

// =====================================================
// useUserDealsHealth Hook
// =====================================================

/**
 * Hook to get health scores for all user's deals
 */
export function useUserDealsHealth() {
  const { user } = useAuth();
  const [healthScores, setHealthScores] = useState<DealHealthScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch health scores
  const fetchHealthScores = useCallback(async () => {
    if (!user) {
      setHealthScores([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const scores = await getUserDealsHealthScores(user.id);
      setHealthScores(scores);
    } catch (err) {
      console.error('[useUserDealsHealth] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch health scores');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Calculate health for all deals
  const calculateAllHealth = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const scores = await calculateAllDealsHealth(user.id);
      setHealthScores(scores);

      // Generate alerts for all deals
      await generateAlertsForAllDeals(user.id);

      toast.success(`Health calculated for ${scores.length} deals`);
    } catch (err) {
      console.error('[useUserDealsHealth] Error calculating:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate health scores');
      toast.error('Failed to calculate health scores');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    fetchHealthScores();

    const channel = supabase
      .channel(`user_deals_health:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deal_health_scores',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[useUserDealsHealth] Real-time update:', payload);
          fetchHealthScores(); // Refresh all scores
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, fetchHealthScores]);

  return {
    healthScores,
    loading,
    error,
    refresh: fetchHealthScores,
    calculateAllHealth,
  };
}

// =====================================================
// useDealHealthAlerts Hook
// =====================================================

/**
 * Hook to manage alerts for a specific deal
 */
export function useDealHealthAlerts(dealId: string | null) {
  const [alerts, setAlerts] = useState<DealHealthAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    if (!dealId) {
      setAlerts([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await getDealAlerts(dealId);
      setAlerts(data);
    } catch (err) {
      console.error('[useDealHealthAlerts] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!dealId) return;

    fetchAlerts();

    const channel = supabase
      .channel(`deal_alerts:${dealId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deal_health_alerts',
          filter: `deal_id=eq.${dealId}`,
        },
        (payload) => {
          console.log('[useDealHealthAlerts] Real-time update:', payload);
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [dealId, fetchAlerts]);

  return {
    alerts,
    loading,
    error,
    refresh: fetchAlerts,
  };
}

// =====================================================
// useActiveAlerts Hook
// =====================================================

/**
 * Hook to get and manage active alerts for current user
 */
export function useActiveAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<DealHealthAlert[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    warning: 0,
    info: 0,
    byType: {} as Record<string, number>,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    if (!user) {
      setAlerts([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [alertsData, statsData] = await Promise.all([
        getActiveAlerts(user.id),
        getAlertStats(user.id),
      ]);

      setAlerts(alertsData);
      setStats(statsData);
    } catch (err) {
      console.error('[useActiveAlerts] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Acknowledge alert
  const acknowledge = useCallback(
    async (alertId: string) => {
      if (!user) return false;

      try {
        const success = await acknowledgeAlert(alertId, user.id);
        if (success) {
          toast.success('Alert acknowledged');
          fetchAlerts();
        }
        return success;
      } catch (err) {
        console.error('[useActiveAlerts] Error acknowledging:', err);
        toast.error('Failed to acknowledge alert');
        return false;
      }
    },
    [user, fetchAlerts]
  );

  // Resolve alert
  const resolve = useCallback(
    async (alertId: string) => {
      try {
        const success = await resolveAlert(alertId);
        if (success) {
          toast.success('Alert resolved');
          fetchAlerts();
        }
        return success;
      } catch (err) {
        console.error('[useActiveAlerts] Error resolving:', err);
        toast.error('Failed to resolve alert');
        return false;
      }
    },
    [fetchAlerts]
  );

  // Dismiss alert
  const dismiss = useCallback(
    async (alertId: string) => {
      try {
        const success = await dismissAlert(alertId);
        if (success) {
          toast.success('Alert dismissed');
          fetchAlerts();
        }
        return success;
      } catch (err) {
        console.error('[useActiveAlerts] Error dismissing:', err);
        toast.error('Failed to dismiss alert');
        return false;
      }
    },
    [fetchAlerts]
  );

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    fetchAlerts();

    const channel = supabase
      .channel(`active_alerts:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deal_health_alerts',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[useActiveAlerts] Real-time update:', payload);
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, fetchAlerts]);

  return {
    alerts,
    stats,
    loading,
    error,
    refresh: fetchAlerts,
    acknowledge,
    resolve,
    dismiss,
  };
}
