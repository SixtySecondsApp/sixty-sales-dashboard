import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createClient } from '@supabase/supabase-js';
import { DealWizard } from '@/components/DealWizard';
import { toast } from 'sonner';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id' } }
    })
  }
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase
}));

vi.mock('sonner');

describe('Deal-Proposal Flow Integration Tests', () => {
  const mockDealsTable = {
    insert: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn()
  };

  const mockActivitiesTable = {
    insert: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Setup Supabase mocks
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'deals') return mockDealsTable;
      if (table === 'activities') return mockActivitiesTable;
      return { insert: vi.fn(), select: vi.fn() };
    });

    // Chain methods properly
    mockDealsTable.insert.mockReturnThis();
    mockDealsTable.select.mockReturnThis();
    mockDealsTable.eq.mockReturnThis();
    mockDealsTable.single.mockResolvedValue({
      data: { 
        id: 'deal-123', 
        name: 'Test Deal',
        company: 'Test Company',
        value: 10000 
      },
      error: null
    });

    mockActivitiesTable.insert.mockReturnThis();
    mockActivitiesTable.select.mockReturnThis();
    mockActivitiesTable.eq.mockReturnThis();
    mockActivitiesTable.single.mockResolvedValue({
      data: { id: 'activity-123' },
      error: null
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Successful Flow', () => {
    it('should create deal and proposal activity successfully', async () => {
      render(
        <DealWizard
          isOpen={true}
          onClose={vi.fn()}
          onDealCreated={vi.fn()}
          actionType="proposal"
        />
      );

      // Fill form
      fireEvent.change(screen.getByLabelText(/deal name/i), {
        target: { value: 'Test Deal' }
      });
      fireEvent.change(screen.getByLabelText(/company/i), {
        target: { value: 'Test Company' }
      });
      fireEvent.change(screen.getByLabelText(/value/i), {
        target: { value: '10000' }
      });

      // Submit form
      fireEvent.click(screen.getByText(/create deal & proposal/i));

      // Wait for deal creation
      await waitFor(() => {
        expect(mockDealsTable.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Test Deal',
            company: 'Test Company',
            value: 10000
          })
        );
      });

      // Fast-forward through delay
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      // Verify activity creation
      await waitFor(() => {
        expect(mockActivitiesTable.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'proposal',
            deal_id: 'deal-123',
            details: expect.stringContaining('Test Deal')
          })
        );
      });

      expect(toast.success).toHaveBeenCalledWith('Deal and proposal created successfully!');
    });

    it('should only create deal when actionType is "deal"', async () => {
      render(
        <DealWizard
          isOpen={true}
          onClose={vi.fn()}
          onDealCreated={vi.fn()}
          actionType="deal"
        />
      );

      // Fill and submit form
      fireEvent.change(screen.getByLabelText(/deal name/i), {
        target: { value: 'Test Deal' }
      });
      fireEvent.change(screen.getByLabelText(/company/i), {
        target: { value: 'Test Company' }
      });

      fireEvent.click(screen.getByText(/create new deal/i));

      // Wait for deal creation
      await waitFor(() => {
        expect(mockDealsTable.insert).toHaveBeenCalled();
      });

      await vi.runAllTimersAsync();

      // Verify no activity creation
      expect(mockActivitiesTable.insert).not.toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Deal created successfully!');
    });
  });

  describe('Race Condition Scenarios', () => {
    it('should handle foreign key constraint error and retry', async () => {
      // First activity creation fails with foreign key error
      mockActivitiesTable.single
        .mockRejectedValueOnce({ 
          error: { code: '23503', message: 'foreign key violation' }
        })
        .mockResolvedValueOnce({
          data: { id: 'activity-123' },
          error: null
        });

      render(
        <DealWizard
          isOpen={true}
          onClose={vi.fn()}
          onDealCreated={vi.fn()}
          actionType="proposal"
        />
      );

      // Fill and submit form
      fireEvent.change(screen.getByLabelText(/deal name/i), {
        target: { value: 'Test Deal' }
      });
      fireEvent.change(screen.getByLabelText(/company/i), {
        target: { value: 'Test Company' }
      });

      fireEvent.click(screen.getByText(/create deal & proposal/i));

      // Fast-forward through all delays
      vi.advanceTimersByTime(500); // Initial delay
      await vi.runAllTimersAsync();
      
      vi.advanceTimersByTime(1000); // Retry delay
      await vi.runAllTimersAsync();

      // Verify retry attempt
      expect(mockActivitiesTable.insert).toHaveBeenCalledTimes(2);
      expect(toast.success).toHaveBeenCalledWith('Deal and proposal created successfully!');
    });

    it('should handle persistent foreign key errors gracefully', async () => {
      // Both attempts fail
      mockActivitiesTable.single
        .mockRejectedValue({ 
          error: { code: '23503', message: 'foreign key violation' }
        });

      render(
        <DealWizard
          isOpen={true}
          onClose={vi.fn()}
          onDealCreated={vi.fn()}
          actionType="proposal"
        />
      );

      // Fill and submit form
      fireEvent.change(screen.getByLabelText(/deal name/i), {
        target: { value: 'Test Deal' }
      });
      fireEvent.change(screen.getByLabelText(/company/i), {
        target: { value: 'Test Company' }
      });

      fireEvent.click(screen.getByText(/create deal & proposal/i));

      await vi.runAllTimersAsync();

      // Verify both attempts made
      expect(mockActivitiesTable.insert).toHaveBeenCalledTimes(2);
      
      // Deal should still be created successfully
      expect(mockDealsTable.insert).toHaveBeenCalled();
      
      // Should show appropriate error message
      expect(toast.error).toHaveBeenCalledWith(
        'Note: Proposal activity creation failed, but deal was created successfully'
      );
    });

    it('should handle database connection issues', async () => {
      // Deal creation succeeds but activity creation has network issues
      mockActivitiesTable.single.mockRejectedValue(
        new Error('Network error - connection timeout')
      );

      render(
        <DealWizard
          isOpen={true}
          onClose={vi.fn()}
          onDealCreated={vi.fn()}
          actionType="proposal"
        />
      );

      // Fill and submit form
      fireEvent.change(screen.getByLabelText(/deal name/i), {
        target: { value: 'Test Deal' }
      });
      fireEvent.change(screen.getByLabelText(/company/i), {
        target: { value: 'Test Company' }
      });

      fireEvent.click(screen.getByText(/create deal & proposal/i));

      await vi.runAllTimersAsync();

      // Should not retry for non-foreign-key errors
      expect(mockActivitiesTable.insert).toHaveBeenCalledTimes(1);
      
      // Deal should still be created
      expect(mockDealsTable.insert).toHaveBeenCalled();
      
      expect(toast.error).toHaveBeenCalledWith(
        'Note: Proposal activity creation failed, but deal was created successfully'
      );
    });
  });

  describe('Database Transaction Timing', () => {
    it('should handle slow database commits', async () => {
      // Simulate slow deal creation
      mockDealsTable.single.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            data: { id: 'deal-123', name: 'Test Deal' },
            error: null
          }), 300)
        )
      );

      render(
        <DealWizard
          isOpen={true}
          onClose={vi.fn()}
          onDealCreated={vi.fn()}
          actionType="proposal"
        />
      );

      // Fill and submit form
      fireEvent.change(screen.getByLabelText(/deal name/i), {
        target: { value: 'Test Deal' }
      });

      fireEvent.click(screen.getByText(/create deal & proposal/i));

      // Fast-forward deal creation
      vi.advanceTimersByTime(300);
      await vi.runAllTimersAsync();

      // Fast-forward activity delay
      vi.advanceTimersByTime(500);
      await vi.runAllTimersAsync();

      // Verify both operations completed
      expect(mockDealsTable.insert).toHaveBeenCalled();
      expect(mockActivitiesTable.insert).toHaveBeenCalled();
    });

    it('should handle concurrent deal creation requests', async () => {
      let dealCreationCount = 0;
      
      mockDealsTable.single.mockImplementation(() => {
        dealCreationCount++;
        return Promise.resolve({
          data: { 
            id: `deal-${dealCreationCount}`, 
            name: 'Test Deal' 
          },
          error: null
        });
      });

      // Render multiple wizards
      const { rerender } = render(
        <DealWizard
          isOpen={true}
          onClose={vi.fn()}
          onDealCreated={vi.fn()}
          actionType="proposal"
        />
      );

      // Fill first form
      fireEvent.change(screen.getByLabelText(/deal name/i), {
        target: { value: 'Deal 1' }
      });
      fireEvent.click(screen.getByText(/create deal & proposal/i));

      // Quickly switch to another instance
      rerender(
        <DealWizard
          isOpen={true}
          onClose={vi.fn()}
          onDealCreated={vi.fn()}
          actionType="proposal"
        />
      );

      // Fill second form
      fireEvent.change(screen.getByLabelText(/deal name/i), {
        target: { value: 'Deal 2' }
      });
      fireEvent.click(screen.getByText(/create deal & proposal/i));

      await vi.runAllTimersAsync();

      // Both should succeed with unique IDs
      expect(dealCreationCount).toBe(2);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary database unavailability', async () => {
      let attempts = 0;
      
      mockActivitiesTable.single.mockImplementation(() => {
        attempts++;
        if (attempts === 1) {
          return Promise.reject({ 
            error: { code: '23503', message: 'foreign key violation' }
          });
        }
        return Promise.resolve({
          data: { id: 'activity-123' },
          error: null
        });
      });

      render(
        <DealWizard
          isOpen={true}
          onClose={vi.fn()}
          onDealCreated={vi.fn()}
          actionType="proposal"
        />
      );

      // Fill and submit form
      fireEvent.change(screen.getByLabelText(/deal name/i), {
        target: { value: 'Test Deal' }
      });

      fireEvent.click(screen.getByText(/create deal & proposal/i));

      await vi.runAllTimersAsync();

      expect(attempts).toBe(2);
      expect(toast.success).toHaveBeenCalledWith('Deal and proposal created successfully!');
    });

    it('should handle malformed database responses', async () => {
      mockDealsTable.single.mockResolvedValue({
        data: null, // Unexpected null response
        error: null
      });

      render(
        <DealWizard
          isOpen={true}
          onClose={vi.fn()}
          onDealCreated={vi.fn()}
          actionType="proposal"
        />
      );

      fireEvent.change(screen.getByLabelText(/deal name/i), {
        target: { value: 'Test Deal' }
      });

      fireEvent.click(screen.getByText(/create deal & proposal/i));

      await vi.runAllTimersAsync();

      // Should handle gracefully
      expect(toast.error).toHaveBeenCalled();
    });
  });
});