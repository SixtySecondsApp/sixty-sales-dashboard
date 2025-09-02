// Version configuration for cache busting and update management
export const APP_VERSION = '2.1.3'; // Increment this with each release
export const BUILD_DATE = new Date().toISOString();
export const VERSION_KEY = 'sixty_app_version';
export const LAST_UPDATED_KEY = 'sixty_last_updated';

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

// Clear all cache and session data
export function clearCacheAndReload(): void {
  // Clear localStorage
  localStorage.clear();
  
  // Clear sessionStorage
  sessionStorage.clear();
  
  // Clear all cookies
  document.cookie.split(";").forEach((c) => {
    document.cookie = c
      .replace(/^ +/, "")
      .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
  
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
  window.location.reload(true);
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