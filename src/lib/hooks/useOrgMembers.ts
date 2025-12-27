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

      // Fetch memberships first
      const { data: memberships, error: membershipError } = await supabase
        .from('organization_memberships')
        .select('user_id, role')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true });

      if (membershipError) throw membershipError;
      if (!memberships?.length) return [];

      // Fetch profiles for all member user_ids
      const userIds = memberships.map((m) => m.user_id);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      if (profileError) throw profileError;

      // Create a lookup map for profiles
      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      // Transform the data to a flat structure
      return memberships.map((member) => {
        const profile = profileMap.get(member.user_id);
        return {
          user_id: member.user_id,
          email: profile?.email || '',
          name: profile?.full_name || null,
          role: member.role,
        };
      }) as OrgMember[];
    },
    enabled: !!orgId,
  });
}

export default useOrgMembers;
