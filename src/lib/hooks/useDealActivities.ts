// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from '@/lib/hooks/useUser';
import { Deal } from '@/lib/database/models';
import logger from '@/lib/utils/logger';

interface DealActivity {
  id: string;
  deal_id: string | null;
  user_id: string;
  activity_type: string;
  contact_email?: string;
  notes?: string;
  due_date?: string;
  completed: boolean;
  is_matched: boolean;
  created_at: string;
  updated_at: string;
  profile_id?: string | null;
  profile_full_name?: string | null;
  profile_avatar_url?: string | null;
}

type DealCreationData = Omit<Deal, 'id' | 'created_at' | 'updated_at' | 'stage_changed_at' | 'deals_stages' | 'profiles' | 'deal_activities'>;
type DealUpdateData = Partial<DealCreationData> & { 
  stage_changed_at?: string; 
  first_meeting_date?: string | null;
  sql_date?: string | null;
  opportunity_date?: string | null;
  verbal_date?: string | null;
  closed_won_date?: string | null;
  closed_lost_date?: string | null;
};

const extractDomain = (email: string): string | undefined => {
  return email.split('@')[1];
};

const activityTypeToStageName: { [key: string]: string } = {
  Meeting: 'SQL',
  Proposal: 'Opportunity',
  Sale: 'Signed',
};

const matchingActivityTypes = ['Meeting', 'Proposal', 'Sale'];

interface ActivityFilters {
  is_matched?: boolean;
  deal_id?: string | null;
}

