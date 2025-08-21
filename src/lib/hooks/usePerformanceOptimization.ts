/**
 * Performance Optimization Hook
 * 
 * This hook provides utilities for React performance optimization:
 * - Memory management
 * - Component optimization tracking
 * - Resource cleanup
 * - Performance metrics collection
 */

import { useEffect, useCallback, useRef, useMemo } from 'react';
import { loadCriticalResources, progressiveLoader, smartPreloader, BundleMonitor } from '@/lib/utils/bundleOptimizer';

interface PerformanceConfig {
  enableResourcePreloading?: boolean;
  enableSmartPreloading?: boolean;
  enableBundleMonitoring?: boolean;
  enableMemoryCleanup?: boolean;
  debugMode?: boolean;
}

interface PerformanceMetrics {
  componentRenders: number;
  memoryUsage: number;
  bundleSize: number;
  loadTime: number;
  interactionDelay: number;
}

export const usePerformanceOptimization = (config: PerformanceConfig = {}) => {
  const {
    enableResourcePreloading = true,
    enableSmartPreloading = true,
    enableBundleMonitoring = true,
    enableMemoryCleanup = true,
    debugMode = process.env.NODE_ENV === 'development'
  } = config;

  const renderCount = useRef(0);
  const bundleMonitor = useRef(BundleMonitor.getInstance());
  const performanceObserver = useRef<PerformanceObserver | null>(null);
  const cleanupFunctions = useRef<(() => void)[]>([]);

  // Track component renders
  useEffect(() => {
    renderCount.current++;
    if (debugMode && renderCount.current > 10) {
      console.warn('Component re-rendered more than 10 times, consider optimization');
    }
  });

  // Critical resource loading
  useEffect(() => {
    if (!enableResourcePreloading) return;

    const loadResources = async () => {
      try {
        await loadCriticalResources();
        
        // Execute immediate progressive loaders
        await progressiveLoader.executeImmediate();
        
        if (debugMode) {
          console.log('Critical resources loaded');
        }
      } catch (error) {
        console.warn('Failed to load critical resources:', error);
      }
    };

    loadResources();
  }, [enableResourcePreloading, debugMode]);

  // Smart preloading setup
  useEffect(() => {
    if (!enableSmartPreloading) return;

    // Set up navigation tracking
    const handleRouteChange = () => {
      const currentPath = window.location.pathname;
      smartPreloader.recordNavigation(currentPath);
      smartPreloader.preloadPredictedRoute();
    };

    // Track initial route
    handleRouteChange();

    // Listen for route changes (works with React Router)
    window.addEventListener('popstate', handleRouteChange);
    
    // Set up intersection-based preloading
    let interactionTimer: NodeJS.Timeout;
    
    const handleUserInteraction = () => {
      clearTimeout(interactionTimer);
      interactionTimer = setTimeout(() => {
        progressiveLoader.executeOnInteraction();
      }, 100);
    };

    // Listen for user interactions
    const events = ['mousedown', 'touchstart', 'keydown', 'scroll'];
    events.forEach(event => {
      document.addEventListener(event, handleUserInteraction, { passive: true });
    });

    // Cleanup
    const cleanup = () => {
      window.removeEventListener('popstate', handleRouteChange);
      events.forEach(event => {
        document.removeEventListener(event, handleUserInteraction);
      });
      clearTimeout(interactionTimer);
    };

    cleanupFunctions.current.push(cleanup);
    return cleanup;
  }, [enableSmartPreloading]);

  // Bundle monitoring
  useEffect(() => {
    if (!enableBundleMonitoring || typeof window === 'undefined') return;

    // Monitor script loading
    const scripts = document.querySelectorAll('script[src]');
    scripts.forEach(script => {
      const src = (script as HTMLScriptElement).src;
      if (src.includes('chunk') || src.includes('vendor')) {
        bundleMonitor.current.trackPendingChunk(src);
        
        script.addEventListener('load', () => {
          bundleMonitor.current.trackChunkLoad(src, 0); // Size not available here
        });
        
        script.addEventListener('error', () => {
          bundleMonitor.current.trackChunkError(src);
        });
      }
    });

    // Set up performance observer
    if ('PerformanceObserver' in window) {
      try {
        performanceObserver.current = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (entry.entryType === 'measure' && debugMode) {
              console.log(`Performance measure: ${entry.name} - ${entry.duration}ms`);
            }
          });
        });

        performanceObserver.current.observe({ entryTypes: ['measure', 'navigation'] });
      } catch (error) {
        console.warn('PerformanceObserver not supported or failed to initialize');
      }
    }

    return () => {
      if (performanceObserver.current) {
        performanceObserver.current.disconnect();
      }
    };
  }, [enableBundleMonitoring, debugMode]);

  // Memory cleanup on idle
  useEffect(() => {
    if (!enableMemoryCleanup) return;

    const cleanup = () => {
      // Execute idle loaders
      progressiveLoader.executeOnIdle();
      
      // Clear unused caches if possible
      if (typeof window !== 'undefined' && 'caches' in window) {
        caches.keys().then(cacheNames => {
          const oldCaches = cacheNames.filter(name => name.includes('old') || name.includes('temp'));
          oldCaches.forEach(cacheName => {
            caches.delete(cacheName);
          });
        }).catch(err => console.warn('Cache cleanup failed:', err));
      }
    };

    let idleId: number;
    
    if ('requestIdleCallback' in window) {
      idleId = requestIdleCallback(cleanup, { timeout: 5000 });
    } else {
      // Fallback for browsers without requestIdleCallback
      const timer = setTimeout(cleanup, 5000);
      idleId = timer as any;
    }

    return () => {
      if ('cancelIdleCallback' in window) {
        cancelIdleCallback(idleId);
      } else {
        clearTimeout(idleId);
      }
    };
  }, [enableMemoryCleanup]);

  // Global cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupFunctions.current.forEach(cleanup => cleanup());
    };
  }, []);

  // Memoized performance metrics
  const performanceMetrics = useMemo((): PerformanceMetrics => {
    const bundleMetrics = bundleMonitor.current.getMetrics();
    
    return {
      componentRenders: renderCount.current,
      memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
      bundleSize: bundleMetrics.totalSize,
      loadTime: bundleMetrics.loadTime,
      interactionDelay: 0 // Would need more sophisticated tracking
    };
  }, []);

  // Optimized callbacks
  const measurePerformance = useCallback((name: string, fn: () => void) => {
    if (!debugMode) {
      fn();
      return;
    }

    const start = performance.now();
    performance.mark(`${name}-start`);
    
    fn();
    
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const end = performance.now();
    if (end - start > 16) { // More than one frame
      console.warn(`Performance warning: ${name} took ${(end - start).toFixed(2)}ms`);
    }
  }, [debugMode]);

  const preloadModule = useCallback((moduleId: string, priority: 'high' | 'medium' | 'low' = 'medium') => {
    progressiveLoader.add('onIdle', () => import(moduleId));
  }, []);

  const addCleanup = useCallback((cleanup: () => void) => {
    cleanupFunctions.current.push(cleanup);
  }, []);

  return {
    performanceMetrics,
    measurePerformance,
    preloadModule,
    addCleanup,
    bundleMonitor: bundleMonitor.current,
    renderCount: renderCount.current
  };
};

