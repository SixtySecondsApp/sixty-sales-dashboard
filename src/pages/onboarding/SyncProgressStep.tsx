import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
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

export function SyncProgressStep({ onNext, onBack }: SyncProgressStepProps) {
  const { user } = useAuth();
  const { triggerSync, loading: fathomLoading, isConnected } = useFathomIntegration();
  const { markFirstMeetingSynced } = useOnboardingProgress();
  const [meetingCount, setMeetingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);

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


  // Initial sync - sync 10 recent meetings
  const handleInitialSync = async () => {
    try {
      setIsSyncing(true);
      const result = await triggerSync({
        sync_type: 'manual',
        limit: 10
      });

      if (result?.success) {
        const count = result.meetings_synced || 0;

        if (count > 0) {
          setMeetingCount(count);
          setSyncComplete(true);
          await markFirstMeetingSynced();
          toast.success(`Synced ${count} meeting${count !== 1 ? 's' : ''}!`);
        } else {
          toast.info('No meetings found in your Fathom account yet.');
          setSyncComplete(true); // Still allow continuing even with 0 meetings
        }
      } else if (result?.error) {
        toast.error(`Sync issue: ${result.error}`);
      } else {
        toast.error('Sync failed - no response from server');
      }
    } catch (error) {
      toast.error(`Failed to sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const hasMeetings = meetingCount > 0;

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

  // If Fathom is not connected, show message and redirect back
  if (!isFathomConnected) {
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
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500 to-yellow-600 mb-6"
          >
            <AlertCircle className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-4xl font-bold mb-4 text-white">
            Fathom Not Connected
          </h1>
          <p className="text-xl text-gray-400">
            Please connect your Fathom account first to sync meetings
          </p>
        </div>

        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-yellow-400 font-medium">Connection Required</p>
              <p className="text-sm text-gray-400">
                Go back to the previous step to connect your Fathom account before syncing meetings.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <Button
            onClick={onBack}
            className="bg-[#37bd7e] hover:bg-[#2da76c] text-white px-8 py-6 text-lg"
          >
            Back to Connect Fathom
          </Button>
        </div>
      </motion.div>
    );
  }

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
          {isSyncing ? 'Syncing Your Meetings...' : syncComplete ? 'Meetings Synced!' : 'Ready to Sync'}
        </h1>
        <p className="text-xl text-gray-400">
          {isSyncing
            ? 'Fetching your recent meeting recordings'
            : syncComplete
            ? `${meetingCount} meeting${meetingCount !== 1 ? 's' : ''} ready to analyze`
            : 'Click sync to fetch your meetings from Fathom'}
        </p>
      </div>

      <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50 p-8 mb-8">
        {isSyncing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 text-[#37bd7e] animate-spin" />
              <span className="text-white">Syncing your recent meetings...</span>
            </div>
            <p className="text-center text-xs text-gray-500">
              This may take a moment. Transcripts and AI analysis will process in the background.
            </p>
          </div>
        ) : syncComplete ? (
          <div className="text-center">
            <CheckCircle2 className="w-12 h-12 text-[#37bd7e] mx-auto mb-3" />
            <p className="text-white text-lg mb-1">
              {meetingCount > 0
                ? `${meetingCount} meeting${meetingCount !== 1 ? 's' : ''} synced successfully!`
                : 'Sync complete!'}
            </p>
            <p className="text-gray-400 text-sm">
              {meetingCount > 0
                ? 'You can sync more meetings from the Meetings page after completing setup.'
                : 'No meetings found yet. You can sync more from the Meetings page later.'}
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-gray-400 mb-6">
              Let's sync your <span className="text-white font-medium">10 most recent meetings</span> to get started.
            </p>
            <Button
              onClick={handleInitialSync}
              className="bg-[#37bd7e] hover:bg-[#2da76c] text-white"
            >
              <RefreshCw className="mr-2 w-5 h-5" />
              Sync Recent Meetings
            </Button>
            <p className="text-xs text-gray-500 mt-4">
              This will only take a moment.
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-4 justify-center">
        <Button
          onClick={onBack}
          variant="ghost"
          className="text-gray-400 hover:text-white"
          disabled={isSyncing}
        >
          Back
        </Button>
        {syncComplete && (
          <Button
            onClick={onNext}
            className="bg-[#37bd7e] hover:bg-[#2da76c] text-white px-8 py-6 text-lg"
          >
            Continue to Dashboard
          </Button>
        )}
      </div>
    </motion.div>
  );
}

