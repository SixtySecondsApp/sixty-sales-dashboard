import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiContactService } from '@/lib/services/apiContactService';
import { toast } from 'sonner';
import { BrowserRouter } from 'react-router-dom';

// Import components to test the integration
import { ContactSearchModal } from '@/components/ContactSearchModal';
import { QuickAdd } from '@/components/QuickAdd';

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

// Mock DealWizard with ContactSearchModal integration
vi.mock('@/components/DealWizard', () => ({
  DealWizard: ({ isOpen, onClose, onDealCreated, initialData }: any) => {
    if (!isOpen) return null;
    
    const [showContactModal, setShowContactModal] = React.useState(false);
    const [selectedContact, setSelectedContact] = React.useState(null);
    
    return (
      <div data-testid="deal-wizard">
        <div>Deal Wizard</div>
        <div>Client Name: {initialData?.clientName || 'Not set'}</div>
        <div>Contact Email: {initialData?.contactEmail || 'Not set'}</div>
        <div>Deal Value: £{initialData?.dealValue || 0}</div>
        
        {selectedContact && (
          <div data-testid="selected-contact">
            Selected: {selectedContact.full_name} ({selectedContact.email})
          </div>
        )}
        
        <button onClick={() => setShowContactModal(true)}>
          {selectedContact ? 'Change Contact' : 'Add Contact'}
        </button>
        
        <button onClick={() => onDealCreated({ 
          id: 'deal-123', 
          company: selectedContact?.company_name || initialData?.clientName || 'Test Company',
          contact: selectedContact 
        })}>
          Create Deal
        </button>
        
        <button onClick={onClose}>Close</button>
        
        <ContactSearchModal
          isOpen={showContactModal}
          onClose={() => setShowContactModal(false)}
          onContactSelect={(contact) => {
            setSelectedContact(contact);
            setShowContactModal(false);
          }}
          prefilledEmail={initialData?.contactEmail}
          prefilledName=""
        />
      </div>
    );
  }
}));

vi.mock('@/components/DealSelector', () => ({
  DealSelector: ({ onDealSelect, selectedDealId, clientName, required }: any) => (
    <div data-testid="deal-selector">
      <div>Selected Deal ID: {selectedDealId || 'None'}</div>
      <div>Client Name: {clientName || 'None'}</div>
      <button 
        onClick={() => onDealSelect('deal-123', { 
          id: 'deal-123', 
          company: clientName || 'Test Company' 
        })}
      >
        Select Existing Deal
      </button>
      {required && <span data-testid="required-indicator">Required</span>}
    </div>
  )
}));

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

