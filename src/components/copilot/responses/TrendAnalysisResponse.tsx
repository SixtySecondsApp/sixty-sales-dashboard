/**
 * Trend Analysis Response Component
 * Displays trend charts and analysis with growth rates and comparisons
 */

import React from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { ActionButtons } from '../ActionButtons';
import type { TrendAnalysisResponse as TrendAnalysisResponseType } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface TrendAnalysisResponseProps {
  data: TrendAnalysisResponseType;
  onActionClick?: (action: any) => void;
}

const formatValue = (value: number, metric: string): string => {
  if (metric.toLowerCase().includes('revenue') || metric.toLowerCase().includes('value')) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }
  if (metric.toLowerCase().includes('rate') || metric.toLowerCase().includes('percentage')) {
    return `${value.toFixed(1)}%`;
  }
  return value.toLocaleString();
};

const getTrendColor = (trend: string) => {
  switch (trend) {
    case 'increasing':
      return 'text-emerald-400';
    case 'decreasing':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
};

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'increasing':
      return <TrendingUp className="w-5 h-5 text-emerald-400" />;
    case 'decreasing':
      return <TrendingDown className="w-5 h-5 text-red-400" />;
    default:
      return <Minus className="w-5 h-5 text-gray-400" />;
  }
};

export const TrendAnalysisResponse: React.FC<TrendAnalysisResponseProps> = ({ data, onActionClick }) => {
  const { metric, period, dataPoints, summary, comparisons } = data.data;

  // Prepare chart data
  const chartData = dataPoints.map(point => ({
    date: new Date(point.date).toLocaleDateString('en-GB', { 
      month: 'short', 
      day: 'numeric',
      ...(period.granularity === 'week' && { week: 'numeric' })
    }),
    value: point.value,
    label: point.label
  }));

  return (
    <div className="space-y-6">
      {/* Header with Summary */}
      <div className="bg-gradient-to-r from-gray-900/80 to-gray-800/80 backdrop-blur-sm border border-gray-800/50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            <div>
              <h3 className="text-lg font-semibold text-gray-100">{metric}</h3>
              <p className="text-sm text-gray-400">{period.startDate} to {period.endDate}</p>
            </div>
          </div>
          <div className="text-right">
            {getTrendIcon(summary.overallTrend)}
            <div className={`text-2xl font-bold mt-1 ${getTrendColor(summary.overallTrend)}`}>
              {summary.growthRate >= 0 ? '+' : ''}{summary.growthRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400">Growth Rate</div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div>
            <div className="text-xs text-gray-400 mb-1">Average</div>
            <div className="text-lg font-semibold text-gray-100">{formatValue(summary.averageValue, metric)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Peak</div>
            <div className="text-lg font-semibold text-emerald-400">{formatValue(summary.peakValue, metric)}</div>
            <div className="text-xs text-gray-500">{new Date(summary.peakDate).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Lowest</div>
            <div className="text-lg font-semibold text-red-400">{formatValue(summary.lowestValue, metric)}</div>
            <div className="text-xs text-gray-500">{new Date(summary.lowestDate).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Volatility</div>
            <div className={`text-lg font-semibold ${
              summary.volatility === 'high' ? 'text-red-400' : 
              summary.volatility === 'medium' ? 'text-amber-400' : 
              'text-emerald-400'
            }`}>
              {summary.volatility.charAt(0).toUpperCase() + summary.volatility.slice(1)}
            </div>
          </div>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-lg p-6">
        <h4 className="text-sm font-medium text-gray-300 mb-4">Trend Over Time</h4>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="date" 
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
            />
            <YAxis 
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => formatValue(value, metric)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#f3f4f6'
              }}
              formatter={(value: number) => formatValue(value, metric)}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Period Comparisons */}
      {comparisons && comparisons.length > 0 && (
        <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-800/50 rounded-lg p-6">
          <h4 className="text-sm font-medium text-gray-300 mb-4">Period Comparisons</h4>
          <div className="space-y-3">
            {comparisons.map((comparison, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-200">{comparison.period}</div>
                  <div className="text-xs text-gray-400">Average: {formatValue(comparison.average, metric)}</div>
                </div>
                <div className={`flex items-center gap-1 ${comparison.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {comparison.change >= 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  <span className="text-sm font-semibold">
                    {comparison.change >= 0 ? '+' : ''}{comparison.change.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {data.actions && data.actions.length > 0 && (
        <ActionButtons actions={data.actions} onActionClick={onActionClick} />
      )}
    </div>
  );
};







