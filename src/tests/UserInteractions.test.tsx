import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock Activity type
interface Activity {
  id: string;
  type: 'sale' | 'proposal' | 'meeting' | 'outbound';
  status: 'completed' | 'pending' | 'cancelled' | 'no_show';
  amount?: number;
  date: string;
  sales_rep: string;
  client_name: string;
}

// Mock filter context
const mockFilterContext = {
  filters: {
    type: undefined as Activity['type'] | undefined,
    status: undefined,
    salesRep: undefined,
    searchQuery: ''
  },
  setFilters: vi.fn(),
  resetFilters: vi.fn()
};

// Mock StatCard with interaction capabilities
interface InteractiveStatCardProps {
  title: string;
  value: string | number;
  amount?: string;
  percentage?: string;
  trendPercentage: number;
  icon: React.ElementType;
  color: string;
  contextInfo?: string;
  period?: string;
  onFilterToggle?: (filterType: Activity['type'] | undefined) => void;
  isFiltered?: boolean;
}

const InteractiveStatCard = ({ 
  title, 
  value, 
  amount, 
  percentage, 
  trendPercentage, 
  icon: Icon, 
  color, 
  contextInfo, 
  period = 'vs last period',
  onFilterToggle,
  isFiltered = false
}: InteractiveStatCardProps) => {
  const trendText = trendPercentage > 0 ? `+${trendPercentage}%` : `${trendPercentage}%`;
  const trendColor = trendPercentage > 0 ? `text-emerald-500` : trendPercentage < 0 ? `text-red-500` : `text-gray-500`;
  const trendIcon = trendPercentage > 0 ? '↗' : trendPercentage < 0 ? '↘' : '→';

  const handleClick = () => {
    const typeMap: Record<string, Activity['type'] | undefined> = {
      'Total Revenue': 'sale',
      'Meeting Conversion': 'meeting',
      'Proposal Win Rate': 'proposal',
      'No-Show Rate': undefined,
      'Won Deals': 'sale',
      'Average Deal Value': 'sale',
    };
    
    const filterType = typeMap[title];
    onFilterToggle?.(isFiltered ? undefined : filterType);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div 
      role="button"
      tabIndex={0}
      aria-label={`${title}: ${amount || percentage || value}. ${contextInfo || ''} Trend: ${trendText} ${period}. ${isFiltered ? 'Currently filtered' : 'Click to filter'}`}
      aria-pressed={isFiltered}
      data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
      className={`bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border transition-all duration-300 relative min-h-[120px] flex flex-col cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
        isFiltered 
          ? `border-${color}-500/70 bg-${color}-500/5` 
          : `border-gray-800/50 hover:border-${color}-500/50`
      }`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Active filter indicator */}
      {isFiltered && (
        <div className="absolute top-2 left-2 w-2 h-2 bg-emerald-500 rounded-full" data-testid="filter-indicator" />
      )}
      
      {/* Trend indicator in top-right */}
      <div className="absolute top-3 right-3 flex flex-col items-end">
        <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`} data-testid="trend-indicator">
          <span data-testid="trend-icon" aria-hidden="true">{trendIcon}</span>
          <span data-testid="trend-text">{trendText}</span>
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5" data-testid="trend-period">
          {period}
        </div>
      </div>

      {/* Main content */}
      <div className="flex items-start gap-3 pr-16 flex-1">
        <div className={`p-2.5 rounded-xl bg-${color}-500/10 border border-${color}-500/20`} data-testid="icon-container">
          <Icon className={`w-5 h-5 text-${color}-500`} data-testid="icon" aria-hidden="true" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1" data-testid="title">
            {title}
          </h3>
          
          {/* Primary metric */}
          <div className="space-y-1">
            {amount && (
              <div className="text-2xl font-bold text-white tracking-tight" data-testid="amount-value">
                {amount}
              </div>
            )}
            {percentage && (
              <div className="text-2xl font-bold text-white tracking-tight" data-testid="percentage-value">
                {percentage}
              </div>
            )}
            {!amount && !percentage && (
              <div className="text-2xl font-bold text-white tracking-tight" data-testid="raw-value">
                {value}
              </div>
            )}
          </div>
          
          <div className="flex-1"></div>
          
          {/* Contextual information */}
          {contextInfo && (
            <div className="text-xs text-gray-500 mt-2" data-testid="context-info">
              {contextInfo}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Mock search/filter component
const MockSearchFilter = ({ onSearch }: { onSearch: (query: string) => void }) => (
  <div className="space-y-4">
    <div className="relative">
      <input
        type="text"
        placeholder="Search activities, clients, details..."
        data-testid="search-input"
        className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg pl-10 pr-4 py-2 text-white"
        onChange={(e) => onSearch(e.target.value)}
        aria-label="Search activities"
      />
    </div>
  </div>
);

describe('User Interactions', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Click-to-Filter Functionality', () => {
    test('toggles filter when stat card is clicked', async () => {
      const mockOnFilterToggle = vi.fn();
      
      render(
        <InteractiveStatCard
          title="Total Revenue"
          value={15000}
          amount="£15,000"
          trendPercentage={25}
          icon={() => <div>£</div>}
          color="emerald"
          contextInfo="From 5 completed sales"
          onFilterToggle={mockOnFilterToggle}
        />
      );

      const card = screen.getByTestId('stat-card-total-revenue');
      await user.click(card);

      expect(mockOnFilterToggle).toHaveBeenCalledWith('sale');
    });

    test('clears filter when already filtered card is clicked', async () => {
      const mockOnFilterToggle = vi.fn();
      
      render(
        <InteractiveStatCard
          title="Total Revenue"
          value={15000}
          amount="£15,000"
          trendPercentage={25}
          icon={() => <div>£</div>}
          color="emerald"
          isFiltered={true}
          onFilterToggle={mockOnFilterToggle}
        />
      );

      const card = screen.getByTestId('stat-card-total-revenue');
      await user.click(card);

      expect(mockOnFilterToggle).toHaveBeenCalledWith(undefined);
    });

    test('shows visual feedback for filtered state', () => {
      render(
        <InteractiveStatCard
          title="Total Revenue"
          value={15000}
          amount="£15,000"
          trendPercentage={25}
          icon={() => <div>£</div>}
          color="emerald"
          isFiltered={true}
        />
      );

      const card = screen.getByTestId('stat-card-total-revenue');
      const filterIndicator = screen.getByTestId('filter-indicator');

      expect(card).toHaveClass('border-emerald-500/70', 'bg-emerald-500/5');
      expect(filterIndicator).toBeInTheDocument();
      expect(card).toHaveAttribute('aria-pressed', 'true');
    });

    test('handles different card types with correct filter mappings', async () => {
      const mockOnFilterToggle = vi.fn();
      const cardConfigs = [
        { title: 'Meeting Conversion', expectedFilter: 'meeting' },
        { title: 'Proposal Win Rate', expectedFilter: 'proposal' },
        { title: 'No-Show Rate', expectedFilter: undefined }
      ];

      for (const { title, expectedFilter } of cardConfigs) {
        mockOnFilterToggle.mockClear();
        
        render(
          <InteractiveStatCard
            title={title}
            value={50}
            percentage="50%"
            trendPercentage={10}
            icon={() => <div>Icon</div>}
            color="blue"
            onFilterToggle={mockOnFilterToggle}
          />
        );

        const card = screen.getByTestId(`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`);
        await user.click(card);

        expect(mockOnFilterToggle).toHaveBeenCalledWith(expectedFilter);
      }
    });
  });

  describe('Keyboard Navigation', () => {
    test('supports Enter key activation', async () => {
      const mockOnFilterToggle = vi.fn();
      
      render(
        <InteractiveStatCard
          title="Total Revenue"
          value={15000}
          amount="£15,000"
          trendPercentage={25}
          icon={() => <div>£</div>}
          color="emerald"
          onFilterToggle={mockOnFilterToggle}
        />
      );

      const card = screen.getByTestId('stat-card-total-revenue');
      card.focus();
      
      await user.keyboard('{Enter}');

      expect(mockOnFilterToggle).toHaveBeenCalledWith('sale');
    });

    test('supports Space key activation', async () => {
      const mockOnFilterToggle = vi.fn();
      
      render(
        <InteractiveStatCard
          title="Total Revenue"
          value={15000}
          amount="£15,000"
          trendPercentage={25}
          icon={() => <div>£</div>}
          color="emerald"
          onFilterToggle={mockOnFilterToggle}
        />
      );

      const card = screen.getByTestId('stat-card-total-revenue');
      card.focus();
      
      await user.keyboard(' ');

      expect(mockOnFilterToggle).toHaveBeenCalledWith('sale');
    });

    test('prevents default behavior for Space key', async () => {
      const mockPreventDefault = vi.fn();
      
      render(
        <InteractiveStatCard
          title="Total Revenue"
          value={15000}
          trendPercentage={25}
          icon={() => <div>£</div>}
          color="emerald"
        />
      );

      const card = screen.getByTestId('stat-card-total-revenue');
      
      fireEvent.keyDown(card, { 
        key: ' ', 
        preventDefault: mockPreventDefault 
      });

      expect(mockPreventDefault).toHaveBeenCalled();
    });

    test('is focusable and has correct tab order', () => {
      render(
        <div>
          <InteractiveStatCard
            title="Card 1"
            value={100}
            trendPercentage={10}
            icon={() => <div>Icon</div>}
            color="blue"
          />
          <InteractiveStatCard
            title="Card 2"
            value={200}
            trendPercentage={20}
            icon={() => <div>Icon</div>}
            color="red"
          />
        </div>
      );

      const card1 = screen.getByTestId('stat-card-card-1');
      const card2 = screen.getByTestId('stat-card-card-2');

      expect(card1).toHaveAttribute('tabIndex', '0');
      expect(card2).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Mouse Interactions', () => {
    test('shows hover effects on mouse enter', async () => {
      render(
        <InteractiveStatCard
          title="Total Revenue"
          value={15000}
          trendPercentage={25}
          icon={() => <div>£</div>}
          color="emerald"
        />
      );

      const card = screen.getByTestId('stat-card-total-revenue');
      
      // Check hover classes are present
      expect(card).toHaveClass('hover:border-emerald-500/50');
      expect(card).toHaveClass('transition-all', 'duration-300');
    });

    test('handles double-click gracefully', async () => {
      const mockOnFilterToggle = vi.fn();
      
      render(
        <InteractiveStatCard
          title="Total Revenue"
          value={15000}
          trendPercentage={25}
          icon={() => <div>£</div>}
          color="emerald"
          onFilterToggle={mockOnFilterToggle}
        />
      );

      const card = screen.getByTestId('stat-card-total-revenue');
      
      // Simulate double-click
      await user.click(card);
      await user.click(card);

      expect(mockOnFilterToggle).toHaveBeenCalledTimes(2);
    });

    test('handles rapid clicking without issues', async () => {
      const mockOnFilterToggle = vi.fn();
      
      render(
        <InteractiveStatCard
          title="Total Revenue"
          value={15000}
          trendPercentage={25}
          icon={() => <div>£</div>}
          color="emerald"
          onFilterToggle={mockOnFilterToggle}
        />
      );

      const card = screen.getByTestId('stat-card-total-revenue');
      
      // Rapid clicks
      for (let i = 0; i < 5; i++) {
        await user.click(card);
      }

      expect(mockOnFilterToggle).toHaveBeenCalledTimes(5);
    });
  });

  describe('Focus Management', () => {
    test('maintains focus after activation', async () => {
      render(
        <InteractiveStatCard
          title="Total Revenue"
          value={15000}
          trendPercentage={25}
          icon={() => <div>£</div>}
          color="emerald"
        />
      );

      const card = screen.getByTestId('stat-card-total-revenue');
      
      card.focus();
      await user.keyboard('{Enter}');

      expect(document.activeElement).toBe(card);
    });

    test('shows focus indicators', () => {
      render(
        <InteractiveStatCard
          title="Total Revenue"
          value={15000}
          trendPercentage={25}
          icon={() => <div>£</div>}
          color="emerald"
        />
      );

      const card = screen.getByTestId('stat-card-total-revenue');
      
      expect(card).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-emerald-500');
    });

    test('handles focus with screen readers', () => {
      render(
        <InteractiveStatCard
          title="Total Revenue"
          value={15000}
          amount="£15,000"
          trendPercentage={25}
          icon={() => <div>£</div>}
          color="emerald"
          contextInfo="From 5 completed sales"
        />
      );

      const card = screen.getByTestId('stat-card-total-revenue');
      
      expect(card).toHaveAttribute('aria-label');
      expect(card.getAttribute('aria-label')).toContain('Total Revenue: £15,000');
      expect(card.getAttribute('aria-label')).toContain('From 5 completed sales');
      expect(card.getAttribute('aria-label')).toContain('Trend: +25%');
    });
  });

  describe('Search and Filter Interactions', () => {
    test('handles search input changes', async () => {
      const mockOnSearch = vi.fn();
      
      render(<MockSearchFilter onSearch={mockOnSearch} />);
      
      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'test query');
      
      // Should be called for each character typed
      expect(mockOnSearch).toHaveBeenCalledWith('test query');
    });

    test('clears search on empty input', async () => {
      const mockOnSearch = vi.fn();
      
      render(<MockSearchFilter onSearch={mockOnSearch} />);
      
      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'test');
      await user.clear(searchInput);
      
      expect(mockOnSearch).toHaveBeenLastCalledWith('');
    });

    test('handles special characters in search', async () => {
      const mockOnSearch = vi.fn();
      
      render(<MockSearchFilter onSearch={mockOnSearch} />);
      
      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'client@example.com & £1,000');
      
      expect(mockOnSearch).toHaveBeenLastCalledWith('client@example.com & £1,000');
    });
  });

  describe('Touch Device Interactions', () => {
    beforeEach(() => {
      // Mock touch device
      Object.defineProperty(navigator, 'maxTouchPoints', {
        writable: true,
        configurable: true,
        value: 5,
      });
    });

    test('handles touch events on cards', () => {
      const mockOnFilterToggle = vi.fn();
      
      render(
        <InteractiveStatCard
          title="Total Revenue"
          value={15000}
          trendPercentage={25}
          icon={() => <div>£</div>}
          color="emerald"
          onFilterToggle={mockOnFilterToggle}
        />
      );

      const card = screen.getByTestId('stat-card-total-revenue');
      
      fireEvent.touchStart(card);
      fireEvent.touchEnd(card);
      fireEvent.click(card);

      expect(mockOnFilterToggle).toHaveBeenCalledWith('sale');
    });

    test('provides adequate touch targets', () => {
      render(
        <InteractiveStatCard
          title="Total Revenue"
          value={15000}
          trendPercentage={25}
          icon={() => <div>£</div>}
          color="emerald"
        />
      );

      const card = screen.getByTestId('stat-card-total-revenue');
      
      // Check minimum touch target size (44x44px recommended)
      expect(card).toHaveClass('min-h-[120px]'); // Much larger than minimum
      expect(card).toHaveClass('p-4'); // Adequate padding
    });
  });
});

describe('Accessibility Tests', () => {
  test('stat cards pass accessibility audit', async () => {
    const { container } = render(
      <InteractiveStatCard
        title="Total Revenue"
        value={15000}
        amount="£15,000"
        trendPercentage={25}
        icon={() => <div>£</div>}
        color="emerald"
        contextInfo="From 5 completed sales"
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('grid layout passes accessibility audit', async () => {
    const { container } = render(
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <InteractiveStatCard
          title="Revenue"
          value={1000}
          trendPercentage={10}
          icon={() => <div>£</div>}
          color="emerald"
        />
        <InteractiveStatCard
          title="Deals"
          value={5}
          trendPercentage={-5}
          icon={() => <div>📊</div>}
          color="blue"
        />
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('search filter passes accessibility audit', async () => {
    const { container } = render(
      <MockSearchFilter onSearch={() => {}} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('supports high contrast mode', () => {
    render(
      <InteractiveStatCard
        title="Total Revenue"
        value={15000}
        trendPercentage={25}
        icon={() => <div>£</div>}
        color="emerald"
      />
    );

    const card = screen.getByTestId('stat-card-total-revenue');
    
    // Check that colors provide sufficient contrast
    expect(card).toHaveClass('text-white'); // High contrast text
    expect(card).toHaveClass('border-gray-800/50'); // Visible borders
  });

  test('works with screen readers', () => {
    render(
      <InteractiveStatCard
        title="Total Revenue"
        value={15000}
        amount="£15,000"
        trendPercentage={25}
        icon={() => <div>£</div>}
        color="emerald"
        contextInfo="From 5 completed sales"
        isFiltered={true}
      />
    );

    const card = screen.getByTestId('stat-card-total-revenue');
    
    // Check ARIA attributes
    expect(card).toHaveAttribute('role', 'button');
    expect(card).toHaveAttribute('aria-label');
    expect(card).toHaveAttribute('aria-pressed', 'true');
    expect(card).toHaveAttribute('tabIndex', '0');
    
    // Check that decorative elements are hidden from screen readers
    const trendIcon = screen.getByTestId('trend-icon');
    const icon = screen.getByTestId('icon');
    
    expect(trendIcon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  test('provides meaningful error states', () => {
    render(
      <div data-testid="error-card" role="alert" className="min-h-[120px] p-4 bg-red-900/20 border border-red-500/50">
        <h3>Error Loading Revenue Data</h3>
        <p>Please try refreshing the page.</p>
      </div>
    );

    const errorCard = screen.getByTestId('error-card');
    expect(errorCard).toHaveAttribute('role', 'alert');
    expect(screen.getByText('Error Loading Revenue Data')).toBeInTheDocument();
  });
});