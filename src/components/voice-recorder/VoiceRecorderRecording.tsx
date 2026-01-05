import { memo } from 'react';
import { Square, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiveWaveform } from './LiveWaveform';
import { useRecordingTimer } from './useVoiceRecorder';

interface VoiceRecorderRecordingProps {
  duration: number;
  audioLevel: number;
  isPaused: boolean;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  className?: string;
}

/**
 * VoiceRecorderRecording - Active recording screen
 * Shows timer, live waveform, and recording controls
 */
export const VoiceRecorderRecording = memo(function VoiceRecorderRecording({
  duration,
  audioLevel,
  isPaused,
  onStop,
  onPause,
  onResume,
  className,
}: VoiceRecorderRecordingProps) {
  const formattedTime = useRecordingTimer(duration);

  return (
    <div className={cn('min-h-full flex flex-col relative', className)}>
      {/* Ambient glow background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={cn(
            'absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl transition-opacity duration-500',
            isPaused
              ? 'bg-amber-500/10 opacity-50'
              : 'bg-emerald-500/20 opacity-100 animate-pulse'
          )}
        />
      </div>

      {/* Header with recording indicator */}
      <header className="relative p-6 pt-8 text-center">
        <div
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-full border transition-colors',
            isPaused
              ? 'bg-amber-500/10 border-amber-500/20'
              : 'bg-red-500/10 border-red-500/20'
          )}
        >
          <div
            className={cn(
              'w-2.5 h-2.5 rounded-full transition-colors',
              isPaused ? 'bg-amber-500' : 'bg-red-500 animate-pulse'
            )}
          />
          <span
            className={cn(
              'text-sm font-medium',
              isPaused ? 'text-amber-500' : 'text-red-400'
            )}
          >
            {isPaused ? 'Paused' : 'Recording'}
          </span>
        </div>
      </header>

      {/* Timer and Waveform */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-4">
        {/* Large Timer Display */}
        <p className="text-6xl md:text-7xl font-light text-gray-900 dark:text-gray-100 tabular-nums mb-8 tracking-tight">
          {formattedTime}
        </p>

        {/* Live Waveform Visualization */}
        <LiveWaveform
          isRecording={!isPaused}
          audioLevel={audioLevel}
          className="w-full max-w-md"
        />

        {/* Status Text */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-6">
          {isPaused ? 'Recording paused' : 'Listening...'}
        </p>
      </div>

      {/* Control Buttons */}
      <div className="relative p-6 pb-8 space-y-3">
        {/* Pause/Resume Button */}
        <button
          onClick={isPaused ? onResume : onPause}
          className="w-full group focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 rounded-2xl"
        >
          <div
            className={cn(
              'relative rounded-2xl p-4 flex items-center justify-center gap-3 border transition-all',
              isPaused
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/15'
                : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/15'
            )}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                isPaused ? 'bg-[#37bd7e]' : 'bg-amber-500'
              )}
            >
              {isPaused ? (
                <Play className="w-5 h-5 text-white ml-0.5" />
              ) : (
                <Pause className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="text-left flex-1">
              <p
                className={cn(
                  'font-medium',
                  isPaused
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                )}
              >
                {isPaused ? 'Resume Recording' : 'Pause Recording'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isPaused ? 'Continue capturing audio' : 'Temporarily pause'}
              </p>
            </div>
          </div>
        </button>

        {/* Stop Button */}
        <button
          onClick={onStop}
          className="w-full relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded-3xl"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 bg-red-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity" />

          <div className="relative bg-white dark:bg-gray-900/80 backdrop-blur border border-gray-200 dark:border-gray-700/50 rounded-3xl p-6 flex items-center justify-center gap-4 transition-all group-hover:border-red-300 dark:group-hover:border-red-500/30">
            <div className="w-16 h-16 rounded-2xl bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/20">
              <Square className="w-7 h-7 text-white" fill="currentColor" />
            </div>
            <div className="text-left">
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                End Recording
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Tap when finished
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
});
