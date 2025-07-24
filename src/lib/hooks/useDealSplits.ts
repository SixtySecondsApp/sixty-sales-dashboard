import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { DealSplit, DealSplitWithUser } from '@/lib/database/models';
import { toast } from 'sonner';

interface UseDealSplitsOptions {
  dealId?: string;
  userId?: string; // For getting splits assigned to a specific user
}

export function useDealSplits(options: UseDealSplitsOptions = {}) {
  const [splits, setSplits] = useState<DealSplitWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch splits for a specific deal or user
  const fetchSplits = useCallback(async () => {
    if (!options.dealId && !options.userId) return;

    try {
      setIsLoading(true);
      setError(null);

      let query = supabase
        .from('deal_splits_with_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (options.dealId) {
        query = query.eq('deal_id', options.dealId);
      }

      if (options.userId) {
        query = query.eq('user_id', options.userId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setSplits(data || []);
    } catch (err: any) {
      console.error('Error fetching deal splits:', err);
      setError(err.message);
      toast.error('Failed to load deal splits');
    } finally {
      setIsLoading(false);
    }
  }, [options.dealId, options.userId]);

  // Create a new deal split
  const createSplit = useCallback(async (splitData: {
    deal_id: string;
    user_id: string;
    percentage: number;
    notes?: string;
  }) => {
    try {
      setError(null);

      // Validate percentage
      if (splitData.percentage <= 0 || splitData.percentage > 100) {
        throw new Error('Percentage must be between 0 and 100');
      }

      // Check if total would exceed 100%
      const existingSplits = splits.filter(s => s.deal_id === splitData.deal_id);
      const totalExisting = existingSplits.reduce((sum, split) => sum + split.percentage, 0);
      
      if (totalExisting + splitData.percentage > 100) {
        throw new Error(`Cannot add ${splitData.percentage}%. Would exceed 100% (current total: ${totalExisting}%)`);
      }

      const { data, error: insertError } = await supabase
        .from('deal_splits')
        .insert([splitData])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      toast.success('Deal split created successfully');
      
      // Refresh the splits list
      await fetchSplits();
      
      return data;
    } catch (err: any) {
      console.error('Error creating deal split:', err);
      setError(err.message);
      toast.error(err.message || 'Failed to create deal split');
      throw err;
    }
  }, [splits, fetchSplits]);

  // Update an existing deal split
  const updateSplit = useCallback(async (id: string, updates: {
    percentage?: number;
    notes?: string;
  }) => {
    try {
      setError(null);

      // Validate percentage if provided
      if (updates.percentage !== undefined) {
        if (updates.percentage <= 0 || updates.percentage > 100) {
          throw new Error('Percentage must be between 0 and 100');
        }

        // Check if total would exceed 100%
        const currentSplit = splits.find(s => s.id === id);
        if (currentSplit) {
          const otherSplits = splits.filter(s => s.deal_id === currentSplit.deal_id && s.id !== id);
          const totalOthers = otherSplits.reduce((sum, split) => sum + split.percentage, 0);
          
          if (totalOthers + updates.percentage > 100) {
            throw new Error(`Cannot set to ${updates.percentage}%. Would exceed 100% (other splits total: ${totalOthers}%)`);
          }
        }
      }

      const { data, error: updateError } = await supabase
        .from('deal_splits')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      toast.success('Deal split updated successfully');
      
      // Refresh the splits list
      await fetchSplits();
      
      return data;
    } catch (err: any) {
      console.error('Error updating deal split:', err);
      setError(err.message);
      toast.error(err.message || 'Failed to update deal split');
      throw err;
    }
  }, [splits, fetchSplits]);

  // Delete a deal split
  const deleteSplit = useCallback(async (id: string) => {
    try {
      setError(null);

      const { error: deleteError } = await supabase
        .from('deal_splits')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      toast.success('Deal split deleted successfully');
      
      // Refresh the splits list
      await fetchSplits();
      
      return true;
    } catch (err: any) {
      console.error('Error deleting deal split:', err);
      setError(err.message);
      toast.error(err.message || 'Failed to delete deal split');
      return false;
    }
  }, [fetchSplits]);

  // Calculate totals for a deal
  const calculateSplitTotals = useCallback((dealId: string) => {
    const dealSplits = splits.filter(s => s.deal_id === dealId);
    const totalPercentage = dealSplits.reduce((sum, split) => sum + split.percentage, 0);
    const totalAmount = dealSplits.reduce((sum, split) => sum + split.amount, 0);
    const remainingPercentage = Math.max(0, 100 - totalPercentage);

    return {
      totalPercentage,
      totalAmount,
      remainingPercentage,
      splitCount: dealSplits.length,
      splits: dealSplits
    };
  }, [splits]);

  // Get split for a specific user on a specific deal
  const getUserSplit = useCallback((dealId: string, userId: string) => {
    return splits.find(s => s.deal_id === dealId && s.user_id === userId);
  }, [splits]);

  // Check if a deal can be split (has remaining percentage)
  const canSplitDeal = useCallback((dealId: string) => {
    const totals = calculateSplitTotals(dealId);
    return totals.remainingPercentage > 0;
  }, [calculateSplitTotals]);

  // Initial fetch when options change
  useEffect(() => {
    fetchSplits();
  }, [fetchSplits]);

  return {
    splits,
    isLoading,
    error,
    createSplit,
    updateSplit,
    deleteSplit,
    fetchSplits,
    calculateSplitTotals,
    getUserSplit,
    canSplitDeal
  };
} 