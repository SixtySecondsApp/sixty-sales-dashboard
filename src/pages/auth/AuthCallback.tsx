/**
 * AuthCallback - Handles Supabase auth callback after email verification
 *
 * This page handles the redirect from Supabase after:
 * - Email signup confirmation
 * - Magic link login
 * - OAuth callbacks
 * 
 * FLOW:
 * 1. User signs up → redirected to /auth/verify-email
 * 2. User clicks email link → redirected here (/auth/callback)
 * 3. We verify the token, check email_confirmed_at
 * 4. If verified → go to /onboarding (or /dashboard if completed)
 * 5. If not verified → go back to /auth/verify-email
 */

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase/clientV2';
import { Loader2 } from 'lucide-react';
import { getUserTypeFromEmailAsync } from '@/lib/utils/userTypeUtils';

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
        // Get waitlist entry ID from URL or localStorage (URL params might be lost in redirects)
        const waitlistEntryId = searchParams.get('waitlist_entry') || localStorage.getItem('waitlist_entry_id');
        const next = searchParams.get('next') || '/dashboard';
        // Get invited user's name if provided in URL (from admin invite)
        // NOTE: Names should NOT be in query params - they break Supabase auth verification
        // Instead, they should be in user_metadata after invitation
        const invitedFirstName = searchParams.get('first_name');
        const invitedLastName = searchParams.get('last_name');

        console.log('[AuthCallback] Starting callback processing:', {
          hasCode: !!code,
          hasTokenHash: !!tokenHash,
          type,
          waitlistEntryId,
          urlParams: Object.fromEntries(searchParams.entries()),
          hash: window.location.hash
        });

        // Check if there are session tokens in URL hash (from invitation redirect)
        // Supabase client should auto-handle these, but let's wait a moment for it to process
        if (window.location.hash && window.location.hash.includes('access_token')) {
          console.log('[AuthCallback] Found access_token in URL hash, waiting for Supabase to process...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // First check if we already have a session (user might already be logged in)
        let { data: { session } } = await supabase.auth.getSession();

        console.log('[AuthCallback] Initial session check:', {
          hasSession: !!session,
          userId: session?.user?.id,
          email: session?.user?.email,
          emailConfirmed: !!session?.user?.email_confirmed_at,
          invitedAt: session?.user?.invited_at
        });

        // If we already have a valid session with verified email, skip verification and proceed
        if (session?.user?.email_confirmed_at) {
          // Check if this is a waitlist user - check multiple sources
          const waitlistIdFromUrl = waitlistEntryId;
          const waitlistIdFromStorage = localStorage.getItem('waitlist_entry_id');
          const waitlistIdFromMetadata = session.user.user_metadata?.waitlist_entry_id;
          const waitlistEntryIdToUse = waitlistIdFromUrl || waitlistIdFromStorage || waitlistIdFromMetadata;
          
          if (waitlistEntryIdToUse) {
            localStorage.setItem('waitlist_entry_id', waitlistEntryIdToUse);
            navigate(`/auth/set-password?waitlist_entry=${waitlistEntryIdToUse}`, { replace: true });
            return;
          }
          
          // User is already authenticated and verified - go directly to appropriate page
          await navigateBasedOnOnboarding(session, next);
          return;
        }

        // If session exists but email not verified, handle token verification first
        // Then we'll check verification status again

        // If no session, try to get one from the URL params
        if (code) {
          const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
          if (codeError) {
            console.error('Error exchanging code for session:', codeError);
            
            // PKCE Error: "both auth code and code verifier should be non-empty"
            // This happens when user clicks email link in different browser/device
            // The code_verifier was stored in localStorage during signup but isn't available here
            const isPKCEError = codeError.message?.includes('code verifier') || 
                               codeError.message?.includes('pkce') ||
                               codeError.message?.includes('non-empty');
            
            if (isPKCEError) {
              console.log('PKCE verification failed - user likely opened link in different browser');
              // Provide helpful error message for cross-browser/device scenario
              setError(
                'Please open this confirmation link in the same browser where you signed up. ' +
                'If you signed up on a different device, please sign in with your email and password instead.'
              );
              setIsProcessing(false);
              return;
            }
            
            // Check if user is now logged in despite the error (code may have been used already)
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession?.user?.email_confirmed_at) {
              await navigateBasedOnOnboarding(retrySession, next);
              return;
            } else if (retrySession?.user) {
              // Session exists but email not confirmed
              navigate(`/auth/verify-email?email=${encodeURIComponent(retrySession.user.email || '')}`, { replace: true });
              return;
            }
            setError(codeError.message);
            setIsProcessing(false);
            return;
          }
        }

        // If there's a token_hash (from email confirmation/magic link/invite), verify it
        if (tokenHash && type) {
          console.log('[AuthCallback] Verifying OTP with token_hash and type:', type);

          const { data: verifyData, error: otpError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as 'signup' | 'invite' | 'recovery' | 'email' | 'magiclink',
          });
          
          if (otpError) {
            console.error('[AuthCallback] Error verifying OTP:', otpError);
            // Check if user is now logged in despite the error (link may have been used already)
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession?.user?.email_confirmed_at) {
              // User is already logged in and verified - the link was probably already used
              console.log('[AuthCallback] User already has session after verification error');
              // Try to find waitlist entry by email if not in URL
              const storedWaitlistEntryId = waitlistEntryId || localStorage.getItem('waitlist_entry_id') || retrySession.user.user_metadata?.waitlist_entry_id;
              if (storedWaitlistEntryId) {
                localStorage.setItem('waitlist_entry_id', storedWaitlistEntryId);
                navigate(`/auth/set-password?waitlist_entry=${storedWaitlistEntryId}`, { replace: true });
                return;
              }
              await navigateBasedOnOnboarding(retrySession, next);
              return;
            } else if (retrySession?.user) {
              // Session exists but email still not confirmed
              navigate(`/auth/verify-email?email=${encodeURIComponent(retrySession.user.email || '')}`, { replace: true });
              return;
            }
            // Only show error if user is truly not logged in
            if (otpError.message.includes('expired') || otpError.message.includes('invalid')) {
              const errorMsg = waitlistEntryId
                ? 'This magic link has expired or was already used. Please contact support or request a new magic link.'
                : 'This email link has expired or was already used. Please log in or request a new link.';
              setError(errorMsg);
            } else {
              setError(otpError.message);
            }
            setIsProcessing(false);
            return;
          }
          
          // verifyOtp should create a session - use the session from verifyData if available
          if (verifyData?.session) {
            console.log('[AuthCallback] Session created from verifyOtp');
            session = verifyData.session;
          } else {
            console.log('[AuthCallback] No session in verifyData, fetching session');
            // If no session in response, fetch it
            const { data: sessionData } = await supabase.auth.getSession();
            session = sessionData.session;
          }
        } else if (!session) {
          // If no token_hash, try to get session (might already be established)
          const result = await supabase.auth.getSession();
          session = result.data.session;
        }

        if (session?.user) {
          // Get names from URL params OR user_metadata (set during invitation)
          const firstNameToSave = invitedFirstName || session.user.user_metadata?.first_name;
          const lastNameToSave = invitedLastName || session.user.user_metadata?.last_name;

          // Ensure profile exists and save names (upsert to handle new invited users)
          if (session.user.id) {
            try {
              console.log('[AuthCallback] Ensuring profile exists for user:', session.user.id);
              const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                  id: session.user.id,
                  email: session.user.email,
                  first_name: firstNameToSave || null,
                  last_name: lastNameToSave || null,
                  updated_at: new Date().toISOString(),
                }, {
                  onConflict: 'id'
                });

              if (profileError) {
                console.warn('[AuthCallback] Failed to upsert profile:', profileError);
              } else {
                console.log('[AuthCallback] Successfully ensured profile exists');
              }
            } catch (err) {
              console.error('[AuthCallback] Error upserting profile:', err);
            }
          }

          // Check if this is an invitation flow
          // - type=invite (from Supabase invite flow)
          // - user.invited_at timestamp (from Supabase)
          // - invited_by_admin_id in metadata (from our admin invite flow)
          const isInvitation = type === 'invite' ||
                              type === 'recovery' && session.user.user_metadata?.invited_by_admin_id ||
                              session.user.invited_at;

          // For invitations, we should redirect to SetPassword even if email not confirmed
          // For regular signups, we need email_confirmed_at to proceed
          const shouldProceed = session.user.email_confirmed_at || isInvitation;

          if (shouldProceed) {
            // Check if this is a waitlist user
            // 1. First check URL params (might be lost in redirect)
            // 2. Check localStorage (might have been stored before)
            // 3. Check user metadata (stored when invitation was generated)
            // 4. Find by email (fallback)
            let storedWaitlistEntryId = waitlistEntryId || localStorage.getItem('waitlist_entry_id');

            // Check user metadata for waitlist_entry_id
            if (!storedWaitlistEntryId && session.user.user_metadata?.waitlist_entry_id) {
              storedWaitlistEntryId = session.user.user_metadata.waitlist_entry_id;
            }

            // If still no waitlist_entry, try to find it by email (invitation link might not preserve query params)
            if (!storedWaitlistEntryId && session.user.email) {
              try {
                const { data: waitlistEntry } = await supabase
                  .from('meetings_waitlist')
                  .select('id, status, user_id, invited_user_id')
                  .eq('email', session.user.email)
                  .in('status', ['released', 'pending', 'converted'])
                  .order('created_at', { ascending: true })
                  .limit(1)
                  .maybeSingle();

                if (waitlistEntry) {
                  storedWaitlistEntryId = waitlistEntry.id;
                  localStorage.setItem('waitlist_entry_id', waitlistEntry.id);
                }
              } catch (err) {
                console.error('Error finding waitlist entry:', err);
              }
            }

            // If this is a waitlist/invitation callback, redirect to dashboard with password setup flag
            if (storedWaitlistEntryId || isInvitation) {
              const finalWaitlistId = storedWaitlistEntryId || 'pending';
              console.log('[AuthCallback] Setting up invited user for password setup on dashboard:', finalWaitlistId);

              // Mark user as needing password setup - this triggers the modal on dashboard
              try {
                await supabase.auth.updateUser({
                  data: { needs_password_setup: true, waitlist_entry_id: finalWaitlistId }
                });
              } catch (err) {
                console.error('[AuthCallback] Error setting needs_password_setup flag:', err);
              }

              // Link waitlist entry to user
              if (finalWaitlistId && finalWaitlistId !== 'pending' && session?.user) {
                try {
                  await supabase.from('meetings_waitlist').update({
                    user_id: session.user.id,
                    status: 'converted',
                    converted_at: new Date().toISOString(),
                    invitation_accepted_at: new Date().toISOString()
                  }).eq('id', finalWaitlistId);
                } catch (err) {
                  console.error('[AuthCallback] Error linking waitlist entry:', err);
                }
              }

              // Clear localStorage
              localStorage.removeItem('waitlist_entry_id');

              // Redirect to dashboard - password modal will appear there
              navigate('/dashboard', { replace: true });
              return;
            }

            // Only proceed to onboarding if email is confirmed
            if (session.user.email_confirmed_at) {
              await navigateBasedOnOnboarding(session, next);
            } else {
              // Email not confirmed and not an invitation - need verification
              navigate(`/auth/verify-email?email=${encodeURIComponent(session.user.email || '')}`, { replace: true });
            }
          } else {
            // Email still not confirmed and not an invitation, go to verify page
            navigate(`/auth/verify-email?email=${encodeURIComponent(session.user.email || '')}`, { replace: true });
          }
        } else {
          // No session after verification - this shouldn't happen with magic links
          console.warn('[AuthCallback] Magic link verification completed but no session found');
          // Wait a moment and try again (session might still be setting up)
          await new Promise(resolve => setTimeout(resolve, 500));
          const { data: retrySession } = await supabase.auth.getSession();
          if (retrySession?.session?.user) {
            console.log('[AuthCallback] Session found on retry');
            // Session appeared, check if this is a waitlist user
            const finalWaitlistId = waitlistEntryId || localStorage.getItem('waitlist_entry_id') || retrySession.session.user.user_metadata?.waitlist_entry_id;
            if (finalWaitlistId) {
              // Mark user as needing password setup
              try {
                await supabase.auth.updateUser({
                  data: { needs_password_setup: true, waitlist_entry_id: finalWaitlistId }
                });
              } catch (err) {
                console.error('[AuthCallback] Error setting needs_password_setup flag on retry:', err);
              }
              localStorage.removeItem('waitlist_entry_id');
              navigate('/dashboard', { replace: true });
              return;
            }
            await navigateBasedOnOnboarding(retrySession.session, next);
          } else {
            console.error('[AuthCallback] Still no session after retry, redirecting to login');
            navigate('/auth/login', { replace: true });
          }
        }
      } catch (err: any) {
        console.error('Auth callback error:', err);
        // Check one more time if user is logged in
        const { data: { session: finalSession } } = await supabase.auth.getSession();
        if (finalSession?.user?.email_confirmed_at) {
          // Check if this is a waitlist entry callback
          if (waitlistEntryId) {
            // Mark user as needing password setup
            try {
              await supabase.auth.updateUser({
                data: { needs_password_setup: true, waitlist_entry_id: waitlistEntryId }
              });
            } catch (updateErr) {
              console.error('[AuthCallback] Error setting needs_password_setup flag in catch:', updateErr);
            }
            localStorage.removeItem('waitlist_entry_id');
            navigate('/dashboard', { replace: true });
            return;
          }
          navigate('/onboarding', { replace: true });
          return;
        } else if (finalSession?.user) {
          navigate(`/auth/verify-email?email=${encodeURIComponent(finalSession.user.email || '')}`, { replace: true });
          return;
        }
        setError(err.message || 'Authentication failed');
        setIsProcessing(false);
      }
    };

    // Helper function to navigate based on onboarding status
    const navigateBasedOnOnboarding = async (session: any, next: string) => {
      try {
        // Double-check email is verified before proceeding to onboarding
        if (!session.user.email_confirmed_at) {
          navigate(`/auth/verify-email?email=${encodeURIComponent(session.user.email || '')}`, { replace: true });
          return;
        }

        // Check if user is an internal user (in the internal_users whitelist)
        // Internal users skip onboarding and go directly to dashboard
        const userType = await getUserTypeFromEmailAsync(session.user.email);
        if (userType === 'internal') {
          console.log('[AuthCallback] Internal user detected, skipping onboarding');

          // Auto-mark onboarding as skipped for internal users
          try {
            await supabase
              .from('user_onboarding_progress')
              .upsert({
                user_id: session.user.id,
                skipped_onboarding: true,
                onboarding_completed_at: new Date().toISOString(),
                onboarding_step: 'complete',
              }, {
                onConflict: 'user_id',
              });
          } catch (skipError) {
            console.warn('[AuthCallback] Could not mark onboarding as skipped:', skipError);
          }

          navigate(next, { replace: true });
          return;
        }

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

  // Check if this is a PKCE/cross-browser error
  const isPKCEError = error?.includes('code verifier') || error?.includes('same browser');

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
            {isPKCEError && (
              <p className="text-xs text-gray-500 mt-2">
                Tip: If you signed up on this device, try clearing your browser cache and signing up again.
              </p>
            )}
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
