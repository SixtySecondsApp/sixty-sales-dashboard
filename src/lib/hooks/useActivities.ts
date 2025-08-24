// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/clientV2';

// Type assertion for build compatibility
const supabaseClient = supabase as any;
import { useEffect } from 'react';
import { toast } from 'sonner';
import { ConfettiService } from '@/lib/services/confettiService';
import { IdentifierType } from '@/components/IdentifierField';
import logger from '@/lib/utils/logger';
import { useViewMode } from '@/contexts/ViewModeContext';

export interface Activity {
  id: string;
  type: 'sale' | 'outbound' | 'meeting' | 'proposal';
  client_name: string;
  date: string;
  amount?: number;
  user_id: string;
  sales_rep: string;
  avatar_url?: string | null;
  status: 'completed' | 'pending' | 'cancelled' | 'no_show';
  details: string;
  priority: 'high' | 'medium' | 'low';
  quantity?: number;
  contactIdentifier?: string;
  contactIdentifierType?: IdentifierType;
  deal_id?: string;
  deals?: {
    id: string;
    name: string;
    value: number;
    one_off_revenue?: number;
    monthly_mrr?: number;
    annual_value?: number;
    stage_id: string;
  };
  // Split activity fields
  is_split?: boolean;
  original_activity_id?: string;
  split_percentage?: number;
}

