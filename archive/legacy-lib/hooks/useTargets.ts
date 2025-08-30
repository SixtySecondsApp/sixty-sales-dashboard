import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

export interface UserTargets {
  id: string;
  user_id: string;
  revenue_target: number;
  lifetime_deals_target: number;
  proposal_target: number;
  outbound_target: number;
  meetings_target: number;
}

export function useTargets(userId: string | undefined) {
  // Mock data for development
  const mockTargets: UserTargets = {
    id: 'target-1',
    user_id: userId || '',
    revenue_target: 20000,
    lifetime_deals_target: 5,
    proposal_target: 5,
    outbound_target: 15,
    meetings_target: 8
  };

  return useQuery({
    queryKey: ['userTargets', userId],
    queryFn: () => Promise.resolve(mockTargets),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });
}