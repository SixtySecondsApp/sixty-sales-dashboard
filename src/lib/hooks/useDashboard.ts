import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { SmartCache } from '@/lib/cache/smartCache';
import { format } from 'date-fns';
import logger from '@/lib/utils/logger';

interface DashboardMetrics {
  activities: {
    revenue: number;
    revenueTarget: number;
    revenueTrend: number;
    outbound: number;
    outboundTarget: number;
    outboundTrend: number;
    meetings: number;
    meetingsTarget: number;
    meetingsTrend: number;
    proposals: number;
    proposalsTarget: number;
    proposalsTrend: number;
    previousMonthRevenue: number;
    previousMonthOutbound: number;
    previousMonthMeetings: number;
    previousMonthProposals: number;
  };
  mrr: {
    totalMRR: number;
    activeClients: number;
    totalClients: number;
    avgMRR: number;
    churnRate: number;
    activeRate: number;
    mrrTrend: number;
    clientTrend: number;
  };
  recentActivities: Array<{
    id: string;
    type: string;
    client_name: string;
    date: string;
    amount?: number;
    details: string;
    status: string;
  }>;
  chartData: {
    labels: string[];
    sales: number[];
    outbound: number[];
    meetings: number[];
    proposals: number[];
  };
}

// Initialize smart cache for dashboard data
const dashboardCache = new SmartCache({
  maxMemorySize: 10, // 10MB for dashboard data
  defaultTTL: 60 * 1000, // 1 minute cache
  enablePredictive: true,
});

