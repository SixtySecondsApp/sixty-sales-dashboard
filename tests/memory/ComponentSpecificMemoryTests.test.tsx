/**
 * Component-Specific Memory Tests
 * 
 * Tests memory usage for specific dashboard components to ensure
 * optimizations are working correctly in real-world scenarios
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, waitFor, fireEvent, screen } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryTestUtils, mockPerformanceMemory } from './MemoryTestFramework.test';

// Import components to test
import { MemoryMonitor } from '@/components/MemoryMonitor';
import OptimizedDashboard from '@/components/OptimizedDashboard';
import { PaymentsTableOptimized } from '@/components/PaymentsTableOptimized';
import { useMemoryMonitor } from '@/lib/hooks/useMemoryMonitor';
import { usePerformanceOptimization } from '@/lib/hooks/usePerformanceOptimization';
import globalMemoryManager from '@/lib/utils/memoryManager';

// Mock Supabase client
vi.mock('@/lib/supabase/clientV3-optimized', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    }))
  }
}));

// Test wrapper with providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, cacheTime: 0 }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

// Test component that uses memory monitoring
const TestMemoryMonitorComponent = () => {
  const { memoryStats, managerStats } = useMemoryMonitor(1000);
  const { performanceMetrics } = usePerformanceOptimization();
  
  return (
    <div data-testid="memory-test-component">
      <div data-testid="memory-usage">
        {memoryStats ? memoryStats.usagePercentage : 0}
      </div>
      <div data-testid="render-count">
        {performanceMetrics.componentRenders}
      </div>
      <MemoryMonitor showDetails={true} />
    </div>
  );
};

describe('Component-Specific Memory Tests', () => {
  let memoryUtils: MemoryTestUtils;
  let queryClient: QueryClient;
  const originalPerformance = global.performance;

  beforeEach(() => {
    // Setup mock performance
    global.performance = {
      ...originalPerformance,
      memory: mockPerformanceMemory,
      now: () => Date.now(),
      mark: vi.fn(),
      measure: vi.fn(),
    } as any;

    memoryUtils = new MemoryTestUtils();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, cacheTime: 0 }
      }
    });
    
    memoryUtils.takeSnapshot('test-start');
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    memoryUtils.logMemoryReport();
    global.performance = originalPerformance;
  });

  describe('Memory Monitor Component Tests', () => {
    test('should render MemoryMonitor without memory leaks', async () => {
      memoryUtils.takeSnapshot('before-memory-monitor');

      const { rerender, unmount } = render(
        <TestWrapper>
          <TestMemoryMonitorComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('memory-test-component')).toBeInTheDocument();
      });

      memoryUtils.takeSnapshot('after-memory-monitor-render');

      // Wait for memory monitoring to update
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1200));
      });

      memoryUtils.takeSnapshot('after-memory-update');

      // Re-render multiple times to test memory stability
      for (let i = 0; i < 5; i++) {
        rerender(
          <TestWrapper>
            <TestMemoryMonitorComponent />
          </TestWrapper>
        );
        
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        });
      }

      memoryUtils.takeSnapshot('after-rerenders');

      const memoryUsage = memoryUtils.getMemoryUsagePercent();
      expect(memoryUsage).toBeLessThan(60); // Should stay under 60%

      unmount();
      memoryUtils.takeSnapshot('after-unmount');

      console.log(`MemoryMonitor component memory usage: ${memoryUsage.toFixed(1)}%`);
    });

    test('should handle memory monitor updates efficiently', async () => {
      let updateCount = 0;
      const MonitorUpdateTracker = () => {
        const { memoryStats } = useMemoryMonitor(500); // Fast updates for testing
        
        React.useEffect(() => {
          updateCount++;
        }, [memoryStats]);

        return (
          <div data-testid="update-tracker">
            Updates: {updateCount}
          </div>
        );
      };

      render(
        <TestWrapper>
          <MonitorUpdateTracker />
        </TestWrapper>
      );

      // Wait for several updates
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 2500));
      });

      // Should have multiple updates but not excessive
      expect(updateCount).toBeGreaterThan(3);
      expect(updateCount).toBeLessThan(10);

      const finalUsage = memoryUtils.getMemoryUsagePercent();
      expect(finalUsage).toBeLessThan(50);

      console.log(`Memory monitor updates: ${updateCount}`);
    });
  });

  describe('OptimizedDashboard Memory Tests', () => {
    test('should load OptimizedDashboard without exceeding memory limits', async () => {
      memoryUtils.takeSnapshot('before-dashboard');

      // Mock dashboard data
      const mockDashboardData = {
        stats: Array.from({ length: 20 }, (_, i) => ({
          id: i,
          label: `Metric ${i}`,
          value: Math.random() * 1000000,
          change: Math.random() * 100 - 50
        })),
        chartData: Array.from({ length: 100 }, (_, i) => ({
          date: new Date(Date.now() - (99 - i) * 24 * 60 * 60 * 1000).toISOString(),
          value: Math.random() * 10000
        }))
      };

      const { unmount } = render(
        <TestWrapper>
          <OptimizedDashboard />
        </TestWrapper>
      );

      await waitFor(() => {
        // Wait for lazy-loaded components
        expect(screen.getByTestId('optimized-dashboard')).toBeInTheDocument();
      }, { timeout: 5000 });

      memoryUtils.takeSnapshot('after-dashboard-load');

      // Simulate user interactions
      await act(async () => {
        // Simulate scrolling and interactions
        fireEvent.scroll(window, { target: { scrollY: 500 } });
        await new Promise(resolve => setTimeout(resolve, 500));
      });

      memoryUtils.takeSnapshot('after-interactions');

      const memoryUsage = memoryUtils.getMemoryUsagePercent();
      expect(memoryUsage).toBeLessThan(70); // Critical threshold

      unmount();
      memoryUtils.takeSnapshot('after-dashboard-unmount');

      // Check for memory cleanup
      const memoryDiff = memoryUtils.getMemoryDiff();
      const memoryDiffMB = memoryDiff / (1024 * 1024);
      
      console.log(`OptimizedDashboard memory usage: ${memoryUsage.toFixed(1)}%`);
      console.log(`Memory difference: ${memoryDiffMB.toFixed(2)}MB`);
    });
  });

  describe('PaymentsTableOptimized Memory Tests', () => {
    test('should handle large payment datasets efficiently', async () => {
      memoryUtils.takeSnapshot('before-payments-table');

      // Mock large payment dataset
      const largePaymentData = Array.from({ length: 1000 }, (_, i) => ({
        id: i.toString(),
        deal_id: `deal-${i}`,
        amount: Math.random() * 50000,
        date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        status: Math.random() > 0.8 ? 'pending' : 'completed',
        description: `Payment ${i} description with some additional metadata`,
        client_name: `Client ${i % 100}`, // Simulate some duplicate clients
        deal_title: `Deal Title ${i}`
      }));

      // Mock the payments hook
      vi.doMock('@/lib/hooks/usePayments', () => ({
        usePayments: () => ({
          data: largePaymentData,
          isLoading: false,
          error: null
        })
      }));

      const { rerender, unmount } = render(
        <TestWrapper>
          <PaymentsTableOptimized />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      memoryUtils.takeSnapshot('after-table-render');

      // Simulate table interactions (sorting, filtering)
      const sortButtons = screen.getAllByRole('button');
      if (sortButtons.length > 0) {
        for (let i = 0; i < Math.min(3, sortButtons.length); i++) {
          fireEvent.click(sortButtons[i]);
          await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
          });
        }
      }

      memoryUtils.takeSnapshot('after-table-interactions');

      // Re-render with different data to test virtualization
      const newData = largePaymentData.slice(0, 500);
      rerender(
        <TestWrapper>
          <PaymentsTableOptimized />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      memoryUtils.takeSnapshot('after-data-change');

      const memoryUsage = memoryUtils.getMemoryUsagePercent();
      expect(memoryUsage).toBeLessThan(75);

      unmount();
      memoryUtils.takeSnapshot('after-table-unmount');

      console.log(`PaymentsTableOptimized memory usage: ${memoryUsage.toFixed(1)}%`);
    });

    test('should properly cleanup virtualized table resources', async () => {
      const componentId = 'payments-table-test';
      globalMemoryManager.registerComponent(componentId);

      // Simulate virtualized table cleanup
      const mockIntervalId = setInterval(() => {}, 1000);
      const mockTimeoutId = setTimeout(() => {}, 5000);
      
      globalMemoryManager.trackInterval(componentId, mockIntervalId);
      globalMemoryManager.trackTimeout(componentId, mockTimeoutId);

      const statsBefore = globalMemoryManager.getMemoryStats();
      expect(statsBefore.componentsTracked).toBeGreaterThan(0);

      // Cleanup component
      globalMemoryManager.unregisterComponent(componentId);

      const statsAfter = globalMemoryManager.getMemoryStats();
      expect(statsAfter.componentsTracked).toBe(statsBefore.componentsTracked - 1);
    });
  });

  describe('Performance Hook Memory Tests', () => {
    test('should not leak memory with performance monitoring hooks', async () => {
      memoryUtils.takeSnapshot('before-performance-hooks');

      const PerformanceTestComponent = () => {
        const { performanceMetrics, measurePerformance } = usePerformanceOptimization({
          enableResourcePreloading: true,
          enableSmartPreloading: true,
          enableBundleMonitoring: true,
          enableMemoryCleanup: true,
          debugMode: true
        });

        React.useEffect(() => {
          measurePerformance('test-operation', () => {
            // Simulate work
            const result = Array.from({ length: 1000 }, (_, i) => i * 2).reduce((a, b) => a + b, 0);
          });
        }, [measurePerformance]);

        return (
          <div data-testid="performance-component">
            <div>Renders: {performanceMetrics.componentRenders}</div>
            <div>Memory: {performanceMetrics.memoryUsage}</div>
            <div>Bundle: {performanceMetrics.bundleSize}</div>
          </div>
        );
      };

      const { rerender, unmount } = render(
        <TestWrapper>
          <PerformanceTestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('performance-component')).toBeInTheDocument();
      });

      memoryUtils.takeSnapshot('after-performance-component');

      // Trigger multiple re-renders
      for (let i = 0; i < 10; i++) {
        rerender(
          <TestWrapper>
            <PerformanceTestComponent />
          </TestWrapper>
        );
        
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
        });
      }

      memoryUtils.takeSnapshot('after-performance-rerenders');

      const memoryUsage = memoryUtils.getMemoryUsagePercent();
      expect(memoryUsage).toBeLessThan(65);

      unmount();
      
      // Allow cleanup time
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      memoryUtils.takeSnapshot('after-performance-cleanup');

      console.log(`Performance hooks memory usage: ${memoryUsage.toFixed(1)}%`);
    });
  });

  describe('Memory Manager Integration Tests', () => {
    test('should handle emergency memory cleanup correctly', async () => {
      memoryUtils.takeSnapshot('before-emergency-test');

      // Simulate high memory usage condition
      const originalMemory = mockPerformanceMemory.usedJSHeapSize;
      mockPerformanceMemory.usedJSHeapSize = 180 * 1024 * 1024; // 180MB (high)

      // Create multiple components to trigger cleanup
      const components = [];
      for (let i = 0; i < 10; i++) {
        const componentId = `emergency-test-${i}`;
        globalMemoryManager.registerComponent(componentId);
        components.push(componentId);
        
        // Add some tracked resources
        const intervalId = setInterval(() => {}, 1000);
        globalMemoryManager.trackInterval(componentId, intervalId);
      }

      // Simulate component unmounting (but not immediate cleanup)
      components.forEach(id => {
        globalMemoryManager.unregisterComponent(id);
      });

      // Wait for emergency cleanup to potentially trigger
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      memoryUtils.takeSnapshot('after-emergency-cleanup');

      // Restore original memory value
      mockPerformanceMemory.usedJSHeapSize = originalMemory;

      const finalStats = globalMemoryManager.getMemoryStats();
      
      // Components should be cleaned up
      expect(finalStats.componentsTracked).toBe(0);
    });
  });
});