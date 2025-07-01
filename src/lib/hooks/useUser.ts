import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import type { Database } from '@/lib/database.types';

type UserProfile = Database['public']['Tables']['profiles']['Row'];

export const USER_STAGES = [
  'Trainee',
  'Junior',
  'Senior',
  'Manager',
  'Director'
];

// Helper functions for managing impersonation state
export const setImpersonationData = (adminId: string, adminEmail: string) => {
  sessionStorage.setItem('originalUserId', adminId);
  sessionStorage.setItem('originalUserEmail', adminEmail);
  sessionStorage.setItem('isImpersonating', 'true');
};

export const clearImpersonationData = () => {
  sessionStorage.removeItem('originalUserId');
  sessionStorage.removeItem('originalUserEmail');
  sessionStorage.removeItem('isImpersonating');
};

export const getImpersonationData = () => {
  return {
    originalUserId: sessionStorage.getItem('originalUserId'),
    originalUserEmail: sessionStorage.getItem('originalUserEmail'),
    isImpersonating: sessionStorage.getItem('isImpersonating') === 'true'
  };
};

export const stopImpersonating = async () => {
  try {
    const { originalUserId, originalUserEmail } = getImpersonationData();
    
    if (!originalUserId || !originalUserEmail) {
      throw new Error('No impersonation session found');
    }

    // Call the restore-user edge function to get a magic link
    const { data, error } = await supabase.functions.invoke('restore-user', {
      body: { 
        userId: originalUserId,
        email: originalUserEmail,
        redirectTo: window.location.origin 
      }
    });

    if (error) {
      throw error;
    }

    if (data?.magicLink) {
      // Clear impersonation data
      clearImpersonationData();
      
      toast.success('Restoring your admin session...');
      
      // Redirect to the magic link
      window.location.href = data.magicLink;
    } else {
      throw new Error('Failed to generate magic link for restoration');
    }
  } catch (error: any) {
    console.error('Stop impersonation error:', error);
    // Clear sessionStorage even if there's an error to prevent user from being stuck
    clearImpersonationData();
    toast.error('Failed to stop impersonation: ' + (error.message || 'Unknown error'));
    throw error;
  }
};

export const impersonateUser = async (userId: string) => {
  try {
    // Store current user info before impersonation
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      throw new Error('No authenticated user found');
    }

    // Call the impersonate-user edge function to get a magic link
    const { data, error } = await supabase.functions.invoke('impersonate-user', {
      body: { 
        userId,
        adminId: currentUser.id,
        adminEmail: currentUser.email,
        redirectTo: window.location.origin
      }
    });

    if (error) {
      throw error;
    }

    if (data?.magicLink) {
      // Store original user info for restoration
      setImpersonationData(currentUser.id, currentUser.email!);
      
      toast.success('Starting impersonation...');
      
      // Redirect to the magic link
      window.location.href = data.magicLink;
    } else {
      throw new Error('Failed to generate magic link for impersonation');
    }
  } catch (error: any) {
    console.error('Impersonation error:', error);
    toast.error('Failed to impersonate user: ' + (error.message || 'Unknown error'));
    throw error;
  }
};

export function useUser() {
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalUserData, setOriginalUserData] = useState<UserProfile | null>(null);

  useEffect(() => {
    // Check if we're in an impersonation session
    const { isImpersonating: isImpersonated, originalUserId } = getImpersonationData();
    setIsImpersonating(isImpersonated && !!originalUserId);

    async function fetchUser() {
      try {
        setIsLoading(true);
        setError(null);

        // Get the current user session from Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw sessionError;
        }

        if (session?.user) {
          // User is authenticated
          const user = session.user;
          
          // Get or create user profile
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profileError && profileError.code !== 'PGRST116') {
            // PGRST116 is "not found" error, which is fine for new users
            throw profileError;
          }

          // If no profile exists, create a default one
          if (!profile) {
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({
                id: user.id,
                email: user.email,
                first_name: user.user_metadata?.first_name || 'User',
                last_name: user.user_metadata?.last_name || '',
                avatar_url: user.user_metadata?.avatar_url,
                role: 'Junior',
                department: 'Sales'
              })
              .select()
              .single();

            if (createError) {
              console.warn('Could not create profile, using basic user data:', createError);
              // Fall back to basic user data
              setUserData({
                id: user.id,
                email: user.email || null,
                first_name: user.user_metadata?.first_name || 'User',
                last_name: user.user_metadata?.last_name || '',
                full_name: null,
                avatar_url: user.user_metadata?.avatar_url || null,
                role: 'Junior',
                department: 'Sales',
                stage: null,
                is_admin: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                username: null,
                website: null
              } as UserProfile);
            } else {
              setUserData(newProfile);
            }
          } else {
            setUserData(profile);
          }

          // If we're impersonating, also get the original user data
          if (originalUserId && originalUserId !== user.id) {
            try {
              const { data: originalProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', originalUserId)
                .single();
              setOriginalUserData(originalProfile);
            } catch (error) {
              console.warn('Could not fetch original user data:', error);
            }
          }
        } else {
          // No user session - create a mock user for development
          console.log('No authenticated user, creating mock user for development');
          setUserData({
            id: 'mock-user-id',
            email: 'demo@example.com',
            first_name: 'Demo',
            last_name: 'User',
            full_name: 'Demo User',
            avatar_url: null,
            role: 'Senior',
            department: 'Sales',
            stage: 'Senior',
            is_admin: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            username: null,
            website: null
          } as UserProfile);
        }
      } catch (err) {
        console.error('Error fetching user:', err);
        setError(err);
        
        // Fall back to mock user in case of errors
        setUserData({
          id: 'mock-user-id',
          email: 'demo@example.com',
          first_name: 'Demo',
          last_name: 'User',
          full_name: 'Demo User',
          avatar_url: null,
          role: 'Senior',
          department: 'Sales',
          stage: 'Senior',
          is_admin: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          username: null,
          website: null
        } as UserProfile);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // User signed in, fetch their profile
          fetchUser();
        } else if (event === 'SIGNED_OUT') {
          // User signed out
          setUserData(null);
          setOriginalUserData(null);
          setIsImpersonating(false);
          // Clear all impersonation data
          clearImpersonationData();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUserData(null);
      setOriginalUserData(null);
      setIsImpersonating(false);
      // Clear all impersonation data
      clearImpersonationData();
    } catch (error) {
      console.error('Error signing out:', error);
      // Force clear user data even if signOut fails
      setUserData(null);
      setOriginalUserData(null);
      setIsImpersonating(false);
      clearImpersonationData();
    }
  };

  const handleStopImpersonation = async () => {
    try {
      await stopImpersonating();
    } catch (error) {
      console.error('Error stopping impersonation:', error);
    }
  };

  return {
    userData,
    originalUserData,
    isLoading,
    error,
    signOut,
    isAuthenticated: !!userData,
    isImpersonating,
    stopImpersonating: handleStopImpersonation
  };
}