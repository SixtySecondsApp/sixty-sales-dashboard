/**
 * HealthScoreGauge Component
 *
 * A comprehensive health score visualization with:
 * - Circular gauge display (0-100)
 * - Color-coded zones (healthy/warning/critical/stalled)
 * - Breakdown popover showing component scores
 * - Risk factors display
 */

import React, { useState } from 'react';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Users,
  Clock,
  Zap,
  AlertTriangle,
  ChevronDown,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DealHealthScore } from '@/lib/services/dealHealthService';

interface HealthScoreGaugeProps {
  healthScore: DealHealthScore | null;
  /** Size of the gauge in pixels */
  size?: number;
  /** Show label below gauge */
  showLabel?: boolean;
  /** Show breakdown on hover/click */
  interactive?: boolean;
  /** Compact mode for inline display */
  compact?: boolean;
  className?: string;
}

/**
 * Main Health Score Gauge Component
 */
export function HealthScoreGauge({
  healthScore,
  size = 64,
  showLabel = true,
  interactive = true,
  compact = false,
  className = '',
}: HealthScoreGaugeProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (!healthScore) {
    return (
      <div className={`flex flex-col items-center gap-1 ${className}`}>
        <div
          className="rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center"
          style={{ width: size, height: size }}
        >
          <span className="text-xs text-gray-400">N/A</span>
        </div>
        {showLabel && <span className="text-xs text-gray-400">No data</span>}
      </div>
    );
  }

  const { overall_health_score, health_status } = healthScore;

  // Color configuration based on health status
  const statusColors = {
    healthy: {
      stroke: '#10b981', // emerald-500
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      text: 'text-emerald-600 dark:text-emerald-400',
    },
    warning: {
      stroke: '#f59e0b', // amber-500
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-600 dark:text-amber-400',
    },
    critical: {
      stroke: '#ef4444', // red-500
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-600 dark:text-red-400',
    },
    stalled: {
      stroke: '#6b7280', // gray-500
      bg: 'bg-gray-50 dark:bg-gray-800/50',
      text: 'text-gray-600 dark:text-gray-400',
    },
  };

  const colors = statusColors[health_status];
  const strokeWidth = compact ? 3 : 4;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (overall_health_score / 100) * circumference;

  if (compact) {
    // Compact inline display
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <div className="relative" style={{ width: size, height: size }}>
          <svg className="transform -rotate-90" width={size} height={size}>
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              className="text-gray-200 dark:text-gray-700"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={colors.stroke}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xs font-bold ${colors.text}`}>
              {overall_health_score}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Main Gauge */}
      <button
        onClick={() => interactive && setShowBreakdown(!showBreakdown)}
        className={`
          flex flex-col items-center gap-1 p-2 rounded-lg transition-all
          ${interactive ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50' : ''}
        `}
        disabled={!interactive}
      >
        <div className="relative" style={{ width: size, height: size }}>
          <svg className="transform -rotate-90" width={size} height={size}>
            {/* Background track with zones */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="currentColor"
              className="text-gray-200 dark:text-gray-700"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Progress circle */}
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={colors.stroke}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              strokeLinecap="round"
            />
          </svg>
          {/* Score display */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <span className={`text-lg font-bold ${colors.text}`}>
                {overall_health_score}
              </span>
            </div>
          </div>
        </div>

        {showLabel && (
          <div className="flex items-center gap-1">
            <span className={`text-xs font-medium capitalize ${colors.text}`}>
              {health_status}
            </span>
            {interactive && (
              <ChevronDown
                className={`w-3 h-3 transition-transform ${colors.text} ${
                  showBreakdown ? 'rotate-180' : ''
                }`}
              />
            )}
          </div>
        )}
      </button>

      {/* Breakdown Popover */}
      <AnimatePresence>
        {showBreakdown && interactive && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-2 w-72"
          >
            <HealthScoreBreakdown
              healthScore={healthScore}
              onClose={() => setShowBreakdown(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Health Score Breakdown Panel
 * Shows detailed component scores and risk factors
 */
interface HealthScoreBreakdownProps {
  healthScore: DealHealthScore;
  onClose: () => void;
}

function HealthScoreBreakdown({ healthScore, onClose }: HealthScoreBreakdownProps) {
  const {
    overall_health_score,
    health_status,
    stage_velocity_score,
    sentiment_score,
    engagement_score,
    activity_score,
    response_time_score,
    risk_factors,
    risk_level,
    days_in_current_stage,
    meeting_count_last_30_days,
    sentiment_trend,
  } = healthScore;

  const componentScores = [
    {
      label: 'Stage Velocity',
      score: stage_velocity_score,
      weight: '30%',
      icon: Zap,
      description: `${days_in_current_stage} days in stage`,
    },
    {
      label: 'Sentiment',
      score: sentiment_score,
      weight: '25%',
      icon: MessageSquare,
      description: sentiment_trend ? `Trend: ${sentiment_trend}` : 'No data',
    },
    {
      label: 'Engagement',
      score: engagement_score,
      weight: '20%',
      icon: Users,
      description: `${meeting_count_last_30_days} meetings (30d)`,
    },
    {
      label: 'Activity',
      score: activity_score,
      weight: '15%',
      icon: Activity,
      description: 'Recent activity level',
    },
    {
      label: 'Response Time',
      score: response_time_score,
      weight: '10%',
      icon: Clock,
      description: 'Communication speed',
    },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 50) return 'text-amber-600 dark:text-amber-400';
    if (score >= 30) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    if (score >= 30) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const riskLevelColors = {
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            Health Breakdown
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${riskLevelColors[risk_level]}`}>
            {risk_level} risk
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Component Scores */}
      <div className="p-4 space-y-3">
        {componentScores.map(({ label, score, weight, icon: Icon, description }) => (
          <div key={label} className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                <span className="text-xs text-gray-700 dark:text-gray-300">{label}</span>
                <span className="text-[10px] text-gray-400">({weight})</span>
              </div>
              <span className={`text-xs font-semibold ${getScoreColor(score)}`}>
                {score}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className={`h-full rounded-full ${getScoreBarColor(score)}`}
              />
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">{description}</p>
          </div>
        ))}
      </div>

      {/* Risk Factors */}
      {risk_factors && risk_factors.length > 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Risk Factors
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {risk_factors.map((factor) => (
              <span
                key={factor}
                className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700"
              >
                {formatRiskFactor(factor)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Format risk factor string for display
 */
function formatRiskFactor(factor: string): string {
  return factor
    .replace(/_/g, ' ')
    .replace(/critical$/, '')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Inline Health Score Mini Gauge
 * For use in tables and lists
 */
export function HealthScoreMini({
  score,
  status,
  className = '',
}: {
  score: number;
  status: 'healthy' | 'warning' | 'critical' | 'stalled';
  className?: string;
}) {
  const colors = {
    healthy: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    critical: 'text-red-600 dark:text-red-400',
    stalled: 'text-gray-600 dark:text-gray-400',
  };

  const bgColors = {
    healthy: 'bg-emerald-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500',
    stalled: 'bg-gray-500',
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${bgColors[status]} transition-all duration-300`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={`text-xs font-semibold ${colors[status]}`}>{score}</span>
    </div>
  );
}

export default HealthScoreGauge;
