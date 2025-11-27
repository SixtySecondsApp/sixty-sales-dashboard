/**
 * VerifyEmail - Email Verification Pending Screen
 *
 * Shown after signup to let users know they need to verify their email.
 * Provides option to resend verification email if needed.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Mail, CheckCircle2, RefreshCw, ArrowLeft, Inbox } from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [hasResent, setHasResent] = useState(false);

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Check if user is already verified (they clicked the link in another tab)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email_confirmed_at) {
        // User is verified, redirect to onboarding
        navigate('/onboarding', { replace: true });
      }
    };

    // Check immediately and then every 5 seconds
    checkSession();
    const interval = setInterval(checkSession, 5000);
    return () => clearInterval(interval);
  }, [navigate]);

  const handleResendEmail = async () => {
    if (!email || resendCooldown > 0) return;

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Verification email sent! Check your inbox.');
        setHasResent(true);
        setResendCooldown(60); // 60 second cooldown
      }
    } catch (err) {
      toast.error('Failed to resend email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.25),transparent)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="relative bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800/50 p-8 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 via-gray-900/70 to-gray-900/30 rounded-2xl -z-10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.15),transparent)] rounded-2xl -z-10" />
          <div className="absolute -right-20 -top-20 w-40 h-40 bg-[#37bd7e]/10 blur-3xl rounded-full" />

          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="flex justify-center mb-6"
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#37bd7e] to-[#2da76c] flex items-center justify-center">
                <Mail className="w-10 h-10 text-white" />
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center border-4 border-gray-900"
              >
                <Inbox className="w-4 h-4 text-white" />
              </motion.div>
            </div>
          </motion.div>

          {/* Content */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-3 text-white">Check your email</h1>
            <p className="text-gray-400 mb-4">
              We've sent a verification link to
            </p>
            {email && (
              <p className="text-[#37bd7e] font-medium text-lg mb-4 break-all">
                {email}
              </p>
            )}
            <p className="text-gray-500 text-sm">
              Click the link in the email to verify your account and get started.
            </p>
          </div>

          {/* Tips */}
          <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#37bd7e]" />
              Tips if you don't see the email:
            </h3>
            <ul className="text-sm text-gray-400 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                Check your spam or junk folder
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                Make sure {email || 'your email'} is spelled correctly
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500">•</span>
                Wait a few minutes for the email to arrive
              </li>
            </ul>
          </div>

          {/* Resend Button */}
          <div className="space-y-4">
            <button
              onClick={handleResendEmail}
              disabled={isResending || resendCooldown > 0 || !email}
              className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-700"
            >
              {isResending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : resendCooldown > 0 ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Resend in {resendCooldown}s
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Resend verification email
                </>
              )}
            </button>

            {hasResent && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center text-sm text-[#37bd7e]"
              >
                Email sent! Check your inbox.
              </motion.p>
            )}
          </div>

          {/* Back to Login */}
          <div className="mt-6 pt-6 border-t border-gray-800">
            <Link
              to="/auth/login"
              className="flex items-center justify-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </Link>
          </div>

          {/* Auto-redirect notice */}
          <p className="mt-4 text-center text-xs text-gray-600">
            This page will automatically redirect once your email is verified.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
