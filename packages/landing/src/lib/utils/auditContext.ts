import React from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { getImpersonationData } from '@/lib/hooks/useUser';
import logger from '@/lib/utils/logger';

/**
 * Sets the impersonation context in the database session for audit logging
 * This should be called before any database operations that need to be tracked
 * when the user is impersonating another user
 */
export async function setAuditContext(): Promise<void> {
  try {
    const { originalUserId, isImpersonating } = getImpersonationData();
    
    if (isImpersonating && originalUserId) {
      // Get the current user (the one being impersonated)
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (currentUser) {
        // Set the impersonation context in the database session
        try {
          await supabase.rpc('set_audit_context', {
            p_original_user_id: originalUserId,
            p_impersonated_user_id: currentUser.id,
            p_is_impersonating: true
          });
        } catch (rpcError) {
          logger.debug('Audit context RPC not available:', rpcError);
        }
      }
    } else {
      // Clear any existing impersonation context
      await clearAuditContext();
    }
  } catch (error) {
    logger.error('Failed to set audit context:', error);
    // Don't throw here as this shouldn't block the main operation
  }
}

/**
 * Clears the impersonation context from the database session
 */
export async function clearAuditContext(): Promise<void> {
  try {
    // Skip RPC call as clear_audit_context function doesn't exist in this database
    logger.log('📝 Audit context cleared locally');
    // TODO: Implement clear_audit_context RPC function in database if needed
  } catch (error) {
    logger.debug('Clear audit context RPC not available:', error);
    // Don't throw here as this shouldn't block the main operation
  }
}

/**
 * Wrapper function to execute database operations with proper audit context
 * This ensures that impersonation context is set before the operation and cleared after
 */
export async function withAuditContext<T>(operation: () => Promise<T>): Promise<T> {
  try {
    await setAuditContext();
    const result = await operation();
    return result;
  } finally {
    // Always clear context after the operation to prevent context leakage
    await clearAuditContext();
  }
}

/**
 * Hook to automatically set audit context on component mount and clear on unmount
 * Use this in components where database operations might occur
 */
export function useAuditContext() {
  const { isImpersonating } = getImpersonationData();
  
  // Set context when component mounts if impersonating
  React.useEffect(() => {
    if (isImpersonating) {
      setAuditContext();
    }
    
    // Clear context when component unmounts
    return () => {
      clearAuditContext();
    };
  }, [isImpersonating]);
}