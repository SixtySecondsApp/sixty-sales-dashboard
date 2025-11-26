import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { calculateTalkTimeTrend, getIdealTalkTimeRange, type TalkTimeTrend as TalkTimeTrendType } from '@/lib/services/coachingService';
import { format } from 'date-fns';

interface TalkTimeTrendProps {
  trendData: TalkTimeTrendType[];
}

export function TalkTimeTrend({ trendData }: TalkTimeTrendProps) {
  const trend = calculateTalkTimeTrend(trendData);
  const ideal = getIdealTalkTimeRange();

  // Format data for chart
  const chartData = trendData.map(item => ({
    date: format(new Date(item.date), 'MMM d'),
    repPct: item.repPct,
    customerPct: item.customerPct,
    sentimentScore: item.sentimentScore,
  }));

  const TrendIcon = () => {
    if (trend.trend === 'improving') {
      return <TrendingDown className="w-4 h-4 text-green-500" />;
    } else if (trend.trend === 'declining') {
      return <TrendingUp className="w-4 h-4 text-red-500" />;
    }
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const getTrendLabel = () => {
    if (trend.trend === 'improving') {
      return 'Improving balance';
    } else if (trend.trend === 'declining') {
      return 'Declining balance';
    }
    return 'Stable';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Talk Time Trend</CardTitle>
            <CardDescription>
              Last {trendData.length} meetings
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <TrendIcon />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {getTrendLabel()}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {trendData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
            No data available
          </div>
        ) : (
          <div className="space-y-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis
                    dataKey="date"
                    className="text-xs text-gray-600 dark:text-gray-400"
                  />
                  <YAxis
                    domain={[0, 100]}
                    className="text-xs text-gray-600 dark:text-gray-400"
                    label={{ value: 'Percentage', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                  />
                  <ReferenceLine
                    y={ideal.min}
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    label={{ value: 'Min Ideal', position: 'right' }}
                  />
                  <ReferenceLine
                    y={ideal.max}
                    stroke="#f59e0b"
                    strokeDasharray="3 3"
                    label={{ value: 'Max Ideal', position: 'right' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="repPct"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 4 }}
                    name="Sales Rep"
                  />
                  <Line
                    type="monotone"
                    dataKey="customerPct"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 4 }}
                    name="Customer"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Average Rep Talk Time</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {trend.averageRepPct.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Average Customer Talk Time</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {trend.averageCustomerPct.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

