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
  return 'https://app.use60.com';
}

/**
 * Get the correct redirect URL for authentication flows
 * @param path - The path to redirect to (e.g., '/auth/reset-password')
 */
export function getAuthRedirectUrl(path: string): string {
  const siteUrl = getSiteUrl();
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl}${normalizedPath}`;
}