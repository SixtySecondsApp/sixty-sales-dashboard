import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Video, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFathomIntegration } from '@/lib/hooks/useFathomIntegration';
import { useOnboardingProgress } from '@/lib/hooks/useOnboardingProgress';
import { useAuth } from '@/lib/contexts/AuthContext';
import { supabase } from '@/lib/supabase/clientV2';
import { useOrgStore } from '@/lib/stores/orgStore';
import { toast } from 'sonner';

interface FathomConnectionStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function FathomConnectionStep({ onNext, onBack }: FathomConnectionStepProps) {
  const { user } = useAuth();
  const activeOrgId = useOrgStore((s) => s.activeOrgId);
  const { integration, connectFathom, loading: fathomLoading, canManage } = useFathomIntegration();
  const { markFathomConnected } = useOnboardingProgress();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);

  // Check if Fathom is already connected
  const isConnected = integration?.is_active === true;

  // Poll for connection status after OAuth popup
  const pollForConnection = useCallback(async () => {
    if (!user || !activeOrgId) return false;

    const { data } = await (supabase as any)
      .from('fathom_org_integrations')
      .select('*')
      .eq('org_id', activeOrgId)
      .eq('is_active', true)
      .maybeSingle();

    return data !== null;
  }, [user, activeOrgId]);

  const startPolling = useCallback(() => {
    setIsPolling(true);
    pollCountRef.current = 0;

    // Poll every 1 second for up to 30 seconds
    pollingRef.current = setInterval(async () => {
      pollCountRef.current += 1;

      const connected = await pollForConnection();

      if (connected) {
        // Connection found!
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setIsPolling(false);
        setIsConnecting(false);
        
        // Mark as connected in onboarding progress
        await markFathomConnected();
        
        // Small delay to ensure UI updates before showing success
        await new Promise(resolve => setTimeout(resolve, 500));
        
        toast.success('Fathom connected successfully!');
        
        // Small delay before proceeding to next step
        setTimeout(() => {
          onNext();
        }, 1000);
        return;
      }

      // Stop polling after 30 seconds
      if (pollCountRef.current >= 30) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setIsPolling(false);
        setIsConnecting(false);
        toast.error('Connection timeout. Please check if you completed the authorization.');
        // Don't show error - user can still try again or check manually
      }
    }, 1000);
  }, [pollForConnection, markFathomConnected, onNext]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      if (!canManage) {
        throw new Error('Only organization owners/admins can connect Fathom during onboarding.')
      }
      await connectFathom();

      // Start polling for connection status
      startPolling();
    } catch (error) {
      console.error('Error connecting Fathom:', error);
      toast.error('Failed to connect Fathom. Please try again.');
      setIsConnecting(false);
    }
  };

  // If already connected, mark it and allow proceeding
  useEffect(() => {
    if (isConnected && !isConnecting && !isPolling) {
      markFathomConnected().catch(console.error);
    }
  }, [isConnected, isConnecting, isPolling, markFathomConnected]);

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
          className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${
            isConnected 
              ? 'bg-gradient-to-br from-[#37bd7e] to-[#2da76c]'
              : isConnecting || isPolling
              ? 'bg-gradient-to-br from-blue-500 to-blue-600'
              : 'bg-gradient-to-br from-[#37bd7e] to-[#2da76c]'
          }`}
        >
          {isConnected ? (
            <CheckCircle2 className="w-10 h-10 text-white" />
          ) : isConnecting || isPolling ? (
            <Loader2 className="w-10 h-10 text-white animate-spin" />
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
      ) : isConnecting || isPolling ? (
        <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            <div className="flex-1">
              <p className="text-blue-400 font-medium">
                {isPolling ? 'Waiting for connection...' : 'Connecting to Fathom...'}
              </p>
              <p className="text-sm text-gray-400">
                {isPolling 
                  ? 'Please complete the authorization in the popup window. This may take a few seconds...'
                  : 'Opening Fathom authorization window...'}
              </p>
            </div>
          </div>
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
            disabled={isConnecting || fathomLoading || isPolling}
            className="bg-[#37bd7e] hover:bg-[#2da76c] text-white px-8 py-6 text-lg"
          >
            {isPolling ? (
              <>
                <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                Waiting for connection...
              </>
            ) : isConnecting || fathomLoading ? (
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

