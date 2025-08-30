import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

export interface UserData {
  id: string;
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
  avatar_url: string | null;
  stage: string;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Fetch current user and their profile data
    async function fetchUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        setUser(user);

        // Fetch user profile data
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        if (profile) {
          setUserData({
            id: profile.id,
            email: profile.email,
            name: `${profile.first_name} ${profile.last_name}`,
            first_name: profile.first_name,
            last_name: profile.last_name,
            is_admin: profile.is_admin || false,
            avatar_url: profile.avatar_url,
            stage: profile.stage || 'Trainee'
          });
        }
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching user:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchUser();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setUserData(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, userData, loading, error };
}