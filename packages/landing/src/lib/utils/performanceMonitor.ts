/**
 * Performance Monitoring and Core Web Vitals Tracking
 * 
 * Implements:
 * - Core Web Vitals (LCP, FID, CLS)
 * - Component render performance
 * - Bundle size monitoring
 * - Memory usage tracking
 * - API response times
 */

import React from 'react';
import logger from '@/lib/utils/logger';

// Core Web Vitals types
interface WebVital {
  name: 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

interface PerformanceMetrics {
  // Core Web Vitals
  lcp?: number;  // Largest Contentful Paint
  fid?: number;  // First Input Delay  
  cls?: number;  // Cumulative Layout Shift
  fcp?: number;  // First Contentful Paint
  ttfb?: number; // Time to First Byte
  
  // Custom metrics
  bundleSize?: number;
  memoryUsage?: number;
  renderTime?: number;
  componentCount?: number;
  
  // Timestamps
  timestamp: number;
  url: string;
  userAgent: string;
}

interface ComponentPerformanceData {
  componentName: string;
  renderTime: number;
  propsCount: number;
  reRenderCount: number;
  timestamp: number;
}

interface APIPerformanceData {
  endpoint: string;
  method: string;
  responseTime: number;
  status: number;
  size?: number;
  timestamp: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private componentMetrics: ComponentPerformanceData[] = [];
  private apiMetrics: APIPerformanceData[] = [];
  private observers: PerformanceObserver[] = [];
  private isEnabled: boolean = true;
  private memoryInterval: NodeJS.Timeout | null = null;
  
