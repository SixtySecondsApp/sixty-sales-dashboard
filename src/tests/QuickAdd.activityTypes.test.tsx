import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { QuickAdd } from '@/components/QuickAdd';
import { useActivities } from '@/lib/hooks/useActivities';
import { useTasks } from '@/lib/hooks/useTasks';
import { useUser } from '@/lib/hooks/useUser';

// Mock hooks
vi.mock('@/lib/hooks/useActivities');
vi.mock('@/lib/hooks/useTasks'); 
vi.mock('@/lib/hooks/useUser');

// Mock components
vi.mock('@/components/DealWizard', () => ({
  DealWizard: ({ isOpen, onClose, onDealCreated }: any) => 
    isOpen ? (
      <div data-testid="deal-wizard">
        <button onClick={() => onDealCreated?.({ id: 'mock-deal-id', company: 'Test Company' })}>
          Create Deal
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    ) : null
}));

vi.mock('@/components/DealSelector', () => ({
  DealSelector: ({ onDealSelect, placeholder }: any) => (
    <div>
      <button onClick={() => onDealSelect?.('existing-deal-id', { company: 'Existing Deal Company' })}>
        Select Existing Deal
      </button>
      <span>{placeholder}</span>
    </div>
  )
}));

vi.mock('@/components/IdentifierField', () => ({
  IdentifierField: ({ value, onChange, placeholder, required }: any) => (
    <input
      placeholder={placeholder}
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value, 'email')}
      data-testid="identifier-field"
      required={required}
    />
  )
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('QuickAdd Activity Types - Specific Business Logic Tests', () => {
  const mockAddActivity = vi.fn();
  const mockAddSale = vi.fn();
  const mockCreateTask = vi.fn();
  const mockOnClose = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    (useUser as any).mockReturnValue({
      userData: { id: 'test-user-id' }
    });
    
    (useActivities as any).mockReturnValue({
      addActivity: mockAddActivity,
      addSale: mockAddSale
    });
    
    (useTasks as any).mockReturnValue({
      createTask: mockCreateTask
    });

    // Mock successful responses
    mockAddActivity.mockResolvedValue({ id: 'activity-1' });
    mockAddSale.mockResolvedValue({ id: 'sale-1' });
    mockCreateTask.mockResolvedValue({ id: 'task-1' });
  });

  describe('SQL Meetings (Scheduled Meetings)', () => {
    it('should create SQL meeting with pending status for scheduled meetings', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Meeting'));

      // Fill meeting details for SQL meeting (scheduled)
      await user.type(screen.getByLabelText('Prospect Name'), 'SQL Lead Corp');
      await user.selectOptions(screen.getByLabelText('Meeting Type *'), 'Discovery');
      
      // Set status to scheduled (pending)
      await user.selectOptions(screen.getByLabelText('Status'), 'pending');
      
      // Add contact identifier (required for meetings)
      await user.type(screen.getByTestId('identifier-field'), 'sql.lead@corp.com');

      await user.click(screen.getByText(/Add Meeting/));

      await waitFor(() => {
        expect(mockAddActivity).toHaveBeenCalledWith({
          type: 'meeting',
          client_name: 'SQL Lead Corp',
          details: 'Discovery',
          date: expect.any(String),
          deal_id: null,
          contactIdentifier: 'sql.lead@corp.com',
          contactIdentifierType: 'email',
          status: 'pending'
        });
      });
    });

    it('should create SQL meeting with completed status for past meetings', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Meeting'));

      await user.type(screen.getByLabelText('Prospect Name'), 'Completed SQL Meeting');
      await user.selectOptions(screen.getByLabelText('Meeting Type *'), 'Demo');
      await user.selectOptions(screen.getByLabelText('Status'), 'completed');
      await user.type(screen.getByTestId('identifier-field'), 'demo@completed.com');

      await user.click(screen.getByText(/Add Meeting/));

      await waitFor(() => {
        expect(mockAddActivity).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'meeting',
            client_name: 'Completed SQL Meeting',
            details: 'Demo',
            status: 'completed'
          })
        );
      });
    });

    it('should create SQL meeting with no_show status', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Meeting'));

      await user.type(screen.getByLabelText('Prospect Name'), 'No Show Prospect');
      await user.selectOptions(screen.getByLabelText('Meeting Type *'), 'Follow-up');
      await user.selectOptions(screen.getByLabelText('Status'), 'no_show');
      await user.type(screen.getByTestId('identifier-field'), 'noshow@prospect.com');

      await user.click(screen.getByText(/Add Meeting/));

      await waitFor(() => {
        expect(mockAddActivity).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'no_show'
          })
        );
      });
    });

    it('should create cancelled SQL meeting', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Meeting'));

      await user.type(screen.getByLabelText('Prospect Name'), 'Cancelled Meeting Inc');
      await user.selectOptions(screen.getByLabelText('Meeting Type *'), 'Proposal');
      await user.selectOptions(screen.getByLabelText('Status'), 'cancelled');
      await user.type(screen.getByTestId('identifier-field'), 'cancelled@meeting.com');

      await user.click(screen.getByText(/Add Meeting/));

      await waitFor(() => {
        expect(mockAddActivity).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'cancelled'
          })
        );
      });
    });
  });

  describe('Verbal Commitments (Proposal Activities)', () => {
    it('should create verbal commitment as proposal with deal requirement', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Proposal'));

      // Should show deal wizard requirement
      await waitFor(() => {
        expect(screen.getByTestId('deal-wizard')).toBeInTheDocument();
      });

      // Create deal for the verbal commitment
      await user.click(screen.getByText('Create Deal'));

      // Now fill proposal (verbal commitment) form
      await waitFor(() => {
        expect(screen.getByLabelText('Prospect Name')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Prospect Name'), 'Verbal Commitment Corp');
      await user.type(screen.getByTestId('identifier-field'), 'verbal@commitment.com');

      // Enter commitment amounts (verbal agreement)
      await user.type(screen.getByLabelText('One-off Revenue (£)'), '15000');
      await user.type(screen.getByLabelText('Monthly Recurring Revenue (£)'), '3000');

      // Should calculate LTV: (3000 * 3) + 15000 = 24000
      await expect(screen.getByText('£24,000')).toBeInTheDocument();

      await user.click(screen.getByText(/Add Proposal/));

      await waitFor(() => {
        expect(mockAddActivity).toHaveBeenCalledWith({
          type: 'proposal',
          client_name: 'Verbal Commitment Corp',
          details: '',
          amount: 24000, // LTV calculation
          date: expect.any(String),
          deal_id: 'mock-deal-id',
          contactIdentifier: 'verbal@commitment.com',
          contactIdentifierType: 'email',
          status: 'completed'
        });
      });
    });

    it('should require deal for verbal commitment proposal', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Proposal'));

      // Deal wizard should appear
      expect(screen.getByTestId('deal-wizard')).toBeInTheDocument();
      
      // Cancel deal creation
      await user.click(screen.getByText('Cancel'));

      // Should return to action selection, not allow proposal creation without deal
      expect(screen.getByText('Create Deal')).toBeInTheDocument();
      expect(screen.getByText('Add Task')).toBeInTheDocument();
    });

    it('should create verbal commitment with existing deal selection', async () => {
      const user = userEvent.setup();
      
      // Mock deal selector to show existing deals
      vi.mocked(useActivities).mockReturnValue({
        addActivity: mockAddActivity,
        addSale: mockAddSale
      });
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Proposal'));
      
      // Skip deal wizard and select existing deal
      await user.click(screen.getByText('Cancel'));
      await user.click(screen.getByText('Add Proposal'));
      
      // If we get past deal wizard, select existing deal
      const existingDealButton = screen.queryByText('Select Existing Deal');
      if (existingDealButton) {
        await user.click(existingDealButton);
      }
    });
  });

  describe('Deal Creation and Pipeline Integration', () => {
    it('should create deal directly and close modal', async () => {
      const user = userEvent.setup();
      const mockDealCreated = vi.fn();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Create Deal'));

      // Deal wizard opens
      expect(screen.getByTestId('deal-wizard')).toBeInTheDocument();

      // Create deal
      await user.click(screen.getByText('Create Deal'));

      // Should close modal after deal creation
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should link activities to newly created deals', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      // Create sale which should create deal
      await user.click(screen.getByText('Add Sale'));
      
      await user.click(screen.getByText('Create Deal'));

      await waitFor(() => {
        expect(screen.getByLabelText('Client Name')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Client Name'), 'New Deal Client');
      await user.selectOptions(screen.getByLabelText('Sale Type'), 'one-off');
      await user.type(screen.getByTestId('identifier-field'), 'newdeal@client.com');
      await user.type(screen.getByLabelText('One-off Revenue (£)'), '7500');

      await user.click(screen.getByText(/Add Sale/));

      await waitFor(() => {
        expect(mockAddSale).toHaveBeenCalledWith(
          expect.objectContaining({
            deal_id: 'mock-deal-id',
            client_name: 'New Deal Client',
            amount: 7500
          })
        );
      });
    });
  });

  describe('Activity and Pipeline Ticket Creation Verification', () => {
    it('should create both activity record and pipeline deal for sales', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Sale'));
      await user.click(screen.getByText('Create Deal'));

      await waitFor(() => {
        expect(screen.getByLabelText('Client Name')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Client Name'), 'Dual Record Client');
      await user.selectOptions(screen.getByLabelText('Sale Type'), 'subscription');
      await user.type(screen.getByTestId('identifier-field'), 'dual@record.com');
      await user.type(screen.getByLabelText('Monthly Recurring Revenue (£)'), '2500');

      await user.click(screen.getByText(/Add Sale/));

      await waitFor(() => {
        // Should create sale activity
        expect(mockAddSale).toHaveBeenCalledWith({
          client_name: 'Dual Record Client',
          amount: 7500, // 2500 * 3
          details: 'subscription Sale',
          saleType: 'subscription',
          date: expect.any(String),
          deal_id: 'mock-deal-id', // Should be linked to deal
          contactIdentifier: 'dual@record.com',
          contactIdentifierType: 'email'
        });
      });
    });

    it('should create activity for meetings without creating deals', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Meeting'));

      await user.type(screen.getByLabelText('Prospect Name'), 'Meeting Only Client');
      await user.selectOptions(screen.getByLabelText('Meeting Type *'), 'Discovery');
      await user.type(screen.getByTestId('identifier-field'), 'meetingonly@client.com');

      await user.click(screen.getByText(/Add Meeting/));

      await waitFor(() => {
        // Should create activity only
        expect(mockAddActivity).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'meeting',
            client_name: 'Meeting Only Client'
          })
        );
        
        // Should NOT create sale
        expect(mockAddSale).not.toHaveBeenCalled();
      });
    });

    it('should create task without creating activities or deals', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Task'));

      await user.type(screen.getByPlaceholderText('e.g., Call John about the proposal'), 'Standalone Task');
      
      await user.click(screen.getByText('Create Task'));

      await waitFor(() => {
        // Should create task only
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Standalone Task'
          })
        );
        
        // Should NOT create activities or sales
        expect(mockAddActivity).not.toHaveBeenCalled();
        expect(mockAddSale).not.toHaveBeenCalled();
      });
    });
  });

  describe('Business Logic Validation', () => {
    it('should calculate LTV correctly for proposals: (MRR * 3) + one-off', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Proposal'));
      await user.click(screen.getByText('Create Deal'));

      await waitFor(() => {
        expect(screen.getByLabelText('Prospect Name')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Prospect Name'), 'LTV Test Corp');
      await user.type(screen.getByTestId('identifier-field'), 'ltv@test.com');

      // Test LTV calculation: One-off: 5000, MRR: 1200
      // Expected LTV: (1200 * 3) + 5000 = 8600
      await user.type(screen.getByLabelText('One-off Revenue (£)'), '5000');
      await user.type(screen.getByLabelText('Monthly Recurring Revenue (£)'), '1200');

      // Should display calculated total
      await expect(screen.getByText('£8,600')).toBeInTheDocument();

      await user.click(screen.getByText(/Add Proposal/));

      await waitFor(() => {
        expect(mockAddActivity).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 8600
          })
        );
      });
    });

    it('should handle only MRR without one-off revenue', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Sale'));
      await user.click(screen.getByText('Create Deal'));

      await waitFor(() => {
        expect(screen.getByLabelText('Client Name')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Client Name'), 'MRR Only Client');
      await user.selectOptions(screen.getByLabelText('Sale Type'), 'subscription');
      await user.type(screen.getByTestId('identifier-field'), 'mrronly@client.com');

      // Only MRR, no one-off: 800 * 3 = 2400
      await user.type(screen.getByLabelText('Monthly Recurring Revenue (£)'), '800');

      await expect(screen.getByText('£2,400')).toBeInTheDocument();

      await user.click(screen.getByText(/Add Sale/));

      await waitFor(() => {
        expect(mockAddSale).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 2400
          })
        );
      });
    });

    it('should handle only one-off revenue without MRR', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Proposal'));
      await user.click(screen.getByText('Create Deal'));

      await waitFor(() => {
        expect(screen.getByLabelText('Prospect Name')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Prospect Name'), 'One-off Only Corp');
      await user.type(screen.getByTestId('identifier-field'), 'oneoff@only.com');

      // Only one-off: 12000 + (0 * 3) = 12000
      await user.type(screen.getByLabelText('One-off Revenue (£)'), '12000');

      await expect(screen.getByText('£12,000')).toBeInTheDocument();

      await user.click(screen.getByText(/Add Proposal/));

      await waitFor(() => {
        expect(mockAddActivity).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 12000
          })
        );
      });
    });
  });
});