import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { DealSplit, DealSplitWithUser } from '@/lib/database/models';
import { toast } from 'sonner';
import logger from '@/lib/utils/logger';

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
      logger.error('Error fetching deal splits:', err);
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

      // First, create the deal split
      const { data: splitResult, error: insertError } = await supabase
        .from('deal_splits')
        .insert([splitData])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      // Now, check if there's a related activity for this deal and create a split activity
      // First, let's check what activities exist for this deal
      logger.log(`Looking for activities for deal ${splitData.deal_id}`);
      
      const { data: allActivities } = await supabase
        .from('activities')
        .select('*')
        .eq('deal_id', splitData.deal_id);
      
      logger.log(`All activities for deal ${splitData.deal_id}:`, allActivities);
      
      // Find the original activity (not a split one)
      // First try to find an activity that's explicitly not a split
      let { data: originalActivity, error: activityError } = await supabase
        .from('activities')
        .select('*')
        .eq('deal_id', splitData.deal_id)
        .eq('type', 'sale')
        .neq('is_split', true)
        .single();
      
      // If that fails, try finding one where is_split is null
      if (activityError) {
        const { data: nullSplitActivity } = await supabase
          .from('activities')
          .select('*')
          .eq('deal_id', splitData.deal_id)
          .eq('type', 'sale')
          .is('is_split', null)
          .single();
        
        if (nullSplitActivity) {
          originalActivity = nullSplitActivity;
          activityError = null;
        }
      }
      
      let activityWasJustCreated = false;

      if (activityError) {
        logger.warn(`No sale activity found for deal ${splitData.deal_id}. This deal may not have been created as a sale yet.`, activityError);
        
        // If there's no sale activity, we need to create one first for the deal owner
        logger.log(`Creating initial sale activity for deal ${splitData.deal_id}`);
        
        // Get the deal details to create the activity
        const { data: deal } = await supabase
          .from('deals')
          .select('*')
          .eq('id', splitData.deal_id)
          .single();
        
        if (deal) {
          // Get the owner's profile
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', deal.owner_id)
            .single();
          
          if (ownerProfile) {
            // Calculate the owner's amount after this split
            const ownerPercentage = 100 - totalExisting - splitData.percentage;
            const ownerAmount = (deal.value || 0) * (ownerPercentage / 100);
            
            // Create the initial sale activity for the owner
            const initialActivity = {
              user_id: deal.owner_id,
              type: 'sale',
              client_name: deal.company || deal.name,
              details: `${deal.name || 'Sale'} (${ownerPercentage}% retained after split)`,
              amount: ownerAmount,
              priority: 'high',
              sales_rep: `${ownerProfile.first_name} ${ownerProfile.last_name}`,
              date: deal.created_at,
              status: 'completed',
              quantity: 1,
              contact_identifier: deal.contact_email,
              contact_identifier_type: deal.contact_email ? 'email' : 'unknown',
              deal_id: splitData.deal_id,
              is_split: false,
              split_percentage: ownerPercentage
            };
            
            const { data: createdActivity, error: createError } = await supabase
              .from('activities')
              .insert([initialActivity])
              .select()
              .single();
            
            if (createError) {
              logger.error('Failed to create initial sale activity:', createError);
            } else {
              logger.log(`Created initial sale activity for owner with ${ownerPercentage}%`);
              // Use this as the original activity
              originalActivity = createdActivity;
              activityWasJustCreated = true;
            }
          }
        }
      } else {
        logger.log(`Found original activity for deal ${splitData.deal_id}:`, originalActivity);
      }

      if (originalActivity) {
        // Get the deal value to calculate correct amounts
        const { data: deal } = await supabase
          .from('deals')
          .select('value')
          .eq('id', splitData.deal_id)
          .single();
        
        const dealValue = deal?.value || originalActivity.amount || 0;
        
        // Get the user profile for the split recipient
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', splitData.user_id)
          .single();

        if (userProfile) {
          // Calculate the split amount based on the deal value and percentage
          const splitAmount = dealValue * (splitData.percentage / 100);
          
          // Get the base details without any percentage notation
          const baseDetails = originalActivity.details?.replace(/ \(\d+% retained after split\)/, '').replace(/ \(\d+% split\)/, '') || 'Sale';
          
          // Create a new activity for the split recipient
          const splitActivity = {
            user_id: splitData.user_id,
            type: 'sale',
            client_name: originalActivity.client_name,
            details: `${baseDetails} (${splitData.percentage}% split)`,
            amount: splitAmount,
            priority: originalActivity.priority || 'high',
            sales_rep: `${userProfile.first_name} ${userProfile.last_name}`,
            date: originalActivity.date,
            status: originalActivity.status || 'completed',
            quantity: originalActivity.quantity || 1,
            contact_identifier: originalActivity.contact_identifier,
            contact_identifier_type: originalActivity.contact_identifier_type,
            deal_id: splitData.deal_id,
            // Add a reference to indicate this is a split activity
            is_split: true,
            original_activity_id: originalActivity.id,
            split_percentage: splitData.percentage
          };

          const { error: activityError } = await supabase
            .from('activities')
            .insert([splitActivity]);

          if (activityError) {
            logger.warn('Failed to create split activity:', activityError);
            // Don't throw - the split was created successfully, just log the warning
          } else {
            logger.log(`Created split activity for user ${splitData.user_id} (${splitData.percentage}%)`);
            
            // Only update the original activity if it wasn't just created
            // (If we just created it, it already has the correct split percentage)
            if (!activityWasJustCreated) {
              // Calculate the remaining percentage for the original owner
              const remainingPercentage = 100 - totalExisting - splitData.percentage;
              const remainingAmount = dealValue * (remainingPercentage / 100);
              
              // Update the original activity's amount and details to reflect the split
              const updatedDetails = `${baseDetails} (${remainingPercentage}% retained after split)`;
              await supabase
                .from('activities')
                .update({ 
                  details: updatedDetails,
                  amount: remainingAmount,
                  split_percentage: remainingPercentage
                })
                .eq('id', originalActivity.id);
                
              logger.log(`Updated original activity to ${remainingPercentage}% (${remainingAmount})`);
            }
          }
        }
      }

      toast.success('Deal split created successfully');
      
      // Refresh the splits list
      await fetchSplits();
      
      return splitResult;
    } catch (err: any) {
      logger.error('Error creating deal split:', err);
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

      // Get the current split details
      const currentSplit = splits.find(s => s.id === id);
      if (!currentSplit) {
        throw new Error('Split not found');
      }

      // Validate percentage if provided
      if (updates.percentage !== undefined) {
        if (updates.percentage <= 0 || updates.percentage > 100) {
          throw new Error('Percentage must be between 0 and 100');
        }

        // Check if total would exceed 100%
        const otherSplits = splits.filter(s => s.deal_id === currentSplit.deal_id && s.id !== id);
        const totalOthers = otherSplits.reduce((sum, split) => sum + split.percentage, 0);
        
        if (totalOthers + updates.percentage > 100) {
          throw new Error(`Cannot set to ${updates.percentage}%. Would exceed 100% (other splits total: ${totalOthers}%)`);
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

      // If percentage was updated, also update the related activities
      if (updates.percentage !== undefined) {
        // First get the original activity to get base details
        const { data: originalActivity } = await supabase
          .from('activities')
          .select('*')
          .eq('deal_id', currentSplit.deal_id)
          .eq('type', 'sale')
          .or('is_split.is.null,is_split.eq.false')
          .single();

        // Get the deal to calculate correct amounts
        const { data: deal } = await supabase
          .from('deals')
          .select('value')
          .eq('id', currentSplit.deal_id)
          .single();

        if (deal && originalActivity) {
          const dealValue = deal.value || 0;
          const baseDetails = originalActivity.details?.replace(/ \(\d+% retained after split\)/, '') || 'Sale';
          
          // Update the split activity for this user
          const newSplitAmount = dealValue * (updates.percentage / 100);
          
          const { error: splitActivityUpdateError } = await supabase
            .from('activities')
            .update({
              amount: newSplitAmount,
              details: `${baseDetails} (${updates.percentage}% split)`,
              split_percentage: updates.percentage
            })
            .eq('deal_id', currentSplit.deal_id)
            .eq('user_id', currentSplit.user_id)
            .eq('is_split', true);

          if (splitActivityUpdateError) {
            logger.warn('Failed to update split activity:', splitActivityUpdateError);
          } else {
            logger.log(`Updated split activity for user ${currentSplit.user_id} to ${updates.percentage}%`);
          }
          
          // Calculate the owner's percentage after all splits
          const allSplits = splits.filter(s => s.deal_id === currentSplit.deal_id);
          const totalSplitPercentage = allSplits.reduce((sum, split) => {
            return sum + (split.id === id ? updates.percentage : split.percentage);
          }, 0);
          const ownerPercentage = 100 - totalSplitPercentage;
          const ownerAmount = dealValue * (ownerPercentage / 100);
          
          const updatedDetails = `${baseDetails} (${ownerPercentage}% retained after split)`;
          
          await supabase
            .from('activities')
            .update({
              amount: ownerAmount,
              details: updatedDetails,
              split_percentage: ownerPercentage
            })
            .eq('id', originalActivity.id);
            
          logger.log(`Updated original activity to ${ownerPercentage}% (${ownerAmount})`);
        }
      }

      toast.success('Deal split updated successfully');
      
      // Refresh the splits list
      await fetchSplits();
      
      return data;
    } catch (err: any) {
      logger.error('Error updating deal split:', err);
      setError(err.message);
      toast.error(err.message || 'Failed to update deal split');
      throw err;
    }
  }, [splits, fetchSplits]);

  // Delete a deal split
  const deleteSplit = useCallback(async (id: string) => {
    try {
      setError(null);

      // Get the split details before deleting
      const splitToDelete = splits.find(s => s.id === id);
      if (!splitToDelete) {
        throw new Error('Split not found');
      }

      const { error: deleteError } = await supabase
        .from('deal_splits')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      // Also delete the related split activity
      const { error: activityDeleteError } = await supabase
        .from('activities')
        .delete()
        .eq('deal_id', splitToDelete.deal_id)
        .eq('user_id', splitToDelete.user_id)
        .eq('is_split', true);

      if (activityDeleteError) {
        logger.warn('Failed to delete split activity:', activityDeleteError);
      } else {
        logger.log(`Deleted split activity for user ${splitToDelete.user_id}`);
      }

      // Restore the original activity's amount if this was the last split
      const { data: originalActivity } = await supabase
        .from('activities')
        .select('*')
        .eq('deal_id', splitToDelete.deal_id)
        .eq('type', 'sale')
        .or('is_split.is.null,is_split.eq.false')
        .single();

      if (originalActivity) {
        // Get remaining splits to calculate new percentage
        const remainingSplits = splits.filter(s => s.deal_id === splitToDelete.deal_id && s.id !== id);
        const totalRemainingSplitPercentage = remainingSplits.reduce((sum, split) => sum + split.percentage, 0);
        const ownerPercentage = 100 - totalRemainingSplitPercentage;
        
        // Get the deal to restore the correct amount
        const { data: deal } = await supabase
          .from('deals')
          .select('value')
          .eq('id', splitToDelete.deal_id)
          .single();
        
        if (deal) {
          const restoredAmount = (deal.value || 0) * (ownerPercentage / 100);
          const updatedDetails = totalRemainingSplitPercentage > 0 
            ? `${originalActivity.details?.replace(/ \(\d+% retained after split\)/, '') || 'Sale'} (${ownerPercentage}% retained after split)`
            : originalActivity.details?.replace(/ \(\d+% retained after split\)/, '') || 'Sale';
          
          await supabase
            .from('activities')
            .update({ 
              details: updatedDetails,
              amount: restoredAmount,
              split_percentage: totalRemainingSplitPercentage > 0 ? ownerPercentage : null
            })
            .eq('id', originalActivity.id);
            
          logger.log(`Restored original activity to ${ownerPercentage}% (${restoredAmount})`);
        }
      }

      toast.success('Deal split deleted successfully');
      
      // Refresh the splits list
      await fetchSplits();
      
      return true;
    } catch (err: any) {
      logger.error('Error deleting deal split:', err);
      setError(err.message);
      toast.error(err.message || 'Failed to delete deal split');
      return false;
    }
  }, [splits, fetchSplits]);

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