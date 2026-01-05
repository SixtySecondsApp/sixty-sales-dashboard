import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import { Loader2, Mic } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useVoiceRecordings } from '@/lib/hooks/useVoiceRecordings';
import { VoiceRecorderMeetingDetail } from '@/components/voice-recorder/VoiceRecorderMeetingDetail';
import { VoiceNoteDetail } from '@/components/voice-recorder/VoiceNoteDetail';
import { TranscriptModal } from '@/components/voice-recorder/TranscriptModal';
import { VoiceShareDialog } from '@/components/voice-recorder/VoiceShareDialog';
import type { VoiceRecording, ActionItem, Speaker } from '@/components/voice-recorder/types';

// Speaker colors for display
const SPEAKER_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

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

/**
 * VoiceRecordingDetailPage - Standalone page for viewing a voice recording
 * Accessed via /voice/:recordingId
 */
export default function VoiceRecordingDetailPage() {
  const { recordingId } = useParams<{ recordingId: string }>();
  const navigate = useNavigate();
  const [recording, setRecording] = useState<VoiceRecording | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const { getRecording, toggleActionItem } = useVoiceRecordings();

  // Transform backend recording to VoiceRecording format
  const transformRecording = useCallback((rec: Awaited<ReturnType<typeof getRecording>>): VoiceRecording | null => {
    if (!rec) return null;

    const speakers: Speaker[] = (rec.speakers || []).map((s: { id: number; name: string; initials?: string }, idx: number) => ({
      id: s.id,
      name: s.name,
      initials: s.initials || s.name.substring(0, 2).toUpperCase(),
      duration: '',
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

  // Load recording on mount
  useEffect(() => {
    async function loadRecording() {
      if (!recordingId) {
        toast.error('No recording ID provided');
        navigate('/voice');
        return;
      }

      setIsLoading(true);
      try {
        const rec = await getRecording(recordingId);
        if (rec) {
          const transformed = transformRecording(rec);
          setRecording(transformed);
        } else {
          toast.error('Recording not found');
          navigate('/voice');
        }
      } catch (err) {
        console.error('Error loading recording:', err);
        toast.error('Failed to load recording');
        navigate('/voice');
      } finally {
        setIsLoading(false);
      }
    }

    loadRecording();
  }, [recordingId, getRecording, transformRecording, navigate]);

  // Handle going back to home
  const handleBack = useCallback(() => {
    navigate('/voice');
  }, [navigate]);

  // Handle sharing
  const handleShare = useCallback(() => {
    setIsShareDialogOpen(true);
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
    if (recording?.durationSeconds) {
      setPlaybackProgress(time / recording.durationSeconds);
    }
    toast.info(`Seek to ${formatDurationDisplay(Math.floor(time))}`);
  }, [recording?.durationSeconds]);

  // Handle toggle action item
  const handleToggleActionItem = useCallback(async (actionId: string) => {
    if (!recording) return;

    // Optimistically update local state
    setRecording((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        actions: prev.actions.map((action: ActionItem) =>
          action.id === actionId ? { ...action, done: !action.done } : action
        ),
      };
    });

    // Sync with backend
    const success = await toggleActionItem(recording.id, actionId);
    if (!success) {
      // Revert on failure
      setRecording((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          actions: prev.actions.map((action: ActionItem) =>
            action.id === actionId ? { ...action, done: !action.done } : action
          ),
        };
      });
    }
  }, [recording, toggleActionItem]);

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full">
          <div className="relative bg-white dark:bg-gray-900/80 dark:backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none overflow-hidden min-h-[600px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-[#37bd7e]" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Loading recording...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!recording) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full">
          <div className="relative bg-white dark:bg-gray-900/80 dark:backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none overflow-hidden min-h-[600px] flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Mic className="w-8 h-8 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Recording not found</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="w-full">
        <div className={cn(
          'relative bg-white dark:bg-gray-900/80 dark:backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none overflow-hidden',
          'min-h-[700px]'
        )}>
          {/* Render appropriate detail view based on recording type */}
          {recording.recordingType === 'voice_note' ? (
            <VoiceNoteDetail
              recording={recording}
              onBack={handleBack}
              onShare={handleShare}
              onToggleActionItem={handleToggleActionItem}
            />
          ) : (
            <VoiceRecorderMeetingDetail
              recording={recording}
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
      <TranscriptModal
        open={isTranscriptOpen}
        onOpenChange={setIsTranscriptOpen}
        title={recording.title}
        speakers={recording.speakers}
        transcript={recording.transcript.map((seg) => ({
          speaker: seg.speaker,
          text: seg.text,
          time: seg.time,
          start_time: seg.start_time || 0,
          end_time: seg.end_time || 0,
        }))}
        currentTime={playbackProgress * (recording.durationSeconds || 0)}
        onSeek={handleTranscriptSeek}
      />

      {/* Share Dialog */}
      <VoiceShareDialog
        open={isShareDialogOpen}
        onOpenChange={setIsShareDialogOpen}
        recordingId={recording.id}
        recordingTitle={recording.title}
      />
    </div>
  );
}
