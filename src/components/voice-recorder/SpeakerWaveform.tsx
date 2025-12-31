import { useRef, memo } from 'react';
import { cn } from '@/lib/utils';
import type { Speaker } from './types';

interface SpeakerWaveformProps {
  speaker: Speaker;
  isActive: boolean;
  onTap: () => void;
  className?: string;
}

/**
 * SpeakerWaveform - Displays a speaker's audio segment with visual waveform
 * Used in the meeting detail view for speaker-attributed playback
 */
export const SpeakerWaveform = memo(function SpeakerWaveform({
  speaker,
  isActive,
  onTap,
  className,
}: SpeakerWaveformProps) {
  const bars = 40;

  // Generate deterministic waveform data based on speaker
  const waveformData = useRef(
    Array.from({ length: bars }, (_, i) => {
      // Create unique pattern based on speaker id and position
      const hash = (speaker.id * 17 + i * 31) % 100;
      return 0.2 + (hash / 100) * 0.8;
    })
  ).current;

  return (
    <button
      onClick={onTap}
      className={cn(
        'w-full p-4 rounded-2xl transition-all duration-300 text-left shadow-sm dark:shadow-none border',
        isActive
          ? 'bg-gray-100 dark:bg-gray-800/80 dark:backdrop-blur-sm scale-[1.02] ring-2 ring-blue-500/20 border-gray-200 dark:border-gray-700/50'
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
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
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
