/**
 * Normalize registration URL by removing trailing slashes
 * Converts "/waitlist/" to "/waitlist" but keeps "/" as "/"
 * Preserves query parameters
 */
export function normalizeRegistrationUrl(url: string): string {
  if (!url) return url;
  
  // Split URL into pathname and search params
  const [pathname, search = ''] = url.split('?');
  
  // Remove trailing slashes from pathname, but keep "/" as "/"
  const normalizedPathname = pathname === '/' 
    ? '/' 
    : pathname.replace(/\/+$/, '');
  
  // Recombine with search params
  return search ? `${normalizedPathname}?${search}` : normalizedPathname;
}

/**
 * Capture and normalize registration URL from window.location
 */
export function captureRegistrationUrl(): string {
  if (typeof window === 'undefined') {
    return '/waitlist';
  }
  
  const pathname = window.location.pathname;
  const search = window.location.search;
  const fullUrl = pathname + search;
  
  return normalizeRegistrationUrl(fullUrl);
}
