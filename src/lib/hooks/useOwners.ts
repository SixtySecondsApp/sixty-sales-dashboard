import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuthUser } from './useAuthUser';
import logger from '@/lib/utils/logger';

export interface Owner {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  stage: string;
  email: string;
  deal_count?: number;
  total_value?: number;
}

async function fetchOwners(userId: string): Promise<Owner[]> {
  logger.log('🔄 Fetching owners from database...');

  // Fetch directly from profiles table
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('Database error fetching profiles:', error);
    throw error;
  }

  if (!profiles || profiles.length === 0) {
    logger.warn('No profiles found in database, trying to get at least current user');

    // Try to get at least the current user's profile
    const { data: userProfile, error: userProfileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (userProfile && !userProfileError) {
      logger.log('Found current user profile, using as single owner');
      const transformedOwner: Owner = {
        id: userProfile.id,
        first_name: userProfile.first_name,
        last_name: userProfile.last_name,
        full_name: userProfile.full_name ||
          (userProfile.first_name || userProfile.last_name
            ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim()
            : null),
        stage: userProfile.stage || 'Sales Rep',
        email: userProfile.email || `user_${userProfile.id.slice(0, 8)}@private.local`
      };
      return [transformedOwner];
    } else {
      logger.warn('No profiles found at all, returning empty list');
      return [];
    }
  }

  // Transform profiles to Owner format
  const transformedOwners: Owner[] = profiles.map(profile => ({
    id: profile.id,
    first_name: profile.first_name,
    last_name: profile.last_name,
    full_name: profile.full_name ||
      (profile.first_name || profile.last_name
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
        : null),
    stage: profile.stage || 'Sales Rep',
    email: profile.email || `user_${profile.id.slice(0, 8)}@private.local`
  }));

  logger.log(`✅ Successfully fetched ${transformedOwners.length} owners from database`);
  return transformedOwners;
}

export function useOwners() {
  const { data: authUser } = useAuthUser();
  const userId = authUser?.id;

  const queryResult = useQuery({
    queryKey: ['owners', userId],
    queryFn: () => fetchOwners(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes - owners don't change often
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    owners: queryResult.data || [],
    isLoading: queryResult.isLoading,
    error: queryResult.error as Error | null
  };
}
