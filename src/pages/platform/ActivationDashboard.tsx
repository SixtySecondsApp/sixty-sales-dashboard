/**
 * ActivationDashboard - Platform Admin view for user activation metrics
 * 
 * Shows the activation funnel with North Star metric prominently displayed.
 * Design: Premium glassmorphic dark mode per design_system.md
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Zap,
  Play,
  FileText,
  Star,
  TrendingUp,
  Calendar,
  RefreshCw,
  ChevronRight,
  Sparkles,
  Target,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';
import { Button } from '@/components/ui/button';
import { format, subDays } from 'date-fns';

interface FunnelStep {
  step_name: string;
  step_order: number;
  user_count: number;
  percentage: number;
  avg_time_to_step: string | null;
}

interface ActivationMetrics {
  total_users: number;
  fathom_connected_count: number;
  first_meeting_synced_count: number;
  first_summary_viewed_count: number;
  first_proposal_generated_count: number;
  fully_activated_count: number;
  activations_today: number;
  activations_this_week: number;
}

interface RecentEvent {
  id: string;
  user_id: string;
  event_type: string;
  created_at: string;
  user_email?: string;
}

export default function ActivationDashboard() {
  const [metrics, setMetrics] = useState<ActivationMetrics | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelStep[]>([]);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load funnel metrics from view
      const { data: metricsData } = await supabase
        .from('activation_funnel_metrics')
        .select('*')
        .single();

      if (metricsData) {
        setMetrics(metricsData);
      }

      // Load funnel data from function
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
      const endDate = format(new Date(), 'yyyy-MM-dd');

      const { data: funnelResult } = await supabase.rpc('get_activation_funnel', {
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (funnelResult) {
        setFunnelData(funnelResult);
      }

      // Load recent events
      const { data: eventsData } = await supabase
        .from('user_activation_events')
        .select(`
          id,
          user_id,
          event_type,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (eventsData) {
        setRecentEvents(eventsData);
      }
    } catch (err) {
      console.error('[ActivationDashboard] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'fathom_connected':
        return <Play className="w-4 h-4 text-blue-400" />;
      case 'first_meeting_synced':
        return <FileText className="w-4 h-4 text-purple-400" />;
      case 'first_summary_viewed':
        return <Star className="w-4 h-4 text-yellow-400" />;
      case 'first_proposal_generated':
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
      default:
        return <Zap className="w-4 h-4 text-gray-400" />;
    }
  };

  const getNorthStarConversion = () => {
    if (!metrics || metrics.total_users === 0) return 0;
    return Math.round((metrics.first_summary_viewed_count / metrics.total_users) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Activation Dashboard
            </h1>
            <p className="text-gray-700 dark:text-gray-300 mt-1">
              Track user activation milestones and North Star metric
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d')}
              className="px-4 py-2 bg-white dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700/50 rounded-lg text-gray-900 dark:text-gray-100"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            <Button onClick={loadData} variant="outline" size="icon">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* North Star Metric - Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden bg-gradient-to-br from-yellow-500/20 via-amber-500/10 to-orange-500/20 
                     dark:from-yellow-500/10 dark:via-amber-500/5 dark:to-orange-500/10
                     backdrop-blur-xl rounded-2xl p-8 border border-yellow-500/30 dark:border-yellow-500/20"
        >
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-yellow-400/20 rounded-full blur-3xl" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Star className="w-6 h-6 text-yellow-500" />
                <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">
                  North Star Metric
                </span>
              </div>
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                First Summary Viewed
              </h2>
              <p className="text-gray-700 dark:text-gray-300">
                Users who have viewed at least one meeting summary
              </p>
            </div>
            <div className="text-right">
              <div className="text-6xl font-bold text-yellow-600 dark:text-yellow-400">
                {metrics?.first_summary_viewed_count || 0}
              </div>
              <div className="text-lg text-gray-600 dark:text-gray-400">
                {getNorthStarConversion()}% conversion
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Users */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-500/10 rounded-lg">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Users</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {metrics?.total_users || 0}
            </div>
          </motion.div>

          {/* Fathom Connected */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-500/10 rounded-lg">
                <Play className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Fathom Connected</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {metrics?.fathom_connected_count || 0}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {metrics && metrics.total_users > 0
                ? `${Math.round((metrics.fathom_connected_count / metrics.total_users) * 100)}%`
                : '0%'}
            </div>
          </motion.div>

          {/* First Meeting Synced */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 rounded-lg">
                <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Meeting Synced</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {metrics?.first_meeting_synced_count || 0}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {metrics && metrics.total_users > 0
                ? `${Math.round((metrics.first_meeting_synced_count / metrics.total_users) * 100)}%`
                : '0%'}
            </div>
          </motion.div>

          {/* Fully Activated */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-500/10 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Fully Activated</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {metrics?.fully_activated_count || 0}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {metrics && metrics.total_users > 0
                ? `${Math.round((metrics.fully_activated_count / metrics.total_users) * 100)}%`
                : '0%'}
            </div>
          </motion.div>
        </div>

        {/* Funnel Visualization */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Funnel Chart */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6"
          >
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-500" />
              Activation Funnel
            </h3>
            <div className="space-y-4">
              {funnelData.map((step, index) => {
                const isNorthStar = step.step_name.includes('North Star');
                const maxCount = funnelData[0]?.user_count || 1;
                const widthPercent = Math.max(20, (step.user_count / maxCount) * 100);

                return (
                  <div key={step.step_order} className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${
                        isNorthStar 
                          ? 'text-yellow-600 dark:text-yellow-400' 
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {isNorthStar && <Star className="w-4 h-4 inline mr-1" />}
                        {step.step_name}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {step.user_count} ({step.percentage}%)
                      </span>
                    </div>
                    <div className="h-8 bg-gray-100 dark:bg-gray-800/50 rounded-lg overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPercent}%` }}
                        transition={{ duration: 0.5, delay: 0.1 * index }}
                        className={`h-full rounded-lg ${
                          isNorthStar
                            ? 'bg-gradient-to-r from-yellow-500 to-amber-500'
                            : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                        }`}
                      />
                    </div>
                    {step.avg_time_to_step && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Avg time: {step.avg_time_to_step}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Recent Events */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6"
          >
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Recent Activations
            </h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {recentEvents.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  No activation events yet
                </p>
              ) : (
                recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getEventIcon(event.event_type)}
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {event.event_type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          User: {event.user_id.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {format(new Date(event.created_at), 'MMM d, h:mm a')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>

        {/* Activity Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Today</span>
            </div>
            <div className="text-4xl font-bold text-gray-900 dark:text-white">
              {metrics?.activations_today || 0}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">activation events</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="bg-white dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">This Week</span>
            </div>
            <div className="text-4xl font-bold text-gray-900 dark:text-white">
              {metrics?.activations_this_week || 0}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">activation events</div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
