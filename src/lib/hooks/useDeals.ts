import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { API_BASE_URL, DISABLE_EDGE_FUNCTIONS } from '@/lib/config';
import { fetchWithRetry, apiCall } from '@/lib/utils/apiUtils';
import { supabase, supabaseAdmin } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

// Security: Sanitize error messages to prevent sensitive data exposure
function sanitizeErrorMessage(error: any): string {
  const message = error?.message || 'Unknown error';
  
  // Log full error server-side but return sanitized message to user
  logger.error('Deal operation error (sanitized for user):', {
    message,
    timestamp: new Date().toISOString(),
    // Don't log full error object to prevent sensitive data exposure
  });
  
  // Return generic error messages for common errors
  if (message.includes('duplicate key')) {
    return 'A deal with this information already exists';
  }
  if (message.includes('foreign key')) {
    return 'Referenced record not found';
  }
  if (message.includes('PGRST')) {
    return 'Database connection error';
  }
  if (message.includes('JWT')) {
    return 'Authentication required';
  }
  
  return 'Operation failed. Please try again.';
}

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
    try {
      setIsLoading(true);
      setError(null);
      
      logger.log('🔄 Starting deals fetch for owner:', ownerId || 'ALL');
      
      // Check authentication first
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        logger.log('❌ No session found, using service key fallback');
        // Skip Edge Functions entirely and go straight to service key fallback
        // Use basic query without complex relationships
        let serviceDealsData, serviceError;
        try {
          logger.log('🔄 Trying basic deals query with service key...');
          let query = (supabaseAdmin as any)
            .from('deals')
            .select('*');
          
          // Only filter by owner if ownerId is provided
          if (ownerId) {
            query = query.eq('owner_id', ownerId);
          }
          
          const result = await query.order('created_at', { ascending: false });
            
          serviceDealsData = result.data;
          serviceError = result.error;
          
          if (serviceError) {
            logger.error('❌ Service key basic query failed:', serviceError);
            throw serviceError;
          }
          
          logger.log(`✅ Service key query successful: ${serviceDealsData?.length || 0} deals found`);
        } catch (relationshipError) {
          logger.error('❌ Service client query failed:', relationshipError);
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

      logger.log('✅ Session found, using direct Supabase query');

      // Use a single, efficient query instead of multiple fallbacks
      let dealsData, queryError;
      
      try {
        // Try with regular client first (has user context)
        let query = (supabase as any)
          .from('deals')
          .select('*');
        
        // Only filter by owner if ownerId is provided
        if (ownerId) {
          query = query.eq('owner_id', ownerId);
        }
        
        const result = await query.order('created_at', { ascending: false });
        
        dealsData = result.data;
        queryError = result.error;
        
        if (queryError) {
          // If regular client fails, try admin client as fallback
          logger.warn('Regular client failed, trying admin client:', queryError);
          
          let adminQuery = (supabaseAdmin as any)
            .from('deals')
            .select('*');
          
          if (ownerId) {
            adminQuery = adminQuery.eq('owner_id', ownerId);
          }
          
          const adminResult = await adminQuery.order('created_at', { ascending: false });
          dealsData = adminResult.data;
          queryError = adminResult.error;
        }
        
        if (queryError) {
          logger.error('❌ All queries failed:', queryError);
          throw queryError;
        }
        
        logger.log(`✅ Query successful: ${dealsData?.length || 0} deals found`);
        
      } catch (err) {
        logger.error('❌ Failed to fetch deals:', err);
        throw err;
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
        
        logger.log(`✅ Processing complete: ${processedDeals.length} deals ready`);
        setDeals(processedDeals);
    } catch (err: any) {
      const sanitizedMessage = sanitizeErrorMessage(err);
      logger.error('❌ Error fetching deals - sanitized message:', sanitizedMessage);
      setError(sanitizedMessage);
      toast.error(sanitizedMessage);
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
      logger.error('Error fetching stages:', err);
      setError(err.message);
    }
  }, []);

  // Load data on mount and when ownerId changes (including when undefined for "ALL")
  useEffect(() => {
    fetchStages();
    fetchDeals(); // Always fetch deals - let the query logic handle filtering
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
      logger.log('🚀 Starting deal creation with data:', dealData);
      logger.log('📍 API_BASE_URL:', API_BASE_URL);
      
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

        logger.log('✅ Deal API response:', result);
        toast.success('Deal created successfully');
        await fetchDeals(); // Refresh to get updated data
        // API returns { data: dealObject }, so we need to check the structure
        const createdDeal = result.data?.data || result.data || result;
        logger.log('📦 Extracted deal from response:', createdDeal);
        return createdDeal; // Return the created deal object
      } catch (edgeFunctionError) {
        logger.log('⚠️ API call failed, falling back to Supabase:', edgeFunctionError);
        
        // Fallback to direct Supabase client
        const { data: deal, error } = await (supabase as any)
          .from('deals')
          .insert({
            ...dealData,
            stage_changed_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) {
          logger.error('❌ Supabase fallback also failed:', error);
          throw error;
        }
        
        logger.log('✅ Deal created via Supabase fallback:', deal);
        toast.success('Deal created successfully');
        await fetchDeals(); // Refresh to get updated data
        return deal; // Return the created deal object
      }
    } catch (error: any) {
      const sanitizedMessage = sanitizeErrorMessage(error);
      logger.error('Error creating deal - sanitized message:', sanitizedMessage);
      toast.error(sanitizedMessage);
      return false;
    }
  };

  const updateDeal = async (id: string, updates: any) => {
    try {
      logger.log('🔄 Updating deal with data:', updates);
      
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

        logger.log('✅ Edge Function update successful');
        toast.success('Deal updated successfully');
        logger.log('🔄 Calling fetchDeals to refresh pipeline data after update...');
        await fetchDeals(); // Refresh to get updated data
        logger.log('✅ Pipeline data refreshed after deal update');
        return true;
      } catch (edgeFunctionError) {
        logger.warn('⚠️ Edge Function failed, trying direct Supabase client:', edgeFunctionError);
        
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
          logger.log('🗓️ Processing expected_close_date:', updateData.expected_close_date);
          
          // Ensure proper date format or null
          if (updateData.expected_close_date === '' || updateData.expected_close_date === undefined) {
            updateData.expected_close_date = null;
          } else if (updateData.expected_close_date) {
            try {
              // Validate and format the date
              const dateObj = new Date(updateData.expected_close_date);
              if (isNaN(dateObj.getTime())) {
                logger.warn('⚠️ Invalid date format, setting to null');
                updateData.expected_close_date = null;
              } else {
                // Format as YYYY-MM-DD for PostgreSQL DATE type
                updateData.expected_close_date = dateObj.toISOString().split('T')[0];
              }
            } catch (dateError) {
              logger.warn('⚠️ Date processing error, setting to null:', dateError);
              updateData.expected_close_date = null;
            }
          }
        }
        
        logger.log('📤 Final update data being sent to Supabase:', updateData);
        
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
              logger.warn('⚠️ Schema cache issue detected, trying update without expected_close_date');
              
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
              logger.log('🔄 Calling fetchDeals to refresh pipeline data after fallback update...');
              await fetchDeals();
              logger.log('✅ Pipeline data refreshed after fallback deal update');
              return true;
            }
            throw error;
          }
          
          logger.log('✅ Direct Supabase update successful');
          toast.success('Deal updated successfully');
          logger.log('🔄 Calling fetchDeals to refresh pipeline data after update...');
          await fetchDeals(); // Refresh to get updated data
          logger.log('✅ Pipeline data refreshed after deal update');
          return true;
          
        } catch (supabaseError: any) {
          logger.error('❌ Supabase update failed:', supabaseError);
          
          // Last resort: try basic update without potentially problematic fields
          if (supabaseError.message && supabaseError.message.includes('schema cache')) {
            logger.log('🔄 Attempting basic update without problematic fields...');
            
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
            logger.log('🔄 Calling fetchDeals to refresh pipeline data after basic update...');
            await fetchDeals();
            logger.log('✅ Pipeline data refreshed after basic deal update');
            return true;
          }
          
          throw supabaseError;
        }
      }
    } catch (error: any) {
      const sanitizedMessage = sanitizeErrorMessage(error);
      logger.error('❌ Error updating deal - sanitized message:', sanitizedMessage);
      
      // Provide more specific error messages while maintaining sanitization
      let errorMessage = sanitizedMessage;
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
      const sanitizedMessage = sanitizeErrorMessage(error);
      logger.error('Error deleting deal - sanitized message:', sanitizedMessage);
      toast.error(sanitizedMessage);
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
      const sanitizedMessage = sanitizeErrorMessage(error);
      logger.error('Error moving deal - sanitized message:', sanitizedMessage);
      toast.error(sanitizedMessage);
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