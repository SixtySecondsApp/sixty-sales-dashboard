/**
 * Memory Monitor Hook
 * 
 * Provides real-time memory usage monitoring and statistics
 * for React components and applications
 */

import { useState, useEffect, useRef } from 'react';
import globalMemoryManager from '@/lib/utils/memoryManager';

interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usagePercentage: number;
}

interface MemoryManagerStats {
  eventListeners: number;
  timers: number;
  observers: number;
  subscriptions: number;
  componentsTracked: number;
}

export function useMemoryMonitor(updateInterval: number = 5000) {
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [managerStats, setManagerStats] = useState<MemoryManagerStats | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const updateMemoryStats = () => {
      // Get browser memory info if available
      if (typeof performance !== 'undefined' && performance.memory) {
        const memory = performance.memory;
        const usagePercentage = Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100);
        
        setMemoryStats({
          usedJSHeapSize: Math.round(memory.usedJSHeapSize / (1024 * 1024)), // MB
          totalJSHeapSize: Math.round(memory.totalJSHeapSize / (1024 * 1024)), // MB
          jsHeapSizeLimit: Math.round(memory.jsHeapSizeLimit / (1024 * 1024)), // MB
          usagePercentage
        });
      }

      // Get memory manager stats
      const memoryManagerStats = globalMemoryManager.getMemoryStats();
      const componentCount = memoryManagerStats.componentsTracked;

      // Estimate resource counts (simplified for this implementation)
      setManagerStats({
        eventListeners: componentCount * 2, // Estimate
        timers: componentCount, // Estimate
        observers: Math.floor(componentCount / 2), // Estimate
        subscriptions: componentCount, // Estimate
        componentsTracked: componentCount
      });
    };

    // Initial update
    updateMemoryStats();

    // Set up interval
    intervalRef.current = setInterval(updateMemoryStats, updateInterval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [updateInterval]);

  return {
    memoryStats,
    managerStats
  };
}

export default useMemoryMonitor;