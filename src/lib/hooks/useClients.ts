import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { API_BASE_URL, DISABLE_EDGE_FUNCTIONS } from '@/lib/config';
import { fetchWithRetry, apiCall } from '@/lib/utils/apiUtils';
import { supabase, supabaseAdmin } from '@/lib/supabase/clientV2';
import { Database } from '@/lib/database.types';
import { useUsers } from '@/lib/hooks/useUsers';

// Security: Sanitize error messages to prevent sensitive data exposure
function sanitizeErrorMessage(error: any): string {
  const message = error?.message || 'Unknown error';
  
  // Log full error server-side but return sanitized message to user
  console.error('Client operation error (sanitized for user):', {
    message,
    timestamp: new Date().toISOString(),
    // Don't log full error object to prevent sensitive data exposure
  });
  
  // Return generic error messages for common errors
  if (message.includes('duplicate key')) {
    return 'A record with this information already exists';
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

export type ClientStatus = Database['public']['Enums']['client_status'];

export interface ClientWithRelationships {
  id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  subscription_amount: number;
  status: ClientStatus;
  deal_id: string | null;
  owner_id: string;
  subscription_start_date: string | null;
  churn_date: string | null;
  created_at: string;
  updated_at: string;
  
  // Computed fields
  subscription_days: number;
  
  // Joined relationship data
  owner?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
  };
  deal?: {
    id: string;
    name: string;
    value: number;
    one_off_revenue?: number;
    monthly_mrr?: number;
  };
}

export interface MRRSummary {
  total_clients: number;
  active_clients: number;
  churned_clients: number;
  paused_clients: number;
  total_mrr: number;
  avg_mrr: number;
  min_mrr: number;
  max_mrr: number;
  churn_rate: number;
  active_rate: number;
}

export interface MRRByOwner {
  owner_id: string;
  owner_name: string;
  total_clients: number;
  active_clients: number;
  churned_clients: number;
  paused_clients: number;
  total_mrr: number;
  avg_mrr: number;
  churn_rate: number;
}

export interface ConvertDealToClientParams {
  company_name?: string;
  contact_name?: string;
  contact_email?: string;
  subscription_amount?: number;
  subscription_start_date?: string;
  status?: ClientStatus;
}

export function useClients(ownerId?: string) {
  const [clients, setClients] = useState<ClientWithRelationships[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch clients from API
  const fetchClients = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 Starting clients fetch for owner:', ownerId);
      
      // Check authentication first
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.log('❌ No session found, using service key fallback');
        // Use basic query without complex relationships
        let serviceClientsData, serviceError;
        try {
          console.log('🔄 Trying basic clients query with service key...');
          let query = supabaseAdmin.from('clients').select('*');
          
          if (ownerId) {
            query = query.eq('owner_id', ownerId);
          }
          
          const result = await query.order('created_at', { ascending: false });
          
          serviceClientsData = result.data;
          serviceError = result.error;
          
          if (serviceError) {
            console.error('❌ Service key basic query failed:', serviceError);
            throw serviceError;
          }
          
          console.log(`✅ Service key query successful: ${serviceClientsData?.length || 0} clients found`);
        } catch (relationshipError) {
          console.error('❌ Service client query failed:', relationshipError);
          throw relationshipError;
        }
          
        const processedClients = serviceClientsData?.map((client: any) => ({
          ...client,
          subscription_amount: parseFloat(client.subscription_amount || 0),
          subscription_days: client.subscription_start_date 
            ? Math.floor((new Date().getTime() - new Date(client.subscription_start_date).getTime()) / (1000 * 60 * 60 * 24))
            : 0
        })) || [];
        
        setClients(processedClients);
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
        const params = new URLSearchParams();
        if (ownerId) params.append('owner_id', ownerId);
        
        const response = await apiCall<ClientWithRelationships[]>(
          `${API_BASE_URL}/clients?${params.toString()}`
        );
        
        const processedClients = response?.map((client: any) => ({
          ...client,
          subscription_amount: parseFloat(client.subscription_amount || 0),
          subscription_days: client.subscription_start_date 
            ? Math.floor((new Date().getTime() - new Date(client.subscription_start_date).getTime()) / (1000 * 60 * 60 * 24))
            : 0
        })) || [];
        
        console.log(`✅ Edge Functions successful: ${processedClients.length} clients processed`);
        setClients(processedClients);
        setIsLoading(false);
        return;
      } catch (edgeFunctionError) {
        console.warn('⚠️ Edge Function failed, falling back to direct Supabase client:', edgeFunctionError);
        
        // Fallback to direct Supabase client
        let clientsData, supabaseError;
        try {
          console.log('🔄 Trying basic Supabase client query...');
          let query = supabase.from('clients').select('*');
          
          if (ownerId) {
            query = query.eq('owner_id', ownerId);
          }
          
          const result = await query.order('created_at', { ascending: false });
          
          clientsData = result.data;
          supabaseError = result.error;
          
          if (supabaseError) {
            console.error('❌ Basic Supabase query failed:', supabaseError);
          } else {
            console.log(`✅ Basic Supabase query successful: ${clientsData?.length || 0} clients found`);
          }
        } catch (relationshipError) {
          console.error('❌ Supabase query failed:', relationshipError);
          supabaseError = relationshipError;
        }
        
        if (supabaseError) {
          // Last resort: try with service role client
          try {
            console.log('🔄 Last resort: trying service key...');
            let query = supabaseAdmin.from('clients').select('*');
            
            if (ownerId) {
              query = query.eq('owner_id', ownerId);
            }
            
            const result = await query.order('created_at', { ascending: false });
            
            clientsData = result.data;
            const serviceError = result.error;
              
            if (serviceError) {
              console.error('❌ Service key fallback failed:', serviceError);
              throw serviceError;
            }
            
            console.log(`✅ Service key fallback successful: ${clientsData?.length || 0} clients found`);
            
          } catch (serviceError) {
            console.error('❌ All fallbacks failed:', serviceError);
            throw serviceError;
          }
        }
        
        // Process clients to match expected format
        const processedClients = clientsData?.map((client: any) => ({
          ...client,
          subscription_amount: parseFloat(client.subscription_amount || 0),
          subscription_days: client.subscription_start_date 
            ? Math.floor((new Date().getTime() - new Date(client.subscription_start_date).getTime()) / (1000 * 60 * 60 * 24))
            : 0
        })) || [];
        
        console.log(`✅ Final processing complete: ${processedClients.length} clients ready`);
        setClients(processedClients);
        setIsLoading(false);
      }
    } catch (err: any) {
      const sanitizedMessage = sanitizeErrorMessage(err);
      console.error('❌ Error fetching clients - sanitized message:', sanitizedMessage);
      setError(sanitizedMessage);
      toast.error(sanitizedMessage);
    } finally {
      setIsLoading(false);
    }
  }, [ownerId]);

  // Load data on mount and when ownerId changes
  useEffect(() => {
    fetchClients();
  }, [ownerId, fetchClients]);

  const createClient = async (clientData: Database['public']['Tables']['clients']['Insert']) => {
    try {
      // Try Edge Function first
      try {
        const result = await apiCall(
          `${API_BASE_URL}/clients`,
          {
            method: 'POST',
            body: JSON.stringify(clientData),
          },
          { maxRetries: 1, retryDelay: 1000, showToast: false }
        );

        toast.success('Client created successfully');
        await fetchClients(); // Refresh to get updated data
        return true;
      } catch (edgeFunctionError) {
        
        // Fallback to direct Supabase client
        const { data: client, error } = await supabase
          .from('clients')
          .insert(clientData)
          .select()
          .single();
        
        if (error) throw error;
        
        toast.success('Client created successfully');
        await fetchClients(); // Refresh to get updated data
        return true;
      }
    } catch (error: any) {
      const sanitizedMessage = sanitizeErrorMessage(error);
      
      // Handle specific error messages
      if (error.message && error.message.includes('unique_deal_conversion')) {
        toast.error('This deal has already been converted to a client');
      } else {
        toast.error(sanitizedMessage);
      }
      return false;
    }
  };

  const updateClient = async (id: string, updates: Database['public']['Tables']['clients']['Update']) => {
    try {
      console.log('🔄 Updating client with data:', updates);
      
      // Try Edge Function first
      try {
        const result = await apiCall(
          `${API_BASE_URL}/clients/${id}`,
          {
            method: 'PUT',
            body: JSON.stringify(updates),
          },
          { maxRetries: 1, retryDelay: 1000, showToast: false }
        );

        console.log('✅ Edge Function update successful');
        toast.success('Client updated successfully');
        await fetchClients(); // Refresh to get updated data
        return true;
      } catch (edgeFunctionError) {
        console.warn('⚠️ Edge Function failed, trying direct Supabase client:', edgeFunctionError);
        
        // Fallback to direct Supabase client
        const { data: client, error } = await supabase
          .from('clients')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        
        if (error) throw error;
        
        console.log('✅ Direct Supabase update successful');
        toast.success('Client updated successfully');
        await fetchClients(); // Refresh to get updated data
        return true;
      }
    } catch (error: any) {
      const sanitizedMessage = sanitizeErrorMessage(error);
      console.error('❌ Error updating client - sanitized message:', sanitizedMessage);
      toast.error(sanitizedMessage);
      return false;
    }
  };

  const deleteClient = async (id: string) => {
    try {
      // Try Edge Function first
      try {
        const result = await apiCall(
          `${API_BASE_URL}/clients/${id}`,
          {
            method: 'DELETE',
          },
          { maxRetries: 1, retryDelay: 1000, showToast: false }
        );

        toast.success('Client deleted successfully');
        await fetchClients(); // Refresh data
        return true;
      } catch (edgeFunctionError) {
        
        // Fallback to direct Supabase client
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        toast.success('Client deleted successfully');
        await fetchClients(); // Refresh data
        return true;
      }
    } catch (error: any) {
      const sanitizedMessage = sanitizeErrorMessage(error);
      console.error('Error deleting client - sanitized message:', sanitizedMessage);
      toast.error(sanitizedMessage);
      return false;
    }
  };

  const convertDealToClient = async (dealId: string, params: ConvertDealToClientParams = {}) => {
    try {
      // Try Edge Function first
      try {
        const result = await apiCall(
          `${API_BASE_URL}/deals/${dealId}/convert-to-subscription`,
          {
            method: 'POST',
            body: JSON.stringify(params),
          },
          { maxRetries: 1, retryDelay: 1000, showToast: false }
        );

        toast.success('Deal converted to subscription successfully');
        await fetchClients(); // Refresh data
        return result;
      } catch (edgeFunctionError) {
        console.error('Deal conversion via Edge Function failed:', edgeFunctionError);
        throw edgeFunctionError;
      }
    } catch (error: any) {
      const sanitizedMessage = sanitizeErrorMessage(error);
      
      // Handle specific error messages
      if (error.message && error.message.includes('already been converted')) {
        toast.error('This deal has already been converted to a subscription');
      } else if (error.message && error.message.includes('not found')) {
        toast.error('Deal not found');
      } else {
        toast.error(sanitizedMessage);
      }
      return null;
    }
  };

  const refreshClients = fetchClients;

  return {
    clients,
    isLoading,
    error,
    createClient,
    updateClient,
    deleteClient,
    convertDealToClient,
    refreshClients
  };
}

