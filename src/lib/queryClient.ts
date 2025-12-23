/**
 * React Query client configuration
 * Centralized QueryClient setup with optimized defaults
 */
import { QueryClient } from '@tanstack/react-query';
import { detectAndResolveCacheConflicts } from '@/lib/utils/serviceWorkerUtils';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes - keep cached data longer (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false, // Prevent refetch on window focus
      refetchOnReconnect: true, // Only refetch on reconnect
      refetchOnMount: false, // Don't refetch if data is fresh
    },
  },
});

// Make queryClient and service worker utilities globally available
declare global {
  interface Window {
    queryClient: QueryClient;
    detectAndResolveCacheConflicts?: typeof detectAndResolveCacheConflicts;
  }
}

// Set on window for debugging and external access
if (typeof window !== 'undefined') {
  window.queryClient = queryClient;
  window.detectAndResolveCacheConflicts = detectAndResolveCacheConflicts;
}
