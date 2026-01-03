import { useState, useRef, useCallback, memo } from 'react';
import {
  ChevronLeft,
  Share2,
  Wand2,
  Check,
  Mail,
  Clock,
  List,
  ChevronRight,
  RefreshCw,
  Plus,
  Link2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SpeakerWaveform } from './SpeakerWaveform';
import { VoiceRecorderAudioPlayer, type AudioPlayerRef } from './VoiceRecorderAudioPlayer';
import { TranscriptModal } from './TranscriptModal';
import type { VoiceRecording, ActionItem } from './types';

interface VoiceRecorderMeetingDetailProps {
  recording: VoiceRecording;
  onBack: () => void;
  onShare?: () => void;
  onDraftFollowUp?: () => void;
  onBookNextCall?: () => void;
  onViewTranscript?: () => void;
  onToggleActionItem?: (id: string) => void;
  onAddActionItemToTasks?: (actionId: string) => Promise<{ success: boolean; taskId?: string; error?: string }>;
  onRetryTranscription?: () => void;
  className?: string;
}

/**
 * VoiceRecorderMeetingDetail - Full meeting detail view after recording
 * Shows speakers, playback, AI summary, action items, and quick actions
 */
export const VoiceRecorderMeetingDetail = memo(function VoiceRecorderMeetingDetail({
  recording,
  onBack,
  onShare,
  onDraftFollowUp,
  onBookNextCall,
  onViewTranscript,
  onToggleActionItem,
  onAddActionItemToTasks,
  onRetryTranscription,
  className,
}: VoiceRecorderMeetingDetailProps) {
  const [activeSpeaker, setActiveSpeaker] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  const audioPlayerRef = useRef<AudioPlayerRef>(null);

  const handleSpeakerTap = (speakerId: number) => {
    setActiveSpeaker((prev) => (prev === speakerId ? null : speakerId));
  };

  // Handle seeking from transcript modal
  const handleTranscriptSeek = useCallback((time: number) => {
    audioPlayerRef.current?.seek(time);
    audioPlayerRef.current?.play();
  }, []);

  return (
    <div className={cn('min-h-full flex flex-col pb-6', className)}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-gray-950/90 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800/50">
        <div className="p-4 pt-6 lg:px-8 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold lg:text-lg text-gray-900 dark:text-gray-100 truncate">
              {recording.title}
            </h1>
            <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">
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

      <div className="flex-1 overflow-y-auto">
        {/* Desktop: Two column layout */}
        <div className="lg:flex lg:gap-8 lg:p-6">
          {/* Left Column: Speakers, Playback, Transcript */}
          <div className="lg:flex-1 lg:max-w-xl">
            {/* Speaker Waveforms */}
            <section className="p-4 lg:p-0 lg:mb-6 space-y-3">
              <h2 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1 lg:px-0">
                Speakers
              </h2>
              <div className="lg:grid lg:grid-cols-2 lg:gap-3 space-y-3 lg:space-y-0">
                {recording.speakers.map((speaker) => (
                  <SpeakerWaveform
                    key={speaker.id}
                    speaker={speaker}
                    isActive={activeSpeaker === speaker.id}
                    onTap={() => handleSpeakerTap(speaker.id)}
                  />
                ))}
              </div>
            </section>

            {/* Audio Player */}
            <section className="px-4 lg:px-0 py-3 lg:py-0 lg:mb-6">
              <div className="bg-gray-50 dark:bg-gray-900/80 dark:backdrop-blur-sm rounded-2xl p-4 lg:p-5 border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none">
                <VoiceRecorderAudioPlayer
                  ref={audioPlayerRef}
                  recordingId={recording.id}
                  durationSeconds={recording.durationSeconds}
                  onTimeUpdate={setCurrentTime}
                />
              </div>
            </section>

            {/* Transcript Link - Desktop: Shown inline */}
            <section className="px-4 lg:px-0 py-3 lg:py-0">
              <button
                onClick={() => setShowTranscriptModal(true)}
                className="w-full p-4 lg:p-5 rounded-xl bg-white dark:bg-gray-900/80 dark:backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left shadow-sm dark:shadow-none"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <List className="w-5 h-5 lg:w-6 lg:h-6 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-sm lg:text-base font-medium text-gray-900 dark:text-gray-200">
                        Full Transcript
                      </p>
                      <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">
                        {recording.transcript.length} segments
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                </div>
              </button>
            </section>
          </div>

          {/* Right Column: AI Summary, Actions, Quick Actions */}
          <div className="lg:flex-1 lg:max-w-md">
            {/* AI Summary */}
            <section className="px-4 lg:px-0 py-3 lg:py-0 lg:mb-6">
              <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl p-4 lg:p-5 border border-emerald-200 dark:border-emerald-500/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4 lg:w-5 lg:h-5 text-[#37bd7e] dark:text-emerald-400" />
                    <span className="text-sm lg:text-base font-medium text-emerald-700 dark:text-emerald-400">
                      AI Summary
                    </span>
                  </div>
                  {onRetryTranscription && recording.summary?.includes('Processing') && (
                    <button
                      onClick={onRetryTranscription}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry
                    </button>
                  )}
                </div>
                <p className="text-sm lg:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                  {recording.summary}
                </p>
              </div>
            </section>

            {/* Action Items */}
            <section className="px-4 lg:px-0 py-3 lg:py-0 lg:mb-6">
              <div className="flex items-center justify-between mb-3 px-1 lg:px-0">
                <h2 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Action Items
                </h2>
                <span className="text-xs lg:text-sm text-[#37bd7e] dark:text-emerald-400 font-medium">
                  {recording.actions.length} item
                  {recording.actions.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-2 lg:space-y-3">
                {recording.actions.map((action) => (
                  <ActionItemCard
                    key={action.id}
                    action={action}
                    onToggle={() => onToggleActionItem?.(action.id)}
                    onAddToTasks={onAddActionItemToTasks ? () => onAddActionItemToTasks(action.id) : undefined}
                  />
                ))}
              </div>
            </section>

            {/* Quick Actions */}
            <section className="px-4 lg:px-0 py-3 lg:py-0">
              <h2 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1 lg:px-0">
                Quick Actions
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onDraftFollowUp}
                  className="p-4 lg:p-5 rounded-xl bg-white dark:bg-gray-900/80 dark:backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-[#37bd7e]/30 transition-all text-left shadow-sm dark:shadow-none group"
                >
                  <Mail className="w-5 h-5 lg:w-6 lg:h-6 text-[#37bd7e] dark:text-emerald-400 mb-2" />
                  <p className="text-sm lg:text-base font-medium text-gray-900 dark:text-gray-200 group-hover:text-[#37bd7e] dark:group-hover:text-emerald-400 transition-colors">
                    Draft Follow-up
                  </p>
                  <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">
                    AI-generated email
                  </p>
                </button>
                <button
                  onClick={onBookNextCall}
                  className="p-4 lg:p-5 rounded-xl bg-white dark:bg-gray-900/80 dark:backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-purple-500/30 transition-all text-left shadow-sm dark:shadow-none group"
                >
                  <Clock className="w-5 h-5 lg:w-6 lg:h-6 text-purple-500 dark:text-purple-400 mb-2" />
                  <p className="text-sm lg:text-base font-medium text-gray-900 dark:text-gray-200 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors">
                    Book Next Call
                  </p>
                  <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">
                    Add to calendar
                  </p>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Transcript Modal */}
      <TranscriptModal
        open={showTranscriptModal}
        onOpenChange={setShowTranscriptModal}
        transcript={recording.transcript}
        speakers={recording.speakers}
        currentTime={currentTime}
        onSeek={handleTranscriptSeek}
        title={`${recording.title} - Transcript`}
      />
    </div>
  );
});

