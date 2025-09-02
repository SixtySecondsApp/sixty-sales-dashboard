// Utility for handling dynamic import failures with cache clearing and retry
import React from 'react';
import { clearCacheAndReload } from '@/lib/config/version';

interface RetryOptions {
  maxRetries?: number;
  clearCacheOnFailure?: boolean;
  showUserPrompt?: boolean;
}

export async function retryableImport<T>(
  importFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 2,
    clearCacheOnFailure = true,
    showUserPrompt = true
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await importFn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if it's a chunk loading error
      const isChunkError = error instanceof Error && (
        error.message.includes('Loading chunk') ||
        error.message.includes('Failed to fetch dynamically imported module') ||
        error.message.includes('Loading CSS chunk')
      );

      if (isChunkError && attempt < maxRetries) {
        console.warn(`Chunk loading failed (attempt ${attempt}/${maxRetries}), retrying...`, error);
        
        // Wait a bit before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      // If it's the last attempt and a chunk error, offer cache clear
      if (isChunkError && clearCacheOnFailure) {
        console.error('Chunk loading failed after all retries. This may be due to cached assets.', error);
        
        if (showUserPrompt) {
          const userWantsRefresh = confirm(
            'Unable to load the requested page. This may be due to cached assets from a previous version.\n\n' +
            'Would you like to clear your cache and reload the page to fix this issue?'
          );
          
          if (userWantsRefresh) {
            clearCacheAndReload();
            return Promise.reject(new Error('Reloading page to clear cache'));
          }
        } else {
          // Auto-clear cache without user prompt
          clearCacheAndReload();
          return Promise.reject(new Error('Reloading page to clear cache'));
        }
      }
    }
  }

  throw lastError!;
}

// Enhanced lazy loading with automatic retry and cache clearing
export function lazyWithRetry<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options?: RetryOptions
) {
  return React.lazy(() => retryableImport(importFn, options));
}

// For non-React dynamic imports
export function dynamicImportWithRetry<T>(
  importFn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  return retryableImport(importFn, options);
}