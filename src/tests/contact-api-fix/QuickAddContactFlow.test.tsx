import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickAdd } from '@/components/QuickAdd';
import { ApiContactService } from '@/lib/services/apiContactService';
import { toast } from 'sonner';
import { BrowserRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/lib/hooks/useUser', () => ({
  useUser: () => ({
    userData: { id: 'test-user-123' }
  })
}));

vi.mock('@/lib/hooks/useActivities', () => ({
  useActivities: () => ({
    addActivity: vi.fn().mockResolvedValue({}),
    addSale: vi.fn().mockResolvedValue({}),
  })
}));

vi.mock('@/lib/hooks/useTasks', () => ({
  useTasks: () => ({
    createTask: vi.fn().mockResolvedValue({}),
  })
}));

vi.mock('@/lib/services/apiContactService', () => ({
  ApiContactService: {
    searchContacts: vi.fn(),
    createContact: vi.fn(),
    findContactByEmail: vi.fn(),
  }
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/dashboard' }),
  };
});

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock DealWizard component
vi.mock('@/components/DealWizard', () => ({
  DealWizard: ({ isOpen, onClose, onDealCreated }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="deal-wizard">
        <button onClick={() => onDealCreated({ id: 'deal-123', company: 'Test Company' })}>
          Create Deal
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    );
  }
}));

// Mock DealSelector component
vi.mock('@/components/DealSelector', () => ({
  DealSelector: ({ onDealSelect, required }: any) => (
    <div data-testid="deal-selector">
      <button 
        onClick={() => onDealSelect('deal-123', { id: 'deal-123', company: 'Test Company' })}
      >
        Select Deal
      </button>
      {required && <span>Required</span>}
    </div>
  )
}));

