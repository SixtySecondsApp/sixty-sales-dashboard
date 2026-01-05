import { useState, useCallback, useMemo } from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useVoiceRecorder } from './useVoiceRecorder';
import { VoiceRecorderHome } from './VoiceRecorderHome';
import { VoiceRecorderRecording } from './VoiceRecorderRecording';
import { VoiceRecorderMeetingDetail } from './VoiceRecorderMeetingDetail';
import { TranscriptModal } from './TranscriptModal';
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
  const [currentRecordingType, setCurrentRecordingType] = useState<RecordingType>('meeting');
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  // Backend integration
  const {
    recordings,
    isLoading: isLoadingRecordings,
    uploadAndTranscribe,
    deleteRecording,
    toggleActionItem,
    getRecording,
    refetch,
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
      setCurrentRecordingType(type);
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

    const actions: ActionItem[] = (rec.action_items || []).map((a: { id: string; text: string; owner?: string; deadline?: string; done?: boolean }) => ({
      id: a.id,
      text: a.text,
      owner: a.owner || 'Unassigned',
      deadline: a.deadline || '',
      done: a.done || false,
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
      durationSeconds: rec.duration_seconds || 0,
      speakers,
      actions,
      summary: rec.summary || 'Processing transcription...',
      transcript: (rec.transcript_segments || []).map((seg: { speaker: string; start_time: number; end_time?: number; text: string }) => ({
        speaker: seg.speaker,
        time: formatDurationDisplay(Math.floor(seg.start_time)),
        text: seg.text,
        start_time: seg.start_time,
        end_time: seg.end_time,
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

      // Upload and start transcription with recording type
      const recording = await uploadAndTranscribe(audioBlob, undefined, currentRecordingType);

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
  }, [stopRecording, uploadAndTranscribe, transformRecording, currentRecordingType]);

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
    toast.info('Share feature coming soon!');
  }, []);

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
    setIsTranscriptOpen(true);
  }, []);

  // Handle seeking in transcript
  const handleTranscriptSeek = useCallback((time: number) => {
    if (currentMeeting?.durationSeconds) {
      setPlaybackProgress(time / currentMeeting.durationSeconds);
    }
    // In a real implementation, this would seek the audio player
    toast.info(`Seek to ${formatDurationDisplay(Math.floor(time))}`);
  }, [currentMeeting?.durationSeconds]);

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
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Voice</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Record meetings, get AI summaries and action items.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voice Recorder Container - responsive width, wider on desktop */}
      <div className={cn(
        'mx-auto lg:mx-0',
        // Home screen uses narrower layout for mobile-first recorder UI
        screen === 'home' ? 'max-w-lg' : 'max-w-4xl'
      )}>
        <div className={cn(
          'relative bg-white dark:bg-gray-900/80 dark:backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none overflow-hidden',
          screen === 'meeting' ? 'min-h-[700px]' : 'min-h-[600px]'
        )}>
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
            />
          )}
        </div>
      </div>

      {/* Transcript Modal */}
      {currentMeeting && (
        <TranscriptModal
          open={isTranscriptOpen}
          onOpenChange={setIsTranscriptOpen}
          title={currentMeeting.title}
          speakers={currentMeeting.speakers}
          transcript={currentMeeting.transcript.map((seg) => ({
            speaker: seg.speaker,
            text: seg.text,
            time: seg.time,
            start_time: seg.start_time || 0,
            end_time: seg.end_time || 0,
          }))}
          currentTime={playbackProgress * (currentMeeting.durationSeconds || 0)}
          onSeek={handleTranscriptSeek}
        />
      )}
    </div>
  );
}

export default VoiceRecorderPage;
