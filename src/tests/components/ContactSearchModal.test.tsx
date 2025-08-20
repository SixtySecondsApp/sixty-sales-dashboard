import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ContactSearchModal } from '@/components/ContactSearchModal';

// Mock the hooks
vi.mock('@/lib/hooks/useUser', () => ({
  useUser: () => ({
    userData: { id: 'test-user-id' }
  })
}));

vi.mock('@/lib/hooks/useContacts', () => ({
  useContacts: () => ({
    contacts: [
      {
        id: 'contact-1',
        full_name: 'John Doe',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '+44 7700 900123',
        company: { id: 'company-1', name: 'Example Corp' }
      },
      {
        id: 'contact-2',
        full_name: 'Jane Smith',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
        phone: null,
        company: null
      }
    ],
    isLoading: false,
    searchContacts: vi.fn().mockResolvedValue([
      {
        id: 'search-result-1',
        full_name: 'Search Result',
        email: 'search@example.com',
        company: { name: 'Search Corp' }
      }
    ]),
    createContact: vi.fn().mockResolvedValue({
      id: 'new-contact-id',
      full_name: 'New Contact',
      email: 'new@example.com'
    }),
    findContactByEmail: vi.fn().mockResolvedValue(null)
  })
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>
  },
  AnimatePresence: ({ children }: any) => children
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

describe('ContactSearchModal', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    onContactSelect: vi.fn(),
    prefilledEmail: '',
    prefilledName: ''
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal State', () => {
    it('should not render when isOpen is false', () => {
      render(<ContactSearchModal {...mockProps} isOpen={false} />);
      expect(screen.queryByText('Select Contact')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(<ContactSearchModal {...mockProps} />);
      expect(screen.getByText('Select Contact')).toBeInTheDocument();
      expect(screen.getByText('Search for existing contacts or create a new one')).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);
      
      const closeButton = screen.getByLabelText('Close');
      await user.click(closeButton);
      
      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Contact Search', () => {
    it('should display default contacts on initial load', () => {
      render(<ContactSearchModal {...mockProps} />);
      
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('Example Corp')).toBeInTheDocument();
      
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });

    it('should search contacts when query is entered', async () => {
      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search by name, email, or company...');
      await user.type(searchInput, 'search');
      
      // Wait for debounced search
      await waitFor(() => {
        expect(screen.getByText('Search Result')).toBeInTheDocument();
      }, { timeout: 500 });
    });

    it('should show loading state during search', async () => {
      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);
      
      // Mock slow search
      const { useContacts } = await import('@/lib/hooks/useContacts');
      vi.mocked(useContacts).mockReturnValue({
        ...useContacts(),
        searchContacts: vi.fn(() => new Promise(resolve => setTimeout(resolve, 1000)))
      } as any);
      
      const searchInput = screen.getByPlaceholderText('Search by name, email, or company...');
      await user.type(searchInput, 'slow search');
      
      await waitFor(() => {
        expect(screen.getByText('Searching contacts...')).toBeInTheDocument();
      });
    });

    it('should handle search errors gracefully', async () => {
      const user = userEvent.setup();
      
      // Mock search error
      const { useContacts } = await import('@/lib/hooks/useContacts');
      vi.mocked(useContacts).mockReturnValue({
        ...useContacts(),
        searchContacts: vi.fn().mockRejectedValue(new Error('Search failed'))
      } as any);
      
      render(<ContactSearchModal {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search by name, email, or company...');
      await user.type(searchInput, 'error');
      
      // Should not crash and should show no results
      await waitFor(() => {
        expect(screen.queryByText('Search failed')).not.toBeInTheDocument();
      });
    });
  });

  describe('Contact Selection', () => {
    it('should call onContactSelect when contact is clicked', async () => {
      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);
      
      const contactButton = screen.getByText('John Doe');
      await user.click(contactButton);
      
      expect(mockProps.onContactSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'contact-1',
          full_name: 'John Doe',
          email: 'john@example.com'
        })
      );
      expect(mockProps.onClose).toHaveBeenCalled();
    });

    it('should display contact information correctly', () => {
      render(<ContactSearchModal {...mockProps} />);
      
      // Check John Doe has all info
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('+44 7700 900123')).toBeInTheDocument();
      expect(screen.getByText('Example Corp')).toBeInTheDocument();
      
      // Check Jane Smith doesn't show phone/company
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });
  });

  describe('Contact Creation', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);
      
      const createButton = screen.getByText('Create New Contact');
      await user.click(createButton);
    });

    it('should show create form when Create New Contact is clicked', async () => {
      expect(screen.getByText('Create New Contact')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('First Name *')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Last Name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Email Address *')).toBeInTheDocument();
    });

    it('should validate required fields', async () => {
      const user = userEvent.setup();
      
      const createButton = screen.getByText('Create & Select Contact');
      expect(createButton).toBeDisabled();
      
      // Fill first name only
      const firstNameInput = screen.getByPlaceholderText('First Name *');
      await user.type(firstNameInput, 'Test');
      
      expect(createButton).toBeDisabled(); // Still disabled without email
      
      // Add email
      const emailInput = screen.getByPlaceholderText('Email Address *');
      await user.type(emailInput, 'test@example.com');
      
      expect(createButton).toBeEnabled();
    });

    it('should create contact with valid data', async () => {
      const user = userEvent.setup();
      
      // Fill form
      await user.type(screen.getByPlaceholderText('First Name *'), 'New');
      await user.type(screen.getByPlaceholderText('Last Name'), 'Contact');
      await user.type(screen.getByPlaceholderText('Email Address *'), 'new@example.com');
      await user.type(screen.getByPlaceholderText('Phone Number'), '+44 7700 123456');
      await user.type(screen.getByPlaceholderText('Company Name'), 'New Corp');
      await user.type(screen.getByPlaceholderText('Job Title'), 'Manager');
      
      // Submit
      const createButton = screen.getByText('Create & Select Contact');
      await user.click(createButton);
      
      await waitFor(() => {
        expect(mockProps.onContactSelect).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'new-contact-id',
            full_name: 'New Contact',
            email: 'new@example.com'
          })
        );
      });
    });

    it('should handle existing contact error', async () => {
      const user = userEvent.setup();
      
      // Mock existing contact
      const { useContacts } = await import('@/lib/hooks/useContacts');
      vi.mocked(useContacts).mockReturnValue({
        ...useContacts(),
        findContactByEmail: vi.fn().mockResolvedValue({
          id: 'existing-contact',
          full_name: 'Existing Contact',
          email: 'existing@example.com'
        })
      } as any);
      
      // Fill form with existing email
      await user.type(screen.getByPlaceholderText('First Name *'), 'Duplicate');
      await user.type(screen.getByPlaceholderText('Email Address *'), 'existing@example.com');
      
      const createButton = screen.getByText('Create & Select Contact');
      await user.click(createButton);
      
      await waitFor(() => {
        expect(mockProps.onContactSelect).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'existing-contact',
            email: 'existing@example.com'
          })
        );
      });
    });

    it('should handle creation errors', async () => {
      const user = userEvent.setup();
      
      // Mock creation error
      const { useContacts } = await import('@/lib/hooks/useContacts');
      vi.mocked(useContacts).mockReturnValue({
        ...useContacts(),
        createContact: vi.fn().mockRejectedValue(new Error('Creation failed'))
      } as any);
      
      // Fill and submit form
      await user.type(screen.getByPlaceholderText('First Name *'), 'Error');
      await user.type(screen.getByPlaceholderText('Email Address *'), 'error@example.com');
      
      const createButton = screen.getByText('Create & Select Contact');
      await user.click(createButton);
      
      // Should handle error gracefully
      await waitFor(() => {
        expect(createButton).not.toBeDisabled();
      });
    });
  });

  describe('Prefilled Data', () => {
    it('should populate form with prefilled email and name', () => {
      render(
        <ContactSearchModal
          {...mockProps}
          prefilledEmail="prefilled@example.com"
          prefilledName="Prefilled Name"
        />
      );
      
      // Should search with prefilled email
      expect(screen.getByDisplayValue('prefilled@example.com')).toBeInTheDocument();
    });

    it('should split prefilled name correctly', async () => {
      const user = userEvent.setup();
      render(
        <ContactSearchModal
          {...mockProps}
          prefilledName="John Michael Smith"
        />
      );
      
      // Open create form
      const createButton = screen.getByText('Create New Contact');
      await user.click(createButton);
      
      // Check name split
      expect(screen.getByDisplayValue('John')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Michael Smith')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ContactSearchModal {...mockProps} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);
      
      // Tab through search input
      await user.tab();
      expect(screen.getByPlaceholderText('Search by name, email, or company...')).toHaveFocus();
    });

    it('should handle escape key to close modal', async () => {
      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);
      
      await user.keyboard('{Escape}');
      expect(mockProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Empty States', () => {
    it('should show appropriate message when no contacts found', async () => {
      const user = userEvent.setup();
      
      // Mock empty search
      const { useContacts } = await import('@/lib/hooks/useContacts');
      vi.mocked(useContacts).mockReturnValue({
        ...useContacts(),
        searchContacts: vi.fn().mockResolvedValue([])
      } as any);
      
      render(<ContactSearchModal {...mockProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search by name, email, or company...');
      await user.type(searchInput, 'nonexistent');
      
      await waitFor(() => {
        expect(screen.getByText('No contacts found')).toBeInTheDocument();
        expect(screen.getByText('No contacts match "nonexistent"')).toBeInTheDocument();
      });
    });

    it('should show start searching message initially', () => {
      render(<ContactSearchModal {...mockProps} />);
      
      // Clear the search to show empty state
      const searchInput = screen.getByPlaceholderText('Search by name, email, or company...');
      fireEvent.change(searchInput, { target: { value: '' } });
      
      expect(screen.getByText('Start searching')).toBeInTheDocument();
    });
  });
});