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
            'absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 lg:w-[500px] lg:h-[500px] rounded-full blur-3xl transition-opacity duration-500',
            isPaused
              ? 'bg-amber-500/10 opacity-50'
              : 'bg-emerald-500/20 opacity-100 animate-pulse'
          )}
        />
      </div>

      {/* Centered content container for desktop */}
      <div className="relative flex-1 flex flex-col max-w-2xl mx-auto w-full">
        {/* Header with recording indicator */}
        <header className="relative p-6 pt-8 lg:pt-12 text-center">
          <div
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 lg:px-6 lg:py-3 rounded-full border transition-colors',
              isPaused
                ? 'bg-amber-500/10 border-amber-500/20'
                : 'bg-red-500/10 border-red-500/20'
            )}
          >
            <div
              className={cn(
                'w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-full transition-colors',
                isPaused ? 'bg-amber-500' : 'bg-red-500 animate-pulse'
              )}
            />
            <span
              className={cn(
                'text-sm lg:text-base font-medium',
                isPaused ? 'text-amber-500' : 'text-red-400'
              )}
            >
              {isPaused ? 'Paused' : 'Recording'}
            </span>
          </div>
        </header>

        {/* Timer and Waveform */}
        <div className="relative flex-1 flex flex-col items-center justify-center px-4 lg:px-8">
          {/* Large Timer Display */}
          <p className="text-6xl md:text-7xl lg:text-8xl font-light text-gray-900 dark:text-gray-100 tabular-nums mb-8 lg:mb-12 tracking-tight">
            {formattedTime}
          </p>

          {/* Live Waveform Visualization */}
          <LiveWaveform
            isRecording={!isPaused}
            audioLevel={audioLevel}
            className="w-full max-w-md lg:max-w-lg"
          />

          {/* Status Text */}
          <p className="text-sm lg:text-base text-gray-500 dark:text-gray-400 mt-6 lg:mt-8">
            {isPaused ? 'Recording paused' : 'Listening...'}
          </p>
        </div>

        {/* Control Buttons */}
        <div className="relative p-6 pb-8 lg:p-8 lg:pb-12 space-y-3 lg:space-y-4">
          {/* Desktop: Side by side buttons */}
          <div className="lg:flex lg:gap-4">
            {/* Pause/Resume Button */}
            <button
              onClick={isPaused ? onResume : onPause}
              className="w-full lg:flex-1 group focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 rounded-2xl mb-3 lg:mb-0"
            >
              <div
                className={cn(
                  'relative rounded-2xl p-4 lg:p-5 flex items-center justify-center gap-3 border transition-all h-full',
                  isPaused
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/15'
                    : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/15'
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center',
                    isPaused ? 'bg-[#37bd7e]' : 'bg-amber-500'
                  )}
                >
                  {isPaused ? (
                    <Play className="w-5 h-5 lg:w-6 lg:h-6 text-white ml-0.5" />
                  ) : (
                    <Pause className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
                  )}
                </div>
                <div className="text-left flex-1">
                  <p
                    className={cn(
                      'font-medium lg:text-lg',
                      isPaused
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    )}
                  >
                    {isPaused ? 'Resume Recording' : 'Pause Recording'}
                  </p>
                  <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">
                    {isPaused ? 'Continue capturing audio' : 'Temporarily pause'}
                  </p>
                </div>
              </div>
            </button>

            {/* Stop Button */}
            <button
              onClick={onStop}
              className="w-full lg:flex-1 relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded-3xl"
            >
              {/* Glow effect */}
              <div className="absolute inset-0 bg-red-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity" />

              <div className="relative bg-white dark:bg-gray-900/80 backdrop-blur border border-gray-200 dark:border-gray-700/50 rounded-3xl p-6 lg:p-5 flex items-center justify-center gap-4 transition-all group-hover:border-red-300 dark:group-hover:border-red-500/30 h-full">
                <div className="w-16 h-16 lg:w-12 lg:h-12 rounded-2xl lg:rounded-xl bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/20">
                  <Square className="w-7 h-7 lg:w-6 lg:h-6 text-white" fill="currentColor" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-xl lg:text-lg font-semibold text-gray-900 dark:text-gray-100">
                    End Recording
                  </p>
                  <p className="text-sm lg:text-xs text-gray-500 dark:text-gray-400">
                    Click when finished
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
