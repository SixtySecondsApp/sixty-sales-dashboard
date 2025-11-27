/**
 * AuthCallback - Handles Supabase auth callback after email verification
 *
 * This page handles the redirect from Supabase after:
 * - Email signup confirmation
 * - Magic link login
 * - OAuth callbacks
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase/clientV2';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the auth code/token from URL
        const code = searchParams.get('code');
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');
        const next = searchParams.get('next') || '/dashboard';

        // If there's a code, exchange it for a session
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('Error exchanging code for session:', error);
            setError(error.message);
            return;
          }
        }

        // If there's a token_hash (from email confirmation), verify it
        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as 'signup' | 'recovery' | 'email',
          });
          if (error) {
            console.error('Error verifying OTP:', error);
            setError(error.message);
            return;
          }
        }

        // Check if we have a session now
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          // Check if user needs onboarding
          const { data: progress } = await supabase
            .from('user_onboarding_progress')
            .select('onboarding_completed_at, skipped_onboarding')
            .eq('user_id', session.user.id)
            .single();

          // If onboarding not completed and not skipped, go to onboarding
          if (progress && !progress.onboarding_completed_at && !progress.skipped_onboarding) {
            navigate('/onboarding', { replace: true });
          } else {
            navigate(next, { replace: true });
          }
        } else {
          // No session, redirect to login
          navigate('/auth/login', { replace: true });
        }
      } catch (err: any) {
        console.error('Auth callback error:', err);
        setError(err.message || 'Authentication failed');
      }
    };

    handleCallback();
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="text-red-400 mb-4">Authentication Error</div>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => navigate('/auth/login')}
            className="text-[#37bd7e] hover:underline"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-[#37bd7e] animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Verifying your email...</p>
      </div>
    </div>
  );
}
