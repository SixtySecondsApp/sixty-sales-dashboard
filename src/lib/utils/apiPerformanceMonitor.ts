/**
 * API Performance Monitoring Utility
 * 
 * Based on Phase 3 audit findings - tracks performance improvements:
 * - Current baseline: 240ms average, 850ms 95th percentile, 2.3% error rate
 * - Target: Improve response times by 30-50% through optimization
 * 
 * Monitors:
 * - Response times and percentiles
 * - Error rates and types  
 * - Cache hit rates
 * - Rate limiting effectiveness
 */

interface PerformanceMetric {
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  cacheHit: boolean;
  rateLimited: boolean;
  timestamp: number;
  userId?: string;
}

interface PerformanceStats {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
  rateLimitRate: number;
  totalRequests: number;
  timeRange: { start: number; end: number };
}

class APIPerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private readonly MAX_METRICS = 10000; // Keep last 10k metrics
  private readonly PERFORMANCE_TARGETS = {
    averageResponseTime: 168, // 30% improvement from 240ms
    p95ResponseTime: 595, // 30% improvement from 850ms  
    errorRate: 1.6, // 30% improvement from 2.3%
    cacheHitRate: 80, // Improve from 67%
  };

  track(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    this.metrics.push({
      ...metric,
      timestamp: Date.now()
    });

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Alert on performance issues
    this.checkPerformanceAlerts(metric);
  }

  private checkPerformanceAlerts(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    // Alert on slow responses (> 1 second)
    if (metric.duration > 1000 && metric.status === 200) {
    }

    // Alert on high error rates
    if (metric.status >= 400) {
    }
  }

  getStats(timeWindowMs: number = 60 * 60 * 1000): PerformanceStats {
    const now = Date.now();
    const windowStart = now - timeWindowMs;
    
    const recentMetrics = this.metrics.filter(m => m.timestamp >= windowStart);
    
    if (recentMetrics.length === 0) {
      return {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        cacheHitRate: 0,
        rateLimitRate: 0,
        totalRequests: 0,
        timeRange: { start: windowStart, end: now }
      };
    }

    // Calculate response time metrics
    const durations = recentMetrics.map(m => m.duration).sort((a, b) => a - b);
    const averageResponseTime = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);
    const p95ResponseTime = durations[p95Index] || 0;
    const p99ResponseTime = durations[p99Index] || 0;

    // Calculate error rate
    const errorCount = recentMetrics.filter(m => m.status >= 400).length;
    const errorRate = (errorCount / recentMetrics.length) * 100;

    // Calculate cache hit rate
    const cacheHitCount = recentMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = (cacheHitCount / recentMetrics.length) * 100;

    // Calculate rate limit rate
    const rateLimitedCount = recentMetrics.filter(m => m.rateLimited).length;
    const rateLimitRate = (rateLimitedCount / recentMetrics.length) * 100;

    return {
      averageResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      errorRate,
      cacheHitRate,
      rateLimitRate,
      totalRequests: recentMetrics.length,
      timeRange: { start: windowStart, end: now }
    };
  }

  getPerformanceComparison(): {
    current: PerformanceStats;
    targets: typeof this.PERFORMANCE_TARGETS;
    improvements: Record<string, { current: number; target: number; achieved: boolean }>;
  } {
    const current = this.getStats();
    
    const improvements = {
      averageResponseTime: {
        current: current.averageResponseTime,
        target: this.PERFORMANCE_TARGETS.averageResponseTime,
        achieved: current.averageResponseTime <= this.PERFORMANCE_TARGETS.averageResponseTime
      },
      p95ResponseTime: {
        current: current.p95ResponseTime,
        target: this.PERFORMANCE_TARGETS.p95ResponseTime,
        achieved: current.p95ResponseTime <= this.PERFORMANCE_TARGETS.p95ResponseTime
      },
      errorRate: {
        current: current.errorRate,
        target: this.PERFORMANCE_TARGETS.errorRate,
        achieved: current.errorRate <= this.PERFORMANCE_TARGETS.errorRate
      },
      cacheHitRate: {
        current: current.cacheHitRate,
        target: this.PERFORMANCE_TARGETS.cacheHitRate,
        achieved: current.cacheHitRate >= this.PERFORMANCE_TARGETS.cacheHitRate
      }
    };

    return {
      current,
      targets: this.PERFORMANCE_TARGETS,
      improvements
    };
  }

  getEndpointStats(endpoint: string, timeWindowMs: number = 60 * 60 * 1000): PerformanceStats {
    const now = Date.now();
    const windowStart = now - timeWindowMs;
    
    const endpointMetrics = this.metrics.filter(m => 
      m.endpoint === endpoint && m.timestamp >= windowStart
    );
    
    return this.calculateStatsForMetrics(endpointMetrics, windowStart, now);
  }

  private calculateStatsForMetrics(metrics: PerformanceMetric[], start: number, end: number): PerformanceStats {
    if (metrics.length === 0) {
      return {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        cacheHitRate: 0,
        rateLimitRate: 0,
        totalRequests: 0,
        timeRange: { start, end }
      };
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const averageResponseTime = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);
    
    return {
      averageResponseTime,
      p95ResponseTime: durations[p95Index] || 0,
      p99ResponseTime: durations[p99Index] || 0,
      errorRate: (metrics.filter(m => m.status >= 400).length / metrics.length) * 100,
      cacheHitRate: (metrics.filter(m => m.cacheHit).length / metrics.length) * 100,
      rateLimitRate: (metrics.filter(m => m.rateLimited).length / metrics.length) * 100,
      totalRequests: metrics.length,
      timeRange: { start, end }
    };
  }

  clearMetrics(): void {
    this.metrics = [];
  }

  exportMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }
}

