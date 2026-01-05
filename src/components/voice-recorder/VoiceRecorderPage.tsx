import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useVoiceRecorder } from './useVoiceRecorder';
import { VoiceRecorderHome } from './VoiceRecorderHome';
import { VoiceRecorderRecording } from './VoiceRecorderRecording';
import { useVoiceRecordings } from '@/lib/hooks/useVoiceRecordings';
import type { RecentRecording, RecordingType } from './types';

interface VoiceRecorderPageProps {
  className?: string;
}

/**
 * VoiceRecorderPage - Main container for the voice recorder feature
 * Manages home and recording screens. Detail views are handled by /voice/:recordingId route.
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

export function VoiceRecorderPage({ className }: VoiceRecorderPageProps) {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<'home' | 'recording'>('home');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentRecordingType, setCurrentRecordingType] = useState<RecordingType>('meeting');

  // Backend integration
  const {
    recordings,
    isLoading: isLoadingRecordings,
    uploadAndTranscribe,
  } = useVoiceRecordings();

  const {
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

  // Handle stop recording - navigates to detail page after upload
  const handleStopRecording = useCallback(async () => {
    setIsProcessing(true);
    try {
      const audioBlob = await stopRecording();
      if (!audioBlob) {
        toast.error('No audio recorded');
        setIsProcessing(false);
        setScreen('home');
        return;
      }

      // Upload and start transcription with recording type
      const recording = await uploadAndTranscribe(audioBlob, undefined, currentRecordingType);

      if (recording) {
        // Navigate to the detail page
        navigate(`/voice/${recording.id}`);
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
  }, [stopRecording, uploadAndTranscribe, currentRecordingType, navigate]);

  // Handle selecting a recent recording - navigates to detail page
  const handleSelectRecording = useCallback((id: string) => {
    navigate(`/voice/${id}`);
  }, [navigate]);

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

      {/* Voice Recorder Container - full width to match other screens */}
      <div className="w-full">
        <div className={cn(
          'relative bg-white dark:bg-gray-900/80 dark:backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none overflow-hidden',
          'min-h-[600px]'
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
        </div>
      </div>
    </div>
  );
}

export default VoiceRecorderPage;
