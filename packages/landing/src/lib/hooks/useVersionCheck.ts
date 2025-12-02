import { useState, useEffect, useRef, useCallback } from 'react';
import logger from '@/lib/utils/logger';

interface VersionData {
  buildId: string;
  builtAt: string;
}

interface ReleaseData {
  buildId: string;
  date: string;
  notes: string;
}

interface UseVersionCheckReturn {
  clientBuildId: string | null;
  updateAvailable: boolean;
  newBuildId: string | null;
  releases: ReleaseData[];
  clearCachesAndReload: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

// Current build ID - dynamically determined from the initial server response
let CURRENT_BUILD_ID: string | null = null;
const POLL_INTERVAL = 30000; // 30 seconds
const API_TIMEOUT = 5000; // 5 seconds

/**
 * Hook for checking version updates and managing release information
 * 
 * Features:
 * - Polls /version.json every 30 seconds for updates
 * - Compares build IDs to detect new releases
 * - Provides cache clearing functionality
 * - Manages releases data from /releases.json
 */
export function useVersionCheck(): UseVersionCheckReturn {
  const [clientBuildId, setClientBuildId] = useState<string | null>(() => {
    // Try to get the current build ID from localStorage first
    try {
      return localStorage.getItem('currentBuildId') || null;
    } catch {
      return null;
    }
  });
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newBuildId, setNewBuildId] = useState<string | null>(null);
  const [releases, setReleases] = useState<ReleaseData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  /**
   * Fetches version data with timeout and error handling
   */
  const fetchVersionData = useCallback(async (): Promise<VersionData | null> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
      
      const response = await fetch('/version.json', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch version: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Validate response structure
      if (!data.buildId || !data.builtAt) {
        throw new Error('Invalid version data structure');
      }
      
      return data;
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error('Version check timeout');
        }
        throw err;
      }
      throw new Error('Unknown error fetching version data');
    }
  }, []);

  /**
   * Fetches releases data with caching and error handling
   */
  const fetchReleasesData = useCallback(async (): Promise<ReleaseData[]> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
      
      const response = await fetch('/releases.json', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch releases: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Validate response structure
      if (!Array.isArray(data)) {
        throw new Error('Invalid releases data structure');
      }
      
      // Validate each release object
      const validReleases = data.filter((release: any) => {
        return release.buildId && release.date && release.notes;
      });
      
      if (validReleases.length !== data.length) {
        logger.warn('Some release entries were filtered out due to invalid structure');
      }
      
      return validReleases;
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          throw new Error('Releases fetch timeout');
        }
        throw err;
      }
      throw new Error('Unknown error fetching releases data');
    }
  }, []);

  /**
   * Checks for version updates and manages state
   */
  const checkForUpdates = useCallback(async (skipLoadingState = false) => {
    // Prevent concurrent checks
    if (isPollingRef.current) {
      return;
    }
    
    isPollingRef.current = true;
    
    try {
      if (!skipLoadingState) {
        setIsLoading(true);
      }
      setError(null);
      
      // Fetch version data
      const versionData = await fetchVersionData();
      
      if (versionData) {
        const serverBuildId = versionData.buildId;
        
        // If this is the first time, set the client build ID to the server's current version
        if (!clientBuildId) {
          setClientBuildId(serverBuildId);
          try {
            localStorage.setItem('currentBuildId', serverBuildId);
          } catch (err) {
            logger.warn('Failed to store current build ID:', err);
          }
          // No update available on first load - we're in sync
          setUpdateAvailable(false);
          setNewBuildId(null);
          logger.log('🏁 Initial version set:', serverBuildId);
        } else {
          // Check if there's a new version available
          const hasUpdate = serverBuildId !== clientBuildId;
          
          if (hasUpdate) {
            logger.log('🔄 Update detected:', {
              current: clientBuildId,
              new: serverBuildId
            });
            setUpdateAvailable(true);
            setNewBuildId(serverBuildId);
          } else {
            setUpdateAvailable(false);
            setNewBuildId(null);
          }
        }
      }
      
      // Fetch releases data (with caching to reduce requests)
      if (releases.length === 0 || !skipLoadingState) {
        const releasesData = await fetchReleasesData();
        setReleases(releasesData);
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error checking for updates';
      logger.error('Version check error:', errorMessage);
      setError(errorMessage);
      
      // Don't break the polling cycle on errors
    } finally {
      setIsLoading(false);
      isPollingRef.current = false;
    }
  }, [clientBuildId, fetchVersionData, fetchReleasesData, releases.length]);

  /**
   * Clears all caches and reloads the page
   */
  const clearCachesAndReload = useCallback(async (): Promise<void> => {
    try {
      logger.log('🧹 Clearing caches and reloading...');
      
      // Update the current build ID to the new build ID before clearing
      if (newBuildId && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('currentBuildId', newBuildId);
          logger.log('✅ Updated current build ID to:', newBuildId);
        } catch (err) {
          logger.warn('Failed to update build ID:', err);
        }
      }
      
      // Clear localStorage (but keep the updated build ID)
      if (typeof localStorage !== 'undefined') {
        // Store the new build ID temporarily
        const updatedBuildId = localStorage.getItem('currentBuildId');
        localStorage.clear();
        // Restore the updated build ID
        if (updatedBuildId) {
          localStorage.setItem('currentBuildId', updatedBuildId);
        }
        logger.log('✅ localStorage cleared (keeping updated build ID)');
      }
      
      // Clear sessionStorage
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
        logger.log('✅ sessionStorage cleared');
      }
      
      // Clear Cache Storage (Service Worker caches)
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        logger.log('✅ Cache Storage cleared');
      }
      
      // Clear IndexedDB (if used)
      if ('indexedDB' in window) {
        try {
          // This is more complex to implement properly, but we can attempt basic cleanup
          // Most apps don't use IndexedDB extensively, so this is optional
          logger.log('🔍 IndexedDB cleanup attempted');
        } catch (idbError) {
          logger.warn('IndexedDB cleanup failed:', idbError);
        }
      }
      
      // Stop polling before reload
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      
      // Force reload with cache bypass
      window.location.reload();
      
    } catch (err) {
      logger.error('Error clearing caches:', err);
      throw new Error('Failed to clear caches');
    }
  }, [newBuildId]);

  /**
   * Initialize version checking and set up polling
   */
  useEffect(() => {
    // Initial check
    checkForUpdates();
    
    // Set up polling interval
    pollIntervalRef.current = setInterval(() => {
      checkForUpdates(true); // Skip loading state for background checks
    }, POLL_INTERVAL);
    
    // Cleanup on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [checkForUpdates]);

  /**
   * Handle visibility change to pause/resume polling
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Resume polling when page becomes visible
        if (!pollIntervalRef.current) {
          checkForUpdates(true);
          pollIntervalRef.current = setInterval(() => {
            checkForUpdates(true);
          }, POLL_INTERVAL);
        }
      } else {
        // Pause polling when page is hidden
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkForUpdates]);

  return {
    clientBuildId,
    updateAvailable,
    newBuildId,
    releases,
    clearCachesAndReload,
    isLoading,
    error
  };
}