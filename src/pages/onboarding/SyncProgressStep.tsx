import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, RefreshCw, AlertCircle, Sparkles, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFathomIntegration } from '@/lib/hooks/useFathomIntegration';
import { useOnboardingProgress } from '@/lib/hooks/useOnboardingProgress';
import { useAuth } from '@/lib/contexts/AuthContext';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';

interface SyncProgressStepProps {
  onNext: () => void;
  onBack: () => void;
}

type SyncPhase = 'idle' | 'fast' | 'fast_complete' | 'background' | 'complete';

export function SyncProgressStep({ onNext, onBack }: SyncProgressStepProps) {
  const { user } = useAuth();
  const { triggerSync, loading: fathomLoading, isConnected } = useFathomIntegration();
  const { markFirstMeetingSynced } = useOnboardingProgress();
  const [meetingCount, setMeetingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);
  
  // Two-phase sync tracking
  const [syncPhase, setSyncPhase] = useState<SyncPhase>('idle');
  const [fastSyncCount, setFastSyncCount] = useState(0);
  const [backgroundSyncCount, setBackgroundSyncCount] = useState(0);
  const backgroundSyncRef = useRef<boolean>(false);

  // Check if Fathom is connected - use the hook's isConnected property
  const isFathomConnected = isConnected;

  // Check for existing meetings
  useEffect(() => {
    if (!user) return;

    const checkMeetings = async () => {
      const { count } = await supabase
        .from('meetings')
        .select('*', { count: 'exact', head: true })
        .eq('owner_user_id', user.id);

      if (count && count > 0) {
        setMeetingCount(count);
        setSyncComplete(true);
        await markFirstMeetingSynced();
      }
    };

    checkMeetings();
  }, [user, markFirstMeetingSynced]);


  // Phase 1: Fast sync - Get 3 meetings quickly for instant value
  const handleFastSync = async () => {
    try {
      setIsSyncing(true);
      setSyncPhase('fast');
      
      const result = await triggerSync({
        sync_type: 'onboarding_fast', // New sync type: only 3 meetings
        is_onboarding: true,
      });

      if (result?.success) {
        const count = result.meetings_synced || 0;
        setFastSyncCount(count);
        setMeetingCount(count);
        
        if (count > 0) {
          setSyncPhase('fast_complete');
          await markFirstMeetingSynced();
          toast.success(`${count} meeting${count !== 1 ? 's' : ''} ready to explore!`);
          
          // Start background sync automatically after a short delay
          setTimeout(() => {
            handleBackgroundSync();
          }, 1500);
        } else {
          toast.info('No meetings found in your Fathom account yet.');
          setSyncComplete(true);
          setSyncPhase('complete');
        }
      } else if (result?.error) {
        toast.error(`Sync issue: ${result.error}`);
        setSyncPhase('idle');
      } else {
        toast.error('Sync failed - no response from server');
        setSyncPhase('idle');
      }
    } catch (error) {
      toast.error(`Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setSyncPhase('idle');
    } finally {
      setIsSyncing(false);
    }
  };

  // Phase 2: Background sync - Get rest of last 30 days
  const handleBackgroundSync = async () => {
    // Prevent duplicate background syncs
    if (backgroundSyncRef.current) return;
    backgroundSyncRef.current = true;
    
    try {
      setSyncPhase('background');
      
      const result = await triggerSync({
        sync_type: 'onboarding_background', // Rest of 30-day history
        is_onboarding: true,
      });

      if (result?.success) {
        const additionalCount = result.meetings_synced || 0;
        setBackgroundSyncCount(additionalCount);
        setMeetingCount(prev => prev + additionalCount);
        
        if (additionalCount > 0) {
          toast.success(`${additionalCount} more meeting${additionalCount !== 1 ? 's' : ''} synced from your history!`, {
            description: 'AI analysis will process in the background',
          });
        }
      }
      // Don't show errors for background sync - it's non-critical
    } catch (error) {
      console.warn('[SyncProgressStep] Background sync error:', error);
    } finally {
      setSyncPhase('complete');
      setSyncComplete(true);
      backgroundSyncRef.current = false;
    }
  };
  
  // Legacy: Initial sync for backwards compatibility
  const handleInitialSync = handleFastSync;

  const hasMeetings = meetingCount > 0;

  // If Fathom is not connected, show skip option and allow continuing
  if (!fathomLoading && !isFathomConnected) {
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
            <CheckCircle2 className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold mb-4 text-white">
            Connect Fathom Later
          </h1>
          <p className="text-lg text-gray-400">
            You can connect your Fathom account anytime from Settings to sync your meeting recordings.
          </p>
        </div>

        <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50 p-6 mb-8">
          <p className="text-gray-300 text-center">
            No worries! You can connect Fathom later from the Integrations page to start syncing your meetings.
          </p>
        </div>

        <div className="flex gap-4 justify-center">
          <Button
            onClick={onBack}
            variant="ghost"
            className="text-gray-400 hover:text-white"
          >
            Back
          </Button>
          <Button
            onClick={async () => {
              await markFirstMeetingSynced();
              onNext();
            }}
            className="bg-[#37bd7e] hover:bg-[#2da76c] text-white px-8"
          >
            Continue
          </Button>
        </div>
      </motion.div>
    );
  }

  // Show loading state while checking Fathom connection
  if (fathomLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="w-full max-w-2xl mx-auto"
      >
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#37bd7e] animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Checking Fathom connection...</p>
        </div>
      </motion.div>
    );
  }

  // If Fathom is not connected, allow user to skip and continue
  if (!isFathomConnected) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="w-full max-w-2xl mx-auto"
      >

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="text-center mb-8">
        <motion.div
          animate={{ rotate: isSyncing ? 360 : 0 }}
          transition={{ duration: 2, repeat: isSyncing ? Infinity : 0, ease: 'linear' }}
          className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-[#37bd7e] to-[#2da76c] mb-6"
        >
          {syncComplete ? (
            <CheckCircle2 className="w-10 h-10 text-white" />
          ) : isSyncing ? (
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          ) : (
            <RefreshCw className="w-10 h-10 text-white" />
          )}
        </motion.div>
        <h1 className="text-4xl font-bold mb-4 text-white">
          {syncPhase === 'fast' ? 'Quick Sync...' 
            : syncPhase === 'fast_complete' ? 'Almost Ready!' 
            : syncPhase === 'background' ? 'Syncing History...'
            : syncComplete ? 'Meetings Ready!'
            : 'Ready to Sync'}
        </h1>
        <p className="text-xl text-gray-400">
          {syncPhase === 'fast' 
            ? 'Getting your most recent meetings'
            : syncPhase === 'fast_complete'
            ? 'Starting background history sync...'
            : syncPhase === 'background'
            ? `${fastSyncCount} ready, syncing more...`
            : syncComplete
            ? `${meetingCount} meeting${meetingCount !== 1 ? 's' : ''} ready to analyze`
            : 'Get instant value with fast sync'}
        </p>
      </div>

      <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50 p-8 mb-8">
        {/* Phase 1: Fast sync in progress */}
        {syncPhase === 'fast' && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Zap className="w-6 h-6 text-amber-400 animate-pulse" />
              <span className="text-white">Quick sync: Getting your recent meetings...</span>
            </div>
            <p className="text-center text-xs text-gray-500">
              Just a few seconds – we're grabbing your most recent meetings for instant value.
            </p>
          </div>
        )}
        
        {/* Phase 1 complete, Phase 2 starting */}
        {syncPhase === 'fast_complete' && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-[#37bd7e]" />
              <span className="text-white">{fastSyncCount} meetings ready!</span>
            </div>
            <p className="text-center text-xs text-gray-500">
              Starting background sync for your full 30-day history...
            </p>
          </div>
        )}
        
        {/* Phase 2: Background sync in progress */}
        {syncPhase === 'background' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#37bd7e]" />
                <span className="text-white">{fastSyncCount} meetings ready to explore</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Syncing more from your history...</span>
              </div>
            </div>
            <p className="text-center text-xs text-gray-500">
              You can continue to the dashboard – we'll sync the rest in the background.
            </p>
          </div>
        )}
        
        {/* Complete */}
        {syncPhase === 'complete' && syncComplete && (
          <div className="text-center">
            <CheckCircle2 className="w-12 h-12 text-[#37bd7e] mx-auto mb-3" />
            <p className="text-white text-lg mb-1">
              {meetingCount > 0
                ? `${meetingCount} meeting${meetingCount !== 1 ? 's' : ''} synced successfully!`
                : 'Sync complete!'}
            </p>
            {backgroundSyncCount > 0 && (
              <p className="text-emerald-400 text-sm mb-2">
                <Sparkles className="inline w-4 h-4 mr-1" />
                Includes {backgroundSyncCount} from your 30-day history
              </p>
            )}
            <p className="text-gray-400 text-sm">
              {meetingCount > 0
                ? 'AI analysis is processing in the background. Start exploring!'
                : 'No meetings found yet. Sync more from the Meetings page later.'}
            </p>
          </div>
        )}
        
        {/* Idle / Not started */}
        {syncPhase === 'idle' && !syncComplete && (
          <div className="text-center">
            <p className="text-gray-400 mb-6">
              We'll quickly sync your <span className="text-white font-medium">most recent meetings</span> first, then grab your full 30-day history in the background.
            </p>
            <Button
              onClick={handleFastSync}
              className="bg-[#37bd7e] hover:bg-[#2da76c] text-white"
              disabled={isSyncing}
            >
              <Zap className="mr-2 w-5 h-5" />
              Start Fast Sync
            </Button>
            <p className="text-xs text-gray-500 mt-4 flex items-center justify-center gap-2">
              <Clock className="w-3 h-3" />
              Takes just a few seconds
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-4 justify-center">
        <Button
          onClick={onBack}
          variant="ghost"
          className="text-gray-400 hover:text-white"
          disabled={isSyncing || syncPhase === 'fast'}
        >
          Back
        </Button>
        {/* Allow continuing once fast sync is done (during background or complete) */}
        {(syncPhase === 'background' || syncPhase === 'complete' || syncComplete) && (
          <Button
            onClick={onNext}
            className="bg-[#37bd7e] hover:bg-[#2da76c] text-white px-8 py-6 text-lg"
          >
            {syncPhase === 'background' ? 'Continue (Syncing in Background)' : 'Continue to Dashboard'}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

