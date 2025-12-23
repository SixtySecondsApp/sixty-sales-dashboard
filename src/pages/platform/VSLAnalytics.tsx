import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Play,
  Calendar,
  RefreshCw,
  ArrowLeft,
  Users,
  Clock,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VSLComparisonCards, VSLTrendChart, VSLRetentionGraph } from '@/components/vsl-analytics';
import {
  useVSLAnalytics,
  formatWatchTime,
  formatPercentage,
} from '@/lib/hooks/useVSLAnalytics';

type DateRangePreset = '7d' | '30d' | '90d' | 'thisMonth' | 'lastMonth';

export function VSLAnalytics() {
  const [datePreset, setDatePreset] = useState<DateRangePreset>('30d');

  const {
    loading,
    error,
    data,
    isAdmin,
    userLoading,
    dateRange,
    variants,
    comparison,
    hasData,
    refresh,
    setLast7Days,
    setLast30Days,
    setLast90Days,
    setThisMonth,
    setLastMonth,
  } = useVSLAnalytics();

  const handlePresetChange = (value: DateRangePreset) => {
    setDatePreset(value);
    switch (value) {
      case '7d':
        setLast7Days();
        break;
      case '30d':
        setLast30Days();
        break;
      case '90d':
        setLast90Days();
        break;
      case 'thisMonth':
        setThisMonth();
        break;
      case 'lastMonth':
        setLastMonth();
        break;
    }
  };

  // Show loading state while checking user permissions
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-brand-violet animate-spin" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-6">
            VSL Analytics is only available to administrators.
          </p>
          <Link to="/platform">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Platform
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link
                to="/platform"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <Play className="w-7 h-7 text-brand-violet" />
                VSL Split Test Analytics
              </h1>
            </div>
            <p className="text-gray-400 text-sm">
              Compare performance across your video sales letter variants
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Date Range Selector */}
            <Select value={datePreset} onValueChange={handlePresetChange}>
              <SelectTrigger className="w-[160px] bg-gray-800 border-gray-700 text-white">
                <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
              </SelectContent>
            </Select>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => refresh()}
              disabled={loading}
              className="border-gray-700 hover:bg-gray-800"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Date Range Display */}
        <div className="mb-6">
          <p className="text-gray-500 text-sm">
            Showing data from{' '}
            <span className="text-gray-300">
              {format(dateRange.startDate, 'MMM d, yyyy')}
            </span>{' '}
            to{' '}
            <span className="text-gray-300">
              {format(dateRange.endDate, 'MMM d, yyyy')}
            </span>
            {data?.fetchedAt && (
              <span className="ml-2">
                · Last updated{' '}
                <span className="text-gray-300">
                  {format(new Date(data.fetchedAt), 'h:mm a')}
                </span>
              </span>
            )}
          </p>
        </div>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-red-400 font-medium">Error loading analytics</p>
              <p className="text-red-400/70 text-sm">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh()}
              className="ml-auto border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              Retry
            </Button>
          </motion.div>
        )}

        {/* Summary Stats (when data exists) */}
        {hasData && comparison && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
          >
            <div className="bg-gray-800/30 rounded-lg p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-brand-violet/10">
                <Users className="w-5 h-5 text-brand-violet" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Total Views</p>
                <p className="text-2xl font-bold text-white">
                  {comparison.totalViewsAcrossAll.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="bg-gray-800/30 rounded-lg p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-brand-blue/10">
                <TrendingUp className="w-5 h-5 text-brand-blue" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Avg Completion Rate</p>
                <p className="text-2xl font-bold text-white">
                  {formatPercentage(comparison.avgCompletionRate)}
                </p>
              </div>
            </div>

            <div className="bg-gray-800/30 rounded-lg p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-brand-teal/10">
                <Clock className="w-5 h-5 text-brand-teal" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">Best Performer</p>
                <p className="text-2xl font-bold text-white">
                  {variants.find((v) => v.variantId === comparison.bestPerformer)?.name ||
                    'N/A'}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Comparison Cards */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Variant Comparison</h2>
          <VSLComparisonCards
            variants={variants}
            bestPerformer={comparison?.bestPerformer}
            isLoading={loading}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
          {/* Trend Chart */}
          <VSLTrendChart variants={variants} isLoading={loading} />

          {/* Retention Graph */}
          <VSLRetentionGraph variants={variants} isLoading={loading} />
        </div>

        {/* Raw Data Toggle (for debugging) */}
        {hasData && process.env.NODE_ENV === 'development' && (
          <details className="mt-8">
            <summary className="text-gray-500 text-sm cursor-pointer hover:text-gray-300">
              View Raw Data (Debug)
            </summary>
            <pre className="mt-4 p-4 bg-gray-900 rounded-lg text-xs text-gray-400 overflow-x-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

export default VSLAnalytics;
