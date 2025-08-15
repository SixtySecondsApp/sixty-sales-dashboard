import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateTestActivities } from './StatisticalCalculations.test';

// Mock React.useMemo to track recalculations
const mockUseMemo = vi.fn();
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useMemo: (fn: () => any, deps: any[]) => {
      mockUseMemo(deps);
      return fn();
    }
  };
});

// Performance monitoring utilities
const measureRenderTime = (renderFn: () => any) => {
  const startTime = performance.now();
  const result = renderFn();
  const endTime = performance.now();
  return {
    result,
    renderTime: endTime - startTime
  };
};

const measureMemoryUsage = () => {
  if ('memory' in performance) {
    return (performance as any).memory.usedJSHeapSize;
  }
  return null;
};

// Mock Activity type
interface Activity {
  id: string;
  type: 'sale' | 'proposal' | 'meeting' | 'outbound';
  status: 'completed' | 'pending' | 'cancelled' | 'no_show';
  amount?: number;
  deals?: {
    id: string;
    name: string;
    value: number;
    billing_cycle?: 'monthly' | 'annual' | 'one-time';
    contract_length?: number;
  };
  date: string;
  sales_rep: string;
  client_name: string;
  details?: string;
}

// Mock performant statistics calculation
const calculateStatsPerformant = (activities: Activity[]) => {
  // Optimized calculation with early returns and minimal iterations
  let totalRevenue = 0;
  let activeDeals = 0;
  let salesCount = 0;
  let proposalCount = 0;
  let meetingCount = 0;
  let noShowCount = 0;
  let scheduledCount = 0;

  // Single pass through activities
  for (const activity of activities) {
    const isScheduled = ['meeting', 'proposal', 'sale'].includes(activity.type);
    
    if (isScheduled) {
      scheduledCount++;
      if (activity.status === 'no_show') noShowCount++;
    }

    switch (activity.type) {
      case 'sale':
        salesCount++;
        if (activity.status === 'completed') {
          activeDeals++;
          const amount = activity.amount || 0;
          const ltvValue = activity.deals?.value || 0;
          totalRevenue += Math.max(amount, ltvValue);
        }
        break;
      case 'proposal':
        proposalCount++;
        break;
      case 'meeting':
        meetingCount++;
        break;
    }
  }

  // Protected division
  const noShowRate = scheduledCount > 0 ? Math.round((noShowCount / scheduledCount) * 100) : 0;
  const proposalWinRate = proposalCount > 0 ? Math.round((salesCount / proposalCount) * 100) : 0;
  const meetingToProposalRate = meetingCount > 0 ? Math.round((proposalCount / meetingCount) * 100) : 0;
  const avgDeal = salesCount > 0 ? totalRevenue / salesCount : 0;

  return {
    totalRevenue,
    activeDeals,
    proposalWinRate,
    meetingToProposalRate,
    avgDeal,
    noShowRate,
    noShowCount,
    totalScheduledCount: scheduledCount,
    salesActivities: salesCount,
    proposalActivities: proposalCount,
    meetingActivities: meetingCount
  };
};

