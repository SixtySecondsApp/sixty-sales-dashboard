/**
 * Bundle Optimizer Utilities
 * 
 * This module provides utilities for runtime bundle optimization:
 * - Module preloading strategies
 * - Resource hints management
 * - Performance monitoring
 * - Critical resource prioritization
 */

import logger from '@/lib/utils/logger';

// Resource preloading utilities
export const preloadModule = (moduleId: string, priority: 'high' | 'medium' | 'low' = 'medium') => {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = priority === 'high' ? 'modulepreload' : 'prefetch';
  link.href = moduleId;
  link.as = 'script';
  
  if (priority === 'high') {
    link.crossOrigin = 'anonymous';
  }

  document.head.appendChild(link);
};

// CSS preloading for critical styles
export const preloadCSS = (href: string, priority: 'critical' | 'normal' = 'normal') => {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = priority === 'critical' ? 'preload' : 'prefetch';
  link.href = href;
  link.as = 'style';
  
  if (priority === 'critical') {
    link.onload = () => {
      link.rel = 'stylesheet';
    };
  }

  document.head.appendChild(link);
};

// Font preloading
export const preloadFont = (href: string, format: 'woff2' | 'woff' | 'ttf' = 'woff2') => {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = 'font';
  link.type = `font/${format}`;
  link.crossOrigin = 'anonymous';

  document.head.appendChild(link);
};

// DNS prefetching for external resources
export const prefetchDNS = (domain: string) => {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'dns-prefetch';
  link.href = domain;

  document.head.appendChild(link);
};

// Preconnect for critical external resources
export const preconnect = (domain: string) => {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = domain;
  link.crossOrigin = 'anonymous';

  document.head.appendChild(link);
};

// Bundle size monitoring
interface BundleMetrics {
  totalSize: number;
  loadedChunks: string[];
  pendingChunks: string[];
  errorChunks: string[];
  loadTime: number;
}

class BundleMonitor {
  private static instance: BundleMonitor;
  private metrics: BundleMetrics = {
    totalSize: 0,
    loadedChunks: [],
    pendingChunks: [],
    errorChunks: [],
    loadTime: 0
  };
  private startTime = Date.now();

  static getInstance(): BundleMonitor {
    if (!BundleMonitor.instance) {
      BundleMonitor.instance = new BundleMonitor();
    }
    return BundleMonitor.instance;
  }

  trackChunkLoad(chunkName: string, size: number) {
    this.metrics.loadedChunks.push(chunkName);
    this.metrics.totalSize += size;
    
    // Remove from pending if it was there
    const pendingIndex = this.metrics.pendingChunks.indexOf(chunkName);
    if (pendingIndex > -1) {
      this.metrics.pendingChunks.splice(pendingIndex, 1);
    }

    this.updateLoadTime();
  }

  trackChunkError(chunkName: string) {
    this.metrics.errorChunks.push(chunkName);
    
    // Remove from pending
    const pendingIndex = this.metrics.pendingChunks.indexOf(chunkName);
    if (pendingIndex > -1) {
      this.metrics.pendingChunks.splice(pendingIndex, 1);
    }
  }

  trackPendingChunk(chunkName: string) {
    if (!this.metrics.pendingChunks.includes(chunkName)) {
      this.metrics.pendingChunks.push(chunkName);
    }
  }

  private updateLoadTime() {
    this.metrics.loadTime = Date.now() - this.startTime;
  }

  getMetrics(): BundleMetrics {
    return { ...this.metrics };
  }

  reset() {
    this.metrics = {
      totalSize: 0,
      loadedChunks: [],
      pendingChunks: [],
      errorChunks: [],
      loadTime: 0
    };
    this.startTime = Date.now();
  }
}

// Critical resource loading strategy
export const loadCriticalResources = async () => {
  // Preconnect to essential services
  preconnect('https://fonts.googleapis.com');
  preconnect('https://fonts.gstatic.com');
  
  // Prefetch DNS for API endpoints
  prefetchDNS('https://api.supabase.co');
  
  // Preload critical fonts
  preloadFont('/fonts/inter-var.woff2', 'woff2');
  
  // Preload critical CSS if using external stylesheets
  if (document.querySelector('link[href*="tailwind"]')) {
    const tailwindLink = document.querySelector('link[href*="tailwind"]') as HTMLLinkElement;
    if (tailwindLink) {
      preloadCSS(tailwindLink.href, 'critical');
    }
  }
};

