/**
 * Optimized Dashboard Component
 * 
 * This component implements performance optimizations:
 * - React.memo for expensive components
 * - useMemo for heavy computations
 * - useCallback for stable references
 * - Lazy loading for charts and heavy components
 * - Intersection Observer for below-the-fold content
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';

// Hooks
import { useUser } from '@/lib/hooks/useUser';
import { useTargets } from '@/lib/hooks/useTargets';
import { useActivityFilters } from '@/lib/hooks/useActivityFilters';
import { useActivities } from '@/lib/hooks/useActivities';

// Optimized icon imports
import { DynamicIcon, usePreloadIcons } from '@/components/IconLoader';
import { LazyChartComponents, IntelligentPreloader } from '@/components/LazyComponents';

// Lazy load heavy components
const SalesActivityChart = React.lazy(() => import('@/components/SalesActivityChart'));
const SubscriptionStats = React.lazy(() => import('@/components/SubscriptionStats'));

// Memoized metric card component
interface MetricCardProps {
  title: string;
  value: number;
  target: number;
  trend: number;
  iconName: string;
  type?: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  previousMonthTotal?: number;
}

const MetricCard = React.memo<MetricCardProps>(({ 
  title, 
  value, 
  target, 
  trend, 
  iconName, 
  type, 
  dateRange,
  previousMonthTotal 
}) => {
  const percentage = useMemo(() => 
    target > 0 ? Math.round((value / target) * 100) : 0, 
    [value, target]
  );
  
  const trendColor = useMemo(() => 
    trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-600',
    [trend]
  );

  const progressBarWidth = useMemo(() => 
    Math.min(percentage, 100),
    [percentage]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <DynamicIcon 
              name={iconName} 
              className="h-5 w-5 text-emerald-600" 
            />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">
              {type === 'currency' ? `£${value.toLocaleString()}` : value.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Target: {target.toLocaleString()}</p>
          <p className={`text-sm font-medium ${trendColor}`}>
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </p>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <motion.div 
          className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
          initial={{ width: 0 }}
          animate={{ width: `${progressBarWidth}%` }}
        />
      </div>
      
      <div className="flex justify-between text-sm text-gray-600">
        <span>{percentage}% of target</span>
        <span>
          {previousMonthTotal !== undefined && (
            `Last month: ${type === 'currency' ? '£' : ''}${previousMonthTotal.toLocaleString()}`
          )}
        </span>
      </div>
    </motion.div>
  );
});

MetricCard.displayName = 'MetricCard';

// Optimized Dashboard component
const OptimizedDashboard: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [chartVisible, setChartVisible] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  
  // Get setFilters from the activity filters hook
  const { setFilters } = useActivityFilters();

  // Preload dashboard-specific icons
  usePreloadIcons([
    'PoundSterling', 'Phone', 'Users', 'FileText', 
    'ChevronLeft', 'ChevronRight', 'ArrowUp', 'ArrowDown',
    'TrendingUp', 'TrendingDown'
  ]);

  // Memoized date calculations
  const dateRange = useMemo(() => ({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  }), [currentDate]);

  const previousMonthRange = useMemo(() => ({
    start: startOfMonth(subMonths(currentDate, 1)),
    end: endOfMonth(subMonths(currentDate, 1))
  }), [currentDate]);

  // Hooks
  const { user } = useUser();
  const { data: targets } = useTargets();
  const { dateRange: filterDateRange, setDateRange } = useActivityFilters();
  const { data: activities, isLoading: activitiesLoading } = useActivities();
  const { data: previousActivities } = useActivities(previousMonthRange);

  // Intersection Observer for chart lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !chartVisible) {
          setChartVisible(true);
        }
      },
      { rootMargin: '100px' }
    );

    if (chartRef.current) {
      observer.observe(chartRef.current);
    }

    return () => observer.disconnect();
  }, [chartVisible]);

  // Memoized calculations
  const metrics = useMemo(() => {
    if (!activities || !targets) return null;

    const currentActivities = activities.filter(activity => {
      const activityDate = new Date(activity.activity_date);
      return activityDate >= dateRange.start && activityDate <= dateRange.end;
    });

    const previousActivitiesData = previousActivities?.filter(activity => {
      const activityDate = new Date(activity.activity_date);
      return activityDate >= previousMonthRange.start && activityDate <= previousMonthRange.end;
    }) || [];

    // Calculate metrics
    const revenue = currentActivities
      .filter(a => a.status === 'won')
      .reduce((sum, a) => sum + (a.amount || 0), 0);

    const calls = currentActivities
      .filter(a => a.activity_type === 'call')
      .length;

    const meetings = currentActivities
      .filter(a => a.activity_type === 'meeting')
      .length;

    const proposals = currentActivities
      .filter(a => a.activity_type === 'proposal')
      .length;

    // Previous month totals
    const previousRevenue = previousActivitiesData
      .filter(a => a.status === 'won')
      .reduce((sum, a) => sum + (a.amount || 0), 0);

    const previousCalls = previousActivitiesData
      .filter(a => a.activity_type === 'call')
      .length;

    const previousMeetings = previousActivitiesData
      .filter(a => a.activity_type === 'meeting')
      .length;

    const previousProposals = previousActivitiesData
      .filter(a => a.activity_type === 'proposal')
      .length;

    // Calculate trends
    const revenueTrend = previousRevenue > 0 
      ? ((revenue - previousRevenue) / previousRevenue) * 100 
      : 0;
    
    const callsTrend = previousCalls > 0 
      ? ((calls - previousCalls) / previousCalls) * 100 
      : 0;
    
    const meetingsTrend = previousMeetings > 0 
      ? ((meetings - previousMeetings) / previousMeetings) * 100 
      : 0;
    
    const proposalsTrend = previousProposals > 0 
      ? ((proposals - previousProposals) / previousProposals) * 100 
      : 0;

    return [
      {
        title: 'Revenue',
        value: revenue,
        target: targets.monthly_revenue_target || 50000,
        trend: revenueTrend,
        iconName: 'PoundSterling',
        type: 'currency',
        previousMonthTotal: previousRevenue
      },
      {
        title: 'Calls',
        value: calls,
        target: targets.monthly_calls_target || 100,
        trend: callsTrend,
        iconName: 'Phone',
        previousMonthTotal: previousCalls
      },
      {
        title: 'Meetings',
        value: meetings,
        target: targets.monthly_meetings_target || 50,
        trend: meetingsTrend,
        iconName: 'Users',
        previousMonthTotal: previousMeetings
      },
      {
        title: 'Proposals',
        value: proposals,
        target: targets.monthly_proposals_target || 20,
        trend: proposalsTrend,
        iconName: 'FileText',
        previousMonthTotal: previousProposals
      }
    ];
  }, [activities, targets, dateRange, previousMonthRange, previousActivities]);

  // Memoized event handlers
  const handlePreviousMonth = useCallback(() => {
    setCurrentDate(prev => subMonths(prev, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentDate(prev => addMonths(prev, 1));
  }, []);

  const canGoNext = useMemo(() => 
    currentDate < new Date(), 
    [currentDate]
  );

  // Update filter date range when currentDate changes
  useEffect(() => {
    setFilters({ dateRange });
  }, [dateRange, setFilters]);

  if (activitiesLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border p-6">
              <div className="animate-pulse">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-9 h-9 bg-gray-200 rounded-lg"></div>
                  <div className="space-y-2">
                    <div className="w-20 h-4 bg-gray-200 rounded"></div>
                    <div className="w-24 h-6 bg-gray-200 rounded"></div>
                  </div>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <IntelligentPreloader />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Welcome back, {user?.email?.split('@')[0] || 'User'}
          </p>
        </div>
        
        {/* Date navigation */}
        <div className="flex items-center space-x-4">
          <button
            onClick={handlePreviousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <DynamicIcon name="ChevronLeft" className="h-5 w-5" />
          </button>
          
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900">
              {format(currentDate, 'MMMM yyyy')}
            </p>
          </div>
          
          <button
            onClick={handleNextMonth}
            disabled={!canGoNext}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <DynamicIcon name="ChevronRight" className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric, index) => (
            <MetricCard
              key={metric.title}
              {...metric}
              dateRange={dateRange}
            />
          ))}
        </div>
      )}

      {/* Charts Section */}
      <div ref={chartRef} className="space-y-8">
        {chartVisible && (
          <>
            <React.Suspense fallback={
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-80 bg-gray-200 rounded"></div>
                </div>
              </div>
            }>
              <SalesActivityChart />
            </React.Suspense>
            
            <React.Suspense fallback={
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-1/4"></div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="h-24 bg-gray-200 rounded"></div>
                    <div className="h-24 bg-gray-200 rounded"></div>
                    <div className="h-24 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </div>
            }>
              <SubscriptionStats />
            </React.Suspense>
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(OptimizedDashboard);