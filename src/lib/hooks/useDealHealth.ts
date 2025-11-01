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

// =====================================================
// useContactDealHealth Hook
// =====================================================

/**
 * Hook to get aggregated health scores for all deals related to a contact
 */
export function useContactDealHealth(contactId: string | null) {
  const { user } = useAuth();
  const [healthScores, setHealthScores] = useState<DealHealthScore[]>([]);
  const [aggregateStats, setAggregateStats] = useState({
    totalDeals: 0,
    avgHealth: 0,
    healthy: 0,
    warning: 0,
    critical: 0,
    stalled: 0,
    activeAlerts: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContactHealth = useCallback(async () => {
    if (!contactId || !user) {
      setHealthScores([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get all deals for this contact
      const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('id')
        .or(`contact_email.eq.${contactId},contact_id.eq.${contactId}`)
        .eq('owner_id', user.id);

      if (dealsError) throw dealsError;

      if (!deals || deals.length === 0) {
        setHealthScores([]);
        setAggregateStats({
          totalDeals: 0,
          avgHealth: 0,
          healthy: 0,
          warning: 0,
          critical: 0,
          stalled: 0,
          activeAlerts: 0,
        });
        return;
      }

      // Get health scores for these deals
      const dealIds = deals.map((d) => d.id);
      const { data: scores, error: scoresError } = await supabase
        .from('deal_health_scores')
        .select('*')
        .in('deal_id', dealIds);

      if (scoresError) throw scoresError;

      setHealthScores(scores || []);

      // Calculate aggregate stats
      const total = scores?.length || 0;
      const avgHealth =
        total > 0
          ? Math.round(
              scores.reduce((sum, s) => sum + s.overall_health_score, 0) / total
            )
          : 0;

      const healthy = scores?.filter((s) => s.health_status === 'healthy').length || 0;
      const warning = scores?.filter((s) => s.health_status === 'warning').length || 0;
      const critical = scores?.filter((s) => s.health_status === 'critical').length || 0;
      const stalled = scores?.filter((s) => s.health_status === 'stalled').length || 0;

      // Get active alerts count
      const { data: alerts } = await supabase
        .from('deal_health_alerts')
        .select('id', { count: 'exact', head: true })
        .in('deal_id', dealIds)
        .eq('status', 'active');

      setAggregateStats({
        totalDeals: total,
        avgHealth,
        healthy,
        warning,
        critical,
        stalled,
        activeAlerts: alerts?.length || 0,
      });
    } catch (err) {
      console.error('[useContactDealHealth] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch contact health');
    } finally {
      setLoading(false);
    }
  }, [contactId, user]);

  useEffect(() => {
    fetchContactHealth();
  }, [fetchContactHealth]);

  return {
    healthScores,
    aggregateStats,
    loading,
    error,
    refresh: fetchContactHealth,
  };
}

// =====================================================
// useCompanyDealHealth Hook
// =====================================================

/**
 * Hook to get aggregated health scores for all deals related to a company
 */
export function useCompanyDealHealth(companyId: string | null) {
  const { user } = useAuth();
  const [healthScores, setHealthScores] = useState<DealHealthScore[]>([]);
  const [aggregateStats, setAggregateStats] = useState({
    totalDeals: 0,
    avgHealth: 0,
    healthy: 0,
    warning: 0,
    critical: 0,
    stalled: 0,
    activeAlerts: 0,
    totalValue: 0,
    atRiskValue: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanyHealth = useCallback(async () => {
    if (!companyId || !user) {
      setHealthScores([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get all deals for this company
      const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select('id, value, company')
        .or(`company.eq.${companyId},company_id.eq.${companyId}`)
        .eq('owner_id', user.id);

      if (dealsError) throw dealsError;

      if (!deals || deals.length === 0) {
        setHealthScores([]);
        setAggregateStats({
          totalDeals: 0,
          avgHealth: 0,
          healthy: 0,
          warning: 0,
          critical: 0,
          stalled: 0,
          activeAlerts: 0,
          totalValue: 0,
          atRiskValue: 0,
        });
        return;
      }

      // Get health scores for these deals
      const dealIds = deals.map((d) => d.id);
      const { data: scores, error: scoresError } = await supabase
        .from('deal_health_scores')
        .select('*')
        .in('deal_id', dealIds);

      if (scoresError) throw scoresError;

      setHealthScores(scores || []);

      // Calculate aggregate stats
      const total = scores?.length || 0;
      const avgHealth =
        total > 0
          ? Math.round(
              scores.reduce((sum, s) => sum + s.overall_health_score, 0) / total
            )
          : 0;

      const healthy = scores?.filter((s) => s.health_status === 'healthy').length || 0;
      const warning = scores?.filter((s) => s.health_status === 'warning').length || 0;
      const critical = scores?.filter((s) => s.health_status === 'critical').length || 0;
      const stalled = scores?.filter((s) => s.health_status === 'stalled').length || 0;

      // Calculate total value and at-risk value
      const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
      const atRiskDealIds = scores
        ?.filter((s) => s.health_status === 'critical' || s.health_status === 'stalled')
        .map((s) => s.deal_id) || [];
      const atRiskValue = deals
        .filter((d) => atRiskDealIds.includes(d.id))
        .reduce((sum, d) => sum + (d.value || 0), 0);

      // Get active alerts count
      const { data: alerts } = await supabase
        .from('deal_health_alerts')
        .select('id', { count: 'exact', head: true })
        .in('deal_id', dealIds)
        .eq('status', 'active');

      setAggregateStats({
        totalDeals: total,
        avgHealth,
        healthy,
        warning,
        critical,
        stalled,
        activeAlerts: alerts?.length || 0,
        totalValue,
        atRiskValue,
      });
    } catch (err) {
      console.error('[useCompanyDealHealth] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch company health');
    } finally {
      setLoading(false);
    }
  }, [companyId, user]);

  useEffect(() => {
    fetchCompanyHealth();
  }, [fetchCompanyHealth]);

  return {
    healthScores,
    aggregateStats,
    loading,
    error,
    refresh: fetchCompanyHealth,
  };
}
