import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/clientV2';
import type { Database } from '@/lib/database.types';

type LeadSourceSummaryRow = Database['public']['Views']['lead_source_summary']['Row'];

async function fetchLeadAnalytics(): Promise<LeadSourceSummaryRow[]> {
  const { data, error } = await supabase
    .from('lead_source_summary')
    .select('*')
    .order('total_leads', { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export function useLeadAnalytics() {
  return useQuery({
    queryKey: ['lead-source-summary'],
    queryFn: fetchLeadAnalytics,
    staleTime: 5 * 60 * 1000, // 5 minutes - cache data to prevent excessive refetches
    refetchInterval: false, // Disable polling - rely on cache invalidation or manual refresh
  });
}














