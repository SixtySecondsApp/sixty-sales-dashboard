// Lightweight deals actions hook - only provides search and update functions
// Does NOT load all deals data, preventing performance issues

import { supabase } from '@/lib/supabase/clientV2';
import { useQueryClient } from '@tanstack/react-query';

interface Deal {
  id: string;
  name: string;
  company: string | null;
  value: number;
  stage_id: string;
  owner_id: string;
  one_off_revenue?: number | null;
  monthly_mrr?: number | null;
  annual_value?: number | null;
}

export function useDealsActions() {
  const queryClient = useQueryClient();

  // Find deals by client name and stage (lightweight query)
  const findDealsByClient = async (clientName: string, stageId?: string): Promise<Deal[]> => {
    let query = supabase
      .from('deals')
      .select('id, name, company, value, stage_id, owner_id, one_off_revenue, monthly_mrr, annual_value')
      .ilike('company', `%${clientName}%`);

    if (stageId) {
      query = query.eq('stage_id', stageId);
    }

    const { data, error } = await query.limit(10); // Limit to prevent large queries

    if (error) {
      throw new Error(`Failed to find deals: ${error.message}`);
    }

    return data || [];
  };

  // Move deal to a different stage
  const moveDealToStage = async (dealId: string, stageId: string, updates?: {
    value?: number;
    one_off_revenue?: number | null;
    monthly_mrr?: number | null;
    annual_value?: number | null;
  }): Promise<void> => {
    const updateData: any = {
      stage_id: stageId,
      updated_at: new Date().toISOString(),
      stage_changed_at: new Date().toISOString(),
    };

    // Add optional updates
    if (updates) {
      if (updates.value !== undefined) updateData.value = updates.value;
      if (updates.one_off_revenue !== undefined) updateData.one_off_revenue = updates.one_off_revenue;
      if (updates.monthly_mrr !== undefined) updateData.monthly_mrr = updates.monthly_mrr;
      if (updates.annual_value !== undefined) updateData.annual_value = updates.annual_value;
    }

    const { error } = await supabase
      .from('deals')
      .update(updateData)
      .eq('id', dealId);

    if (error) {
      throw new Error(`Failed to move deal: ${error.message}`);
    }

    // Invalidate relevant queries to trigger refresh where needed
    queryClient.invalidateQueries({ queryKey: ['deals'] });
    queryClient.invalidateQueries({ queryKey: ['activities'] });
  };

  return {
    findDealsByClient,
    moveDealToStage,
  };
}