import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickAdd } from '@/components/QuickAdd';
import { useActivitiesActions } from '@/lib/hooks/useActivitiesActions';
import { useDealsActions } from '@/lib/hooks/useDealsActions';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock the hooks
vi.mock('@/lib/hooks/useActivitiesActions', () => ({
  useActivitiesActions: vi.fn()
}));

vi.mock('@/lib/hooks/useDealsActions', () => ({
  useDealsActions: vi.fn()
}));

vi.mock('@/lib/hooks/useUser', () => ({
  useUser: () => ({
    userData: { id: 'test-user', email: 'test@example.com' },
    isLoading: false
  })
}));

// Mock UserPermissionsContext to avoid needing full provider chain
vi.mock('@/contexts/UserPermissionsContext', () => ({
  UserPermissionsProvider: ({ children }: { children: React.ReactNode }) => children,
  useUserPermissions: () => ({
    effectiveUserType: 'internal',
    isLoading: false,
    canManageUsers: false,
    canAccessAdminFeatures: false,
    isExternalUser: false,
    isInternalUser: true
  })
}));

vi.mock('@/lib/supabase/clientV2', () => ({
  supabase: {
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: 'test-user' } } })
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { first_name: 'Test', last_name: 'User' } })
        }),
        ilike: () => ({
          limit: () => Promise.resolve({ data: [] })
        })
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'new-deal-id' } })
        })
      })
    })
  }
}));

