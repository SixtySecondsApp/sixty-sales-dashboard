/**
 * Test History Panel
 *
 * Displays test execution history with trend visualization,
 * summary stats, and recent failures for quick debugging.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  fetchRunTrends,
  fetchRecentFailures,
  fetchScenarioSummaryWithTrends,
  type RunTrendData,
  type FailureDetail,
} from '@/lib/services/testScenarioService';
import type { ScenarioType } from '@/lib/types/processMapTesting';
import { format, parseISO } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

interface TestHistoryPanelProps {
  processMapId: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

interface SummaryData {
  current: {
    total: number;
    passed: number;
    failed: number;
    notRun: number;
    passRate: number;
  };
  previous: {
    passRate: number;
    trend: 'up' | 'down' | 'stable';
    changePercent: number;
  };
  recentActivity: {
    runsToday: number;
    runsThisWeek: number;
    avgDurationMs: number;
  };
}

// ============================================================================
// Tooltip Component
// ============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
    name: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
      <p className="text-gray-400 text-xs mb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-300 text-sm capitalize">{entry.name}</span>
            </div>
            <span className="text-white font-medium text-sm">{entry.value}</span>
          </div>
        ))}
        <div className="border-t border-gray-700 pt-1.5 mt-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-400 text-sm">Total</span>
            <span className="text-white font-medium text-sm">{total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Stat Card Component
// ============================================================================

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    value: number;
  };
  color: 'green' | 'red' | 'yellow' | 'blue' | 'gray';
}

function StatCard({ label, value, icon, trend, color }: StatCardProps) {
  const colorClasses = {
    green: 'text-green-400 bg-green-500/10',
    red: 'text-red-400 bg-red-500/10',
    yellow: 'text-yellow-400 bg-yellow-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
    gray: 'text-gray-400 bg-gray-500/10',
  };

  const trendIcon = trend ? (
    trend.direction === 'up' ? (
      <TrendingUp className="w-3 h-3" />
    ) : trend.direction === 'down' ? (
      <TrendingDown className="w-3 h-3" />
    ) : (
      <Minus className="w-3 h-3" />
    )
  ) : null;

  const trendColor =
    trend?.direction === 'up'
      ? 'text-green-400'
      : trend?.direction === 'down'
      ? 'text-red-400'
      : 'text-gray-400';

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 rounded ${colorClasses[color]}`}>{icon}</div>
        <span className="text-gray-400 text-sm">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-semibold text-white">{value}</span>
        {trend && (
          <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
            {trendIcon}
            <span>{trend.value}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Failure Item Component
// ============================================================================

function FailureItem({ failure }: { failure: FailureDetail }) {
  const typeLabels: Record<ScenarioType, string> = {
    happy_path: 'Happy Path',
    branch_path: 'Branch',
    failure_mode: 'Failure Mode',
  };

  const typeColors: Record<ScenarioType, string> = {
    happy_path: 'bg-green-500/20 text-green-400',
    branch_path: 'bg-blue-500/20 text-blue-400',
    failure_mode: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/30 hover:border-gray-600/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-white font-medium truncate">{failure.scenarioName}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-1.5 py-0.5 rounded ${typeColors[failure.scenarioType]}`}>
              {typeLabels[failure.scenarioType]}
            </span>
            <span className="text-gray-500">
              {format(new Date(failure.lastRunAt), 'MMM d, h:mm a')}
            </span>
          </div>
          {failure.errorMessage && (
            <p className="text-gray-400 text-xs mt-2 line-clamp-2">{failure.errorMessage}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <span className="text-red-400 text-sm font-medium">{failure.failureCount}x</span>
          <p className="text-gray-500 text-xs">failures</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TestHistoryPanel({
  processMapId,
  isExpanded = true,
  onToggleExpand,
}: TestHistoryPanelProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [trends, setTrends] = useState<RunTrendData[]>([]);
  const [failures, setFailures] = useState<FailureDetail[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [timeRange, setTimeRange] = useState<7 | 14 | 30>(14);

  // Load data
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [trendData, failureData, summaryData] = await Promise.all([
          fetchRunTrends(processMapId, { days: timeRange }),
          fetchRecentFailures(processMapId, 5),
          fetchScenarioSummaryWithTrends(processMapId),
        ]);

        // Format trend data for chart
        const formattedTrends = trendData.map((t) => ({
          ...t,
          displayDate: format(parseISO(t.date), 'MMM d'),
        }));

        setTrends(formattedTrends);
        setFailures(failureData);
        setSummary(summaryData);
      } catch (error) {
        console.error('Failed to load history data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [processMapId, timeRange]);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const [trendData, failureData, summaryData] = await Promise.all([
        fetchRunTrends(processMapId, { days: timeRange }),
        fetchRecentFailures(processMapId, 5),
        fetchScenarioSummaryWithTrends(processMapId),
      ]);

      const formattedTrends = trendData.map((t) => ({
        ...t,
        displayDate: format(parseISO(t.date), 'MMM d'),
      }));

      setTrends(formattedTrends);
      setFailures(failureData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Failed to refresh history data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isLoading && !summary) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-40 bg-gray-700 rounded animate-pulse" />
          <div className="h-8 w-24 bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-700/30 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-[200px] bg-gray-700/30 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
        >
          <TrendingUp className="w-5 h-5 text-brand-violet" />
          <h3 className="text-lg font-semibold">Test History</h3>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex bg-gray-700/50 rounded-lg p-0.5">
            {([7, 14, 30] as const).map((days) => (
              <button
                key={days}
                onClick={() => setTimeRange(days)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  timeRange === days
                    ? 'bg-gray-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>

          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-1.5 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Summary Stats */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Pass Rate"
                value={`${summary.current.passRate}%`}
                icon={<CheckCircle className="w-4 h-4" />}
                color="green"
                trend={{
                  direction: summary.previous.trend,
                  value: summary.previous.changePercent,
                }}
              />
              <StatCard
                label="Passed"
                value={summary.current.passed}
                icon={<CheckCircle className="w-4 h-4" />}
                color="green"
              />
              <StatCard
                label="Failed"
                value={summary.current.failed}
                icon={<XCircle className="w-4 h-4" />}
                color="red"
              />
              <StatCard
                label="Not Run"
                value={summary.current.notRun}
                icon={<Clock className="w-4 h-4" />}
                color="gray"
              />
            </div>
          )}

          {/* Activity Stats */}
          {summary && (
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>
                  <span className="text-white font-medium">{summary.recentActivity.runsToday}</span>{' '}
                  runs today
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Clock className="w-4 h-4" />
                <span>
                  <span className="text-white font-medium">{summary.recentActivity.runsThisWeek}</span>{' '}
                  runs this week
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Clock className="w-4 h-4" />
                <span>
                  Avg:{' '}
                  <span className="text-white font-medium">
                    {summary.recentActivity.avgDurationMs > 0
                      ? `${(summary.recentActivity.avgDurationMs / 1000).toFixed(1)}s`
                      : '—'}
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* Trend Chart */}
          {trends.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={trends}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis
                    dataKey="displayDate"
                    stroke="#9CA3AF"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#9CA3AF"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '12px' }}
                    formatter={(value) => (
                      <span className="text-gray-300 text-sm capitalize">{value}</span>
                    )}
                  />
                  <Bar
                    dataKey="passed"
                    name="passed"
                    stackId="a"
                    fill="#22C55E"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="failed"
                    name="failed"
                    stackId="a"
                    fill="#EF4444"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="errors"
                    name="errors"
                    stackId="a"
                    fill="#F59E0B"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center bg-gray-800/30 rounded-lg">
              <div className="text-center">
                <TrendingUp className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No test history available</p>
                <p className="text-gray-600 text-xs mt-1">Run some scenarios to see trends</p>
              </div>
            </div>
          )}

          {/* Recent Failures */}
          {failures.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <h4 className="text-white font-medium text-sm">Recent Failures</h4>
                <span className="text-gray-500 text-xs">({failures.length})</span>
              </div>
              <div className="space-y-2">
                {failures.map((failure) => (
                  <FailureItem key={failure.scenarioId} failure={failure} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default TestHistoryPanel;
