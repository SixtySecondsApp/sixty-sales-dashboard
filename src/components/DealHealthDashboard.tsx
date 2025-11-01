/**
 * Deal Health Monitoring Dashboard
 *
 * Comprehensive view of all deal health scores with filtering and sorting
 */

import React, { useState, useMemo } from 'react';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Calendar,
  Users,
  Filter,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useUserDealsHealth } from '@/lib/hooks/useDealHealth';
import { DealHealthBadge, DealHealthProgress } from './DealHealthBadge';
import type { DealHealthScore } from '@/lib/services/dealHealthService';
import { motion } from 'framer-motion';

type HealthFilter = 'all' | 'healthy' | 'warning' | 'critical' | 'stalled';
type SortBy = 'health_asc' | 'health_desc' | 'days_in_stage' | 'risk_level';

export function DealHealthDashboard() {
  const { healthScores, loading, calculateAllHealth } = useUserDealsHealth();
  const [filter, setFilter] = useState<HealthFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('health_asc');
  const [calculating, setCalculating] = useState(false);

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

    // Apply filter
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
  }, [healthScores, filter, sortBy]);

  // Recalculate all health scores
  const handleRecalculate = async () => {
    setCalculating(true);
    await calculateAllHealth();
    setCalculating(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Deal Health Monitoring
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            AI-powered health analysis across {stats.total} active deals
          </p>
        </div>

        <button
          onClick={handleRecalculate}
          disabled={calculating}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${calculating ? 'animate-spin' : ''}`} />
          {calculating ? 'Calculating...' : 'Recalculate All'}
        </button>
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as HealthFilter)}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
          >
            <option value="all">All Deals ({stats.total})</option>
            <option value="healthy">Healthy ({stats.healthy})</option>
            <option value="warning">At Risk ({stats.warning})</option>
            <option value="critical">Critical ({stats.critical})</option>
            <option value="stalled">Stalled ({stats.stalled})</option>
          </select>
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
        >
          <option value="health_asc">Health Score (Low to High)</option>
          <option value="health_desc">Health Score (High to Low)</option>
          <option value="days_in_stage">Days in Stage</option>
          <option value="risk_level">Risk Level</option>
        </select>
      </div>

      {/* Deals List */}
      {filteredAndSortedDeals.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Activity className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            No deals found for this filter
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAndSortedDeals.map((healthScore) => (
            <DealHealthCard key={healthScore.id} healthScore={healthScore} />
          ))}
        </div>
      )}
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

function DealHealthCard({ healthScore }: { healthScore: DealHealthScore }) {
  const [expanded, setExpanded] = useState(false);

  // Fetch deal info (in real implementation, this would come from a join)
  // For now, we'll use placeholder data
  const dealName = `Deal ${healthScore.deal_id.slice(0, 8)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {dealName}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Calendar className="h-4 w-4" />
              <span>{healthScore.days_in_current_stage} days in stage</span>
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
                  className="px-2 py-1 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
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
      <span className="font-medium text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}
