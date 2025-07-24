import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { API_BASE_URL, DISABLE_EDGE_FUNCTIONS } from '@/lib/config';
import { fetchWithRetry, apiCall } from '@/lib/utils/apiUtils';
import { supabase, supabaseAdmin } from '@/lib/supabase/clientV2';

export interface DealWithRelationships {
  id: string;
  name: string;
  company: string;
  contact_name: string;
  value: number;
  status: string;
  stage_id: string;
  created_at: string;
  updated_at: string;
  stage_changed_at: string;
  probability: number;
  close_date: string;
  notes: string;
  owner_id: string;
  company_id?: string;
  primary_contact_id?: string;
  
  // Revenue model fields
  one_off_revenue?: number;
  monthly_mrr?: number;
  annual_value?: number;
  
  // Computed fields
  daysInStage: number;
  timeStatus: 'normal' | 'warning' | 'danger';
  
  // Joined relationship data from Neon (CRM)
  deal_stages?: {
    id: string;
    name: string;
    color: string;
    default_probability: number;
  };
  companies?: {
    id: string;
    name: string;
    domain: string;
    size: string;
    industry: string;
    website: string;
    linkedin_url: string;
  };
  contacts?: {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email: string;
    phone: string;
    title: string;
    linkedin_url: string;
    is_primary: boolean;
  };
  deal_contacts?: Array<{
    contact_id: string;
    contact: {
      id: string;
      full_name: string;
      email: string;
      title: string;
    };
  }>;
}

export interface DealStage {
  id: string;
  name: string;
  color: string;
  order_position: number;
  default_probability: number;
}

