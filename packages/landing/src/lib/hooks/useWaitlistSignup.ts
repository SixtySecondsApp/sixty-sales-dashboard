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
      const firstName = fullName.split(' ')[0];
      const { data, error } = await supabase.functions.invoke('encharge-send-email', {
        body: {
          template_type: 'waitlist_welcome',
          to_email: email.trim().toLowerCase(),
          to_name: firstName,
          variables: {
            user_name: firstName,
            full_name: fullName,
            company_name: companyName || '',
            first_name: firstName,
            email: email.trim().toLowerCase(),
          },
        },
      });

      if (error) {
        console.error('[Waitlist] Welcome email failed:', error);
        // Don't throw - email failure shouldn't block signup success
      } else {
        console.log('[Waitlist] Welcome email sent successfully:', data);
      }
    } catch (err) {
      console.error('[Waitlist] Welcome email exception:', err);
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
      if (!data.meeting_recorder_tool || !data.crm_tool || !data.task_manager_tool) {
        throw new Error('Please select all integration options');
      }

      // Validate "Other" options have values
      if (data.task_manager_tool === 'Other' && !data.task_manager_other?.trim()) {
        throw new Error('Please specify which task manager you use');
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

      // Handle specific error cases with user-friendly messages
      let errorMessage = error.message || 'Failed to join waitlist. Please try again.';

      // Check for duplicate email error
      if (errorMessage.includes('duplicate key') || errorMessage.includes('email_key') || errorMessage.includes('already exists')) {
        errorMessage = 'This email is already on the waitlist! Check your inbox for your confirmation.';
      }

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
