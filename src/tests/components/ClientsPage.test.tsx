import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import ClientsPage from '@/pages/Clients';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock child components
vi.mock('@/components/AggregatedClientsTable', () => ({
  AggregatedClientsTable: ({ className }: any) => (
    <div data-testid="aggregated-clients-table" className={className}>
      Mock Aggregated Clients Table
    </div>
  ),
}));

vi.mock('@/components/PaymentsTable', () => ({
  PaymentsTable: ({ className }: any) => (
    <div data-testid="payments-table" className={className}>
      Mock Payments Table
    </div>
  ),
}));

vi.mock('@/components/SubscriptionStats', () => ({
  SubscriptionStats: ({ onClick, className }: any) => (
    <div data-testid="subscription-stats" className={className}>
      <div data-testid="stats-card" onClick={() => onClick?.('Test Card')}>
        Mock Subscription Stats
      </div>
    </div>
  ),
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  BarChart3: ({ className }: any) => <div data-testid="bar-chart-icon" className={className} />,
  List: ({ className }: any) => <div data-testid="list-icon" className={className} />,
  TrendingUp: ({ className }: any) => <div data-testid="trending-up-icon" className={className} />,
  Users: ({ className }: any) => <div data-testid="users-icon" className={className} />,
}));

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('ClientsPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the page header correctly', () => {
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    expect(screen.getByRole('heading', { name: 'Client & Payment Management' })).toBeInTheDocument();
  });

  it('should render view mode toggle buttons', () => {
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    expect(screen.getByRole('button', { name: /client overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /payment records/i })).toBeInTheDocument();
  });

  it('should start with aggregated view by default', () => {
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    expect(screen.getByText(/aggregated view of unique clients/i)).toBeInTheDocument();
    expect(screen.getByTestId('aggregated-clients-table')).toBeInTheDocument();
    expect(screen.queryByTestId('payments-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('subscription-stats')).not.toBeInTheDocument();
  });

  it('should switch to detailed view when Deal Details button is clicked', async () => {
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    const dealDetailsButton = screen.getByRole('button', { name: /payment records/i });
    fireEvent.click(dealDetailsButton);

    await waitFor(() => {
      expect(screen.getByText(/detailed payment records with revenue tracking and individual deal management/i)).toBeInTheDocument();
      expect(screen.getByTestId('payments-table')).toBeInTheDocument();
      expect(screen.getByTestId('subscription-stats')).toBeInTheDocument();
      expect(screen.queryByTestId('aggregated-clients-table')).not.toBeInTheDocument();
    });
  });

  it('should switch back to aggregated view when Client Overview button is clicked', async () => {
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    // Switch to detailed view first
    const dealDetailsButton = screen.getByRole('button', { name: /payment records/i });
    fireEvent.click(dealDetailsButton);

    await waitFor(() => {
      expect(screen.getByTestId('payments-table')).toBeInTheDocument();
    });

    // Switch back to aggregated view
    const clientOverviewButton = screen.getByRole('button', { name: /client overview/i });
    fireEvent.click(clientOverviewButton);

    await waitFor(() => {
      expect(screen.getByText(/aggregated view of unique clients/i)).toBeInTheDocument();
      expect(screen.getByTestId('aggregated-clients-table')).toBeInTheDocument();
      expect(screen.queryByTestId('payments-table')).not.toBeInTheDocument();
    });
  });

  it('should display correct descriptions for each view mode', async () => {
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    // Check aggregated view description
    expect(screen.getByText(/aggregated view of unique clients with totals and metrics/i)).toBeInTheDocument();

    // Switch to detailed view
    const dealDetailsButton = screen.getByRole('button', { name: /payment records/i });
    fireEvent.click(dealDetailsButton);

    await waitFor(() => {
      expect(screen.getByText(/detailed payment records with revenue tracking and individual deal management/i)).toBeInTheDocument();
    });
  });

  it('should highlight the active view mode button', () => {
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    const clientOverviewButton = screen.getByRole('button', { name: /client overview/i });
    const dealDetailsButton = screen.getByRole('button', { name: /payment records/i });

    // Client Overview should be active by default
    expect(clientOverviewButton).toHaveClass('bg-emerald-500');
    expect(dealDetailsButton).not.toHaveClass('bg-emerald-500');
  });

  it('should update button styles when switching views', async () => {
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    const clientOverviewButton = screen.getByRole('button', { name: /client overview/i });
    const dealDetailsButton = screen.getByRole('button', { name: /payment records/i });

    // Switch to detailed view
    fireEvent.click(dealDetailsButton);

    await waitFor(() => {
      expect(dealDetailsButton).toHaveClass('bg-emerald-500');
      expect(clientOverviewButton).not.toHaveClass('bg-emerald-500');
    });
  });

  it('should render icons in the toggle buttons', () => {
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    expect(screen.getAllByTestId('bar-chart-icon')).toHaveLength(2); // One in button, one in description
    expect(screen.getByTestId('list-icon')).toBeInTheDocument();
  });

  it('should render description cards with proper icons', () => {
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    // Should show bar chart icon for aggregated view by default
    const descriptionArea = screen.getByText(/client overview mode/i).closest('div');
    expect(descriptionArea).toBeInTheDocument();
  });

  it('should handle rapid view switching without errors', async () => {
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    const clientOverviewButton = screen.getByRole('button', { name: /client overview/i });
    const dealDetailsButton = screen.getByRole('button', { name: /payment records/i });

    // Rapid switching
    fireEvent.click(dealDetailsButton);
    fireEvent.click(clientOverviewButton);
    fireEvent.click(dealDetailsButton);
    fireEvent.click(clientOverviewButton);

    await waitFor(() => {
      expect(screen.getByTestId('aggregated-clients-table')).toBeInTheDocument();
      expect(screen.queryByTestId('payments-table')).not.toBeInTheDocument();
    });
  });

  it('should maintain proper layout structure', () => {
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    // Check for main container with proper classes
    const mainContainer = screen.getByText('Client & Payment Management').closest('.space-y-8');
    expect(mainContainer).toBeInTheDocument();

    // Check for responsive classes on the root container
    const rootContainer = mainContainer?.closest('.min-h-screen');
    expect(rootContainer).toHaveClass('p-4', 'sm:p-6', 'lg:p-8');
  });

  it('should have proper semantic structure', () => {
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    // Check for proper heading hierarchy
    const h1 = screen.getByRole('heading', { level: 1 });
    const h3 = screen.getByRole('heading', { level: 3 });
    
    expect(h1).toHaveTextContent('Client & Payment Management');
    expect(h3).toHaveTextContent('Client Overview Mode');
  });

  it('should pass correct props to table components', () => {
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    const aggregatedTable = screen.getByTestId('aggregated-clients-table');
    expect(aggregatedTable).toHaveClass('w-full');
  });

  it('should render without crashing on component unmount', () => {
    const { unmount } = render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    expect(screen.getByRole('heading', { name: 'Client & Payment Management' })).toBeInTheDocument();
    
    // Should unmount without errors
    expect(() => unmount()).not.toThrow();
  });

  it('should maintain accessibility standards', () => {
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    // Check for proper button roles
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);

    // Check for proper heading structure
    const headings = screen.getAllByRole('heading');
    expect(headings.length).toBeGreaterThan(0);
  });

  it('should handle keyboard navigation for toggle buttons', () => {
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    const dealDetailsButton = screen.getByRole('button', { name: /payment records/i });
    
    // Focus and activate with keyboard
    dealDetailsButton.focus();
    fireEvent.keyDown(dealDetailsButton, { key: 'Enter' });

    // Should work the same as click
    expect(dealDetailsButton).toHaveFocus();
  });

  it('should display appropriate content in description cards', async () => {
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    // Check aggregated view description
    expect(screen.getByText(/shows unique clients with aggregated data/i)).toBeInTheDocument();
    expect(screen.getByText(/perfect for high-level client relationship management/i)).toBeInTheDocument();

    // Switch to detailed view
    const dealDetailsButton = screen.getByRole('button', { name: /payment records/i });
    fireEvent.click(dealDetailsButton);

    await waitFor(() => {
      expect(screen.getByText(/shows individual payment records and deals/i)).toBeInTheDocument();
      expect(screen.getByText(/includes subscription management/i)).toBeInTheDocument();
    });
  });

  it('should show revenue overview section only in payment records mode', async () => {
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    // Should not show revenue overview in aggregated view
    expect(screen.queryByText(/revenue overview/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('subscription-stats')).not.toBeInTheDocument();

    // Switch to payment records view
    const paymentRecordsButton = screen.getByRole('button', { name: /payment records/i });
    fireEvent.click(paymentRecordsButton);

    // Should show revenue overview in payment records view
    await waitFor(() => {
      expect(screen.getByText(/revenue overview/i)).toBeInTheDocument();
      expect(screen.getByTestId('subscription-stats')).toBeInTheDocument();
    });
  });

  it('should handle revenue stats card clicks', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    // Switch to payment records view
    const paymentRecordsButton = screen.getByRole('button', { name: /payment records/i });
    fireEvent.click(paymentRecordsButton);

    await waitFor(() => {
      const statsCard = screen.getByTestId('stats-card');
      fireEvent.click(statsCard);
      expect(consoleSpy).toHaveBeenCalledWith('Clicked on Test Card card');
    });

    consoleSpy.mockRestore();
  });

  it('should handle responsive design properly', () => {
    render(
      <TestWrapper>
        <ClientsPage />
      </TestWrapper>
    );

    // Check for responsive flex layout
    const headerSection = screen.getByText('Client & Payment Management').closest('.flex');
    expect(headerSection).toBeInTheDocument();
    expect(headerSection).toHaveClass('items-center', 'justify-between');

    // Check for responsive button group
    const buttonGroup = screen.getByRole('button', { name: /client overview/i }).closest('.flex');
    expect(buttonGroup).toBeInTheDocument();
  });
});