// Progressive loading strategy
export const progressiveLoader = {
  // Load immediately after first paint
  immediate: [] as (() => Promise<any>)[],
  
  // Load on user interaction
  onInteraction: [] as (() => Promise<any>)[],
  
  // Load on idle
  onIdle: [] as (() => Promise<any>)[],
  
  // Add a loader to a specific strategy
  add: (strategy: 'immediate' | 'onInteraction' | 'onIdle', loader: () => Promise<any>) => {
    progressiveLoader[strategy].push(loader);
  },
  
  // Execute immediate loaders
  executeImmediate: async () => {
    const loaders = progressiveLoader.immediate.splice(0);
    await Promise.allSettled(loaders.map(loader => loader()));
  },
  
  // Execute interaction loaders
  executeOnInteraction: async () => {
    const loaders = progressiveLoader.onInteraction.splice(0);
    await Promise.allSettled(loaders.map(loader => loader()));
  },
  
  // Execute idle loaders
  executeOnIdle: async () => {
    const loaders = progressiveLoader.onIdle.splice(0);
    await Promise.allSettled(loaders.map(loader => loader()));
  }
};

// Smart preloading based on user behavior
export const smartPreloader = {
  // Track user navigation patterns
  navigationHistory: [] as string[],
  
  // Record navigation
  recordNavigation: (path: string) => {
    smartPreloader.navigationHistory.push(path);
    if (smartPreloader.navigationHistory.length > 10) {
      smartPreloader.navigationHistory.shift();
    }
  },
  
  // Predict next likely route
  predictNextRoute: (): string | null => {
    const history = smartPreloader.navigationHistory;
    if (history.length < 2) return null;
    
    const current = history[history.length - 1];
    
    // Simple pattern matching - in real app, could use ML
    const patterns: Record<string, string[]> = {
      '/': ['/pipeline', '/activity', '/companies'],
      '/pipeline': ['/crm/deals', '/companies'],
      '/companies': ['/crm/contacts', '/pipeline'],
      '/activity': ['/pipeline', '/companies'],
    };
    
    const likely = patterns[current];
    if (likely && likely.length > 0) {
      return likely[0]; // Return most likely next route
    }
    
    return null;
  },
  
  // Preload predicted route
  preloadPredictedRoute: () => {
    const predicted = smartPreloader.predictNextRoute();
    if (predicted) {
      // This would trigger route-specific preloading
      logger.log('Preloading predicted route:', predicted);
    }
  }
};

// Tree shaking utilities
export const treeShakeUtils = {
  // Check if a module is actually used
  isModuleUsed: (moduleName: string): boolean => {
    if (typeof window === 'undefined') return false;
    
    // Check if module exists in the global scope or has been imported
    return !!(window as any)[moduleName] || 
           document.querySelector(`script[src*="${moduleName}"]`) !== null;
  },
  
  // Dynamically remove unused modules (careful with this!)
  removeUnusedModule: (moduleName: string) => {
    const script = document.querySelector(`script[src*="${moduleName}"]`);
    if (script && !treeShakeUtils.isModuleUsed(moduleName)) {
      script.remove();
      logger.log(`Removed unused module: ${moduleName}`);
    }
  }
};

// Bundle analysis utilities
export const bundleAnalyzer = {
  // Analyze current bundle composition
  analyzeBundles: () => {
    const scripts = Array.from(document.scripts);
    const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    
    const analysis = {
      scripts: scripts.map(script => ({
        src: script.src,
        size: script.innerHTML.length || 0,
        async: script.async,
        defer: script.defer
      })),
      stylesheets: stylesheets.map(link => ({
        href: (link as HTMLLinkElement).href,
        media: (link as HTMLLinkElement).media
      })),
      totalScripts: scripts.length,
      totalStylesheets: stylesheets.length
    };
    
    return analysis;
  },
  
  // Get performance metrics
  getPerformanceMetrics: () => {
    if (typeof window === 'undefined' || !window.performance) return null;
    
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    
    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
      loadComplete: navigation.loadEventEnd - navigation.navigationStart,
      firstPaint: paint.find(entry => entry.name === 'first-paint')?.startTime || 0,
      firstContentfulPaint: paint.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,
      transferSize: navigation.transferSize,
      encodedBodySize: navigation.encodedBodySize,
      decodedBodySize: navigation.decodedBodySize
    };
  }
};

export { BundleMonitor };