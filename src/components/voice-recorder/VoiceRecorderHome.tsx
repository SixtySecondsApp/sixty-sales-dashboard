import { memo, useState } from 'react';
import { Mic, Users, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RecentRecording, RecordingType } from './types';

interface VoiceRecorderHomeProps {
  recentRecordings: RecentRecording[];
  onStartRecording: (type: RecordingType) => void;
  onSelectRecording: (id: string) => void;
  className?: string;
}

const RECORDING_TYPES = [
  {
    type: 'meeting' as RecordingType,
    label: 'Meeting',
    description: 'External call or client meeting',
    icon: Users,
    color: 'blue',
  },
  {
    type: 'voice_note' as RecordingType,
    label: 'Voice Note',
    description: 'Internal note or AI command',
    icon: MessageSquare,
    color: 'purple',
  },
];

/**
 * VoiceRecorderHome - Main home screen for voice recorder
 * Shows type selection, recent recordings, and prominent record button
 */
export const VoiceRecorderHome = memo(function VoiceRecorderHome({
  recentRecordings,
  onStartRecording,
  onSelectRecording,
  className,
}: VoiceRecorderHomeProps) {
  const [selectedType, setSelectedType] = useState<RecordingType>('meeting');

  const handleStartRecording = () => {
    onStartRecording(selectedType);
  };

  return (
    <div className={cn('min-h-full flex flex-col', className)}>
      {/* Header - Hidden on desktop as page header shows */}
      <header className="p-6 pt-8 lg:hidden">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#37bd7e] flex items-center justify-center">
            <span className="text-white font-bold text-lg">60</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              use60
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Voice Notes</p>
          </div>
        </div>
      </header>

      {/* Desktop Layout: Two columns */}
      <div className="flex-1 flex flex-col lg:flex-row lg:gap-8 lg:p-6">
        {/* Left Column: Type Selection & Record Button */}
        <div className="order-2 lg:order-1 lg:w-96 lg:flex-shrink-0 p-6 lg:p-0 pb-8 lg:pb-0 mt-auto lg:mt-0">
          <div className="lg:sticky lg:top-6 space-y-4">
            {/* Recording Type Selection */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Recording Type
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {RECORDING_TYPES.map((option) => {
                  const Icon = option.icon;
                  const isSelected = selectedType === option.type;
                  return (
                    <button
                      key={option.type}
                      onClick={() => setSelectedType(option.type)}
                      className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all',
                        isSelected
                          ? option.color === 'blue'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                            : 'border-purple-500 bg-purple-50 dark:bg-purple-500/10'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/80 hover:border-gray-300 dark:hover:border-gray-600'
                      )}
                    >
                      <Icon
                        className={cn(
                          'w-5 h-5 mb-2',
                          isSelected
                            ? option.color === 'blue'
                              ? 'text-blue-500'
                              : 'text-purple-500'
                            : 'text-gray-400 dark:text-gray-500'
                        )}
                      />
                      <p
                        className={cn(
                          'font-medium text-sm',
                          isSelected
                            ? option.color === 'blue'
                              ? 'text-blue-700 dark:text-blue-400'
                              : 'text-purple-700 dark:text-purple-400'
                            : 'text-gray-900 dark:text-gray-200'
                        )}
                      >
                        {option.label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Start Recording Button */}
            <button
              onClick={handleStartRecording}
              className="w-full relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#37bd7e] focus-visible:ring-offset-2 rounded-3xl"
            >
              <div className="relative bg-[#37bd7e] hover:bg-[#2da76c] rounded-3xl p-6 flex items-center justify-center gap-4 transition-all group-hover:scale-[1.02] group-active:scale-[0.98]">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
                  <Mic className="w-8 h-8 text-white" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-xl font-semibold text-white">Start Recording</p>
                  <p className="text-sm text-white/70">
                    {selectedType === 'meeting'
                      ? 'Record a client meeting'
                      : 'Record a voice note'}
                  </p>
                </div>
              </div>
            </button>

            {/* Tips section - desktop only */}
            <div className="hidden lg:block p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {selectedType === 'meeting' ? 'Meeting Tips' : 'Voice Note Tips'}
              </h3>
              <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1.5">
                {selectedType === 'meeting' ? (
                  <>
                    <li>• Syncs with your Meetings page</li>
                    <li>• AI extracts action items & follow-ups</li>
                    <li>• Get meeting summaries for CRM</li>
                  </>
                ) : (
                  <>
                    <li>• Quick notes & reminders</li>
                    <li>• Internal team discussions</li>
                    <li>• AI commands & task creation</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Recordings */}
        <div className="order-1 lg:order-2 flex-1 px-6 lg:px-0 mb-8 lg:mb-0">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Recent Recordings
          </h2>

          {recentRecordings.length === 0 ? (
            <div className="p-6 lg:p-8 rounded-2xl bg-gray-50 dark:bg-gray-900/80 dark:backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 text-center shadow-sm dark:shadow-none">
              <Mic className="w-8 h-8 lg:w-12 lg:h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
              <p className="text-sm lg:text-base text-gray-500 dark:text-gray-400">
                No recordings yet
              </p>
              <p className="text-xs lg:text-sm text-gray-400 dark:text-gray-500 mt-1">
                Select a type and start your first recording
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
              {recentRecordings.map((recording) => (
                <button
                  key={recording.id}
                  onClick={() => onSelectRecording(recording.id)}
                  className="w-full p-4 lg:p-5 rounded-2xl bg-white dark:bg-gray-900/80 dark:backdrop-blur-sm border border-gray-200 dark:border-gray-700/50 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-[#37bd7e]/30 dark:hover:border-emerald-500/30 transition-all shadow-sm dark:shadow-none group"
                >
                  {/* Type Badge */}
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                        recording.recordingType === 'meeting'
                          ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10'
                          : 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10'
                      )}
                    >
                      {recording.recordingType === 'meeting' ? (
                        <Users className="w-3 h-3" />
                      ) : (
                        <MessageSquare className="w-3 h-3" />
                      )}
                      {recording.recordingType === 'meeting' ? 'Meeting' : 'Note'}
                    </span>
                  </div>
                  <p className="font-medium text-gray-900 dark:text-gray-200 mb-2 line-clamp-2 group-hover:text-[#37bd7e] dark:group-hover:text-emerald-400 transition-colors">
                    {recording.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>{recording.time}</span>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span>{recording.duration}</span>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#37bd7e] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-full">
                    {recording.actionsCount} action{recording.actionsCount !== 1 ? 's' : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
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
    recordingType: 'meeting',
  },
  {
    id: '2',
    title: 'Team Standup',
    time: 'Today, 9:00 AM',
    duration: '15:22',
    actionsCount: 5,
    recordingType: 'voice_note',
  },
  {
    id: '3',
    title: 'Discovery Call - Acme Corp',
    time: 'Yesterday',
    duration: '28:45',
    actionsCount: 4,
    recordingType: 'meeting',
  },
];