async function fetchDashboardMetrics(month?: string): Promise<DashboardMetrics> {
  const startTime = performance.now();
  
  try {
    // Get the current session
    const { data: { session } } = await supabase.auth.getSession();
    
    logger.log('Dashboard fetch - Session status:', !!session, 'Dev mode:', import.meta.env.DEV);
    
    // TEMPORARY: Return mock data in development when no session
    if (!session && import.meta.env.DEV) {
      logger.log('🔧 Using mock dashboard data for development');
      return {
        activities: {
          revenue: 125000,
          revenueTarget: 150000,
          revenueTrend: 15,
          outbound: 250,
          outboundTarget: 300,
          outboundTrend: -5,
          meetings: 45,
          meetingsTarget: 50,
          meetingsTrend: 12,
          proposals: 18,
          proposalsTarget: 20,
          proposalsTrend: 8,
          previousMonthRevenue: 108000,
          previousMonthOutbound: 265,
          previousMonthMeetings: 40,
          previousMonthProposals: 16
        },
        mrr: {
          totalMRR: 85000,
          activeClients: 142,
          totalClients: 150,
          avgMRR: 599,
          churnRate: 5.3,
          activeRate: 94.7,
          mrrTrend: 10,
          clientTrend: 5
        },
        recentActivities: [
          { id: '1', type: 'sale', client_name: 'Acme Corp', date: new Date().toISOString(), amount: 5000, details: 'Enterprise plan', status: 'completed' },
          { id: '2', type: 'meeting', client_name: 'Tech Inc', date: new Date().toISOString(), details: 'Product demo', status: 'completed' },
          { id: '3', type: 'proposal', client_name: 'StartupXYZ', date: new Date().toISOString(), amount: 3000, details: 'Growth plan proposal', status: 'sent' },
          { id: '4', type: 'outbound', client_name: 'BigCo', date: new Date().toISOString(), details: 'Cold email', status: 'sent' },
          { id: '5', type: 'sale', client_name: 'Digital Agency', date: new Date().toISOString(), amount: 2500, details: 'Professional plan', status: 'completed' }
        ],
        chartData: {
          labels: Array.from({length: 30}, (_, i) => `Day ${i + 1}`),
          sales: Array.from({length: 30}, () => Math.floor(Math.random() * 10000)),
          outbound: Array.from({length: 30}, () => Math.floor(Math.random() * 20)),
          meetings: Array.from({length: 30}, () => Math.floor(Math.random() * 5)),
          proposals: Array.from({length: 30}, () => Math.floor(Math.random() * 3))
        }
      };
    }
    
    if (!session) {
      throw new Error('No authenticated session');
    }

    const currentMonth = month || format(new Date(), 'yyyy-MM');
    const cacheKey = `dashboard:${session.user.id}:${currentMonth}`;
    
    // Try to get from cache first
    const cachedData = await dashboardCache.get<DashboardMetrics>(
      'dashboard:metrics',
      { userId: session.user.id, month: currentMonth }
    );
    
    if (cachedData) {
      logger.log('📊 Dashboard data loaded from cache');
      return cachedData;
    }
    
    // Check if Edge Functions are enabled
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const useEdgeFunction = supabaseUrl && !import.meta.env.VITE_DISABLE_EDGE_FUNCTIONS;
    
    if (useEdgeFunction) {
      // Try Edge Function first for optimized data fetching
      try {
        const { data, error } = await supabase.functions.invoke('dashboard-metrics', {
          body: { month: currentMonth }
        });
        
        if (error) throw error;
        
        // Cache the result
        await dashboardCache.set(
          'dashboard:metrics',
          { userId: session.user.id, month: currentMonth },
          data,
          60 * 1000 // 1 minute TTL
        );
        
        const loadTime = performance.now() - startTime;
        logger.log(`✅ Dashboard metrics loaded via Edge Function in ${loadTime.toFixed(0)}ms`);
        
        return data;
      } catch (edgeError) {
        logger.warn('Edge Function failed, falling back to direct queries:', edgeError);
      }
    }
    
    // Fallback: Fetch data directly (parallel queries for performance)
    logger.log('🔄 Fetching dashboard data with parallel queries...');
    
    const monthStart = new Date(`${currentMonth}-01`);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    
    const [
      activitiesResult,
      clientsResult,
      recentResult
    ] = await Promise.all([
      // Activities for the month
      supabase
        .from('activities')
        .select('*')
        .gte('date', monthStart.toISOString())
        .lte('date', monthEnd.toISOString())
        .eq('user_id', session.user.id),
      
      // Clients for MRR
      supabase
        .from('clients')
        .select('*')
        .eq('owner_id', session.user.id),
      
      // Recent activities
      supabase
        .from('activities')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false })
        .limit(10)
    ]);
    
    if (activitiesResult.error) throw activitiesResult.error;
    if (clientsResult.error) throw clientsResult.error;
    if (recentResult.error) throw recentResult.error;
    
    const activities = activitiesResult.data || [];
    const clients = clientsResult.data || [];
    const recentActivities = recentResult.data || [];
    
    // Calculate current month metrics
    const revenue = activities
      .filter(a => a.type === 'sale')
      .reduce((sum, a) => sum + (a.amount || 0), 0);
    
    const outbound = activities.filter(a => a.type === 'outbound').length;
    const meetings = activities.filter(a => a.type === 'meeting').length;
    const proposals = activities.filter(a => a.type === 'proposal').length;
    
    // Calculate previous month metrics for trend calculation
    // Use the selected month, not current date!
    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
    const prevMonthEnd = new Date(prevMonthStart);
    prevMonthEnd.setMonth(prevMonthEnd.getMonth() + 1);
    prevMonthEnd.setDate(0);
    
    const prevActivitiesResult = await supabase
      .from('activities')
      .select('*')
      .gte('date', prevMonthStart.toISOString())
      .lte('date', prevMonthEnd.toISOString())
      .eq('user_id', session.user.id);
    
    const prevActivities = prevActivitiesResult.data || [];
    
    const previousMonthRevenue = prevActivities
      .filter(a => a.type === 'sale')
      .reduce((sum, a) => sum + (a.amount || 0), 0);
    const previousMonthOutbound = prevActivities.filter(a => a.type === 'outbound').length;
    const previousMonthMeetings = prevActivities.filter(a => a.type === 'meeting').length;
    const previousMonthProposals = prevActivities.filter(a => a.type === 'proposal').length;
    
    // Calculate trends
    const revenueTrend = previousMonthRevenue > 0 ? Math.round(((revenue - previousMonthRevenue) / previousMonthRevenue) * 100) : (revenue > 0 ? 100 : 0);
    const outboundTrend = previousMonthOutbound > 0 ? Math.round(((outbound - previousMonthOutbound) / previousMonthOutbound) * 100) : (outbound > 0 ? 100 : 0);
    const meetingsTrend = previousMonthMeetings > 0 ? Math.round(((meetings - previousMonthMeetings) / previousMonthMeetings) * 100) : (meetings > 0 ? 100 : 0);
    const proposalsTrend = previousMonthProposals > 0 ? Math.round(((proposals - previousMonthProposals) / previousMonthProposals) * 100) : (proposals > 0 ? 100 : 0);
    
    // Log for debugging
    logger.log(`📊 Dashboard Metrics for ${currentMonth}:`, {
      current: { revenue, outbound, meetings, proposals },
      previous: { previousMonthRevenue, previousMonthOutbound, previousMonthMeetings, previousMonthProposals },
      trends: { revenueTrend, outboundTrend, meetingsTrend, proposalsTrend },
      dateRange: { 
        current: `${monthStart.toISOString()} to ${monthEnd.toISOString()}`,
        previous: `${prevMonthStart.toISOString()} to ${prevMonthEnd.toISOString()}`
      }
    });
    
    const activeClients = clients.filter(c => c.status === 'active');
    const totalMRR = activeClients.reduce((sum, c) => sum + (c.subscription_amount || 0), 0);
    
    // Build response matching Edge Function structure
    const metrics: DashboardMetrics = {
      activities: {
        revenue,
        revenueTarget: 50000,
        revenueTrend,
        outbound,
        outboundTarget: 100,
        outboundTrend,
        meetings,
        meetingsTarget: 20,
        meetingsTrend,
        proposals,
        proposalsTarget: 10,
        proposalsTrend,
        previousMonthRevenue,
        previousMonthOutbound,
        previousMonthMeetings,
        previousMonthProposals
      },
      mrr: {
        totalMRR,
        activeClients: activeClients.length,
        totalClients: clients.length,
        avgMRR: activeClients.length > 0 ? totalMRR / activeClients.length : 0,
        churnRate: 0,
        activeRate: clients.length > 0 ? (activeClients.length / clients.length) * 100 : 100,
        mrrTrend: 12,
        clientTrend: 8
      },
      recentActivities: recentActivities.map(a => ({
        id: a.id,
        type: a.type,
        client_name: a.client_name,
        date: a.date,
        amount: a.amount,
        details: a.details || '',
        status: a.status
      })),
      chartData: {
        labels: [],
        sales: [],
        outbound: [],
        meetings: [],
        proposals: []
      }
    };
    
    // Cache the result
    await dashboardCache.set(
      'dashboard:metrics',
      { userId: session.user.id, month: currentMonth },
      metrics,
      60 * 1000 // 1 minute TTL
    );
    
    const loadTime = performance.now() - startTime;
    logger.log(`✅ Dashboard metrics loaded via parallel queries in ${loadTime.toFixed(0)}ms`);
    
    return metrics;
  } catch (error) {
    const loadTime = performance.now() - startTime;
    logger.error(`❌ Failed to load dashboard metrics after ${loadTime.toFixed(0)}ms:`, error);
    throw error;
  }
}

