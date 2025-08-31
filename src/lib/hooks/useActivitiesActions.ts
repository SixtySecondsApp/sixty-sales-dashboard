// Lightweight activities actions hook - only provides create functions
// Does NOT load activities data, preventing performance issues

import { supabase } from '@/lib/supabase/clientV2';
import { useQueryClient } from '@tanstack/react-query';
import { ConfettiService } from '@/lib/services/confettiService';
import { toast } from 'sonner';

export function useActivitiesActions() {
  const queryClient = useQueryClient();

  const addActivity = async (activity: {
    type: 'sale' | 'outbound' | 'meeting' | 'proposal';
    client_name: string;
    details?: string;
    amount?: number;
    priority?: 'high' | 'medium' | 'low';
    date?: string;
    quantity?: number;
    contactIdentifier?: string;
    contactIdentifierType?: string;
    status?: string;
    deal_id?: string | null;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single();

    if (!profile) throw new Error('User profile not found');

    // Create the insert data with only database-compatible fields
    const insertData = {
      type: activity.type,
      client_name: activity.client_name,
      details: activity.details,
      amount: activity.amount,
      priority: activity.priority || 'medium',
      date: activity.date || new Date().toISOString(),
      quantity: activity.quantity,
      status: activity.status || 'completed',
      deal_id: activity.deal_id,
      user_id: user.id,
      sales_rep: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
      // Map camelCase to snake_case for database
      contact_identifier: activity.contactIdentifier,
      contact_identifier_type: activity.contactIdentifierType,
    };
    
    const { data, error } = await supabase
      .from('activities')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create activity: ${error.message}`);
    }

    // Invalidate queries to trigger refresh where needed
    queryClient.invalidateQueries({ queryKey: ['activities'] });
    queryClient.invalidateQueries({ queryKey: ['activities-lazy'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });

    return data;
  };

  const addSale = async (sale: {
    client_name: string;
    amount: number;
    details: string;
    date?: string;
    saleType?: 'one-off' | 'subscription' | 'lifetime';
    oneOffRevenue?: number;
    monthlyMrr?: number;
    contactIdentifier?: string;
    contactIdentifierType?: string;
    deal_id?: string | null;
  }) => {
    // Create the sale activity
    const saleActivity = await addActivity({
      type: 'sale',
      client_name: sale.client_name,
      amount: sale.amount,
      details: sale.details,
      date: sale.date,
      contactIdentifier: sale.contactIdentifier,
      contactIdentifierType: sale.contactIdentifierType,
      deal_id: sale.deal_id,
    });

    // Show celebration for sales
    ConfettiService.celebrate();
    toast.success(`🎉 Sale recorded for ${sale.client_name}!`);

    return saleActivity;
  };

  return {
    addActivity,
    addSale,
  };
}