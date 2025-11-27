import { motion } from 'framer-motion';
import { Video, Sparkles, TrendingUp, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#37bd7e] to-[#2da76c] mb-6"
        >
          <Video className="w-10 h-10 text-white" />
        </motion.div>
        <h1 className="text-4xl font-bold mb-4 text-white">
          Welcome to Meetings Analytics
        </h1>
        <p className="text-xl text-gray-400 mb-8">
          Transform your sales calls into actionable insights
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50 p-6"
        >
          <div className="w-12 h-12 rounded-lg bg-[#37bd7e]/20 flex items-center justify-center mb-4">
            <Video className="w-6 h-6 text-[#37bd7e]" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Auto-Sync Calls
          </h3>
          <p className="text-sm text-gray-400">
            Connect Fathom to automatically sync all your meeting recordings and transcripts
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50 p-6"
        >
          <div className="w-12 h-12 rounded-lg bg-[#37bd7e]/20 flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 text-[#37bd7e]" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            AI-Powered Insights
          </h3>
          <p className="text-sm text-gray-400">
            Get sentiment analysis, talk time coaching, and actionable recommendations
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50 p-6"
        >
          <div className="w-12 h-12 rounded-lg bg-[#37bd7e]/20 flex items-center justify-center mb-4">
            <TrendingUp className="w-6 h-6 text-[#37bd7e]" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Track Progress
          </h3>
          <p className="text-sm text-gray-400">
            Monitor your performance over time and improve your sales conversations
          </p>
        </motion.div>
      </div>

      <div className="flex justify-center">
        <Button
          onClick={onNext}
          className="bg-[#37bd7e] hover:bg-[#2da76c] text-white px-8 py-6 text-lg"
        >
          Get Started
          <ArrowRight className="ml-2 w-5 h-5" />
        </Button>
      </div>
    </motion.div>
  );
}