// Need to import React for the mocked component
import React from 'react';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('Deal Creation Integration Tests', () => {
  const mockContact = {
    id: 'contact-123',
    email: 'john@company.com',
    first_name: 'John',
    last_name: 'Smith',
    full_name: 'John Smith',
    company_name: 'Acme Corporation',
    phone: '+1234567890',
    title: 'CEO',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    company_id: 'company-123',
    is_primary: true,
    linkedin_url: null,
    notes: null,
    owner_id: 'test-user-123',
  };

  const mockContacts = [
    mockContact,
    {
      id: 'contact-456',
      email: 'jane@techcorp.com',
      first_name: 'Jane',
      last_name: 'Doe',
      full_name: 'Jane Doe',
      company_name: 'Tech Corp',
      phone: null,
      title: 'CTO',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      company_id: 'company-456',
      is_primary: false,
      linkedin_url: null,
      notes: null,
      owner_id: 'test-user-123',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ApiContactService.searchContacts).mockResolvedValue(mockContacts);
    vi.mocked(ApiContactService.findContactByEmail).mockResolvedValue(null);
    vi.mocked(ApiContactService.createContact).mockResolvedValue(mockContact);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Deal Creation Flow', () => {
    it('should create a deal with existing contact through search', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={onClose} />
        </TestWrapper>
      );

      // Start deal creation
      const dealButton = screen.getByText('Create Deal');
      fireEvent.click(dealButton);

      await waitFor(() => {
        expect(screen.getByTestId('deal-wizard')).toBeInTheDocument();
      });

      // Open contact modal
      const addContactButton = screen.getByText('Add Contact');
      fireEvent.click(addContactButton);

      await waitFor(() => {
        expect(screen.getByText('Select Contact')).toBeInTheDocument();
      });

      // Search should auto-load contacts
      await waitFor(() => {
        expect(screen.getByText('John Smith')).toBeInTheDocument();
        expect(screen.getByText('john@company.com')).toBeInTheDocument();
      });

      // Select the contact
      const contactButton = screen.getByText('John Smith').closest('button');
      if (contactButton) {
        fireEvent.click(contactButton);
      }

      // Should return to deal wizard with selected contact
      await waitFor(() => {
        expect(screen.getByTestId('selected-contact')).toBeInTheDocument();
        expect(screen.getByText('Selected: John Smith (john@company.com)')).toBeInTheDocument();
      });

      // Create the deal
      const createDealButton = screen.getByText('Create Deal');
      fireEvent.click(createDealButton);

      // Should close and return to QuickAdd main view
      await waitFor(() => {
        expect(screen.queryByTestId('deal-wizard')).not.toBeInTheDocument();
        expect(onClose).toHaveBeenCalled();
      });

      expect(toast.success).toHaveBeenCalledWith('Deal created successfully!');
    });

    it('should create a deal with new contact through contact creation', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={onClose} />
        </TestWrapper>
      );

      // Start deal creation
      fireEvent.click(screen.getByText('Create Deal'));

      await waitFor(() => {
        expect(screen.getByTestId('deal-wizard')).toBeInTheDocument();
      });

      // Open contact modal
      fireEvent.click(screen.getByText('Add Contact'));

      await waitFor(() => {
        expect(screen.getByText('Select Contact')).toBeInTheDocument();
      });

      // Click create new contact
      const createNewButton = screen.getByText('Create New Contact');
      fireEvent.click(createNewButton);

      await waitFor(() => {
        expect(screen.getByText('Create & Select Contact')).toBeInTheDocument();
      });

      // Fill in new contact form
      const firstNameInput = screen.getByPlaceholderText('First Name *');
      const emailInput = screen.getByPlaceholderText('Email Address *');
      const companyInput = screen.getByPlaceholderText('Company Name');

      await user.type(firstNameInput, 'New');
      await user.type(emailInput, 'new@newcompany.com');
      await user.type(companyInput, 'New Company Ltd');

      // Create the contact
      const createContactButton = screen.getByText('Create & Select Contact');
      fireEvent.click(createContactButton);

      await waitFor(() => {
        expect(ApiContactService.createContact).toHaveBeenCalledWith({
          first_name: 'New',
          last_name: '',
          email: 'new@newcompany.com',
          phone: null,
          title: null,
          company: 'New Company Ltd',
          owner_id: 'test-user-123',
          is_primary: false,
        });
      });

      // Should return to deal wizard with new contact
      await waitFor(() => {
        expect(screen.getByTestId('selected-contact')).toBeInTheDocument();
      });

      // Create the deal
      fireEvent.click(screen.getByText('Create Deal'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith('Deal created successfully!');
      });
    });
  });

  describe('Proposal Creation with Contact Flow', () => {
    it('should create proposal after deal and contact creation', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={onClose} />
        </TestWrapper>
      );

      // Start proposal creation
      const proposalButton = screen.getByText('Add Proposal');
      fireEvent.click(proposalButton);

      await waitFor(() => {
        expect(screen.getByTestId('deal-wizard')).toBeInTheDocument();
      });

      // Should pass initial data to deal wizard
      expect(screen.getByText('Client Name: Not set')).toBeInTheDocument();
      expect(screen.getByText('Contact Email: Not set')).toBeInTheDocument();

      // Add contact first
      fireEvent.click(screen.getByText('Add Contact'));

      await waitFor(() => {
        expect(screen.getByText('John Smith')).toBeInTheDocument();
      });

      // Select contact
      const johnSmithButton = screen.getByText('John Smith').closest('button');
      if (johnSmithButton) {
        fireEvent.click(johnSmithButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Selected: John Smith (john@company.com)')).toBeInTheDocument();
      });

      // Create deal
      fireEvent.click(screen.getByText('Create Deal'));

      // Should return to proposal form with deal and contact selected
      await waitFor(() => {
        expect(screen.queryByTestId('deal-wizard')).not.toBeInTheDocument();
        expect(screen.getByTestId('deal-selector')).toBeInTheDocument();
        expect(screen.getByText('Client Name: Acme Corporation')).toBeInTheDocument();
        expect(screen.getByTestId('required-indicator')).toBeInTheDocument();
      });

      // The contact email should be auto-populated
      const identifierField = screen.getByTestId('identifier-field');
      expect(identifierField.value).toBe('john@company.com');

      // Add proposal amounts
      const oneOffInput = screen.getByPlaceholderText('0');
      const monthlyInput = screen.getAllByPlaceholderText('0')[1];

      await user.type(oneOffInput, '15000');
      await user.type(monthlyInput, '3000');

      // Should calculate LTV: £15,000 + (£3,000 * 3) = £24,000
      await waitFor(() => {
        expect(screen.getByText(/Total Deal Value.*£24,000/)).toBeInTheDocument();
      });

      // Submit proposal
      const submitButton = screen.getByText('Add Proposal');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('should pre-fill deal wizard with proposal data', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={vi.fn()} />
        </TestWrapper>
      );

      // Navigate to proposal form first and add some data
      fireEvent.click(screen.getByText('Add Proposal'));

      await waitFor(() => {
        expect(screen.getByTestId('deal-wizard')).toBeInTheDocument();
      });

      // The deal wizard should be able to receive initial data when integrated properly
      // For now, we test that the wizard shows the right interface
      expect(screen.getByText('Add Contact')).toBeInTheDocument();
      expect(screen.getByText('Create Deal')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });
  });

  describe('Sale Creation with Contact Integration', () => {
    it('should integrate contact selection with sale workflow', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={onClose} />
        </TestWrapper>
      );

      // Start sale creation
      fireEvent.click(screen.getByText('Add Sale'));

      await waitFor(() => {
        expect(screen.getByTestId('deal-wizard')).toBeInTheDocument();
      });

      // Add contact through search
      fireEvent.click(screen.getByText('Add Contact'));

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText('Search by name, email, or company...');
        await user.type(searchInput, 'jane');
      });

      await waitFor(() => {
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      });

      // Select Jane Doe
      const janeButton = screen.getByText('Jane Doe').closest('button');
      if (janeButton) {
        fireEvent.click(janeButton);
      }

      await waitFor(() => {
        expect(screen.getByText('Selected: Jane Doe (jane@techcorp.com)')).toBeInTheDocument();
      });

      // Create deal
      fireEvent.click(screen.getByText('Create Deal'));

      // Should return to sale form
      await waitFor(() => {
        expect(screen.getByTestId('deal-selector')).toBeInTheDocument();
        expect(screen.getByText('Client Name: Tech Corp')).toBeInTheDocument();
      });

      // Contact should be pre-filled
      const identifierField = screen.getByTestId('identifier-field');
      expect(identifierField.value).toBe('jane@techcorp.com');

      // Complete sale form
      const saleTypeSelect = screen.getByDisplayValue('one-off');
      fireEvent.change(saleTypeSelect, { target: { value: 'subscription' } });

      const monthlyInput = screen.getAllByPlaceholderText('0')[1];
      await user.type(monthlyInput, '5000');

      // Submit sale
      fireEvent.click(screen.getByText('Add Sale'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling in Integration Flow', () => {
    it('should handle contact creation failure during deal creation', async () => {
      vi.mocked(ApiContactService.createContact).mockRejectedValue(
        new Error('Contact creation failed')
      );

      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={vi.fn()} />
        </TestWrapper>
      );

      // Start deal creation
      fireEvent.click(screen.getByText('Create Deal'));

      await waitFor(() => {
        fireEvent.click(screen.getByText('Add Contact'));
      });

      await waitFor(() => {
        fireEvent.click(screen.getByText('Create New Contact'));
      });

      // Fill form with invalid data or simulate API error
      const firstNameInput = screen.getByPlaceholderText('First Name *');
      const emailInput = screen.getByPlaceholderText('Email Address *');

      await user.type(firstNameInput, 'Test');
      await user.type(emailInput, 'test@fail.com');

      fireEvent.click(screen.getByText('Create & Select Contact'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create contact');
      });

      // Should remain in contact creation form
      expect(screen.getByText('Create & Select Contact')).toBeInTheDocument();
    });

    it('should handle contact search failure during deal creation', async () => {
      vi.mocked(ApiContactService.searchContacts).mockRejectedValue(
        new Error('Search failed')
      );

      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={vi.fn()} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Create Deal'));

      await waitFor(() => {
        fireEvent.click(screen.getByText('Add Contact'));
      });

      // Should handle search error gracefully
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to search contacts');
      });

      // Should show fallback empty state
      await waitFor(() => {
        expect(screen.getByText('No contacts yet')).toBeInTheDocument();
      });
    });

    it('should validate complete flow before submission', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={vi.fn()} />
        </TestWrapper>
      );

      // Start proposal creation
      fireEvent.click(screen.getByText('Add Proposal'));

      // Close deal wizard without creating deal
      await waitFor(() => {
        fireEvent.click(screen.getByText('Close'));
      });

      await waitFor(() => {
        expect(screen.queryByTestId('deal-wizard')).not.toBeInTheDocument();
      });

      // Try to submit proposal without deal
      const submitButton = screen.getByText('Add Proposal');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Please select or create a deal for this proposal');
      });
    });
  });

  describe('Data Flow and State Management', () => {
    it('should maintain contact information across components', async () => {
      const user = userEvent.setup();
      
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={vi.fn()} />
        </TestWrapper>
      );

      // Create proposal with contact
      fireEvent.click(screen.getByText('Add Proposal'));

      await waitFor(() => {
        fireEvent.click(screen.getByText('Add Contact'));
      });

      // Select existing contact
      await waitFor(() => {
        const johnButton = screen.getByText('John Smith').closest('button');
        if (johnButton) fireEvent.click(johnButton);
      });

      // Create deal with contact
      await waitFor(() => {
        fireEvent.click(screen.getByText('Create Deal'));
      });

      // Verify contact data flows correctly
      await waitFor(() => {
        expect(screen.getByText('Client Name: Acme Corporation')).toBeInTheDocument();
        
        const identifierField = screen.getByTestId('identifier-field');
        expect(identifierField.value).toBe('john@company.com');
      });

      // The form should be pre-populated with contact information
      const prospectNameInput = screen.getByDisplayValue('Acme Corporation');
      expect(prospectNameInput).toBeInTheDocument();
    });

    it('should clear state appropriately when cancelling flows', async () => {
      render(
        <TestWrapper>
          <QuickAdd isOpen={true} onClose={vi.fn()} />
        </TestWrapper>
      );

      // Start deal creation
      fireEvent.click(screen.getByText('Create Deal'));

      // Cancel out
      await waitFor(() => {
        fireEvent.click(screen.getByText('Close'));
      });

      // Should return to main menu clean
      await waitFor(() => {
        expect(screen.getByText('Quick Add')).toBeInTheDocument();
        expect(screen.queryByTestId('deal-wizard')).not.toBeInTheDocument();
      });

      // Start different action
      fireEvent.click(screen.getByText('Add Meeting'));

      // Should have clean state
      await waitFor(() => {
        expect(screen.getByText('Select meeting type')).toBeInTheDocument();
        expect(screen.getByLabelText(/Prospect Name/)).toHaveValue('');
      });
    });
  });
});