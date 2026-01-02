import React from 'react';
import { Calendar, TrendingUp, TrendingDown, Minus, Users, User } from 'lucide-react';
import type { MeetingCountResponseData } from '../types';

interface MeetingCountResponseProps {
  data: MeetingCountResponseData;
  onActionClick?: (action: string, data?: unknown) => void;
}

export const MeetingCountResponse: React.FC<MeetingCountResponseProps> = ({ data }) => {
  const { count, periodLabel, breakdown, comparison } = data;

  const getTrendIcon = () => {
    if (!comparison) return null;
    if (comparison.trend === 'up') return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (comparison.trend === 'down') return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getTrendColor = () => {
    if (!comparison) return 'text-gray-400';
    if (comparison.trend === 'up') return 'text-green-400';
    if (comparison.trend === 'down') return 'text-red-400';
    return 'text-gray-400';
  };

  return (
    <div className="space-y-4">
      {/* Main Count */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/20 rounded-full">
            <Calendar className="w-6 h-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-white">{count}</span>
              <span className="text-lg text-gray-400">
                meeting{count !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1 capitalize">{periodLabel}</p>
          </div>
        </div>

        {/* Comparison */}
        {comparison && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="flex items-center gap-2">
              {getTrendIcon()}
              <span className={`text-sm ${getTrendColor()}`}>
                {comparison.percentageChange > 0 ? '+' : ''}
                {comparison.percentageChange.toFixed(0)}% vs previous period
              </span>
              <span className="text-sm text-gray-500">
                ({comparison.previousPeriod} meetings)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Breakdown */}
      {breakdown && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-white mb-3">Breakdown</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              <div>
                <span className="text-white font-semibold">{breakdown.external}</span>
                <span className="text-gray-400 text-sm ml-1">external</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" />
              <div>
                <span className="text-white font-semibold">{breakdown.internal}</span>
                <span className="text-gray-400 text-sm ml-1">internal</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-green-400" />
              <div>
                <span className="text-white font-semibold">{breakdown.oneOnOne}</span>
                <span className="text-gray-400 text-sm ml-1">1:1s</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-yellow-400" />
              <div>
                <span className="text-white font-semibold">{breakdown.group}</span>
                <span className="text-gray-400 text-sm ml-1">group</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
