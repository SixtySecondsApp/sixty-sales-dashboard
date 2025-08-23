import logger from '@/lib/utils/logger';

// Performance thresholds for monitoring
export const PERFORMANCE_THRESHOLDS = {
  firstContentfulPaint: 800,    // Alert if > 800ms
  timeToInteractive: 2000,       // Alert if > 2s  
  apiResponseTime: 500,          // Alert if > 500ms
  errorRate: 0.01,               // Alert if > 1%
  memoryUsage: 100,              // Alert if > 100MB
  bundleSize: 2000,              // Alert if > 2MB
};

// Severity levels for alerts
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

interface PerformanceMetrics {
  fcp?: number;
  tti?: number;
  lcp?: number;
  cls?: number;
  fid?: number;
  apiCalls: number;
  apiResponseTime: number;
  errors: number;
  memoryUsage?: number;
  timestamp: number;
  userId?: string;
  sessionId: string;
}

interface PerformanceAlert {
  metric: string;
  value: number;
  threshold: number;
  severity: AlertSeverity;
  message: string;
  timestamp: number;
}

// Store for metrics collection
class MetricsStore {
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private errorCount = 0;
  private apiCallCount = 0;
  private apiResponseTimes: number[] = [];

  addMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);
    this.checkThresholds(metric);
    
    // Keep only last 100 metrics in memory
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  addError() {
    this.errorCount++;
  }

  addApiCall(responseTime: number) {
    this.apiCallCount++;
    this.apiResponseTimes.push(responseTime);
    
    // Keep only last 100 response times
    if (this.apiResponseTimes.length > 100) {
      this.apiResponseTimes = this.apiResponseTimes.slice(-100);
    }
  }

  getErrorRate(): number {
    const totalRequests = this.apiCallCount || 1;
    return this.errorCount / totalRequests;
  }

  getAverageApiResponseTime(): number {
    if (this.apiResponseTimes.length === 0) return 0;
    const sum = this.apiResponseTimes.reduce((a, b) => a + b, 0);
    return sum / this.apiResponseTimes.length;
  }

  private checkThresholds(metric: PerformanceMetrics) {
    const checks = [
      {
        name: 'First Contentful Paint',
        value: metric.fcp,
        threshold: PERFORMANCE_THRESHOLDS.firstContentfulPaint,
        severity: AlertSeverity.WARNING,
      },
      {
        name: 'Time to Interactive',
        value: metric.tti,
        threshold: PERFORMANCE_THRESHOLDS.timeToInteractive,
        severity: AlertSeverity.ERROR,
      },
      {
        name: 'API Response Time',
        value: metric.apiResponseTime,
        threshold: PERFORMANCE_THRESHOLDS.apiResponseTime,
        severity: AlertSeverity.WARNING,
      },
      {
        name: 'Error Rate',
        value: this.getErrorRate(),
        threshold: PERFORMANCE_THRESHOLDS.errorRate,
        severity: AlertSeverity.CRITICAL,
      },
      {
        name: 'Memory Usage',
        value: metric.memoryUsage,
        threshold: PERFORMANCE_THRESHOLDS.memoryUsage,
        severity: AlertSeverity.WARNING,
      },
    ];

    for (const check of checks) {
      if (check.value && check.value > check.threshold) {
        const alert: PerformanceAlert = {
          metric: check.name,
          value: check.value,
          threshold: check.threshold,
          severity: check.severity,
          message: `${check.name} exceeded threshold: ${check.value} > ${check.threshold}`,
          timestamp: Date.now(),
        };
        
        this.alerts.push(alert);
        this.sendAlert(alert);
      }
    }
  }

  private sendAlert(alert: PerformanceAlert) {
    // Log locally
    const logMethod = alert.severity === AlertSeverity.CRITICAL ? 'error' : 'warn';
    logger[logMethod](`Performance Alert: ${alert.message}`);
    
    // Send to monitoring service (implement based on your service)
    if (window.fetch && !import.meta.env.DEV) {
      fetch('/api/monitoring/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      }).catch(err => logger.error('Failed to send alert:', err));
    }
  }

  getMetrics() {
    return this.metrics;
  }

  getAlerts() {
    return this.alerts;
  }

  clearAlerts() {
    this.alerts = [];
  }
}

// Global metrics store instance
const metricsStore = new MetricsStore();

