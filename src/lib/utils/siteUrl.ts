/**
 * Get the correct site URL based on environment
 * Fixes issue with incorrect redirect URLs (videod instead of video)
 * 
 * For auth redirects (password reset, email confirmation), ALWAYS use the configured
 * VITE_PUBLIC_URL instead of localhost, because:
 * 1. Supabase sends emails with the redirect URL embedded
 * 2. Users can't access localhost links from emails
 * 3. The app should be accessible at the configured public URL
 */
export function getSiteUrl(): string {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (isLocalhost) {
    return window.location.origin;
  }

  // Use PUBLIC_URL from environment, fallback to production domain
  return import.meta.env.VITE_PUBLIC_URL || 'https://app.use60.com';
}

/**
 * Get the correct redirect URL for authentication flows
 * 
 * IMPORTANT: For password reset and email confirmations, we MUST use the configured
 * VITE_PUBLIC_URL from environment variables, NEVER localhost. This is because:
 * 1. Supabase embeds this URL in the email link
 * 2. Users receive emails and need to click working links
 * 3. localhost links don't work for external email clients
 * 4. The email is sent from Supabase server, not from your dev machine
 * 
 * @param path - The path to redirect to (e.g., '/auth/reset-password')
 */
export function getAuthRedirectUrl(path: string): string {
  // ALWAYS use the configured VITE_PUBLIC_URL for auth flows
  // Never use localhost because Supabase embeds this URL in emails
  const publicUrl = import.meta.env.VITE_PUBLIC_URL || 'https://app.use60.com';
  
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${publicUrl}${normalizedPath}`;
}