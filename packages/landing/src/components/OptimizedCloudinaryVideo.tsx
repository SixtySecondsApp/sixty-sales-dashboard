import { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Play } from 'lucide-react';
import { initializeVideoTracking } from '../lib/cloudinaryAnalytics';

interface OptimizedCloudinaryVideoProps {
  src: string;
  className?: string;
  onPlay?: () => void;
  onEnded?: () => void;
  autoPlay?: boolean;
  /** Enable Cloudinary video analytics tracking */
  analyticsEnabled?: boolean;
  /** Signup source identifier for split test tracking (e.g., 'intro-vsl') */
  signupSource?: string;
}

export interface OptimizedCloudinaryVideoRef {
  play: () => void;
  pause: () => void;
  isPlaying: boolean;
}

/**
 * Generates a poster/thumbnail URL from a Cloudinary video
 * Uses the first frame of the video as the poster image
 */
function getPosterUrl(rawUrl: string): string {
  // Match Cloudinary URL pattern - handles URL-encoded paths
  const cloudinaryPattern = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(v\d+\/)(.+)\.(mp4|webm|mov)$/;
  const match = rawUrl.match(cloudinaryPattern);

  if (match) {
    // Convert to image URL with first frame (so_0) and appropriate size
    return `${match[1]}so_0,w_1280/${match[2]}${match[3]}.jpg`;
  }

  return '';
}

export const OptimizedCloudinaryVideo = forwardRef<OptimizedCloudinaryVideoRef, OptimizedCloudinaryVideoProps>(
  ({ src, className = '', onPlay, onEnded, autoPlay = false, analyticsEnabled = true, signupSource }, ref) => {
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [isLoaded, setIsLoaded] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const cleanupRef = useRef<(() => void) | null>(null);

    // Use raw URL - Cloudinary handles optimization at delivery
    const posterUrl = getPosterUrl(src);

    // Initialize Cloudinary analytics tracking when video element is ready
    // Note: We initialize immediately when the video element has a src, not waiting for metadata
    // This ensures tracking works even if metadata loading is slow or blocked
    useEffect(() => {
      const video = videoRef.current;
      if (!analyticsEnabled || !video) return;

      // Wait for the video to have a source
      const videoSrc = video.src || video.currentSrc;
      if (!videoSrc) {
        console.log('[CloudinaryAnalytics] No video src yet, waiting...');
        return;
      }

      const initTracking = async () => {
        try {
          const cleanup = await initializeVideoTracking(video, {
            signupSource: signupSource,
          });
          cleanupRef.current = cleanup;
        } catch (error) {
          console.error('[CloudinaryAnalytics] Failed to initialize:', error);
        }
      };

      initTracking();

      return () => {
        if (cleanupRef.current) {
          cleanupRef.current();
          cleanupRef.current = null;
        }
      };
    }, [analyticsEnabled, src, signupSource]);

    useImperativeHandle(ref, () => ({
      play: () => {
        if (videoRef.current) {
          videoRef.current.play();
          setIsPlaying(true);
          setShowControls(true);
          onPlay?.();
        }
      },
      pause: () => {
        if (videoRef.current) {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      },
      isPlaying,
    }));

    const handlePlayClick = () => {
      if (videoRef.current) {
        videoRef.current.play();
        setIsPlaying(true);
        setShowControls(true);
        onPlay?.();
      }
    };

    const handleVideoEnded = () => {
      setIsPlaying(false);
      setShowControls(false);
      onEnded?.();
    };

    const handleLoadedData = () => {
      setIsLoaded(true);
      // Disable all text tracks (subtitles/captions) since they're burned into the video
      disableTextTracks();
    };

    // Disable all text tracks (subtitles/captions) - they're burned into the videos
    const disableTextTracks = () => {
      const video = videoRef.current;
      if (!video) return;

      const tracks = video.textTracks;
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = 'disabled';
      }
    };

    // Also listen for dynamically added tracks and disable them
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleTrackAdded = () => {
        disableTextTracks();
      };

      // Disable existing tracks
      disableTextTracks();

      // Listen for new tracks being added
      video.textTracks.addEventListener('addtrack', handleTrackAdded);

      return () => {
        video.textTracks.removeEventListener('addtrack', handleTrackAdded);
      };
    }, []);

    return (
      <div className={`relative rounded-2xl overflow-hidden backdrop-blur-2xl bg-gray-950 border border-white/10 shadow-2xl shadow-brand-violet/10 aspect-video ${className}`}>
        {/* Loading skeleton - shows until video metadata loads */}
        {!isLoaded && (
          <div className="absolute inset-0 bg-gray-950 flex items-center justify-center z-10">
            <div className="w-12 h-12 border-4 border-brand-violet/20 border-t-brand-violet rounded-full animate-spin" />
          </div>
        )}

        {/* Video Element */}
        <video
          ref={videoRef}
          src={src}
          poster={posterUrl}
          controls={showControls}
          playsInline
          webkit-playsinline="true"
          preload="metadata"
          className="w-full h-full object-contain bg-gray-950"
          onEnded={handleVideoEnded}
          onLoadedMetadata={handleLoadedData}
          onPlay={() => {
            setIsPlaying(true);
            setShowControls(true);
          }}
          onPause={() => setIsPlaying(false)}
        />

        {/* Play Button Overlay - only show when not playing and loaded */}
        {!isPlaying && isLoaded && (
          <button
            onClick={handlePlayClick}
            className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors group cursor-pointer z-20"
            aria-label="Play video"
          >
            <div className="relative">
              {/* Pulse Ring */}
              <div className="absolute inset-0 rounded-full bg-white/20 animate-ping" />
              {/* Play Icon - White circle with solid purple play */}
              <div className="relative bg-white rounded-full p-5 md:p-7 transition-all group-hover:scale-110 shadow-xl">
                <Play className="w-10 h-10 md:w-14 md:h-14 text-brand-violet fill-brand-violet ml-1" />
              </div>
            </div>
          </button>
        )}
      </div>
    );
  }
);

OptimizedCloudinaryVideo.displayName = 'OptimizedCloudinaryVideo';

export default OptimizedCloudinaryVideo;