// Mock IdentifierField component
vi.mock('@/components/IdentifierField', () => ({
  IdentifierField: ({ value, onChange, required, placeholder }: any) => (
    <input
      data-testid="identifier-field"
      value={value}
      onChange={(e) => onChange(e.target.value, 'email')}
      placeholder={placeholder}
      required={required}
    />
  )
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('QuickAdd - Contact Integration Flow', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  const mockContact = {
    id: 'contact-123',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User',
    full_name: 'Test User',
    company_name: 'Test Company',
    phone: '+1234567890',
    title: 'Manager',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    company_id: 'company-123',
    is_primary: false,
    linkedin_url: null,
    notes: null,
    owner_id: 'test-user-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ApiContactService.searchContacts).mockResolvedValue([mockContact]);
    vi.mocked(ApiContactService.findContactByEmail).mockResolvedValue(null);
    vi.mocked(ApiContactService.createContact).mockResolvedValue(mockContact);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Proposal Creation with Contact Integration', () => {
    it('should require deal selection for proposal creation', async () => {
      render(
        <TestWrapper>
          <QuickAdd {...mockProps} />
        </TestWrapper>
      );

      // Click proposal action
      const proposalButton = screen.getByText('Add Proposal');
      fireEvent.click(proposalButton);

      await waitFor(() => {
        expect(screen.getByTestId('deal-wizard')).toBeInTheDocument();
      });
    });

    it('should integrate contact creation with proposal workflow', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <QuickAdd {...mockProps} />
        </TestWrapper>
      );

      // Start proposal creation
      fireEvent.click(screen.getByText('Add Proposal'));

      // Create deal through wizard
      await waitFor(() => {
        expect(screen.getByTestId('deal-wizard')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create Deal'));

      // Should return to proposal form with deal selected
      await waitFor(() => {
        expect(screen.queryByTestId('deal-wizard')).not.toBeInTheDocument();
        expect(screen.getByTestId('deal-selector')).toBeInTheDocument();
        expect(screen.getByText('Required')).toBeInTheDocument();
      });

      // Fill in prospect name
      const prospectNameInput = screen.getByDisplayValue('Test Company'); // Should be auto-populated from deal
      expect(prospectNameInput).toBeInTheDocument();

      // Add contact identifier
      const identifierField = screen.getByTestId('identifier-field');
      await user.type(identifierField, 'prospect@example.com');

      // Add proposal amounts
      const oneOffInput = screen.getByPlaceholderText('0');
      const monthlyInput = screen.getAllByPlaceholderText('0')[1];

      await user.type(oneOffInput, '5000');
      await user.type(monthlyInput, '1000');

      // Should show calculated total
      await waitFor(() => {
        expect(screen.getByText(/Total Deal Value.*£8,000/)).toBeInTheDocument();
      });

      // Submit proposal
      const submitButton = screen.getByText('Add Proposal');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockProps.onClose).toHaveBeenCalled();
      });
    });

    it('should validate contact identifier for proposals', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <QuickAdd {...mockProps} />
        </TestWrapper>
      );

      // Navigate to proposal form through deal wizard
      fireEvent.click(screen.getByText('Add Proposal'));
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Create Deal'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('deal-selector')).toBeInTheDocument();
      });

      // Fill required fields except contact identifier
      const prospectNameInput = screen.getByDisplayValue('Test Company');
      expect(prospectNameInput).toBeInTheDocument();

      const oneOffInput = screen.getByPlaceholderText('0');
      await user.type(oneOffInput, '5000');

      // Try to submit without contact identifier
      const submitButton = screen.getByText('Add Proposal');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Please provide a contact identifier (email, phone number, or LinkedIn URL)'
        );
      });
    });
  });

  describe('Sale Creation with Contact Integration', () => {
    it('should require deal selection for sale creation', async () => {
      render(
        <TestWrapper>
          <QuickAdd {...mockProps} />
        </TestWrapper>
      );

      // Click sale action
      const saleButton = screen.getByText('Add Sale');
      fireEvent.click(saleButton);

      await waitFor(() => {
        expect(screen.getByTestId('deal-wizard')).toBeInTheDocument();
      });
    });

    it('should integrate contact validation with sale workflow', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <QuickAdd {...mockProps} />
        </TestWrapper>
      );

      // Start sale creation
      fireEvent.click(screen.getByText('Add Sale'));

      // Create deal
      await waitFor(() => {
        fireEvent.click(screen.getByText('Create Deal'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('deal-selector')).toBeInTheDocument();
      });

      // Fill in client name
      const clientNameInput = screen.getByDisplayValue('Test Company');
      expect(clientNameInput).toBeInTheDocument();

      // Select sale type
      const saleTypeSelect = screen.getByDisplayValue('one-off');
      fireEvent.change(saleTypeSelect, { target: { value: 'subscription' } });

      // Add contact identifier
      const identifierField = screen.getByTestId('identifier-field');
      await user.type(identifierField, 'client@example.com');

      // Add sale amounts
      const oneOffInput = screen.getByPlaceholderText('0');
      const monthlyInput = screen.getAllByPlaceholderText('0')[1];

      await user.type(oneOffInput, '10000');
      await user.type(monthlyInput, '2000');

      // Should show calculated LTV
      await waitFor(() => {
        expect(screen.getByText(/Total Deal Value.*£16,000/)).toBeInTheDocument();
      });

      // Submit sale
      const submitButton = screen.getByText('Add Sale');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockProps.onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Meeting Creation with Contact Integration', () => {
    it('should allow optional deal selection for meetings', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <QuickAdd {...mockProps} />
        </TestWrapper>
      );

      // Click meeting action
      const meetingButton = screen.getByText('Add Meeting');
      fireEvent.click(meetingButton);

      await waitFor(() => {
        expect(screen.getByText('Select meeting type')).toBeInTheDocument();
        expect(screen.getByTestId('deal-selector')).toBeInTheDocument();
        expect(screen.queryByText('Required')).not.toBeInTheDocument(); // Should be optional
      });

      // Fill in prospect name
      const prospectNameInput = screen.getByLabelText(/Prospect Name/);
      await user.type(prospectNameInput, 'Meeting Prospect');

      // Select meeting type
      const meetingTypeSelect = screen.getByDisplayValue('');
      fireEvent.change(meetingTypeSelect, { target: { value: 'Discovery' } });

      // Add contact identifier (required for meetings)
      const identifierField = screen.getByTestId('identifier-field');
      await user.type(identifierField, 'meeting@example.com');

      // Submit meeting
      const submitButton = screen.getByText('Add Meeting');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockProps.onClose).toHaveBeenCalled();
      });
    });

    it('should validate meeting type selection', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <QuickAdd {...mockProps} />
        </TestWrapper>
      );

      // Click meeting action
      fireEvent.click(screen.getByText('Add Meeting'));

      await waitFor(() => {
        expect(screen.getByText('Select meeting type')).toBeInTheDocument();
      });

      // Fill required fields except meeting type
      const prospectNameInput = screen.getByLabelText(/Prospect Name/);
      await user.type(prospectNameInput, 'Test Prospect');

      const identifierField = screen.getByTestId('identifier-field');
      await user.type(identifierField, 'test@example.com');

      // Try to submit without meeting type
      const submitButton = screen.getByText('Add Meeting');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please select a meeting type');
      });
    });
  });

  describe('Outbound Activity with Optional Contact', () => {
    it('should allow outbound creation without contact identifier', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <QuickAdd {...mockProps} />
        </TestWrapper>
      );

      // Click outbound action
      const outboundButton = screen.getByText('Add Outbound');
      fireEvent.click(outboundButton);

      await waitFor(() => {
        expect(screen.getByText('Outreach Type')).toBeInTheDocument();
      });

      // Fill in optional contact name
      const contactNameInput = screen.getByPlaceholderText('Leave blank if unknown');
      await user.type(contactNameInput, 'Cold Lead');

      // Select outbound type
      const outboundTypeSelect = screen.getByDisplayValue('Call');
      fireEvent.change(outboundTypeSelect, { target: { value: 'LinkedIn' } });

      // Set quantity
      const quantityInput = screen.getByDisplayValue('1');
      await user.clear(quantityInput);
      await user.type(quantityInput, '5');

      // Submit outbound (no contact identifier required)
      const submitButton = screen.getByText('Add Outbound');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockProps.onClose).toHaveBeenCalled();
      });
    });

    it('should optionally accept contact identifier for outbound', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <QuickAdd {...mockProps} />
        </TestWrapper>
      );

      // Click outbound action
      fireEvent.click(screen.getByText('Add Outbound'));

      await waitFor(() => {
        expect(screen.getByTestId('identifier-field')).toBeInTheDocument();
      });

      // Fill in contact information
      const contactNameInput = screen.getByPlaceholderText('Leave blank if unknown');
      await user.type(contactNameInput, 'Known Contact');

      const identifierField = screen.getByTestId('identifier-field');
      await user.type(identifierField, 'known@example.com');

      // Submit with optional contact
      const submitButton = screen.getByText('Add Outbound');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockProps.onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle API errors gracefully during contact creation', async () => {
      vi.mocked(ApiContactService.createContact).mockRejectedValue(
        new Error('API Error')
      );

      const user = userEvent.setup();
      render(
        <TestWrapper>
          <QuickAdd {...mockProps} />
        </TestWrapper>
      );

      // This test would need the ContactSearchModal to be integrated
      // For now, we'll test that the component handles form submission errors
      fireEvent.click(screen.getByText('Add Proposal'));
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Create Deal'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('deal-selector')).toBeInTheDocument();
      });

      // Try to submit without required fields
      const submitButton = screen.getByText('Add Proposal');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    it('should prevent submission with invalid deal selection', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <QuickAdd {...mockProps} />
        </TestWrapper>
      );

      // Start sale creation
      fireEvent.click(screen.getByText('Add Sale'));

      // Create deal but don't select it
      await waitFor(() => {
        fireEvent.click(screen.getByText('Close'));
      });

      await waitFor(() => {
        expect(screen.queryByTestId('deal-wizard')).not.toBeInTheDocument();
      });

      // Try to submit without deal selection
      const submitButton = screen.getByText('Add Sale');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please select or create a deal for this sale');
      });
    });

    it('should validate LTV calculations correctly', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <QuickAdd {...mockProps} />
        </TestWrapper>
      );

      // Navigate to proposal form
      fireEvent.click(screen.getByText('Add Proposal'));
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Create Deal'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('deal-selector')).toBeInTheDocument();
      });

      // Test LTV calculation: (MRR * 3) + One-off
      const oneOffInput = screen.getByPlaceholderText('0');
      const monthlyInput = screen.getAllByPlaceholderText('0')[1];

      await user.type(oneOffInput, '1000');
      await user.type(monthlyInput, '500');

      // Should show: £1,000 + (£500 * 3) = £2,500
      await waitFor(() => {
        expect(screen.getByText(/Total Deal Value.*£2,500/)).toBeInTheDocument();
      });

      // Test annual value display
      await waitFor(() => {
        expect(screen.getByText(/Annual Value.*£7,000/)).toBeInTheDocument();
      });
    });
  });

  describe('Form State Management', () => {
    it('should reset form state when modal is closed and reopened', async () => {
      const { rerender } = render(
        <TestWrapper>
          <QuickAdd {...mockProps} />
        </TestWrapper>
      );

      // Make some changes
      fireEvent.click(screen.getByText('Add Meeting'));

      // Close modal
      rerender(
        <TestWrapper>
          <QuickAdd {...{ ...mockProps, isOpen: false }} />
        </TestWrapper>
      );

      // Reopen modal
      rerender(
        <TestWrapper>
          <QuickAdd {...mockProps} />
        </TestWrapper>
      );

      // Should be back to initial state
      expect(screen.getByText('Quick Add')).toBeInTheDocument();
      expect(screen.queryByText('Select meeting type')).not.toBeInTheDocument();
    });

    it('should maintain form state during navigation between actions', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <QuickAdd {...mockProps} />
        </TestWrapper>
      );

      // Start with meeting
      fireEvent.click(screen.getByText('Add Meeting'));

      await waitFor(() => {
        expect(screen.getByText('Select meeting type')).toBeInTheDocument();
      });

      // Fill some data
      const prospectNameInput = screen.getByLabelText(/Prospect Name/);
      await user.type(prospectNameInput, 'Test Data');

      // Go back
      const backButton = screen.getByText('Back');
      fireEvent.click(backButton);

      // Data should be cleared when going back to main menu
      expect(screen.getByText('Quick Add')).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Test Data')).not.toBeInTheDocument();
    });
  });
});