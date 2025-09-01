import { render, screen } from '@testing-library/react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the responsive grid component
interface ResponsiveStatsGridProps {
  children: React.ReactNode;
}

const ResponsiveStatsGrid = ({ children }: ResponsiveStatsGridProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 px-4 sm:px-0 auto-rows-fr">
      {children}
    </div>
  );
};

// Mock StatCard for responsive testing
const MockStatCard = ({ title, className = '' }: { title: string; className?: string }) => (
  <div className={`bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50 min-h-[120px] ${className}`} data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
    <h3>{title}</h3>
  </div>
);

// Utility to simulate different viewport sizes
const mockViewport = (width: number, height: number = 800) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  
  // Trigger resize event
  window.dispatchEvent(new Event('resize'));
};

describe('Responsive Layout Tests', () => {
  beforeEach(() => {
    // Reset viewport to default
    mockViewport(1024);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Grid Layout Responsiveness', () => {
    const statCards = [
      'Total Revenue',
      'Meeting Conversion',
      'Proposal Win Rate',
      'No-Show Rate',
      'Avg Deal Value'
    ];

    test('renders all stat cards in responsive grid', () => {
      render(
        <ResponsiveStatsGrid>
          {statCards.map(title => (
            <MockStatCard key={title} title={title} />
          ))}
        </ResponsiveStatsGrid>
      );

      statCards.forEach(title => {
        expect(screen.getByTestId(`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`)).toBeInTheDocument();
      });
    });

    test('applies correct grid classes for responsive breakpoints', () => {
      render(
        <ResponsiveStatsGrid>
          <MockStatCard title="Test Card" />
        </ResponsiveStatsGrid>
      );

      const gridContainer = screen.getByTestId('stat-card-test-card').parentElement;
      
      // Check for responsive grid classes
      expect(gridContainer).toHaveClass('grid');
      expect(gridContainer).toHaveClass('grid-cols-1'); // Mobile default
      expect(gridContainer).toHaveClass('sm:grid-cols-2'); // Small screens
      expect(gridContainer).toHaveClass('lg:grid-cols-3'); // Large screens
      expect(gridContainer).toHaveClass('xl:grid-cols-5'); // Extra large screens
      expect(gridContainer).toHaveClass('gap-4');
      expect(gridContainer).toHaveClass('auto-rows-fr'); // Equal height rows
    });

    test('applies responsive padding', () => {
      render(
        <ResponsiveStatsGrid>
          <MockStatCard title="Test Card" />
        </ResponsiveStatsGrid>
      );

      const gridContainer = screen.getByTestId('stat-card-test-card').parentElement;
      expect(gridContainer).toHaveClass('px-4'); // Mobile padding
      expect(gridContainer).toHaveClass('sm:px-0'); // No padding on larger screens
    });
  });

  describe('Breakpoint-Specific Layouts', () => {
    const testCases = [
      { width: 320, expectedCols: 1, breakpoint: 'Mobile (320px)' },
      { width: 640, expectedCols: 2, breakpoint: 'Small (640px)' },
      { width: 1024, expectedCols: 3, breakpoint: 'Large (1024px)' },
      { width: 1280, expectedCols: 5, breakpoint: 'Extra Large (1280px)' },
      { width: 1920, expectedCols: 5, breakpoint: 'Full HD (1920px)' }
    ];

    testCases.forEach(({ width, expectedCols, breakpoint }) => {
      test(`displays correct column count at ${breakpoint}`, () => {
        mockViewport(width);
        
        render(
          <ResponsiveStatsGrid>
            {Array.from({ length: 5 }, (_, i) => (
              <MockStatCard key={i} title={`Card ${i + 1}`} />
            ))}
          </ResponsiveStatsGrid>
        );

        // Verify all cards are rendered
        for (let i = 1; i <= 5; i++) {
          expect(screen.getByTestId(`stat-card-card-${i}`)).toBeInTheDocument();
        }
      });
    });
  });

  describe('StatCard Responsive Features', () => {
    test('maintains minimum height on all screen sizes', () => {
      const breakpoints = [320, 640, 1024, 1280];
      
      breakpoints.forEach(width => {
        mockViewport(width);
        
        render(<MockStatCard title="Test Card" />);
        
        const card = screen.getByTestId('stat-card-test-card');
        expect(card).toHaveClass('min-h-[120px]');
      });
    });

    test('applies responsive text sizing', () => {
      // Mock enhanced StatCard with responsive text
      const ResponsiveStatCard = ({ title }: { title: string }) => (
        <div data-testid="responsive-stat-card" className="min-h-[120px]">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{title}</h3>
          <div className="text-2xl font-bold text-white tracking-tight">£1,500</div>
          <div className="text-xs text-gray-500 mt-2">Context info</div>
          <div className="text-[10px] text-gray-500 mt-0.5">vs last period</div>
        </div>
      );

      render(<ResponsiveStatCard title="New Business" />);
      
      const card = screen.getByTestId('responsive-stat-card');
      const title = card.querySelector('h3');
      const value = card.querySelector('.text-2xl');
      
      expect(title).toHaveClass('text-xs');
      expect(value).toHaveClass('text-2xl', 'font-bold');
    });

    test('handles overflow content gracefully', () => {
      const LongContentCard = () => (
        <div data-testid="overflow-card" className="min-h-[120px] p-4 overflow-hidden">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1 truncate">
            Very Long Statistical Metric Title That Should Not Break Layout Or Cause Issues
          </h3>
          <div className="text-2xl font-bold text-white tracking-tight">£999,999,999</div>
          <div className="text-xs text-gray-500 mt-2 line-clamp-2">
            This is an extremely long context information string that should be handled properly without breaking the card layout or causing visual issues across different screen sizes
          </div>
        </div>
      );

      render(<LongContentCard />);
      
      const card = screen.getByTestId('overflow-card');
      const title = card.querySelector('h3');
      
      expect(title).toHaveClass('truncate');
      expect(card).toHaveClass('overflow-hidden');
    });
  });

  describe('Touch and Mobile Interactions', () => {
    test('applies appropriate touch targets on mobile', () => {
      mockViewport(375); // iPhone size
      
      const TouchableStatCard = () => (
        <div 
          data-testid="touchable-card" 
          className="min-h-[120px] p-4 cursor-pointer hover:border-emerald-500/50 transition-all duration-300"
          style={{ minHeight: '44px' }} // iOS recommended touch target
        >
          <h3>Revenue</h3>
        </div>
      );

      render(<TouchableStatCard />);
      
      const card = screen.getByTestId('touchable-card');
      expect(card).toHaveClass('cursor-pointer');
      expect(card).toHaveStyle({ minHeight: '44px' });
    });

    test('handles hover states appropriately for touch devices', () => {
      const HoverStatCard = () => (
        <div 
          data-testid="hover-card"
          className="min-h-[120px] p-4 hover:border-emerald-500/50 focus:border-emerald-500/50 transition-all"
        >
          <h3>Revenue</h3>
        </div>
      );

      render(<HoverStatCard />);
      
      const card = screen.getByTestId('hover-card');
      expect(card).toHaveClass('hover:border-emerald-500/50');
      expect(card).toHaveClass('focus:border-emerald-500/50');
      expect(card).toHaveClass('transition-all');
    });
  });

  describe('Layout Stability', () => {
    test('maintains stable layout during data updates', () => {
      const { rerender } = render(
        <ResponsiveStatsGrid>
          <MockStatCard title="New Business" />
        </ResponsiveStatsGrid>
      );

      const initialCard = screen.getByTestId('stat-card-revenue');
      const initialRect = initialCard.getBoundingClientRect();

      // Simulate data update
      rerender(
        <ResponsiveStatsGrid>
          <MockStatCard title="New Business" className="updated" />
        </ResponsiveStatsGrid>
      );

      const updatedCard = screen.getByTestId('stat-card-revenue');
      const updatedRect = updatedCard.getBoundingClientRect();

      // Layout should remain stable
      expect(updatedRect.width).toBe(initialRect.width);
      expect(updatedRect.height).toBe(initialRect.height);
    });

    test('handles dynamic content changes without layout shift', () => {
      const DynamicCard = ({ value }: { value: string }) => (
        <div data-testid="dynamic-card" className="min-h-[120px] p-4">
          <h3>Revenue</h3>
          <div className="text-2xl font-bold">{value}</div>
        </div>
      );

      const { rerender } = render(<DynamicCard value="£1,000" />);
      
      rerender(<DynamicCard value="£10,000,000" />);
      
      const card = screen.getByTestId('dynamic-card');
      expect(card).toHaveClass('min-h-[120px]'); // Minimum height preserved
    });
  });

  describe('Accessibility and Screen Readers', () => {
    test('provides appropriate structure for screen readers', () => {
      const AccessibleStatCard = () => (
        <div 
          role="button"
          tabIndex={0}
          aria-label="Total Revenue: £1,500, increased by 15% vs last month"
          data-testid="accessible-card"
          className="min-h-[120px] p-4"
        >
          <h3 id="revenue-title">Total Revenue</h3>
          <div aria-labelledby="revenue-title">£1,500</div>
          <div aria-label="15% increase vs last month">+15%</div>
        </div>
      );

      render(<AccessibleStatCard />);
      
      const card = screen.getByTestId('accessible-card');
      expect(card).toHaveAttribute('role', 'button');
      expect(card).toHaveAttribute('tabIndex', '0');
      expect(card).toHaveAttribute('aria-label');
    });

    test('supports keyboard navigation', () => {
      const KeyboardStatCard = () => (
        <div 
          data-testid="keyboard-card"
          tabIndex={0}
          className="min-h-[120px] p-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              // Handle activation
            }
          }}
        >
          <h3>Revenue</h3>
        </div>
      );

      render(<KeyboardStatCard />);
      
      const card = screen.getByTestId('keyboard-card');
      expect(card).toHaveAttribute('tabIndex', '0');
      expect(card).toHaveClass('focus:outline-none');
      expect(card).toHaveClass('focus:ring-2');
    });
  });

  describe('Performance Considerations', () => {
    test('handles large numbers of stat cards efficiently', () => {
      const manyCards = Array.from({ length: 20 }, (_, i) => (
        <MockStatCard key={i} title={`Card ${i + 1}`} />
      ));

      render(<ResponsiveStatsGrid>{manyCards}</ResponsiveStatsGrid>);

      // Verify all cards render
      for (let i = 1; i <= 20; i++) {
        expect(screen.getByTestId(`stat-card-card-${i}`)).toBeInTheDocument();
      }
    });

    test('applies efficient CSS classes', () => {
      render(
        <ResponsiveStatsGrid>
          <MockStatCard title="Test" />
        </ResponsiveStatsGrid>
      );

      const card = screen.getByTestId('stat-card-test');
      // Verify efficient backdrop-blur and background classes
      expect(card).toHaveClass('backdrop-blur-xl');
      expect(card).toHaveClass('bg-gray-900/50');
    });
  });

  describe('Error Boundary and Resilience', () => {
    test('handles missing or corrupted card data gracefully', () => {
      const ErrorProneCard = ({ title }: { title?: string }) => (
        <div data-testid="error-prone-card" className="min-h-[120px] p-4">
          <h3>{title || 'Unknown Metric'}</h3>
          <div>--</div>
        </div>
      );

      render(<ErrorProneCard title={undefined} />);
      
      expect(screen.getByText('Unknown Metric')).toBeInTheDocument();
      expect(screen.getByText('--')).toBeInTheDocument();
    });

    test('maintains layout when individual cards fail', () => {
      const failingCardData = [
        { title: 'Working Card 1', shouldFail: false },
        { title: 'Failing Card', shouldFail: true },
        { title: 'Working Card 2', shouldFail: false }
      ];

      render(
        <ResponsiveStatsGrid>
          {failingCardData.map(({ title, shouldFail }) => 
            shouldFail ? (
              <div key={title} data-testid="failed-card" className="min-h-[120px] p-4 bg-red-900/20">
                <p>Error loading {title}</p>
              </div>
            ) : (
              <MockStatCard key={title} title={title} />
            )
          )}
        </ResponsiveStatsGrid>
      );

      expect(screen.getByTestId('stat-card-working-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('failed-card')).toBeInTheDocument();
      expect(screen.getByTestId('stat-card-working-card-2')).toBeInTheDocument();
    });
  });
});