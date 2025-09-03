import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/config';
import { apiCall } from '@/lib/utils/apiUtils';
import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';
import { sanitizeErrorMessage } from './utils/dealValidation';
import { DealStage, DealWithRelationships, DealForStageTransition } from './types/dealTypes';

export function useDealStages(
  deals: DealWithRelationships[],
  stages: DealStage[],
  onDataChange?: () => void
) {
  const [error, setError] = useState<string | null>(null);

  // Fetch stages from API
  const fetchStages = useCallback(async (): Promise<DealStage[]> => {
    try {
      // Try Edge Function first
      try {
        const result = await apiCall<DealStage[]>(
          `${API_BASE_URL}/stages`,
          {},
          { maxRetries: 1, retryDelay: 1000, showToast: false }
        );
        
        return result || [];
      } catch (edgeFunctionError) {
        // Fallback to direct Supabase client
        const { data: stagesData, error: supabaseError } = await (supabase as any)
          .from('deal_stages')
          .select('*')
          .order('order_position', { ascending: true });
        
        if (supabaseError) {
          throw supabaseError;
        }
        
        return stagesData || [];
      }
    } catch (err: any) {
      logger.error('Error fetching stages:', err);
      setError(err.message);
      return [];
    }
  }, []);

  const moveDealToStage = async (dealId: string, stageId: string) => {
    try {
      // Get the deal and stage information for activity creation
      const deal = deals.find(d => d.id === dealId);
      const fromStage = deal && deal.stage_id ? stages.find(s => s.id === deal.stage_id) || null : null;
      const toStage = stages.find(s => s.id === stageId);
      
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

        // Note: Automatic activity creation on stage transitions disabled per user request
        // Users can manually create activities as needed

        onDataChange?.();
        return true;
      } catch (edgeFunctionError) {
        
        // Fallback to direct Supabase client
        const { data: updatedDeal, error } = await (supabase as any)
          .from('deals')
          .update({ 
            stage_id: stageId,
            stage_changed_at: new Date().toISOString()
          })
          .eq('id', dealId)
          .select()
          .single();
        
        if (error) throw error;
        
        // Note: Automatic activity creation on stage transitions disabled per user request
        // Users can manually create activities as needed
        
        onDataChange?.();
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

  return {
    fetchStages,
    moveDealToStage,
    forceUpdateDealStage,
    error
  };
}