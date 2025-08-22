import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { QuickAdd } from '@/components/QuickAdd';
import { useActivities } from '@/lib/hooks/useActivities';
import { useTasks } from '@/lib/hooks/useTasks';
import { useUser } from '@/lib/hooks/useUser';

// Mock all the hooks
vi.mock('@/lib/hooks/useActivities');
vi.mock('@/lib/hooks/useTasks');
vi.mock('@/lib/hooks/useUser');

// Mock DealWizard and other components
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
  DealSelector: ({ onDealSelect }: any) => (
    <button onClick={() => onDealSelect?.('mock-deal-id', { company: 'Test Company' })}>
      Select Deal
    </button>
  )
}));

vi.mock('@/components/IdentifierField', () => ({
  IdentifierField: ({ value, onChange, placeholder }: any) => (
    <input
      placeholder={placeholder}
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value, 'email')}
      data-testid="identifier-field"
    />
  )
}));

// Wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
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
};

describe('QuickAdd Comprehensive Tests', () => {
  const mockAddActivity = vi.fn();
  const mockAddSale = vi.fn();
  const mockCreateTask = vi.fn();
  const mockOnClose = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock useUser
    (useUser as any).mockReturnValue({
      userData: { id: 'test-user-id' }
    });
    
    // Mock useActivities
    (useActivities as any).mockReturnValue({
      addActivity: mockAddActivity,
      addSale: mockAddSale
    });
    
    // Mock useTasks
    (useTasks as any).mockReturnValue({
      createTask: mockCreateTask
    });
  });

  describe('Modal Opening and Action Selection', () => {
    it('should display all quick action buttons when opened', async () => {
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      // Verify all action buttons are present
      expect(screen.getByText('Create Deal')).toBeInTheDocument();
      expect(screen.getByText('Add Task')).toBeInTheDocument();
      expect(screen.getByText('Add Sale')).toBeInTheDocument();
      expect(screen.getByText('Add Outbound')).toBeInTheDocument();
      expect(screen.getByText('Add Meeting')).toBeInTheDocument();
      expect(screen.getByText('Add Proposal')).toBeInTheDocument();
    });

    it('should close modal when X button is clicked', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      const closeButton = screen.getByRole('button', { name: '' }); // X button
      await user.click(closeButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Task Creation', () => {
    it('should create a task with all required fields', async () => {
      const user = userEvent.setup();
      mockCreateTask.mockResolvedValue({ id: 'task-1', title: 'Test Task' });
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      // Click Add Task
      await user.click(screen.getByText('Add Task'));

      // Fill out task form
      const titleInput = screen.getByPlaceholderText('e.g., Call John about the proposal');
      await user.type(titleInput, 'Follow up with client');

      // Select task type (email)
      const emailButton = screen.getByText('Email');
      await user.click(emailButton);

      // Select priority (high)
      const highPriorityButton = screen.getByText('High');
      await user.click(highPriorityButton);

      // Add description
      const descriptionTextarea = screen.getByPlaceholderText('Any additional context or notes...');
      await user.type(descriptionTextarea, 'Follow up on project proposal');

      // Add contact info
      const contactNameInput = screen.getByPlaceholderText('John Smith');
      await user.type(contactNameInput, 'John Doe');

      const companyInput = screen.getByPlaceholderText('Acme Corp');
      await user.type(companyInput, 'Test Company Ltd');

      // Submit form
      const createButton = screen.getByText('Create Task');
      await user.click(createButton);

      await waitFor(() => {
        expect(mockCreateTask).toHaveBeenCalledWith({
          title: 'Follow up with client',
          description: 'Follow up on project proposal',
          task_type: 'email',
          priority: 'high',
          due_date: undefined,
          assigned_to: 'test-user-id',
          contact_name: 'John Doe',
          company: 'Test Company Ltd',
        });
      });
    });

    it('should handle task creation with due date', async () => {
      const user = userEvent.setup();
      mockCreateTask.mockResolvedValue({ id: 'task-1', title: 'Test Task' });
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Task'));

      // Fill required title
      await user.type(screen.getByPlaceholderText('e.g., Call John about the proposal'), 'Test task');

      // Click "Tomorrow 9AM" quick date button
      const tomorrowButton = screen.getByText('Tomorrow 9AM');
      await user.click(tomorrowButton);

      // Submit
      await user.click(screen.getByText('Create Task'));

      await waitFor(() => {
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test task',
            due_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T09:00$/)
          })
        );
      });
    });
  });

  describe('Meeting Creation', () => {
    it('should create a discovery meeting with contact identifier', async () => {
      const user = userEvent.setup();
      mockAddActivity.mockResolvedValue({ id: 'activity-1' });
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Meeting'));

      // Fill prospect name
      const prospectNameInput = screen.getByLabelText('Prospect Name');
      await user.type(prospectNameInput, 'Jane Smith');

      // Select meeting type
      const meetingTypeSelect = screen.getByLabelText('Meeting Type *');
      await user.selectOptions(meetingTypeSelect, 'Discovery');

      // Enter contact identifier
      const identifierField = screen.getByTestId('identifier-field');
      await user.type(identifierField, 'jane@example.com');

      // Submit
      const submitButton = screen.getByText(/Add Meeting/);
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockAddActivity).toHaveBeenCalledWith({
          type: 'meeting',
          client_name: 'Jane Smith',
          details: 'Discovery',
          date: expect.any(String),
          deal_id: null,
          contactIdentifier: 'jane@example.com',
          contactIdentifierType: 'email',
          status: 'completed'
        });
      });
    });

    it('should create a scheduled meeting with pending status', async () => {
      const user = userEvent.setup();
      mockAddActivity.mockResolvedValue({ id: 'activity-1' });
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Meeting'));

      // Fill required fields
      await user.type(screen.getByLabelText('Prospect Name'), 'John Client');
      await user.selectOptions(screen.getByLabelText('Meeting Type *'), 'Demo');
      
      // Change status to scheduled
      await user.selectOptions(screen.getByLabelText('Status'), 'pending');
      
      // Add identifier
      await user.type(screen.getByTestId('identifier-field'), 'john@client.com');

      // Submit
      await user.click(screen.getByText(/Add Meeting/));

      await waitFor(() => {
        expect(mockAddActivity).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'meeting',
            client_name: 'John Client',
            details: 'Demo',
            status: 'pending'
          })
        );
      });
    });
  });

  describe('Proposal Creation', () => {
    it('should create a proposal with deal linking and calculate LTV', async () => {
      const user = userEvent.setup();
      mockAddActivity.mockResolvedValue({ id: 'activity-1' });
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Proposal'));

      // Wait for DealWizard to appear and create a deal
      await waitFor(() => {
        expect(screen.getByTestId('deal-wizard')).toBeInTheDocument();
      });

      // Create deal via wizard
      await user.click(screen.getByText('Create Deal'));

      // Now should see the proposal form with deal selected
      await waitFor(() => {
        expect(screen.getByLabelText('Prospect Name')).toBeInTheDocument();
      });

      // Fill proposal details
      await user.type(screen.getByLabelText('Prospect Name'), 'Big Corp');
      await user.type(screen.getByTestId('identifier-field'), 'contact@bigcorp.com');

      // Enter revenue amounts
      const oneOffInput = screen.getByLabelText('One-off Revenue (£)');
      await user.type(oneOffInput, '5000');

      const mrrInput = screen.getByLabelText('Monthly Recurring Revenue (£)');
      await user.type(mrrInput, '1000');

      // Should show calculated total (1000 * 3 + 5000 = 8000)
      expect(screen.getByText('£8,000')).toBeInTheDocument();

      // Submit proposal
      await user.click(screen.getByText(/Add Proposal/));

      await waitFor(() => {
        expect(mockAddActivity).toHaveBeenCalledWith({
          type: 'proposal',
          client_name: 'Big Corp',
          details: '',
          amount: 8000, // (1000 * 3) + 5000
          date: expect.any(String),
          deal_id: 'mock-deal-id',
          contactIdentifier: 'contact@bigcorp.com',
          contactIdentifierType: 'email',
          status: 'completed'
        });
      });
    });

    it('should require deal selection for proposals', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Proposal'));
      
      // Cancel deal creation
      await waitFor(() => {
        expect(screen.getByTestId('deal-wizard')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Cancel'));
      
      // Should be back at action selection
      expect(screen.getByText('Create Deal')).toBeInTheDocument();
    });
  });

  describe('Sales Creation', () => {
    it('should create a sale with subscription revenue calculation', async () => {
      const user = userEvent.setup();
      mockAddSale.mockResolvedValue({ id: 'sale-1' });
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Sale'));

      // Create deal first
      await waitFor(() => {
        expect(screen.getByTestId('deal-wizard')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Create Deal'));

      // Fill sale form
      await waitFor(() => {
        expect(screen.getByLabelText('Client Name')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Client Name'), 'Happy Customer');
      await user.selectOptions(screen.getByLabelText('Sale Type'), 'subscription');
      await user.type(screen.getByTestId('identifier-field'), 'customer@happy.com');

      // Add MRR
      await user.type(screen.getByLabelText('Monthly Recurring Revenue (£)'), '500');

      // Submit sale
      await user.click(screen.getByText(/Add Sale/));

      await waitFor(() => {
        expect(mockAddSale).toHaveBeenCalledWith({
          client_name: 'Happy Customer',
          amount: 1500, // 500 * 3
          details: 'subscription Sale',
          saleType: 'subscription',
          date: expect.any(String),
          deal_id: 'mock-deal-id',
          contactIdentifier: 'customer@happy.com',
          contactIdentifierType: 'email'
        });
      });
    });

    it('should create a one-off sale', async () => {
      const user = userEvent.setup();
      mockAddSale.mockResolvedValue({ id: 'sale-1' });
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Sale'));
      
      // Create deal
      await waitFor(() => {
        expect(screen.getByTestId('deal-wizard')).toBeInTheDocument();
      });
      await user.click(screen.getByText('Create Deal'));

      // Fill form
      await waitFor(() => {
        expect(screen.getByLabelText('Client Name')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Client Name'), 'One Time Client');
      await user.selectOptions(screen.getByLabelText('Sale Type'), 'one-off');
      await user.type(screen.getByTestId('identifier-field'), 'onetime@client.com');
      await user.type(screen.getByLabelText('One-off Revenue (£)'), '2500');

      await user.click(screen.getByText(/Add Sale/));

      await waitFor(() => {
        expect(mockAddSale).toHaveBeenCalledWith({
          client_name: 'One Time Client',
          amount: 2500,
          details: 'one-off Sale',
          saleType: 'one-off',
          date: expect.any(String),
          deal_id: 'mock-deal-id',
          contactIdentifier: 'onetime@client.com',
          contactIdentifierType: 'email'
        });
      });
    });
  });

  describe('Outbound Activities', () => {
    it('should create LinkedIn outbound activity', async () => {
      const user = userEvent.setup();
      mockAddActivity.mockResolvedValue({ id: 'activity-1' });
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Outbound'));

      // Fill form
      await user.type(screen.getByLabelText('Contact Name (Optional)'), 'LinkedIn Contact');
      await user.selectOptions(screen.getByLabelText('Outreach Type'), 'LinkedIn');
      await user.clear(screen.getByLabelText('Quantity'));
      await user.type(screen.getByLabelText('Quantity'), '3');

      // Add optional identifier
      await user.type(screen.getByTestId('identifier-field'), 'linkedin@contact.com');

      await user.click(screen.getByText(/Add Outbound/));

      await waitFor(() => {
        expect(mockAddActivity).toHaveBeenCalledWith({
          type: 'outbound',
          client_name: 'LinkedIn Contact',
          details: 'LinkedIn',
          quantity: 3,
          date: expect.any(String),
          deal_id: null,
          contactIdentifier: 'linkedin@contact.com',
          contactIdentifierType: 'email'
        });
      });
    });

    it('should create outbound activity without identifier', async () => {
      const user = userEvent.setup();
      mockAddActivity.mockResolvedValue({ id: 'activity-1' });
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Outbound'));

      // Fill minimal form (no identifier)
      await user.type(screen.getByLabelText('Contact Name (Optional)'), 'Cold Prospect');
      await user.selectOptions(screen.getByLabelText('Outreach Type'), 'Call');

      await user.click(screen.getByText(/Add Outbound/));

      await waitFor(() => {
        expect(mockAddActivity).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'outbound',
            client_name: 'Cold Prospect',
            details: 'Call',
            quantity: 1
            // Should NOT contain contactIdentifier or contactIdentifierType
          })
        );
        
        // Verify identifier fields are not included
        const callArgs = mockAddActivity.mock.calls[0][0];
        expect(callArgs.contactIdentifier).toBeUndefined();
        expect(callArgs.contactIdentifierType).toBeUndefined();
      });
    });
  });

  describe('Validation and Error Handling', () => {
    it('should require contact identifier for meetings', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Meeting'));
      
      // Fill form but leave identifier empty
      await user.type(screen.getByLabelText('Prospect Name'), 'Test Prospect');
      await user.selectOptions(screen.getByLabelText('Meeting Type *'), 'Discovery');
      // Don't fill identifier
      
      await user.click(screen.getByText(/Add Meeting/));

      // Should not call addActivity due to validation
      expect(mockAddActivity).not.toHaveBeenCalled();
    });

    it('should require task title', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Task'));
      
      // Don't fill title, just try to submit
      await user.click(screen.getByText('Create Task'));

      // Should not call createTask due to validation
      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    it('should require meeting type selection', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      await user.click(screen.getByText('Add Meeting'));
      
      // Fill other fields but not meeting type
      await user.type(screen.getByLabelText('Prospect Name'), 'Test Prospect');
      await user.type(screen.getByTestId('identifier-field'), 'test@example.com');
      
      await user.click(screen.getByText(/Add Meeting/));

      // Should not call addActivity
      expect(mockAddActivity).not.toHaveBeenCalled();
    });
  });

  describe('Form Reset and Navigation', () => {
    it('should reset form when going back to action selection', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={mockOnClose} />
        </TestWrapper>
      );

      // Go to task form
      await user.click(screen.getByText('Add Task'));
      
      // Fill some data
      await user.type(screen.getByPlaceholderText('e.g., Call John about the proposal'), 'Some task');
      
      // Go back
      const backButton = screen.getAllByText('Cancel')[0];
      await user.click(backButton);
      
      // Should be back at action selection
      expect(screen.getByText('Create Deal')).toBeInTheDocument();
      
      // Go to task form again - should be reset
      await user.click(screen.getByText('Add Task'));
      
      // Title field should be empty
      const titleInput = screen.getByPlaceholderText('e.g., Call John about the proposal');
      expect(titleInput).toHaveValue('');
    });
  });
});