export function useDealActivities(filters?: ActivityFilters) {
  const [activities, setActivities] = useState<DealActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const { userData } = useUser();

  const [stageIds, setStageIds] = useState<{ [key: string]: string }>({});
  useEffect(() => {
    const fetchStageIds = async () => {
      const { data, error } = await supabase
        .from('deal_stages')
        .select('id, name');
      if (error) {
        logger.error('Error fetching deal stage IDs:', error);
        setError(error);
      } else if (data) {
        const ids = data.reduce((acc, stage) => {
          acc[stage.name] = stage.id;
          return acc;
        }, {} as { [key: string]: string });
        setStageIds(ids);
      }
    };
    fetchStageIds();
  }, []);

  const fetchActivities = useCallback(async () => {
    if (!userData?.id) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Build query parameters
      const queryParams: Record<string, string> = {};
      if (filters?.deal_id) queryParams.deal_id = filters.deal_id;
      if (filters?.is_matched !== undefined) queryParams.is_matched = filters.is_matched.toString();
      
      // Use the edge function with proper parameter handling
      const { data, error } = await supabase.functions.invoke('deal-activities', {
        body: queryParams, // Send as body for better parameter handling
        method: 'POST' // Use POST to send parameters in body
      });
      
      if (error) {
        logger.error('Supabase function error:', error);
        throw error;
      }
      
      setActivities(data?.data || []);
    } catch (err: any) {
      logger.error('Error fetching deal activities:', err);
      
      // Fallback: Try to fetch directly from the view if edge function fails
      try {
        logger.log('Attempting fallback query...');
        let query = supabase
          .from('deal_activities_with_profile')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (filters?.deal_id) {
          query = query.eq('deal_id', filters.deal_id);
        }
        
        const { data: fallbackData, error: fallbackError } = await query;
        
        if (fallbackError) {
          throw fallbackError;
        }
        
        setActivities(fallbackData || []);
        logger.log('Fallback query successful');
      } catch (fallbackErr: any) {
        logger.error('Fallback query also failed:', fallbackErr);
        setError(fallbackErr);
      }
    } finally {
      setIsLoading(false);
    }
  }, [userData?.id, filters?.deal_id, filters?.is_matched]);
  
  useEffect(() => {
    fetchActivities();
    
    let subscription;
    if (userData?.id) {
      const subscriptionFilter = filters?.deal_id 
          ? `deal_id=eq.${filters.deal_id}` 
          : undefined;

      subscription = supabase
        .channel('deal_activity_changes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'deal_activities',
          filter: subscriptionFilter 
        }, (payload) => {
          logger.log('Deal activity change received, refetching from view...', payload);
          fetchActivities();
        })
        .subscribe();
    }
      
    return () => {
      if (subscription) {
         supabase.removeChannel(subscription);
      }
    };
  }, [fetchActivities, userData?.id, filters?.deal_id, filters?.is_matched]);
  
  const createActivity = async (activityData: Omit<DealActivity, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_matched' | 'deal_id' | 'profile_id' | 'profile_full_name' | 'profile_avatar_url'> & { contact_email?: string }) => {
    if (!userData?.id || !Object.keys(stageIds).length) {
      logger.error("User data or stage IDs not available for creating activity.");
      setError("User data or stage IDs not available.");
      return null;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      const { activity_type, contact_email, ...restActivityData } = activityData;
      let dealToLink: Deal | null = null;
      let newActivityPayload: Omit<DealActivity, 'id' | 'created_at' | 'updated_at' | 'profiles'>;

      if (matchingActivityTypes.includes(activity_type) && contact_email) {
        const { data: existingDeals, error: findError } = await supabase
          .from('deals')
          .select('*')
          .eq('contact_email', contact_email)
          .limit(1);

        if (findError) throw findError;

        const existingDeal = existingDeals?.[0];
        const targetStageName = activityTypeToStageName[activity_type];
        const targetStageId = stageIds[targetStageName];

        if (!targetStageId) {
          throw new Error(`Stage ID for '${targetStageName}' not found.`);
        }

        const now = new Date().toISOString();
        let dealUpdateData: DealUpdateData = { stage_id: targetStageId, stage_changed_at: now };
        
        if (activity_type === 'Meeting') dealUpdateData.sql_date = now;
        if (activity_type === 'Proposal') dealUpdateData.opportunity_date = now;
        if (activity_type === 'Sale') dealUpdateData.closed_won_date = now;

        if (existingDeal) {
          dealToLink = existingDeal;

          if (activity_type === 'Meeting' && !existingDeal.first_meeting_date) {
             dealUpdateData.first_meeting_date = now;
          }

          const { data: updatedDealData, error: updateError } = await supabase
            .from('deals')
            .update(dealUpdateData)
            .eq('id', existingDeal.id)
            .select()
            .single();

          if (updateError) throw updateError;
          dealToLink = updatedDealData;

        } else {
          const companyName = extractDomain(contact_email) || 'Unknown Company';
          const dealName = `Deal for ${contact_email}`;

          const newDealPayload: DealCreationData = {
            name: dealName,
            company: companyName,
            contact_email: contact_email,
            value: 0,
            stage_id: targetStageId,
            owner_id: userData.id,
            first_meeting_date: activity_type === 'Meeting' ? now : null,
            sql_date: activity_type === 'Meeting' ? now : null,
            opportunity_date: activity_type === 'Proposal' ? now : null,
            verbal_date: null,
            closed_won_date: activity_type === 'Sale' ? now : null,
            closed_lost_date: null,
            contact_name: '', 
            contact_phone: '',
            description: '',
            expected_close_date: null,
            probability: stageIds[targetStageName] ? (await supabase.from('deal_stages').select('default_probability').eq('id', stageIds[targetStageName]).single()).data?.default_probability ?? 0 : 0,
            status: 'active',
      };
      
          const { data: createdDealData, error: createError } = await supabase
            .from('deals')
            .insert(newDealPayload)
            .select()
            .single();

          if (createError) throw createError;
          dealToLink = createdDealData;
        }

        newActivityPayload = {
          ...restActivityData,
          activity_type,
          contact_email,
          user_id: userData.id,
          deal_id: dealToLink?.id ?? null,
          is_matched: true,
          completed: restActivityData.completed ?? false,
        };

      } else if (activity_type === 'Outbound') {
        newActivityPayload = {
          ...restActivityData,
          activity_type,
          contact_email,
          user_id: userData.id,
          deal_id: null,
          is_matched: true,
          completed: restActivityData.completed ?? false,
        };
      } else {
        newActivityPayload = {
          ...restActivityData,
          activity_type,
          contact_email,
          user_id: userData.id,
          deal_id: null,
          is_matched: false,
          completed: restActivityData.completed ?? false,
        };
      }

      const { data: createdActivityBaseData, error: activityError } = await supabase
        .from('deal_activities')
        .insert(newActivityPayload)
        .select()
        .single();
        
      if (activityError) throw activityError;
      
      const profileData = {
          profile_id: userData.id,
          profile_full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
          profile_avatar_url: userData.avatar_url
      };
      
      const finalActivityDataForState: DealActivity = {
          ...createdActivityBaseData,
          ...profileData
      };
      
      setActivities(prev => [finalActivityDataForState, ...prev]);
      
      return finalActivityDataForState;

    } catch (err) {
      logger.error('Error creating activity and handling deal logic:', err);
      setError(err);
      return null;
    } finally {
        setIsLoading(false);
    }
  };
  
  const updateActivity = async (id: string, updates: Partial<Omit<DealActivity, 'profile_id' | 'profile_full_name' | 'profile_avatar_url'>>) => {
    if (!userData?.id) return false;
    
    try {
      setError(null);
      
      const { data, error } = await supabase
        .from('deal_activities')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      
      return true;
    } catch (err) {
      logger.error('Error updating activity:', err);
      setError(err);
      return false;
    }
  };
  
  const deleteActivity = async (id: string) => {
    if (!userData?.id) return false;
    
    try {
      setError(null);
      
      const { error } = await supabase
        .from('deal_activities')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      return true;
    } catch (err) {
      logger.error('Error deleting activity:', err);
      setError(err);
      return false;
    }
  };

  return {
    activities,
    isLoading,
    error,
    createActivity,
    updateActivity,
    deleteActivity,
    refreshActivities: fetchActivities,
    stageIds
  };
} 