  // Performance budgets (in milliseconds)
  private readonly PERFORMANCE_BUDGETS = {
    LCP: 2500,     // Largest Contentful Paint
    FID: 100,      // First Input Delay
    CLS: 0.1,      // Cumulative Layout Shift
    FCP: 1800,     // First Contentful Paint
    TTFB: 800,     // Time to First Byte
    RENDER: 16,    // Component render time (60fps)
    API: 1000,     // API response time
  };

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeWebVitals();
      this.initializeNavigationObserver();
      this.initializeMemoryMonitoring();
      this.startBundleSizeTracking();
    }
  }

  // Initialize Core Web Vitals tracking
  private initializeWebVitals(): void {
    this.trackWebVital('LCP', this.PERFORMANCE_BUDGETS.LCP);
    this.trackWebVital('FID', this.PERFORMANCE_BUDGETS.FID);
    this.trackWebVital('CLS', this.PERFORMANCE_BUDGETS.CLS);
    this.trackWebVital('FCP', this.PERFORMANCE_BUDGETS.FCP);
    this.trackWebVital('TTFB', this.PERFORMANCE_BUDGETS.TTFB);
  }

  // Track individual Web Vital
  private trackWebVital(metricName: string, budget: number): void {
    if ('web-vitals' in window) {
      // If web-vitals library is available, use it
      this.loadWebVitalsLibrary().then(() => {
        const webVitals = (window as any).webVitals;
        const trackFunction = webVitals[`get${metricName}`];
        if (trackFunction) {
          trackFunction((metric: WebVital) => {
            this.recordWebVital(metric, budget);
          });
        }
      });
    } else {
      // Fallback to native Performance API
      this.trackWebVitalNative(metricName, budget);
    }
  }

  // Load web-vitals library dynamically
  private async loadWebVitalsLibrary(): Promise<void> {
    if (!('webVitals' in window)) {
      try {
        const webVitals = await import('web-vitals');
        (window as any).webVitals = webVitals;
      } catch (error) {
        logger.warn('Failed to load web-vitals library:', error);
      }
    }
  }

  // Native Web Vital tracking fallback
  private trackWebVitalNative(metricName: string, budget: number): void {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'largest-contentful-paint' && metricName === 'LCP') {
            this.recordMetric('lcp', entry.startTime, budget);
          } else if (entry.entryType === 'first-input' && metricName === 'FID') {
            const fidEntry = entry as PerformanceEventTiming;
            this.recordMetric('fid', fidEntry.processingStart - fidEntry.startTime, budget);
          } else if (entry.entryType === 'layout-shift' && metricName === 'CLS') {
            const clsEntry = entry as any;
            if (!clsEntry.hadRecentInput) {
              this.recordMetric('cls', clsEntry.value, budget);
            }
          }
        });
      });

      // Observe different entry types based on metric
      switch (metricName) {
        case 'LCP':
          observer.observe({ entryTypes: ['largest-contentful-paint'] });
          break;
        case 'FID':
          observer.observe({ entryTypes: ['first-input'] });
          break;
        case 'CLS':
          observer.observe({ entryTypes: ['layout-shift'] });
          break;
      }

      this.observers.push(observer);
    } catch (error) {
      logger.warn(`Failed to observe ${metricName}:`, error);
    }
  }

  // Record Web Vital metric
  private recordWebVital(metric: WebVital, budget: number): void {
    const isWithinBudget = metric.value <= budget;
    
    logger.log(`📊 ${metric.name}: ${metric.value}ms (Budget: ${budget}ms) - ${
      isWithinBudget ? '✅ GOOD' : '⚠️ NEEDS IMPROVEMENT'
    }`);

    // Store metric
    const currentMetrics = this.getCurrentMetrics();
    currentMetrics[metric.name.toLowerCase() as keyof PerformanceMetrics] = metric.value;
    
    // Send to analytics if configured
    this.sendToAnalytics('web-vital', {
      metric: metric.name,
      value: metric.value,
      rating: metric.rating,
      budget,
      withinBudget: isWithinBudget,
    });
  }

  // Record generic metric
  private recordMetric(metricName: keyof PerformanceMetrics, value: number, budget: number): void {
    const isWithinBudget = value <= budget;
    
    logger.log(`📊 ${metricName.toUpperCase()}: ${value}ms (Budget: ${budget}ms) - ${
      isWithinBudget ? '✅ GOOD' : '⚠️ NEEDS IMPROVEMENT'
    }`);

    const currentMetrics = this.getCurrentMetrics();
    currentMetrics[metricName] = value;
  }

  // Initialize navigation observer for page performance
  private initializeNavigationObserver(): void {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming;
            this.recordNavigationMetrics(navEntry);
          }
        });
      });

      observer.observe({ entryTypes: ['navigation'] });
      this.observers.push(observer);
    } catch (error) {
      logger.warn('Failed to observe navigation:', error);
    }
  }

  // Record navigation timing metrics
  private recordNavigationMetrics(entry: PerformanceNavigationTiming): void {
    const ttfb = entry.responseStart - entry.requestStart;
    const domContentLoaded = entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart;
    const loadComplete = entry.loadEventEnd - entry.loadEventStart;

    logger.log('📊 Navigation Metrics:', {
      TTFB: `${ttfb.toFixed(2)}ms`,
      'DOM Content Loaded': `${domContentLoaded.toFixed(2)}ms`,
      'Load Complete': `${loadComplete.toFixed(2)}ms`,
    });

    const currentMetrics = this.getCurrentMetrics();
    currentMetrics.ttfb = ttfb;
  }

  // Initialize memory monitoring
  private initializeMemoryMonitoring(): void {
    if ('memory' in performance) {
      // Clear any existing interval
      if (this.memoryInterval) {
        clearInterval(this.memoryInterval);
      }
      
      this.memoryInterval = setInterval(() => {
        if (!this.isEnabled) return;
        
        const memory = (performance as any).memory;
        if (memory) {
          const usedJSHeapSize = memory.usedJSHeapSize;
          const totalJSHeapSize = memory.totalJSHeapSize;
          const usagePercentage = (usedJSHeapSize / totalJSHeapSize) * 100;

          if (usagePercentage > 80) {
            logger.warn(`⚠️ High memory usage: ${usagePercentage.toFixed(1)}%`);
          }

          const currentMetrics = this.getCurrentMetrics();
          currentMetrics.memoryUsage = usedJSHeapSize / 1024 / 1024; // Convert to MB
        }
      }, 30000); // Check every 30 seconds instead of 10
    }
  }

  // Track bundle size
  private startBundleSizeTracking(): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          let totalSize = 0;
          
          entries.forEach((entry) => {
            if (entry.name.includes('.js') || entry.name.includes('.css')) {
              const resourceEntry = entry as PerformanceResourceTiming;
              totalSize += resourceEntry.transferSize || 0;
            }
          });

          if (totalSize > 0) {
            const currentMetrics = this.getCurrentMetrics();
            currentMetrics.bundleSize = totalSize / 1024; // Convert to KB
            
            if (totalSize > 500 * 1024) { // 500KB warning
              logger.warn(`⚠️ Large bundle size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
            }
          }
        });

        observer.observe({ entryTypes: ['resource'] });
        this.observers.push(observer);
      } catch (error) {
        logger.warn('Failed to observe resources:', error);
      }
    }
  }

  // Component performance tracking
  public trackComponentRender(componentName: string, renderTime: number, propsCount: number = 0): void {
    if (!this.isEnabled) return;

    const componentData: ComponentPerformanceData = {
      componentName,
      renderTime,
      propsCount,
      reRenderCount: this.getComponentReRenderCount(componentName),
      timestamp: Date.now(),
    };

    this.componentMetrics.push(componentData);

    // Warn about slow renders
    if (renderTime > this.PERFORMANCE_BUDGETS.RENDER) {
      logger.warn(`⚠️ Slow render: ${componentName} took ${renderTime.toFixed(2)}ms`);
    }

    // Limit stored metrics to prevent memory leaks - reduced from 1000 to 100
    if (this.componentMetrics.length > 100) {
      this.componentMetrics = this.componentMetrics.slice(-50);
    }
  }

  // Track API performance
  public trackAPICall(endpoint: string, method: string, responseTime: number, status: number, size?: number): void {
    if (!this.isEnabled) return;

    const apiData: APIPerformanceData = {
      endpoint,
      method,
      responseTime,
      status,
      size,
      timestamp: Date.now(),
    };

    this.apiMetrics.push(apiData);

    // Warn about slow API calls
    if (responseTime > this.PERFORMANCE_BUDGETS.API) {
      logger.warn(`⚠️ Slow API call: ${method} ${endpoint} took ${responseTime}ms`);
    }

    // Limit stored metrics - reduced from 1000 to 100
    if (this.apiMetrics.length > 100) {
      this.apiMetrics = this.apiMetrics.slice(-50);
    }
  }

  // Get component re-render count
  private getComponentReRenderCount(componentName: string): number {
    return this.componentMetrics.filter(m => m.componentName === componentName).length;
  }

  // Get current metrics object
  private getCurrentMetrics(): PerformanceMetrics {
    const latest = this.metrics[this.metrics.length - 1];
    if (latest && Date.now() - latest.timestamp < 5000) {
      return latest;
    }

    const newMetrics: PerformanceMetrics = {
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    this.metrics.push(newMetrics);
    
    // Limit stored metrics - reduced from 100 to 20
    if (this.metrics.length > 20) {
      this.metrics = this.metrics.slice(-10);
    }

    return newMetrics;
  }

  // Send data to analytics service
  private sendToAnalytics(eventType: string, data: any): void {
    // Implementation depends on analytics provider (Google Analytics, PostHog, etc.)
    if (process.env.NODE_ENV === 'development') {
      logger.log(`📈 Analytics: ${eventType}`, data);
    }
    
    // Example: Google Analytics 4
    if ('gtag' in window) {
      (window as any).gtag('event', eventType, {
        event_category: 'Performance',
        ...data,
      });
    }
  }

  // Get performance summary
  public getPerformanceSummary(): {
    webVitals: Partial<PerformanceMetrics>;
    slowComponents: ComponentPerformanceData[];
    slowAPIs: APIPerformanceData[];
    memoryUsage: number;
    bundleSize: number;
  } {
    const latest = this.metrics[this.metrics.length - 1] || {};
    
    return {
      webVitals: {
        lcp: latest.lcp,
        fid: latest.fid,
        cls: latest.cls,
        fcp: latest.fcp,
        ttfb: latest.ttfb,
      },
      slowComponents: this.componentMetrics
        .filter(m => m.renderTime > this.PERFORMANCE_BUDGETS.RENDER)
        .slice(-10),
      slowAPIs: this.apiMetrics
        .filter(m => m.responseTime > this.PERFORMANCE_BUDGETS.API)
        .slice(-10),
      memoryUsage: latest.memoryUsage || 0,
      bundleSize: latest.bundleSize || 0,
    };
  }

  // Enable/disable monitoring
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  // Cleanup observers
  public cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    
    // Clear memory monitoring interval
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = null;
    }
    
    // Clear stored metrics to free memory
    this.metrics = [];
    this.componentMetrics = [];
    this.apiMetrics = [];
  }
}

// React Hook for component performance tracking
export function usePerformanceTracker(componentName: string) {
  const monitor = PerformanceMonitor.getInstance();
  
  return {
    trackRender: (renderTime: number, propsCount?: number) => {
      monitor.trackComponentRender(componentName, renderTime, propsCount);
    },
    trackAPI: (endpoint: string, method: string, responseTime: number, status: number, size?: number) => {
      monitor.trackAPICall(endpoint, method, responseTime, status, size);
    },
  };
}

// React Hook for measuring component render time
export function useRenderTime(componentName: string) {
  const monitor = PerformanceMonitor.getInstance();
  
  React.useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      monitor.trackComponentRender(componentName, renderTime);
    };
  });
}

// Higher-order component for automatic performance tracking
export function withPerformanceTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
) {
  const displayName = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  const TrackedComponent = React.memo((props: P) => {
    const startTime = React.useRef(performance.now());
    const monitor = PerformanceMonitor.getInstance();
    
    React.useEffect(() => {
      const endTime = performance.now();
      const renderTime = endTime - startTime.current;
      monitor.trackComponentRender(displayName, renderTime, Object.keys(props).length);
      startTime.current = performance.now();
    });
    
    return React.createElement(WrappedComponent, props);
  });
  
  TrackedComponent.displayName = `withPerformanceTracking(${displayName})`;
  return TrackedComponent;
}

export default PerformanceMonitor;