// Hook for aggregated client management
export interface AggregatedClient {
  id: string;
  client_name: string;
  total_payments_count: number;
  total_lifetime_value: number;
  total_one_off: number;
  total_monthly_mrr: number;
  active_subscriptions: number;
  last_payment_date: string | null;
  status: ClientStatus;
  contact_identifier?: string;
  sales_rep: string;
  // Churn tracking fields
  notice_given_date?: string | null;
  final_billing_date?: string | null;
  churn_date?: string | null;
  churn_reason?: string | null;
  total_churn_amount?: number;
  remaining_revenue_estimate?: number;
  deals: Array<{
    id: string;
    name: string;
    value: number;
    deal_type: 'one-off' | 'subscription';
    signed_date: string;
    monthly_mrr?: number;
    one_off_revenue?: number;
    annual_value?: number;
  }>;
}

export function useAggregatedClients(ownerId?: string) {
  const [aggregatedClients, setAggregatedClients] = useState<AggregatedClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { users } = useUsers(); // Get users for name resolution

  // Helper function to resolve user names from UUIDs
  const resolveUserName = useCallback((userId: string): string => {
    const user = users.find(u => u.id === userId);
    if (user) {
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
      return fullName || user.email || `User ${userId.slice(0, 8)}`;
    }
    // Check if it's a UUID format
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
    if (!isUuid) return userId; // Return as-is if not UUID
    return `User ${userId.slice(0, 8)}`;
  }, [users]);

  const fetchAggregatedClients = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 Fetching aggregated client data...');
      
      // Get clients data with enhanced aggregation
      const { data: { session } } = await supabase.auth.getSession();
      
      let clientsData, dealsData, activitiesData;
      
      if (session) {
        // Fetch clients
        let clientsQuery = supabase.from('clients').select('*');
        if (ownerId) clientsQuery = clientsQuery.eq('owner_id', ownerId);
        const { data: clients } = await clientsQuery;
        
        // Fetch deals
        let dealsQuery = supabase.from('deals').select('*').eq('status', 'won');
        if (ownerId) dealsQuery = dealsQuery.eq('owner_id', ownerId);
        const { data: deals } = await dealsQuery;
        
        // Fetch activities
        let activitiesQuery = supabase.from('activities').select('*').eq('type', 'sale').eq('status', 'completed');
        if (ownerId) activitiesQuery = activitiesQuery.eq('user_id', ownerId);
        const { data: activities } = await activitiesQuery;
        
        clientsData = clients || [];
        dealsData = deals || [];
        activitiesData = activities || [];
      } else {
        // Use service key
        let clientsQuery = supabaseAdmin.from('clients').select('*');
        if (ownerId) clientsQuery = clientsQuery.eq('owner_id', ownerId);
        const { data: clients } = await clientsQuery;
        
        let dealsQuery = supabaseAdmin.from('deals').select('*').eq('status', 'won');
        if (ownerId) dealsQuery = dealsQuery.eq('owner_id', ownerId);
        const { data: deals } = await dealsQuery;
        
        let activitiesQuery = supabaseAdmin.from('activities').select('*').eq('type', 'sale').eq('status', 'completed');
        if (ownerId) activitiesQuery = activitiesQuery.eq('user_id', ownerId);
        const { data: activities } = await activitiesQuery;
        
        clientsData = clients || [];
        dealsData = deals || [];
        activitiesData = activities || [];
      }
      
      // Group deals by company name (client)
      const clientMap = new Map<string, AggregatedClient>();
      
      dealsData.forEach((deal: any) => {
        const clientName = deal.company;
        
        if (!clientMap.has(clientName)) {
          // Find corresponding client record
          const clientRecord = clientsData.find((c: any) => 
            c.company_name?.toLowerCase() === clientName.toLowerCase() ||
            c.deal_id === deal.id
          );
          
          // IMPROVED: Enhanced sales rep fallback logic
          let salesRep = 'Unknown';
          const correspondingActivity = activitiesData.find((activity: any) => 
            activity.deal_id === deal.id
          );
          
          // Priority order: Activity sales_rep > Deal assigned_to > Deal owner_id > 'Unknown'
          if (correspondingActivity?.sales_rep) {
            salesRep = resolveUserName(correspondingActivity.sales_rep);
          } else if (deal.assigned_to) {
            salesRep = resolveUserName(deal.assigned_to);
          } else if (deal.owner_id) {
            salesRep = resolveUserName(deal.owner_id);
          }
          
          clientMap.set(clientName, {
            id: clientRecord?.id || `generated-${clientName.toLowerCase().replace(/\s+/g, '-')}`,
            client_name: clientName,
            total_payments_count: 0,
            total_lifetime_value: 0,
            total_one_off: 0,
            total_monthly_mrr: 0,
            active_subscriptions: 0,
            last_payment_date: null,
            status: clientRecord?.status || 'active',
            contact_identifier: clientRecord?.contact_email || clientRecord?.contact_name || deal.contact_name,
            sales_rep: salesRep,
            // Churn tracking fields
            notice_given_date: clientRecord?.notice_given_date || null,
            final_billing_date: clientRecord?.final_billing_date || null,
            churn_date: clientRecord?.churn_date || null,
            churn_reason: clientRecord?.churn_reason || null,
            total_churn_amount: 0,
            remaining_revenue_estimate: 0,
            deals: []
          });
        }
        
        const client = clientMap.get(clientName)!;
        
        // Determine deal type and values
        const oneOffRevenue = deal.one_off_revenue || 0;
        const monthlyMRR = deal.monthly_mrr || 0;
        const dealType: 'one-off' | 'subscription' = monthlyMRR > 0 ? 'subscription' : 'one-off';
        
        // BUSINESS RULE: LTV = (monthlyMRR * 3) + oneOffRevenue
        // This gives 3x monthly subscription value PLUS 1x one-time deal value
        const lifetimeValue = (monthlyMRR * 3) + oneOffRevenue;
        
        // Get signed date
        const correspondingActivity = activitiesData.find((activity: any) => 
          activity.deal_id === deal.id
        );
        const signedDate = correspondingActivity?.date || deal.stage_changed_at || deal.created_at;
        
        // Add deal to client's deals array
        client.deals.push({
          id: deal.id,
          name: deal.name,
          value: lifetimeValue,
          deal_type: dealType,
          signed_date: signedDate,
          monthly_mrr: monthlyMRR,
          one_off_revenue: oneOffRevenue,
          annual_value: deal.annual_value || 0
        });
        
        // Aggregate totals
        client.total_payments_count += 1;
        client.total_lifetime_value += lifetimeValue;
        client.total_one_off += oneOffRevenue;
        client.total_monthly_mrr += monthlyMRR;
        
        if (dealType === 'subscription' && monthlyMRR > 0) {
          client.active_subscriptions += 1;
        }
        
        // Update last payment date
        if (!client.last_payment_date || new Date(signedDate) > new Date(client.last_payment_date)) {
          client.last_payment_date = signedDate;
        }
      });
      
      // Calculate churn amounts for each client
      clientMap.forEach((client) => {
        if (client.status === 'churned' && client.churn_date) {
          // Calculate total churn amount based on monthly MRR lost
          client.total_churn_amount = client.total_monthly_mrr * 12; // Annual value lost
        } else if (client.status === 'notice_given' && client.final_billing_date) {
          // Calculate remaining revenue until final billing
          const finalDate = new Date(client.final_billing_date);
          const now = new Date();
          const monthsRemaining = Math.ceil((finalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
          client.remaining_revenue_estimate = Math.max(0, client.total_monthly_mrr * monthsRemaining);
        }
      });
      
      // Convert map to array and sort by last payment date
      const aggregatedData = Array.from(clientMap.values())
        .sort((a, b) => {
          const dateA = a.last_payment_date ? new Date(a.last_payment_date).getTime() : 0;
          const dateB = b.last_payment_date ? new Date(b.last_payment_date).getTime() : 0;
          return dateB - dateA;
        });
      
      console.log('✅ Aggregated clients data:', {
        totalClients: aggregatedData.length,
        clients: aggregatedData.map(c => ({
          name: c.client_name,
          deals: c.total_payments_count,
          value: c.total_lifetime_value,
          mrr: c.total_monthly_mrr
        }))
      });
      
      setAggregatedClients(aggregatedData);
    } catch (err: any) {
      const sanitizedMessage = sanitizeErrorMessage(err);
      console.error('❌ Error aggregating clients - sanitized message:', sanitizedMessage);
      setError(sanitizedMessage);
    } finally {
      setIsLoading(false);
    }
  }, [ownerId, resolveUserName]);
  
  useEffect(() => {
    fetchAggregatedClients();
  }, [fetchAggregatedClients]);
  
  return {
    aggregatedClients,
    isLoading,
    error,
    refreshAggregatedClients: fetchAggregatedClients
  };
}

