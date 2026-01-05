import React from 'react';
import { Clock, Users, User, TrendingUp, TrendingDown, Minus, Calendar, Lightbulb } from 'lucide-react';
import type { TimeBreakdownResponseData, TimeBreakdownDay } from '../types';

interface TimeBreakdownResponseProps {
  data: TimeBreakdownResponseData;
  onActionClick?: (action: string, data?: unknown) => void;
}

export const TimeBreakdownResponse: React.FC<TimeBreakdownResponseProps> = ({ data }) => {
  const {
    periodLabel,
    totalHours,
    meetingHours,
    nonMeetingHours,
    breakdown,
    dailyDistribution,
    insights,
    comparison,
  } = data;

  const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const meetingPercentage = totalHours > 0 ? (meetingHours / totalHours) * 100 : 0;

  const getTrendIcon = () => {
    if (!comparison) return null;
    if (comparison.trend === 'up') return <TrendingUp className="w-4 h-4 text-yellow-400" />;
    if (comparison.trend === 'down') return <TrendingDown className="w-4 h-4 text-green-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getTrendColor = () => {
    if (!comparison) return 'text-gray-400';
    // For meetings, down trend is good (less meeting load)
    if (comparison.trend === 'up') return 'text-yellow-400';
    if (comparison.trend === 'down') return 'text-green-400';
    return 'text-gray-400';
  };

  const maxDailyHours = Math.max(...dailyDistribution.map(d => d.meetingHours), 1);

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-blue-500/20 rounded-full">
            <Clock className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white capitalize">Time Breakdown</h3>
            <p className="text-sm text-gray-400">{periodLabel}</p>
          </div>
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{formatHours(meetingHours)}</div>
            <div className="text-xs text-gray-400">in meetings</div>
          </div>
          <div className="text-center border-x border-gray-700">
            <div className="text-2xl font-bold text-white">{formatHours(nonMeetingHours)}</div>
            <div className="text-xs text-gray-400">focus time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{meetingPercentage.toFixed(0)}%</div>
            <div className="text-xs text-gray-400">meeting load</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${meetingPercentage}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Meetings</span>
          <span>Focus Time</span>
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
            </div>
          </div>
        )}
      </div>

      {/* Breakdown by Type */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-white mb-4">Meeting Types</h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Users className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold text-white">{formatHours(breakdown.external.hours)}</span>
                <span className="text-xs text-gray-500">({breakdown.external.count})</span>
              </div>
              <p className="text-xs text-gray-400">External</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <User className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold text-white">{formatHours(breakdown.internal.hours)}</span>
                <span className="text-xs text-gray-500">({breakdown.internal.count})</span>
              </div>
              <p className="text-xs text-gray-400">Internal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <User className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold text-white">{formatHours(breakdown.oneOnOne.hours)}</span>
                <span className="text-xs text-gray-500">({breakdown.oneOnOne.count})</span>
              </div>
              <p className="text-xs text-gray-400">1:1 Meetings</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Users className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold text-white">{formatHours(breakdown.group.hours)}</span>
                <span className="text-xs text-gray-500">({breakdown.group.count})</span>
              </div>
              <p className="text-xs text-gray-400">Group Meetings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Distribution */}
      {dailyDistribution.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            Daily Distribution
          </h4>
          <div className="space-y-3">
            {dailyDistribution.map((day) => (
              <div key={day.date} className="flex items-center gap-3">
                <div className="w-16 text-sm text-gray-400">{day.dayLabel.slice(0, 3)}</div>
                <div className="flex-1">
                  <div className="h-6 bg-gray-700 rounded overflow-hidden">
                    <div
                      className={`h-full rounded transition-all duration-300 ${
                        day.busiest
                          ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                          : 'bg-gradient-to-r from-blue-500 to-purple-500'
                      }`}
                      style={{ width: `${(day.meetingHours / maxDailyHours) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="w-20 text-right">
                  <span className="text-sm text-white font-medium">{formatHours(day.meetingHours)}</span>
                  <span className="text-xs text-gray-500 ml-1">({day.meetingCount})</span>
                </div>
                {day.busiest && (
                  <span className="text-xs text-yellow-400">busiest</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-yellow-400" />
            Insights
          </h4>
          <ul className="space-y-2">
            {insights.map((insight, idx) => (
              <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-blue-400 mt-1">-</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
