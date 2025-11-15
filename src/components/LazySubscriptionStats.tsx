// Lazy loading wrapper for Subscription Stats to improve homepage performance

import React, { useState, useEffect, useRef } from 'react';
import { Building2, Users, TrendingUp, DollarSign } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

interface LazySubscriptionStatsProps {
  className?: string;
  onClick?: (cardTitle: string) => void;
}

// Skeleton component for loading state
const SubscriptionStatsSkeleton = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const skeletonColors = {
    bg: isDark ? 'bg-gray-900/80' : 'bg-white',
    border: isDark ? 'border-gray-700/50' : 'border-gray-200',
    element: isDark ? 'bg-gray-800' : 'bg-gray-200',
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className={`backdrop-blur-sm rounded-xl p-6 border animate-pulse shadow-sm ${isDark ? 'shadow-none' : ''} ${skeletonColors.bg} ${skeletonColors.border}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg ${skeletonColors.element}`} />
            <div className="flex-1">
              <div className={`h-4 w-20 rounded-lg mb-2 ${skeletonColors.element}`} />
              <div className={`h-6 w-16 rounded-lg mb-1 ${skeletonColors.element}`} />
              <div className={`h-3 w-12 rounded-lg ${skeletonColors.element}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const LazySubscriptionStats: React.FC<LazySubscriptionStatsProps> = ({ className, onClick }) => {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [SubscriptionStatsComponent, setSubscriptionStatsComponent] = useState<React.ComponentType<any> | null>(null);
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
      { threshold: 0.1, rootMargin: '100px' }
    );

    observer.observe(containerRef.current);
    
    return () => observer.disconnect();
  }, [shouldLoad]);

  // Dynamic import when needed
  useEffect(() => {
    if (!shouldLoad) return;

    const loadComponent = async () => {
      try {
        const module = await import('@/components/SubscriptionStats');
        setSubscriptionStatsComponent(() => module.SubscriptionStats);
      } catch (error) {
      }
    };

    loadComponent();
  }, [shouldLoad]);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div ref={containerRef} className={className}>
      {!shouldLoad ? (
        <div className={`text-center py-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Subscription stats will load when visible...
        </div>
      ) : !SubscriptionStatsComponent ? (
        <SubscriptionStatsSkeleton />
      ) : (
        <SubscriptionStatsComponent onClick={onClick} />
      )}
    </div>
  );
};