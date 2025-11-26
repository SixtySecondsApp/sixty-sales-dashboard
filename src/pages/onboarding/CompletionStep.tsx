import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useOnboardingProgress } from '@/lib/hooks/useOnboardingProgress';

interface CompletionStepProps {
  onComplete: () => void;
}

export function CompletionStep({ onComplete }: CompletionStepProps) {
  const navigate = useNavigate();
  const { completeStep } = useOnboardingProgress();

  useEffect(() => {
    // Mark onboarding as complete
    completeStep('complete');
  }, [completeStep]);

  const handleGetStarted = () => {
    onComplete();
    navigate('/meetings');
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
                <p className="text-white font-medium">View Your Meetings</p>
                <p className="text-sm text-gray-400">See all your synced meetings and their analytics</p>
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
          className="bg-[#37bd7e] hover:bg-[#2da76c] text-white px-8 py-6 text-lg"
        >
          Go to Meetings Dashboard
          <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </motion.div>
    </motion.div>
  );
}

