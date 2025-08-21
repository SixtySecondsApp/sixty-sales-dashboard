/**
 * Dynamic Chart Loader - Reduces initial bundle size by lazy loading chart library
 * 
 * This component provides a wrapper for dynamically importing and rendering
 * Recharts components, reducing the initial bundle size by ~400KB
 */

import React, { Suspense, lazy } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load chart components to reduce bundle size
const ComposedChart = lazy(() => 
  import('recharts').then(mod => ({ default: mod.ComposedChart }))
);
const Bar = lazy(() => 
  import('recharts').then(mod => ({ default: mod.Bar }))
);
const XAxis = lazy(() => 
  import('recharts').then(mod => ({ default: mod.XAxis }))
);
const YAxis = lazy(() => 
  import('recharts').then(mod => ({ default: mod.YAxis }))
);
const CartesianGrid = lazy(() => 
  import('recharts').then(mod => ({ default: mod.CartesianGrid }))
);
const Tooltip = lazy(() => 
  import('recharts').then(mod => ({ default: mod.Tooltip }))
);
const Legend = lazy(() => 
  import('recharts').then(mod => ({ default: mod.Legend }))
);
const ResponsiveContainer = lazy(() => 
  import('recharts').then(mod => ({ default: mod.ResponsiveContainer }))
);
const Label = lazy(() => 
  import('recharts').then(mod => ({ default: mod.Label }))
);

interface ChartSkeletonProps {
  height?: number;
  className?: string;
}

// Chart loading skeleton with proper dimensions
const ChartSkeleton: React.FC<ChartSkeletonProps> = ({ height = 400, className }) => (
  <div className={`space-y-4 ${className || ''}`}>
    <div className="flex items-center justify-between">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-8 w-24" />
    </div>
    <div className="relative">
      <Skeleton className={`w-full`} style={{ height: `${height}px` }} />
      {/* Chart elements skeleton */}
      <div className="absolute inset-0 p-4 space-y-2">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-8 bottom-8 w-8 flex flex-col justify-between">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-3 w-6" />
          ))}
        </div>
        {/* X-axis labels */}
        <div className="absolute bottom-0 left-12 right-4 h-8 flex justify-between items-center">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-3 w-8" />
          ))}
        </div>
        {/* Chart bars */}
        <div className="absolute left-12 right-4 top-8 bottom-12 flex items-end justify-between">
          {[...Array(7)].map((_, i) => (
            <Skeleton 
              key={i} 
              className="w-8" 
              style={{ height: `${Math.random() * 60 + 20}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  </div>
);

interface DynamicComposedChartProps {
  data: any[];
  width?: number | string;
  height?: number;
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}

// Dynamic ComposedChart component with proper loading state
export const DynamicComposedChart: React.FC<DynamicComposedChartProps> = ({
  data,
  width = '100%',
  height = 400,
  children,
  className,
  ...props
}) => {
  return (
    <Suspense fallback={<ChartSkeleton height={height} className={className} />}>
      <ResponsiveContainer width={width} height={height}>
        <ComposedChart data={data} {...props}>
          {children}
        </ComposedChart>
      </ResponsiveContainer>
    </Suspense>
  );
};

// Export individual chart components with lazy loading
export const DynamicBar: React.FC<any> = (props) => (
  <Suspense fallback={null}>
    <Bar {...props} />
  </Suspense>
);

export const DynamicXAxis: React.FC<any> = (props) => (
  <Suspense fallback={null}>
    <XAxis {...props} />
  </Suspense>
);

export const DynamicYAxis: React.FC<any> = (props) => (
  <Suspense fallback={null}>
    <YAxis {...props} />
  </Suspense>
);

export const DynamicCartesianGrid: React.FC<any> = (props) => (
  <Suspense fallback={null}>
    <CartesianGrid {...props} />
  </Suspense>
);

export const DynamicTooltip: React.FC<any> = (props) => (
  <Suspense fallback={null}>
    <Tooltip {...props} />
  </Suspense>
);

export const DynamicLegend: React.FC<any> = (props) => (
  <Suspense fallback={null}>
    <Legend {...props} />
  </Suspense>
);

export const DynamicLabel: React.FC<any> = (props) => (
  <Suspense fallback={null}>
    <Label {...props} />
  </Suspense>
);

// Utility hook for preloading charts when user is likely to need them
export const usePreloadCharts = () => {
  React.useEffect(() => {
    // Preload charts after a delay, only if user hasn't navigated away
    const timer = setTimeout(() => {
      // Preload the recharts module
      import('recharts').catch(err => 
        console.warn('Failed to preload charts:', err)
      );
    }, 2000); // 2 second delay

    return () => clearTimeout(timer);
  }, []);
};

export { ChartSkeleton };