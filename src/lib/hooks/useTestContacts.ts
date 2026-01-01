/**
 * useTestContacts Hook
 *
 * Fetches contacts categorized by quality tier for skill testing.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuth } from '@/lib/contexts/AuthContext';
import {
  calculateContactQualityScore,
  type ContactQualityScore,
  type ContactQualityTier,
  QUALITY_THRESHOLDS,
} from '@/lib/utils/contactQualityScoring';

export interface TestContact {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  title: string | null;
  phone: string | null;
  company_id: string | null;
  company_name: string | null;
  linkedin_url: string | null;
  total_meetings_count: number | null;
  last_interaction_at: string | null;
  qualityScore: ContactQualityScore;
}

interface UseTestContactsOptions {
  mode: ContactQualityTier;
  enabled?: boolean;
  limit?: number;
}

interface UseTestContactsReturn {
  contacts: TestContact[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch contacts by quality tier
 */
async function fetchContactsByTier(
  userId: string,
  tier: ContactQualityTier,
  limit: number
): Promise<TestContact[]> {
  let query = supabase
    .from('contacts')
    .select(`
      id,
      email,
      first_name,
      last_name,
      full_name,
      title,
      phone,
      company_id,
      linkedin_url,
      total_meetings_count,
      last_interaction_at,
      companies:company_id(id, name)
    `)
    .eq('owner_id', userId); // contacts uses owner_id

  // Apply tier-specific filters
  switch (tier) {
    case 'good':
      query = query
        .gte('total_meetings_count', QUALITY_THRESHOLDS.good.minMeetings)
        .not('title', 'is', null)
        .not('company_id', 'is', null)
        .order('total_meetings_count', { ascending: false });
      break;

    case 'average':
      query = query
        .gte('total_meetings_count', QUALITY_THRESHOLDS.average.minMeetings)
        .lte('total_meetings_count', QUALITY_THRESHOLDS.average.maxMeetings)
        .order('total_meetings_count', { ascending: false });
      break;

    case 'bad':
      query = query
        .or(`total_meetings_count.is.null,total_meetings_count.eq.${QUALITY_THRESHOLDS.bad.maxMeetings}`)
        .order('created_at', { ascending: false });
      break;
  }

  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching test contacts:', error);
    throw error;
  }

  if (!data) return [];

  // Calculate max meetings for scoring normalization
  const maxMeetings = Math.max(
    ...data.map(c => c.total_meetings_count || 0),
    1
  );

  // Transform and score contacts
  return data.map(contact => {
    const qualityScore = calculateContactQualityScore(
      {
        email: contact.email,
        title: contact.title,
        company_id: contact.company_id,
        linkedin_url: contact.linkedin_url,
        total_meetings_count: contact.total_meetings_count,
        phone: contact.phone,
      },
      maxMeetings
    );

    return {
      id: contact.id,
      email: contact.email,
      first_name: contact.first_name,
      last_name: contact.last_name,
      full_name: contact.full_name,
      title: contact.title,
      phone: contact.phone,
      company_id: contact.company_id,
      company_name: (contact.companies as any)?.name || null,
      linkedin_url: contact.linkedin_url,
      total_meetings_count: contact.total_meetings_count,
      last_interaction_at: contact.last_interaction_at,
      qualityScore,
    };
  });
}

/**
 * Hook for fetching contacts by quality tier
 */
export function useTestContacts(options: UseTestContactsOptions): UseTestContactsReturn {
  const { mode, enabled = true, limit = 10 } = options;
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['test-contacts', mode, user?.id, limit],
    queryFn: () => fetchContactsByTier(user!.id, mode, limit),
    enabled: enabled && !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    contacts: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

/**
 * Search contacts for custom selection
 */
export async function searchTestContacts(
  userId: string,
  searchQuery: string,
  limit: number = 10
): Promise<TestContact[]> {
  if (!searchQuery.trim()) return [];

  const { data, error } = await supabase
    .from('contacts')
    .select(`
      id,
      email,
      first_name,
      last_name,
      full_name,
      title,
      phone,
      company_id,
      linkedin_url,
      total_meetings_count,
      last_interaction_at,
      companies:company_id(id, name)
    `)
    .eq('owner_id', userId)
    .or(`email.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
    .order('total_meetings_count', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error('Error searching contacts:', error);
    throw error;
  }

  if (!data) return [];

  const maxMeetings = Math.max(
    ...data.map(c => c.total_meetings_count || 0),
    1
  );

  return data.map(contact => {
    const qualityScore = calculateContactQualityScore(
      {
        email: contact.email,
        title: contact.title,
        company_id: contact.company_id,
        linkedin_url: contact.linkedin_url,
        total_meetings_count: contact.total_meetings_count,
        phone: contact.phone,
      },
      maxMeetings
    );

    return {
      id: contact.id,
      email: contact.email,
      first_name: contact.first_name,
      last_name: contact.last_name,
      full_name: contact.full_name,
      title: contact.title,
      phone: contact.phone,
      company_id: contact.company_id,
      company_name: (contact.companies as any)?.name || null,
      linkedin_url: contact.linkedin_url,
      total_meetings_count: contact.total_meetings_count,
      last_interaction_at: contact.last_interaction_at,
      qualityScore,
    };
  });
}
