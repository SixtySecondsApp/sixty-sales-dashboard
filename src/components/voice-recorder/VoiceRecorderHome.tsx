import { memo, useState } from 'react';
import { Mic, Users, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RecentRecording, RecordingType } from './types';

interface VoiceRecorderHomeProps {
  recentRecordings: RecentRecording[];
  onStartRecording: (type: RecordingType) => void;
  onSelectRecording: (id: string) => void;
  className?: string;
}

/**
 * VoiceRecorderHome - Main home screen for voice recorder
 * Shows recent recordings and prominent record button
 */
export const VoiceRecorderHome = memo(function VoiceRecorderHome({
  recentRecordings,
  onStartRecording,
  onSelectRecording,
  className,
}: VoiceRecorderHomeProps) {
  const [recordingType, setRecordingType] = useState<RecordingType>('meeting');

  return (
    <div className={cn('min-h-full flex flex-col', className)}>
      {/* Header */}
      <header className="p-6 pt-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#37bd7e] flex items-center justify-center">
            <span className="text-white font-bold text-lg">60</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              use60
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Voice</p>
          </div>
        </div>
      </header>

      {/* Recent Meetings */}
      <div className="px-6 mb-8 flex-1">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Recent
        </h2>
        <div className="space-y-3">
          {recentRecordings.length === 0 ? (
            <div className="p-6 rounded-2xl bg-gray-50 dark:bg-gray-900/80 dark:backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 text-center shadow-sm dark:shadow-none">
              <Mic className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No recordings yet
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Tap the button below to start your first recording
              </p>
            </div>
          ) : (
            recentRecordings.map((recording) => (
              <button
                key={recording.id}
                onClick={() => onSelectRecording(recording.id)}
                className="w-full p-4 rounded-2xl bg-white dark:bg-gray-900/80 dark:backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors shadow-sm dark:shadow-none"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-medium text-gray-900 dark:text-gray-200 line-clamp-1 flex-1">
                    {recording.title}
                  </p>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium shrink-0',
                    recording.recordingType === 'meeting'
                      ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
                      : 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400'
                  )}>
                    {recording.recordingType === 'meeting' ? 'Meeting' : 'Note'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>{recording.time}</span>
                  <span className="text-gray-300 dark:text-gray-600">
                    &bull;
                  </span>
                  <span>{recording.duration}</span>
                  <span className="text-gray-300 dark:text-gray-600">
                    &bull;
                  </span>
                  <span className="text-[#37bd7e] dark:text-emerald-400">
                    {recording.actionsCount} action
                    {recording.actionsCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Recording Type Selector */}
      <div className="px-6 pb-4">
        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Recording Type
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setRecordingType('meeting')}
            className={cn(
              'p-4 rounded-xl border-2 transition-all text-left',
              recordingType === 'meeting'
                ? 'border-[#37bd7e] bg-emerald-50 dark:bg-emerald-500/10'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/80 hover:border-gray-300 dark:hover:border-gray-600'
            )}
          >
            <Users className={cn(
              'w-5 h-5 mb-2',
              recordingType === 'meeting' ? 'text-[#37bd7e]' : 'text-gray-400'
            )} />
            <p className={cn(
              'text-sm font-medium',
              recordingType === 'meeting' ? 'text-[#37bd7e]' : 'text-gray-900 dark:text-gray-200'
            )}>
              Meeting
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              External calls & client meetings
            </p>
          </button>
          <button
            onClick={() => setRecordingType('voice_note')}
            className={cn(
              'p-4 rounded-xl border-2 transition-all text-left',
              recordingType === 'voice_note'
                ? 'border-[#37bd7e] bg-emerald-50 dark:bg-emerald-500/10'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/80 hover:border-gray-300 dark:hover:border-gray-600'
            )}
          >
            <FileText className={cn(
              'w-5 h-5 mb-2',
              recordingType === 'voice_note' ? 'text-[#37bd7e]' : 'text-gray-400'
            )} />
            <p className={cn(
              'text-sm font-medium',
              recordingType === 'voice_note' ? 'text-[#37bd7e]' : 'text-gray-900 dark:text-gray-200'
            )}>
              Voice Note
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Quick notes & reminders
            </p>
          </button>
        </div>
      </div>

      {/* Big Record Button */}
      <div className="p-6 pb-8 mt-auto">
        <button
          onClick={() => onStartRecording(recordingType)}
          className="w-full relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#37bd7e] focus-visible:ring-offset-2 rounded-3xl"
        >
          <div className="relative bg-[#37bd7e] hover:bg-[#2da76c] rounded-3xl p-6 flex items-center justify-center gap-4 transition-all group-hover:scale-[1.02] group-active:scale-[0.98]">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <Mic className="w-8 h-8 text-white" />
            </div>
            <div className="text-left">
              <p className="text-xl font-semibold text-white">Start Recording</p>
              <p className="text-sm text-white/70">
                {recordingType === 'meeting' ? 'Capture your meeting' : 'Record a voice note'}
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
});

// Sample data for development/testing
export const SAMPLE_RECENT_RECORDINGS: RecentRecording[] = [
  {
    id: '1',
    title: 'Pipeline Review with Sarah Chen',
    time: 'Today, 2:30 PM',
    duration: '32:14',
    actionsCount: 3,
  },
  {
    id: '2',
    title: 'Team Standup',
    time: 'Today, 9:00 AM',
    duration: '15:22',
    actionsCount: 5,
  },
  {
    id: '3',
    title: 'Discovery Call - Acme Corp',
    time: 'Yesterday',
    duration: '28:45',
    actionsCount: 4,
  },
];
