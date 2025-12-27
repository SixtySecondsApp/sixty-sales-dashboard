// Lightweight activities actions hook - only provides create functions
// Does NOT load activities data, preventing performance issues

import { supabase } from '@/lib/supabase/clientV2';
import { useQueryClient } from '@tanstack/react-query';
import { ConfettiService } from '@/lib/services/confettiService';
import { toast } from 'sonner';
import { eventBus } from '@/lib/communication/EventBus';
import { useUser } from '@/lib/hooks/useUser';

export function useActivitiesActions() {
  const queryClient = useQueryClient();
  // Get cached user data to avoid duplicate auth/profile calls
  const { userData } = useUser();

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
    meeting_id?: string | null;
    company_id?: string | null;
    contact_id?: string | null;
  }) => {
    try {
      if (!userData?.id) throw new Error('Not authenticated');

      // Use cached profile data instead of fetching again
      const salesRep = userData.first_name || userData.last_name
        ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim()
        : userData.email || 'Unknown';

      // Create the insert data with only database-compatible fields
      // Filter out undefined values to prevent database errors
      const insertData: any = {
        type: activity.type,
        client_name: activity.client_name || 'Unknown',
        user_id: userData.id,
        sales_rep: salesRep,
        priority: activity.priority || 'medium',
        date: activity.date || new Date().toISOString(),
        status: activity.status || 'completed',
      };

      // Only add optional fields if they have valid values
      if (activity.details !== undefined && activity.details !== null) {
        insertData.details = activity.details;
      }
      if (activity.amount !== undefined && activity.amount !== null && !isNaN(activity.amount)) {
        insertData.amount = activity.amount;
      }
      if (activity.quantity !== undefined && activity.quantity !== null && activity.quantity > 0) {
        insertData.quantity = activity.quantity;
      }
      // Only add deal_id if it's a valid UUID and exists in deals table
      if (activity.deal_id !== undefined && activity.deal_id !== null && activity.deal_id !== '' && activity.deal_id !== 'null') {
        try {
          // Validate that the deal exists before trying to link it
          const { data: dealExists, error: dealCheckError } = await supabase
            .from('deals')
            .select('id')
            .eq('id', activity.deal_id)
            .single();
          
          if (dealCheckError) {
          } else if (dealExists) {
            insertData.deal_id = activity.deal_id;
          } else {
          }
        } catch (error) {
        }
      } else {
      }

      // Link meeting/company/contact if provided (best-effort, no extra validation to avoid latency)
      if (activity.meeting_id) {
        insertData.meeting_id = activity.meeting_id;
      }
      if (activity.company_id) {
        insertData.company_id = activity.company_id;
      }
      if (activity.contact_id) {
        insertData.contact_id = activity.contact_id;
      }
      if (activity.contactIdentifier !== undefined && activity.contactIdentifier !== null && activity.contactIdentifier !== '') {
        insertData.contact_identifier = activity.contactIdentifier;
      }
      if (activity.contactIdentifierType !== undefined && activity.contactIdentifierType !== null && activity.contactIdentifierType !== '') {
        insertData.contact_identifier_type = activity.contactIdentifierType;
      }
      
      // Debug: log what we're about to insert
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

      // Emit event for components listening to activity creation
      eventBus.emit('activity:created', {
        type: activity.type,
        id: data.id,
        clientName: activity.client_name,
      });

      return data;
    } catch (error) {
      throw error;
    }
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
    company_id?: string | null;
    contact_id?: string | null;
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
      company_id: sale.company_id || null,
      contact_id: sale.contact_id || null,
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