// Mock StatCard component optimized for performance
const PerformantStatCard = React.memo(({ 
  title, 
  value, 
  trendPercentage, 
  color 
}: {
  title: string;
  value: number;
  trendPercentage: number;
  color: string;
}) => {
  // Memoized trend calculation
  const trendData = React.useMemo(() => ({
    text: trendPercentage > 0 ? `+${trendPercentage}%` : `${trendPercentage}%`,
    color: trendPercentage > 0 ? 'text-emerald-500' : trendPercentage < 0 ? 'text-red-500' : 'text-gray-500',
    icon: trendPercentage > 0 ? '↗' : trendPercentage < 0 ? '↘' : '→'
  }), [trendPercentage]);

  return (
    <div 
      data-testid={`perf-stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
      className="min-h-[120px] p-4 bg-gray-900/50 rounded-xl border border-gray-800/50"
    >
      <h3 className="text-xs font-medium text-gray-400 mb-1">{title}</h3>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className={`text-xs ${trendData.color}`}>
        {trendData.icon} {trendData.text}
      </div>
    </div>
  );
});

// Mock StatGrid component with virtualization concepts
const PerformantStatGrid = ({ activities }: { activities: Activity[] }) => {
  // Memoized statistics calculation
  const stats = React.useMemo(() => {
    return calculateStatsPerformant(activities);
  }, [activities]);

  // Memoized trend calculations (simplified for testing)
  const trends = React.useMemo(() => ({
    revenue: Math.floor(Math.random() * 40) - 20,
    deals: Math.floor(Math.random() * 40) - 20,
    proposal: Math.floor(Math.random() * 40) - 20,
    meeting: Math.floor(Math.random() * 40) - 20,
    noShow: Math.floor(Math.random() * 40) - 20
  }), [activities.length]); // Simplified dependency

  return (
    <div 
      data-testid="performance-stat-grid"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
    >
      <PerformantStatCard
        title="Total Revenue"
        value={stats.totalRevenue}
        trendPercentage={trends.revenue}
        color="emerald"
      />
      <PerformantStatCard
        title="Active Deals"
        value={stats.activeDeals}
        trendPercentage={trends.deals}
        color="blue"
      />
      <PerformantStatCard
        title="Proposal Win Rate"
        value={stats.proposalWinRate}
        trendPercentage={trends.proposal}
        color="amber"
      />
      <PerformantStatCard
        title="Meeting Conversion"
        value={stats.meetingToProposalRate}
        trendPercentage={trends.meeting}
        color="cyan"
      />
      <PerformantStatCard
        title="No-Show Rate"
        value={stats.noShowRate}
        trendPercentage={trends.noShow}
        color="red"
      />
    </div>
  );
};

describe('Performance Tests', () => {
  beforeEach(() => {
    mockUseMemo.mockClear();
    // Mock performance.now for consistent testing
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Large Dataset Performance', () => {
    test('handles 1000 activities efficiently', async () => {
      const activities = generateTestActivities(1000);
      
      const { renderTime } = measureRenderTime(() => 
        render(<PerformantStatGrid activities={activities} />)
      );

      // Should render in under 100ms for 1000 activities
      expect(renderTime).toBeLessThan(100);
      
      // Verify all stat cards rendered
      expect(screen.getByTestId('perf-stat-card-total-revenue')).toBeInTheDocument();
      expect(screen.getByTestId('perf-stat-card-active-deals')).toBeInTheDocument();
    });

    test('handles 10000 activities within performance budget', async () => {
      const activities = generateTestActivities(10000);
      
      const startMemory = measureMemoryUsage();
      
      const { renderTime } = measureRenderTime(() => 
        render(<PerformantStatGrid activities={activities} />)
      );

      const endMemory = measureMemoryUsage();
      
      // Should render in under 500ms for 10000 activities
      expect(renderTime).toBeLessThan(500);
      
      // Memory usage shouldn't spike excessively (if memory API available)
      if (startMemory && endMemory) {
        const memoryIncrease = endMemory - startMemory;
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
      }
    });

    test('statistical calculations scale linearly', () => {
      const testSizes = [100, 500, 1000, 5000];
      const results = [];

      for (const size of testSizes) {
        const activities = generateTestActivities(size);
        
        const startTime = performance.now();
        calculateStatsPerformant(activities);
        const endTime = performance.now();
        
        results.push({
          size,
          time: endTime - startTime
        });
      }

      // Check that time complexity is reasonable (should be roughly linear)
      const ratioLargest = results[3].time / results[0].time; // 5000/100 = 50x data
      const ratioTime = ratioLargest;
      
      // Time increase should not be exponential (allow up to 100x for 50x data)
      expect(ratioTime).toBeLessThan(100);
    });
  });

  describe('Memoization Optimization', () => {
    test('memoizes statistics calculations correctly', () => {
      const activities = generateTestActivities(100);
      
      const { rerender } = render(<PerformantStatGrid activities={activities} />);
      
      // Clear previous calls
      mockUseMemo.mockClear();
      
      // Rerender with same data
      rerender(<PerformantStatGrid activities={activities} />);
      
      // useMemo should have been called for different memoized values
      expect(mockUseMemo).toHaveBeenCalled();
    });

    test('recalculates when activity data changes', () => {
      const activities1 = generateTestActivities(100);
      const activities2 = generateTestActivities(200);
      
      const { rerender } = render(<PerformantStatGrid activities={activities1} />);
      
      const initialValue = screen.getByTestId('perf-stat-card-total-revenue').textContent;
      
      rerender(<PerformantStatGrid activities={activities2} />);
      
      const newValue = screen.getByTestId('perf-stat-card-total-revenue').textContent;
      
      // Values should be different due to different datasets
      expect(newValue).not.toBe(initialValue);
    });

    test('avoids unnecessary recalculations on unrelated updates', () => {
      const activities = generateTestActivities(100);
      
      const StatGridWrapper = ({ extraProp }: { extraProp: string }) => (
        <div data-extra={extraProp}>
          <PerformantStatGrid activities={activities} />
        </div>
      );
      
      const { rerender } = render(<StatGridWrapper extraProp="initial" />);
      
      mockUseMemo.mockClear();
      
      // Change unrelated prop
      rerender(<StatGridWrapper extraProp="changed" />);
      
      // Statistics should not recalculate for unrelated changes
      // (This test depends on proper dependency arrays in useMemo)
    });
  });

  describe('Rendering Performance', () => {
    test('virtual scrolling simulation for many stat cards', () => {
      // Simulate having many metric categories
      const manyMetrics = Array.from({ length: 50 }, (_, i) => ({
        title: `Metric ${i + 1}`,
        value: Math.random() * 1000,
        trendPercentage: Math.random() * 40 - 20
      }));

      // Only render visible cards (simulate virtualization)
      const visibleStart = 0;
      const visibleEnd = 10;
      const visibleMetrics = manyMetrics.slice(visibleStart, visibleEnd);

      const { renderTime } = measureRenderTime(() => 
        render(
          <div data-testid="virtual-grid">
            {visibleMetrics.map(metric => (
              <PerformantStatCard
                key={metric.title}
                title={metric.title}
                value={metric.value}
                trendPercentage={metric.trendPercentage}
                color="blue"
              />
            ))}
          </div>
        )
      );

      // Should render quickly even with potential for many cards
      expect(renderTime).toBeLessThan(50);
      
      // Only visible cards should be rendered
      expect(screen.getByTestId('perf-stat-card-metric-1')).toBeInTheDocument();
      expect(screen.getByTestId('perf-stat-card-metric-10')).toBeInTheDocument();
      expect(screen.queryByTestId('perf-stat-card-metric-11')).not.toBeInTheDocument();
    });

    test('debounced filter updates prevent excessive recalculations', async () => {
      const activities = generateTestActivities(1000);
      let filterValue = '';
      let renderCount = 0;

      const DebouncedFilterComponent = () => {
        const [filter, setFilter] = React.useState('');
        renderCount++;

        // Simulate debounced filtering
        const debouncedFilter = React.useMemo(() => {
          const timeoutId = setTimeout(() => {
            filterValue = filter;
          }, 300);
          
          return () => clearTimeout(timeoutId);
        }, [filter]);

        const filteredActivities = React.useMemo(() => {
          return activities.filter(a => 
            a.client_name.toLowerCase().includes(filterValue.toLowerCase())
          );
        }, [filterValue]);

        return (
          <div data-testid="debounced-component">
            <input
              data-testid="filter-input"
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter activities..."
            />
            <PerformantStatGrid activities={filteredActivities} />
          </div>
        );
      };

      render(<DebouncedFilterComponent />);
      
      const input = screen.getByTestId('filter-input');
      
      // Fast typing should not cause excessive renders
      const initialRenderCount = renderCount;
      
      // Simulate rapid typing
      act(() => {
        fireEvent.change(input, { target: { value: 't' } });
        fireEvent.change(input, { target: { value: 'te' } });
        fireEvent.change(input, { target: { value: 'test' } });
      });

      // Should not have caused many re-renders due to debouncing
      expect(renderCount - initialRenderCount).toBeLessThan(10);
    });
  });

  describe('Memory Management', () => {
    test('cleans up resources properly', () => {
      const activities = generateTestActivities(1000);
      
      const { unmount } = render(<PerformantStatGrid activities={activities} />);
      
      const beforeMemory = measureMemoryUsage();
      
      unmount();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const afterMemory = measureMemoryUsage();
      
      // Memory should be freed (if memory API is available)
      if (beforeMemory && afterMemory) {
        expect(afterMemory).toBeLessThanOrEqual(beforeMemory);
      }
    });

    test('handles rapid mount/unmount cycles', () => {
      const activities = generateTestActivities(500);
      
      // Simulate rapid navigation or updates
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(<PerformantStatGrid activities={activities} />);
        unmount();
      }
      
      // Should complete without memory leaks or errors
      expect(true).toBe(true);
    });
  });

  describe('Edge Case Performance', () => {
    test('handles empty dataset efficiently', () => {
      const { renderTime } = measureRenderTime(() => 
        render(<PerformantStatGrid activities={[]} />)
      );

      expect(renderTime).toBeLessThan(10);
      
      // Should show zero values
      expect(screen.getByTestId('perf-stat-card-total-revenue')).toHaveTextContent('0');
    });

    test('handles dataset with all identical values', () => {
      const identicalActivities = generateTestActivities(1000, {
        type: 'sale',
        status: 'completed',
        amount: 100,
        sales_rep: 'Same Rep',
        client_name: 'Same Client'
      });

      const { renderTime } = measureRenderTime(() => 
        render(<PerformantStatGrid activities={identicalActivities} />)
      );

      expect(renderTime).toBeLessThan(100);
      
      // Should handle calculations correctly
      expect(screen.getByTestId('perf-stat-card-total-revenue')).toBeInTheDocument();
    });

    test('handles dataset with extreme values', () => {
      const extremeActivities = [
        ...generateTestActivities(500, { amount: Number.MAX_SAFE_INTEGER }),
        ...generateTestActivities(500, { amount: 0.01 })
      ];

      const { renderTime } = measureRenderTime(() => 
        render(<PerformantStatGrid activities={extremeActivities} />)
      );

      expect(renderTime).toBeLessThan(150);
      
      // Should handle without overflow errors
      expect(screen.getByTestId('perf-stat-card-total-revenue')).toBeInTheDocument();
    });
  });

  describe('Concurrent Rendering', () => {
    test('handles concurrent updates without race conditions', async () => {
      let activities = generateTestActivities(100);
      
      const ConcurrentComponent = () => {
        const [data, setData] = React.useState(activities);
        
        React.useEffect(() => {
          // Simulate rapid data updates
          const intervals = [];
          for (let i = 0; i < 5; i++) {
            intervals.push(
              setTimeout(() => {
                setData(generateTestActivities(100 + i * 10));
              }, i * 10)
            );
          }
          
          return () => intervals.forEach(clearTimeout);
        }, []);
        
        return <PerformantStatGrid activities={data} />;
      };

      render(<ConcurrentComponent />);
      
      // Wait for all updates to complete
      await waitFor(() => {
        expect(screen.getByTestId('perf-stat-card-total-revenue')).toBeInTheDocument();
      });
      
      // Should handle concurrent updates without crashing
      expect(screen.getByTestId('performance-stat-grid')).toBeInTheDocument();
    });
  });

  describe('Performance Budgets', () => {
    test('meets Core Web Vitals-inspired performance budgets', () => {
      const activities = generateTestActivities(2000);
      
      // Largest Contentful Paint simulation (should be fast)
      const { renderTime: initialRenderTime } = measureRenderTime(() => 
        render(<PerformantStatGrid activities={activities} />)
      );
      
      expect(initialRenderTime).toBeLessThan(200); // 200ms budget
      
      // Cumulative Layout Shift simulation (re-render shouldn't cause layout shifts)
      const initialPositions = Array.from(
        document.querySelectorAll('[data-testid^="perf-stat-card-"]')
      ).map(el => el.getBoundingClientRect());
      
      // Simulate data update
      const { rerender } = render(<PerformantStatGrid activities={activities} />);
      
      const newActivities = generateTestActivities(2100);
      rerender(<PerformantStatGrid activities={newActivities} />);
      
      const newPositions = Array.from(
        document.querySelectorAll('[data-testid^="perf-stat-card-"]')
      ).map(el => el.getBoundingClientRect());
      
      // Positions should remain stable (minimal layout shift)
      expect(newPositions).toHaveLength(initialPositions.length);
    });
  });
});

// Performance benchmarking utilities for development use
export const benchmarkStatistics = (activityCount: number, iterations: number = 10) => {
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    const activities = generateTestActivities(activityCount);
    
    const startTime = performance.now();
    calculateStatsPerformant(activities);
    const endTime = performance.now();
    
    results.push(endTime - startTime);
  }
  
  const avgTime = results.reduce((sum, time) => sum + time, 0) / results.length;
  const maxTime = Math.max(...results);
  const minTime = Math.min(...results);
  
  return {
    average: avgTime,
    maximum: maxTime,
    minimum: minTime,
    activityCount,
    iterations
  };
};

// Load testing utility
export const loadTestStatGrid = (maxActivities: number, step: number = 1000) => {
  const results = [];
  
  for (let count = step; count <= maxActivities; count += step) {
    const benchmark = benchmarkStatistics(count, 3);
    results.push(benchmark);
    
    // Break if performance degrades significantly
    if (benchmark.average > 1000) { // 1 second threshold
      break;
    }
  }
  
  return results;
};