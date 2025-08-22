// Memory Management & Error Boundaries for Backend Optimization
// Handles memory leaks, cleanup, and error recovery

import React from 'react';
import logger from '@/lib/utils/logger';

interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  timestamp: number;
}

interface ComponentMemoryTracker {
  componentId: string;
  mountTime: number;
  unmountTime?: number;
  memoryAtMount: MemoryUsage;
  memoryAtUnmount?: MemoryUsage;
  intervalIds: number[];
  timeoutIds: number[];
  eventListeners: Array<{ target: EventTarget; event: string; handler: Function }>;
  subscriptions: Array<{ unsubscribe: Function }>;
}

class MemoryManager {
  private static instance: MemoryManager;
  private components = new Map<string, ComponentMemoryTracker>();
  private memoryHistory: MemoryUsage[] = [];
  private readonly maxHistorySize = 100;
  private memoryWarningThreshold = 100 * 1024 * 1024; // 100MB
  private memoryCriticalThreshold = 200 * 1024 * 1024; // 200MB
  private monitoringInterval?: number;

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  private getCurrentMemoryUsage(): MemoryUsage {
    // In browser environment, use performance.memory if available
    if (typeof performance !== 'undefined' && performance.memory) {
      return {
        heapUsed: performance.memory.usedJSHeapSize,
        heapTotal: performance.memory.totalJSHeapSize,
        external: 0,
        rss: 0,
        timestamp: Date.now()
      };
    }

    // Fallback for environments without performance.memory
    return {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      rss: 0,
      timestamp: Date.now()
    };
  }

  private trackMemoryUsage(): void {
    const usage = this.getCurrentMemoryUsage();
    this.memoryHistory.push(usage);

    // Keep only recent history
    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory = this.memoryHistory.slice(-this.maxHistorySize);
    }

