/**
 * DealSentimentIndicator - Combined sentiment display for deal cards
 *
 * Shows sparkline + trend indicator in a compact format for pipeline cards.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { SentimentSparkline } from './SentimentSparkline';
import { SentimentTrendBadge } from './SentimentTrendBadge';
import type { TrendDirection } from '@/lib/hooks/useDealSentimentTrend';

export interface DealSentimentData {
  /** Average sentiment score (-1 to +1) */
  avg_sentiment: number | null;
  /** Array of historical sentiment scores for sparkline */
  sentiment_history: number[];
  /** Trend direction */
  trend_direction: TrendDirection;
  /** Trend delta (change in sentiment) */
  trend_delta: number;
  /** Number of meetings with sentiment data */
  meeting_count: number;
}

interface DealSentimentIndicatorProps {
  /** Sentiment data for the deal */
  sentiment: DealSentimentData | null;
  /** Show in compact mode (smaller, minimal labels) */
  compact?: boolean;
  /** CSS class name */
  className?: string;
  /** Callback when clicked */
  onClick?: () => void;
}

export function DealSentimentIndicator({
  sentiment,
  compact = true,
  className,
  onClick,
}: DealSentimentIndicatorProps) {
  if (!sentiment || sentiment.meeting_count === 0) {
    return null;
  }

  // Format average sentiment as percentage (0-100%)
  const avgSentimentPercent = sentiment.avg_sentiment !== null
    ? Math.round(((sentiment.avg_sentiment + 1) / 2) * 100)
    : null;

  const hasSparklineData = sentiment.sentiment_history.length >= 2;

  if (compact) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md",
          "hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
          "group/sentiment",
          className
        )}
        title={`Sentiment: ${avgSentimentPercent}% (${sentiment.meeting_count} meetings)`}
      >
        {/* Sparkline */}
        {hasSparklineData && (
          <SentimentSparkline
            values={sentiment.sentiment_history}
            width={40}
            height={16}
          />
        )}

        {/* Trend indicator */}
        <SentimentTrendBadge
          direction={sentiment.trend_direction}
          compact
        />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 p-2 rounded-lg",
        "bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50",
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Sentiment
        </span>
        {avgSentimentPercent !== null && (
          <span className={cn(
            "text-xs font-semibold",
            avgSentimentPercent >= 60 ? "text-emerald-600 dark:text-emerald-400" :
            avgSentimentPercent >= 40 ? "text-yellow-600 dark:text-yellow-400" :
            "text-red-600 dark:text-red-400"
          )}>
            {avgSentimentPercent}%
          </span>
        )}
      </div>

      {hasSparklineData && (
        <SentimentSparkline
          values={sentiment.sentiment_history}
          width={80}
          height={24}
          showDots
        />
      )}

      <SentimentTrendBadge
        direction={sentiment.trend_direction}
        delta={sentiment.trend_delta}
      />

      <span className="text-[10px] text-gray-500 dark:text-gray-500">
        {sentiment.meeting_count} meeting{sentiment.meeting_count !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

export default DealSentimentIndicator;
