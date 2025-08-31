// Lazy loading wrapper for Subscription Stats to improve homepage performance

import React, { useState, useEffect, useRef } from 'react';
import { Building2, Users, TrendingUp, DollarSign } from 'lucide-react';

interface LazySubscriptionStatsProps {
  className?: string;
  onClick?: (cardTitle: string) => void;
}

// Skeleton component for loading state
const SubscriptionStatsSkeleton = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-800 rounded-lg" />
            <div className="flex-1">
              <div className="h-4 w-20 bg-gray-800 rounded-lg mb-2" />
              <div className="h-6 w-16 bg-gray-800 rounded-lg mb-1" />
              <div className="h-3 w-12 bg-gray-800 rounded-lg" />
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
        console.error('Failed to load SubscriptionStats:', error);
      }
    };

    loadComponent();
  }, [shouldLoad]);

  return (
    <div ref={containerRef} className={className}>
      {!shouldLoad ? (
        <div className="text-center py-4 text-gray-500">
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