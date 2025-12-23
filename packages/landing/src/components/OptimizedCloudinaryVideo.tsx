import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { Play } from 'lucide-react';

interface OptimizedCloudinaryVideoProps {
  src: string;
  className?: string;
  onPlay?: () => void;
  onEnded?: () => void;
  autoPlay?: boolean;
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
  ({ src, className = '', onPlay, onEnded, autoPlay = false }, ref) => {
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [isLoaded, setIsLoaded] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Use raw URL - Cloudinary handles optimization at delivery
    const posterUrl = getPosterUrl(src);

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
    };

    return (
      <div className={`relative rounded-2xl overflow-hidden backdrop-blur-2xl bg-white/5 border border-white/10 shadow-2xl shadow-brand-violet/10 ${className}`}>
        {/* Loading skeleton - shows until video metadata loads */}
        {!isLoaded && (
          <div className="absolute inset-0 bg-gray-900 animate-pulse flex items-center justify-center z-10">
            <div className="w-16 h-16 border-4 border-brand-violet/30 border-t-brand-violet rounded-full animate-spin" />
          </div>
        )}

        {/* Video Element */}
        <video
          ref={videoRef}
          src={src}
          poster={posterUrl}
          controls={showControls}
          playsInline
          preload="metadata"
          className="w-full aspect-video bg-gray-900"
          onEnded={handleVideoEnded}
          onLoadedData={handleLoadedData}
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