export function useDashboard(selectedMonth?: Date) {
  const queryClient = useQueryClient();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const monthKey = selectedMonth ? format(selectedMonth, 'yyyy-MM') : format(new Date(), 'yyyy-MM');
  
  // Main query for dashboard data
  const {
    data: metrics,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['dashboard', monthKey],
    queryFn: () => fetchDashboardMetrics(monthKey),
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute
    refetchOnWindowFocus: false, // Don't refetch on window focus
    onSuccess: () => {
      setIsInitialLoad(false);
    },
    // Enable optimistic updates
    placeholderData: () => {
      const cached = queryClient.getQueryData<DashboardMetrics>(['dashboard', monthKey]);
      return cached;
    }
  });
  
  // Prefetch next/previous month data for smooth navigation
  useEffect(() => {
    if (!selectedMonth) return;
    
    const prevMonth = new Date(selectedMonth);
    prevMonth.setMonth(prevMonth.getMonth() - 1);
    const prevMonthKey = format(prevMonth, 'yyyy-MM');
    
    const nextMonth = new Date(selectedMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthKey = format(nextMonth, 'yyyy-MM');
    
    // Prefetch adjacent months
    queryClient.prefetchQuery({
      queryKey: ['dashboard', prevMonthKey],
      queryFn: () => fetchDashboardMetrics(prevMonthKey),
      staleTime: 30 * 1000,
    });
    
    if (nextMonth <= new Date()) {
      queryClient.prefetchQuery({
        queryKey: ['dashboard', nextMonthKey],
        queryFn: () => fetchDashboardMetrics(nextMonthKey),
        staleTime: 30 * 1000,
      });
    }
  }, [selectedMonth, queryClient]);
  
  // Memoized values for components
  const activities = useMemo(() => metrics?.activities || {
    revenue: 0,
    revenueTarget: 50000,
    revenueTrend: 0,
    outbound: 0,
    outboundTarget: 100,
    outboundTrend: 0,
    meetings: 0,
    meetingsTarget: 20,
    meetingsTrend: 0,
    proposals: 0,
    proposalsTarget: 10,
    proposalsTrend: 0,
    previousMonthRevenue: 0,
    previousMonthOutbound: 0,
    previousMonthMeetings: 0,
    previousMonthProposals: 0
  }, [metrics]);
  
  const mrr = useMemo(() => metrics?.mrr || {
    totalMRR: 0,
    activeClients: 0,
    totalClients: 0,
    avgMRR: 0,
    churnRate: 0,
    activeRate: 100,
    mrrTrend: 0,
    clientTrend: 0
  }, [metrics]);
  
  const recentActivities = useMemo(() => metrics?.recentActivities || [], [metrics]);
  const chartData = useMemo(() => metrics?.chartData || {
    labels: [],
    sales: [],
    outbound: [],
    meetings: [],
    proposals: []
  }, [metrics]);
  
  return {
    activities,
    mrr,
    recentActivities,
    chartData,
    isLoading: isInitialLoad && isLoading,
    isRefreshing: !isInitialLoad && isLoading,
    error,
    refetch
  };
}