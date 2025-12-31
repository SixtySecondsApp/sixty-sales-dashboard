import { useState, useEffect, memo } from 'react';
import { cn } from '@/lib/utils';

interface LiveWaveformProps {
  isRecording: boolean;
  audioLevel?: number;
  barCount?: number;
  className?: string;
}

/**
 * LiveWaveform - Animated waveform visualization for active recording
 * Shows dynamic bars that respond to audio input levels
 */
export const LiveWaveform = memo(function LiveWaveform({
  isRecording,
  audioLevel = 0,
  barCount = 50,
  className,
}: LiveWaveformProps) {
  const [bars, setBars] = useState<number[]>(Array(barCount).fill(0.1));

  useEffect(() => {
    if (!isRecording) {
      setBars(Array(barCount).fill(0.1));
      return;
    }

    const interval = setInterval(() => {
      setBars((prev) =>
        prev.map(() => {
          // Base random movement + audio level influence
          const base = 0.1 + Math.random() * 0.3;
          const levelBoost = audioLevel * 0.6;
          return Math.min(1, base + levelBoost);
        })
      );
    }, 100);

    return () => clearInterval(interval);
  }, [isRecording, audioLevel, barCount]);

  return (
    <div
      className={cn(
        'flex items-center justify-center gap-0.5 h-24 px-8',
        className
      )}
      role="img"
      aria-label={isRecording ? 'Audio waveform active' : 'Audio waveform idle'}
    >
      {bars.map((height, i) => (
        <div
          key={i}
          className={cn(
            'w-1 rounded-full transition-all duration-100',
            isRecording
              ? 'bg-blue-600 dark:bg-blue-500'
              : 'bg-gray-300 dark:bg-gray-700'
          )}
          style={{
            height: `${height * 100}%`,
            transform: `scaleY(${isRecording ? 1 : 0.5})`,
          }}
        />
      ))}
    </div>
  );
});

interface MiniWaveformProps {
  isActive?: boolean;
  seed?: string;
  barCount?: number;
  className?: string;
}

/**
 * MiniWaveform - Smaller waveform for list items and compact displays
 */
export const MiniWaveform = memo(function MiniWaveform({
  isActive = false,
  seed = 'default',
  barCount = 24,
  className,
}: MiniWaveformProps) {
  // Generate deterministic heights based on seed
  const heights = Array.from({ length: barCount }, (_, i) => {
    const hash = (seed.charCodeAt(i % seed.length) * (i + 1)) % 100;
    return 0.2 + (hash / 100) * 0.8;
  });

  return (
    <div
      className={cn(
        'flex items-center gap-[1px] h-8',
        className
      )}
      aria-hidden="true"
    >
      {heights.map((height, i) => (
        <div
          key={i}
          className={cn(
            'w-[2px] rounded-full transition-all duration-300',
            isActive
              ? 'bg-blue-600 dark:bg-blue-500'
              : 'bg-gray-300 dark:bg-gray-600'
          )}
          style={{
            height: `${height * 100}%`,
            animationDelay: isActive ? `${i * 30}ms` : '0ms',
          }}
        />
      ))}
    </div>
  );
});
