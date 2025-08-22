import { useEffect, useRef } from 'react';
import logger from '@/lib/utils/logger';

/**
 * Hook for managing cleanup functions in components
 * Ensures all registered cleanup functions are called on unmount
 */
export const useCleanup = () => {
  const cleanupFunctions = useRef<(() => void)[]>([]);

  const addCleanup = (cleanup: () => void) => {
    cleanupFunctions.current.push(cleanup);
  };

  const clearCleanup = () => {
    cleanupFunctions.current.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        logger.error('Error during cleanup:', error);
      }
    });
    cleanupFunctions.current = [];
  };

  useEffect(() => {
    return () => {
      clearCleanup();
    };
  }, []);

  return { addCleanup, clearCleanup };
};

/**
 * Hook for monitoring component render count and performance
 * Provides warnings when components re-render excessively
 */
export const useRenderMonitor = (componentName: string, threshold = 10) => {
  const renderCount = useRef(0);
  const lastWarning = useRef(0);
  const mountTime = useRef(Date.now());

  useEffect(() => {
    renderCount.current++;
    
    // Warn about excessive re-renders in development
    if (process.env.NODE_ENV === 'development' && renderCount.current > threshold) {
      const now = Date.now();
      const timeSinceMount = now - mountTime.current;
      
      // Throttle warnings to once every 5 seconds
      if (now - lastWarning.current > 5000) {
        logger.warn(`🔄 ${componentName} has re-rendered ${renderCount.current} times in ${timeSinceMount}ms. Consider optimization.`);
        lastWarning.current = now;
      }
    }
  });

  return {
    renderCount: renderCount.current,
    timeSinceMount: Date.now() - mountTime.current
  };
};

/**
 * Hook for managing interval cleanup
 */
export const useInterval = (callback: () => void, delay: number | null) => {
  const savedCallback = useRef(callback);
  const intervalId = useRef<NodeJS.Timeout>();

  // Update callback ref when callback changes
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    if (delay !== null) {
      intervalId.current = setInterval(() => savedCallback.current(), delay);

      return () => {
        if (intervalId.current) {
          clearInterval(intervalId.current);
        }
      };
    }
  }, [delay]);
};

/**
 * Hook for managing timeout cleanup
 */
export const useTimeout = (callback: () => void, delay: number | null) => {
  const savedCallback = useRef(callback);
  const timeoutId = useRef<NodeJS.Timeout>();

  // Update callback ref when callback changes
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the timeout
  useEffect(() => {
    if (delay !== null) {
      timeoutId.current = setTimeout(() => savedCallback.current(), delay);

      return () => {
        if (timeoutId.current) {
          clearTimeout(timeoutId.current);
        }
      };
    }
  }, [delay]);
};

export default useCleanup;