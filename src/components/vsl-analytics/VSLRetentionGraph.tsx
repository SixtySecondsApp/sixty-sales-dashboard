import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { Activity, AlertTriangle } from 'lucide-react';
import { VSLMetrics, getVariantColor, formatPercentage } from '@/lib/hooks/useVSLAnalytics';

interface VSLRetentionGraphProps {
  variants: VSLMetrics[];
  isLoading?: boolean;
}

interface RetentionDataPoint {
  percentageWatched: number;
  displayPercentage: string;
  [key: string]: number | string;
}

function mergeRetentionData(variants: VSLMetrics[]): RetentionDataPoint[] {
  // Create standard percentage points (0%, 10%, 20%, ... 100%)
  const percentagePoints = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  return percentagePoints.map((percentage) => {
    const point: RetentionDataPoint = {
      percentageWatched: percentage,
      displayPercentage: `${percentage}%`,
    };

    variants.forEach((variant) => {
      // Find the closest retention data point
      const retentionPoint = variant.retention.find(
        (r) => r.percentageWatched === percentage
      );
      point[variant.variantId] = retentionPoint?.viewerPercentage ?? 0;
    });

    return point;
  });
}

interface DropOffPoint {
  variantId: string;
  variantName: string;
  percentage: number;
  dropOff: number;
}

function findMajorDropoffs(variants: VSLMetrics[]): DropOffPoint[] {
  const dropoffs: DropOffPoint[] = [];

  variants.forEach((variant) => {
    let maxDropOff = 0;
    let maxDropOffPercentage = 0;

    for (let i = 1; i < variant.retention.length; i++) {
      const prev = variant.retention[i - 1];
      const curr = variant.retention[i];
      const dropOff = prev.viewerPercentage - curr.viewerPercentage;

      if (dropOff > maxDropOff) {
        maxDropOff = dropOff;
        maxDropOffPercentage = curr.percentageWatched;
      }
    }

    if (maxDropOff > 5) {
      // Only show significant drop-offs (>5%)
      dropoffs.push({
        variantId: variant.variantId,
        variantName: variant.name,
        percentage: maxDropOffPercentage,
        dropOff: maxDropOff,
      });
    }
  });

  return dropoffs.sort((a, b) => b.dropOff - a.dropOff);
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
  }>;
  label?: string;
  variants: VSLMetrics[];
}

function CustomTooltip({ active, payload, label, variants }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
      <p className="text-gray-400 text-xs mb-2">At {label} of video</p>
      <div className="space-y-1.5">
        {payload.map((entry) => {
          const variant = variants.find((v) => v.variantId === entry.dataKey);
          return (
            <div key={entry.dataKey} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-gray-300 text-sm">{variant?.name || entry.dataKey}</span>
              </div>
              <span className="text-white font-medium text-sm">
                {formatPercentage(entry.value)} watching
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function VSLRetentionGraph({ variants, isLoading }: VSLRetentionGraphProps) {
  const chartData = mergeRetentionData(variants);
  const dropoffs = findMajorDropoffs(variants);
  const hasData = variants.some((v) => v.retention.length > 0);

  if (isLoading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-6 w-40 bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="h-[300px] bg-gray-700/30 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-brand-teal" />
          <h3 className="text-lg font-semibold text-white">Viewer Retention</h3>
        </div>

        {/* Drop-off Insights */}
        {dropoffs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {dropoffs.slice(0, 3).map((dropoff) => (
              <div
                key={dropoff.variantId}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs"
              >
                <AlertTriangle className="w-3 h-3" />
                <span>
                  {dropoff.variantName}: {formatPercentage(dropoff.dropOff)} drop at {dropoff.percentage}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chart */}
      {hasData ? (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                {variants.map((variant) => (
                  <linearGradient
                    key={variant.variantId}
                    id={`gradient-${variant.variantId}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={getVariantColor(variant.variantId)}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={getVariantColor(variant.variantId)}
                      stopOpacity={0}
                    />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis
                dataKey="displayPercentage"
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
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip variants={variants} />} />
              <Legend
                formatter={(value) => {
                  const variant = variants.find((v) => v.variantId === value);
                  return <span className="text-gray-300 text-sm">{variant?.name || value}</span>;
                }}
              />

              {/* Reference lines for common drop-off points */}
              <ReferenceLine
                x="50%"
                stroke="#4B5563"
                strokeDasharray="3 3"
                label={{ value: '50%', fill: '#6B7280', fontSize: 10 }}
              />

              {variants.map((variant) => (
                <Area
                  key={variant.variantId}
                  type="monotone"
                  dataKey={variant.variantId}
                  name={variant.variantId}
                  stroke={getVariantColor(variant.variantId)}
                  strokeWidth={2}
                  fill={`url(#gradient-${variant.variantId})`}
                  fillOpacity={1}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[300px] flex items-center justify-center">
          <div className="text-center">
            <Activity className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">No retention data available</p>
            <p className="text-gray-500 text-sm mt-1">
              Retention data requires sufficient video views
            </p>
          </div>
        </div>
      )}

      {/* Legend explanation */}
      <div className="mt-4 pt-4 border-t border-gray-700/50">
        <p className="text-gray-500 text-xs">
          This graph shows what percentage of viewers are still watching at each point in the video.
          Look for sharp drops to identify where viewers lose interest.
        </p>
      </div>
    </motion.div>
  );
}

export default VSLRetentionGraph;
