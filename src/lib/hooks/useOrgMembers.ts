/**
 * useOrgMembers Hook
 *
 * Fetches organization members with their profile information.
 * Used for user selection in various settings and mapping interfaces.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/clientV2';
import { useOrg } from '@/lib/contexts/OrgContext';

export interface OrgMember {
  user_id: string;
  email: string;
  name: string | null;
  role: string;
}

export function useOrgMembers() {
  const { activeOrgId } = useOrg();
  const orgId = activeOrgId;

  return useQuery({
    queryKey: ['org-members', orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from('organization_memberships')
        .select(`
          user_id,
          role,
          user:profiles(id, email, full_name)
        `)
        .eq('org_id', orgId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Transform the data to a flat structure
      return (data || []).map((member: any) => ({
        user_id: member.user_id,
        email: member.user?.email || '',
        name: member.user?.full_name || null,
        role: member.role,
      })) as OrgMember[];
    },
    enabled: !!orgId,
  });
}

export default useOrgMembers;