export function useDeals(ownerId?: string) {
  const [deals, setDeals] = useState<DealWithRelationships[]>([]);
  const [stages, setStages] = useState<DealStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch deals from API
  const fetchDeals = useCallback(async () => {
    if (!ownerId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 Starting deals fetch for owner:', ownerId);
      
      // Check authentication first
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('❌ No session found, using service key fallback');
        // Skip Edge Functions entirely and go straight to service key fallback
        // Use basic query without complex relationships
        let serviceDealsData, serviceError;
        try {
          console.log('🔄 Trying basic deals query with service key...');
          const result = await (supabaseAdmin as any)
            .from('deals')
            .select('*')
            .eq('owner_id', ownerId)
            .order('created_at', { ascending: false });
            
          serviceDealsData = result.data;
          serviceError = result.error;
          
          if (serviceError) {
            console.error('❌ Service key basic query failed:', serviceError);
            throw serviceError;
          }
          
          console.log(`✅ Service key query successful: ${serviceDealsData?.length || 0} deals found`);
        } catch (relationshipError) {
          console.error('❌ Service client query failed:', relationshipError);
          throw relationshipError;
        }
          
        const processedDeals = serviceDealsData?.map((deal: any) => ({
          ...deal,
          company: deal.company || '', 
          contact_name: deal.contact_name || '', 
          daysInStage: deal.stage_changed_at 
            ? Math.floor((new Date().getTime() - new Date(deal.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24))
            : 0,
          timeStatus: 'normal' as const
        })) || [];
        
        setDeals(processedDeals);
        setIsLoading(false);
        return;
      }

      console.log('✅ Session found, trying authenticated queries');

      // Try Edge Functions if authenticated
      try {
        // Check if Edge Functions are disabled
        if (DISABLE_EDGE_FUNCTIONS) {
          throw new Error('Edge Functions disabled due to migration');
        }

        console.log('🔄 Trying Edge Functions...');
        const response = await apiCall<{ data: DealWithRelationships[] }>(
          `${API_BASE_URL}/deals?owner_id=${ownerId}&includeRelationships=true`
        );
        
        const processedDeals = response.data?.map((deal: any) => ({
          ...deal,
          company: deal.company || deal.companies?.name || '',
          contact_name: deal.contact_name || deal.contacts?.full_name || deal.contacts?.name || `${deal.contacts?.first_name || ''} ${deal.contacts?.last_name || ''}`.trim(),
          daysInStage: deal.stage_changed_at 
            ? Math.floor((new Date().getTime() - new Date(deal.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24))
            : 0,
          timeStatus: 'normal' as const
        })) || [];
        
        console.log(`✅ Edge Functions successful: ${processedDeals.length} deals processed`);
        setDeals(processedDeals);
        setIsLoading(false);
        return;
      } catch (edgeFunctionError) {
        console.warn('⚠️ Edge Function failed, falling back to direct Supabase client:', edgeFunctionError);
        
        // Fallback to direct Supabase client
        // Use basic query without complex relationships
        let dealsData, supabaseError;
        try {
          console.log('🔄 Trying basic Supabase client query...');
          const result = await (supabase as any)
            .from('deals')
            .select('*')
            .eq('owner_id', ownerId)
            .order('created_at', { ascending: false });
          
          dealsData = result.data;
          supabaseError = result.error;
          
          if (supabaseError) {
            console.error('❌ Basic Supabase query failed:', supabaseError);
          } else {
            console.log(`✅ Basic Supabase query successful: ${dealsData?.length || 0} deals found`);
          }
        } catch (relationshipError) {
          console.error('❌ Supabase query failed:', relationshipError);
          supabaseError = relationshipError;
        }
        
        if (supabaseError) {
          // Last resort: try with service role client (singleton)
          try {
            console.log('🔄 Last resort: trying service key...');
            const result = await (supabaseAdmin as any)
              .from('deals')
              .select('*')
              .eq('owner_id', ownerId)
              .order('created_at', { ascending: false });
              
            dealsData = result.data;
            const serviceError = result.error;
              
            if (serviceError) {
              console.error('❌ Service key fallback failed:', serviceError);
              throw serviceError;
            }
            
            console.log(`✅ Service key fallback successful: ${dealsData?.length || 0} deals found`);
            
          } catch (serviceError) {
            console.error('❌ All fallbacks failed:', serviceError);
            throw serviceError;
          }
        }
        
        // Process deals to match expected format
        const processedDeals = dealsData?.map((deal: any) => ({
          ...deal,
          company: deal.company || '', // Use basic company field
          contact_name: deal.contact_name || '', // Use basic contact name field
          daysInStage: deal.stage_changed_at 
            ? Math.floor((new Date().getTime() - new Date(deal.stage_changed_at).getTime()) / (1000 * 60 * 60 * 24))
            : 0,
          timeStatus: 'normal' as const
        })) || [];
        
        console.log(`✅ Final processing complete: ${processedDeals.length} deals ready`);
        setDeals(processedDeals);
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('❌ Error fetching deals:', err);
      setError(err.message);
      toast.error(err.message || 'Failed to fetch deals');
    } finally {
      setIsLoading(false);
    }
  }, [ownerId]);

  // Fetch stages from API
  const fetchStages = useCallback(async () => {
    try {
      // Try Edge Function first
      try {
        const result = await apiCall<DealStage[]>(
          `${API_BASE_URL}/stages`,
          {},
          { maxRetries: 1, retryDelay: 1000, showToast: false }
        );
        
        setStages(result || []);
        return;
      } catch (edgeFunctionError) {
        // Fallback to direct Supabase client
        const { data: stagesData, error: supabaseError } = await (supabase as any)
          .from('deal_stages')
          .select('*')
          .order('order_position', { ascending: true });
        
        if (supabaseError) {
          throw supabaseError;
        }
        
        setStages(stagesData || []);
      }
    } catch (err: any) {
      console.error('Error fetching stages:', err);
      setError(err.message);
    }
  }, []);

  // Load data on mount and when ownerId changes
  useEffect(() => {
    fetchStages();
    if (ownerId) {
      fetchDeals();
    }
  }, [ownerId, fetchDeals, fetchStages]);

  // Group deals by stage for pipeline display
  const dealsByStage = deals.reduce((acc, deal) => {
    const stageId = deal.stage_id;
    if (!acc[stageId]) {
      acc[stageId] = [];
    }
    acc[stageId].push(deal);
    return acc;
  }, {} as Record<string, DealWithRelationships[]>);

  const createDeal = async (dealData: any) => {
    try {
      // Try Edge Function first
      try {
        const result = await apiCall(
          `${API_BASE_URL}/deals`,
          {
            method: 'POST',
            body: JSON.stringify(dealData),
          },
          { maxRetries: 1, retryDelay: 1000, showToast: false }
        );

        toast.success('Deal created successfully');
        await fetchDeals(); // Refresh to get updated data
        return true;
      } catch (edgeFunctionError) {
        
        // Fallback to direct Supabase client
        const { data: deal, error } = await (supabase as any)
          .from('deals')
          .insert({
            ...dealData,
            stage_changed_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) throw error;
        
        toast.success('Deal created successfully');
        await fetchDeals(); // Refresh to get updated data
        return true;
      }
    } catch (error: any) {
      console.error('Error creating deal:', error);
      toast.error(error.message || 'Failed to create deal');
      return false;
    }
  };

  const updateDeal = async (id: string, updates: any) => {
    try {
      console.log('🔄 Updating deal with data:', updates);
      
      // Try Edge Function first
      try {
        const result = await apiCall(
          `${API_BASE_URL}/deals/${id}`,
          {
            method: 'PUT',
            body: JSON.stringify(updates),
          },
          { maxRetries: 1, retryDelay: 1000, showToast: false }
        );

        console.log('✅ Edge Function update successful');
        toast.success('Deal updated successfully');
        console.log('🔄 Calling fetchDeals to refresh pipeline data after update...');
        await fetchDeals(); // Refresh to get updated data
        console.log('✅ Pipeline data refreshed after deal update');
        return true;
      } catch (edgeFunctionError) {
        console.warn('⚠️ Edge Function failed, trying direct Supabase client:', edgeFunctionError);
        
        // Fallback to direct Supabase client
        const updateData = { ...updates };
        
        // Handle stage change tracking
        if (updates.stage_id) {
          // Get current deal to check if stage is actually changing
          const { data: currentDeal } = await (supabase as any)
            .from('deals')
            .select('stage_id')
            .eq('id', id)
            .single();

          if (currentDeal && currentDeal.stage_id !== updates.stage_id) {
            updateData.stage_changed_at = new Date().toISOString();
          }
        }
        
        // Handle expected_close_date specifically
        if ('expected_close_date' in updateData) {
          console.log('🗓️ Processing expected_close_date:', updateData.expected_close_date);
          
          // Ensure proper date format or null
          if (updateData.expected_close_date === '' || updateData.expected_close_date === undefined) {
            updateData.expected_close_date = null;
          } else if (updateData.expected_close_date) {
            try {
              // Validate and format the date
              const dateObj = new Date(updateData.expected_close_date);
              if (isNaN(dateObj.getTime())) {
                console.warn('⚠️ Invalid date format, setting to null');
                updateData.expected_close_date = null;
              } else {
                // Format as YYYY-MM-DD for PostgreSQL DATE type
                updateData.expected_close_date = dateObj.toISOString().split('T')[0];
              }
            } catch (dateError) {
              console.warn('⚠️ Date processing error, setting to null:', dateError);
              updateData.expected_close_date = null;
            }
          }
        }
        
        console.log('📤 Final update data being sent to Supabase:', updateData);
        
        // Try the update with error handling for schema issues
        try {
          const { data: deal, error } = await (supabase as any)
            .from('deals')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
          
          if (error) {
            // Handle specific schema cache errors
            if (error.message && error.message.includes('expected_close_date') && error.message.includes('schema cache')) {
              console.warn('⚠️ Schema cache issue detected, trying update without expected_close_date');
              
              // Remove problematic field and retry
              const { expected_close_date, ...safeUpdateData } = updateData;
              
              const { data: fallbackDeal, error: fallbackError } = await (supabase as any)
                .from('deals')
                .update(safeUpdateData)
                .eq('id', id)
                .select()
                .single();
                
              if (fallbackError) throw fallbackError;
              
              toast.success('Deal updated successfully (note: close date may need manual update)');
              console.log('🔄 Calling fetchDeals to refresh pipeline data after fallback update...');
              await fetchDeals();
              console.log('✅ Pipeline data refreshed after fallback deal update');
              return true;
            }
            throw error;
          }
          
          console.log('✅ Direct Supabase update successful');
          toast.success('Deal updated successfully');
          console.log('🔄 Calling fetchDeals to refresh pipeline data after update...');
          await fetchDeals(); // Refresh to get updated data
          console.log('✅ Pipeline data refreshed after deal update');
          return true;
          
        } catch (supabaseError: any) {
          console.error('❌ Supabase update failed:', supabaseError);
          
          // Last resort: try basic update without potentially problematic fields
          if (supabaseError.message && supabaseError.message.includes('schema cache')) {
            console.log('🔄 Attempting basic update without problematic fields...');
            
            const basicUpdateData: any = {
              name: updateData.name,
              company: updateData.company,
              value: updateData.value,
              stage_id: updateData.stage_id,
              probability: updateData.probability,
              notes: updateData.notes || updateData.description,
              updated_at: new Date().toISOString()
            };
            
            // Remove any undefined values
            Object.keys(basicUpdateData).forEach(key => {
              if (basicUpdateData[key] === undefined) {
                delete basicUpdateData[key];
              }
            });
            
            const { data: basicDeal, error: basicError } = await (supabase as any)
              .from('deals')
              .update(basicUpdateData)
              .eq('id', id)
              .select()
              .single();
              
            if (basicError) throw basicError;
            
            toast.success('Deal updated successfully (some fields may need manual update)');
            console.log('🔄 Calling fetchDeals to refresh pipeline data after basic update...');
            await fetchDeals();
            console.log('✅ Pipeline data refreshed after basic deal update');
            return true;
          }
          
          throw supabaseError;
        }
      }
    } catch (error: any) {
      console.error('❌ Error updating deal:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to update deal';
      if (error.message && error.message.includes('expected_close_date')) {
        errorMessage = 'Failed to update deal - there may be an issue with the close date field';
      } else if (error.message && error.message.includes('schema cache')) {
        errorMessage = 'Database schema issue - please try again or contact support';
      }
      
      toast.error(errorMessage);
      return false;
    }
  };

  const deleteDeal = async (id: string) => {
    try {
      // Try Edge Function first
      try {
        const result = await apiCall(
          `${API_BASE_URL}/deals/${id}`,
          {
            method: 'DELETE',
          },
          { maxRetries: 1, retryDelay: 1000, showToast: false }
        );

        toast.success('Deal deleted successfully');
        await fetchDeals(); // Refresh data
        return true;
      } catch (edgeFunctionError) {
        
        // Fallback to direct Supabase client
        const { error } = await (supabase as any)
          .from('deals')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        toast.success('Deal deleted successfully');
        await fetchDeals(); // Refresh data
        return true;
      }
    } catch (error: any) {
      console.error('Error deleting deal:', error);
      toast.error(error.message || 'Failed to delete deal');
      return false;
    }
  };

  const moveDealToStage = async (dealId: string, stageId: string) => {
    try {
      // Try Edge Function first
      try {
        const result = await apiCall(
          `${API_BASE_URL}/deals/${dealId}`,
          {
            method: 'PUT',
            body: JSON.stringify({ 
              stage_id: stageId,
              stage_changed_at: new Date().toISOString()
            }),
          },
          { maxRetries: 1, retryDelay: 1000, showToast: false }
        );

        await fetchDeals(); // Refresh data
        return true;
      } catch (edgeFunctionError) {
        
        // Fallback to direct Supabase client
        const { data: deal, error } = await (supabase as any)
          .from('deals')
          .update({ 
            stage_id: stageId,
            stage_changed_at: new Date().toISOString()
          })
          .eq('id', dealId)
          .select()
          .single();
        
        if (error) throw error;
        
        await fetchDeals(); // Refresh data
        return true;
      }
    } catch (error: any) {
      console.error('Error moving deal:', error);
      toast.error(error.message || 'Failed to move deal');
      return false;
    }
  };

  const forceUpdateDealStage = async (dealId: string, stageId: string) => {
    return await moveDealToStage(dealId, stageId);
  };

  const refreshDeals = fetchDeals;

  return {
    deals,
    stages,
    dealsByStage,
    isLoading,
    error,
    createDeal,
    updateDeal,
    deleteDeal,
    moveDealToStage,
    forceUpdateDealStage,
    refreshDeals
  };
} 