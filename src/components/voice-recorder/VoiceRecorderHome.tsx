import { memo } from 'react';
import { Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RecentRecording } from './types';

interface VoiceRecorderHomeProps {
  recentRecordings: RecentRecording[];
  onStartRecording: () => void;
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
                <p className="font-medium text-gray-900 dark:text-gray-200 mb-1 line-clamp-1">
                  {recording.title}
                </p>
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

      {/* Big Record Button */}
      <div className="p-6 pb-8 mt-auto">
        <button
          onClick={onStartRecording}
          className="w-full relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#37bd7e] focus-visible:ring-offset-2 rounded-3xl"
        >
          <div className="relative bg-[#37bd7e] hover:bg-[#2da76c] rounded-3xl p-6 flex items-center justify-center gap-4 transition-all group-hover:scale-[1.02] group-active:scale-[0.98]">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <Mic className="w-8 h-8 text-white" />
            </div>
            <div className="text-left">
              <p className="text-xl font-semibold text-white">Start Recording</p>
              <p className="text-sm text-white/70">
                Tap to capture your meeting
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
