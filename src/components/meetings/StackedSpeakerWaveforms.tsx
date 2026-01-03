import { useMemo, memo } from 'react';
import { cn } from '@/lib/utils';

// Speaker colors for consistent visual identity
const SPEAKER_COLORS = [
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#6366F1', // Indigo
  '#84CC16', // Lime
] as const;

interface Speaker {
  id: number;
  name: string;
  initials?: string;
}

interface TranscriptSegment {
  speaker: string;
  speaker_id: number;
  text: string;
  start_time: number;
  end_time: number;
  confidence?: number;
}

interface StackedSpeakerWaveformsProps {
  speakers: Speaker[];
  transcriptSegments: TranscriptSegment[];
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  isPlaying: boolean;
  className?: string;
}

/**
 * StackedSpeakerWaveforms - Displays stacked waveforms per speaker for voice meetings
 * Highlights the active speaker based on current playback time
 * Allows seeking by clicking on the waveform timeline
 */
export const StackedSpeakerWaveforms = memo(function StackedSpeakerWaveforms({
  speakers,
  transcriptSegments,
  currentTime,
  duration,
  onSeek,
  isPlaying,
  className,
}: StackedSpeakerWaveformsProps) {
  // Calculate speaking periods for each speaker
  const speakerTimelines = useMemo(() => {
    const timelines: Map<number, { start: number; end: number }[]> = new Map();

    // Initialize timelines for all speakers
    speakers.forEach((speaker) => {
      timelines.set(speaker.id, []);
    });

    // Group segments by speaker
    transcriptSegments.forEach((segment) => {
      const periods = timelines.get(segment.speaker_id);
      if (periods) {
        periods.push({
          start: segment.start_time,
          end: segment.end_time || segment.start_time + 2, // Fallback end time
        });
      }
    });

    return timelines;
  }, [speakers, transcriptSegments]);

  // Calculate total duration for each speaker
  const speakerDurations = useMemo(() => {
    const durations: Map<number, number> = new Map();

    speakerTimelines.forEach((periods, speakerId) => {
      const totalDuration = periods.reduce((sum, period) => sum + (period.end - period.start), 0);
      durations.set(speakerId, totalDuration);
    });

    return durations;
  }, [speakerTimelines]);

  // Determine active speaker based on current time
  const activeSpeakerId = useMemo(() => {
    const activeSegment = transcriptSegments.find(
      (segment) =>
        currentTime >= segment.start_time &&
        currentTime < (segment.end_time || segment.start_time + 2)
    );
    return activeSegment?.speaker_id ?? null;
  }, [currentTime, transcriptSegments]);

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  // Handle click on timeline to seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const seekTime = percentage * duration;
    onSeek(seekTime);
  };

  if (speakers.length === 0) {
    return (
      <div className={cn('p-4 text-center text-gray-500 dark:text-gray-400', className)}>
        No speaker data available
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {speakers.map((speaker, index) => {
        const color = SPEAKER_COLORS[index % SPEAKER_COLORS.length];
        const isActive = activeSpeakerId === speaker.id;
        const periods = speakerTimelines.get(speaker.id) || [];
        const speakerDuration = speakerDurations.get(speaker.id) || 0;
        const initials = speaker.initials || speaker.name.substring(0, 2).toUpperCase();

        return (
          <div
            key={speaker.id}
            className={cn(
              'rounded-xl p-3 transition-all duration-200 border',
              isActive
                ? 'bg-gray-100 dark:bg-gray-800/80 scale-[1.01] ring-2 ring-emerald-500/30 border-emerald-500/30'
                : 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700/50'
            )}
          >
            {/* Speaker Header */}
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold text-xs shrink-0"
                style={{ backgroundColor: color }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate">
                  {speaker.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDuration(speakerDuration)} speaking
                </p>
              </div>
              {isActive && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-emerald-500 font-medium">Speaking</span>
                </div>
              )}
            </div>

            {/* Speaker Timeline/Waveform */}
            <div
              className="h-8 bg-gray-200 dark:bg-gray-700/50 rounded-lg relative overflow-hidden cursor-pointer"
              onClick={handleTimelineClick}
            >
              {/* Speaking periods visualization */}
              {periods.map((period, idx) => {
                const leftPercent = (period.start / duration) * 100;
                const widthPercent = ((period.end - period.start) / duration) * 100;
                const isCurrentPeriod =
                  currentTime >= period.start && currentTime < period.end;

                return (
                  <div
                    key={idx}
                    className="absolute top-0 bottom-0 transition-opacity duration-200"
                    style={{
                      left: `${leftPercent}%`,
                      width: `${Math.max(widthPercent, 0.5)}%`,
                      backgroundColor: color,
                      opacity: isCurrentPeriod ? 1 : isActive ? 0.7 : 0.4,
                    }}
                  >
                    {/* Waveform bars within the period */}
                    <div className="h-full flex items-center justify-center gap-0.5 px-0.5">
                      {Array.from({ length: Math.max(Math.floor(widthPercent * 2), 3) }, (_, i) => {
                        const height = 20 + ((speaker.id * 17 + i * 31) % 60);
                        return (
                          <div
                            key={i}
                            className="w-0.5 rounded-full bg-white/60"
                            style={{
                              height: `${height}%`,
                              animation:
                                isPlaying && isCurrentPeriod
                                  ? `waveformPulse ${0.3 + (i % 3) * 0.1}s ease-in-out infinite alternate`
                                  : 'none',
                              animationDelay: `${i * 50}ms`,
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10 transition-all duration-100"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              />
            </div>
          </div>
        );
      })}

      {/* Waveform animation */}
      <style>{`
        @keyframes waveformPulse {
          0% { transform: scaleY(0.7); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
});

export default StackedSpeakerWaveforms;
