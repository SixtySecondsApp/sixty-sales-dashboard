import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Play, Pause, Loader2, AlertCircle, Volume2, VolumeX } from 'lucide-react';
import { voiceRecordingService } from '@/lib/services/voiceRecordingService';
import { StackedSpeakerWaveforms } from './StackedSpeakerWaveforms';
import { cn } from '@/lib/utils';

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

interface VoiceMeetingPlayerProps {
  voiceRecordingId: string;
  speakers: Speaker[];
  transcriptSegments: TranscriptSegment[];
  durationSeconds: number;
  shareToken?: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
}

const formatTime = (seconds: number): string => {
  if (!seconds || !isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * VoiceMeetingPlayer - Combined audio player with stacked speaker waveforms
 * Used in MeetingDetail page for voice meetings (source_type === 'voice')
 */
export const VoiceMeetingPlayer = memo(function VoiceMeetingPlayer({
  voiceRecordingId,
  speakers,
  transcriptSegments,
  durationSeconds,
  shareToken,
  className,
  onTimeUpdate,
}: VoiceMeetingPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const urlCacheRef = useRef<{ url: string; expiry: number } | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Fetch presigned URL for audio playback
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
      const result = await voiceRecordingService.getAudioPlaybackUrl(voiceRecordingId, shareToken);
      if (result) {
        const cacheExpiry = now + 45 * 60 * 1000; // 45 minutes
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
  }, [voiceRecordingId, shareToken]);

  // Toggle play/pause
  const togglePlayPause = useCallback(async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
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

  // Seek to specific time
  const handleSeek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !audioRef.current.muted;
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

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
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleError = () => {
      setError('Audio playback error');
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [onTimeUpdate]);

  // Preload audio URL on mount
  useEffect(() => {
    fetchAudioUrl();
  }, [fetchAudioUrl]);

  const validDuration = duration > 0 && isFinite(duration) ? duration : durationSeconds;
  const validCurrentTime = currentTime >= 0 && isFinite(currentTime) ? currentTime : 0;
  const progressPercentage = validDuration > 0 ? Math.min((validCurrentTime / validDuration) * 100, 100) : 0;

  return (
    <div className={cn('bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 space-y-4', className)}>
      {/* Hidden audio element */}
      <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" />

      {/* Player Controls */}
      <div className="flex items-center gap-4">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlayPause}
          disabled={isLoading || !!error}
          className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shrink-0',
            error
              ? 'bg-red-500/20 text-red-400 cursor-not-allowed'
              : 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30'
          )}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : error ? (
            <AlertCircle className="w-6 h-6" />
          ) : isPlaying ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-1" />
          )}
        </button>

        {/* Progress Bar and Time */}
        <div className="flex-1 flex flex-col gap-1.5">
          {/* Progress Bar */}
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const percentage = clickX / rect.width;
              handleSeek(percentage * validDuration);
            }}
            className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer overflow-hidden group"
          >
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-100 group-hover:bg-emerald-400"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Time Display */}
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{formatTime(validCurrentTime)}</span>
            <span>{validDuration > 0 ? formatTime(validDuration) : '--:--'}</span>
          </div>
        </div>

        {/* Mute Button */}
        <button
          onClick={toggleMute}
          className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-500 dark:text-red-400">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Stacked Speaker Waveforms */}
      {speakers.length > 0 && (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Speakers
          </h4>
          <StackedSpeakerWaveforms
            speakers={speakers}
            transcriptSegments={transcriptSegments}
            currentTime={validCurrentTime}
            duration={validDuration}
            onSeek={handleSeek}
            isPlaying={isPlaying}
          />
        </div>
      )}
    </div>
  );
});

export default VoiceMeetingPlayer;
