import { useState, useRef, useCallback, memo } from 'react';
import {
  ChevronLeft,
  Share2,
  Wand2,
  Check,
  List,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { VoiceRecorderAudioPlayer, AudioPlayerRef } from './VoiceRecorderAudioPlayer';
import { TranscriptModal } from './TranscriptModal';
import type { VoiceRecording, ActionItem } from './types';

interface VoiceNoteDetailProps {
  recording: VoiceRecording;
  onBack: () => void;
  onShare?: () => void;
  onToggleActionItem?: (id: string) => void;
  className?: string;
}

/**
 * VoiceNoteDetail - Simple view for voice note recordings
 * Shows playback, transcript preview, AI summary, and extracted tasks
 * Simpler than MeetingDetail - no speaker waveforms, focused on quick reference
 */
export const VoiceNoteDetail = memo(function VoiceNoteDetail({
  recording,
  onBack,
  onShare,
  onToggleActionItem,
  className,
}: VoiceNoteDetailProps) {
  const audioPlayerRef = useRef<AudioPlayerRef>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleSeek = useCallback((time: number) => {
    audioPlayerRef.current?.seek(time);
  }, []);

  const handleCopyTranscript = useCallback(async () => {
    const plainText = recording.transcript
      .map(segment => `[${segment.time}] ${segment.text}`)
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy transcript:', err);
    }
  }, [recording.transcript]);

  // Get first few transcript segments for preview
  const transcriptPreview = recording.transcript.slice(0, 3);
  const hasMoreTranscript = recording.transcript.length > 3;

  return (
    <div className={cn('min-h-full flex flex-col', className)}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-gray-950/90 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800/50">
        <div className="p-4 pt-6 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {recording.title}
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 shrink-0">
                Note
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {recording.date} &bull; {recording.duration}
            </p>
          </div>
          {onShare && (
            <button
              onClick={onShare}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
              aria-label="Share recording"
            >
              <Share2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-6">
        {/* Audio Player */}
        <section className="p-4">
          <div className="bg-gray-50 dark:bg-gray-900/80 dark:backdrop-blur-sm rounded-2xl p-4 border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none">
            <VoiceRecorderAudioPlayer
              ref={audioPlayerRef}
              recordingId={recording.id}
              durationSeconds={recording.durationSeconds}
              onTimeUpdate={handleTimeUpdate}
            />
          </div>
        </section>

        {/* AI Summary */}
        {recording.summary && (
          <section className="px-4 py-3">
            <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-500/20">
              <div className="flex items-center gap-2 mb-3">
                <Wand2 className="w-4 h-4 text-[#37bd7e] dark:text-emerald-400" />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  AI Summary
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {recording.summary}
              </p>
            </div>
          </section>
        )}

        {/* Action Items / Tasks */}
        {recording.actions.length > 0 && (
          <section className="px-4 py-3">
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Extracted Tasks
              </h2>
              <span className="text-xs text-[#37bd7e] dark:text-emerald-400">
                {recording.actions.filter(a => a.done).length}/{recording.actions.length} done
              </span>
            </div>
            <div className="space-y-2">
              {recording.actions.map((action) => (
                <ActionItemCard
                  key={action.id}
                  action={action}
                  onToggle={() => onToggleActionItem?.(action.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Transcript Preview */}
        {recording.transcript.length > 0 && (
          <section className="px-4 py-3">
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Transcript
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyTranscript}
                  className={cn(
                    'flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors',
                    copied
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  {copied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {transcriptPreview.map((segment, idx) => (
                <button
                  key={idx}
                  onClick={() => segment.start_time !== undefined && handleSeek(segment.start_time)}
                  className="w-full text-left p-3 rounded-xl bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {segment.time}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                    {segment.text}
                  </p>
                </button>
              ))}

              {hasMoreTranscript && (
                <button
                  onClick={() => setShowTranscript(true)}
                  className="w-full p-4 rounded-xl bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center justify-center gap-2 text-[#37bd7e] dark:text-emerald-400">
                    <List className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      View Full Transcript ({recording.transcript.length} segments)
                    </span>
                  </div>
                </button>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Transcript Modal */}
      <TranscriptModal
        open={showTranscript}
        onOpenChange={setShowTranscript}
        transcript={recording.transcript}
        speakers={recording.speakers}
        currentTime={currentTime}
        onSeek={handleSeek}
        title="Voice Note Transcript"
      />
    </div>
  );
});

interface ActionItemCardProps {
  action: ActionItem;
  onToggle?: () => void;
}

const ActionItemCard = memo(function ActionItemCard({
  action,
  onToggle,
}: ActionItemCardProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full p-4 rounded-xl border transition-all text-left shadow-sm dark:shadow-none',
        action.done
          ? 'bg-gray-50 dark:bg-gray-900/40 border-gray-100 dark:border-gray-700/30'
          : 'bg-white dark:bg-gray-900/80 border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors',
            action.done
              ? 'border-emerald-500 bg-emerald-500'
              : 'border-gray-300 dark:border-gray-600'
          )}
        >
          {action.done && <Check className="w-3 h-3 text-white" />}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'text-sm',
              action.done
                ? 'text-gray-500 dark:text-gray-500 line-through'
                : 'text-gray-900 dark:text-gray-200'
            )}
          >
            {action.text}
          </p>
          {(action.owner || action.deadline) && (
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
              {action.owner && <span>{action.owner}</span>}
              {action.owner && action.deadline && (
                <span className="text-gray-300 dark:text-gray-600">&bull;</span>
              )}
              {action.deadline && <span>{action.deadline}</span>}
            </div>
          )}
        </div>
      </div>
    </button>
  );
});

export default VoiceNoteDetail;
