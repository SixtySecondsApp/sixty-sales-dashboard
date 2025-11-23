/**
 * Health Score Badge Component
 *
 * Visual indicator for relationship health score with color-coding and trend arrow.
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface HealthScoreBadgeProps {
  score: number;
  status: 'healthy' | 'at_risk' | 'critical' | 'ghost';
  trend?: 'improving' | 'stable' | 'declining';
  size?: 'sm' | 'md' | 'lg';
  showScore?: boolean;
  showTrend?: boolean;
  className?: string;
}

export function HealthScoreBadge({
  score,
  status,
  trend,
  size = 'md',
  showScore = true,
  showTrend = true,
  className = '',
}: HealthScoreBadgeProps) {
  // Color schemes based on status
  const statusColors = {
    healthy: {
      bg: 'bg-green-500/10',
      text: 'text-green-600',
      border: 'border-green-500/20',
      ring: 'ring-green-500/20',
    },
    at_risk: {
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-600',
      border: 'border-yellow-500/20',
      ring: 'ring-yellow-500/20',
    },
    critical: {
      bg: 'bg-orange-500/10',
      text: 'text-orange-600',
      border: 'border-orange-500/20',
      ring: 'ring-orange-500/20',
    },
    ghost: {
      bg: 'bg-red-500/10',
      text: 'text-red-600',
      border: 'border-red-500/20',
      ring: 'ring-red-500/20',
    },
  };

  // Size variants
  const sizeVariants = {
    sm: {
      container: 'px-2 py-1 text-xs',
      score: 'text-xs font-semibold',
      icon: 'h-3 w-3',
    },
    md: {
      container: 'px-3 py-1.5 text-sm',
      score: 'text-sm font-bold',
      icon: 'h-4 w-4',
    },
    lg: {
      container: 'px-4 py-2 text-base',
      score: 'text-lg font-bold',
      icon: 'h-5 w-5',
    },
  };

  const colors = statusColors[status];
  const sizes = sizeVariants[size];

  // Trend icon
  const TrendIcon = trend === 'improving'
    ? TrendingUp
    : trend === 'declining'
    ? TrendingDown
    : Minus;

  const trendColor = trend === 'improving'
    ? 'text-green-500'
    : trend === 'declining'
    ? 'text-red-500'
    : 'text-gray-400';

  return (
    <div
      className={`
        inline-flex items-center gap-2 rounded-full border
        ${colors.bg} ${colors.border} ${sizes.container}
        ${className}
      `}
    >
      {/* Ghost warning icon */}
      {status === 'ghost' && (
        <AlertTriangle className={`${sizes.icon} ${colors.text}`} />
      )}

      {/* Health score */}
      {showScore && (
        <span className={`${sizes.score} ${colors.text}`}>
          {score}
        </span>
      )}

      {/* Status label */}
      <span className={`${colors.text} capitalize`}>
        {status.replace('_', ' ')}
      </span>

      {/* Trend indicator */}
      {showTrend && trend && (
        <TrendIcon className={`${sizes.icon} ${trendColor}`} />
      )}
    </div>
  );
}

/**
 * Compact health score circle (for tables/lists)
 */
interface HealthScoreCircleProps {
  score: number;
  size?: number;
  showLabel?: boolean;
}

export function HealthScoreCircle({ score, size = 40, showLabel = true }: HealthScoreCircleProps) {
  // Determine color based on score
  const getColor = (score: number) => {
    if (score >= 70) return { stroke: '#10b981', text: 'text-green-600' }; // healthy
    if (score >= 50) return { stroke: '#f59e0b', text: 'text-yellow-600' }; // at risk
    if (score >= 30) return { stroke: '#f97316', text: 'text-orange-600' }; // critical
    return { stroke: '#ef4444', text: 'text-red-600' }; // ghost
  };

  const color = getColor(score);
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background circle */}
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e5e7eb"
            strokeWidth="3"
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color.stroke}
            strokeWidth="3"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xs font-bold ${color.text}`}>{score}</span>
        </div>
      </div>
      {showLabel && (
        <span className="text-xs text-gray-500">Health</span>
      )}
    </div>
  );
}
