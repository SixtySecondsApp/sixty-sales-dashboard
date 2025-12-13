// Version configuration for cache busting and update management
export const APP_VERSION = '2.1.4'; // Increment this with each release
export const BUILD_DATE = new Date().toISOString();
export const VERSION_KEY = 'sixty_app_version';
export const LAST_UPDATED_KEY = 'sixty_last_updated';

function isAuthStorageKey(key: string): boolean {
  const k = key.toLowerCase();
  return (
    // Supabase default + custom keys
    k.startsWith('sb-') || // e.g. sb-<project-ref>-auth-token
    k.startsWith('sb.') || // e.g. sb.auth.v3.optimized, sb.auth.admin.v3
    k.includes('supabase') ||
    // Clerk commonly uses cookies, but can also use storage keys in some setups
    k.includes('clerk') ||
    k.startsWith('__clerk')
  );
}

// Check if user has outdated version
export function isOutdatedVersion(): boolean {
  const storedVersion = localStorage.getItem(VERSION_KEY);
  return storedVersion !== APP_VERSION;
}

// Update stored version
export function updateStoredVersion(): void {
  localStorage.setItem(VERSION_KEY, APP_VERSION);
  localStorage.setItem(LAST_UPDATED_KEY, BUILD_DATE);
}

// Clear all cache and session data (preserves authentication)
export function clearCacheAndReload(): void {
  // Preserve Supabase auth tokens before clearing
  const authKeys: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && isAuthStorageKey(key)) {
      authKeys[key] = localStorage.getItem(key) || '';
    }
  }

  // Clear localStorage
  localStorage.clear();

  // Restore auth tokens
  Object.entries(authKeys).forEach(([key, value]) => {
    localStorage.setItem(key, value);
  });

  // Clear sessionStorage (keep auth-related items)
  const sessionAuthKeys: Record<string, string> = {};
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && isAuthStorageKey(key)) {
      sessionAuthKeys[key] = sessionStorage.getItem(key) || '';
    }
  }
  sessionStorage.clear();
  Object.entries(sessionAuthKeys).forEach(([key, value]) => {
    sessionStorage.setItem(key, value);
  });

  // NOTE:
  // We intentionally do NOT clear cookies here.
  // Cookie clearing will log users out when using cookie-based auth (e.g., Clerk),
  // and it's not required to resolve stale JS/CSS asset caching issues.

  // Clear service worker caches if available
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name);
      });
    });
  }
  
  // Unregister service workers
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        registration.unregister();
      });
    });
  }
  
  // Force reload from server (bypass cache)
  // Use replace to avoid adding to history, and add cache-busting parameter
  const url = new URL(window.location.href);
  url.searchParams.set('_cacheBust', Date.now().toString());
  window.location.replace(url.toString());
}

// Get version info
export function getVersionInfo() {
  return {
    version: APP_VERSION,
    buildDate: BUILD_DATE,
    lastUpdated: localStorage.getItem(LAST_UPDATED_KEY) || 'Never',
    isOutdated: isOutdatedVersion()
  };
}