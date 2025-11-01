/**
 * Deal Health Badge Component
 *
 * Displays a visual indicator of deal health status with score
 */

import React from 'react';
import { Activity, AlertTriangle, TrendingDown, CheckCircle } from 'lucide-react';
import type { DealHealthScore } from '@/lib/services/dealHealthService';

interface DealHealthBadgeProps {
  healthScore: DealHealthScore | null;
  showScore?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function DealHealthBadge({
  healthScore,
  showScore = true,
  showLabel = true,
  size = 'md',
  className = '',
}: DealHealthBadgeProps) {
  if (!healthScore) {
    return (
      <div className={`inline-flex items-center gap-1.5 ${className}`}>
        <div className="h-2 w-2 rounded-full bg-gray-400" />
        {showLabel && <span className="text-xs text-gray-500">No data</span>}
      </div>
    );
  }

  const { overall_health_score, health_status, risk_level } = healthScore;

  // Size variants
  const sizeClasses = {
    sm: {
      icon: 'h-3 w-3',
      text: 'text-xs',
      badge: 'px-1.5 py-0.5',
      dot: 'h-1.5 w-1.5',
    },
    md: {
      icon: 'h-4 w-4',
      text: 'text-sm',
      badge: 'px-2 py-1',
      dot: 'h-2 w-2',
    },
    lg: {
      icon: 'h-5 w-5',
      text: 'text-base',
      badge: 'px-3 py-1.5',
      dot: 'h-2.5 w-2.5',
    },
  };

  const s = sizeClasses[size];

  // Status configuration
  const statusConfig = {
    healthy: {
      label: 'Healthy',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
      dotColor: 'bg-green-500',
      icon: CheckCircle,
    },
    warning: {
      label: 'At Risk',
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      dotColor: 'bg-yellow-500',
      icon: AlertTriangle,
    },
    critical: {
      label: 'Critical',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
      dotColor: 'bg-red-500',
      icon: Activity,
    },
    stalled: {
      label: 'Stalled',
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20',
      borderColor: 'border-gray-200 dark:border-gray-800',
      dotColor: 'bg-gray-500',
      icon: TrendingDown,
    },
  };

  const config = statusConfig[health_status];
  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md border ${config.borderColor} ${config.bgColor} ${s.badge} ${className}`}
      title={`Health Score: ${overall_health_score}/100 - Risk Level: ${risk_level}`}
    >
      <Icon className={`${s.icon} ${config.color}`} />

      {showLabel && (
        <span className={`font-medium ${config.color} ${s.text}`}>
          {config.label}
        </span>
      )}

      {showScore && (
        <span className={`font-bold ${config.color} ${s.text}`}>
          {overall_health_score}
        </span>
      )}
    </div>
  );
}

/**
 * Compact Health Indicator (just colored dot)
 */
export function DealHealthDot({
  healthScore,
  size = 'md',
  className = '',
}: {
  healthScore: DealHealthScore | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  if (!healthScore) {
    return <div className={`rounded-full bg-gray-400 h-2 w-2 ${className}`} />;
  }

  const dotSizes = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5',
  };

  const colors = {
    healthy: 'bg-green-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500',
    stalled: 'bg-gray-500',
  };

  return (
    <div
      className={`rounded-full ${colors[healthScore.health_status]} ${dotSizes[size]} ${className}`}
      title={`Health: ${healthScore.overall_health_score}/100`}
    />
  );
}

/**
 * Health Score Progress Bar
 */
export function DealHealthProgress({
  healthScore,
  showLabel = true,
  className = '',
}: {
  healthScore: DealHealthScore | null;
  showLabel?: boolean;
  className?: string;
}) {
  if (!healthScore) {
    return null;
  }

  const { overall_health_score, health_status } = healthScore;

  const colors = {
    healthy: 'bg-green-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500',
    stalled: 'bg-gray-500',
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400">Health Score</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {overall_health_score}/100
          </span>
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={`h-full rounded-full transition-all duration-300 ${colors[health_status]}`}
          style={{ width: `${overall_health_score}%` }}
        />
      </div>
    </div>
  );
}
