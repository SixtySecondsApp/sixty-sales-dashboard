import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DealWizard } from '@/components/DealWizard';

// Mock the hooks
vi.mock('@/lib/hooks/useUser', () => ({
  useUser: () => ({
    userData: { id: 'test-user-id' }
  })
}));

vi.mock('@/lib/hooks/useDeals', () => ({
  useDeals: () => ({
    deals: [
      {
        id: 'deal-1',
        name: 'Test Deal',
        company: 'Test Company',
        value: 10000,
        stage_id: 'stage-1',
        status: 'active',
        description: 'Test description',
        expected_close_date: '2024-12-31'
      }
    ],
    createDeal: vi.fn().mockResolvedValue({
      id: 'new-deal-id',
      name: 'New Deal',
      company: 'New Company'
    }),
    updateDeal: vi.fn().mockResolvedValue({
      id: 'deal-1',
      name: 'Updated Deal'
    })
  })
}));

vi.mock('@/lib/hooks/useDealStages', () => ({
  useDealStages: () => ({
    stages: [
      {
        id: 'stage-1',
        name: 'Opportunity',
        default_probability: 10
      },
      {
        id: 'stage-2',
        name: 'Qualified',
        default_probability: 25
      }
    ]
  })
}));

vi.mock('@/lib/hooks/useContacts', () => ({
  useContacts: () => ({
    contacts: [
      {
        id: 'contact-1',
        full_name: 'John Doe',
        email: 'john@example.com',
        company: { name: 'Example Corp' }
      }
    ],
    createContact: vi.fn().mockResolvedValue({
      id: 'new-contact-id',
      full_name: 'Jane Smith',
      email: 'jane@example.com'
    }),
    findContactByEmail: vi.fn().mockResolvedValue(null),
    autoCreateFromEmail: vi.fn().mockResolvedValue({
      id: 'auto-contact-id',
      full_name: 'Auto Contact',
      email: 'auto@example.com'
    })
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

describe('DealWizard', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    onDealCreated: vi.fn(),
    initialData: {
      clientName: 'Test Client',
      contactEmail: 'test@example.com',
      dealValue: 5000
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Step 1: Choose Deal Type', () => {
    it('should render the initial step with two options', () => {
      render(<DealWizard {...mockProps} />);
      
      expect(screen.getByText('What would you like to do?')).toBeInTheDocument();
      expect(screen.getByText('Create New Deal')).toBeInTheDocument();
      expect(screen.getByText('Update Existing Deal')).toBeInTheDocument();
    });

    it('should navigate to new deal flow when Create New Deal is clicked', async () => {
      const user = userEvent.setup();
      render(<DealWizard {...mockProps} />);
      
      const createNewButton = screen.getByText('Create New Deal');
      await user.click(createNewButton);
      
      expect(screen.getByText('Create New Deal')).toBeInTheDocument();
      expect(screen.getByText('First, let\'s identify your contact')).toBeInTheDocument();
    });

    it('should navigate to update deal flow when Update Existing Deal is clicked', async () => {
      const user = userEvent.setup();
      render(<DealWizard {...mockProps} />);
      
      const updateDealButton = screen.getByText('Update Existing Deal');
      await user.click(updateDealButton);
      
      expect(screen.getByText('Update Existing Deal')).toBeInTheDocument();
      expect(screen.getByText('Select a deal to modify')).toBeInTheDocument();
    });
  });

  describe('Step 2A: New Deal Flow', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<DealWizard {...mockProps} />);
      
      const createNewButton = screen.getByText('Create New Deal');
      await user.click(createNewButton);
    });

    it('should pre-populate contact information from initial data', () => {
      expect(screen.getByDisplayValue('Test Client')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();
    });

    it('should allow user to enter contact information manually', async () => {
      const user = userEvent.setup();
      
      const nameInput = screen.getByPlaceholderText('Contact Name');
      const emailInput = screen.getByPlaceholderText('Email Address *');
      
      await user.clear(nameInput);
      await user.type(nameInput, 'New Contact');
      await user.clear(emailInput);
      await user.type(emailInput, 'new@example.com');
      
      expect(screen.getByDisplayValue('New Contact')).toBeInTheDocument();
      expect(screen.getByDisplayValue('new@example.com')).toBeInTheDocument();
    });

    it('should create contact and show deal form when Create Contact is clicked', async () => {
      const user = userEvent.setup();
      
      const createContactButton = screen.getByText('Create Contact');
      await user.click(createContactButton);
      
      await waitFor(() => {
        expect(screen.getByText('Contact Selected')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Deal Information')).toBeInTheDocument();
    });

    it('should validate required fields when creating deal', async () => {
      const user = userEvent.setup();
      
      // First create contact
      const createContactButton = screen.getByText('Create Contact');
      await user.click(createContactButton);
      
      await waitFor(() => {
        expect(screen.getByText('Deal Information')).toBeInTheDocument();
      });
      
      // Clear the deal name field
      const dealNameInput = screen.getByPlaceholderText('Deal Name *');
      await user.clear(dealNameInput);
      
      // Try to create deal
      const createDealButton = screen.getByText('Create Deal');
      expect(createDealButton).toBeDisabled();
    });

    it('should successfully create deal with valid data', async () => {
      const user = userEvent.setup();
      
      // Create contact first
      const createContactButton = screen.getByText('Create Contact');
      await user.click(createContactButton);
      
      await waitFor(() => {
        expect(screen.getByText('Deal Information')).toBeInTheDocument();
      });
      
      // Fill in deal information
      const valueInput = screen.getByPlaceholderText('Deal Value (£)');
      await user.type(valueInput, '15000');
      
      // Create deal
      const createDealButton = screen.getByText('Create Deal');
      await user.click(createDealButton);
      
      await waitFor(() => {
        expect(screen.getByText('Deal Created Successfully!')).toBeInTheDocument();
      });
    });
  });

  describe('Step 2B: Update Existing Deal Flow', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<DealWizard {...mockProps} />);
      
      const updateDealButton = screen.getByText('Update Existing Deal');
      await user.click(updateDealButton);
    });

    it('should display list of active deals', () => {
      expect(screen.getByText('Test Deal')).toBeInTheDocument();
      expect(screen.getByText('Test Company')).toBeInTheDocument();
    });

    it('should select deal and populate form', async () => {
      const user = userEvent.setup();
      
      const dealButton = screen.getByText('Test Deal');
      await user.click(dealButton);
      
      await waitFor(() => {
        expect(screen.getByText('Deal Selected')).toBeInTheDocument();
      });
      
      expect(screen.getByDisplayValue('Test Deal')).toBeInTheDocument();
      expect(screen.getByDisplayValue('10000')).toBeInTheDocument();
    });

    it('should update deal successfully', async () => {
      const user = userEvent.setup();
      
      // Select deal
      const dealButton = screen.getByText('Test Deal');
      await user.click(dealButton);
      
      await waitFor(() => {
        expect(screen.getByText('Update Deal Information')).toBeInTheDocument();
      });
      
      // Modify deal name
      const dealNameInput = screen.getByDisplayValue('Test Deal');
      await user.clear(dealNameInput);
      await user.type(dealNameInput, 'Updated Deal Name');
      
      // Update deal
      const updateButton = screen.getByText('Update Deal');
      await user.click(updateButton);
      
      await waitFor(() => {
        expect(screen.getByText('Deal Updated Successfully!')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation and State Management', () => {
    it('should handle back navigation correctly', async () => {
      const user = userEvent.setup();
      render(<DealWizard {...mockProps} />);
      
      // Navigate to new deal flow
      await user.click(screen.getByText('Create New Deal'));
      expect(screen.getByText('Create New Deal')).toBeInTheDocument();
      
      // Navigate back
      const backButton = screen.getByLabelText('Back');
      await user.click(backButton);
      
      expect(screen.getByText('What would you like to do?')).toBeInTheDocument();
    });

    it('should close modal when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<DealWizard {...mockProps} />);
      
      const closeButton = screen.getByLabelText('Close');
      await user.click(closeButton);
      
      expect(mockProps.onClose).toHaveBeenCalled();
    });

    it('should reset wizard state when closed', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<DealWizard {...mockProps} />);
      
      // Navigate to new deal flow
      await user.click(screen.getByText('Create New Deal'));
      
      // Close and reopen
      rerender(<DealWizard {...mockProps} isOpen={false} />);
      rerender(<DealWizard {...mockProps} />);
      
      expect(screen.getByText('What would you like to do?')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle contact creation errors gracefully', async () => {
      const user = userEvent.setup();
      
      // Mock error in contact creation
      const { useContacts } = await import('@/lib/hooks/useContacts');
      vi.mocked(useContacts).mockReturnValue({
        ...useContacts(),
        autoCreateFromEmail: vi.fn().mockRejectedValue(new Error('Network error'))
      } as any);
      
      render(<DealWizard {...mockProps} />);
      
      await user.click(screen.getByText('Create New Deal'));
      
      const createContactButton = screen.getByText('Create Contact');
      await user.click(createContactButton);
      
      // Should show error state but not crash
      expect(createContactButton).not.toBeDisabled();
    });

    it('should handle deal creation errors gracefully', async () => {
      const user = userEvent.setup();
      
      // Mock error in deal creation
      const { useDeals } = await import('@/lib/hooks/useDeals');
      vi.mocked(useDeals).mockReturnValue({
        ...useDeals(),
        createDeal: vi.fn().mockRejectedValue(new Error('Deal creation failed'))
      } as any);
      
      render(<DealWizard {...mockProps} />);
      
      await user.click(screen.getByText('Create New Deal'));
      
      // Create contact first
      const createContactButton = screen.getByText('Create Contact');
      await user.click(createContactButton);
      
      await waitFor(() => {
        expect(screen.getByText('Deal Information')).toBeInTheDocument();
      });
      
      // Try to create deal
      const createDealButton = screen.getByText('Create Deal');
      await user.click(createDealButton);
      
      // Should handle error gracefully
      expect(createDealButton).not.toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for interactive elements', () => {
      render(<DealWizard {...mockProps} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<DealWizard {...mockProps} />);
      
      // Tab through elements
      await user.tab();
      expect(screen.getByText('Create New Deal')).toHaveFocus();
      
      await user.tab();
      expect(screen.getByText('Update Existing Deal')).toHaveFocus();
    });

    it('should announce step progress to screen readers', () => {
      render(<DealWizard {...mockProps} />);
      
      // Progress indicators should be visible
      const progressSteps = screen.getAllByText(/^[123]$/);
      expect(progressSteps).toHaveLength(3);
    });
  });
});