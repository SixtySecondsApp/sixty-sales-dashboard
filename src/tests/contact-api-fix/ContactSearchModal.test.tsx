import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContactSearchModal } from '@/components/ContactSearchModal';
import { ApiContactService } from '@/lib/services/apiContactService';
import { toast } from 'sonner';

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

vi.mock('@/lib/services/apiContactService', () => ({
  ApiContactService: {
    searchContacts: vi.fn(),
    createContact: vi.fn(),
    findContactByEmail: vi.fn(),
  }
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

describe('ContactSearchModal - API Fix Verification', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    onContactSelect: vi.fn(),
    prefilledEmail: '',
    prefilledName: '',
  };

  const mockContacts = [
    {
      id: 'contact-1',
      email: 'john@example.com',
      first_name: 'John',
      last_name: 'Smith',
      full_name: 'John Smith',
      company_name: 'Acme Corp',
      phone: '+1234567890',
      title: 'CEO',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      company_id: 'company-1',
      is_primary: true,
      linkedin_url: null,
      notes: null,
      owner_id: 'test-user-123',
    },
    {
      id: 'contact-2',
      email: 'jane@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
      full_name: 'Jane Doe',
      company_name: 'Tech Corp',
      phone: null,
      title: 'CTO',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      company_id: 'company-2',
      is_primary: false,
      linkedin_url: null,
      notes: null,
      owner_id: 'test-user-123',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful API responses by default
    vi.mocked(ApiContactService.searchContacts).mockResolvedValue(mockContacts);
    vi.mocked(ApiContactService.findContactByEmail).mockResolvedValue(null);
    vi.mocked(ApiContactService.createContact).mockResolvedValue(mockContacts[0]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Contact Search Functionality', () => {
    it('should fetch and display contacts through API proxy on initial load', async () => {
      render(<ContactSearchModal {...mockProps} />);

      await waitFor(() => {
        expect(ApiContactService.searchContacts).toHaveBeenCalledWith('');
      });

      await waitFor(() => {
        expect(screen.getByText('John Smith')).toBeInTheDocument();
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
        expect(screen.getByText('jane@example.com')).toBeInTheDocument();
      });
    });

    it('should perform search with debouncing when user types', async () => {
      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      const searchInput = screen.getByPlaceholderText('Search by name, email, or company...');
      
      await user.type(searchInput, 'john');

      // Should debounce and not call immediately
      expect(ApiContactService.searchContacts).toHaveBeenCalledTimes(1); // Initial call

      await waitFor(() => {
        expect(ApiContactService.searchContacts).toHaveBeenCalledWith('john');
      }, { timeout: 500 });
    });

    it('should handle search with prefilled email', async () => {
      const propsWithEmail = {
        ...mockProps,
        prefilledEmail: 'john@example.com'
      };

      render(<ContactSearchModal {...propsWithEmail} />);

      await waitFor(() => {
        expect(ApiContactService.searchContacts).toHaveBeenCalledWith('john@example.com');
      });

      const searchInput = screen.getByDisplayValue('john@example.com');
      expect(searchInput).toBeInTheDocument();
    });

    it('should display loading state during search', async () => {
      // Mock delayed response
      vi.mocked(ApiContactService.searchContacts).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockContacts), 100))
      );

      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      const searchInput = screen.getByPlaceholderText('Search by name, email, or company...');
      await user.type(searchInput, 'test');

      expect(screen.getByText('Searching contacts...')).toBeInTheDocument();
    });

    it('should handle API errors gracefully', async () => {
      vi.mocked(ApiContactService.searchContacts).mockRejectedValue(
        new Error('Network error')
      );

      render(<ContactSearchModal {...mockProps} />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to search contacts');
      });
    });

    it('should display "no contacts found" when search returns empty results', async () => {
      vi.mocked(ApiContactService.searchContacts).mockResolvedValue([]);

      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      const searchInput = screen.getByPlaceholderText('Search by name, email, or company...');
      await user.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText('No contacts found')).toBeInTheDocument();
      });
    });

    it('should call onContactSelect when a contact is clicked', async () => {
      render(<ContactSearchModal {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('John Smith')).toBeInTheDocument();
      });

      const contactButton = screen.getByText('John Smith').closest('button');
      expect(contactButton).toBeInTheDocument();
      
      if (contactButton) {
        fireEvent.click(contactButton);
        expect(mockProps.onContactSelect).toHaveBeenCalledWith(mockContacts[0]);
        expect(mockProps.onClose).toHaveBeenCalled();
      }
    });
  });

  describe('Contact Creation Flow', () => {
    it('should show create form when "Create New Contact" is clicked', async () => {
      render(<ContactSearchModal {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText('Create New Contact')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Create New Contact'));

      await waitFor(() => {
        expect(screen.getByText('Create & Select Contact')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('First Name *')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Email Address *')).toBeInTheDocument();
      });
    });

    it('should prefill form with provided name and email', async () => {
      const propsWithData = {
        ...mockProps,
        prefilledEmail: 'new@example.com',
        prefilledName: 'New User'
      };

      render(<ContactSearchModal {...propsWithData} />);

      fireEvent.click(screen.getByText('Create New Contact'));

      await waitFor(() => {
        expect(screen.getByDisplayValue('New')).toBeInTheDocument(); // First name
        expect(screen.getByDisplayValue('User')).toBeInTheDocument(); // Last name
        expect(screen.getByDisplayValue('new@example.com')).toBeInTheDocument();
      });
    });

    it('should validate required fields before creating contact', async () => {
      render(<ContactSearchModal {...mockProps} />);

      fireEvent.click(screen.getByText('Create New Contact'));

      await waitFor(() => {
        const createButton = screen.getByText('Create & Select Contact');
        fireEvent.click(createButton);
      });

      expect(toast.error).toHaveBeenCalledWith('Email and first name are required');
    });

    it('should check for existing contact before creating', async () => {
      const existingContact = mockContacts[0];
      vi.mocked(ApiContactService.findContactByEmail).mockResolvedValue(existingContact);

      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      fireEvent.click(screen.getByText('Create New Contact'));

      await waitFor(() => {
        const firstNameInput = screen.getByPlaceholderText('First Name *');
        const emailInput = screen.getByPlaceholderText('Email Address *');
        
        return firstNameInput && emailInput;
      });

      const firstNameInput = screen.getByPlaceholderText('First Name *');
      const emailInput = screen.getByPlaceholderText('Email Address *');

      await user.type(firstNameInput, 'John');
      await user.type(emailInput, 'john@example.com');

      const createButton = screen.getByText('Create & Select Contact');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(ApiContactService.findContactByEmail).toHaveBeenCalledWith('john@example.com');
        expect(toast.error).toHaveBeenCalledWith('A contact with this email already exists');
        expect(mockProps.onContactSelect).toHaveBeenCalledWith(existingContact);
      });
    });

    it('should successfully create new contact through API', async () => {
      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      fireEvent.click(screen.getByText('Create New Contact'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('First Name *')).toBeInTheDocument();
      });

      const firstNameInput = screen.getByPlaceholderText('First Name *');
      const lastNameInput = screen.getByPlaceholderText('Last Name');
      const emailInput = screen.getByPlaceholderText('Email Address *');
      const phoneInput = screen.getByPlaceholderText('Phone Number');
      const companyInput = screen.getByPlaceholderText('Company Name');
      const titleInput = screen.getByPlaceholderText('Job Title');

      await user.type(firstNameInput, 'New');
      await user.type(lastNameInput, 'Contact');
      await user.type(emailInput, 'new@example.com');
      await user.type(phoneInput, '+1234567890');
      await user.type(companyInput, 'New Company');
      await user.type(titleInput, 'Manager');

      const createButton = screen.getByText('Create & Select Contact');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(ApiContactService.createContact).toHaveBeenCalledWith({
          first_name: 'New',
          last_name: 'Contact',
          email: 'new@example.com',
          phone: '+1234567890',
          title: 'Manager',
          company: 'New Company',
          owner_id: 'test-user-123',
          is_primary: false,
        });
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Contact created successfully!');
        expect(mockProps.onContactSelect).toHaveBeenCalledWith(mockContacts[0]);
        expect(mockProps.onClose).toHaveBeenCalled();
      });
    });

    it('should handle contact creation errors', async () => {
      vi.mocked(ApiContactService.createContact).mockRejectedValue(
        new Error('Creation failed')
      );

      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      fireEvent.click(screen.getByText('Create New Contact'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('First Name *')).toBeInTheDocument();
      });

      const firstNameInput = screen.getByPlaceholderText('First Name *');
      const emailInput = screen.getByPlaceholderText('Email Address *');

      await user.type(firstNameInput, 'New');
      await user.type(emailInput, 'new@example.com');

      const createButton = screen.getByText('Create & Select Contact');
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create contact');
      });
    });

    it('should show loading state during contact creation', async () => {
      vi.mocked(ApiContactService.createContact).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockContacts[0]), 100))
      );

      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      fireEvent.click(screen.getByText('Create New Contact'));

      await waitFor(() => {
        expect(screen.getByPlaceholderText('First Name *')).toBeInTheDocument();
      });

      const firstNameInput = screen.getByPlaceholderText('First Name *');
      const emailInput = screen.getByPlaceholderText('Email Address *');

      await user.type(firstNameInput, 'New');
      await user.type(emailInput, 'new@example.com');

      const createButton = screen.getByText('Create & Select Contact');
      fireEvent.click(createButton);

      // Should show loading spinner
      await waitFor(() => {
        const buttonElement = screen.getByRole('button', { name: /create & select contact/i });
        expect(buttonElement).toBeDisabled();
      });
    });
  });

  describe('API Proxy Verification', () => {
    it('should call search API endpoint with correct parameters', async () => {
      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      const searchInput = screen.getByPlaceholderText('Search by name, email, or company...');
      await user.type(searchInput, 'john@example.com');

      await waitFor(() => {
        expect(ApiContactService.searchContacts).toHaveBeenCalledWith('john@example.com');
      });
    });

    it('should handle network timeouts gracefully', async () => {
      vi.mocked(ApiContactService.searchContacts).mockRejectedValue(
        new Error('Request timeout')
      );

      render(<ContactSearchModal {...mockProps} />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to search contacts');
      });

      // Should display fallback empty state
      await waitFor(() => {
        expect(screen.getByText('No contacts yet')).toBeInTheDocument();
      });
    });

    it('should verify API calls are made through proxy configuration', async () => {
      // This test ensures the component uses the correct API service
      render(<ContactSearchModal {...mockProps} />);

      await waitFor(() => {
        expect(ApiContactService.searchContacts).toHaveBeenCalled();
      });

      // Verify the API service is being used (which should route through the proxy)
      expect(vi.mocked(ApiContactService.searchContacts)).toHaveBeenCalledWith('');
    });
  });
});