// Hook for MRR calculations
export function useMRR(ownerId?: string) {
  const [mrrSummary, setMRRSummary] = useState<MRRSummary | null>(null);
  const [mrrByOwner, setMRRByOwner] = useState<MRRByOwner[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMRRSummary = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Check if Edge Functions are disabled
      if (DISABLE_EDGE_FUNCTIONS) {
        console.log('⚠️ Edge Functions disabled, calculating MRR summary from deals and clients directly');
        
        // Fetch both clients and deals with joined data to calculate accurate MRR
        let clientsQuery = supabaseAdmin
          .from('clients')
          .select(`
            *,
            deals!clients_deal_id_fkey (
              id,
              monthly_mrr,
              one_off_revenue,
              annual_value
            )
          `);
        
        if (ownerId) {
          clientsQuery = clientsQuery.eq('owner_id', ownerId);
        }
        
        const { data: clientsWithDeals, error: clientsError } = await clientsQuery;
        
        if (clientsError) {
          console.error('❌ Error fetching clients with deals for MRR calculation:', clientsError);
          // If clients table doesn't exist, return default values
          if (clientsError.message.includes('relation "clients" does not exist')) {
            console.log('📋 Clients table does not exist yet - returning empty MRR summary');
            setMRRSummary({
              total_clients: 0,
              active_clients: 0,
              churned_clients: 0,
              paused_clients: 0,
              total_mrr: 0,
              avg_mrr: 0,
              min_mrr: 0,
              max_mrr: 0,
              churn_rate: 0,
              active_rate: 0
            });
            return;
          }
          throw clientsError;
        }
        
        // Calculate MRR summary using deal-based revenue
        const totalClients = clientsWithDeals?.length || 0;
        const activeClients = clientsWithDeals?.filter(c => c.status === 'active') || [];
        const churnedClients = clientsWithDeals?.filter(c => c.status === 'churned') || [];
        const pausedClients = clientsWithDeals?.filter(c => c.status === 'paused') || [];
        
        // Calculate total MRR from active clients using both deal MRR and subscription_amount
        const activeMRRAmounts = activeClients.map(client => {
          // First try deal MRR if the relationship is properly loaded
          let dealMRR = 0;
          if (client.deals && typeof client.deals === 'object') {
            // Handle both single deal object and array of deals
            if (Array.isArray(client.deals)) {
              dealMRR = client.deals[0]?.monthly_mrr || 0;
            } else {
              dealMRR = (client.deals as any)?.monthly_mrr || 0;
            }
          }
          
          // Use deal MRR if available, otherwise fall back to subscription_amount
          const mrrAmount = dealMRR > 0 ? parseFloat(dealMRR.toString()) : parseFloat(client.subscription_amount?.toString() || '0');
          
          console.log(`💰 MRR calculation for ${client.company_name}:`, {
            dealMRR,
            subscription_amount: client.subscription_amount,
            finalMRR: mrrAmount,
            dealStructure: typeof client.deals
          });
          
          return mrrAmount;
        }).filter(amount => amount > 0);
        
        const totalMRR = activeMRRAmounts.reduce((sum, amount) => sum + amount, 0);
        const avgMRR = activeMRRAmounts.length > 0 ? totalMRR / activeMRRAmounts.length : 0;
        const minMRR = activeMRRAmounts.length > 0 ? Math.min(...activeMRRAmounts) : 0;
        const maxMRR = activeMRRAmounts.length > 0 ? Math.max(...activeMRRAmounts) : 0;
        
        const summary: MRRSummary = {
          total_clients: totalClients,
          active_clients: activeClients.length,
          churned_clients: churnedClients.length,
          paused_clients: pausedClients.length,
          total_mrr: totalMRR,
          avg_mrr: avgMRR,
          min_mrr: minMRR,
          max_mrr: maxMRR,
          churn_rate: totalClients > 0 ? (churnedClients.length / totalClients * 100) : 0,
          active_rate: totalClients > 0 ? (activeClients.length / totalClients * 100) : 0
        };
        
        console.log('✅ MRR Summary calculated with deal-based revenue:', summary);
        setMRRSummary(summary);
        return;
      }
      
      const params = new URLSearchParams();
      if (ownerId) params.append('owner_id', ownerId);
      
      const result = await apiCall<MRRSummary>(
        `${API_BASE_URL}/clients/mrr/summary?${params.toString()}`
      );
      
      setMRRSummary(result);
    } catch (err: any) {
      const sanitizedMessage = sanitizeErrorMessage(err);
      console.error('Error fetching MRR summary - sanitized message:', sanitizedMessage);
      setError(sanitizedMessage);
    } finally {
      setIsLoading(false);
    }
  }, [ownerId]);

  const fetchMRRByOwner = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Check if Edge Functions are disabled
      if (DISABLE_EDGE_FUNCTIONS) {
        console.log('⚠️ Edge Functions disabled, calculating MRR by owner from Supabase directly');
        
        // Calculate MRR by owner directly from Supabase
        const { data: clientsWithProfiles, error } = await supabaseAdmin
          .from('clients')
          .select(`
            owner_id,
            subscription_amount,
            status,
            profiles:owner_id (
              first_name,
              last_name,
              full_name
            )
          `);
        
        if (error) {
          console.error('❌ Error fetching clients with profiles for MRR by owner:', error);
          // If clients table doesn't exist, return empty array
          if (error.message.includes('relation "clients" does not exist')) {
            console.log('📋 Clients table does not exist yet - returning empty MRR by owner');
            setMRRByOwner([]);
            return;
          }
          throw error;
        }
        
        // Group by owner and calculate MRR
        const ownerMRRMap = new Map();
        
        clientsWithProfiles.forEach((client: any) => {
          const ownerId = client.owner_id;
          if (!ownerMRRMap.has(ownerId)) {
            ownerMRRMap.set(ownerId, {
              owner_id: ownerId,
              owner_name: client.profiles?.full_name || 
                         `${client.profiles?.first_name || ''} ${client.profiles?.last_name || ''}`.trim() || 
                         'Unknown',
              total_clients: 0,
              active_clients: 0,
              churned_clients: 0,
              paused_clients: 0,
              total_mrr: 0,
              amounts: []
            });
          }
          
          const ownerData = ownerMRRMap.get(ownerId);
          ownerData.total_clients++;
          
          if (client.status === 'active') {
            ownerData.active_clients++;
            const amount = parseFloat(client.subscription_amount || 0);
            ownerData.total_mrr += amount;
            ownerData.amounts.push(amount);
          } else if (client.status === 'churned') {
            ownerData.churned_clients++;
          } else if (client.status === 'paused') {
            ownerData.paused_clients++;
          }
        });
        
        // Convert to final format
        const mrrByOwnerData: MRRByOwner[] = Array.from(ownerMRRMap.values()).map(owner => ({
          owner_id: owner.owner_id,
          owner_name: owner.owner_name,
          total_clients: owner.total_clients,
          active_clients: owner.active_clients,
          churned_clients: owner.churned_clients,
          paused_clients: owner.paused_clients,
          total_mrr: owner.total_mrr,
          avg_mrr: owner.amounts.length > 0 ? owner.total_mrr / owner.amounts.length : 0,
          churn_rate: owner.total_clients > 0 ? (owner.churned_clients / owner.total_clients * 100) : 0
        })).sort((a, b) => b.total_mrr - a.total_mrr);
        
        setMRRByOwner(mrrByOwnerData);
        return;
      }
      
      const result = await apiCall<MRRByOwner[]>(
        `${API_BASE_URL}/clients/mrr/by-owner`
      );
      
      setMRRByOwner(result || []);
    } catch (err: any) {
      const sanitizedMessage = sanitizeErrorMessage(err);
      console.error('Error fetching MRR by owner - sanitized message:', sanitizedMessage);
      setError(sanitizedMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    mrrSummary,
    mrrByOwner,
    isLoading,
    error,
    fetchMRRSummary,
    fetchMRRByOwner
  };
}