    // Check for memory warnings
    if (usage.heapUsed > this.memoryCriticalThreshold) {
      logger.error('🚨 CRITICAL: Memory usage is extremely high:', this.formatMemorySize(usage.heapUsed));
      this.emergencyCleanup();
    } else if (usage.heapUsed > this.memoryWarningThreshold) {
      logger.warn('⚠️ WARNING: High memory usage detected:', this.formatMemorySize(usage.heapUsed));
      this.performCleanup();
    }
  }

  private formatMemorySize(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  }

  private emergencyCleanup(): void {
    logger.log('🧹 Performing emergency memory cleanup...');
    
    // Force cleanup of unmounted components
    for (const [componentId, tracker] of this.components.entries()) {
      if (tracker.unmountTime && Date.now() - tracker.unmountTime > 30000) { // 30 seconds
        this.forceCleanupComponent(componentId);
      }
    }

    // Clear old memory history
    this.memoryHistory = this.memoryHistory.slice(-50);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  private performCleanup(): void {
    logger.log('🧹 Performing routine memory cleanup...');
    
    // Cleanup old unmounted components
    for (const [componentId, tracker] of this.components.entries()) {
      if (tracker.unmountTime && Date.now() - tracker.unmountTime > 60000) { // 1 minute
        this.forceCleanupComponent(componentId);
      }
    }
  }

  private forceCleanupComponent(componentId: string): void {
    const tracker = this.components.get(componentId);
    if (!tracker) return;

    logger.log(`🗑️ Force cleaning up component: ${componentId}`);

    // Clear all intervals
    tracker.intervalIds.forEach(id => clearInterval(id));
    
    // Clear all timeouts
    tracker.timeoutIds.forEach(id => clearTimeout(id));

    // Remove event listeners
    tracker.eventListeners.forEach(({ target, event, handler }) => {
      try {
        target.removeEventListener(event, handler as EventListener);
      } catch (error) {
        logger.warn('Failed to remove event listener:', error);
      }
    });

    // Unsubscribe from subscriptions
    tracker.subscriptions.forEach(({ unsubscribe }) => {
      try {
        unsubscribe();
      } catch (error) {
        logger.warn('Failed to unsubscribe:', error);
      }
    });

    this.components.delete(componentId);
  }

  // Public API for components
  registerComponent(componentId: string): ComponentMemoryTracker {
    const tracker: ComponentMemoryTracker = {
      componentId,
      mountTime: Date.now(),
      memoryAtMount: this.getCurrentMemoryUsage(),
      intervalIds: [],
      timeoutIds: [],
      eventListeners: [],
      subscriptions: []
    };

    this.components.set(componentId, tracker);
    logger.log(`📝 Registered component: ${componentId}`);
    
    return tracker;
  }

  unregisterComponent(componentId: string): void {
    const tracker = this.components.get(componentId);
    if (!tracker) return;

    tracker.unmountTime = Date.now();
    tracker.memoryAtUnmount = this.getCurrentMemoryUsage();

    // Calculate memory impact
    const memoryDiff = tracker.memoryAtUnmount.heapUsed - tracker.memoryAtMount.heapUsed;
    const lifespanMs = tracker.unmountTime - tracker.mountTime;

    logger.log(`📊 Component ${componentId} unregistered:`, {
      lifespan: `${lifespanMs}ms`,
      memoryImpact: this.formatMemorySize(memoryDiff),
      intervalsCleared: tracker.intervalIds.length,
      timeoutsCleared: tracker.timeoutIds.length,
      listenersRemoved: tracker.eventListeners.length,
      subscriptionsRemoved: tracker.subscriptions.length
    });

    // Clean up immediately
    this.forceCleanupComponent(componentId);
  }

  // Track intervals created by components
  trackInterval(componentId: string, intervalId: number): void {
    const tracker = this.components.get(componentId);
    if (tracker) {
      tracker.intervalIds.push(intervalId);
    }
  }

  // Track timeouts created by components
  trackTimeout(componentId: string, timeoutId: number): void {
    const tracker = this.components.get(componentId);
    if (tracker) {
      tracker.timeoutIds.push(timeoutId);
    }
  }

  // Track event listeners created by components
  trackEventListener(
    componentId: string, 
    target: EventTarget, 
    event: string, 
    handler: Function
  ): void {
    const tracker = this.components.get(componentId);
    if (tracker) {
      tracker.eventListeners.push({ target, event, handler });
    }
  }

  // Track subscriptions created by components
  trackSubscription(componentId: string, unsubscribe: Function): void {
    const tracker = this.components.get(componentId);
    if (tracker) {
      tracker.subscriptions.push({ unsubscribe });
    }
  }

  // Start memory monitoring
  startMonitoring(intervalMs = 30000): void { // 30 seconds default
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = window.setInterval(() => {
      this.trackMemoryUsage();
    }, intervalMs);

    logger.log(`🔍 Started memory monitoring (interval: ${intervalMs}ms)`);
  }

  // Stop memory monitoring
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      logger.log('🛑 Stopped memory monitoring');
    }
  }

  // Get memory statistics
  getMemoryStats(): {
    current: MemoryUsage;
    peak: MemoryUsage;
    average: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    componentsTracked: number;
  } {
    const current = this.getCurrentMemoryUsage();
    const peak = this.memoryHistory.reduce((max, usage) => 
      usage.heapUsed > max.heapUsed ? usage : max, current);
    
    const avgHeapUsed = this.memoryHistory.length > 0 
      ? this.memoryHistory.reduce((sum, usage) => sum + usage.heapUsed, 0) / this.memoryHistory.length
      : current.heapUsed;

    // Determine trend from last 10 measurements
    const recentHistory = this.memoryHistory.slice(-10);
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    
    if (recentHistory.length >= 3) {
      const first = recentHistory[0].heapUsed;
      const last = recentHistory[recentHistory.length - 1].heapUsed;
      const diff = last - first;
      const threshold = first * 0.1; // 10% threshold
      
      if (Math.abs(diff) > threshold) {
        trend = diff > 0 ? 'increasing' : 'decreasing';
      }
    }

    return {
      current,
      peak,
      average: avgHeapUsed,
      trend,
      componentsTracked: this.components.size
    };
  }

  // Clean up all tracked resources
  cleanup(): void {
    logger.log('🧹 Performing complete memory manager cleanup...');
    
    // Stop monitoring
    this.stopMonitoring();
    
    // Clean up all components
    const componentIds = Array.from(this.components.keys());
    componentIds.forEach(id => this.forceCleanupComponent(id));
    
    // Clear memory history
    this.memoryHistory = [];
    
    logger.log('✅ Memory manager cleanup complete');
  }
}

// Hook for React components to use memory management
export function useMemoryManagement(componentName: string) {
  const memoryManager = MemoryManager.getInstance();
  const componentId = `${componentName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Register component on mount
  React.useEffect(() => {
    const tracker = memoryManager.registerComponent(componentId);

    // Return cleanup function
    return () => {
      memoryManager.unregisterComponent(componentId);
    };
  }, [componentId]);

  // Helper functions for tracking resources
  const trackInterval = (intervalId: number) => {
    memoryManager.trackInterval(componentId, intervalId);
  };

  const trackTimeout = (timeoutId: number) => {
    memoryManager.trackTimeout(componentId, timeoutId);
  };

  const trackEventListener = (target: EventTarget, event: string, handler: Function) => {
    memoryManager.trackEventListener(componentId, target, event, handler);
  };

  const trackSubscription = (unsubscribe: Function) => {
    memoryManager.trackSubscription(componentId, unsubscribe);
  };

  return {
    trackInterval,
    trackTimeout,
    trackEventListener,
    trackSubscription
  };
}

// Error Boundary Component - moved to separate .tsx file due to JSX limitations in .ts files
// This is a utility interface that can be imported by React components

// Global memory manager instance
const globalMemoryManager = MemoryManager.getInstance();

// Start monitoring on initialization
if (typeof window !== 'undefined') {
  globalMemoryManager.startMonitoring();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    globalMemoryManager.cleanup();
  });
}

export default globalMemoryManager;
export { MemoryManager };