import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { isTalkTimeIdeal, getIdealTalkTimeRange } from '@/lib/services/coachingService';

interface TalkTimeChartProps {
  repPct: number;
  customerPct: number;
  meetingDate?: string;
}

const COLORS = {
  rep: '#3b82f6', // blue-500
  customer: '#10b981', // emerald-500
};

export function TalkTimeChart({ repPct, customerPct, meetingDate }: TalkTimeChartProps) {
  const data = [
    { name: 'Sales Rep', value: repPct, color: COLORS.rep },
    { name: 'Customer', value: customerPct, color: COLORS.customer },
  ];

  const ideal = getIdealTalkTimeRange();
  const isIdeal = isTalkTimeIdeal(repPct);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {payload[0].name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {payload[0].value.toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Talk Time Distribution</CardTitle>
            <CardDescription>
              {meetingDate ? `Meeting on ${new Date(meetingDate).toLocaleDateString()}` : 'Current meeting'}
            </CardDescription>
          </div>
          <Badge variant={isIdeal ? 'default' : 'secondary'}>
            {isIdeal ? 'Ideal' : 'Needs Improvement'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Donut Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value, entry: any) => (
                  <span style={{ color: entry.color }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Progress Bars */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">Sales Rep</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {repPct.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={repPct}
              className="h-2"
              style={{
                backgroundColor: repPct > ideal.max ? '#fef2f2' : repPct < ideal.min ? '#fef2f2' : '#f0fdf4',
              }}
            />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">Customer</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {customerPct.toFixed(1)}%
              </span>
            </div>
            <Progress value={customerPct} className="h-2" />
          </div>
        </div>

        {/* Ideal Range Indicator */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Ideal range: {ideal.min}% - {ideal.max}% rep talk time
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

