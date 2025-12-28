/**
 * SentimentTrendBadge - Compact badge showing sentiment trend direction
 *
 * Displays trend status (improving/stable/declining) with visual indicators.
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrendDirection } from '@/lib/hooks/useDealSentimentTrend';

interface SentimentTrendBadgeProps {
  /** Trend direction from sentiment analysis */
  direction: TrendDirection;
  /** Optional delta value to display */
  delta?: number;
  /** Compact mode (icon only) */
  compact?: boolean;
  /** CSS class name */
  className?: string;
}

const trendConfig: Record<TrendDirection, {
  icon: typeof TrendingUp;
  label: string;
  bgClass: string;
  textClass: string;
  iconClass: string;
}> = {
  improving: {
    icon: TrendingUp,
    label: 'Improving',
    bgClass: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
    textClass: 'text-emerald-700 dark:text-emerald-400',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
  },
  stable: {
    icon: Minus,
    label: 'Stable',
    bgClass: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
    textClass: 'text-blue-700 dark:text-blue-400',
    iconClass: 'text-blue-600 dark:text-blue-400',
  },
  declining: {
    icon: TrendingDown,
    label: 'Declining',
    bgClass: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
    textClass: 'text-red-700 dark:text-red-400',
    iconClass: 'text-red-600 dark:text-red-400',
  },
  insufficient_data: {
    icon: HelpCircle,
    label: 'Not enough data',
    bgClass: 'bg-gray-50 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/20',
    textClass: 'text-gray-600 dark:text-gray-400',
    iconClass: 'text-gray-500 dark:text-gray-400',
  },
};

export function SentimentTrendBadge({
  direction,
  delta,
  compact = false,
  className,
}: SentimentTrendBadgeProps) {
  const config = trendConfig[direction];
  const Icon = config.icon;

  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center w-5 h-5 rounded-full border",
          config.bgClass,
          className
        )}
        title={`Sentiment: ${config.label}${delta !== undefined ? ` (${delta > 0 ? '+' : ''}${(delta * 100).toFixed(0)}%)` : ''}`}
      >
        <Icon className={cn("w-3 h-3", config.iconClass)} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
        config.bgClass,
        config.textClass,
        className
      )}
    >
      <Icon className={cn("w-3 h-3", config.iconClass)} />
      <span>{config.label}</span>
      {delta !== undefined && direction !== 'insufficient_data' && (
        <span className="opacity-75">
          ({delta > 0 ? '+' : ''}{(delta * 100).toFixed(0)}%)
        </span>
      )}
    </div>
  );
}

export default SentimentTrendBadge;
