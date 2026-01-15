/**
 * Custom hook for waitlist signup functionality
 * Handles form submission, validation, and success state
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../supabase/clientV2';
import * as waitlistService from '../services/waitlistService';
import type { WaitlistEntry, WaitlistSignupData } from '../types/waitlist';

// Simple success data for thank you page (gamification temporarily disabled)
interface SignupSuccessData {
  email: string;
  full_name: string;
  company_name: string;
}

interface UseWaitlistSignupReturn {
  signup: (data: WaitlistSignupData) => Promise<void>;
  isSubmitting: boolean;
  success: WaitlistEntry | null;
  simpleSuccess: SignupSuccessData | null; // For simple thank you flow
  error: Error | null;
  reset: () => void;
}

// Feature flag: set to true to enable gamification (leaderboard, points, etc.)
const ENABLE_GAMIFICATION = false;

export function useWaitlistSignup(): UseWaitlistSignupReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<WaitlistEntry | null>(null);
  const [simpleSuccess, setSimpleSuccess] = useState<SignupSuccessData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const sendWelcomeEmail = async (email: string, fullName: string, companyName: string) => {
    try {
      // Try Supabase SDK first
      try {
        const { data, error } = await supabase.functions.invoke('waitlist-welcome-email', {
          body: {
            email,
            full_name: fullName,
            company_name: companyName
          }
        });

        if (error) {
          throw error;
        }

        console.log('[Waitlist] Welcome email sent via SDK:', data);
      } catch (sdkErr) {
        // Fallback to direct HTTP call if SDK fails (handles auth issues)
        console.log('[Waitlist] SDK call failed, trying direct HTTP:', sdkErr);

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const response = await fetch(`${supabaseUrl}/functions/v1/waitlist-welcome-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            full_name: fullName,
            company_name: companyName
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        console.log('[Waitlist] Welcome email sent via HTTP:', data);
      }
    } catch (err) {
      console.warn('[Waitlist] Welcome email failed:', err);
      // Don't throw - email failure shouldn't block signup success
    }
  };

  const signup = async (data: WaitlistSignupData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Basic client-side validation
      if (!data.email || !data.full_name || !data.company_name) {
        throw new Error('Please fill in all required fields');
      }

      // Integration fields validation
      if (!data.dialer_tool || !data.meeting_recorder_tool || !data.crm_tool) {
        throw new Error('Please select all integration options');
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        throw new Error('Please enter a valid email address');
      }

      // Call signup service with retry logic
      const entry = await waitlistService.signupForWaitlist(data);

      // Send welcome email (fire and forget - don't block on this)
      sendWelcomeEmail(data.email, data.full_name, data.company_name);

      if (ENABLE_GAMIFICATION) {
        // Full gamification flow
        setSuccess(entry);
      } else {
        // Simple thank you flow
        setSimpleSuccess({
          email: data.email,
          full_name: data.full_name,
          company_name: data.company_name
        });
      }

      toast.success('Successfully joined the waitlist!');
    } catch (err) {
      const error = err as Error;
      setError(error);

      // Show error toast with helpful message
      const errorMessage = error.message || 'Failed to join waitlist. Please try again.';
      toast.error(errorMessage, {
        duration: 5000, // Show for 5 seconds
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setSuccess(null);
    setSimpleSuccess(null);
    setError(null);
  };

  return {
    signup,
    isSubmitting,
    success,
    simpleSuccess,
    error,
    reset
  };
}
