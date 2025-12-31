import { useState, useCallback } from 'react';
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
    <div
      className={cn(
        'min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100',
        className
      )}
    >
      {/* Mobile-first container */}
      <div className="max-w-md mx-auto min-h-screen relative overflow-hidden shadow-2xl">
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
