// Lazy loading wrapper for Sales Activity Chart to improve homepage performance

import React, { useState, useEffect, useRef } from 'react';

interface LazySalesActivityChartProps {
  selectedMonth: Date;
  className?: string;
}

// Skeleton component for loading state
const SalesActivityChartSkeleton = () => {
  return (
    <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50 animate-pulse">
      <div className="mb-6">
        <div className="h-6 w-48 bg-gray-800 rounded-lg mb-2" />
        <div className="h-4 w-64 bg-gray-800 rounded-lg" />
      </div>
      <div className="h-64 w-full bg-gray-800 rounded-lg" />
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
        console.error('Failed to load SalesActivityChart:', error);
      }
    };

    loadComponent();
  }, [shouldLoad]);

  return (
    <div ref={containerRef} className={className}>
      {!shouldLoad ? (
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50">
          <div className="text-center py-8 text-gray-500">
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