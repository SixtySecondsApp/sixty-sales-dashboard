import { useState, useCallback, useMemo } from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useVoiceRecorder } from './useVoiceRecorder';
import { VoiceRecorderHome } from './VoiceRecorderHome';
import { VoiceRecorderRecording } from './VoiceRecorderRecording';
import { VoiceRecorderMeetingDetail } from './VoiceRecorderMeetingDetail';
import { ShareRecordingDialog } from './ShareRecordingDialog';
import { useVoiceRecordings } from '@/lib/hooks/useVoiceRecordings';
import type { RecordingScreen, VoiceRecording, ActionItem, RecentRecording, Speaker, RecordingType } from './types';

interface VoiceRecorderPageProps {
  className?: string;
}

/**
 * VoiceRecorderPage - Main container for the voice recorder feature
 * Manages screen state and coordinates between home, recording, and detail views
 */
// Helper to format duration from seconds for display
function formatDurationDisplay(seconds: number | null | undefined): string {
  if (!seconds) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Speaker colors for display
const SPEAKER_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function VoiceRecorderPage({ className }: VoiceRecorderPageProps) {
  const [screen, setScreen] = useState<RecordingScreen>('home');
  const [currentMeeting, setCurrentMeeting] = useState<VoiceRecording | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedRecordingType, setSelectedRecordingType] = useState<RecordingType>('meeting');
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Backend integration
  const {
    recordings,
    isLoading: isLoadingRecordings,
    uploadAndTranscribe,
    deleteRecording,
    toggleActionItem,
    addActionItemToTask,
    getRecording,
    refetch,
    retryTranscription,
  } = useVoiceRecordings();

  const {
    isRecording,
    duration,
    audioLevel,
    isPaused,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useVoiceRecorder();

  // Transform backend recordings to RecentRecording format for the home screen
  const recentRecordings: RecentRecording[] = useMemo(() => {
    return recordings.map((rec) => ({
      id: rec.id,
      title: rec.title,
      time: new Date(rec.created_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
      duration: formatDurationDisplay(rec.duration_seconds),
      actionsCount: rec.action_items?.length || 0,
      recordingType: rec.recording_type || 'meeting',
    }));
  }, [recordings]);

  // Handle start recording
  const handleStartRecording = useCallback(async (type: RecordingType) => {
    try {
      setSelectedRecordingType(type);
      await startRecording();
      setScreen('recording');
    } catch (err) {
      toast.error('Failed to start recording. Please check microphone permissions.');
    }
  }, [startRecording]);

  // Helper to transform backend recording to VoiceRecording format
  const transformRecording = useCallback((rec: Awaited<ReturnType<typeof getRecording>>): VoiceRecording | null => {
    if (!rec) return null;

    const speakers: Speaker[] = (rec.speakers || []).map((s: { id: number; name: string; initials?: string }, idx: number) => ({
      id: s.id,
      name: s.name,
      initials: s.initials || s.name.substring(0, 2).toUpperCase(),
      duration: '', // Will be calculated from segments if needed
      color: SPEAKER_COLORS[idx % SPEAKER_COLORS.length],
    }));

    const actions: ActionItem[] = (rec.action_items || []).map((a: { id: string; text: string; owner?: string; deadline?: string; done?: boolean; priority?: 'high' | 'medium' | 'low'; category?: string; linkedTaskId?: string }) => ({
      id: a.id,
      text: a.text,
      owner: a.owner || 'Unassigned',
      deadline: a.deadline || '',
      done: a.done || false,
      priority: a.priority,
      category: a.category as ActionItem['category'],
      linkedTaskId: a.linkedTaskId,
    }));

    return {
      id: rec.id,
      title: rec.title,
      date: new Date(rec.created_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
      duration: formatDurationDisplay(rec.duration_seconds),
      speakers,
      actions,
      summary: rec.summary || 'Processing transcription...',
      transcript: (rec.transcript_segments || []).map((seg: { speaker: string; start_time: number; text: string }) => ({
        speaker: seg.speaker,
        time: formatDurationDisplay(Math.floor(seg.start_time)),
        text: seg.text,
      })),
      createdAt: new Date(rec.created_at),
      audioUrl: rec.audio_url,
      recordingType: rec.recording_type || 'meeting',
    };
  }, []);

  // Handle stop recording
  const handleStopRecording = useCallback(async () => {
    setIsProcessing(true);
    try {
      const audioBlob = await stopRecording();
      if (!audioBlob) {
        toast.error('No audio recorded');
        setIsProcessing(false);
        return;
      }

      // Upload and start transcription with selected type
      const recording = await uploadAndTranscribe(audioBlob, undefined, selectedRecordingType);

      if (recording) {
        const transformed = transformRecording(recording);
        if (transformed) {
          setCurrentMeeting(transformed);
          setScreen('meeting');
        }
      } else {
        // If upload failed, go back to home
        setScreen('home');
      }
    } catch (err) {
      console.error('Stop recording error:', err);
      toast.error('Failed to process recording');
      setScreen('home');
    } finally {
      setIsProcessing(false);
    }
  }, [stopRecording, uploadAndTranscribe, transformRecording, selectedRecordingType]);

  // Handle selecting a recent recording
  const handleSelectRecording = useCallback(async (id: string) => {
    setIsProcessing(true);
    try {
      const recording = await getRecording(id);
      if (recording) {
        const transformed = transformRecording(recording);
        if (transformed) {
          setCurrentMeeting(transformed);
          setScreen('meeting');
        }
      } else {
        toast.error('Recording not found');
      }
    } catch (err) {
      console.error('Error fetching recording:', err);
      toast.error('Failed to load recording');
    } finally {
      setIsProcessing(false);
    }
  }, [getRecording, transformRecording]);

  // Handle going back to home
  const handleBack = useCallback(() => {
    setScreen('home');
    setCurrentMeeting(null);
    refetch(); // Refresh the recordings list
  }, [refetch]);

  // Handle sharing
  const handleShare = useCallback(() => {
    if (currentMeeting) {
      setShowShareDialog(true);
    }
  }, [currentMeeting]);

  // Handle draft follow-up
  const handleDraftFollowUp = useCallback(() => {
    toast.info('Opening AI email composer...');
  }, []);

  // Handle book next call
  const handleBookNextCall = useCallback(() => {
    toast.info('Opening calendar...');
  }, []);

  // Handle view transcript
  const handleViewTranscript = useCallback(() => {
    toast.info('Full transcript view coming soon!');
  }, []);

  // Handle retry transcription
  const handleRetryTranscription = useCallback(async () => {
    if (!currentMeeting) return;

    const success = await retryTranscription(currentMeeting.id);
    if (success) {
      // Refresh the current meeting data
      const updated = await getRecording(currentMeeting.id);
      if (updated) {
        // Transform the updated recording
        const transformed = transformRecording(updated);
        if (transformed) {
          setCurrentMeeting(transformed);
        }
      }
    }
  }, [currentMeeting, retryTranscription, getRecording]);

  // Handle toggle action item
  const handleToggleActionItem = useCallback(async (actionId: string) => {
    if (!currentMeeting) return;

    // Optimistically update local state
    setCurrentMeeting((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        actions: prev.actions.map((action: ActionItem) =>
          action.id === actionId ? { ...action, done: !action.done } : action
        ),
      };
    });

    // Sync with backend
    const success = await toggleActionItem(currentMeeting.id, actionId);
    if (!success) {
      // Revert on failure
      setCurrentMeeting((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          actions: prev.actions.map((action: ActionItem) =>
            action.id === actionId ? { ...action, done: !action.done } : action
          ),
        };
      });
    }
  }, [currentMeeting, toggleActionItem]);

  // Handle adding action item to tasks
  const handleAddActionItemToTasks = useCallback(async (actionId: string) => {
    if (!currentMeeting) {
      return { success: false, error: 'No meeting selected' };
    }

    const result = await addActionItemToTask(currentMeeting.id, actionId);

    if (result.success && result.taskId) {
      // Update local state with the linked task ID
      setCurrentMeeting((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          actions: prev.actions.map((action: ActionItem) =>
            action.id === actionId
              ? { ...action, linkedTaskId: result.taskId }
              : action
          ),
        };
      });
    }

    return result;
  }, [currentMeeting, addActionItemToTask]);

  // Show error if recording failed
  if (error) {
    toast.error(error);
  }

  return (
    <div className={cn('max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8', className)}>
      {/* Page Header - only show on home screen */}
      {screen === 'home' && (
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Mic className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Voice Notes</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Record meetings, get AI summaries and action items.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voice Recorder Container - full width on desktop */}
      <div className="w-full">
        <div className="relative bg-white dark:bg-gray-900/80 dark:backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none overflow-hidden min-h-[600px]">
          {/* Loading Overlay */}
          {(isProcessing || isLoadingRecordings) && screen === 'home' && (
            <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-[#37bd7e]" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Loading...</span>
              </div>
            </div>
          )}

          {/* Home Screen */}
          {screen === 'home' && (
            <VoiceRecorderHome
              recentRecordings={recentRecordings}
              onStartRecording={handleStartRecording}
              onSelectRecording={handleSelectRecording}
            />
          )}

          {/* Recording Screen */}
          {screen === 'recording' && (
            <VoiceRecorderRecording
              duration={duration}
              audioLevel={audioLevel}
              isPaused={isPaused}
              onStop={handleStopRecording}
              onPause={pauseRecording}
              onResume={resumeRecording}
            />
          )}

          {/* Meeting Detail Screen */}
          {screen === 'meeting' && currentMeeting && (
            <VoiceRecorderMeetingDetail
              recording={currentMeeting}
              onBack={handleBack}
              onShare={handleShare}
              onDraftFollowUp={handleDraftFollowUp}
              onBookNextCall={handleBookNextCall}
              onViewTranscript={handleViewTranscript}
              onToggleActionItem={handleToggleActionItem}
              onAddActionItemToTasks={handleAddActionItemToTasks}
              onRetryTranscription={handleRetryTranscription}
            />
          )}
        </div>
      </div>

      {/* Share Recording Dialog */}
      {currentMeeting && (
        <ShareRecordingDialog
          open={showShareDialog}
          onOpenChange={setShowShareDialog}
          recordingId={currentMeeting.id}
          recordingTitle={currentMeeting.title}
        />
      )}
    </div>
  );
}

export default VoiceRecorderPage;
