import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Video, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFathomIntegration } from '@/lib/hooks/useFathomIntegration';
import { useOnboardingProgress } from '@/lib/hooks/useOnboardingProgress';
import { toast } from 'sonner';

interface FathomConnectionStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function FathomConnectionStep({ onNext, onBack }: FathomConnectionStepProps) {
  const { integration, connectFathom, loading: fathomLoading } = useFathomIntegration();
  const { markFathomConnected } = useOnboardingProgress();
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Check if Fathom is already connected
  const isConnected = integration?.is_active === true;

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      await connectFathom();
      
      // Wait a moment for the integration to be saved
      setTimeout(async () => {
        await markFathomConnected();
        toast.success('Fathom connected successfully!');
        setIsConnecting(false);
        onNext();
      }, 2000);
    } catch (error) {
      console.error('Error connecting Fathom:', error);
      toast.error('Failed to connect Fathom. Please try again.');
      setIsConnecting(false);
    }
  };

  // If already connected, mark it and allow proceeding
  useEffect(() => {
    if (isConnected && !isConnecting) {
      markFathomConnected().catch(console.error);
    }
  }, [isConnected, isConnecting, markFathomConnected]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#37bd7e] to-[#2da76c] mb-6"
        >
          {isConnected ? (
            <CheckCircle2 className="w-10 h-10 text-white" />
          ) : (
            <Video className="w-10 h-10 text-white" />
          )}
        </motion.div>
        <h1 className="text-4xl font-bold mb-4 text-white">
          Connect Your Fathom Account
        </h1>
        <p className="text-xl text-gray-400">
          Sync your meeting recordings automatically
        </p>
      </div>

      <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50 p-8 mb-8">
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-lg bg-[#37bd7e]/20 flex items-center justify-center flex-shrink-0 mt-1">
              <Video className="w-4 h-4 text-[#37bd7e]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">
                Automatic Meeting Sync
              </h3>
              <p className="text-sm text-gray-400">
                All your Fathom recordings will be automatically synced to your dashboard
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-lg bg-[#37bd7e]/20 flex items-center justify-center flex-shrink-0 mt-1">
              <CheckCircle2 className="w-4 h-4 text-[#37bd7e]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">
                Real-time Updates
              </h3>
              <p className="text-sm text-gray-400">
                New meetings appear in your dashboard as soon as they're recorded
              </p>
            </div>
          </div>
        </div>
      </div>

      {isConnected ? (
        <div className="bg-green-900/20 border border-green-800/50 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
              <div>
                <p className="text-green-400 font-medium">Fathom Connected</p>
                <p className="text-sm text-gray-400">
                  {integration?.fathom_user_email || 'Your account is connected'}
                </p>
              </div>
            </div>
            <button
              onClick={handleConnect}
              disabled={isConnecting || fathomLoading}
              className="px-3 py-1.5 text-xs bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded-lg transition-colors disabled:opacity-50"
            >
              {isConnecting || fathomLoading ? 'Reconnecting...' : 'Reconnect'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            💡 You can reconnect to test the integration or update your connection
          </p>
        </div>
      ) : (
        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-400" />
            <div>
              <p className="text-yellow-400 font-medium">Not Connected</p>
              <p className="text-sm text-gray-400">
                Connect your Fathom account to start syncing meetings
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 justify-center">
        <Button
          onClick={onBack}
          variant="ghost"
          className="text-gray-400 hover:text-white"
        >
          Back
        </Button>
        {!isConnected && (
          <Button
            onClick={handleConnect}
            disabled={isConnecting || fathomLoading}
            className="bg-[#37bd7e] hover:bg-[#2da76c] text-white px-8 py-6 text-lg"
          >
            {isConnecting || fathomLoading ? (
              <>
                <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect Fathom'
            )}
          </Button>
        )}
        {isConnected && (
          <Button
            onClick={onNext}
            className="bg-[#37bd7e] hover:bg-[#2da76c] text-white px-8 py-6 text-lg"
          >
            Continue
          </Button>
        )}
      </div>
    </motion.div>
  );
}

