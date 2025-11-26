import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFathomIntegration } from '@/lib/hooks/useFathomIntegration';
import { useOnboardingProgress } from '@/lib/hooks/useOnboardingProgress';
import { useAuth } from '@/lib/contexts/AuthContext';
import { supabase } from '@/lib/supabase/clientV2';

interface SyncProgressStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function SyncProgressStep({ onNext, onBack }: SyncProgressStepProps) {
  const { user } = useAuth();
  const { syncState, triggerSync } = useFathomIntegration();
  const { markFirstMeetingSynced } = useOnboardingProgress();
  const [meetingCount, setMeetingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Check for existing meetings
  useEffect(() => {
    if (!user) return;

    const checkMeetings = async () => {
      const { count } = await supabase
        .from('meetings')
        .select('*', { count: 'exact', head: true })
        .eq('owner_email', user.email || '');

      if (count && count > 0) {
        setMeetingCount(count);
        await markFirstMeetingSynced();
      }
    };

    checkMeetings();
  }, [user, markFirstMeetingSynced]);

  // Monitor sync state
  useEffect(() => {
    if (syncState?.sync_status === 'syncing') {
      setIsSyncing(true);
    } else if (syncState?.sync_status === 'idle' && syncState.meetings_synced > 0) {
      setIsSyncing(false);
      setMeetingCount(syncState.meetings_synced);
      markFirstMeetingSynced();
    }
  }, [syncState, markFirstMeetingSynced]);

  // Monitor for new meetings
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel('meetings_sync')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meetings',
          filter: `owner_email=eq.${user.email}`,
        },
        () => {
          // Increment count when new meeting is added
          setMeetingCount((prev) => {
            const newCount = prev + 1;
            if (newCount === 1) {
              markFirstMeetingSynced();
            }
            return newCount;
          });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user, markFirstMeetingSynced]);

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      await triggerSync();
    } catch (error) {
      console.error('Error triggering sync:', error);
    }
  };

  const hasMeetings = meetingCount > 0;

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
          {hasMeetings ? (
            <CheckCircle2 className="w-10 h-10 text-white" />
          ) : (
            <Loader2 className="w-10 h-10 text-white" />
          )}
        </motion.div>
        <h1 className="text-4xl font-bold mb-4 text-white">
          {isSyncing ? 'Syncing Your Meetings...' : hasMeetings ? 'Meetings Synced!' : 'Ready to Sync'}
        </h1>
        <p className="text-xl text-gray-400">
          {isSyncing
            ? 'We\'re fetching your meeting recordings'
            : hasMeetings
            ? `${meetingCount} meeting${meetingCount !== 1 ? 's' : ''} ready to analyze`
            : 'Click sync to fetch your meetings from Fathom'}
        </p>
      </div>

      <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl border border-gray-800/50 p-8 mb-8">
        {isSyncing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 text-[#37bd7e] animate-spin" />
              <span className="text-white">Syncing meetings...</span>
            </div>
            {syncState && (
              <div className="text-center text-sm text-gray-400">
                {syncState.meetings_synced > 0 && (
                  <p>{syncState.meetings_synced} meetings synced so far</p>
                )}
              </div>
            )}
          </div>
        ) : hasMeetings ? (
          <div className="text-center">
            <CheckCircle2 className="w-16 h-16 text-[#37bd7e] mx-auto mb-4" />
            <p className="text-white text-lg mb-2">
              {meetingCount} meeting{meetingCount !== 1 ? 's' : ''} found
            </p>
            <p className="text-gray-400 text-sm">
              Your meetings are ready to analyze
            </p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-gray-400 mb-6">
              No meetings found yet. Click the button below to sync your Fathom recordings.
            </p>
            <Button
              onClick={handleManualSync}
              className="bg-[#37bd7e] hover:bg-[#2da76c] text-white"
            >
              <RefreshCw className="mr-2 w-5 h-5" />
              Sync Meetings Now
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-4 justify-center">
        <Button
          onClick={onBack}
          variant="ghost"
          className="text-gray-400 hover:text-white"
        >
          Back
        </Button>
        {hasMeetings && (
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

