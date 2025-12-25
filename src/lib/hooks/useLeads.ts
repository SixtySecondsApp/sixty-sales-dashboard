import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchLeads, triggerLeadPrep, reprocessLead, type LeadWithPrep } from '@/lib/services/leadService';
import { useSmartRefetchConfig } from './useSmartPolling';

const LEADS_QUERY_KEY = ['leads'];

/**
 * Leads data hook with smart polling.
 *
 * Leads are background tier data - sales agents don't need instant updates.
 * - Working hours: polls every 5 minutes (300s base * background multiplier)
 * - Off-hours: disabled
 * - Idle: further reduced
 * - Refetches on window focus when in reduced mode
 */
export function useLeads() {
  // Use smart polling: 5 minute base for background data
  const refetchConfig = useSmartRefetchConfig(300_000, 'background');

  return useQuery<LeadWithPrep[]>({
    queryKey: LEADS_QUERY_KEY,
    queryFn: fetchLeads,
    ...refetchConfig,
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







