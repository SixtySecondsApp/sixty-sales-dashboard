import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Calendar, UserX } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface EnhancedStatCardProps {
  title: string;
  primaryValue: string | number;
  secondaryValue?: string | number;
  percentageValue?: number;
  trendPercentage?: number;
  periodContext: string;
  icon: React.ElementType;
  color: 'emerald' | 'cyan' | 'blue' | 'violet' | 'orange' | 'red' | 'yellow';
  variant?: 'default' | 'no-show';
  onClick?: () => void;
  className?: string;
}

const colorClasses = {
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-500',
    hover: 'hover:border-emerald-500/50'
  },
  cyan: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    text: 'text-cyan-500',
    hover: 'hover:border-cyan-500/50'
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-500',
    hover: 'hover:border-blue-500/50'
  },
  violet: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    text: 'text-violet-500',
    hover: 'hover:border-violet-500/50'
  },
  orange: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    text: 'text-orange-500',
    hover: 'hover:border-orange-500/50'
  },
  red: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-500',
    hover: 'hover:border-red-500/50'
  },
  yellow: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    text: 'text-yellow-500',
    hover: 'hover:border-yellow-500/50'
  }
} as const;

export function EnhancedStatCard({
  title,
  primaryValue,
  secondaryValue,
  percentageValue,
  trendPercentage,
  periodContext,
  icon: Icon,
  color,
  variant = 'default',
  onClick,
  className
}: EnhancedStatCardProps) {
  const colorClass = colorClasses[color];
  
  const getTrendIcon = () => {
    if (trendPercentage === undefined || trendPercentage === 0) return Minus;
    return trendPercentage > 0 ? TrendingUp : TrendingDown;
  };

  const getTrendColor = () => {
    if (trendPercentage === undefined || trendPercentage === 0) return 'text-gray-500';
    if (variant === 'no-show') {
      // For no-show rate, lower is better
      return trendPercentage > 0 ? 'text-red-500' : 'text-emerald-500';
    }
    // For other metrics, higher is better
    return trendPercentage > 0 ? 'text-emerald-500' : 'text-red-500';
  };

  const formatTrendText = () => {
    if (trendPercentage === undefined || trendPercentage === 0) return '0%';
    const prefix = trendPercentage > 0 ? '+' : '';
    return `${prefix}${trendPercentage.toFixed(1)}%`;
  };

  const TrendIcon = getTrendIcon();

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={cn(
        'bg-white dark:bg-transparent dark:bg-gradient-to-br dark:from-gray-900/80 dark:to-gray-900/40 dark:backdrop-blur-xl rounded-xl p-5 border border-gray-200 dark:border-gray-800/50 transition-all duration-300 shadow-sm dark:shadow-none',
        colorClass.hover,
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      {/* Header with Icon and Trend */}
      <div className="flex items-start justify-between mb-4">
        <div className={cn(
          'p-2.5 rounded-lg border',
          colorClass.bg,
          colorClass.border
        )}>
          <Icon className={cn('w-5 h-5', colorClass.text)} />
        </div>

        {/* Trend Indicator with Period Context */}
        {trendPercentage !== undefined && (
          <div className="flex flex-col items-end">
            <div className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
              getTrendColor(),
              'bg-gray-100 dark:bg-gray-800/50'
            )}>
              <TrendIcon className="w-3 h-3" />
              {formatTrendText()}
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-500">
              <Calendar className="w-3 h-3" />
              {periodContext}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2">
        {/* Title */}
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h3>

        {/* Primary Value */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {primaryValue}
          </span>
          {percentageValue !== undefined && (
            <span className={cn('text-sm font-medium', colorClass.text)}>
              ({percentageValue.toFixed(1)}%)
            </span>
          )}
        </div>

        {/* Secondary Value */}
        {secondaryValue && (
          <div className="text-sm text-gray-600 dark:text-gray-500">
            {secondaryValue}
          </div>
        )}
      </div>

      {/* Special indicator for no-show rate */}
      {variant === 'no-show' && (
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-200 dark:border-gray-800/50">
          <UserX className="w-3 h-3 text-orange-500" />
          <span className="text-xs text-orange-400">Lost Opportunities</span>
        </div>
      )}
    </motion.div>
  );
}