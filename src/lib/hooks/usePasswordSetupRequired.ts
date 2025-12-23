/**
 * usePasswordSetupRequired Hook
 *
 * Checks if the current user needs to set up their password (magic link users).
 * Used by AppLayout to show the password setup modal.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';

export interface UsePasswordSetupRequiredReturn {
  /** Whether the user needs to set up their password */
  needsSetup: boolean | null;
  /** Whether we're still checking the user's status */
  isChecking: boolean;
  /** Complete the password setup */
  completeSetup: (password: string) => Promise<boolean>;
  /** Error message if password setup fails */
  error: string | null;
}

export function usePasswordSetupRequired(): UsePasswordSetupRequiredReturn {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user needs password setup on mount
  useEffect(() => {
    checkPasswordSetup();
  }, []);

  const checkPasswordSetup = async () => {
    try {
      setIsChecking(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        // Not logged in - no setup needed
        setNeedsSetup(false);
        return;
      }

      // Check user metadata for the needs_password_setup flag
      const needsPassword = user.user_metadata?.needs_password_setup === true;
      setNeedsSetup(needsPassword);
    } catch (err) {
      console.error('[usePasswordSetupRequired] Error checking password setup status:', err);
      setNeedsSetup(false);
    } finally {
      setIsChecking(false);
    }
  };

  const completeSetup = useCallback(async (password: string): Promise<boolean> => {
    try {
      setError(null);

      // Validate password
      if (!password || password.length < 6) {
        setError('Password must be at least 6 characters long');
        return false;
      }

      // Update the user's password
      const { error: updatePasswordError } = await supabase.auth.updateUser({
        password: password
      });

      if (updatePasswordError) {
        console.error('[usePasswordSetupRequired] Password update error:', updatePasswordError);
        setError(updatePasswordError.message || 'Failed to set password. Please try again.');
        return false;
      }

      // Clear the needs_password_setup flag
      const { error: updateMetadataError } = await supabase.auth.updateUser({
        data: { needs_password_setup: false }
      });

      if (updateMetadataError) {
        // Non-critical - password was set, just metadata update failed
        console.warn('[usePasswordSetupRequired] Failed to clear needs_password_setup flag:', updateMetadataError);
      }

      // Also try to link waitlist entry if available
      const { data: { user } } = await supabase.auth.getUser();
      const waitlistEntryId = user?.user_metadata?.waitlist_entry_id;

      if (waitlistEntryId && waitlistEntryId !== 'pending' && user) {
        try {
          await supabase.from('meetings_waitlist').update({
            user_id: user.id,
            status: 'converted',
            converted_at: new Date().toISOString(),
            invitation_accepted_at: new Date().toISOString()
          }).eq('id', waitlistEntryId);
        } catch (linkError) {
          // Non-critical - password was set
          console.warn('[usePasswordSetupRequired] Failed to link waitlist entry:', linkError);
        }
      }

      setNeedsSetup(false);
      toast.success('Password set successfully! Welcome to Sixty.');
      return true;
    } catch (err: any) {
      console.error('[usePasswordSetupRequired] Error completing setup:', err);
      setError('An unexpected error occurred. Please try again.');
      return false;
    }
  }, []);

  return {
    needsSetup,
    isChecking,
    completeSetup,
    error
  };
}
