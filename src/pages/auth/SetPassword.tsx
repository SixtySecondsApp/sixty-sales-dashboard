/**
 * SetPassword Page
 * Allows waitlist users to set their password after magic link authentication
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Lock, CheckCircle, Loader2, Mail } from 'lucide-react';

export default function SetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [waitlistEntryId, setWaitlistEntryId] = useState<string | null>(null);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      // Get waitlist entry ID from URL or localStorage (URL params might be lost in redirects)
      const entryId = searchParams.get('waitlist_entry') || localStorage.getItem('waitlist_entry_id');
      if (entryId) {
        setWaitlistEntryId(entryId);
        localStorage.setItem('waitlist_entry_id', entryId);
      }

      console.log('[SetPassword] Checking session for waitlist entry:', entryId);

      // Check if user is authenticated - retry a few times as session might be establishing
      let session = null;
      let attempts = 0;
      const maxAttempts = 5;

      while (!session && attempts < maxAttempts) {
        attempts++;
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[SetPassword] Session check error (attempt ' + attempts + '):', error);
          if (attempts >= maxAttempts) {
            toast.error('Session error. Please try clicking the invitation link again.');
            navigate('/auth/login');
            return;
          }
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }

        if (currentSession?.user) {
          session = currentSession;
          console.log('[SetPassword] Session found:', {
            userId: session.user.id,
            email: session.user.email,
            emailConfirmed: !!session.user.email_confirmed_at,
            invitedAt: session.user.invited_at
          });
          break;
        }

        // No session yet, wait and retry
        console.log('[SetPassword] No session yet (attempt ' + attempts + '), waiting...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!session?.user) {
        // No session after retries - redirect to login
        console.error('[SetPassword] No session found after ' + maxAttempts + ' attempts');
        toast.error('Please click the invitation link in your email to continue.');
        navigate('/auth/login');
        return;
      }

      // User is authenticated
      setUserEmail(session.user.email || null);

      // Check if user already has a password set (if not passwordless)
      // For passwordless users, we allow setting a password
      setIsCheckingSession(false);
    } catch (error: any) {
      console.error('[SetPassword] Error checking session:', error);
      toast.error('An error occurred. Please try again.');
      navigate('/auth/login');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      // Verify we still have a session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('Session expired. Please click the magic link again.');
        navigate('/auth/login');
        return;
      }

      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        console.error('Password update error:', updateError);
        toast.error(updateError.message || 'Failed to set password. Please try again.');
        return;
      }

      // Ensure waitlist entry is linked to this user
      // Use waitlistEntryId from state or localStorage as fallback
      const entryIdToLink = waitlistEntryId || localStorage.getItem('waitlist_entry_id');
      if (entryIdToLink) {
        // Wait a moment for any triggers to run (trigger should auto-link by email)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if waitlist entry is linked and get full entry data
        const { data: entry, error: entryError } = await supabase
          .from('meetings_waitlist')
          .select('user_id, status, email, full_name, company_name')
          .eq('id', entryIdToLink)
          .single();

        if (entry) {
          if (!entry.user_id || entry.user_id !== session.user.id) {
            // Manually link if not already linked (trigger should handle this, but safety check)
            console.log(`Linking waitlist entry ${entryIdToLink} to user ${session.user.id}`);
            const { error: linkError } = await supabase
              .from('meetings_waitlist')
              .update({
                user_id: session.user.id,
                status: 'converted',
                converted_at: new Date().toISOString(),
                invitation_accepted_at: new Date().toISOString()
              })
              .eq('id', entryIdToLink);

            if (linkError) {
              console.error('Error linking waitlist entry:', linkError);
              // Don't fail the password setup if linking fails - user can still proceed
            } else {
              console.log('Successfully linked waitlist entry to user and tracked invitation acceptance');
            }
          } else {
            console.log('Waitlist entry already linked to user');
            // Update invitation acceptance timestamp if not already set
            await supabase
              .from('meetings_waitlist')
              .update({
                invitation_accepted_at: new Date().toISOString(),
                status: 'converted',
                converted_at: new Date().toISOString()
              })
              .eq('id', entryIdToLink)
              .is('invitation_accepted_at', null);
          }

          // Update user profile with waitlist entry data if available
          if (entry.email && (entry.full_name || entry.company_name)) {
            try {
              const profileUpdates: any = {};
              
              // Parse full_name into first_name and last_name if available
              if (entry.full_name) {
                const nameParts = entry.full_name.trim().split(' ');
                if (nameParts.length > 0) {
                  profileUpdates.first_name = nameParts[0];
                  if (nameParts.length > 1) {
                    profileUpdates.last_name = nameParts.slice(1).join(' ');
                  }
                }
              }

              // Note: company_name is stored in waitlist entry, not in profiles directly
              // We could store it elsewhere if needed, but for now we'll just use name

              if (Object.keys(profileUpdates).length > 0) {
                const { error: profileError } = await supabase
                  .from('profiles')
                  .update(profileUpdates)
                  .eq('id', session.user.id);

                if (profileError) {
                  console.error('Error updating profile with waitlist data:', profileError);
                  // Non-critical - continue
                } else {
                  console.log('Updated profile with waitlist entry data');
                }
              }
            } catch (profileUpdateError) {
              console.error('Error updating profile:', profileUpdateError);
              // Non-critical - continue
            }
          }

          // Ensure waitlist onboarding progress record exists
          try {
            const { error: progressError } = await supabase
              .from('waitlist_onboarding_progress')
              .upsert({
                user_id: session.user.id,
                waitlist_entry_id: entryIdToLink,
                account_created_at: new Date().toISOString()
              }, {
                onConflict: 'user_id'
              });

            if (progressError) {
              console.error('Error creating onboarding progress:', progressError);
              // Non-critical - continue
            }
          } catch (progressError) {
            console.error('Error creating onboarding progress:', progressError);
            // Non-critical - continue
          }
        } else if (entryError) {
          console.error('Error fetching waitlist entry:', entryError);
          // Non-critical - user can still proceed even if we can't link
        }
        
        // Clear localStorage after successful linking
        localStorage.removeItem('waitlist_entry_id');
      } else {
        // Try to find waitlist entry by email (fallback)
        console.log('No waitlist entry ID found, attempting to link by email:', session.user.email);
        try {
          const { data: entryByEmail } = await supabase
            .from('meetings_waitlist')
            .select('id, user_id, status, email')
            .eq('email', session.user.email)
            .eq('status', 'released')
            .is('user_id', null)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (entryByEmail && !entryByEmail.user_id) {
            // Link this entry
            await supabase
              .from('meetings_waitlist')
              .update({
                user_id: session.user.id,
                status: 'converted',
                converted_at: new Date().toISOString()
              })
              .eq('id', entryByEmail.id);
            
            console.log('Linked waitlist entry by email match');
          }
        } catch (emailLinkError) {
          console.error('Error linking by email:', emailLinkError);
          // Non-critical
        }
      }

      toast.success('Password set successfully! Welcome to Early Access.');
      
      // Redirect to dashboard after a brief delay
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1500);
    } catch (error: any) {
      console.error('Password setup error:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#37bd7e] animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Verifying your access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.25),transparent)] pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl">
          {/* Welcome Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#37bd7e]/20 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-[#37bd7e]" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome to Early Access!</h1>
            <p className="text-gray-400">
              {userEmail ? `Signed in as ${userEmail}` : 'Set your password to get started'}
            </p>
          </div>

          {/* Password Setup Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Set Your Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password (min 6 characters)"
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
                  required
                  minLength={6}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent"
                  required
                  minLength={6}
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !password || !confirmPassword}
              className="w-full bg-[#37bd7e] hover:bg-[#2da76c] disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Setting up your account...
                </>
              ) : (
                'Complete Setup & Go to Dashboard'
              )}
            </button>
          </form>

          {/* Info Message */}
          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-400">
                <p className="font-medium text-gray-300 mb-1">Your account is ready!</p>
                <p>Once you set your password, you'll have full access to the dashboard and all Early Access features.</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
