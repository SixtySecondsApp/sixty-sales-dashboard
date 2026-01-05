import { useState, memo, useMemo, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  Share2,
  Wand2,
  Check,
  Mail,
  Clock,
  List,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SpeakerWaveform } from './SpeakerWaveform';
import { VoiceRecorderAudioPlayer, AudioPlayerRef } from './VoiceRecorderAudioPlayer';
import type { VoiceRecording, ActionItem } from './types';

interface VoiceRecorderMeetingDetailProps {
  recording: VoiceRecording;
  onBack: () => void;
  onShare?: () => void;
  onDraftFollowUp?: () => void;
  onBookNextCall?: () => void;
  onViewTranscript?: () => void;
  onToggleActionItem?: (id: string) => void;
  onTimeUpdate?: (currentTime: number) => void;
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
  onTimeUpdate,
  className,
}: VoiceRecorderMeetingDetailProps) {
  const audioPlayerRef = useRef<AudioPlayerRef>(null);
  const [activeSpeaker, setActiveSpeaker] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Handle time updates from audio player
  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
    onTimeUpdate?.(time);
  }, [onTimeUpdate]);

  // Handle play state changes
  const handlePlayStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  // Calculate segment lengths per speaker for dynamic waveform generation
  const speakerSegmentLengths = useMemo(() => {
    const lengthsBySpeaker: Record<string, number[]> = {};

    recording.transcript.forEach((segment) => {
      const speakerName = segment.speaker;
      if (!lengthsBySpeaker[speakerName]) {
        lengthsBySpeaker[speakerName] = [];
      }
      // Use text length as proxy for segment duration/intensity
      lengthsBySpeaker[speakerName].push(segment.text.length);
    });

    return lengthsBySpeaker;
  }, [recording.transcript]);

  const handleSpeakerTap = (speakerId: number) => {
    setActiveSpeaker((prev) => (prev === speakerId ? null : speakerId));
  };

  return (
    <div className={cn('min-h-full flex flex-col pb-6', className)}>
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
            <h1 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
              {recording.title}
            </h1>
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

      <div className="flex-1 overflow-y-auto">
        {/* Speaker Waveforms */}
        <section className="p-4 space-y-3">
          <h2 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-1">
            Speakers
          </h2>
          {recording.speakers.map((speaker) => (
            <SpeakerWaveform
              key={speaker.id}
              speaker={speaker}
              isActive={activeSpeaker === speaker.id}
              onTap={() => handleSpeakerTap(speaker.id)}
              segmentLengths={speakerSegmentLengths[speaker.name]}
            />
          ))}
        </section>

        {/* Playback Controls */}
        <section className="px-4 py-3">
          <div className="bg-gray-50 dark:bg-gray-900/80 dark:backdrop-blur-sm rounded-2xl p-4 border border-gray-200 dark:border-gray-700/50 shadow-sm dark:shadow-none">
            <VoiceRecorderAudioPlayer
              ref={audioPlayerRef}
              recordingId={recording.id}
              durationSeconds={recording.durationSeconds}
              onTimeUpdate={handleTimeUpdate}
              onPlayStateChange={handlePlayStateChange}
            />
          </div>
        </section>

        {/* AI Summary */}
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

        {/* Action Items */}
        <section className="px-4 py-3">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Action Items
            </h2>
            <span className="text-xs text-[#37bd7e] dark:text-emerald-400">
              {recording.actions.length} item
              {recording.actions.length !== 1 ? 's' : ''}
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

        {/* Quick Actions */}
        <section className="px-4 py-3">
          <h2 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onDraftFollowUp}
              className="p-4 rounded-xl bg-white dark:bg-gray-900/80 dark:backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left shadow-sm dark:shadow-none"
            >
              <Mail className="w-5 h-5 text-[#37bd7e] dark:text-emerald-400 mb-2" />
              <p className="text-sm font-medium text-gray-900 dark:text-gray-200">
                Draft Follow-up
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                AI-generated email
              </p>
            </button>
            <button
              onClick={onBookNextCall}
              className="p-4 rounded-xl bg-white dark:bg-gray-900/80 dark:backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left shadow-sm dark:shadow-none"
            >
              <Clock className="w-5 h-5 text-purple-500 dark:text-purple-400 mb-2" />
              <p className="text-sm font-medium text-gray-900 dark:text-gray-200">
                Book Next Call
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Add to calendar
              </p>
            </button>
          </div>
        </section>

        {/* Transcript Link */}
        <section className="px-4 py-3">
          <button
            onClick={onViewTranscript}
            className="w-full p-4 rounded-xl bg-white dark:bg-gray-900/80 dark:backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left shadow-sm dark:shadow-none"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <List className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-200">
                    Full Transcript
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {recording.transcript.length} segments
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            </div>
          </button>
        </section>
      </div>
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
          : 'bg-white dark:bg-gray-900/80 dark:backdrop-blur-sm border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50'
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
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span>{action.owner}</span>
            <span className="text-gray-300 dark:text-gray-600">&bull;</span>
            <span>{action.deadline}</span>
          </div>
        </div>
      </div>
    </button>
  );
});

// Sample meeting data for development/testing
export const SAMPLE_MEETING: VoiceRecording = {
  id: '1',
  title: 'Pipeline Review with Sarah Chen',
  date: 'Today, 2:30 PM',
  duration: '32:14',
  durationSeconds: 1934, // 32:14 in seconds
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
};