const performanceMonitor = new APIPerformanceMonitor();

/**
 * Track API call performance
 */
export function trackApiCall(
  endpoint: string,
  method: string,
  duration: number,
  status: number,
  options: {
    cacheHit?: boolean;
    rateLimited?: boolean;
    userId?: string;
  } = {}
): void {
  performanceMonitor.track({
    endpoint,
    method,
    duration,
    status,
    cacheHit: options.cacheHit || false,
    rateLimited: options.rateLimited || false,
    userId: options.userId
  });
}

/**
 * Middleware to automatically track fetch requests
 */
export function createPerformanceTrackingFetch(originalFetch: typeof fetch) {
  return async function trackedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const startTime = Date.now();
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method || 'GET';
    
    try {
      const response = await originalFetch(input, init);
      const duration = Date.now() - startTime;
      
      // Extract cache info from headers
      const cacheHit = response.headers.get('X-Cache') === 'HIT';
      const rateLimited = response.status === 429;
      
      trackApiCall(url, method, duration, response.status, {
        cacheHit,
        rateLimited
      });
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      trackApiCall(url, method, duration, 0, { rateLimited: false });
      throw error;
    }
  };
}

/**
 * Get current performance statistics
 */
export function getPerformanceStats(timeWindowMs?: number): PerformanceStats {
  return performanceMonitor.getStats(timeWindowMs);
}

/**
 * Get performance comparison against targets
 */
export function getPerformanceComparison() {
  return performanceMonitor.getPerformanceComparison();
}

/**
 * Get performance stats for specific endpoint
 */
export function getEndpointPerformance(endpoint: string, timeWindowMs?: number): PerformanceStats {
  return performanceMonitor.getEndpointStats(endpoint, timeWindowMs);
}

/**
 * Clear performance metrics
 */
export function clearPerformanceMetrics(): void {
  performanceMonitor.clearMetrics();
}

/**
 * Export all metrics for analysis
 */
export function exportPerformanceMetrics(): PerformanceMetric[] {
  return performanceMonitor.exportMetrics();
}

export default {
  trackApiCall,
  createPerformanceTrackingFetch,
  getPerformanceStats,
  getPerformanceComparison,
  getEndpointPerformance,
  clearPerformanceMetrics,
  exportPerformanceMetrics
};