interface ActionItemCardProps {
  action: ActionItem;
  onToggle?: () => void;
  onAddToTasks?: () => Promise<{ success: boolean; taskId?: string; error?: string }>;
}

const ActionItemCard = memo(function ActionItemCard({
  action,
  onToggle,
  onAddToTasks,
}: ActionItemCardProps) {
  const [isAddingToTasks, setIsAddingToTasks] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const isLinked = !!action.linkedTaskId;

  const handleAddToTasks = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggle from firing
    if (!onAddToTasks || isLinked || isAddingToTasks) return;

    setIsAddingToTasks(true);
    setAddError(null);

    try {
      const result = await onAddToTasks();
      if (!result.success) {
        setAddError(result.error || 'Failed to add task');
      }
    } catch (err) {
      setAddError('Failed to add task');
      console.error('Error adding to tasks:', err);
    } finally {
      setIsAddingToTasks(false);
    }
  };

  // Get priority badge color
  const getPriorityBadge = () => {
    if (!action.priority) return null;
    const colors = {
      high: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
      medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
      low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    };
    return (
      <span className={cn('px-1.5 py-0.5 rounded text-[10px] lg:text-xs font-medium uppercase', colors[action.priority])}>
        {action.priority}
      </span>
    );
  };

  return (
    <div
      className={cn(
        'w-full p-4 lg:p-5 rounded-xl border transition-all text-left shadow-sm dark:shadow-none',
        action.done
          ? 'bg-gray-50 dark:bg-gray-900/40 border-gray-100 dark:border-gray-700/30'
          : 'bg-white dark:bg-gray-900/80 dark:backdrop-blur-sm border-gray-200 dark:border-gray-700/50'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={cn(
            'w-5 h-5 lg:w-6 lg:h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors hover:border-emerald-400',
            action.done
              ? 'border-emerald-500 bg-emerald-500'
              : 'border-gray-300 dark:border-gray-600'
          )}
          aria-label={action.done ? 'Mark incomplete' : 'Mark complete'}
        >
          {action.done && <Check className="w-3 h-3 lg:w-4 lg:h-4 text-white" />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                'text-sm lg:text-base flex-1',
                action.done
                  ? 'text-gray-500 dark:text-gray-500 line-through'
                  : 'text-gray-900 dark:text-gray-200'
              )}
            >
              {action.text}
            </p>
            {getPriorityBadge()}
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">
              {action.owner}
            </span>
            <span className="text-gray-300 dark:text-gray-600">&bull;</span>
            <span className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">
              {action.deadline}
            </span>
            {action.category && (
              <>
                <span className="text-gray-300 dark:text-gray-600">&bull;</span>
                <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                  {action.category.replace('_', ' ')}
                </span>
              </>
            )}
          </div>

          {/* Task sync row */}
          <div className="flex items-center gap-2 mt-2">
            {isLinked ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <Link2 className="w-3.5 h-3.5" />
                <span>Synced to Tasks</span>
              </div>
            ) : onAddToTasks ? (
              <button
                onClick={handleAddToTasks}
                disabled={isAddingToTasks}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                  isAddingToTasks
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                    : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                )}
              >
                {isAddingToTasks ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Add to Tasks</span>
              </button>
            ) : null}

            {addError && (
              <div className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
                <AlertCircle className="w-3 h-3" />
                <span>{addError}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// Sample meeting data for development/testing
export const SAMPLE_MEETING: VoiceRecording = {
  id: '1',
  title: 'Pipeline Review with Sarah Chen',
  date: 'Today, 2:30 PM',
  duration: '32:14',
  speakers: [
    { id: 1, name: 'You', initials: 'ME', duration: '14:22', color: '#3B82F6' },
    {
      id: 2,
      name: 'Sarah Chen',
      initials: 'SC',
      duration: '17:52',
      color: '#8B5CF6',
    },
  ],
  actions: [
    {
      id: '1',
      text: 'Send MSA to legal team',
      owner: 'You',
      deadline: 'Today',
      done: false,
    },
    {
      id: '2',
      text: 'Share implementation timeline',
      owner: 'You',
      deadline: 'Tomorrow',
      done: false,
    },
    {
      id: '3',
      text: 'Connect with David Kim (Legal)',
      owner: 'Sarah',
      deadline: 'EOD',
      done: true,
    },
  ],
  summary:
    'Discussed Q1 enterprise deal with Meridian Technologies. Sarah confirmed budget approval and requested 6-week implementation timeline. Legal review needed before contract signing. Next step: Send MSA and schedule kickoff.',
  transcript: [
    {
      speaker: 'You',
      time: '0:12',
      text: "Thanks for joining. Let's walk through the Q1 pipeline.",
    },
    {
      speaker: 'Sarah Chen',
      time: '0:28',
      text: "I've reviewed the proposal. Questions about implementation.",
    },
    {
      speaker: 'You',
      time: '0:45',
      text: "We're looking at 6 weeks with dedicated onboarding.",
    },
    {
      speaker: 'Sarah Chen',
      time: '1:02',
      text: 'Can we loop in legal by Friday for the MSA?',
    },
  ],
  createdAt: new Date(),
  recordingType: 'meeting',
};
