import React, { useState, useMemo, useEffect, useRef, useCallback, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@/lib/hooks/useUser';
import { useTargets } from '@/lib/hooks/useTargets';
import { useActivityFilters } from '@/lib/hooks/useActivityFilters';
import { useNavigate } from 'react-router-dom';
import { useRecentDeals } from '@/lib/hooks/useLazyActivities';
import { useDashboardMetrics } from '@/lib/hooks/useDashboardMetrics';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isAfter, isBefore, getDate } from 'date-fns';
import {
  PoundSterling,
  Phone,
  Users,
  FileText,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { LazySalesActivityChart } from '@/components/LazySalesActivityChart';
import ReactDOM from 'react-dom';
import { LazySubscriptionStats } from '@/components/LazySubscriptionStats';
import logger from '@/lib/utils/logger';

interface MetricCardProps {
  title: string;
  value: number;
  target: number;
  trend: number;
  icon: React.ElementType;
  type?: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  previousMonthTotal?: number;
  isLoadingComparisons?: boolean;
  hasComparisons?: boolean;
  isInitialLoad?: boolean;
}

interface TooltipProps {
  show: boolean;
  content: {
    title: string;
    message: string;
    positive: boolean;
  };
  position: {
    x: number;
    y: number;
  };
}

export interface Deal {
  id: string;
  date: string;
  client_name: string;
  amount: number;
  details: string;
}

// Tooltip component that uses Portal
const Tooltip = ({ show, content, position }: TooltipProps) => {
  if (!show) return null;
  
  return ReactDOM.createPortal(
    <div 
      style={{
        position: 'fixed',
        top: position.y - 10,
        left: position.x,
        transform: 'translate(-50%, -100%)',
        zIndex: 9999,
      }}
      className="bg-gray-900/95 text-white text-xs rounded-lg p-2.5 w-48 shadow-xl border border-gray-700"
    >
      <div className="text-center font-medium mb-2">{content.title}</div>
      <div className="flex justify-center items-center gap-1">
        <span className={content.positive ? "text-emerald-400" : "text-red-400"}>
          {content.message}
        </span>
      </div>
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900 border-r border-b border-gray-700"></div>
    </div>,
    document.body
  );
};

const MetricCard = React.memo(({ title, value, target, trend, icon: Icon, type, dateRange, previousMonthTotal, isLoadingComparisons, hasComparisons, isInitialLoad = false }: MetricCardProps) => {
  const navigate = useNavigate();
  const { setFilters } = useActivityFilters();
  const [showTrendTooltip, setShowTrendTooltip] = useState(false);
  const [showTotalTooltip, setShowTotalTooltip] = useState(false);
  const [trendPosition, setTrendPosition] = useState({ x: 0, y: 0 });
  const [totalPosition, setTotalPosition] = useState({ x: 0, y: 0 });
  const trendRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    try {
      if (type) {
        setFilters({ type, dateRange });
        navigate('/activity', { state: { preserveFilters: true } });
      }
    } catch (error) {
      logger.error('Navigation error:', error);
    }
  };

  const getIconColor = (title: string) => {
    switch (title) {
      case 'New Business':
        return 'emerald';
      case 'Outbound':
        return 'blue';
      case 'Meetings':
        return 'violet';
      case 'Proposals':
        return 'orange';
      default:
        return 'gray';
    }
  };

  // Calculate trend against previous month's total with error handling
  const totalTrend = useMemo(() => {
    try {
      if (!previousMonthTotal || previousMonthTotal === 0) return 0;
      return Math.round(((value - previousMonthTotal) / previousMonthTotal) * 100);
    } catch (error) {
      logger.error('Error calculating total trend:', error);
      return 0;
    }
  }, [value, previousMonthTotal]);

  // Helper function for arrow styling
  const getArrowClass = (trendValue: number) => {
    return trendValue >= 0 
      ? 'text-emerald-500' 
      : 'text-red-500';
  };

  // Get background colors based on trend values
  const getTrendBg = (trendValue: number) => {
    return trendValue >= 0 
      ? 'bg-emerald-500/10 border-emerald-500/30' 
      : 'bg-red-500/10 border-red-500/30';
  };

  // Handle mouse enter for trend tooltip
  const handleTrendMouseEnter = () => {
    try {
      if (trendRef.current) {
        const rect = trendRef.current.getBoundingClientRect();
        setTrendPosition({ 
          x: rect.left + rect.width / 2, 
          y: rect.top 
        });
        setShowTrendTooltip(true);
      }
    } catch (error) {
      logger.error('Error showing trend tooltip:', error);
    }
  };

  // Handle mouse enter for total tooltip
  const handleTotalMouseEnter = () => {
    try {
      if (totalRef.current) {
        const rect = totalRef.current.getBoundingClientRect();
        setTotalPosition({ 
          x: rect.left + rect.width / 2, 
          y: rect.top 
        });
        setShowTotalTooltip(true);
      }
    } catch (error) {
      logger.error('Error showing total tooltip:', error);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="relative overflow-visible bg-gradient-to-br from-gray-900/80 to-gray-900/40 backdrop-blur-xl rounded-3xl p-6 border border-gray-800/50 cursor-pointer"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${
            title === 'Outbound'
              ? 'bg-blue-500/5 border-blue-500/50'
              : `bg-${getIconColor(title)}-500/10 border border-${getIconColor(title)}-500/20`
          }`}>
            <Icon className={`w-5 h-5 ${
              title === 'Outbound'
                ? 'text-blue-400'
                : `text-${getIconColor(title)}-500`
            }`} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">{title}</span>
            <span className="text-xs text-gray-500">This month</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Arrow for same time in previous month comparison */}
          <div 
            ref={trendRef}
            className={`p-2 rounded-lg ${isLoadingComparisons ? 'bg-gray-500/10 border-gray-500/30' : getTrendBg(trend)} backdrop-blur-sm relative transition-all duration-300 hover:scale-105 shadow-lg`}
            onMouseEnter={handleTrendMouseEnter}
            onMouseLeave={() => setShowTrendTooltip(false)}
          >
            <div className="flex items-center gap-1.5">
              {isLoadingComparisons ? (
                <>
                  <div className="w-4 h-4 animate-pulse bg-gray-400 rounded-full"></div>
                  <span className="text-xs font-semibold text-gray-400">--%</span>
                </>
              ) : !hasComparisons ? (
                <>
                  <div className="w-4 h-4 text-gray-400">-</div>
                  <span className="text-xs font-semibold text-gray-400">--%</span>
                </>
              ) : (
                <>
                  {trend >= 0 ? (
                    <TrendingUp className={`w-4 h-4 ${getArrowClass(trend)}`} />
                  ) : (
                    <TrendingDown className={`w-4 h-4 ${getArrowClass(trend)}`} />
                  )}
                  <span className={`text-xs font-semibold ${getArrowClass(trend)}`}>
                    {trend >= 0 ? '+' : ''}{trend}%
                  </span>
                </>
              )}
            </div>
          </div>
          
          {/* Arrow for total previous month comparison */}
          <div 
            ref={totalRef}
            className={`p-2 rounded-lg ${isLoadingComparisons ? 'bg-gray-500/10 border-gray-500/30' : getTrendBg(totalTrend)} backdrop-blur-sm relative transition-all duration-300 hover:scale-105 shadow-lg`}
            onMouseEnter={handleTotalMouseEnter}
            onMouseLeave={() => setShowTotalTooltip(false)}
          >
            <div className="flex items-center gap-1.5">
              {isLoadingComparisons ? (
                <>
                  <div className="w-4 h-4 animate-pulse bg-gray-400 rounded-full"></div>
                  <span className="text-xs font-semibold text-gray-400">--%</span>
                </>
              ) : !hasComparisons ? (
                <>
                  <div className="w-4 h-4 text-gray-400">-</div>
                  <span className="text-xs font-semibold text-gray-400">--%</span>
                </>
              ) : (
                <>
                  {totalTrend >= 0 ? (
                    <ArrowUp className={`w-4 h-4 ${getArrowClass(totalTrend)}`} />
                  ) : (
                    <ArrowDown className={`w-4 h-4 ${getArrowClass(totalTrend)}`} />
                  )}
                  <span className={`text-xs font-semibold ${getArrowClass(totalTrend)}`}>
                    {totalTrend >= 0 ? '+' : ''}{totalTrend}%
                  </span>
                </>
              )}
            </div>
          </div>
          
          {/* Tooltips using Portal */}
          <Tooltip 
            show={showTrendTooltip}
            position={trendPosition}
            content={{
              title: "Vs. same point last month",
              message: trend >= 0 ? "Growing faster" : "Growing slower",
              positive: trend >= 0
            }}
          />
          
          <Tooltip 
            show={showTotalTooltip}
            position={totalPosition}
            content={{
              title: "Vs. previous month's total",
              message: totalTrend >= 0 ? "Already ahead of last month" : "Behind last month's performance",
              positive: totalTrend >= 0
            }}
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          {isInitialLoad ? (
            <div className="flex items-baseline gap-2">
              <div className="w-24 h-9 bg-gray-800/50 rounded animate-pulse" />
              <span className="text-sm text-gray-500 font-medium">
                / {title === 'New Business' ? `£${target.toLocaleString()}` : target}
              </span>
            </div>
          ) : (
            <>
              <span className="text-3xl font-bold text-white transition-none" suppressHydrationWarning>
                {title === 'New Business' ? `£${value.toLocaleString()}` : value}
              </span>
              <span className="text-sm text-gray-500 font-medium">
                / {title === 'New Business' ? `£${target.toLocaleString()}` : target}
              </span>
            </>
          )}
        </div>
        
        <div className="space-y-1">
          <div className="h-2.5 bg-gray-900/80 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-none ${
                title === 'New Business'
                  ? 'bg-emerald-500/80'
                  : title === 'Outbound'
                  ? 'bg-blue-500/80'
                  : title === 'Meetings'
                  ? 'bg-violet-500/80'
                  : 'bg-orange-500/80'
              }`}
              style={{ width: `${Math.min(100, (value / target) * 100)}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-400 flex justify-between">
            <span>Progress</span>
            <span>{Math.round((value / target) * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent re-renders
  return (
    prevProps.title === nextProps.title &&
    prevProps.value === nextProps.value &&
    prevProps.target === nextProps.target &&
    prevProps.trend === nextProps.trend &&
    prevProps.previousMonthTotal === nextProps.previousMonthTotal &&
    prevProps.isLoadingComparisons === nextProps.isLoadingComparisons &&
    prevProps.hasComparisons === nextProps.hasComparisons &&
    prevProps.isInitialLoad === nextProps.isInitialLoad
  );
});

// Skeleton loader component for the dashboard
function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 mt-12 lg:mt-0 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-1 mb-6 sm:mb-8">
        <div className="h-8 w-48 bg-gray-800 rounded-lg mb-2" />
        <div className="h-4 w-64 bg-gray-800 rounded-lg" />
      </div>

      {/* Metrics grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-800 rounded-lg" />
                <div>
                  <div className="h-4 w-24 bg-gray-800 rounded-lg mb-1" />
                  <div className="h-3 w-16 bg-gray-800 rounded-lg" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="w-16 h-8 bg-gray-800 rounded-lg" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-8 w-32 bg-gray-800 rounded-lg mb-2" />
              <div className="space-y-1">
                <div className="h-2 bg-gray-800 rounded-full" />
                <div className="flex justify-between">
                  <div className="h-3 w-16 bg-gray-800 rounded-lg" />
                  <div className="h-3 w-8 bg-gray-800 rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50 mb-8">
        <div className="h-6 w-48 bg-gray-800 rounded-lg mb-8" />
        <div className="h-64 w-full bg-gray-800 rounded-lg" />
      </div>

      {/* Recent deals skeleton */}
      <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50">
        <div className="flex justify-between items-center mb-6">
          <div className="h-6 w-36 bg-gray-800 rounded-lg" />
          <div className="h-9 w-48 bg-gray-800 rounded-lg" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-700 rounded-lg" />
                  <div>
                    <div className="h-5 w-32 bg-gray-700 rounded-lg mb-1" />
                    <div className="h-4 w-48 bg-gray-700 rounded-lg" />
                  </div>
                </div>
                <div>
                  <div className="h-6 w-24 bg-gray-700 rounded-lg mb-1" />
                  <div className="h-4 w-16 bg-gray-700 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  // Move all hooks to the top
  const [searchQuery, setSearchQuery] = useState('');
  const [showContent, setShowContent] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [isPending, startTransition] = useTransition();
  
  // Safe month navigation handlers with transition
  const handlePreviousMonth = () => {
    try {
      startTransition(() => {
        setSelectedMonth(prev => {
          const newMonth = subMonths(prev, 1);
          // Ensure the date is valid
          if (isNaN(newMonth.getTime())) {
            logger.error('Invalid date after subtracting month');
            return prev;
          }
          return newMonth;
        });
      });
    } catch (error) {
      logger.error('Error navigating to previous month:', error);
    }
  };
  
  const handleNextMonth = () => {
    try {
      startTransition(() => {
        setSelectedMonth(prev => {
          const newMonth = addMonths(prev, 1);
          // Ensure the date is valid
          if (isNaN(newMonth.getTime())) {
            logger.error('Invalid date after adding month');
            return prev;
          }
          // Don't go beyond current month
          if (newMonth > new Date()) {
            return prev;
          }
          return newMonth;
        });
      });
    } catch (error) {
      logger.error('Error navigating to next month:', error);
    }
  };
  const { userData, isLoading: isLoadingUser, session } = useUser();
  const navigate = useNavigate();
  const { setFilters } = useActivityFilters();
  
  // Log current auth state for debugging
  useEffect(() => {
    logger.log('📊 Dashboard auth state:', {
      hasSession: !!session,
      hasUserData: !!userData,
      userId: userData?.id,
      isLoadingUser
    });
  }, [session, userData, isLoadingUser]);
  
  // Get targets first - use session.user.id if userData is not yet loaded
  const userId = userData?.id || session?.user?.id;
  const { data: targets, isLoading: isLoadingSales } = useTargets(userId);
  
  // Progressive dashboard metrics with caching - only enable when ready
  const {
    metrics,
    trends,
    totalTrends,
    previousMonthTotals,
    isInitialLoad,
    isLoadingComparisons,
    hasComparisons,
    currentMonthActivities,
    refreshDashboard
  } = useDashboardMetrics(selectedMonth, showContent && !!userId && !!targets);
  
  // Lazy load recent deals only when user scrolls to that section
  const [loadRecentDeals, setLoadRecentDeals] = useState(false);
  const { activities: recentDeals, isLoading: isLoadingDeals } = useRecentDeals(loadRecentDeals);

  const selectedMonthRange = useMemo(() => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    return { start, end };
  }, [selectedMonth]);

  // All metrics are now handled by useDashboardMetrics hook with caching

  // Filter deals based on search query - use recent deals if loaded, otherwise current month activities
  const filteredDeals = useMemo(() => {
    const dealsToFilter = loadRecentDeals ? recentDeals : currentMonthActivities.filter(a => a.type === 'sale');
    return dealsToFilter.filter(activity => 
      activity.type === 'sale' &&
      (activity.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       activity.amount?.toString().includes(searchQuery) ||
       activity.details?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [recentDeals, currentMonthActivities, searchQuery, loadRecentDeals]);

  // Check if any data is loading - include metrics check
  const isAnyLoading = isInitialLoad || isLoadingSales || isLoadingUser || (!userData && !session) || !targets;

  // Remove logging to prevent re-renders

  // Use effect to handle initial loading state only
  useEffect(() => {
    // Immediately show content if data is ready
    if (!isAnyLoading && !showContent) {
      setShowContent(true);
    }
  }, [isAnyLoading, showContent]); // Added showContent to deps to prevent re-running

  // Intersection observer for lazy loading recent deals
  const recentDealsRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!recentDealsRef.current || loadRecentDeals) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setLoadRecentDeals(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    observer.observe(recentDealsRef.current);
    
    return () => observer.disconnect();
  }, [loadRecentDeals, showContent]);

  // Single loading check to prevent flicker
  if (!showContent || isAnyLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
      {/* Header with Month Selection */}
      <div className="space-y-1 mt-12 lg:mt-0 mb-6 sm:mb-8">
        <h1 className="text-3xl font-bold">Welcome back{userData?.first_name ? `, ${userData.first_name}` : ''}</h1>
        <div className="flex items-center justify-between mt-2">
          <p className="text-gray-400">Here's how your sales performance is tracking</p>
          <div className="flex items-center gap-3 bg-gray-900/50 backdrop-blur-xl rounded-xl p-2 border border-gray-800/50">
            <button
              onClick={handlePreviousMonth}
              className="p-1.5 hover:bg-gray-800/50 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-400" />
            </button>
            <span className="text-sm font-medium text-white min-w-[100px] text-center">
              {(() => {
                try {
                  return format(selectedMonth, 'MMMM yyyy');
                } catch (error) {
                  logger.error('Error formatting selected month:', error);
                  return 'Invalid Date';
                }
              })()}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-gray-800/50 rounded-lg transition-colors"
              disabled={selectedMonth >= new Date()}
            >
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
        <MetricCard
          key="revenue-metric"
          title="New Business"
          value={metrics.revenue}
          target={targets.revenue_target}
          trend={trends.revenue}
          icon={PoundSterling}
          type="sale"
          dateRange={selectedMonthRange}
          previousMonthTotal={previousMonthTotals.revenue}
          isLoadingComparisons={isLoadingComparisons}
          hasComparisons={hasComparisons}
          isInitialLoad={false}
        />
        <MetricCard
          key="outbound-metric"
          title="Outbound"
          value={metrics.outbound}
          target={targets.outbound_target}
          trend={trends.outbound}
          icon={Phone}
          type="outbound"
          dateRange={selectedMonthRange}
          previousMonthTotal={previousMonthTotals.outbound}
          isLoadingComparisons={isLoadingComparisons}
          hasComparisons={hasComparisons}
          isInitialLoad={false}
        />
        <MetricCard
          key="meetings-metric"
          title="Meetings"
          value={metrics.meetings}
          target={targets.meetings_target}
          trend={trends.meetings}
          icon={Users}
          type="meeting"
          dateRange={selectedMonthRange}
          previousMonthTotal={previousMonthTotals.meetings}
          isLoadingComparisons={isLoadingComparisons}
          hasComparisons={hasComparisons}
          isInitialLoad={false}
        />
        <MetricCard
          key="proposals-metric"
          title="Proposals"
          value={metrics.proposals}
          target={targets.proposal_target}
          trend={trends.proposals}
          icon={FileText}
          type="proposal"
          dateRange={selectedMonthRange}
          previousMonthTotal={previousMonthTotals.proposals}
          isLoadingComparisons={isLoadingComparisons}
          hasComparisons={hasComparisons}
          isInitialLoad={false}
        />
      </div>

      {/* Sales Activity Chart */}
      <div className="mb-8">
        <LazySalesActivityChart selectedMonth={selectedMonth} />
      </div>

      {/* MRR Subscription Statistics */}
      <div className="mb-8">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-white">Subscription Revenue</h2>
          <p className="text-sm text-gray-400">Track your monthly recurring revenue and client metrics</p>
        </div>
        <LazySubscriptionStats 
          onClick={(cardTitle) => {
            // Navigate to subscriptions page when clicking on MRR cards
            navigate('/subscriptions');
          }}
        />
      </div>

      {/* Recent Deals Section */}
      <div ref={recentDealsRef} className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50 mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <h2 className="text-xl font-semibold text-white">Recent Deals</h2>
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by client or amount..."
              className="w-full py-2 px-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>
        </div>
        <div className="space-y-3">
          {!loadRecentDeals ? (
            // Show loading placeholder when recent deals haven't been loaded yet
            <div className="text-center py-8">
              <div className="text-gray-500">Loading recent deals...</div>
            </div>
          ) : isLoadingDeals ? (
            // Show loading state while fetching
            <div className="text-center py-8">
              <div className="text-gray-500">Fetching deals...</div>
            </div>
          ) : (
            filteredDeals.map((deal) => (
            <motion.div
              key={deal.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ 
                scale: 1.02,
                transition: { duration: 0.2 }
              }}
              whileTap={{ scale: 0.98 }}
              className="bg-gray-800/50 rounded-xl p-3 sm:p-4 hover:bg-gray-800/70 transition-all duration-300 group hover:shadow-lg hover:shadow-emerald-500/10 border border-transparent hover:border-emerald-500/20 relative overflow-hidden cursor-pointer"
              onClick={() => {
                setFilters({ 
                  type: 'sale',
                  dateRange: {
                    start: new Date(deal.date),
                    end: new Date(deal.date)
                  }
                });
                navigate('/activity');
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <motion.div 
                    className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                    whileHover={{ rotate: [0, -10, 10, -5, 5, 0] }}
                    transition={{ duration: 0.5 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilters({ 
                        type: 'sale',
                        dateRange: {
                          start: new Date(deal.date),
                          end: new Date(deal.date)
                        }
                      });
                      navigate('/activity');
                    }}
                  >
                    <PoundSterling className="w-5 h-5 text-emerald-500" />
                  </motion.div>
                  <div>
                    <h3 className="font-medium text-white group-hover:text-emerald-500 transition-colors duration-300">
                      {deal.client_name}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {deal.details} • {format(new Date(deal.date), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors duration-300">
                    £{(deal.amount || 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-emerald-500 group-hover:text-emerald-400 transition-colors duration-300">Signed</div>
                </div>
              </div>
            </motion.div>
          )))}
          
          {loadRecentDeals && filteredDeals.length === 0 && (
            <div className="text-center py-8">
              <div className="text-gray-400">No matching deals found</div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-violet-500 hover:text-violet-400 text-sm"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}