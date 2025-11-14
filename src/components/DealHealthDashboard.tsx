/**
 * Deal Health Monitoring Dashboard
 *
 * Comprehensive view of all deal health scores with filtering and sorting
 */

import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Calendar,
  Users,
  Filter,
  RefreshCw,
  AlertTriangle,
  Building2,
  User,
  Video,
  DollarSign,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { useUserDealsHealth, type ExtendedHealthScore } from '@/lib/hooks/useDealHealth';
import { DealHealthBadge, DealHealthProgress } from './DealHealthBadge';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { useUsers } from '@/lib/hooks/useUsers';
import { useUser } from '@/lib/hooks/useUser';

type HealthFilter = 'all' | 'healthy' | 'warning' | 'critical' | 'stalled';
type SortBy = 'health_asc' | 'health_desc' | 'days_in_stage' | 'risk_level';

export function DealHealthDashboard() {
  const { user: currentUser } = useUser();
  const { users } = useUsers();
  const { healthScores, loading, calculateAllHealth, smartRefresh } = useUserDealsHealth();
  const [filter, setFilter] = useState<HealthFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('health_asc');
  const [calculating, setCalculating] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('me'); // 'me' or 'all' or specific user ID

  // Smart refresh on component mount (only update stale scores)
  React.useEffect(() => {
    if (!loading && healthScores.length > 0) {
      // Smart refresh in background (don't block UI)
      smartRefresh(24).catch(err => console.error('Background smart refresh failed:', err));
    }
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const total = healthScores.length;
    const healthy = healthScores.filter((s) => s.health_status === 'healthy').length;
    const warning = healthScores.filter((s) => s.health_status === 'warning').length;
    const critical = healthScores.filter((s) => s.health_status === 'critical').length;
    const stalled = healthScores.filter((s) => s.health_status === 'stalled').length;
    const avgScore = total > 0
      ? Math.round(healthScores.reduce((sum, s) => sum + s.overall_health_score, 0) / total)
      : 0;

    return { total, healthy, warning, critical, stalled, avgScore };
  }, [healthScores]);

  // Filter and sort deals
  const filteredAndSortedDeals = useMemo(() => {
    let filtered = healthScores;

    // Apply user filter
    if (selectedUserId === 'me') {
      // Show only current user's deals
      filtered = filtered.filter((s) => s.user_id === currentUser?.id);
    } else if (selectedUserId !== 'all') {
      // Show specific user's deals
      filtered = filtered.filter((s) => s.user_id === selectedUserId);
    }
    // 'all' shows all deals (no filtering)

    // Apply health status filter
    if (filter !== 'all') {
      filtered = filtered.filter((s) => s.health_status === filter);
    }

    // Apply sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'health_asc':
          return a.overall_health_score - b.overall_health_score;
        case 'health_desc':
          return b.overall_health_score - a.overall_health_score;
        case 'days_in_stage':
          return b.days_in_current_stage - a.days_in_current_stage;
        case 'risk_level':
          const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return riskOrder[a.risk_level] - riskOrder[b.risk_level];
        default:
          return 0;
      }
    });

    return filtered;
  }, [healthScores, filter, sortBy, selectedUserId, currentUser?.id]);

  // Recalculate all health scores
  const handleRecalculate = async () => {
    setCalculating(true);
    await calculateAllHealth();
    setCalculating(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        <div className="flex h-full min-h-[calc(100vh-160px)] sm:min-h-[calc(100vh-140px)] lg:min-h-[calc(100vh-120px)] flex-col rounded-xl sm:rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800/60 dark:bg-gray-950/40 overflow-hidden p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-20 bg-gray-200 dark:bg-gray-800 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
      <div className="flex h-full min-h-[calc(100vh-160px)] sm:min-h-[calc(100vh-140px)] lg:min-h-[calc(100vh-120px)] flex-col rounded-xl sm:rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800/60 dark:bg-gray-950/40 overflow-hidden">
        <div className="p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Deal Health Monitoring
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            AI-powered health analysis across {stats.total} active deals
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={async () => {
              setCalculating(true);
              await smartRefresh(24);
              setCalculating(false);
            }}
            disabled={calculating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Only updates scores older than 24 hours"
          >
            <RefreshCw className={`h-4 w-4 ${calculating ? 'animate-spin' : ''}`} />
            {calculating ? 'Refreshing...' : 'Smart Refresh'}
          </button>
          <button
            onClick={handleRecalculate}
            disabled={calculating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Force recalculation of all health scores"
          >
            <RefreshCw className={`h-4 w-4 ${calculating ? 'animate-spin' : ''}`} />
            {calculating ? 'Calculating...' : 'Recalculate All'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Average Health"
          value={`${stats.avgScore}/100`}
          icon={Activity}
          color="blue"
        />
        <StatCard
          label="Healthy Deals"
          value={stats.healthy}
          icon={TrendingUp}
          color="green"
          onClick={() => setFilter('healthy')}
          active={filter === 'healthy'}
        />
        <StatCard
          label="At Risk"
          value={stats.warning}
          icon={AlertTriangle}
          color="yellow"
          onClick={() => setFilter('warning')}
          active={filter === 'warning'}
        />
        <StatCard
          label="Critical"
          value={stats.critical}
          icon={AlertTriangle}
          color="red"
          onClick={() => setFilter('critical')}
          active={filter === 'critical'}
        />
        <StatCard
          label="Stalled"
          value={stats.stalled}
          icon={TrendingDown}
          color="gray"
          onClick={() => setFilter('stalled')}
          active={filter === 'stalled'}
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" />

          {/* Sales Rep Filter */}
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="me">My Deals</option>
            <option value="all">All Sales Reps</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.first_name || user.last_name
                  ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                  : user.email}
              </option>
            ))}
          </select>

          {/* Health Status Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as HealthFilter)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="all">All Statuses ({stats.total})</option>
            <option value="healthy">Healthy ({stats.healthy})</option>
            <option value="warning">At Risk ({stats.warning})</option>
            <option value="critical">Critical ({stats.critical})</option>
            <option value="stalled">Stalled ({stats.stalled})</option>
          </select>
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        >
          <option value="health_asc">Health Score (Low to High)</option>
          <option value="health_desc">Health Score (High to Low)</option>
          <option value="days_in_stage">Days in Stage</option>
          <option value="risk_level">Risk Level</option>
        </select>
      </div>

      {/* Deals List */}
      {filteredAndSortedDeals.length === 0 ? (
        <div className="text-center py-12 rounded-lg">
          <Activity className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          {stats.total === 0 ? (
            <>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No Health Scores Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Health scores need to be calculated before they can be displayed. Click the "Recalculate All" button above to analyze all your active deals.
              </p>
              <div className="flex items-center justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span>Stage Velocity</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span>Engagement</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  <span>Activity</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-600 dark:text-gray-400">
                No deals found for this filter
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAndSortedDeals.map((healthScore) => (
            <DealHealthCard key={healthScore.id} healthScore={healthScore} />
          ))}
        </div>
      )}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Stat Card Component
// =====================================================

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  onClick?: () => void;
  active?: boolean;
}

function StatCard({ label, value, icon: Icon, color, onClick, active }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
    gray: 'bg-gray-50 dark:bg-gray-900/20 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800',
  };

  return (
    <motion.div
      whileHover={onClick ? { scale: 1.02 } : {}}
      className={`rounded-lg border p-4 transition-all ${colorClasses[color]} ${
        onClick ? 'cursor-pointer' : ''
      } ${active ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className="h-5 w-5" />
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <div className="text-sm font-medium opacity-90">{label}</div>
    </motion.div>
  );
}

// =====================================================
// Deal Health Card Component
// =====================================================

function DealHealthCard({ healthScore }: { healthScore: ExtendedHealthScore }) {
  const [expanded, setExpanded] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(value);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-xl transition-all"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <Link
              to={`/crm/deals/${healthScore.deal_id}?returnTo=${encodeURIComponent('/crm/health')}`}
              className="text-lg font-semibold text-gray-900 dark:text-white mb-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors inline-flex items-center gap-2 group"
            >
              {healthScore.deal_name || `Deal ${healthScore.deal_id.slice(0, 8)}`}
              <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>

            {/* Deal Metadata */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-600 dark:text-gray-400">
              {healthScore.deal_company && (
                <Link
                  to={healthScore.company_id ? `/companies/${healthScore.company_id}` : '#'}
                  className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Building2 className="h-4 w-4" />
                  <span>{healthScore.deal_company}</span>
                </Link>
              )}

              {healthScore.deal_contact && (
                <Link
                  to={healthScore.contact_id ? `/crm/contacts/${healthScore.contact_id}` : '#'}
                  className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <User className="h-4 w-4" />
                  <span>{healthScore.deal_contact}</span>
                </Link>
              )}

              {healthScore.deal_owner_name && (
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{healthScore.deal_owner_name}</span>
                </div>
              )}

              {healthScore.deal_value !== undefined && healthScore.deal_value > 0 && (
                <div className="flex items-center gap-1 font-medium text-green-600 dark:text-green-400">
                  <DollarSign className="h-4 w-4" />
                  <span>{formatCurrency(healthScore.deal_value)}</span>
                </div>
              )}

              {healthScore.meeting_count !== undefined && (
                <div className="flex items-center gap-1">
                  <Video className="h-4 w-4" />
                  <span>{healthScore.meeting_count} {healthScore.meeting_count === 1 ? 'meeting' : 'meetings'}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400 mt-2">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{healthScore.days_in_current_stage} days in stage</span>
              </div>
              {healthScore.last_calculated_at && (
                <div className="flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  <span>Updated {formatDistanceToNow(new Date(healthScore.last_calculated_at), { addSuffix: true })}</span>
                </div>
              )}
            </div>
          </div>
          <DealHealthBadge healthScore={healthScore} />
        </div>

        {/* Health Progress */}
        <DealHealthProgress healthScore={healthScore} className="mb-4" />

        {/* Signal Scores Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <SignalScore
            label="Stage Velocity"
            score={healthScore.stage_velocity_score}
          />
          <SignalScore
            label="Sentiment"
            score={healthScore.sentiment_score}
          />
          <SignalScore
            label="Engagement"
            score={healthScore.engagement_score}
          />
          <SignalScore
            label="Activity"
            score={healthScore.activity_score}
          />
          <SignalScore
            label="Response Time"
            score={healthScore.response_time_score}
          />
        </div>

        {/* Risk Factors */}
        {healthScore.risk_factors && healthScore.risk_factors.length > 0 && (
          <div className="mt-3">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Risk Factors:
            </h4>
            <div className="flex flex-wrap gap-2">
              {healthScore.risk_factors.map((factor, index) => (
                <span
                  key={index}
                  className="px-2 py-1 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                >
                  {factor.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Metrics Details (collapsed) */}
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2 text-sm"
          >
            <MetricRow
              label="Days since last meeting"
              value={healthScore.days_since_last_meeting || 'N/A'}
            />
            <MetricRow
              label="Days since last activity"
              value={healthScore.days_since_last_activity || 'N/A'}
            />
            <MetricRow
              label="Meetings (30 days)"
              value={healthScore.meeting_count_last_30_days}
            />
            <MetricRow
              label="Activities (30 days)"
              value={healthScore.activity_count_last_30_days}
            />
            <MetricRow
              label="Avg sentiment"
              value={
                healthScore.avg_sentiment_last_3_meetings
                  ? (healthScore.avg_sentiment_last_3_meetings * 100).toFixed(0) + '%'
                  : 'N/A'
              }
            />
            <MetricRow
              label="Sentiment trend"
              value={healthScore.sentiment_trend}
            />
          </motion.div>
        )}

        {/* Toggle button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {expanded ? 'Show Less' : 'Show Details'}
        </button>
      </div>
    </motion.div>
  );
}

// =====================================================
// Helper Components
// =====================================================

function SignalScore({ label, score }: { label: string; score: number }) {
  const getColor = (score: number) => {
    if (score >= 75) return 'text-green-600 dark:text-green-400';
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="text-center">
      <div className={`text-lg font-bold ${getColor(score)}`}>{score}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600 dark:text-gray-400">{label}:</span>
      <span className="font-medium text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}
