import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useOnboardingProgress } from '@/lib/hooks/useOnboardingProgress';
import { useAuth } from '@/lib/contexts/AuthContext';
import { supabase } from '@/lib/supabase/clientV2';

interface CompletionStepProps {
  onComplete: () => void;
}

export function CompletionStep({ onComplete }: CompletionStepProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated, session } = useAuth();
  const { completeStep } = useOnboardingProgress();
  const [isCompleting, setIsCompleting] = useState(false);
  const completionAttemptedRef = useRef(false);

  useEffect(() => {
    // Mark onboarding as complete (only once per mount)
    if (!completionAttemptedRef.current && user) {
      completionAttemptedRef.current = true;
      completeStep('complete').catch((err) => {
        console.error('Error completing onboarding step:', err);
        // Don't block the user - they can still proceed
      });
    }
  }, [completeStep, user]);

  // Verify session is valid before navigation
  const verifySessionAndNavigate = useCallback(async () => {
    try {
      // Double-check session directly with Supabase
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Session verification error:', error);
        return false;
      }

      if (!currentSession?.user) {
        console.error('No valid session found');
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error verifying session:', err);
      return false;
    }
  }, []);

  const handleGetStarted = async () => {
    if (isCompleting) return;
    setIsCompleting(true);

    try {
      // Small delay to allow any pending auth state updates to settle
      await new Promise(resolve => setTimeout(resolve, 100));
      navigate('/meetings', { replace: true });
    } catch (error) {
      console.error('Error navigating to meetings:', error);
      window.location.href = '/meetings';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-2xl mx-auto text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-[#37bd7e] to-[#2da76c] mb-8"
      >
        <CheckCircle2 className="w-12 h-12 text-white" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-4xl font-bold mb-4 text-white"
      >
        You're All Set!
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-xl text-gray-400 mb-12"
      >
        Your Meetings Analytics dashboard is ready. Start exploring your meeting insights!
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="space-y-4"
      >
        <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50 p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">What's Next?</h3>
          <div className="space-y-3 text-left">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#37bd7e] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-white font-medium">Your Meetings Are Syncing</p>
                <p className="text-sm text-gray-400">We're importing your recent Fathom recordings in the background</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#37bd7e] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-white font-medium">Explore Insights</p>
                <p className="text-sm text-gray-400">Check out talk time coaching and sentiment analysis</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#37bd7e] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-white font-medium">Generate Proposals</p>
                <p className="text-sm text-gray-400">Create proposals directly from meeting transcripts</p>
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={handleGetStarted}
          disabled={isCompleting}
          className="bg-[#37bd7e] hover:bg-[#2da76c] text-white px-8 py-6 text-lg disabled:opacity-70"
        >
          {isCompleting ? (
            <>
              <Loader2 className="mr-2 w-5 h-5 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              Go to Meetings Dashboard
              <ArrowRight className="ml-2 w-5 h-5" />
            </>
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}

