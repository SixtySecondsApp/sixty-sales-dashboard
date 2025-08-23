import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
import { corsHeaders } from '../_shared/cors.ts';

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

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's token
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse query parameters for date range
    const url = new URL(req.url);
    const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
    
    // Calculate date ranges
    const startOfMonth = new Date(`${month}-01`);
    const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
    const startOfPrevMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), 0);
    
    // Get current day for month-to-date comparisons
    const currentDay = new Date().getDate();
    const prevMonthCutoff = new Date(startOfPrevMonth);
    prevMonthCutoff.setDate(Math.min(currentDay, endOfPrevMonth.getDate()));

    // Fetch all data in parallel
    const [
      activitiesResult,
      prevActivitiesResult,
      clientsResult,
      targetsResult,
      recentActivitiesResult
    ] = await Promise.all([
      // Current month activities
      supabaseClient
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startOfMonth.toISOString())
        .lte('date', endOfMonth.toISOString()),
      
      // Previous month activities (up to same day)
      supabaseClient
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startOfPrevMonth.toISOString())
        .lte('date', prevMonthCutoff.toISOString()),
      
      // Clients for MRR calculation
      supabaseClient
        .from('clients')
        .select('*')
        .eq('owner_id', user.id),
      
      // Targets (mocked for now)
      Promise.resolve({ data: {
        revenue: 50000,
        outbound: 100,
        meetings: 20,
        proposals: 10
      }}),
      
      // Recent activities for display
      supabaseClient
        .from('activities')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(10)
    ]);

    // Process activities data
    const activities = activitiesResult.data || [];
    const prevActivities = prevActivitiesResult.data || [];
    
    // Calculate current month metrics
    const revenue = activities
      .filter(a => a.type === 'sale')
      .reduce((sum, a) => sum + (a.amount || 0), 0);
    
    const outbound = activities
      .filter(a => a.type === 'outbound')
      .length;
    
    const meetings = activities
      .filter(a => a.type === 'meeting')
      .length;
    
    const proposals = activities
      .filter(a => a.type === 'proposal')
      .length;
    
    // Calculate previous month metrics
    const prevRevenue = prevActivities
      .filter(a => a.type === 'sale')
      .reduce((sum, a) => sum + (a.amount || 0), 0);
    
    const prevOutbound = prevActivities
      .filter(a => a.type === 'outbound')
      .length;
    
    const prevMeetings = prevActivities
      .filter(a => a.type === 'meeting')
      .length;
    
    const prevProposals = prevActivities
      .filter(a => a.type === 'proposal')
      .length;
    
    // Calculate trends
    const calculateTrend = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };
    
    // Process MRR data
    const clients = clientsResult.data || [];
    const activeClients = clients.filter(c => c.status === 'active');
    const totalMRR = activeClients.reduce((sum, c) => sum + (c.subscription_amount || 0), 0);
    const avgMRR = activeClients.length > 0 ? totalMRR / activeClients.length : 0;
    const churnedClients = clients.filter(c => c.status === 'churned');
    const churnRate = clients.length > 0 ? (churnedClients.length / clients.length) * 100 : 0;
    const activeRate = clients.length > 0 ? (activeClients.length / clients.length) * 100 : 100;
    
    // Prepare chart data (last 7 days)
    const chartLabels: string[] = [];
    const chartSales: number[] = [];
    const chartOutbound: number[] = [];
    const chartMeetings: number[] = [];
    const chartProposals: number[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      chartLabels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
      
      const dayActivities = activities.filter(a => a.date.startsWith(dateStr));
      
      chartSales.push(
        dayActivities
          .filter(a => a.type === 'sale')
          .reduce((sum, a) => sum + (a.amount || 0), 0)
      );
      
      chartOutbound.push(
        dayActivities.filter(a => a.type === 'outbound').length
      );
      
      chartMeetings.push(
        dayActivities.filter(a => a.type === 'meeting').length
      );
      
      chartProposals.push(
        dayActivities.filter(a => a.type === 'proposal').length
      );
    }
    
    // Prepare response
    const metrics: DashboardMetrics = {
      activities: {
        revenue,
        revenueTarget: targetsResult.data?.revenue || 50000,
        revenueTrend: calculateTrend(revenue, prevRevenue),
        outbound,
        outboundTarget: targetsResult.data?.outbound || 100,
        outboundTrend: calculateTrend(outbound, prevOutbound),
        meetings,
        meetingsTarget: targetsResult.data?.meetings || 20,
        meetingsTrend: calculateTrend(meetings, prevMeetings),
        proposals,
        proposalsTarget: targetsResult.data?.proposals || 10,
        proposalsTrend: calculateTrend(proposals, prevProposals),
        previousMonthRevenue: prevRevenue,
        previousMonthOutbound: prevOutbound,
        previousMonthMeetings: prevMeetings,
        previousMonthProposals: prevProposals
      },
      mrr: {
        totalMRR,
        activeClients: activeClients.length,
        totalClients: clients.length,
        avgMRR,
        churnRate,
        activeRate,
        mrrTrend: 12, // Mocked for now
        clientTrend: 8  // Mocked for now
      },
      recentActivities: (recentActivitiesResult.data || []).map(a => ({
        id: a.id,
        type: a.type,
        client_name: a.client_name,
        date: a.date,
        amount: a.amount,
        details: a.details || '',
        status: a.status
      })),
      chartData: {
        labels: chartLabels,
        sales: chartSales,
        outbound: chartOutbound,
        meetings: chartMeetings,
        proposals: chartProposals
      }
    };

    // Cache headers for 1 minute
    const headers = {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=30'
    };

    return new Response(
      JSON.stringify(metrics),
      { status: 200, headers }
    );
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});