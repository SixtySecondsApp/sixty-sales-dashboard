/**
 * Meeting URL Extractor
 *
 * Extracts meeting URLs from Google Calendar events.
 * Supports: Google Meet, Zoom, Microsoft Teams, Webex, and other common platforms.
 */

// Regex patterns for common meeting platforms
const MEETING_URL_PATTERNS = [
  // Zoom
  /https?:\/\/[\w.-]*zoom\.us\/[jw]\/[\w?=&-]+/gi,
  // Microsoft Teams
  /https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"<>]+/gi,
  // Google Meet
  /https?:\/\/meet\.google\.com\/[a-z-]+/gi,
  // Webex
  /https?:\/\/[\w.-]*webex\.com\/[\w./]+/gi,
  // GoToMeeting
  /https?:\/\/[\w.-]*gotomeeting\.com\/join\/[\w-]+/gi,
  // Whereby
  /https?:\/\/whereby\.com\/[\w-]+/gi,
  // Around
  /https?:\/\/[\w.-]*around\.co\/[\w-]+/gi,
  // Jitsi
  /https?:\/\/meet\.jit\.si\/[\w-]+/gi,
  // BlueJeans
  /https?:\/\/[\w.-]*bluejeans\.com\/[\w./]+/gi,
  // Chime (AWS)
  /https?:\/\/chime\.aws\/[\w-]+/gi,
];

// Priority order for meeting platforms (prefer video meeting URLs)
const PLATFORM_PRIORITY: Record<string, number> = {
  'zoom.us': 1,
  'teams.microsoft.com': 2,
  'meet.google.com': 3,
  'webex.com': 4,
  'gotomeeting.com': 5,
  'whereby.com': 6,
  'around.co': 7,
  'meet.jit.si': 8,
  'bluejeans.com': 9,
  'chime.aws': 10,
};

/**
 * Get priority for a URL based on platform
 */
function getUrlPriority(url: string): number {
  for (const [domain, priority] of Object.entries(PLATFORM_PRIORITY)) {
    if (url.includes(domain)) {
      return priority;
    }
  }
  return 100; // Unknown platform
}

/**
 * Extract meeting URLs from text (description, location, etc.)
 */
export function extractMeetingUrlsFromText(text: string | null | undefined): string[] {
  if (!text) return [];

  const urls: string[] = [];

  for (const pattern of MEETING_URL_PATTERNS) {
    // Reset regex state
    pattern.lastIndex = 0;
    const matches = text.match(pattern);
    if (matches) {
      urls.push(...matches);
    }
  }

  // Deduplicate and sort by priority
  const uniqueUrls = [...new Set(urls)];
  return uniqueUrls.sort((a, b) => getUrlPriority(a) - getUrlPriority(b));
}

/**
 * Entry point type from Google Calendar conferenceData
 */
interface ConferenceEntryPoint {
  entryPointType?: string;
  uri?: string;
  label?: string;
}

/**
 * Conference data from Google Calendar event
 */
interface ConferenceData {
  entryPoints?: ConferenceEntryPoint[];
  conferenceSolution?: {
    name?: string;
  };
}

/**
 * Google Calendar event structure (partial)
 */
interface GoogleCalendarEvent {
  hangoutLink?: string;
  conferenceData?: ConferenceData;
  description?: string;
  location?: string;
}

/**
 * Extract the best meeting URL from a Google Calendar event
 *
 * Priority:
 * 1. hangoutLink (Google Meet - native integration)
 * 2. conferenceData.entryPoints (structured conference data for Zoom, etc.)
 * 3. Description text parsing (fallback for manually added links)
 * 4. Location field (sometimes contains meeting URLs)
 *
 * @param event - Google Calendar event object
 * @returns Best meeting URL or null
 */
export function extractMeetingUrl(event: GoogleCalendarEvent): string | null {
  const allUrls: string[] = [];

  // 1. Check hangoutLink (Google Meet native)
  if (event.hangoutLink) {
    allUrls.push(event.hangoutLink);
  }

  // 2. Check conferenceData.entryPoints (Zoom, Teams, etc. via Google integration)
  if (event.conferenceData?.entryPoints) {
    for (const entryPoint of event.conferenceData.entryPoints) {
      if (entryPoint.entryPointType === 'video' && entryPoint.uri) {
        allUrls.push(entryPoint.uri);
      }
    }
  }

  // 3. Parse description for meeting URLs
  const descriptionUrls = extractMeetingUrlsFromText(event.description);
  allUrls.push(...descriptionUrls);

  // 4. Parse location for meeting URLs (sometimes people put links there)
  const locationUrls = extractMeetingUrlsFromText(event.location);
  allUrls.push(...locationUrls);

  // Deduplicate and sort by priority
  const uniqueUrls = [...new Set(allUrls)];
  const sortedUrls = uniqueUrls.sort((a, b) => getUrlPriority(a) - getUrlPriority(b));

  // Return the highest priority URL
  return sortedUrls[0] || null;
}

/**
 * Determine the meeting platform from a URL
 */
export function getMeetingPlatform(url: string | null): 'zoom' | 'google_meet' | 'microsoft_teams' | 'webex' | 'other' | null {
  if (!url) return null;

  if (url.includes('zoom.us')) return 'zoom';
  if (url.includes('meet.google.com') || url.includes('hangouts.google.com')) return 'google_meet';
  if (url.includes('teams.microsoft.com')) return 'microsoft_teams';
  if (url.includes('webex.com')) return 'webex';

  // Check if it's any known meeting platform
  for (const domain of Object.keys(PLATFORM_PRIORITY)) {
    if (url.includes(domain)) return 'other';
  }

  return null;
}
