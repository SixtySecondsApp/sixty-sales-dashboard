/**
 * Cloudinary Video Analytics Helper
 *
 * Provides tracking functionality for HTML5 videos using cloudinary-video-analytics.
 * Maps video URLs to public IDs and signup sources for split testing analytics.
 */

// VSL video configuration - maps routes to video data
export const VSL_VIDEO_CONFIG = {
  'intro-vsl': {
    publicId: '60 VSL - Waitlist/Videos for waitlist launch/VSL_Sales_Version_xmfmf0',
    name: 'Sales Rep Version',
    route: '/intro',
  },
  'introducing-vsl': {
    publicId: '60 VSL - Waitlist/Videos for waitlist launch/VSL_Founder_Version_gopdl9',
    name: 'Founder Version',
    route: '/introducing',
  },
  'introduction-vsl': {
    publicId: '60 VSL - Waitlist/Videos for waitlist launch/VSL_Drues_Version_jlhqog',
    name: "Product Version",
    route: '/introduction',
  },
} as const;

export type VSLVariantId = keyof typeof VSL_VIDEO_CONFIG;

const CLOUD_NAME = 'sixty-seconds';

/**
 * Extract public ID from a Cloudinary video URL
 */
export function extractPublicIdFromUrl(url: string): string | null {
  // Match pattern: https://res.cloudinary.com/sixty-seconds/video/upload/v1234567890/path/to/video.mp4
  const match = url.match(/\/video\/upload\/v\d+\/(.+)\.(mp4|webm|mov)$/);
  if (match) {
    // URL decode the path (handles spaces as %20)
    return decodeURIComponent(match[1]);
  }
  return null;
}

/**
 * Find the VSL variant ID based on the video URL
 */
export function getVariantIdFromUrl(url: string): VSLVariantId | null {
  const publicId = extractPublicIdFromUrl(url);
  if (!publicId) return null;

  for (const [variantId, config] of Object.entries(VSL_VIDEO_CONFIG)) {
    if (config.publicId === publicId) {
      return variantId as VSLVariantId;
    }
  }
  return null;
}

/**
 * Initialize Cloudinary video analytics tracking on an HTML5 video element.
 * Uses the cloudinary-video-analytics library with the correct API:
 * connectCloudinaryAnalytics() -> startManualTracking()
 */
export async function initializeVideoTracking(
  videoElement: HTMLVideoElement,
  options: {
    signupSource?: string;
    publicId?: string;
  } = {}
): Promise<(() => void) | null> {
  try {
    // Dynamically import to avoid SSR issues
    const { connectCloudinaryAnalytics } = await import('cloudinary-video-analytics');

    // Get public ID from URL if not provided
    const videoUrl = videoElement.src || videoElement.currentSrc;
    const publicId = options.publicId || extractPublicIdFromUrl(videoUrl);

    if (!publicId) {
      console.warn('[CloudinaryAnalytics] Could not extract public ID from video URL:', videoUrl);
      return null;
    }

    // Connect analytics to the video element (correct API)
    const analytics = connectCloudinaryAnalytics(videoElement);

    // Start manual tracking with cloud name and public ID
    // Manual tracking is required for HTML5 video elements with raw URLs
    analytics.startManualTracking({
      cloudName: CLOUD_NAME,
      publicId: publicId,
    });

    console.log('[CloudinaryAnalytics] Tracking initialized for:', publicId, '| Source:', options.signupSource);

    // Return cleanup function
    return () => {
      try {
        analytics.stopManualTracking();
        console.log('[CloudinaryAnalytics] Tracking stopped for:', publicId);
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  } catch (error) {
    console.error('[CloudinaryAnalytics] Failed to initialize tracking:', error);
    return null;
  }
}

/**
 * Get all available VSL variants for the dashboard
 */
export function getVSLVariants() {
  return Object.entries(VSL_VIDEO_CONFIG).map(([id, config]) => ({
    id: id as VSLVariantId,
    ...config,
  }));
}