async function fetchActivities(dateRange?: { start: Date; end: Date }, viewedUserId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Use viewed user ID if in view mode, otherwise use current user
  const targetUserId = viewedUserId || user.id;

  logger.log('[fetchActivities] Debug:', {
    viewedUserId,
    targetUserId,
    currentUserId: user.id,
    isViewMode: !!viewedUserId
  });

  let query = (supabase as any)
    .from('activities')
    .select(`
      *,
      deals (
        id,
        name,
        value,
        one_off_revenue,
        monthly_mrr,
        annual_value,
        stage_id
      )
    `);

  // When in view mode, we need to be more flexible with the filtering
  // Activities might be linked via user_id OR via sales_rep name
  if (viewedUserId) {
    // In view mode, get the user's profile to get their name for sales_rep matching
    const { data: profileData } = await (supabase as any)
      .from('profiles')
      .select('first_name, last_name, full_name')
      .eq('id', viewedUserId)
      .single();
    
    logger.log('[fetchActivities] View Mode profile data:', profileData);
    
    if (profileData) {
      const salesRepName = profileData.full_name || 
        `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
      
      logger.log('[fetchActivities] Searching for activities with:', {
        user_id: targetUserId,
        sales_rep: salesRepName
      });
      
      // Filter by either user_id OR sales_rep name
      query = query.or(`user_id.eq.${targetUserId},sales_rep.eq.${salesRepName}`);
    } else {
      // Fallback to just user_id
      logger.log('[fetchActivities] No profile found, using user_id only:', targetUserId);
      query = query.eq('user_id', targetUserId);
    }
  } else {
    // Normal mode - just filter by current user's ID
    query = query.eq('user_id', targetUserId);
  }

  // Apply date range filter if provided
  if (dateRange) {
    query = query
      .gte('date', dateRange.start.toISOString())
      .lte('date', dateRange.end.toISOString());
  }

  query = query.order('date', { ascending: false });

  const { data, error } = await query;

  if (error) {
    logger.error('[fetchActivities] Query error:', error);
    throw error;
  }

  logger.log('[fetchActivities] Raw data count:', data?.length || 0);
  
  // CRITICAL FIX: Don't filter by current user when in view mode!
  // When viewing as another user, we want THEIR activities, not ours
  if (viewedUserId) {
    // In view mode, return all the data from the query (already filtered)
    logger.log('[fetchActivities] View Mode - returning viewed user activities');
    return data || [];
  } else {
    // In normal mode, ensure we only see our own activities (extra safety)
    logger.log('[fetchActivities] Normal Mode - filtering by current user');
    return data?.filter(activity => activity.user_id === user.id) || [];
  }
}

// Helper to process activity if ready
async function processActivityIfReady(activityId: string, contactIdentifier?: string) {
  if (!contactIdentifier) return;
  try {
    const { error } = await supabase.functions.invoke('process-single-activity', {
      body: { activityId },
    });
    if (error) {
      toast.error('Failed to auto-process activity: ' + (error.message || 'Unknown error'));
    }
  } catch (err: any) {
    toast.error('Failed to auto-process activity: ' + (err.message || 'Unknown error'));
  }
}

async function createActivity(activity: {
  type: Activity['type'];
  client_name: string;
  details?: string;
  amount?: number;
  priority?: Activity['priority'];
  date?: string;
  quantity?: number;
  contactIdentifier?: string;
  contactIdentifierType?: IdentifierType;
  status?: Activity['status'];
  deal_id?: string | null;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .single();

  if (!profile) throw new Error('User profile not found');

  const { data, error } = await supabase
    .from('activities')
    .insert({
      user_id: user.id,
      type: activity.type,
      client_name: activity.client_name,
      details: activity.details || null,
      amount: activity.amount,
      priority: activity.priority || 'medium',
      sales_rep: `${profile.first_name} ${profile.last_name}`,
      date: activity.date || new Date().toISOString(),
      status: activity.status || 'completed',
      quantity: activity.quantity || 1,
      contact_identifier: activity.contactIdentifier,
      contact_identifier_type: activity.contactIdentifierType,
      deal_id: activity.deal_id
    })
    .select()
    .single();

  if (error) throw error;

  // Automatically process if ready
  if (data) {
    await processActivityIfReady(data.id, data.contact_identifier);
  }

  return data;
}

async function createSale(sale: {
  client_name: string;
  amount: number;
  details?: string;
  saleType: 'one-off' | 'subscription' | 'lifetime';
  date?: string;
  contactIdentifier?: string;
  contactIdentifierType?: IdentifierType;
  deal_id?: string | null;
  oneOffRevenue?: number;
  monthlyMrr?: number;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .single();

  if (!profile) throw new Error('User profile not found');

  let finalDealId = sale.deal_id;
  let shouldUpdateExistingDeal = false;

  // If deal_id is provided, update that deal to "Signed" stage
  if (finalDealId) {
    shouldUpdateExistingDeal = true;
  } else {
    // Auto-create deal if not provided
    try {
      // Get the "Signed" stage specifically (not "Signed and Paid")
      const { data: stages } = await supabase
        .from('deal_stages')
        .select('id, name')
        .eq('name', 'Signed')
        .limit(1);

      let closedStageId = stages?.[0]?.id;

      // If no "Signed" stage found exactly, try to find "Closed Won" or similar
      if (!closedStageId) {
        const { data: alternativeStages } = await supabase
          .from('deal_stages')
          .select('id, name')
          .or('name.ilike.%closed won%,name.ilike.%won%')
          .limit(1);
        
        closedStageId = alternativeStages?.[0]?.id;
      }

      // If still no closed stage found, get the last stage
      if (!closedStageId) {
        const { data: lastStage } = await supabase
          .from('deal_stages')
          .select('id')
          .order('order_position', { ascending: false })
          .limit(1);
        
        closedStageId = lastStage?.[0]?.id;
      }

      if (closedStageId) {
        // Create a new deal for this sale
        const { data: newDeal, error: dealError } = await supabase
          .from('deals')
          .insert({
            name: `${sale.client_name} - ${sale.saleType} Sale`,
            company: sale.client_name,
            value: sale.amount,
            stage_id: closedStageId,
            owner_id: user.id,
            probability: 100,
            status: 'active',
            expected_close_date: sale.date || new Date().toISOString(),
            // Handle revenue splits: use specific fields if provided, otherwise use sale type logic
            one_off_revenue: sale.oneOffRevenue ?? (sale.saleType === 'one-off' ? sale.amount : null),
            monthly_mrr: sale.monthlyMrr ?? (sale.saleType === 'subscription' ? sale.amount : null),
            annual_value: sale.saleType === 'lifetime' ? sale.amount : null
          })
          .select('id')
          .single();

        if (!dealError && newDeal) {
          finalDealId = newDeal.id;
          logger.log(`Auto-created deal ${newDeal.id} for sale to ${sale.client_name}`);
        }
      }
    } catch (error) {
      logger.warn('Failed to auto-create deal for sale:', error);
      // Continue without deal linkage
    }
  }

  // If we have an existing deal to update, update it to "Signed" stage
  if (shouldUpdateExistingDeal && finalDealId) {
    try {
      // Get the "Signed" stage
      const { data: signedStage } = await supabase
        .from('deal_stages')
        .select('id')
        .eq('name', 'Signed')
        .single();

      if (signedStage) {
        // First, get the existing deal to preserve any existing revenue fields
        const { data: existingDeal } = await supabase
          .from('deals')
          .select('one_off_revenue, monthly_mrr, annual_value')
          .eq('id', finalDealId)
          .single();

        // Calculate the updated revenue fields, preserving existing values where appropriate
        let updatedOneOff = existingDeal?.one_off_revenue || 0;
        let updatedMonthly = existingDeal?.monthly_mrr || 0;
        let updatedAnnual = existingDeal?.annual_value || 0;

        // If specific revenue splits provided, use them
        if (sale.oneOffRevenue !== undefined || sale.monthlyMrr !== undefined) {
          updatedOneOff = sale.oneOffRevenue || 0;
          updatedMonthly = sale.monthlyMrr || 0;
        } else {
          // Otherwise use sale type logic, but don't overwrite existing values
          if (sale.saleType === 'one-off') {
            updatedOneOff = (existingDeal?.one_off_revenue || 0) + sale.amount;
          } else if (sale.saleType === 'subscription') {
            updatedMonthly = (existingDeal?.monthly_mrr || 0) + sale.amount;
          } else if (sale.saleType === 'lifetime') {
            updatedAnnual = sale.amount;
          }
        }

        // Update the deal to "Signed" stage and update revenue fields
        const { error: updateError } = await supabase
          .from('deals')
          .update({
            stage_id: signedStage.id,
            probability: 100,
            expected_close_date: sale.date || new Date().toISOString(),
            one_off_revenue: updatedOneOff > 0 ? updatedOneOff : null,
            monthly_mrr: updatedMonthly > 0 ? updatedMonthly : null,
            annual_value: updatedAnnual > 0 ? updatedAnnual : null,
            value: sale.amount
          })
          .eq('id', finalDealId);

        if (updateError) {
          logger.warn('Failed to update deal stage to Signed:', updateError);
        } else {
          logger.log(`Updated deal ${finalDealId} to Signed stage`);
        }
      }
    } catch (error) {
      logger.warn('Failed to update deal to Signed stage:', error);
    }
  }

  const activityData = {
    user_id: user.id,
    type: 'sale',
    client_name: sale.client_name,
    details: sale.details || `${sale.saleType} Sale`,
    amount: sale.amount,
    priority: 'high',
    sales_rep: `${profile.first_name} ${profile.last_name}`,
    date: sale.date || new Date().toISOString(),
    status: 'completed',
    contact_identifier: sale.contactIdentifier,
    contact_identifier_type: sale.contactIdentifierType,
    deal_id: finalDealId
  };

  const { data, error } = await supabase
    .from('activities')
    .insert(activityData)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Failed to create sale');

  // Automatically process if ready
  if (data) {
    await processActivityIfReady(data.id, data.contact_identifier);
  }

  return data;
}

async function updateActivity(id: string, updates: Partial<Activity>) {
  const { data, error } = await supabase
    .from('activities')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function deleteActivity(id: string) {
  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export function useActivities(dateRange?: { start: Date; end: Date }) {
  const { isViewMode, viewedUser } = useViewMode();
  const queryClient = useQueryClient();

  // Set up real-time subscription for live updates (only once)
  useEffect(() => {
    if (dateRange || isViewMode) return; // Only set up subscription for the main activities hook and not in view mode
    
    async function setupSubscription() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const subscription = supabase
        .channel('activities_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'activities',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            // Invalidate all relevant queries
            queryClient.invalidateQueries({ queryKey: ['activities'] });
            queryClient.invalidateQueries({ queryKey: ['salesData'] });
            queryClient.invalidateQueries({ queryKey: ['targets'] });
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }

    setupSubscription();
  }, [queryClient, dateRange, isViewMode]);

  // Create unique query key based on date range
  const queryKey = dateRange 
    ? ['activities', dateRange.start.toISOString(), dateRange.end.toISOString()]
    : ['activities'];

  const { data: activities = [], isLoading } = useQuery({
    queryKey: isViewMode && viewedUser ? [...queryKey, 'view', viewedUser.id] : queryKey,
    queryFn: () => fetchActivities(dateRange, isViewMode ? viewedUser?.id : undefined),
    // Ensure cache is not shared between view modes
    staleTime: isViewMode ? 0 : 5 * 60 * 1000,
  });

  // Add activity mutation with error handling
  const addActivityMutation = useMutation({
    mutationFn: createActivity,
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['salesData'] });
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      toast.success('Activity added successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to add activity');
      logger.error('[Activities]', error);
    },
  });

  // Add sale mutation with error handling and confetti
  const addSaleMutation = useMutation({
    mutationFn: createSale,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['salesData'] });
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      toast.success('Sale added successfully! 🎉');
      ConfettiService.celebrate();
    },
    onError: (error: Error) => {
      toast.error(`Failed to add sale: ${error.message}`);
    },
  });

  // Update activity mutation with error handling
  const updateActivityMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Activity> }) =>
      updateActivity(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['salesData'] });
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      toast.success('Activity updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update activity');
    },
  });

  // Remove activity mutation with error handling
  const removeActivityMutation = useMutation({
    mutationFn: deleteActivity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['salesData'] });
      queryClient.invalidateQueries({ queryKey: ['targets'] });
      toast.success('Activity deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete activity');
    },
  });

  // Return all mutations and data
  return {
    activities,
    isLoading,
    addActivity: addActivityMutation.mutate,
    addActivityAsync: addActivityMutation.mutateAsync,
    addSale: addSaleMutation.mutate,
    updateActivity: updateActivityMutation.mutate,
    removeActivity: removeActivityMutation.mutate,
  };
}