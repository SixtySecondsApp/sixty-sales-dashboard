/**
 * Service Worker Utilities
 * Helper functions to manage service worker caching and resolve conflicts
 */

import logger from '@/lib/utils/logger';

export class ServiceWorkerManager {
  private static instance: ServiceWorkerManager;
  private registration: ServiceWorkerRegistration | null = null;

  static getInstance(): ServiceWorkerManager {
    if (!ServiceWorkerManager.instance) {
      ServiceWorkerManager.instance = new ServiceWorkerManager();
    }
    return ServiceWorkerManager.instance;
  }

  // Initialize service worker registration tracking
  setRegistration(registration: ServiceWorkerRegistration): void {
    this.registration = registration;
  }

  // Clear all caches (useful for debugging cache conflicts)
  async clearAllCaches(): Promise<void> {
    try {
      if (this.registration) {
        await this.sendMessageToSW({ type: 'CLEAR_CACHE' });
        logger.log('🧹 All service worker caches cleared');
      }
      
      // Also clear browser caches via Cache API
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      
    } catch (error) {
      logger.warn('Failed to clear service worker caches:', error);
    }
  }

  // Clear only API/dynamic content caches (preserves static asset caches)
  async clearApiCaches(): Promise<void> {
    try {
      if (this.registration) {
        await this.sendMessageToSW({ type: 'CLEAR_API_CACHE' });
        logger.log('🧹 API caches cleared');
      }
    } catch (error) {
      logger.warn('Failed to clear API caches:', error);
    }
  }

  // Force service worker update (useful when detecting conflicts)
  async forceUpdate(): Promise<void> {
    try {
      if (this.registration) {
        await this.registration.update();
        if (this.registration.waiting) {
          await this.sendMessageToSW({ type: 'SKIP_WAITING' });
        }
        logger.log('🔄 Service worker updated');
      }
    } catch (error) {
      logger.warn('Failed to update service worker:', error);
    }
  }

  // Send message to service worker with response handling
  private async sendMessageToSW(message: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.registration?.active) {
        reject(new Error('No active service worker'));
        return;
      }

      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        if (event.data.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data);
        }
      };

      this.registration.active.postMessage(message, [messageChannel.port2]);
    });
  }

  // Check if request should bypass cache (helps detect conflicts)
  static shouldBypassCache(url: string): boolean {
    const urlObj = new URL(url);
    return (
      urlObj.pathname.startsWith('/api/') ||
      urlObj.pathname.startsWith('/functions/') ||
      urlObj.pathname.includes('/functions/v1/') ||
      urlObj.pathname.includes('/auth') ||
      urlObj.pathname.includes('/rest/v1/') ||
      urlObj.searchParams.has('timestamp') ||
      urlObj.pathname.includes('web-vitals')
    );
  }

  // Detect and resolve cache conflicts automatically
  async detectAndResolveCacheConflicts(): Promise<void> {
    try {
      // Check for common cache conflict indicators
      const hasAuthIssues = this.checkForAuthCacheIssues();
      const hasApiIssues = this.checkForApiCacheIssues();
      
      if (hasAuthIssues || hasApiIssues) {
        logger.warn('🚨 Cache conflicts detected, clearing API caches');
        await this.clearApiCaches();
        
        // Force a page reload if severe conflicts detected
        if (hasAuthIssues) {
          logger.warn('🚨 Authentication cache conflicts detected, recommend page refresh');
        }
      }
    } catch (error) {
      logger.error('Failed to resolve cache conflicts:', error);
    }
  }

  // Check for authentication-related cache issues
  private checkForAuthCacheIssues(): boolean {
    // Check localStorage for auth token changes
    const lastAuthCheck = localStorage.getItem('sw_last_auth_check');
    const currentAuthState = localStorage.getItem('supabase.auth.token');
    
    if (lastAuthCheck !== currentAuthState) {
      localStorage.setItem('sw_last_auth_check', currentAuthState || '');
      return true;
    }
    
    return false;
  }

  // Check for API-related cache issues
  private checkForApiCacheIssues(): boolean {
    // Check for repeated API errors that might indicate cache conflicts
    const errorCount = parseInt(localStorage.getItem('sw_api_error_count') || '0');
    
    if (errorCount > 3) {
      localStorage.setItem('sw_api_error_count', '0');
      return true;
    }
    
    return false;
  }

  // Track API errors for conflict detection
  static trackApiError(): void {
    try {
      const currentCount = parseInt(localStorage.getItem('sw_api_error_count') || '0');
      localStorage.setItem('sw_api_error_count', (currentCount + 1).toString());
    } catch (error) {
      // Ignore localStorage errors
    }
  }

  // Reset API error tracking on successful requests
  static resetApiErrorTracking(): void {
    try {
      localStorage.setItem('sw_api_error_count', '0');
    } catch (error) {
      // Ignore localStorage errors
    }
  }
}

// Export singleton instance
export const serviceWorkerManager = ServiceWorkerManager.getInstance();

// Utility functions for direct use
export const clearAllCaches = () => serviceWorkerManager.clearAllCaches();
export const clearApiCaches = () => serviceWorkerManager.clearApiCaches();
export const forceServiceWorkerUpdate = () => serviceWorkerManager.forceUpdate();
export const shouldBypassCache = ServiceWorkerManager.shouldBypassCache;
export const detectAndResolveCacheConflicts = () => serviceWorkerManager.detectAndResolveCacheConflicts();