// Monitor dashboard performance
export function monitorDashboardPerformance(userId?: string): PerformanceMetrics {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  const paintEntries = performance.getEntriesByType('paint');
  
  // Get Core Web Vitals
  const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime;
  const tti = navigation?.domInteractive - navigation?.fetchStart;
  
  // Get LCP if available
  let lcp: number | undefined;
  const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
  if (lcpEntries.length > 0) {
    lcp = lcpEntries[lcpEntries.length - 1].startTime;
  }
  
  // Get CLS if available
  let cls = 0;
  const clsEntries = performance.getEntriesByType('layout-shift');
  for (const entry of clsEntries) {
    if (!(entry as any).hadRecentInput) {
      cls += (entry as any).value;
    }
  }
  
  // Get memory usage if available
  let memoryUsage: number | undefined;
  if ('memory' in performance) {
    memoryUsage = (performance as any).memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
  }
  
  // Calculate API metrics
  const apiCalls = performance.getEntriesByType('resource')
    .filter(r => r.name.includes('/api') || r.name.includes('/functions'));
  
  const apiResponseTime = metricsStore.getAverageApiResponseTime();
  
  const metrics: PerformanceMetrics = {
    fcp,
    tti,
    lcp,
    cls,
    apiCalls: apiCalls.length,
    apiResponseTime,
    errors: metricsStore.getErrorRate() * 100, // Convert to percentage
    memoryUsage,
    timestamp: Date.now(),
    userId,
    sessionId: getSessionId(),
  };
  
  // Store metrics
  metricsStore.addMetric(metrics);
  
  // Log summary
  logger.log('Dashboard Performance Metrics:', {
    fcp: `${fcp?.toFixed(0)}ms`,
    tti: `${tti?.toFixed(0)}ms`,
    lcp: `${lcp?.toFixed(0)}ms`,
    cls: cls.toFixed(3),
    apiCalls: apiCalls.length,
    apiResponseTime: `${apiResponseTime.toFixed(0)}ms`,
    errorRate: `${(metricsStore.getErrorRate() * 100).toFixed(2)}%`,
    memory: memoryUsage ? `${memoryUsage.toFixed(2)}MB` : 'N/A',
  });
  
  return metrics;
}

// Track API call performance
export function trackApiCall(url: string, startTime: number, success: boolean) {
  const duration = Date.now() - startTime;
  
  if (success) {
    metricsStore.addApiCall(duration);
  } else {
    metricsStore.addError();
  }
  
  // Log slow API calls
  if (duration > PERFORMANCE_THRESHOLDS.apiResponseTime) {
    logger.warn(`Slow API call: ${url} took ${duration}ms`);
  }
}

// Track errors
export function trackError(error: Error, context?: string) {
  metricsStore.addError();
  logger.error(`Dashboard error${context ? ` in ${context}` : ''}:`, error);
}

// Get session ID for tracking
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('dashboard_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('dashboard_session_id', sessionId);
  }
  return sessionId;
}

// Export metrics for reporting
export function exportMetrics() {
  return {
    metrics: metricsStore.getMetrics(),
    alerts: metricsStore.getAlerts(),
    summary: {
      errorRate: metricsStore.getErrorRate(),
      avgApiResponseTime: metricsStore.getAverageApiResponseTime(),
      totalMetrics: metricsStore.getMetrics().length,
      totalAlerts: metricsStore.getAlerts().length,
    },
  };
}

// Clear alerts (after handling)
export function clearAlerts() {
  metricsStore.clearAlerts();
}

// Initialize monitoring
export function initializeDashboardMonitoring() {
  // Monitor page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      monitorDashboardPerformance();
    }
  });
  
  // Monitor errors
  window.addEventListener('error', (event) => {
    trackError(new Error(event.message), 'window.error');
  });
  
  // Monitor unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    trackError(new Error(event.reason), 'unhandledrejection');
  });
  
  // Initial monitoring
  if (document.readyState === 'complete') {
    setTimeout(() => monitorDashboardPerformance(), 100);
  } else {
    window.addEventListener('load', () => {
      setTimeout(() => monitorDashboardPerformance(), 100);
    });
  }
  
  // Periodic monitoring (every 30 seconds)
  setInterval(() => {
    if (!document.hidden) {
      monitorDashboardPerformance();
    }
  }, 30000);
}

// Check if automatic rollback is needed
export function checkRollbackConditions(): boolean {
  const errorRate = metricsStore.getErrorRate();
  const avgApiTime = metricsStore.getAverageApiResponseTime();
  const alerts = metricsStore.getAlerts();
  const criticalAlerts = alerts.filter(a => a.severity === AlertSeverity.CRITICAL);
  
  // Automatic rollback conditions
  if (errorRate > 0.05) {
    logger.error('ROLLBACK TRIGGER: Error rate > 5%');
    return true;
  }
  
  if (avgApiTime > 3000) {
    logger.error('ROLLBACK TRIGGER: API response time > 3s');
    return true;
  }
  
  if (criticalAlerts.length > 3) {
    logger.error('ROLLBACK TRIGGER: Multiple critical alerts');
    return true;
  }
  
  return false;
}