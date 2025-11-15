// Lazy loading wrapper for Sales Activity Chart to improve homepage performance

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/hooks/useTheme';

interface LazySalesActivityChartProps {
  selectedMonth: Date;
  className?: string;
}

// Skeleton component for loading state
const SalesActivityChartSkeleton = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const skeletonColors = {
    bg: isDark ? 'bg-gray-900/50' : 'bg-white',
    border: isDark ? 'border-gray-800/50' : 'border-gray-200',
    element: isDark ? 'bg-gray-800' : 'bg-gray-200',
  };

  return (
    <div className={`backdrop-blur-xl rounded-xl p-6 border animate-pulse ${skeletonColors.bg} ${skeletonColors.border}`}>
      <div className="mb-6">
        <div className={`h-6 w-48 rounded-lg mb-2 ${skeletonColors.element}`} />
        <div className={`h-4 w-64 rounded-lg ${skeletonColors.element}`} />
      </div>
      <div className={`h-64 w-full rounded-lg ${skeletonColors.element}`} />
    </div>
  );
};

export const LazySalesActivityChart: React.FC<LazySalesActivityChartProps> = ({ selectedMonth, className }) => {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [SalesActivityChartComponent, setSalesActivityChartComponent] = useState<React.ComponentType<any> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection observer for lazy loading
  useEffect(() => {
    if (!containerRef.current || shouldLoad) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    observer.observe(containerRef.current);
    
    return () => observer.disconnect();
  }, [shouldLoad]);

  // Dynamic import when needed
  useEffect(() => {
    if (!shouldLoad) return;

    const loadComponent = async () => {
      try {
        const module = await import('@/components/SalesActivityChart');
        setSalesActivityChartComponent(() => module.default);
      } catch (error) {
      }
    };

    loadComponent();
  }, [shouldLoad]);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const colors = {
    bg: isDark ? 'bg-gray-900/50' : 'bg-white',
    border: isDark ? 'border-gray-800/50' : 'border-gray-200',
    text: isDark ? 'text-gray-500' : 'text-gray-400',
  };

  return (
    <div ref={containerRef} className={className}>
      {!shouldLoad ? (
        <div className={`backdrop-blur-xl rounded-xl p-6 border ${colors.bg} ${colors.border}`}>
          <div className={`text-center py-8 ${colors.text}`}>
            Sales activity chart will load when visible...
          </div>
        </div>
      ) : !SalesActivityChartComponent ? (
        <SalesActivityChartSkeleton />
      ) : (
        <SalesActivityChartComponent selectedMonth={selectedMonth} />
      )}
    </div>
  );
};