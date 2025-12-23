/**
 * Get the correct site URL based on environment
 * Fixes issue with incorrect redirect URLs (videod instead of video)
 */
export function getSiteUrl(): string {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (isLocalhost) {
    return window.location.origin;
  }
  
  // Always use the correct production domain
  // This prevents issues with typos in redirect URLs
  return 'https://sales.sixtyseconds.video';
}

/**
 * Get the correct app URL based on environment
 * Returns the app domain (app.use60.com) for production, or current origin for dev
 */
export function getAppUrl(): string {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  if (isLocalhost) {
    return window.location.origin;
  }
  
  // Production app domain
  return 'https://app.use60.com';
}

/**
 * Get the correct login URL based on environment
 * Returns the login URL for the current environment
 */
export function getLoginUrl(): string {
  const appUrl = getAppUrl();
  return `${appUrl}/auth/login`;
}

/**
 * Get the correct redirect URL for authentication flows
 * @param path - The path to redirect to (e.g., '/auth/reset-password')
 */
export function getAuthRedirectUrl(path: string): string {
  // Auth redirects should always go to the app domain, not the landing site
  const appUrl = getAppUrl();
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${appUrl}${normalizedPath}`;
}