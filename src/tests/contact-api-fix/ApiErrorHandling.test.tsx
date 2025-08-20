import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiContactService } from '@/lib/services/apiContactService';
import { ContactSearchModal } from '@/components/ContactSearchModal';
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

describe('API Error Handling Tests', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    onContactSelect: vi.fn(),
    prefilledEmail: '',
    prefilledName: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Network Failure Scenarios', () => {
    it('should handle complete network failure during contact search', async () => {
      vi.mocked(ApiContactService.searchContacts).mockRejectedValue(
        new Error('NetworkError: Failed to fetch')
      );

      render(<ContactSearchModal {...mockProps} />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to search contacts');
      });

      // Should show empty state
      expect(screen.getByText('No contacts yet')).toBeInTheDocument();
      expect(screen.getByText('Create your first contact to get started')).toBeInTheDocument();
    });

    it('should handle timeout errors during contact search', async () => {
      vi.mocked(ApiContactService.searchContacts).mockRejectedValue(
        new Error('Request timeout after 30000ms')
      );

      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      const searchInput = screen.getByPlaceholderText('Search by name, email, or company...');
      await user.type(searchInput, 'test');

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to search contacts');
      });

      // Should clear search results
      expect(screen.getByText('No contacts found')).toBeInTheDocument();
    });

    it('should handle network failure during contact creation', async () => {
      // Mock successful search but failed creation
      vi.mocked(ApiContactService.searchContacts).mockResolvedValue([]);
      vi.mocked(ApiContactService.findContactByEmail).mockResolvedValue(null);
      vi.mocked(ApiContactService.createContact).mockRejectedValue(
        new Error('NetworkError: Failed to fetch')
      );

      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      // Open create form
      await waitFor(() => {
        fireEvent.click(screen.getByText('Create New Contact'));
      });

      // Fill form
      const firstNameInput = screen.getByPlaceholderText('First Name *');
      const emailInput = screen.getByPlaceholderText('Email Address *');

      await user.type(firstNameInput, 'Test');
      await user.type(emailInput, 'test@example.com');

      // Try to create
      fireEvent.click(screen.getByText('Create & Select Contact'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create contact');
      });

      // Should remain in creation form
      expect(screen.getByText('Create & Select Contact')).toBeInTheDocument();
    });
  });

  describe('HTTP Error Responses', () => {
    it('should handle 404 errors during contact search', async () => {
      vi.mocked(ApiContactService.searchContacts).mockRejectedValue(
        new Error('HTTP error! status: 404')
      );

      render(<ContactSearchModal {...mockProps} />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to search contacts');
      });

      // Should show appropriate empty state
      expect(screen.getByText('No contacts yet')).toBeInTheDocument();
    });

    it('should handle 500 errors during contact creation', async () => {
      vi.mocked(ApiContactService.searchContacts).mockResolvedValue([]);
      vi.mocked(ApiContactService.findContactByEmail).mockResolvedValue(null);
      vi.mocked(ApiContactService.createContact).mockRejectedValue(
        new Error('HTTP error! status: 500')
      );

      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      // Navigate to creation
      fireEvent.click(screen.getByText('Create New Contact'));

      const firstNameInput = screen.getByPlaceholderText('First Name *');
      const emailInput = screen.getByPlaceholderText('Email Address *');

      await user.type(firstNameInput, 'Server');
      await user.type(emailInput, 'server@error.com');

      fireEvent.click(screen.getByText('Create & Select Contact'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create contact');
      });
    });

    it('should handle 401 unauthorized errors', async () => {
      vi.mocked(ApiContactService.searchContacts).mockRejectedValue(
        new Error('HTTP error! status: 401')
      );

      render(<ContactSearchModal {...mockProps} />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to search contacts');
      });
    });

    it('should handle 403 forbidden errors', async () => {
      vi.mocked(ApiContactService.createContact).mockRejectedValue(
        new Error('HTTP error! status: 403')
      );

      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      fireEvent.click(screen.getByText('Create New Contact'));

      const firstNameInput = screen.getByPlaceholderText('First Name *');
      const emailInput = screen.getByPlaceholderText('Email Address *');

      await user.type(firstNameInput, 'Forbidden');
      await user.type(emailInput, 'forbidden@example.com');

      fireEvent.click(screen.getByText('Create & Select Contact'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create contact');
      });
    });
  });

  describe('API Response Format Errors', () => {
    it('should handle malformed JSON responses', async () => {
      vi.mocked(ApiContactService.searchContacts).mockRejectedValue(
        new Error('SyntaxError: Unexpected token < in JSON')
      );

      render(<ContactSearchModal {...mockProps} />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to search contacts');
      });
    });

    it('should handle unexpected response structure', async () => {
      // Mock response with unexpected structure (null instead of array)
      vi.mocked(ApiContactService.searchContacts).mockResolvedValue(null as any);

      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      const searchInput = screen.getByPlaceholderText('Search by name, email, or company...');
      await user.type(searchInput, 'test');

      // Should handle null response gracefully
      await waitFor(() => {
        expect(screen.getByText('No contacts found')).toBeInTheDocument();
      });
    });

    it('should handle API responses with missing required fields', async () => {
      const incompleteContact = {
        id: 'incomplete-123',
        // Missing required fields like email, name, etc.
      };

      vi.mocked(ApiContactService.searchContacts).mockResolvedValue([incompleteContact] as any);

      render(<ContactSearchModal {...mockProps} />);

      await waitFor(() => {
        // Should display contact even with missing data
        expect(screen.getByText('Unknown Contact')).toBeInTheDocument();
      });
    });
  });

  describe('Retry and Recovery Mechanisms', () => {
    it('should allow retry after search failure', async () => {
      const mockContacts = [
        {
          id: 'contact-1',
          email: 'retry@example.com',
          first_name: 'Retry',
          last_name: 'User',
          full_name: 'Retry User',
          company_name: 'Retry Corp',
          phone: null,
          title: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          company_id: 'company-retry',
          is_primary: false,
          linkedin_url: null,
          notes: null,
          owner_id: 'test-user-123',
        },
      ];

      // First call fails, second succeeds
      vi.mocked(ApiContactService.searchContacts)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(mockContacts);

      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      // Initial load fails
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to search contacts');
      });

      // User tries searching again
      const searchInput = screen.getByPlaceholderText('Search by name, email, or company...');
      await user.type(searchInput, 'retry');

      // Second attempt should succeed
      await waitFor(() => {
        expect(screen.getByText('Retry User')).toBeInTheDocument();
      });
    });

    it('should recover from creation failure and allow retry', async () => {
      const mockContact = {
        id: 'retry-contact-123',
        email: 'retry@create.com',
        first_name: 'Retry',
        last_name: 'Create',
        full_name: 'Retry Create',
        company_name: null,
        phone: null,
        title: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        company_id: null,
        is_primary: false,
        linkedin_url: null,
        notes: null,
        owner_id: 'test-user-123',
      };

      vi.mocked(ApiContactService.searchContacts).mockResolvedValue([]);
      vi.mocked(ApiContactService.findContactByEmail).mockResolvedValue(null);
      
      // First creation fails, second succeeds
      vi.mocked(ApiContactService.createContact)
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValue(mockContact);

      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      fireEvent.click(screen.getByText('Create New Contact'));

      const firstNameInput = screen.getByPlaceholderText('First Name *');
      const emailInput = screen.getByPlaceholderText('Email Address *');

      await user.type(firstNameInput, 'Retry');
      await user.type(emailInput, 'retry@create.com');

      // First attempt fails
      fireEvent.click(screen.getByText('Create & Select Contact'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create contact');
      });

      // Form should still be available for retry
      expect(screen.getByText('Create & Select Contact')).toBeInTheDocument();

      // Retry creation
      fireEvent.click(screen.getByText('Create & Select Contact'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Contact created successfully!');
      });
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty search results gracefully', async () => {
      vi.mocked(ApiContactService.searchContacts).mockResolvedValue([]);

      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      const searchInput = screen.getByPlaceholderText('Search by name, email, or company...');
      await user.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText('No contacts found')).toBeInTheDocument();
        expect(screen.getByText(/No contacts match "nonexistent"/)).toBeInTheDocument();
      });
    });

    it('should handle very long search queries', async () => {
      const longQuery = 'a'.repeat(1000);
      vi.mocked(ApiContactService.searchContacts).mockResolvedValue([]);

      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      const searchInput = screen.getByPlaceholderText('Search by name, email, or company...');
      await user.type(searchInput, longQuery);

      await waitFor(() => {
        expect(ApiContactService.searchContacts).toHaveBeenCalledWith(longQuery);
      });
    });

    it('should handle special characters in search queries', async () => {
      const specialQuery = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      vi.mocked(ApiContactService.searchContacts).mockResolvedValue([]);

      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      const searchInput = screen.getByPlaceholderText('Search by name, email, or company...');
      await user.type(searchInput, specialQuery);

      await waitFor(() => {
        expect(ApiContactService.searchContacts).toHaveBeenCalledWith(specialQuery);
      });
    });

    it('should handle duplicate contact creation attempts', async () => {
      const existingContact = {
        id: 'existing-123',
        email: 'duplicate@example.com',
        first_name: 'Existing',
        last_name: 'User',
        full_name: 'Existing User',
        company_name: 'Existing Corp',
        phone: null,
        title: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        company_id: 'company-existing',
        is_primary: false,
        linkedin_url: null,
        notes: null,
        owner_id: 'test-user-123',
      };

      vi.mocked(ApiContactService.searchContacts).mockResolvedValue([]);
      vi.mocked(ApiContactService.findContactByEmail).mockResolvedValue(existingContact);

      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      fireEvent.click(screen.getByText('Create New Contact'));

      const firstNameInput = screen.getByPlaceholderText('First Name *');
      const emailInput = screen.getByPlaceholderText('Email Address *');

      await user.type(firstNameInput, 'Duplicate');
      await user.type(emailInput, 'duplicate@example.com');

      fireEvent.click(screen.getByText('Create & Select Contact'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('A contact with this email already exists');
        expect(mockProps.onContactSelect).toHaveBeenCalledWith(existingContact);
      });
    });
  });

  describe('Loading State Management', () => {
    it('should show loading state during prolonged search', async () => {
      // Mock delayed response
      vi.mocked(ApiContactService.searchContacts).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 1000))
      );

      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      const searchInput = screen.getByPlaceholderText('Search by name, email, or company...');
      await user.type(searchInput, 'slow');

      // Should show loading indicator
      expect(screen.getByText('Searching contacts...')).toBeInTheDocument();
    });

    it('should handle concurrent search requests correctly', async () => {
      let resolveFirst: (value: any) => void;
      let resolveSecond: (value: any) => void;

      const firstPromise = new Promise(resolve => { resolveFirst = resolve; });
      const secondPromise = new Promise(resolve => { resolveSecond = resolve; });

      vi.mocked(ApiContactService.searchContacts)
        .mockReturnValueOnce(firstPromise)
        .mockReturnValueOnce(secondPromise);

      const user = userEvent.setup();
      render(<ContactSearchModal {...mockProps} />);

      const searchInput = screen.getByPlaceholderText('Search by name, email, or company...');
      
      // Start first search
      await user.type(searchInput, 'first');
      
      // Start second search before first completes
      await user.clear(searchInput);
      await user.type(searchInput, 'second');

      // Complete second search first
      resolveSecond([]);
      await waitFor(() => {
        expect(screen.getByText('No contacts found')).toBeInTheDocument();
      });

      // Complete first search (should be ignored)
      resolveFirst([{
        id: 'late-result',
        email: 'late@example.com',
        first_name: 'Late',
        full_name: 'Late Result'
      }]);

      // Should still show "No contacts found" from second search
      expect(screen.getByText('No contacts found')).toBeInTheDocument();
      expect(screen.queryByText('Late Result')).not.toBeInTheDocument();
    });
  });

  describe('Proxy Configuration Error Handling', () => {
    it('should handle proxy connection failures', async () => {
      vi.mocked(ApiContactService.searchContacts).mockRejectedValue(
        new Error('ECONNREFUSED: Connection refused to proxy target')
      );

      render(<ContactSearchModal {...mockProps} />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to search contacts');
      });

      // Should still allow fallback to contact creation
      expect(screen.getByText('Create New Contact')).toBeInTheDocument();
    });

    it('should handle API gateway timeouts', async () => {
      vi.mocked(ApiContactService.searchContacts).mockRejectedValue(
        new Error('504 Gateway Timeout')
      );

      render(<ContactSearchModal {...mockProps} />);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to search contacts');
      });
    });
  });
});