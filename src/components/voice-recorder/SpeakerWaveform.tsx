import { useRef, useMemo, memo } from 'react';
import { cn } from '@/lib/utils';
import type { Speaker } from './types';

interface SpeakerWaveformProps {
  speaker: Speaker;
  isActive: boolean;
  onTap: () => void;
  /** Optional real amplitude data from audio analysis (values 0-1) */
  amplitudeData?: number[];
  /** Speaker's transcript segments for generating realistic patterns */
  segmentLengths?: number[];
  className?: string;
}

/**
 * Generate realistic waveform pattern based on speaking characteristics
 * Uses segment lengths and speaker ID to create unique, natural-looking waveforms
 */
function generateWaveformPattern(speakerId: number, bars: number, segmentLengths?: number[]): number[] {
  // Seed the random generator with speaker ID for consistency
  const seed = speakerId * 12345;
  const seededRandom = (n: number) => {
    const x = Math.sin(seed + n) * 10000;
    return x - Math.floor(x);
  };

  // If we have segment lengths, use them to influence the pattern
  const segmentInfluence = segmentLengths?.length
    ? segmentLengths.reduce((acc, len, idx) => acc + len * (idx + 1), 0) % 100
    : 0;

  return Array.from({ length: bars }, (_, i) => {
    // Create multiple sine waves for organic feel
    const wave1 = Math.sin((i / bars) * Math.PI * 2 * (1 + speakerId % 3)) * 0.3;
    const wave2 = Math.sin((i / bars) * Math.PI * 4 + speakerId) * 0.2;
    const wave3 = Math.sin((i / bars) * Math.PI * 6 + segmentInfluence * 0.1) * 0.1;

    // Add some controlled randomness
    const noise = seededRandom(i) * 0.25;

    // Combine waves with noise and normalize to 0.15-1.0 range
    const combined = 0.5 + wave1 + wave2 + wave3 + noise;
    return Math.max(0.15, Math.min(1.0, combined));
  });
}

/**
 * SpeakerWaveform - Displays a speaker's audio segment with visual waveform
 * Used in the meeting detail view for speaker-attributed playback
 *
 * Now supports:
 * - Real amplitude data from audio analysis
 * - Segment-based pattern generation for more realistic waveforms
 * - Fallback to speaker ID-based deterministic patterns
 */
export const SpeakerWaveform = memo(function SpeakerWaveform({
  speaker,
  isActive,
  onTap,
  amplitudeData,
  segmentLengths,
  className,
}: SpeakerWaveformProps) {
  const bars = 40;

  // Use real amplitude data if provided, otherwise generate pattern
  const waveformData = useMemo(() => {
    if (amplitudeData && amplitudeData.length > 0) {
      // Resample amplitude data to match number of bars
      const step = amplitudeData.length / bars;
      return Array.from({ length: bars }, (_, i) => {
        const startIdx = Math.floor(i * step);
        const endIdx = Math.floor((i + 1) * step);
        // Average the values in this range
        let sum = 0;
        let count = 0;
        for (let j = startIdx; j < endIdx && j < amplitudeData.length; j++) {
          sum += amplitudeData[j];
          count++;
        }
        const avg = count > 0 ? sum / count : 0.5;
        return Math.max(0.15, Math.min(1.0, avg));
      });
    }

    // Generate realistic pattern based on speaker characteristics
    return generateWaveformPattern(speaker.id, bars, segmentLengths);
  }, [speaker.id, bars, amplitudeData, segmentLengths]);

  return (
    <button
      onClick={onTap}
      className={cn(
        'w-full p-4 rounded-2xl transition-all duration-300 text-left shadow-sm dark:shadow-none border',
        isActive
          ? 'bg-gray-100 dark:bg-gray-800/80 dark:backdrop-blur-sm scale-[1.02] ring-2 ring-emerald-500/20 border-gray-200 dark:border-gray-700/50'
          : 'bg-gray-50 dark:bg-gray-900/80 dark:backdrop-blur-sm hover:bg-gray-100 dark:hover:bg-gray-800/50 border-gray-200 dark:border-gray-700/50',
        className
      )}
    >
      {/* Speaker Info */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold text-sm shrink-0"
          style={{ backgroundColor: speaker.color }}
        >
          {speaker.initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-200 truncate">
            {speaker.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {speaker.duration}
          </p>
        </div>
        {isActive && (
          <div className="w-2 h-2 rounded-full bg-[#37bd7e] animate-pulse shrink-0" />
        )}
      </div>

      {/* Waveform Visualization */}
      <div className="flex items-center gap-0.5 h-12">
        {waveformData.map((height, i) => (
          <div
            key={i}
            className="flex-1 rounded-full transition-all duration-150"
            style={{
              height: `${height * 100}%`,
              backgroundColor: isActive ? speaker.color : `${speaker.color}40`,
              opacity: isActive ? 1 : 0.5,
              animation: isActive
                ? `waveform ${0.3 + (i % 5) * 0.1}s ease-in-out infinite alternate`
                : 'none',
              animationDelay: `${i * 15}ms`,
            }}
          />
        ))}
      </div>

      {/* CSS for waveform animation */}
      <style>{`
        @keyframes waveform {
          0% { transform: scaleY(0.6); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </button>
  );
});

interface SpeakerAvatarProps {
  name: string;
  initials: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * SpeakerAvatar - Colored avatar for speaker identification
 */
export const SpeakerAvatar = memo(function SpeakerAvatar({
  name,
  initials,
  color,
  size = 'md',
  className,
}: SpeakerAvatarProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
  };

  return (
    <div
      className={cn(
        'rounded-xl flex items-center justify-center text-white font-semibold shrink-0',
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: color }}
      title={name}
    >
      {initials}
    </div>
  );
});

// Predefined speaker colors for consistent visual identity
export const SPEAKER_COLORS = [
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#6366F1', // Indigo
  '#84CC16', // Lime
] as const;

/**
 * Get a consistent color for a speaker based on their index or ID
 */
export function getSpeakerColor(index: number): string {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length];
}

/**
 * Generate initials from a name
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
