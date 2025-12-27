import { useState, useEffect, useContext, useMemo } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import type { Database } from '@/lib/database.types';
import { setAuditContext, clearAuditContext } from '@/lib/utils/auditContext';
import { getSiteUrl } from '@/lib/utils/siteUrl';
import logger from '@/lib/utils/logger';
import { ViewModeContext } from '@/contexts/ViewModeContext';
import { useAuthUser } from './useAuthUser';
import { useUserProfile, useUserProfileById } from './useUserProfile';

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
  // Use React Query for auth user - cached and deduplicated across all components
  const { data: authUser, isLoading: isAuthLoading, error: authError } = useAuthUser();

  // Use React Query for profile - cached by email, deduplicated
  const { data: profile, isLoading: isProfileLoading } = useUserProfile(authUser?.email);

  // Try to get View Mode context - but make it optional
  let viewModeContext = null;
  try {
    viewModeContext = useContext(ViewModeContext);
  } catch (e) {
    // Context not available, that's ok
  }

  // Check impersonation state
  const impersonationData = useMemo(() => getImpersonationData(), []);
  const isImpersonating = impersonationData.isImpersonating && !!impersonationData.originalUserId;

  // Use React Query for original user profile (during impersonation) - cached by ID
  const { data: originalUserData } = useUserProfileById(
    isImpersonating ? impersonationData.originalUserId : null
  );

  // Use React Query for viewed user profile (in view mode) - cached by ID
  const { data: viewedUserData } = useUserProfileById(
    viewModeContext?.isViewMode ? viewModeContext?.viewedUser?.id : null
  );

  // Handle audit context for impersonation
  useEffect(() => {
    if (isImpersonating) {
      setAuditContext();
    } else {
      clearAuditContext();
    }
  }, [isImpersonating]);

  // Handle mock user for development (only when no auth user)
  const userData = useMemo(() => {
    // If we have a profile from React Query, use it
    if (profile) {
      return profile;
    }

    // If auth user exists but no profile yet (still loading or needs creation)
    if (authUser && !profile && !isProfileLoading) {
      // Profile doesn't exist - would need to be created
      // For now, return a basic profile from auth user metadata
      logger.log('📝 No profile found, using auth user metadata');
      return {
        id: authUser.id,
        email: authUser.email || null,
        first_name: authUser.user_metadata?.first_name || 'User',
        last_name: authUser.user_metadata?.last_name || '',
        full_name: null,
        avatar_url: authUser.user_metadata?.avatar_url || null,
        role: 'Junior',
        department: 'Sales',
        stage: null,
        is_admin: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        username: null,
        website: null
      } as UserProfile;
    }

    // If no auth user and mock user is allowed
    if (!authUser && !isAuthLoading) {
      const allowMockUser = import.meta.env.VITE_ALLOW_MOCK_USER === 'true';
      if (allowMockUser) {
        logger.log('⚠️ No authenticated user found. Mock user is enabled.');
        const mockUserData = {
          id: 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459',
          email: 'andrew.bryce@sixtyseconds.video',
          first_name: 'Andrew',
          last_name: 'Bryce',
          full_name: 'Andrew Bryce',
          avatar_url: null,
          role: 'Senior',
          department: 'Sales',
          stage: 'Senior',
          is_admin: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          username: null,
          website: null
        } as UserProfile;
        localStorage.setItem('sixty_mock_users', JSON.stringify([mockUserData]));
        return mockUserData;
      }
    }

    return null;
  }, [authUser, profile, isAuthLoading, isProfileLoading]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      clearImpersonationData();
      clearAuditContext();
    } catch (error) {
      logger.error('Error signing out:', error);
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

  const isLoading = isAuthLoading || isProfileLoading;

  return {
    userData: viewModeContext?.isViewMode && viewedUserData ? viewedUserData : userData,
    originalUserData: originalUserData || null,
    isLoading,
    error: authError || null,
    signOut,
    isAuthenticated: !!userData,
    isImpersonating,
    stopImpersonating: handleStopImpersonation,
    isViewMode: viewModeContext?.isViewMode || false,
    actualUser: userData // Always the actual logged-in user
  };
}