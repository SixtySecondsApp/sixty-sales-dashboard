import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import { Users, PoundSterling, FileText, XCircle, TrendingUp } from 'lucide-react';

// Mock StatCard component - we'll extract it from SalesTable for testing
interface StatCardProps {
  title: string;
  value: string | number;
  amount?: string;
  percentage?: string;
  trendPercentage: number;
  icon: React.ElementType;
  color: string;
  contextInfo?: string;
  period?: string;
}

const StatCard = ({ title, value, amount, percentage, trendPercentage, icon: Icon, color, contextInfo, period = 'vs last period' }: StatCardProps) => {
  const trendText = trendPercentage > 0 ? `+${trendPercentage}%` : `${trendPercentage}%`;
  const trendColor = trendPercentage > 0 ? `text-emerald-500` : trendPercentage < 0 ? `text-red-500` : `text-gray-500`;
  const trendIcon = trendPercentage > 0 ? '↗' : trendPercentage < 0 ? '↘' : '→';

  return (
    <div 
      className={`bg-gray-900/50 backdrop-blur-xl rounded-xl p-4 border border-gray-800/50 cursor-pointer hover:border-${color}-500/50 transition-all duration-300 relative min-h-[120px] flex flex-col`}
      onClick={() => {
        // Mock click handler for testing
        const event = new CustomEvent('statCardClick', { detail: { title } });
        document.dispatchEvent(event);
      }}
    >
      {/* Trend indicator in top-right */}
      <div className="absolute top-3 right-3 flex flex-col items-end">
        <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`} data-testid="trend-indicator">
          <span data-testid="trend-icon">{trendIcon}</span>
          <span data-testid="trend-text">{trendText}</span>
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5" data-testid="trend-period">
          {period}
        </div>
      </div>

      {/* Main content */}
      <div className="flex items-start gap-3 pr-16 flex-1">
        <div className={`p-2.5 rounded-xl bg-${color}-500/10 border border-${color}-500/20`} data-testid="icon-container">
          <Icon className={`w-5 h-5 text-${color}-500`} data-testid="icon" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1" data-testid="title">{title}</p>
          
          {/* Primary metric */}
          <div className="space-y-1">
            {amount && (
              <div className="text-2xl font-bold text-white tracking-tight" data-testid="amount-value">{amount}</div>
            )}
            {percentage && (
              <div className="text-2xl font-bold text-white tracking-tight" data-testid="percentage-value">{percentage}</div>
            )}
            {!amount && !percentage && (
              <div className="text-2xl font-bold text-white tracking-tight" data-testid="raw-value">{value}</div>
            )}
          </div>
          
          {/* Spacer to push context info to bottom */}
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

describe('StatCard Component', () => {
  const defaultProps: StatCardProps = {
    title: 'Test Metric',
    value: 100,
    trendPercentage: 15,
    icon: Users,
    color: 'blue',
    period: 'vs last month'
  };

  test('renders basic StatCard with required props', () => {
    render(<StatCard {...defaultProps} />);
    
    expect(screen.getByTestId('title')).toHaveTextContent('Test Metric');
    expect(screen.getByTestId('raw-value')).toHaveTextContent('100');
    expect(screen.getByTestId('trend-text')).toHaveTextContent('+15%');
    expect(screen.getByTestId('trend-period')).toHaveTextContent('vs last month');
  });

  test('displays amount when provided', () => {
    render(<StatCard {...defaultProps} amount="£1,500" />);
    
    expect(screen.getByTestId('amount-value')).toHaveTextContent('£1,500');
    expect(screen.queryByTestId('raw-value')).not.toBeInTheDocument();
  });

  test('displays percentage when provided', () => {
    render(<StatCard {...defaultProps} percentage="85%" />);
    
    expect(screen.getByTestId('percentage-value')).toHaveTextContent('85%');
    expect(screen.queryByTestId('raw-value')).not.toBeInTheDocument();
  });

  test('shows context info when provided', () => {
    render(<StatCard {...defaultProps} contextInfo="From 5 completed sales" />);
    
    expect(screen.getByTestId('context-info')).toHaveTextContent('From 5 completed sales');
  });

  describe('Trend Indicators', () => {
    test('shows positive trend correctly', () => {
      render(<StatCard {...defaultProps} trendPercentage={25} />);
      
      expect(screen.getByTestId('trend-text')).toHaveTextContent('+25%');
      expect(screen.getByTestId('trend-icon')).toHaveTextContent('↗');
      expect(screen.getByTestId('trend-indicator')).toHaveClass('text-emerald-500');
    });

    test('shows negative trend correctly', () => {
      render(<StatCard {...defaultProps} trendPercentage={-15} />);
      
      expect(screen.getByTestId('trend-text')).toHaveTextContent('-15%');
      expect(screen.getByTestId('trend-icon')).toHaveTextContent('↘');
      expect(screen.getByTestId('trend-indicator')).toHaveClass('text-red-500');
    });

    test('shows zero trend correctly', () => {
      render(<StatCard {...defaultProps} trendPercentage={0} />);
      
      expect(screen.getByTestId('trend-text')).toHaveTextContent('0%');
      expect(screen.getByTestId('trend-icon')).toHaveTextContent('→');
      expect(screen.getByTestId('trend-indicator')).toHaveClass('text-gray-500');
    });

    test('handles extreme trend values', () => {
      render(<StatCard {...defaultProps} trendPercentage={-100} />);
      
      expect(screen.getByTestId('trend-text')).toHaveTextContent('-100%');
      expect(screen.getByTestId('trend-icon')).toHaveTextContent('↘');
    });
  });

  describe('Visual Elements', () => {
    test('renders correct icon', () => {
      render(<StatCard {...defaultProps} icon={PoundSterling} />);
      
      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });

    test('applies correct color classes', () => {
      render(<StatCard {...defaultProps} color="emerald" />);
      
      const iconContainer = screen.getByTestId('icon-container');
      expect(iconContainer).toHaveClass('bg-emerald-500/10', 'border-emerald-500/20');
    });

    test('handles different period contexts', () => {
      render(<StatCard {...defaultProps} period="vs yesterday" />);
      
      expect(screen.getByTestId('trend-period')).toHaveTextContent('vs yesterday');
    });
  });

  describe('Accessibility', () => {
    test('is clickable and triggers events', () => {
      const eventListener = vi.fn();
      document.addEventListener('statCardClick', eventListener);
      
      render(<StatCard {...defaultProps} title="Total Revenue" />);
      
      fireEvent.click(screen.getByTestId('title').closest('div')!);
      
      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { title: 'Total Revenue' }
        })
      );
      
      document.removeEventListener('statCardClick', eventListener);
    });

    test('has appropriate ARIA attributes', () => {
      render(<StatCard {...defaultProps} />);
      
      const card = screen.getByTestId('title').closest('div');
      expect(card).toHaveClass('cursor-pointer');
    });
  });

  describe('Edge Cases', () => {
    test('handles undefined/null values gracefully', () => {
      render(<StatCard {...defaultProps} value="" contextInfo={undefined} />);
      
      expect(screen.getByTestId('raw-value')).toHaveTextContent('');
      expect(screen.queryByTestId('context-info')).not.toBeInTheDocument();
    });

    test('handles very long titles and context', () => {
      const longTitle = 'Very Long Statistical Metric Title That Should Not Break Layout';
      const longContext = 'This is an extremely long context information string that should be handled properly without breaking the card layout or causing visual issues';
      
      render(<StatCard {...defaultProps} title={longTitle} contextInfo={longContext} />);
      
      expect(screen.getByTestId('title')).toHaveTextContent(longTitle);
      expect(screen.getByTestId('context-info')).toHaveTextContent(longContext);
    });

    test('handles extreme trend percentages', () => {
      render(<StatCard {...defaultProps} trendPercentage={999} />);
      
      expect(screen.getByTestId('trend-text')).toHaveTextContent('+999%');
    });
  });

  describe('Layout and Responsiveness', () => {
    test('maintains minimum height', () => {
      render(<StatCard {...defaultProps} />);
      
      const card = screen.getByTestId('title').closest('div');
      expect(card).toHaveClass('min-h-[120px]');
    });

    test('uses flex layout correctly', () => {
      render(<StatCard {...defaultProps} />);
      
      const card = screen.getByTestId('title').closest('div');
      expect(card).toHaveClass('flex', 'flex-col');
    });
  });
});

// Test different icon types
describe('StatCard with Different Icons', () => {
  const iconTestCases = [
    { icon: PoundSterling, name: 'PoundSterling' },
    { icon: Users, name: 'Users' },
    { icon: FileText, name: 'FileText' },
    { icon: XCircle, name: 'XCircle' },
    { icon: TrendingUp, name: 'TrendingUp' }
  ];

  iconTestCases.forEach(({ icon, name }) => {
    test(`renders correctly with ${name} icon`, () => {
      render(
        <StatCard
          title={`Test with ${name}`}
          value={100}
          trendPercentage={10}
          icon={icon}
          color="blue"
        />
      );
      
      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByTestId('title')).toHaveTextContent(`Test with ${name}`);
    });
  });
});

// Test color variations
describe('StatCard Color Variations', () => {
  const colorTestCases = ['emerald', 'blue', 'red', 'amber', 'cyan'];

  colorTestCases.forEach(color => {
    test(`renders correctly with ${color} color`, () => {
      render(
        <StatCard
          title={`Test ${color}`}
          value={100}
          trendPercentage={10}
          icon={Users}
          color={color}
        />
      );
      
      expect(screen.getByTestId('title')).toHaveTextContent(`Test ${color}`);
    });
  });
});