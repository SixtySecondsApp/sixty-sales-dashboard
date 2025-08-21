/**
 * Optimized Image Component with Modern Loading Strategies
 * 
 * This component provides:
 * - Lazy loading with intersection observer
 * - Modern format support (WebP, AVIF)
 * - Responsive image loading
 * - Blur placeholder support
 * - Error handling and fallbacks
 */

import React, { useState, useRef, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  priority?: boolean; // Load immediately for above-the-fold content
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  fallbackSrc?: string;
  onLoad?: () => void;
  onError?: () => void;
}

// Generate blur placeholder from dimensions
const generateBlurDataURL = (width: number = 10, height: number = 10): string => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    // Create a simple gradient blur effect
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f3f4f6');
    gradient.addColorStop(0.5, '#e5e7eb');
    gradient.addColorStop(1, '#d1d5db');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  
  return canvas.toDataURL();
};

// Check WebP support
const checkWebPSupport = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2);
    };
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
};

// Check AVIF support
const checkAVIFSupport = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const avif = new Image();
    avif.onload = avif.onerror = () => {
      resolve(avif.height === 2);
    };
    avif.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=';
  });
};

// Format support cache
let formatSupport: { webp: boolean | null; avif: boolean | null } = {
  webp: null,
  avif: null
};

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  className = '',
  sizes,
  priority = false,
  placeholder = 'blur',
  blurDataURL,
  fallbackSrc,
  onLoad,
  onError
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [optimizedSrc, setOptimizedSrc] = useState(src);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Check format support and optimize src
  useEffect(() => {
    const optimizeSrc = async () => {
      // Check format support if not cached
      if (formatSupport.webp === null) {
        formatSupport.webp = await checkWebPSupport();
      }
      if (formatSupport.avif === null) {
        formatSupport.avif = await checkAVIFSupport();
      }

      // Generate optimized src based on format support
      let newSrc = src;
      
      // Simple format replacement (in real app, you'd use a CDN or image service)
      if (formatSupport.avif && src.includes('.jpg') || src.includes('.png')) {
        newSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.avif');
      } else if (formatSupport.webp && src.includes('.jpg') || src.includes('.png')) {
        newSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      }

      // Add responsive parameters if width/height provided
      if (width && height) {
        const separator = newSrc.includes('?') ? '&' : '?';
        newSrc = `${newSrc}${separator}w=${width}&h=${height}&q=80`;
      }

      setOptimizedSrc(newSrc);
    };

    if (!priority) {
      optimizeSrc();
    }
  }, [src, width, height, priority]);

  // Intersection Observer setup
  useEffect(() => {
    if (priority || isInView) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observerRef.current?.disconnect();
        }
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.1
      }
    );

    if (imgRef.current) {
      observerRef.current.observe(imgRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [priority, isInView]);

  // Handle image load
  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  // Handle image error
  const handleError = () => {
    setHasError(true);
    onError?.();
    
    // Try fallback src if provided
    if (fallbackSrc && optimizedSrc !== fallbackSrc) {
      setOptimizedSrc(fallbackSrc);
      setHasError(false); // Reset error state for fallback attempt
    }
  };

  // Generate blur placeholder
  const blurPlaceholder = blurDataURL || (
    placeholder === 'blur' ? generateBlurDataURL(width, height) : undefined
  );

  const shouldShowPlaceholder = placeholder !== 'empty' && !isLoaded && !hasError;
  const shouldLoadImage = priority || isInView;

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      style={{ 
        width: width ? `${width}px` : undefined, 
        height: height ? `${height}px` : undefined 
      }}
    >
      {/* Blur placeholder */}
      {shouldShowPlaceholder && blurPlaceholder && (
        <img
          src={blurPlaceholder}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
          style={{
            filter: 'blur(20px)',
            transform: 'scale(1.1)', // Prevent blur edge artifacts
            opacity: isLoaded ? 0 : 1
          }}
          aria-hidden="true"
        />
      )}

      {/* Main image */}
      {shouldLoadImage && (
        <img
          ref={imgRef}
          src={optimizedSrc}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={handleLoad}
          onError={handleError}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />
      )}

      {/* Error state */}
      {hasError && !fallbackSrc && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-2 opacity-50">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm">Failed to load image</p>
          </div>
        </div>
      )}

      {/* Loading indicator for priority images */}
      {priority && !isLoaded && !hasError && placeholder === 'empty' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
        </div>
      )}
    </div>
  );
};

// Hook for preloading images
export const useImagePreloader = () => {
  const preloadImage = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = src;
    });
  };

  const preloadImages = async (srcs: string[]): Promise<void> => {
    try {
      await Promise.all(srcs.map(preloadImage));
    } catch (error) {
      console.warn('Some images failed to preload:', error);
    }
  };

  return { preloadImage, preloadImages };
};

// Higher-order component for images with performance optimization
export const withImageOptimization = <P extends object>(
  WrappedComponent: React.ComponentType<P>
) => {
  return React.memo((props: P) => {
    // Add performance optimizations here if needed
    return <WrappedComponent {...props} />;
  });
};

export default OptimizedImage;