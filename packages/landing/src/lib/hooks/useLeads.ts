import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchLeads, triggerLeadPrep, reprocessLead, type LeadWithPrep } from '@/lib/services/leadService';

const LEADS_QUERY_KEY = ['leads'];

export function useLeads() {
  return useQuery<LeadWithPrep[]>({
    queryKey: LEADS_QUERY_KEY,
    queryFn: fetchLeads,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
}

export function useLeadPrepRunner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerLeadPrep,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEY });
    },
  });
}

export function useLeadReprocessor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (leadId: string) => reprocessLead(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEADS_QUERY_KEY });
    },
  });
}