describe('QuickAdd Component - Comprehensive Activity Tests', () => {
  const mockAddActivity = vi.fn();
  const mockAddSale = vi.fn();
  const mockFindDealsByClient = vi.fn();
  const mockMoveDealToStage = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup the mocked hooks
    (useActivitiesActions as any).mockReturnValue({
      addActivity: mockAddActivity.mockResolvedValue({ id: 'activity-123' }),
      addSale: mockAddSale.mockResolvedValue({ id: 'sale-123' })
    });

    (useDealsActions as any).mockReturnValue({
      findDealsByClient: mockFindDealsByClient.mockResolvedValue([]),
      moveDealToStage: mockMoveDealToStage.mockResolvedValue(undefined)
    });
  });

  const renderQuickAdd = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <QuickAdd isOpen={true} onClose={() => {}} />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };
  
  describe('Outbound Activities', () => {
    it('should correctly capture outbound type (Call/LinkedIn/Email)', async () => {
      renderQuickAdd();
      
      // Select the outbound action
      const outboundButton = screen.getByText('Add Outbound');
      await userEvent.click(outboundButton);
      
      // Fill the form with test data
      await userEvent.type(screen.getByLabelText('Prospect Name'), 'Test Prospect');
      
      // Select LinkedIn as outbound type
      const outboundTypeSelect = screen.getByLabelText('Outbound Type');
      await userEvent.selectOptions(outboundTypeSelect, 'LinkedIn');
      
      // Set outbound count
      await userEvent.clear(screen.getByLabelText('Number of Contacts'));
      await userEvent.type(screen.getByLabelText('Number of Contacts'), '5');
      
      // Submit the form
      const submitButton = screen.getByRole('button', { name: /save|submit/i });
      await userEvent.click(submitButton);
      
      // Verify that addActivity was called with correct parameters
      await waitFor(() => {
        expect(mockAddActivity).toHaveBeenCalledTimes(1);
        expect(mockAddActivity).toHaveBeenCalledWith(expect.objectContaining({
          type: 'outbound',
          client_name: 'Test Prospect',
          details: expect.stringContaining('LinkedIn'),
          quantity: 5
        }));
      });
    });
    
    it('should handle outbound without contact identifier', async () => {
      renderQuickAdd();
      
      const outboundButton = screen.getByText('Add Outbound');
      await userEvent.click(outboundButton);
      
      await userEvent.type(screen.getByLabelText('Prospect Name'), 'No Identifier Prospect');
      
      const submitButton = screen.getByRole('button', { name: /save|submit/i });
      await userEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockAddActivity).toHaveBeenCalledTimes(1);
        const callArgs = mockAddActivity.mock.calls[0][0];
        expect(callArgs.type).toBe('outbound');
        expect(callArgs.client_name).toBe('No Identifier Prospect');
        expect(callArgs.contactIdentifier).toBeUndefined();
        expect(callArgs.contactIdentifierType).toBeUndefined();
      });
    });
  });

  describe('Meeting Activities', () => {
    it('should create meeting activity with all required fields', async () => {
      renderQuickAdd();
      
      // Select meeting action
      const meetingButton = screen.getByText('Log Meeting');
      await userEvent.click(meetingButton);
      
      // Fill meeting details
      await userEvent.type(screen.getByLabelText('Company Name'), 'Test Company');
      
      // Select meeting type
      const meetingTypeSelect = screen.getByLabelText('Meeting Type');
      await userEvent.selectOptions(meetingTypeSelect, 'Discovery Call');
      
      // Submit
      const submitButton = screen.getByRole('button', { name: /save|submit/i });
      await userEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockAddActivity).toHaveBeenCalledTimes(1);
        expect(mockAddActivity).toHaveBeenCalledWith(expect.objectContaining({
          type: 'meeting',
          client_name: 'Test Company',
          details: 'Discovery Call',
          status: 'completed'
        }));
      });
    });

    it('should handle meeting with contact information', async () => {
      renderQuickAdd();
      
      const meetingButton = screen.getByText('Log Meeting');
      await userEvent.click(meetingButton);
      
      await userEvent.type(screen.getByLabelText('Company Name'), 'Test Company');
      await userEvent.type(screen.getByLabelText('Contact Name'), 'John Doe');
      await userEvent.type(screen.getByPlaceholderText(/email/i), 'john@example.com');
      
      const meetingTypeSelect = screen.getByLabelText('Meeting Type');
      await userEvent.selectOptions(meetingTypeSelect, 'Demo');
      
      const submitButton = screen.getByRole('button', { name: /save|submit/i });
      await userEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockAddActivity).toHaveBeenCalledWith(expect.objectContaining({
          type: 'meeting',
          client_name: 'Test Company',
          contact_name: 'John Doe',
          contactIdentifier: 'john@example.com',
          contactIdentifierType: 'email',
          details: 'Demo'
        }));
      });
    });

    it('should create a deal automatically for meeting if none exists', async () => {
      renderQuickAdd();
      
      const meetingButton = screen.getByText('Log Meeting');
      await userEvent.click(meetingButton);
      
      await userEvent.type(screen.getByLabelText('Company Name'), 'New Company');
      
      const meetingTypeSelect = screen.getByLabelText('Meeting Type');
      await userEvent.selectOptions(meetingTypeSelect, 'Discovery Call');
      
      const submitButton = screen.getByRole('button', { name: /save|submit/i });
      await userEvent.click(submitButton);
      
      await waitFor(() => {
        // Should search for existing deals
        expect(mockFindDealsByClient).toHaveBeenCalledWith('New Company', expect.any(String));
        // Should create activity with the new deal
        expect(mockAddActivity).toHaveBeenCalledWith(expect.objectContaining({
          type: 'meeting',
          client_name: 'New Company',
          deal_id: expect.any(String)
        }));
      });
    });
  });

  describe('Proposal Activities', () => {
    it('should create proposal activity with amount', async () => {
      renderQuickAdd();
      
      const proposalButton = screen.getByText('Send Proposal');
      await userEvent.click(proposalButton);
      
      await userEvent.type(screen.getByLabelText('Company Name'), 'Proposal Company');
      await userEvent.type(screen.getByLabelText('Proposal Amount ($)'), '5000');
      await userEvent.type(screen.getByLabelText('Details'), 'Custom solution proposal');
      
      const submitButton = screen.getByRole('button', { name: /save|submit/i });
      await userEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockAddActivity).toHaveBeenCalledWith(expect.objectContaining({
          type: 'proposal',
          client_name: 'Proposal Company',
          amount: 5000,
          details: 'Custom solution proposal'
        }));
      });
    });

    it('should handle proposal with existing deal in SQL stage', async () => {
      // Mock finding an existing deal
      mockFindDealsByClient.mockResolvedValueOnce([
        { id: 'existing-deal', name: 'Existing Deal', stage_id: '603b5020-aafc-4646-9195-9f041a9a3f14' }
      ]);

      renderQuickAdd();
      
      const proposalButton = screen.getByText('Send Proposal');
      await userEvent.click(proposalButton);
      
      await userEvent.type(screen.getByLabelText('Company Name'), 'Existing Company');
      await userEvent.type(screen.getByLabelText('Proposal Amount ($)'), '10000');
      
      const submitButton = screen.getByRole('button', { name: /save|submit/i });
      await userEvent.click(submitButton);
      
      // Wait for the modal to appear and click to progress the deal
      await waitFor(() => {
        const progressButton = document.querySelector('#progress-deal');
        if (progressButton) {
          fireEvent.click(progressButton);
        }
      });
      
      await waitFor(() => {
        // Should move deal to Opportunity stage
        expect(mockMoveDealToStage).toHaveBeenCalledWith(
          'existing-deal',
          '8be6a854-e7d0-41b5-9057-03b2213e7697' // Opportunity stage ID
        );
        // Should create activity with existing deal
        expect(mockAddActivity).toHaveBeenCalledWith(expect.objectContaining({
          type: 'proposal',
          deal_id: 'existing-deal'
        }));
      });
    });
  });

  describe('Sale Activities', () => {
    it('should create sale with LTV calculation', async () => {
      renderQuickAdd();
      
      const saleButton = screen.getByText('Record Sale');
      await userEvent.click(saleButton);
      
      await userEvent.type(screen.getByLabelText('Company Name'), 'Sale Company');
      await userEvent.type(screen.getByLabelText('One-off Revenue ($)'), '1000');
      await userEvent.type(screen.getByLabelText('Monthly MRR ($)'), '500');
      await userEvent.type(screen.getByLabelText('Details'), 'New subscription sale');
      
      const submitButton = screen.getByRole('button', { name: /save|submit/i });
      await userEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockAddSale).toHaveBeenCalledWith(expect.objectContaining({
          client_name: 'Sale Company',
          amount: 2500, // LTV: (500 * 3) + 1000
          details: 'New subscription sale',
          saleType: 'subscription',
          oneOffRevenue: 1000,
          monthlyMrr: 500
        }));
      });
    });

    it('should handle sale with contact information', async () => {
      renderQuickAdd();
      
      const saleButton = screen.getByText('Record Sale');
      await userEvent.click(saleButton);
      
      await userEvent.type(screen.getByLabelText('Company Name'), 'Contact Sale Company');
      await userEvent.type(screen.getByLabelText('Contact Name'), 'Jane Smith');
      await userEvent.type(screen.getByPlaceholderText(/email/i), 'jane@company.com');
      await userEvent.type(screen.getByLabelText('One-off Revenue ($)'), '2000');
      
      const submitButton = screen.getByRole('button', { name: /save|submit/i });
      await userEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockAddSale).toHaveBeenCalledWith(expect.objectContaining({
          client_name: 'Contact Sale Company',
          contact_name: 'Jane Smith',
          contactIdentifier: 'jane@company.com',
          contactIdentifierType: 'email',
          amount: 2000,
          saleType: 'one-off'
        }));
      });
    });

    it('should handle sale with existing deal progression', async () => {
      // Mock finding an existing deal in Opportunity stage
      mockFindDealsByClient.mockResolvedValueOnce([
        { id: 'opp-deal', name: 'Opportunity Deal', stage_id: '8be6a854-e7d0-41b5-9057-03b2213e7697' }
      ]);

      renderQuickAdd();
      
      const saleButton = screen.getByText('Record Sale');
      await userEvent.click(saleButton);
      
      await userEvent.type(screen.getByLabelText('Company Name'), 'Closing Company');
      await userEvent.type(screen.getByLabelText('One-off Revenue ($)'), '5000');
      
      const submitButton = screen.getByRole('button', { name: /save|submit/i });
      await userEvent.click(submitButton);
      
      // Wait for the modal and click to progress
      await waitFor(() => {
        const progressButton = document.querySelector('#progress-deal');
        if (progressButton) {
          fireEvent.click(progressButton);
        }
      });
      
      await waitFor(() => {
        // Should move deal to Signed stage
        expect(mockMoveDealToStage).toHaveBeenCalledWith(
          'opp-deal',
          '207a94db-abd8-43d8-ba21-411be66183d2' // Signed stage ID
        );
        // Should create sale with existing deal
        expect(mockAddSale).toHaveBeenCalledWith(expect.objectContaining({
          deal_id: 'opp-deal',
          amount: 5000
        }));
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle empty client name gracefully', async () => {
      renderQuickAdd();
      
      const meetingButton = screen.getByText('Log Meeting');
      await userEvent.click(meetingButton);
      
      // Don't fill company name
      const meetingTypeSelect = screen.getByLabelText('Meeting Type');
      await userEvent.selectOptions(meetingTypeSelect, 'Demo');
      
      const submitButton = screen.getByRole('button', { name: /save|submit/i });
      await userEvent.click(submitButton);
      
      // Should show error toast (implementation dependent)
      await waitFor(() => {
        expect(mockAddActivity).not.toHaveBeenCalled();
      });
    });

    it('should handle API errors gracefully', async () => {
      mockAddActivity.mockRejectedValueOnce(new Error('API Error'));
      
      renderQuickAdd();
      
      const meetingButton = screen.getByText('Log Meeting');
      await userEvent.click(meetingButton);
      
      await userEvent.type(screen.getByLabelText('Company Name'), 'Error Company');
      const meetingTypeSelect = screen.getByLabelText('Meeting Type');
      await userEvent.selectOptions(meetingTypeSelect, 'Demo');
      
      const submitButton = screen.getByRole('button', { name: /save|submit/i });
      await userEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockAddActivity).toHaveBeenCalled();
        // Component should handle error without crashing
      });
    });

    it('should not query for deals with empty client name', async () => {
      renderQuickAdd();
      
      const proposalButton = screen.getByText('Send Proposal');
      await userEvent.click(proposalButton);
      
      // Submit without entering company name
      const submitButton = screen.getByRole('button', { name: /save|submit/i });
      await userEvent.click(submitButton);
      
      await waitFor(() => {
        // Should not call findDealsByClient with empty name
        expect(mockFindDealsByClient).not.toHaveBeenCalled();
      });
    });
  });

  describe('Field Validation', () => {
    it('should validate required fields for meetings', async () => {
      renderQuickAdd();
      
      const meetingButton = screen.getByText('Log Meeting');
      await userEvent.click(meetingButton);
      
      // Try to submit without meeting type
      await userEvent.type(screen.getByLabelText('Company Name'), 'Test Company');
      
      const submitButton = screen.getByRole('button', { name: /save|submit/i });
      await userEvent.click(submitButton);
      
      await waitFor(() => {
        // Should not submit without meeting type
        expect(mockAddActivity).not.toHaveBeenCalled();
      });
    });

    it('should validate numeric fields', async () => {
      renderQuickAdd();
      
      const saleButton = screen.getByText('Record Sale');
      await userEvent.click(saleButton);
      
      await userEvent.type(screen.getByLabelText('Company Name'), 'Test Company');
      await userEvent.type(screen.getByLabelText('One-off Revenue ($)'), 'invalid');
      
      const submitButton = screen.getByRole('button', { name: /save|submit/i });
      await userEvent.click(submitButton);
      
      await waitFor(() => {
        // Should handle invalid numeric input
        const calls = mockAddSale.mock.calls;
        if (calls.length > 0) {
          expect(calls[0][0].amount).toBe(0);
        }
      });
    });

    it('should sanitize user inputs', async () => {
      renderQuickAdd();
      
      const meetingButton = screen.getByText('Log Meeting');
      await userEvent.click(meetingButton);
      
      // Try to inject script tags
      await userEvent.type(screen.getByLabelText('Company Name'), '<script>alert("XSS")</script>');
      await userEvent.type(screen.getByLabelText('Details'), '<img src=x onerror=alert("XSS")>');
      
      const meetingTypeSelect = screen.getByLabelText('Meeting Type');
      await userEvent.selectOptions(meetingTypeSelect, 'Demo');
      
      const submitButton = screen.getByRole('button', { name: /save|submit/i });
      await userEvent.click(submitButton);
      
      await waitFor(() => {
        if (mockAddActivity.mock.calls.length > 0) {
          const callArgs = mockAddActivity.mock.calls[0][0];
          // Should sanitize dangerous inputs
          expect(callArgs.client_name).not.toContain('<script>');
          expect(callArgs.details).not.toContain('onerror');
        }
      });
    });
  });
});