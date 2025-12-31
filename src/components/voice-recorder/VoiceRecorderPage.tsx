import { useState, useCallback } from 'react';
import { Mic } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useVoiceRecorder } from './useVoiceRecorder';
import { VoiceRecorderHome, SAMPLE_RECENT_RECORDINGS } from './VoiceRecorderHome';
import { VoiceRecorderRecording } from './VoiceRecorderRecording';
import {
  VoiceRecorderMeetingDetail,
  SAMPLE_MEETING,
} from './VoiceRecorderMeetingDetail';
import type { RecordingScreen, VoiceRecording, ActionItem } from './types';

interface VoiceRecorderPageProps {
  className?: string;
}

/**
 * VoiceRecorderPage - Main container for the voice recorder feature
 * Manages screen state and coordinates between home, recording, and detail views
 */
export function VoiceRecorderPage({ className }: VoiceRecorderPageProps) {
  const [screen, setScreen] = useState<RecordingScreen>('home');
  const [currentMeeting, setCurrentMeeting] = useState<VoiceRecording | null>(null);

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

  // Handle start recording
  const handleStartRecording = useCallback(async () => {
    try {
      await startRecording();
      setScreen('recording');
    } catch (err) {
      toast.error('Failed to start recording. Please check microphone permissions.');
    }
  }, [startRecording]);

  // Handle stop recording
  const handleStopRecording = useCallback(() => {
    stopRecording();
    // In a real app, we would process the recording and create a meeting object
    // For now, we use sample data
    setCurrentMeeting({
      ...SAMPLE_MEETING,
      id: `recording-${Date.now()}`,
      date: new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
      duration: formatDuration(duration),
      createdAt: new Date(),
    });
    setScreen('meeting');
    toast.success('Recording saved! Processing with AI...');
  }, [stopRecording, duration]);

  // Handle selecting a recent recording
  const handleSelectRecording = useCallback((id: string) => {
    // In a real app, we would fetch the recording data
    // For now, we use sample data
    setCurrentMeeting({
      ...SAMPLE_MEETING,
      id,
    });
    setScreen('meeting');
  }, []);

  // Handle going back to home
  const handleBack = useCallback(() => {
    setScreen('home');
    setCurrentMeeting(null);
  }, []);

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
    toast.info('Full transcript view coming soon!');
  }, []);

  // Handle toggle action item
  const handleToggleActionItem = useCallback((actionId: string) => {
    if (!currentMeeting) return;

    setCurrentMeeting((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        actions: prev.actions.map((action: ActionItem) =>
          action.id === actionId ? { ...action, done: !action.done } : action
        ),
      };
    });
  }, [currentMeeting]);

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

      {/* Voice Recorder Container - responsive width */}
      <div className="max-w-lg mx-auto lg:mx-0">
        <div className="bg-white dark:bg-gray-900/80 dark:backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none overflow-hidden min-h-[600px]">
          {/* Home Screen */}
          {screen === 'home' && (
            <VoiceRecorderHome
              recentRecordings={SAMPLE_RECENT_RECORDINGS}
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
    </div>
  );
}

// Helper to format duration from seconds
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export default VoiceRecorderPage;
