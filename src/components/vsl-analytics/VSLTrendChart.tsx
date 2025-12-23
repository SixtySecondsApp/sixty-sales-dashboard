import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, Eye, Clock } from 'lucide-react';
import { VSLMetrics, getVariantColor, formatWatchTime } from '@/lib/hooks/useVSLAnalytics';
import { format, parseISO } from 'date-fns';

interface VSLTrendChartProps {
  variants: VSLMetrics[];
  isLoading?: boolean;
}

type MetricType = 'views' | 'watchTime';

interface ChartDataPoint {
  date: string;
  displayDate: string;
  [key: string]: number | string;
}

function mergeVariantTrends(variants: VSLMetrics[]): ChartDataPoint[] {
  const dateMap = new Map<string, ChartDataPoint>();

  variants.forEach((variant) => {
    variant.trend.forEach((point) => {
      if (!dateMap.has(point.date)) {
        dateMap.set(point.date, {
          date: point.date,
          displayDate: format(parseISO(point.date), 'MMM d'),
        });
      }
      const entry = dateMap.get(point.date)!;
      entry[`${variant.variantId}_views`] = point.views;
      entry[`${variant.variantId}_watchTime`] = point.watchTime;
    });
  });

  return Array.from(dateMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
    name: string;
  }>;
  label?: string;
  metricType: MetricType;
  variants: VSLMetrics[];
}

function CustomTooltip({ active, payload, label, metricType, variants }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
      <p className="text-gray-400 text-xs mb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry) => {
          const variantId = entry.dataKey.replace(`_${metricType}`, '').replace('_views', '').replace('_watchTime', '');
          const variant = variants.find((v) => v.variantId === variantId);
          const displayValue =
            metricType === 'watchTime' ? formatWatchTime(entry.value) : entry.value.toLocaleString();

          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-gray-300 text-sm">{variant?.name || variantId}</span>
              </div>
              <span className="text-white font-medium text-sm">{displayValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function VSLTrendChart({ variants, isLoading }: VSLTrendChartProps) {
  const [metricType, setMetricType] = useState<MetricType>('views');

  const chartData = mergeVariantTrends(variants);
  const hasData = chartData.length > 0;

  if (isLoading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-40 bg-gray-700 rounded animate-pulse" />
          <div className="h-8 w-48 bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="h-[300px] bg-gray-700/30 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-brand-violet" />
          <h3 className="text-lg font-semibold text-white">Performance Over Time</h3>
        </div>

        {/* Metric Toggle */}
        <div className="flex bg-gray-700/50 rounded-lg p-1">
          <button
            onClick={() => setMetricType('views')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              metricType === 'views'
                ? 'bg-gray-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4" />
            Views
          </button>
          <button
            onClick={() => setMetricType('watchTime')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              metricType === 'watchTime'
                ? 'bg-gray-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            Watch Time
          </button>
        </div>
      </div>

      {/* Chart */}
      {hasData ? (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis
                dataKey="displayDate"
                stroke="#9CA3AF"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#9CA3AF"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) =>
                  metricType === 'watchTime'
                    ? `${Math.round(value / 60)}m`
                    : value.toLocaleString()
                }
              />
              <Tooltip
                content={
                  <CustomTooltip metricType={metricType} variants={variants} />
                }
              />
              <Legend
                formatter={(value) => {
                  const variantId = value.replace(`_${metricType}`, '').replace('_views', '').replace('_watchTime', '');
                  const variant = variants.find((v) => v.variantId === variantId);
                  return <span className="text-gray-300 text-sm">{variant?.name || variantId}</span>;
                }}
              />
              {variants.map((variant) => (
                <Line
                  key={variant.variantId}
                  type="monotone"
                  dataKey={`${variant.variantId}_${metricType}`}
                  name={`${variant.variantId}_${metricType}`}
                  stroke={getVariantColor(variant.variantId)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[300px] flex items-center justify-center">
          <div className="text-center">
            <TrendingUp className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No trend data available for the selected period</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default VSLTrendChart;
