import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import type { Database } from '@/lib/database.types';
import { setAuditContext, clearAuditContext } from '@/lib/utils/auditContext';
import { getSiteUrl } from '@/lib/utils/siteUrl';
import logger from '@/lib/utils/logger';

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
        redirectTo: getSiteUrl() 
      }
    });

    if (error) {
      throw error;
    }

    // Check if we got the old response format (email/password)
    if (data?.email && data?.password) {
      logger.warn('Edge Function is returning old format. Using fallback password-based restoration.');
      
      // Clear impersonation data
      clearImpersonationData();
      
      // Sign in with the temporary password (old method)
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password
      });

      if (signInError) {
        throw signInError;
      }

      toast.success('Session restored (legacy mode)');
      window.location.reload();
      return;
    }

    if (data?.session) {
      // New session-based restoration
      clearImpersonationData();
      clearAuditContext();
      
      // Set the new session directly
      const { error: setSessionError } = await supabase.auth.setSession(data.session);
      
      if (setSessionError) {
        throw setSessionError;
      }
      
      toast.success('Admin session restored successfully!');
      
      // Reload to refresh the app with the new session
      window.location.reload();
    } else if (data?.magicLink) {
      // Fallback to magic link restoration
      clearImpersonationData();
      clearAuditContext();
      
      if (data.requiresPasswordReset) {
        toast.warning('Restoring session. You may need to reset your password.');
      } else {
        toast.success('Restoring your admin session...');
      }
      
      // Redirect to the magic link
      window.location.href = data.magicLink;
    } else {
      throw new Error('Failed to restore session. Response: ' + JSON.stringify(data));
    }
  } catch (error: any) {
    logger.error('Stop impersonation error:', error);
    // Clear sessionStorage and audit context even if there's an error to prevent user from being stuck
    clearImpersonationData();
    clearAuditContext();
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
        redirectTo: getSiteUrl()
      }
    });

    if (error) {
      throw error;
    }

    if (data?.session) {
      // New session-based impersonation
      // Store original user info for restoration
      setImpersonationData(currentUser.id, currentUser.email!);
      
      // Set the new session directly
      const { error: setSessionError } = await supabase.auth.setSession(data.session);
      
      if (setSessionError) {
        throw setSessionError;
      }
      
      toast.success('Impersonation started successfully!');
      
      // Reload to refresh the app with the new session
      window.location.reload();
    } else if (data?.magicLink) {
      // Fallback to magic link impersonation
      setImpersonationData(currentUser.id, currentUser.email!);
      
      toast.success('Starting impersonation...');
      
      // Redirect to the magic link
      window.location.href = data.magicLink;
    } else {
      throw new Error('Failed to start impersonation. Response: ' + JSON.stringify(data));
    }
  } catch (error: any) {
    logger.error('Impersonation error:', error);
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
    
    // Set audit context if impersonating
    if (isImpersonated && originalUserId) {
      setAuditContext();
    } else {
      clearAuditContext();
    }

    let isUserFetching = false;
    
    async function fetchUser() {
      // Prevent concurrent fetches
      if (isUserFetching) {
        logger.log('⏭️ Skipping concurrent user fetch');
        return;
      }
      
      isUserFetching = true;
      
      try {
        setIsLoading(true);
        setError(null);

        // Get the current user session from Supabase with timeout
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session fetch timeout')), 5000)
        );
        
        const { data: { session }, error: sessionError } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]).catch(err => ({ data: { session: null }, error: err }));
        
        if (sessionError) {
          logger.warn('Session error (will use fallback):', sessionError.message);
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
              logger.warn('Could not create profile, using basic user data:', createError);
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
              logger.warn('Could not fetch original user data:', error);
            }
          }
        } else {
          // No user session - create a mock user for development
          logger.log('No authenticated user, creating mock user for development');
          setUserData({
            id: 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459', // Andrew's actual ID for development
            email: 'andrew.bryce@sixtyseconds.video',
            first_name: 'Andrew',
            last_name: 'Bryce',
            full_name: 'Andrew Bryce',
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
        // Only log once, not repeatedly
        if (!error) {
          logger.error('Error fetching user (using fallback):', err);
        }
        setError(err);
        
        // Fall back to mock user in case of errors
        if (!userData) {
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
      } finally {
        setIsLoading(false);
        isUserFetching = false;
      }
    }

    fetchUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Skip initial session event to prevent duplicate fetch
        if (event === 'INITIAL_SESSION') {
          return;
        }
        
        if (event === 'SIGNED_IN' && session && !userData) {
          // User signed in and we don't have user data yet
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
      // Clear audit context
      clearAuditContext();
    } catch (error) {
      logger.error('Error signing out:', error);
      // Force clear user data even if signOut fails
      setUserData(null);
      setOriginalUserData(null);
      setIsImpersonating(false);
      clearImpersonationData();
      clearAuditContext();
    }
  };

  const handleStopImpersonation = async () => {
    try {
      await stopImpersonating();
    } catch (error) {
      logger.error('Error stopping impersonation:', error);
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