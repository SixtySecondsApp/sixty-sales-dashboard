import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { DealWizard } from '@/components/DealWizard';
import { useDeals } from '@/lib/hooks/useDeals';
import { useActivities } from '@/lib/hooks/useActivities';

// Mock dependencies
vi.mock('sonner');
vi.mock('@/lib/hooks/useDeals');
vi.mock('@/lib/hooks/useActivities');
vi.mock('@/lib/hooks/useUser', () => ({
  useUser: () => ({ userData: { id: 'test-user-id' } })
}));
vi.mock('@/lib/hooks/useDealStages', () => ({
  useDealStages: () => ({ 
    stages: [{ id: 'stage-1', name: 'Prospecting', default_probability: 10 }],
    initializeStages: vi.fn()
  })
}));
vi.mock('@/lib/hooks/useContacts', () => ({
  useContacts: () => ({ contacts: [] })
}));

describe('Foreign Key Constraint Fix', () => {
  const mockCreateDeal = vi.fn();
  const mockAddActivityAsync = vi.fn();
  const mockOnDealCreated = vi.fn();
  const mockOnClose = vi.fn();

  const mockContact = {
    id: 'contact-1',
    full_name: 'John Doe',
    email: 'john@example.com',
    company_id: 'company-1'
  };

  const mockDeal = {
    id: 'deal-123',
    name: 'Test Deal',
    company: 'Test Company',
    value: 10000
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Mock hooks
    (useDeals as any).mockReturnValue({
      createDeal: mockCreateDeal
    });
    
    (useActivities as any).mockReturnValue({
      addActivityAsync: mockAddActivityAsync
    });

    // Default successful responses
    mockCreateDeal.mockResolvedValue(mockDeal);
    mockAddActivityAsync.mockResolvedValue({ id: 'activity-1' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Unit Tests - Retry Logic', () => {
    it('should create proposal activity with initial 500ms delay', async () => {
      render(
        <DealWizard
          isOpen={true}
          onClose={mockOnClose}
          onDealCreated={mockOnDealCreated}
          actionType="proposal"
        />
      );

      // Set up wizard state - find and fill form fields
      const nameInput = screen.getByLabelText(/deal name/i);
      const companyInput = screen.getByLabelText(/company/i);
      const valueInput = screen.getByLabelText(/value/i);
      
      fireEvent.change(nameInput, { target: { value: 'Test Deal' } });
      fireEvent.change(companyInput, { target: { value: 'Test Company' } });
      fireEvent.change(valueInput, { target: { value: '10000' } });

      // Mock contact selection
      const selectContactBtn = screen.getByText(/select contact/i);
      fireEvent.click(selectContactBtn);
      
      // Simulate contact selection (this would normally happen through ContactSearchModal)
      const wizard = screen.getByTestId('deal-wizard');
      fireEvent.click(wizard);

      // Create deal
      const createBtn = screen.getByText(/create deal & proposal/i);
      fireEvent.click(createBtn);

      // Fast-forward initial delay
      vi.advanceTimersByTime(500);
      
      await waitFor(() => {
        expect(mockCreateDeal).toHaveBeenCalled();
      });

      // Fast-forward to complete the Promise
      await vi.runAllTimersAsync();

      expect(mockAddActivityAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'proposal',
          deal_id: mockDeal.id,
          details: expect.stringContaining('Test Deal')
        })
      );
    });

    it('should retry with 1000ms delay on foreign key constraint error', async () => {
      // Mock first attempt failing with foreign key error
      mockAddActivityAsync
        .mockRejectedValueOnce(new Error('foreign key constraint'))
        .mockResolvedValueOnce({ id: 'activity-1' });

      render(
        <DealWizard
          isOpen={true}
          onClose={mockOnClose}
          onDealCreated={mockOnDealCreated}
          actionType="proposal"
        />
      );

      // Trigger deal creation workflow
      const nameInput = screen.getByLabelText(/deal name/i);
      const companyInput = screen.getByLabelText(/company/i);
      
      fireEvent.change(nameInput, { target: { value: 'Test Deal' } });
      fireEvent.change(companyInput, { target: { value: 'Test Company' } });

      const createBtn = screen.getByText(/create deal & proposal/i);
      fireEvent.click(createBtn);

      // Fast-forward through all delays
      vi.advanceTimersByTime(500); // Initial delay
      await vi.runAllTimersAsync();
      
      // Should trigger retry
      vi.advanceTimersByTime(1000); // Retry delay
      await vi.runAllTimersAsync();

      expect(mockAddActivityAsync).toHaveBeenCalledTimes(2);
      expect(toast.success).toHaveBeenCalledWith('Deal and proposal created successfully!');
    });

    it('should handle foreign key error with code 23503', async () => {
      const foreignKeyError = new Error('Foreign key violation');
      (foreignKeyError as any).code = '23503';

      mockAddActivityAsync
        .mockRejectedValueOnce(foreignKeyError)
        .mockResolvedValueOnce({ id: 'activity-1' });

      render(
        <DealWizard
          isOpen={true}
          onClose={mockOnClose}
          onDealCreated={mockOnDealCreated}
          actionType="proposal"
        />
      );

      // Trigger workflow
      const nameInput = screen.getByLabelText(/deal name/i);
      const companyInput = screen.getByLabelText(/company/i);
      
      fireEvent.change(nameInput, { target: { value: 'Test Deal' } });
      fireEvent.change(companyInput, { target: { value: 'Test Company' } });

      const createBtn = screen.getByText(/create deal & proposal/i);
      fireEvent.click(createBtn);

      // Fast-forward through all delays
      await vi.runAllTimersAsync();

      expect(mockAddActivityAsync).toHaveBeenCalledTimes(2);
    });

    it('should show error message if retry fails', async () => {
      // Mock both attempts failing
      mockAddActivityAsync
        .mockRejectedValue(new Error('foreign key constraint'))
        .mockRejectedValue(new Error('still failing'));

      render(
        <DealWizard
          isOpen={true}
          onClose={mockOnClose}
          onDealCreated={mockOnDealCreated}
          actionType="proposal"
        />
      );

      // Trigger workflow
      const nameInput = screen.getByLabelText(/deal name/i);
      const companyInput = screen.getByLabelText(/company/i);
      
      fireEvent.change(nameInput, { target: { value: 'Test Deal' } });
      fireEvent.change(companyInput, { target: { value: 'Test Company' } });

      const createBtn = screen.getByText(/create deal & proposal/i);
      fireEvent.click(createBtn);

      await vi.runAllTimersAsync();

      expect(mockAddActivityAsync).toHaveBeenCalledTimes(2);
      expect(toast.error).toHaveBeenCalledWith(
        'Note: Proposal activity creation failed, but deal was created successfully'
      );
    });

    it('should not create proposal activity when actionType is not "proposal"', async () => {
      render(
        <DealWizard
          isOpen={true}
          onClose={mockOnClose}
          onDealCreated={mockOnDealCreated}
          actionType="deal"
        />
      );

      // Trigger workflow
      const nameInput = screen.getByLabelText(/deal name/i);
      const companyInput = screen.getByLabelText(/company/i);
      
      fireEvent.change(nameInput, { target: { value: 'Test Deal' } });
      fireEvent.change(companyInput, { target: { value: 'Test Company' } });

      const createBtn = screen.getByText(/create new deal/i);
      fireEvent.click(createBtn);

      await vi.runAllTimersAsync();

      expect(mockCreateDeal).toHaveBeenCalled();
      expect(mockAddActivityAsync).not.toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Deal created successfully!');
    });

    it('should handle non-foreign-key errors without retry', async () => {
      mockAddActivityAsync.mockRejectedValue(new Error('Network error'));

      render(
        <DealWizard
          isOpen={true}
          onClose={mockOnClose}
          onDealCreated={mockOnDealCreated}
          actionType="proposal"
        />
      );

      // Trigger workflow
      const nameInput = screen.getByLabelText(/deal name/i);
      const companyInput = screen.getByLabelText(/company/i);
      
      fireEvent.change(nameInput, { target: { value: 'Test Deal' } });
      fireEvent.change(companyInput, { target: { value: 'Test Company' } });

      const createBtn = screen.getByText(/create deal & proposal/i);
      fireEvent.click(createBtn);

      await vi.runAllTimersAsync();

      expect(mockAddActivityAsync).toHaveBeenCalledTimes(1); // No retry
      expect(toast.error).toHaveBeenCalledWith(
        'Note: Proposal activity creation failed, but deal was created successfully'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle deal creation failure gracefully', async () => {
      mockCreateDeal.mockRejectedValue(new Error('Deal creation failed'));

      render(
        <DealWizard
          isOpen={true}
          onClose={mockOnClose}
          onDealCreated={mockOnDealCreated}
          actionType="proposal"
        />
      );

      // Trigger workflow
      const nameInput = screen.getByLabelText(/deal name/i);
      const companyInput = screen.getByLabelText(/company/i);
      
      fireEvent.change(nameInput, { target: { value: 'Test Deal' } });
      fireEvent.change(companyInput, { target: { value: 'Test Company' } });

      const createBtn = screen.getByText(/create deal & proposal/i);
      fireEvent.click(createBtn);

      await vi.runAllTimersAsync();

      expect(mockCreateDeal).toHaveBeenCalled();
      expect(mockAddActivityAsync).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });

    it('should clean up timers on component unmount', async () => {
      const { unmount } = render(
        <DealWizard
          isOpen={true}
          onClose={mockOnClose}
          onDealCreated={mockOnDealCreated}
          actionType="proposal"
        />
      );

      // Start the process
      const nameInput = screen.getByLabelText(/deal name/i);
      fireEvent.change(nameInput, { target: { value: 'Test Deal' } });

      const createBtn = screen.getByText(/create deal & proposal/i);
      fireEvent.click(createBtn);

      // Unmount before timers complete
      unmount();

      // Advance timers after unmount
      vi.advanceTimersByTime(2000);

      // Should not crash or cause memory leaks
      expect(mockAddActivityAsync).not.toHaveBeenCalled();
    });
  });
});