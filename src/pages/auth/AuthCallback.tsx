/**
 * AuthCallback - Handles Supabase auth callback after email verification
 *
 * This page handles the redirect from Supabase after:
 * - Email signup confirmation
 * - Magic link login
 * - OAuth callbacks
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase/clientV2';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    // Prevent double-processing
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    const handleCallback = async () => {
      try {
        setIsProcessing(true);

        // Get the auth code/token from URL
        const code = searchParams.get('code');
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');
        const next = searchParams.get('next') || '/dashboard';

        // First check if we already have a session (user might already be logged in)
        let { data: { session } } = await supabase.auth.getSession();

        // If we already have a valid session, skip verification and proceed
        if (session?.user) {
          // User is already authenticated - go directly to appropriate page
          await navigateBasedOnOnboarding(session, next);
          return;
        }

        // If no session, try to get one from the URL params
        if (code) {
          const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
          if (codeError) {
            console.error('Error exchanging code for session:', codeError);
            // Check if user is now logged in despite the error (code may have been used already)
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession?.user) {
              await navigateBasedOnOnboarding(retrySession, next);
              return;
            }
            setError(codeError.message);
            setIsProcessing(false);
            return;
          }
        }

        // If there's a token_hash (from email confirmation), verify it
        if (tokenHash && type) {
          const { error: otpError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as 'signup' | 'recovery' | 'email',
          });
          if (otpError) {
            console.error('Error verifying OTP:', otpError);
            // Check if user is now logged in despite the error (link may have been used already)
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession?.user) {
              // User is already logged in - the link was probably already used
              // Don't show error, just proceed
              await navigateBasedOnOnboarding(retrySession, next);
              return;
            }
            // Only show error if user is truly not logged in
            if (otpError.message.includes('expired') || otpError.message.includes('invalid')) {
              setError('This email link has expired or was already used. Please log in or request a new link.');
            } else {
              setError(otpError.message);
            }
            setIsProcessing(false);
            return;
          }
        }

        // Get the session again after verification
        const result = await supabase.auth.getSession();
        session = result.data.session;

        if (session?.user) {
          await navigateBasedOnOnboarding(session, next);
        } else {
          // No session and no auth params - redirect to login
          navigate('/auth/login', { replace: true });
        }
      } catch (err: any) {
        console.error('Auth callback error:', err);
        // Check one more time if user is logged in
        const { data: { session: finalSession } } = await supabase.auth.getSession();
        if (finalSession?.user) {
          navigate('/onboarding', { replace: true });
          return;
        }
        setError(err.message || 'Authentication failed');
        setIsProcessing(false);
      }
    };

    // Helper function to navigate based on onboarding status
    const navigateBasedOnOnboarding = async (session: any, next: string) => {
      try {
        const { data: progress } = await supabase
          .from('user_onboarding_progress')
          .select('onboarding_completed_at, skipped_onboarding')
          .eq('user_id', session.user.id)
          .maybeSingle();

        // If no progress record exists or onboarding not completed, go to onboarding
        if (!progress || (!progress.onboarding_completed_at && !progress.skipped_onboarding)) {
          navigate('/onboarding', { replace: true });
        } else {
          navigate(next, { replace: true });
        }
      } catch (progressError) {
        // If we can't check onboarding status, default to onboarding
        console.error('Error checking onboarding status:', progressError);
        navigate('/onboarding', { replace: true });
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.25),transparent)] pointer-events-none" />
        <div className="text-center max-w-md px-4">
          <div className="text-red-400 text-lg font-medium mb-4">Authentication Issue</div>
          <p className="text-gray-400 mb-6">{error}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/auth/login')}
              className="bg-[#37bd7e] hover:bg-[#2da76c] text-white px-6 py-2 rounded-lg transition-colors"
            >
              Go to Login
            </button>
            <button
              onClick={() => navigate('/auth/signup')}
              className="text-[#37bd7e] hover:text-[#2da76c] text-sm"
            >
              Create an account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.25),transparent)] pointer-events-none" />
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-[#37bd7e] animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Setting up your account...</p>
      </div>
    </div>
  );
}
