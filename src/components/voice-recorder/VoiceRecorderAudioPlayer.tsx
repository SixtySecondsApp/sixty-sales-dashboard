import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause, Loader2, AlertCircle } from 'lucide-react';
import { voiceRecordingService } from '@/lib/services/voiceRecordingService';

interface VoiceRecorderAudioPlayerProps {
  recordingId: string;
  durationSeconds?: number;
  shareToken?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  className?: string;
}

export interface AudioPlayerRef {
  seek: (time: number) => void;
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
}

const formatTime = (seconds: number): string => {
  // Handle invalid values
  if (!seconds || !isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const VoiceRecorderAudioPlayer = forwardRef<AudioPlayerRef, VoiceRecorderAudioPlayerProps>(
  ({ recordingId, durationSeconds = 0, shareToken, onTimeUpdate, onPlayStateChange, className = '' }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);
    const urlCacheRef = useRef<{ url: string; expiry: number } | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(durationSeconds || 0);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isAudioReady, setIsAudioReady] = useState(false);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      seek: (time: number) => {
        if (audioRef.current) {
          audioRef.current.currentTime = time;
          setCurrentTime(time);
        }
      },
      play: () => {
        audioRef.current?.play();
      },
      pause: () => {
        audioRef.current?.pause();
      },
      getCurrentTime: () => audioRef.current?.currentTime || 0,
    }));

    // Fetch presigned URL
    const fetchAudioUrl = useCallback(async () => {
      // Check cache (valid for 45 minutes)
      const now = Date.now();
      if (urlCacheRef.current && urlCacheRef.current.expiry > now) {
        setAudioUrl(urlCacheRef.current.url);
        return urlCacheRef.current.url;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await voiceRecordingService.getAudioPlaybackUrl(recordingId, shareToken);
        if (result) {
          const cacheExpiry = now + (45 * 60 * 1000); // 45 minutes
          urlCacheRef.current = { url: result.url, expiry: cacheExpiry };
          setAudioUrl(result.url);
          return result.url;
        } else {
          setError('Failed to load audio');
          return null;
        }
      } catch (err) {
        console.error('Error fetching audio URL:', err);
        setError('Failed to load audio');
        return null;
      } finally {
        setIsLoading(false);
      }
    }, [recordingId, shareToken]);

    // Handle play/pause toggle
    const togglePlayPause = useCallback(async () => {
      if (!audioRef.current) return;

      if (isPlaying) {
        audioRef.current.pause();
      } else {
        // Ensure we have a URL
        if (!audioUrl) {
          const url = await fetchAudioUrl();
          if (!url) return;
        }
        try {
          await audioRef.current.play();
        } catch (err) {
          console.error('Playback error:', err);
          setError('Playback failed');
        }
      }
    }, [isPlaying, audioUrl, fetchAudioUrl]);

    // Handle progress bar click
    const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !audioRef.current) return;

      const rect = progressRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      const newTime = percentage * duration;

      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }, [duration]);

    // Audio event handlers
    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;

      const handleTimeUpdate = () => {
        const time = audio.currentTime;
        setCurrentTime(time);
        onTimeUpdate?.(time);
      };

      const handleLoadedMetadata = () => {
        if (audio.duration && isFinite(audio.duration) && !isNaN(audio.duration)) {
          setDuration(audio.duration);
          setIsAudioReady(true);
        }
      };

      const handleCanPlay = () => {
        setIsAudioReady(true);
        // Try to get duration again when audio can play
        if (audio.duration && isFinite(audio.duration) && !isNaN(audio.duration)) {
          setDuration(audio.duration);
        }
      };

      const handleDurationChange = () => {
        if (audio.duration && isFinite(audio.duration) && !isNaN(audio.duration)) {
          setDuration(audio.duration);
        }
      };

      const handlePlay = () => {
        setIsPlaying(true);
        onPlayStateChange?.(true);
      };

      const handlePause = () => {
        setIsPlaying(false);
        onPlayStateChange?.(false);
      };

      const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        onPlayStateChange?.(false);
      };

      const handleError = () => {
        setError('Audio playback error');
        setIsPlaying(false);
      };

      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('canplay', handleCanPlay);
      audio.addEventListener('durationchange', handleDurationChange);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);

      return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('durationchange', handleDurationChange);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
      };
    }, [onTimeUpdate, onPlayStateChange]);

    // Preload audio URL on mount
    useEffect(() => {
      fetchAudioUrl();
    }, [fetchAudioUrl]);

    // Calculate progress percentage, ensuring valid values
    const validDuration = duration > 0 && isFinite(duration) ? duration : 0;
    const validCurrentTime = currentTime >= 0 && isFinite(currentTime) ? currentTime : 0;
    const progressPercentage = validDuration > 0 ? Math.min((validCurrentTime / validDuration) * 100, 100) : 0;

    return (
      <div className={`flex items-center gap-4 ${className}`}>
        {/* Hidden audio element */}
        <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" />

        {/* Play/Pause Button */}
        <button
          onClick={togglePlayPause}
          disabled={isLoading || !!error}
          className={`
            w-12 h-12 rounded-full flex items-center justify-center
            transition-all duration-200
            ${error
              ? 'bg-red-500/20 text-red-400 cursor-not-allowed'
              : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30'
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : error ? (
            <AlertCircle className="w-5 h-5" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" />
          )}
        </button>

        {/* Progress Bar and Time */}
        <div className="flex-1 flex flex-col gap-1">
          {/* Progress Bar */}
          <div
            ref={progressRef}
            onClick={handleProgressClick}
            className="h-2 bg-gray-700 rounded-full cursor-pointer overflow-hidden group"
          >
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-100 group-hover:bg-emerald-400"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Time Display */}
          <div className="flex justify-between text-xs text-gray-400">
            <span>{formatTime(validCurrentTime)}</span>
            <span>{validDuration > 0 ? formatTime(validDuration) : '--:--'}</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <span className="text-xs text-red-400">{error}</span>
        )}
      </div>
    );
  }
);

VoiceRecorderAudioPlayer.displayName = 'VoiceRecorderAudioPlayer';

export default VoiceRecorderAudioPlayer;
