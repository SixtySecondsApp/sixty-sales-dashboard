import { useState, useEffect, useContext } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import { setAuditContext, clearAuditContext } from '@/lib/utils/auditContext';
import { getSiteUrl } from '@/lib/utils/siteUrl';
import logger from '@/lib/utils/logger';
import { ViewModeContext } from '@/contexts/ViewModeContext';
import { useAuth } from '@/lib/contexts/AuthContext';

// Export USER_STAGES for compatibility
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

/**
 * useUser Hook - Now uses AuthContext for state management
 * This hook is a wrapper around AuthContext to maintain backwards compatibility
 * and provide impersonation functionality.
 */
export function useUser() {
  const auth = useAuth();
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalUserData, setOriginalUserData] = useState(null);
  
  // Try to get View Mode context - but make it optional
  let viewModeContext = null;
  try {
    viewModeContext = useContext(ViewModeContext);
  } catch (e) {
    // Context not available, that's ok
  }

  useEffect(() => {
    // Check if we're in an impersonation session
    const { isImpersonating: isImpersonated, originalUserId } = getImpersonationData();
    setIsImpersonating(isImpersonated && !!originalUserId);
    
    // Set audit context if impersonating
    if (isImpersonated && originalUserId) {
      setAuditContext();
      
      // Try to fetch original user data
      if (originalUserId && originalUserId !== auth.userId) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', originalUserId)
          .single()
          .then(({ data }) => {
            if (data) {
              setOriginalUserData(data);
            }
          })
          .catch(error => {
            logger.warn('Could not fetch original user data:', error);
          });
      }
    } else {
      clearAuditContext();
    }
  }, [auth.userId]);

  // Return data from AuthContext with additional impersonation info
  return {
    userData: auth.userProfile,
    isLoading: auth.loading,
    error: null, // AuthContext doesn't expose errors, so we return null for compatibility
    isImpersonating,
    originalUserData,
    signOut: auth.signOut,
    refreshUser: auth.refreshProfile,
    // Legacy properties for backwards compatibility
    isAuthenticated: auth.isAuthenticated,
    userId: auth.userId,
    session: auth.session
  };
}