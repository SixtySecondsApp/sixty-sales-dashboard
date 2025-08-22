import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
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

export function useOwners() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchOwners() {
      try {
        setIsLoading(true);
        setError(null);

        logger.log('🔄 Fetching owners from database...');
        
        // Check if user is authenticated first
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          logger.warn('No authenticated user, skipping owners fetch');
          setOwners([]);
          return;
        }
        
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
            .eq('id', user.id)
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
              email: userProfile.email || user.email || `user_${userProfile.id.slice(0, 8)}@private.local`
            };
            setOwners([transformedOwner]);
          } else {
            logger.warn('No profiles found at all, setting empty list');
            setOwners([]);
          }
          return;
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
        logger.log('Owners data:', transformedOwners.map(o => ({ id: o.id, name: o.full_name, email: o.email })));
        setOwners(transformedOwners);

      } catch (err) {
        logger.error('Error fetching owners from database:', err);
        
        // Only use fallback in extreme cases and make sure IDs won't conflict
        logger.warn('Database query failed, setting empty owners list');
        setOwners([]); // Set empty instead of hardcoded to prevent invalid owner_id queries
        setError(err instanceof Error ? err : new Error('Failed to fetch owners from database'));
      } finally {
        setIsLoading(false);
      }
    }

    fetchOwners();
  }, []);

  return {
    owners,
    isLoading,
    error
  };
} 