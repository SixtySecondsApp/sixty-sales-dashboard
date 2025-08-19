/**
 * Memory Management and Leak Prevention Utilities
 * 
 * Implements:
 * - Event listener cleanup
 * - Subscription cleanup
 * - Timer cleanup
 * - Cache management
 * - Component unmount cleanup
 * - Observer cleanup
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// Memory leak prevention utilities
export class MemoryManager {
  private static instance: MemoryManager;
  private subscriptions: Set<() => void> = new Set();
  private timers: Set<number> = new Set();
  private intervals: Set<number> = new Set();
  private observers: Set<MutationObserver | IntersectionObserver | ResizeObserver | PerformanceObserver> = new Set();
  private eventListeners: Map<EventTarget, Map<string, EventListener>> = new Map();
  private isCleaningUp = false;

  public static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  constructor() {
    // Setup cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.cleanup.bind(this));
      window.addEventListener('unload', this.cleanup.bind(this));
      
      // Cleanup on visibility change (mobile browsers)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.cleanup();
        }
      });
    }
  }

  // Register a subscription for cleanup
  public registerSubscription(cleanup: () => void): void {
    this.subscriptions.add(cleanup);
  }

  // Register a timer for cleanup
  public registerTimer(timerId: number): void {
    this.timers.add(timerId);
  }

  // Register an interval for cleanup
  public registerInterval(intervalId: number): void {
    this.intervals.add(intervalId);
  }

  // Register an observer for cleanup
  public registerObserver(observer: MutationObserver | IntersectionObserver | ResizeObserver | PerformanceObserver): void {
    this.observers.add(observer);
  }

  // Register an event listener for cleanup
  public registerEventListener(target: EventTarget, event: string, listener: EventListener): void {
    if (!this.eventListeners.has(target)) {
      this.eventListeners.set(target, new Map());
    }
    this.eventListeners.get(target)!.set(event, listener);
  }

  // Unregister subscription
  public unregisterSubscription(cleanup: () => void): void {
    this.subscriptions.delete(cleanup);
  }

  // Clean up a specific timer
  public clearTimer(timerId: number): void {
    clearTimeout(timerId);
    this.timers.delete(timerId);
  }

  // Clean up a specific interval
  public clearInterval(intervalId: number): void {
    clearInterval(intervalId);
    this.intervals.delete(intervalId);
  }

  // Clean up a specific observer
  public disconnectObserver(observer: MutationObserver | IntersectionObserver | ResizeObserver | PerformanceObserver): void {
    observer.disconnect();
    this.observers.delete(observer);
  }

  // Remove a specific event listener
  public removeEventListener(target: EventTarget, event: string): void {
    const listeners = this.eventListeners.get(target);
    if (listeners) {
      const listener = listeners.get(event);
      if (listener) {
        target.removeEventListener(event, listener);
        listeners.delete(event);
        if (listeners.size === 0) {
          this.eventListeners.delete(target);
        }
      }
    }
  }

  // Clean up all registered resources
  public cleanup(): void {
    if (this.isCleaningUp) return;
    this.isCleaningUp = true;

    console.log('🧹 Starting memory cleanup...');

    // Clean up subscriptions
    this.subscriptions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('Error during subscription cleanup:', error);
      }
    });
    this.subscriptions.clear();

    // Clean up timers
    this.timers.forEach(timerId => {
      clearTimeout(timerId);
    });
    this.timers.clear();

    // Clean up intervals
    this.intervals.forEach(intervalId => {
      clearInterval(intervalId);
    });
    this.intervals.clear();

    // Clean up observers
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        console.warn('Error disconnecting observer:', error);
      }
    });
    this.observers.clear();

    // Clean up event listeners
    this.eventListeners.forEach((listeners, target) => {
      listeners.forEach((listener, event) => {
        try {
          target.removeEventListener(event, listener);
        } catch (error) {
          console.warn('Error removing event listener:', error);
        }
      });
    });
    this.eventListeners.clear();

    console.log('✅ Memory cleanup completed');
    this.isCleaningUp = false;
  }

  // Get memory usage statistics
  public getMemoryStats(): {
    subscriptions: number;
    timers: number;
    intervals: number;
    observers: number;
    eventListeners: number;
    heapUsed?: number;
    heapTotal?: number;
  } {
    const stats = {
      subscriptions: this.subscriptions.size,
      timers: this.timers.size,
      intervals: this.intervals.size,
      observers: this.observers.size,
      eventListeners: Array.from(this.eventListeners.values()).reduce((total, listeners) => total + listeners.size, 0),
    };

    // Add heap information if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        ...stats,
        heapUsed: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
        heapTotal: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
      };
    }

    return stats;
  }
}

// React hook for automatic cleanup on unmount
export function useCleanup(cleanup: () => void): void {
  const manager = MemoryManager.getInstance();
  
  useEffect(() => {
    manager.registerSubscription(cleanup);
    
    return () => {
      manager.unregisterSubscription(cleanup);
      cleanup();
    };
  }, [cleanup, manager]);
}

// React hook for safe timers that auto-cleanup
export function useSafeTimeout(): {
  setTimeout: (callback: () => void, delay: number) => number;
  clearTimeout: (id: number) => void;
} {
  const manager = MemoryManager.getInstance();
  const timeouts = useRef<Set<number>>(new Set());

  const safeSetTimeout = useCallback((callback: () => void, delay: number): number => {
    const id = window.setTimeout(() => {
      callback();
      timeouts.current.delete(id);
      manager.clearTimer(id);
    }, delay);
    
    timeouts.current.add(id);
    manager.registerTimer(id);
    return id;
  }, [manager]);

  const safeClearTimeout = useCallback((id: number): void => {
    window.clearTimeout(id);
    timeouts.current.delete(id);
    manager.clearTimer(id);
  }, [manager]);

  useEffect(() => {
    return () => {
      // Cleanup all timeouts on unmount
      timeouts.current.forEach(id => {
        window.clearTimeout(id);
        manager.clearTimer(id);
      });
      timeouts.current.clear();
    };
  }, [manager]);

  return {
    setTimeout: safeSetTimeout,
    clearTimeout: safeClearTimeout,
  };
}

// React hook for safe intervals that auto-cleanup
export function useSafeInterval(): {
  setInterval: (callback: () => void, delay: number) => number;
  clearInterval: (id: number) => void;
} {
  const manager = MemoryManager.getInstance();
  const intervals = useRef<Set<number>>(new Set());

  const safeSetInterval = useCallback((callback: () => void, delay: number): number => {
    const id = window.setInterval(callback, delay);
    intervals.current.add(id);
    manager.registerInterval(id);
    return id;
  }, [manager]);

  const safeClearInterval = useCallback((id: number): void => {
    window.clearInterval(id);
    intervals.current.delete(id);
    manager.clearInterval(id);
  }, [manager]);

  useEffect(() => {
    return () => {
      // Cleanup all intervals on unmount
      intervals.current.forEach(id => {
        window.clearInterval(id);
        manager.clearInterval(id);
      });
      intervals.current.clear();
    };
  }, [manager]);

  return {
    setInterval: safeSetInterval,
    clearInterval: safeClearInterval,
  };
}

// React hook for safe event listeners that auto-cleanup
export function useSafeEventListener<T extends EventTarget>(
  target: T | null,
  event: string,
  listener: EventListener,
  options?: boolean | AddEventListenerOptions
): void {
  const manager = MemoryManager.getInstance();
  const savedListener = useRef<EventListener>();

  useEffect(() => {
    if (!target) return;

    // Update saved listener
    savedListener.current = listener;

    // Create wrapper to ensure consistent reference
    const wrappedListener = (e: Event) => savedListener.current?.(e);

    target.addEventListener(event, wrappedListener, options);
    manager.registerEventListener(target, event, wrappedListener);

    return () => {
      target.removeEventListener(event, wrappedListener, options);
      manager.removeEventListener(target, event);
    };
  }, [target, event, manager]);

  // Update listener reference when it changes
  useEffect(() => {
    savedListener.current = listener;
  }, [listener]);
}

// React hook for safe observers that auto-cleanup
export function useSafeObserver<T extends MutationObserver | IntersectionObserver | ResizeObserver>(
  createObserver: () => T,
  dependencies: any[] = []
): T | null {
  const manager = MemoryManager.getInstance();
  const observer = useRef<T | null>(null);

  useEffect(() => {
    observer.current = createObserver();
    manager.registerObserver(observer.current as any);

    return () => {
      if (observer.current) {
        observer.current.disconnect();
        manager.disconnectObserver(observer.current as any);
        observer.current = null;
      }
    };
  }, dependencies);

  return observer.current;
}

// Cache with automatic cleanup and size limits
export class SafeCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;
  private ttl: number;
  private timestamps = new Map<K, number>();
  private cleanupInterval: number;

  constructor(maxSize: number = 100, ttl: number = 5 * 60 * 1000) { // 5 minutes default
    this.maxSize = maxSize;
    this.ttl = ttl;
    
    // Setup periodic cleanup
    this.cleanupInterval = window.setInterval(() => {
      this.cleanup();
    }, Math.min(ttl / 2, 60000)); // Cleanup every minute or half TTL

    MemoryManager.getInstance().registerInterval(this.cleanupInterval);
  }

  set(key: K, value: V): void {
    // Remove expired entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, value);
    this.timestamps.set(key, Date.now());
  }

  get(key: K): V | undefined {
    const timestamp = this.timestamps.get(key);
    if (!timestamp || Date.now() - timestamp > this.ttl) {
      this.delete(key);
      return undefined;
    }

    return this.cache.get(key);
  }

  has(key: K): boolean {
    const timestamp = this.timestamps.get(key);
    if (!timestamp || Date.now() - timestamp > this.ttl) {
      this.delete(key);
      return false;
    }

    return this.cache.has(key);
  }

  delete(key: K): void {
    this.cache.delete(key);
    this.timestamps.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.timestamps.clear();
  }

  private evictOldest(): void {
    const oldestEntry = Array.from(this.timestamps.entries())
      .sort(([, a], [, b]) => a - b)[0];
    
    if (oldestEntry) {
      this.delete(oldestEntry[0]);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: K[] = [];

    this.timestamps.forEach((timestamp, key) => {
      if (now - timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.delete(key));
  }

  getStats(): {
    size: number;
    maxSize: number;
    ttl: number;
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      hitRate: 0, // Could be tracked with hit/miss counters
    };
  }

  destroy(): void {
    this.clear();
    const manager = MemoryManager.getInstance();
    manager.clearInterval(this.cleanupInterval);
  }
}

// React hook for safe cache that auto-cleans on unmount
export function useSafeCache<K, V>(maxSize?: number, ttl?: number): SafeCache<K, V> {
  const cache = useRef<SafeCache<K, V>>();

  if (!cache.current) {
    cache.current = new SafeCache<K, V>(maxSize, ttl);
  }

  useEffect(() => {
    return () => {
      cache.current?.destroy();
    };
  }, []);

  return cache.current;
}

// Performance monitoring for memory usage
export function useMemoryMonitor(intervalMs: number = 10000): {
  memoryStats: any;
  managerStats: any;
} {
  const [memoryStats, setMemoryStats] = useState<any>(null);
  const [managerStats, setManagerStats] = useState<any>(null);
  const { setInterval, clearInterval } = useSafeInterval();

  useEffect(() => {
    const updateStats = () => {
      const manager = MemoryManager.getInstance();
      setManagerStats(manager.getMemoryStats());

      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMemoryStats({
          usedJSHeapSize: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
          totalJSHeapSize: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
          jsHeapSizeLimit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024), // MB
          usagePercentage: Math.round((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100),
        });
      }
    };

    updateStats(); // Initial call
    const intervalId = setInterval(updateStats, intervalMs);

    return () => clearInterval(intervalId);
  }, [intervalMs, setInterval, clearInterval]);

  return { memoryStats, managerStats };
}

export default MemoryManager;