// Advanced Static Data Cache for Backend Optimization
// Handles caching of frequently accessed, rarely changing data like stages, users, companies

import logger from '@/lib/utils/logger';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  version: string;
  accessCount: number;
  lastAccessed: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  sets: number;
  hitRate: number;
  size: number;
  maxSize: number;
}

class StaticDataCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly maxSize: number;
  private readonly defaultTTL: number;
  private metrics: Omit<CacheMetrics, 'hitRate' | 'size' | 'maxSize'> = {
    hits: 0,
    misses: 0,
    evictions: 0,
    sets: 0
  };

  constructor(maxSize = 500, defaultTTL = 30 * 60 * 1000) { // 30 minutes default
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    
    // Clean up expired entries every 5 minutes
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanupExpired(), 5 * 60 * 1000);
    }
  }

  private generateVersion(): string {
    return `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.metrics.evictions++;
      logger.log(`🗑️ Evicted LRU cache entry: ${oldestKey}`);
    }
  }

  private cleanupExpired(): void {
    let cleanedCount = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.metrics.evictions += cleanedCount;
      logger.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.metrics.misses++;
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.metrics.misses++;
      this.metrics.evictions++;
      return null;
    }

    // Update access metrics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.metrics.hits++;

    logger.log(`📋 Cache HIT: ${key} (age: ${Math.round((Date.now() - entry.timestamp) / 1000)}s, accessed: ${entry.accessCount} times)`);
    return entry.data;
  }

  set<T>(key: string, data: T, ttl?: number, version?: string): void {
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      version: version || this.generateVersion(),
      accessCount: 0,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
    this.metrics.sets++;
    
    logger.log(`💾 Cache SET: ${key} (TTL: ${Math.round((entry.ttl) / 1000)}s, version: ${entry.version})`);
  }

  invalidate(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.metrics.evictions++;
      logger.log(`❌ Cache INVALIDATED: ${key}`);
    }
    return deleted;
  }

  invalidatePattern(pattern: string): number {
    const regex = new RegExp(pattern);
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    this.metrics.evictions += count;
    logger.log(`🔥 Cache PATTERN INVALIDATED: ${pattern} (${count} entries)`);
    return count;
  }

  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.metrics.evictions += size;
    logger.log(`🗑️ Cache CLEARED: ${size} entries removed`);
  }

  getMetrics(): CacheMetrics {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: total > 0 ? (this.metrics.hits / total) * 100 : 0,
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }

  // Preload frequently accessed data
  async preload(preloadConfig: Array<{ key: string; fetcher: () => Promise<any>; ttl?: number }>): Promise<void> {
    logger.log(`🔄 Preloading ${preloadConfig.length} cache entries...`);
    
    const promises = preloadConfig.map(async ({ key, fetcher, ttl }) => {
      try {
        const data = await fetcher();
        this.set(key, data, ttl);
        return { key, success: true };
      } catch (error) {
        logger.error(`❌ Failed to preload ${key}:`, error);
        return { key, success: false, error };
      }
    });

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    
    logger.log(`✅ Preloaded ${successful}/${preloadConfig.length} cache entries`);
  }

  // Get cached data or fetch and cache if not available
  async getOrFetch<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    ttl?: number,
    version?: string
  ): Promise<T> {
    // Try cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch and cache
    try {
      const data = await fetcher();
      this.set(key, data, ttl, version);
      return data;
    } catch (error) {
      logger.error(`❌ Failed to fetch data for key ${key}:`, error);
      throw error;
    }
  }
}

// Singleton instance for global use
const staticDataCache = new StaticDataCache();

// Predefined cache keys for consistency
export const CACHE_KEYS = {
  DEAL_STAGES: 'deal_stages',
  USERS: 'users',
  COMPANIES: 'companies',
  CONTACTS: 'contacts',
  PIPELINE_STATS: 'pipeline_stats',
  DASHBOARD_DATA: (ownerId: string) => `dashboard_${ownerId}`,
  DEALS_LIST: (ownerId: string) => `deals_${ownerId}`,
  USER_PREFERENCES: (userId: string) => `user_prefs_${userId}`,
  STAGE_PROBABILITIES: 'stage_probabilities',
  COMPANY_METRICS: 'company_metrics'
} as const;

// TTL constants (in milliseconds)
export const CACHE_TTL = {
  SHORT: 5 * 60 * 1000,        // 5 minutes - for dynamic data
  MEDIUM: 15 * 60 * 1000,      // 15 minutes - for semi-static data
  LONG: 60 * 60 * 1000,        // 1 hour - for static data like stages
  VERY_LONG: 24 * 60 * 60 * 1000, // 24 hours - for rarely changing data
} as const;

// Cache utility functions
export const cacheUtils = {
  // Get deal stages with caching
  async getDealStages(fetcher: () => Promise<any[]>): Promise<any[]> {
    return staticDataCache.getOrFetch(
      CACHE_KEYS.DEAL_STAGES,
      fetcher,
      CACHE_TTL.LONG // 1 hour TTL for stages
    );
  },

  // Get users with caching
  async getUsers(fetcher: () => Promise<any[]>): Promise<any[]> {
    return staticDataCache.getOrFetch(
      CACHE_KEYS.USERS,
      fetcher,
      CACHE_TTL.MEDIUM // 15 minutes TTL for users
    );
  },

  // Get companies with caching
  async getCompanies(fetcher: () => Promise<any[]>): Promise<any[]> {
    return staticDataCache.getOrFetch(
      CACHE_KEYS.COMPANIES,
      fetcher,
      CACHE_TTL.MEDIUM // 15 minutes TTL for companies
    );
  },

  // Get dashboard data with caching
  async getDashboardData(ownerId: string, fetcher: () => Promise<any>): Promise<any> {
    return staticDataCache.getOrFetch(
      CACHE_KEYS.DASHBOARD_DATA(ownerId),
      fetcher,
      CACHE_TTL.SHORT // 5 minutes TTL for dashboard data
    );
  },

  // Invalidate all data for a specific owner
  invalidateOwnerData(ownerId: string): void {
    staticDataCache.invalidatePattern(`.*_${ownerId}$`);
  },

  // Warm up cache with commonly used data
  async warmupCache(): Promise<void> {
    const preloadConfig = [
      {
        key: CACHE_KEYS.DEAL_STAGES,
        fetcher: async () => {
          // This would be replaced with actual Supabase call
          logger.log('Warming up deal stages cache...');
          return [];
        },
        ttl: CACHE_TTL.LONG
      }
    ];

    await staticDataCache.preload(preloadConfig);
  },

  // Get cache statistics
  getStats(): CacheMetrics {
    return staticDataCache.getMetrics();
  },

  // Clear all cached data
  clearAll(): void {
    staticDataCache.clear();
  }
};

export default staticDataCache;