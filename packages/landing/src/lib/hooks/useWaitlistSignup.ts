/**
 * Custom hook for waitlist signup functionality
 * Handles form submission, validation, and success state
 */

import { useState } from 'react';
import { toast } from 'sonner';
import * as waitlistService from '../services/waitlistService';
import type { WaitlistEntry, WaitlistSignupData } from '../types/waitlist';

interface UseWaitlistSignupReturn {
  signup: (data: WaitlistSignupData) => Promise<void>;
  isSubmitting: boolean;
  success: WaitlistEntry | null;
  error: Error | null;
  reset: () => void;
}

export function useWaitlistSignup(): UseWaitlistSignupReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<WaitlistEntry | null>(null);
  const [error, setError] = useState<Error | null>(null);

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

      setSuccess(entry);
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
    setError(null);
  };

  return {
    signup,
    isSubmitting,
    success,
    error,
    reset
  };
}
