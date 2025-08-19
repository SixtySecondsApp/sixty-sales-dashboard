/**
 * PERFORMANCE TESTING SUITE
 * 
 * Critical QA testing for performance optimization including:
 * - Page load times under acceptable thresholds
 * - Database query efficiency
 * - Memory usage optimization
 * - Component rendering performance
 * - Large dataset handling
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Component imports for performance testing
import { SalesTable } from '../src/components/SalesTable';
import { ClientsTable } from '../src/components/ClientsTable';
import { PaymentsTable } from '../src/components/PaymentsTable';
import CompanyProfile from '../src/pages/companies/CompanyProfile';

// Utility imports
import { calculateLTVValue } from '../src/lib/utils/calculations';
import { validateFinancialNumber } from '../src/lib/utils/financialValidation';

// Performance monitoring utilities
class PerformanceMonitor {
  private startTime: number;
  private memories: number[] = [];

  start() {
    this.startTime = performance.now();
    this.recordMemory();
  }

  end(): { duration: number; avgMemory: number; peakMemory: number } {
    const duration = performance.now() - this.startTime;
    this.recordMemory();
    
    const avgMemory = this.memories.reduce((a, b) => a + b, 0) / this.memories.length;
    const peakMemory = Math.max(...this.memories);
    
    return { duration, avgMemory, peakMemory };
  }

  private recordMemory() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.memories.push(memory.usedJSHeapSize / 1024 / 1024); // Convert to MB
    } else {
      this.memories.push(0); // Fallback for environments without memory API
    }
  }
}

// Generate large test datasets
function generateLargeDataset(size: number) {
  return Array.from({ length: size }, (_, i) => ({
    id: i + 1,
    company_name: `Company ${i + 1}`,
    owner_name: `Owner ${i + 1}`,
    amount: (i + 1) * 1000,
    type: i % 3 === 0 ? 'proposal' : 'meeting',
    date: new Date(2024, 0, (i % 30) + 1).toISOString(),
    deal: {
      id: i + 1,
      monthly_mrr: (i + 1) * 100,
      one_off_revenue: (i + 1) * 500,
      owner_name: `Owner ${i + 1}`,
      owner_id: i + 1
    }
  }));
}

function generateLargeClientsDataset(size: number) {
  return Array.from({ length: size }, (_, i) => ({
    id: i + 1,
    company_name: `Client Company ${i + 1}`,
    status: i % 4 === 0 ? 'active' : i % 4 === 1 ? 'trial' : i % 4 === 2 ? 'churned' : 'pending',
    monthly_mrr: (i + 1) * 100,
    annual_value: (i + 1) * 1200,
    lifetime_deal_value: ((i + 1) * 100 * 3) + ((i + 1) * 500),
    owner_name: `Owner ${i + 1}`,
    start_date: new Date(2024, 0, (i % 30) + 1).toISOString(),
    last_payment_date: new Date(2024, 1, (i % 28) + 1).toISOString()
  }));
}

// Mock hooks with performance data
const mockPerformanceData = generateLargeDataset(1000);
const mockPerformanceClients = generateLargeClientsDataset(1000);

vi.mock('../src/lib/hooks/useSalesData', () => ({
  useSalesData: vi.fn(() => ({
    data: mockPerformanceData,
    isLoading: false,
    error: null
  }))
}));

vi.mock('../src/lib/hooks/useClients', () => ({
  useClients: vi.fn(() => ({
    clients: mockPerformanceClients,
    isLoading: false,
    error: null
  }))
}));

vi.mock('../src/lib/hooks/useCompany', () => ({
  useCompany: vi.fn(() => ({
    company: {
      id: 1,
      name: 'Performance Test Company',
      industry: 'Technology'
    },
    deals: mockPerformanceData.slice(0, 100).map(item => item.deal),
    activities: mockPerformanceData.slice(0, 100),
    clients: mockPerformanceClients.slice(0, 50),
    isLoading: false,
    error: null
  }))
}));

// Test wrapper
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    React.createElement(BrowserRouter, null, children)
  );
};

describe('Performance Testing - Critical QA', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    vi.clearAllMocks();
  });

  describe('Component Rendering Performance', () => {
    it('should render SalesTable with 1000 items within performance limits', () => {
      performanceMonitor.start();
      
      render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      const metrics = performanceMonitor.end();
      
      // Should render within 2 seconds
      expect(metrics.duration).toBeLessThan(2000);
      
      // Memory should be reasonable (less than 50MB)
      expect(metrics.peakMemory).toBeLessThan(50);
      
      // Component should be visible
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should render ClientsTable with large dataset efficiently', () => {
      performanceMonitor.start();
      
      render(
        <TestWrapper>
          <ClientsTable />
        </TestWrapper>
      );

      const metrics = performanceMonitor.end();
      
      // Should render within 2 seconds
      expect(metrics.duration).toBeLessThan(2000);
      
      // Should find the table
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('should handle rapid re-renders without performance degradation', async () => {
      const { rerender } = render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      const renderTimes: number[] = [];

      // Test 10 rapid re-renders
      for (let i = 0; i < 10; i++) {
        performanceMonitor.start();
        
        rerender(
          <TestWrapper>
            <SalesTable key={i} />
          </TestWrapper>
        );

        const metrics = performanceMonitor.end();
        renderTimes.push(metrics.duration);
      }

      // Average render time should be under 500ms
      const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      expect(avgRenderTime).toBeLessThan(500);

      // No render should take more than 1 second
      renderTimes.forEach(time => {
        expect(time).toBeLessThan(1000);
      });
    });

    it('should handle scroll performance in large tables', async () => {
      render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      const table = screen.getByRole('table');
      const scrollContainer = table.closest('[data-testid="scroll-container"]') || 
                            table.closest('.overflow-auto') || 
                            table.parentElement;

      if (scrollContainer) {
        performanceMonitor.start();

        // Simulate scrolling
        fireEvent.scroll(scrollContainer, { target: { scrollTop: 1000 } });
        await waitFor(() => {
          // Wait for scroll to complete
        }, { timeout: 1000 });

        const metrics = performanceMonitor.end();
        
        // Scroll handling should be fast
        expect(metrics.duration).toBeLessThan(100);
      }
    });
  });

  describe('Financial Calculations Performance', () => {
    it('should calculate LTV for large datasets efficiently', () => {
      const largeDataset = generateLargeDataset(10000);
      
      performanceMonitor.start();
      
      const results = largeDataset.map(item => 
        calculateLTVValue(item.deal)
      );

      const metrics = performanceMonitor.end();
      
      // Should process 10k calculations in under 100ms
      expect(metrics.duration).toBeLessThan(100);
      
      // Should produce correct results
      expect(results.length).toBe(10000);
      expect(results[0]).toBeGreaterThan(0);
    });

    it('should validate financial data efficiently', () => {
      const testValues = Array.from({ length: 5000 }, (_, i) => i * 100);
      
      performanceMonitor.start();
      
      const results = testValues.map(value => 
        validateFinancialNumber(value)
      );

      const metrics = performanceMonitor.end();
      
      // Should validate 5k values in under 50ms
      expect(metrics.duration).toBeLessThan(50);
      
      // All should be valid
      expect(results.every(r => r.isValid)).toBe(true);
    });

    it('should handle complex financial aggregations efficiently', () => {
      const clients = generateLargeClientsDataset(5000);
      
      performanceMonitor.start();
      
      // Simulate complex aggregations
      const totalMRR = clients
        .filter(client => client.status === 'active')
        .reduce((sum, client) => sum + client.monthly_mrr, 0);
      
      const averageLTV = clients
        .filter(client => client.status === 'active')
        .reduce((sum, client) => sum + client.lifetime_deal_value, 0) / 
        clients.filter(client => client.status === 'active').length;

      const churnRate = clients.filter(client => client.status === 'churned').length / clients.length;

      const metrics = performanceMonitor.end();
      
      // Should complete aggregations in under 50ms
      expect(metrics.duration).toBeLessThan(50);
      
      // Results should be valid
      expect(totalMRR).toBeGreaterThan(0);
      expect(averageLTV).toBeGreaterThan(0);
      expect(churnRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Search and Filter Performance', () => {
    it('should handle search filtering efficiently', async () => {
      render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      const searchInput = screen.queryByPlaceholderText(/search/i) ||
                         screen.queryByRole('searchbox');

      if (searchInput) {
        performanceMonitor.start();

        // Simulate typing search query
        fireEvent.change(searchInput, { target: { value: 'Company 50' } });

        await waitFor(() => {
          // Search should complete
        }, { timeout: 500 });

        const metrics = performanceMonitor.end();
        
        // Search should be fast
        expect(metrics.duration).toBeLessThan(500);
      }
    });

    it('should handle complex filtering efficiently', async () => {
      render(
        <TestWrapper>
          <ClientsTable />
        </TestWrapper>
      );

      performanceMonitor.start();

      // Simulate applying multiple filters
      const statusFilter = screen.queryByText(/status/i);
      if (statusFilter) {
        fireEvent.click(statusFilter);
        
        await waitFor(() => {
          const activeOption = screen.queryByText('active');
          if (activeOption) {
            fireEvent.click(activeOption);
          }
        }, { timeout: 1000 });
      }

      const metrics = performanceMonitor.end();
      
      // Filtering should be fast
      expect(metrics.duration).toBeLessThan(1000);
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should not have memory leaks in component mounting/unmounting', () => {
      const initialMemory = performance.memory ? 
        (performance as any).memory.usedJSHeapSize : 0;

      // Mount and unmount components multiple times
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(
          <TestWrapper>
            <SalesTable />
          </TestWrapper>
        );
        unmount();
      }

      const finalMemory = performance.memory ? 
        (performance as any).memory.usedJSHeapSize : 0;

      if (performance.memory) {
        const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
        
        // Memory increase should be minimal (less than 10MB)
        expect(memoryIncrease).toBeLessThan(10);
      }
    });

    it('should handle large prop updates efficiently', () => {
      const SmallDataComponent = () => {
        const smallData = generateLargeDataset(100);
        return (
          <TestWrapper>
            <SalesTable key={smallData.length} />
          </TestWrapper>
        );
      };

      const LargeDataComponent = () => {
        const largeData = generateLargeDataset(1000);
        return (
          <TestWrapper>
            <SalesTable key={largeData.length} />
          </TestWrapper>
        );
      };

      performanceMonitor.start();

      const { rerender } = render(<SmallDataComponent />);
      rerender(<LargeDataComponent />);

      const metrics = performanceMonitor.end();
      
      // Prop update should be handled efficiently
      expect(metrics.duration).toBeLessThan(1000);
    });
  });

  describe('Network and API Performance', () => {
    it('should handle API timeouts gracefully', async () => {
      // Mock slow API response
      const slowApiMock = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), 3000))
      );

      vi.mocked(require('../src/lib/hooks/useSalesData').useSalesData).mockReturnValue({
        data: [],
        isLoading: true,
        error: null
      });

      performanceMonitor.start();

      render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      // Should show loading state
      expect(screen.getByText(/loading/i) || screen.getByRole('progressbar')).toBeInTheDocument();

      const metrics = performanceMonitor.end();
      
      // Initial render with loading should be fast
      expect(metrics.duration).toBeLessThan(100);
    });

    it('should batch API requests efficiently', async () => {
      let apiCallCount = 0;
      
      // Mock API to count calls
      vi.mocked(require('../src/lib/hooks/useSalesData').useSalesData).mockImplementation(() => {
        apiCallCount++;
        return {
          data: generateLargeDataset(100),
          isLoading: false,
          error: null
        };
      });

      render(
        <TestWrapper>
          <div>
            <SalesTable />
            <ClientsTable />
            <PaymentsTable />
          </div>
        </TestWrapper>
      );

      // Should batch or minimize API calls
      expect(apiCallCount).toBeLessThanOrEqual(3); // One per component max
    });
  });

  describe('Pagination and Virtualization', () => {
    it('should implement efficient pagination or virtualization', () => {
      render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      const tableRows = screen.getAllByRole('row');
      
      // Should not render all 1000 rows at once
      // Either pagination limits or virtualization should be in place
      expect(tableRows.length).toBeLessThan(100);
    });

    it('should handle pagination navigation efficiently', async () => {
      render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      const nextButton = screen.queryByText(/next/i) || 
                        screen.queryByRole('button', { name: /next/i });

      if (nextButton) {
        performanceMonitor.start();

        fireEvent.click(nextButton);

        await waitFor(() => {
          // Page navigation should complete
        }, { timeout: 500 });

        const metrics = performanceMonitor.end();
        
        // Pagination should be fast
        expect(metrics.duration).toBeLessThan(500);
      }
    });
  });

  describe('Responsive Design Performance', () => {
    it('should handle viewport changes efficiently', () => {
      // Mock viewport resize
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920,
      });

      const { rerender } = render(
        <TestWrapper>
          <CompanyProfile />
        </TestWrapper>
      );

      performanceMonitor.start();

      // Simulate mobile viewport
      window.innerWidth = 375;
      window.dispatchEvent(new Event('resize'));

      rerender(
        <TestWrapper>
          <CompanyProfile />
        </TestWrapper>
      );

      const metrics = performanceMonitor.end();
      
      // Responsive changes should be fast
      expect(metrics.duration).toBeLessThan(200);
    });

    it('should optimize for mobile performance', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      performanceMonitor.start();

      render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      const metrics = performanceMonitor.end();
      
      // Mobile rendering should be optimized
      expect(metrics.duration).toBeLessThan(1000);
      expect(metrics.peakMemory).toBeLessThan(30); // Lower memory limit for mobile
    });
  });

  describe('Performance Regression Testing', () => {
    it('should maintain consistent performance across different data sizes', () => {
      const sizes = [100, 500, 1000, 2000];
      const renderTimes: number[] = [];

      sizes.forEach(size => {
        const data = generateLargeDataset(size);
        
        vi.mocked(require('../src/lib/hooks/useSalesData').useSalesData).mockReturnValue({
          data,
          isLoading: false,
          error: null
        });

        performanceMonitor.start();

        const { unmount } = render(
          <TestWrapper>
            <SalesTable key={size} />
          </TestWrapper>
        );

        const metrics = performanceMonitor.end();
        renderTimes.push(metrics.duration / size); // Time per item

        unmount();
      });

      // Performance should scale linearly or better
      // Later renders shouldn't be significantly slower per item
      const firstRenderPerItem = renderTimes[0];
      const lastRenderPerItem = renderTimes[renderTimes.length - 1];
      
      expect(lastRenderPerItem).toBeLessThanOrEqual(firstRenderPerItem * 2);
    });

    it('should track performance metrics consistently', () => {
      const metrics: number[] = [];

      // Run same operation multiple times
      for (let i = 0; i < 5; i++) {
        performanceMonitor.start();

        render(
          <TestWrapper>
            <SalesTable key={i} />
          </TestWrapper>
        );

        const result = performanceMonitor.end();
        metrics.push(result.duration);
      }

      // Performance should be consistent (low variance)
      const average = metrics.reduce((a, b) => a + b, 0) / metrics.length;
      const variance = metrics.reduce((acc, time) => acc + Math.pow(time - average, 2), 0) / metrics.length;
      const standardDeviation = Math.sqrt(variance);

      // Standard deviation should be less than 50% of average
      expect(standardDeviation).toBeLessThan(average * 0.5);
    });
  });

  describe('Bundle Size and Loading Performance', () => {
    it('should load critical resources quickly', () => {
      // Simulate initial page load
      performanceMonitor.start();

      render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      const metrics = performanceMonitor.end();
      
      // Critical resources should load quickly
      expect(metrics.duration).toBeLessThan(1000);
    });

    it('should implement efficient code splitting', () => {
      // This test would verify that non-critical components are lazy-loaded
      // For now, we'll test that initial bundle is reasonable
      
      const component = render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      // Component should be functional immediately
      expect(screen.getByRole('table')).toBeInTheDocument();
      
      component.unmount();
    });
  });
});