// Hook for component-specific optimizations
export const useComponentOptimization = (componentName: string) => {
  const renderRef = useRef(0);
  const startTime = useRef(Date.now());
  
  useEffect(() => {
    renderRef.current++;
    
    // Log expensive re-renders
    if (renderRef.current > 5) {
      const timeSinceMount = Date.now() - startTime.current;
      if (timeSinceMount < 10000 && process.env.NODE_ENV === 'development') {
        console.warn(
          `${componentName} has re-rendered ${renderRef.current} times in ${timeSinceMount}ms. Consider optimization.`
        );
      }
    }
  });

  return {
    renderCount: renderRef.current,
    shouldOptimize: renderRef.current > 5
  };
};

// Hook for memory-intensive operations
export const useMemoryOptimization = () => {
  const memoryCache = useRef(new Map());
  
  const memoize = useCallback(<T extends any[], R>(
    fn: (...args: T) => R,
    keyFn?: (...args: T) => string
  ) => {
    return (...args: T): R => {
      const key = keyFn ? keyFn(...args) : JSON.stringify(args);
      
      if (memoryCache.current.has(key)) {
        return memoryCache.current.get(key);
      }
      
      const result = fn(...args);
      memoryCache.current.set(key, result);
      
      // Limit cache size
      if (memoryCache.current.size > 100) {
        const firstKey = memoryCache.current.keys().next().value;
        memoryCache.current.delete(firstKey);
      }
      
      return result;
    };
  }, []);

  const clearCache = useCallback(() => {
    memoryCache.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      clearCache();
    };
  }, [clearCache]);

  return { memoize, clearCache, cacheSize: memoryCache.current.size };
};

export default usePerformanceOptimization;