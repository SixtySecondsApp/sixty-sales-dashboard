/**
 * SMART CACHING SYSTEM
 * 
 * Intelligent multi-layer caching with automatic invalidation,
 * compression, and performance monitoring for CRM operations.
 * 
 * FEATURES:
 * - Multi-tier caching (Memory → LocalStorage → IndexedDB)
 * - Intelligent cache invalidation based on data relationships
 * - Automatic compression for large datasets
 * - Performance metrics and optimization
 * - Query pattern learning and optimization
 */

import { LZString } from 'lz-string';
import logger from '@/lib/utils/logger';

// Cache entry types
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  size: number;
  hitCount: number;
  lastAccessed: number;
  queryPattern: string;
  dependencies: string[]; // Related data that should invalidate this cache
}

interface CacheMetrics {
  hits: number;
  misses: number;
  totalQueries: number;
  avgResponseTime: number;
  memoryUsage: number;
  storageUsage: number;
  compressionRatio: number;
}

interface CacheConfig {
  maxMemorySize: number; // Maximum memory cache size in MB
  maxStorageSize: number; // Maximum storage cache size in MB
  defaultTTL: number; // Default TTL in milliseconds
  compressionThreshold: number; // Compress data larger than this (bytes)
  enableIndexedDB: boolean; // Use IndexedDB for persistent cache
  enablePredictive: boolean; // Enable predictive caching
}

// Default configuration optimized for CRM workload
const DEFAULT_CONFIG: CacheConfig = {
  maxMemorySize: 50, // 50MB memory cache
  maxStorageSize: 200, // 200MB storage cache
  defaultTTL: 10 * 60 * 1000, // 10 minutes
  compressionThreshold: 10240, // 10KB
  enableIndexedDB: true,
  enablePredictive: true,
};

// Cache invalidation patterns for CRM data relationships
const INVALIDATION_PATTERNS = {
  // Company data changes should invalidate related deals, clients, activities
  'company:*': ['deals:company:*', 'clients:company:*', 'activities:company:*'],
  
  // Deal changes should invalidate company summaries and related clients
  'deals:*': ['company:*', 'clients:deal:*', 'payments:*', 'mrr:*'],
  
  // Client changes should invalidate company summaries and MRR calculations
  'clients:*': ['company:*', 'payments:*', 'mrr:*'],
  
  // Activity changes should invalidate company activity counts
  'activities:*': ['company:*'],
  
  // User changes should invalidate all user-specific caches
  'user:*': ['*'],
};

// Predictive caching patterns based on user behavior
const PREDICTIVE_PATTERNS = {
  // When viewing company details, prefetch related deals and activities
  'company:view': ['deals:company', 'activities:company', 'clients:company'],
  
  // When viewing deals, prefetch company details
  'deals:view': ['company:view'],
  
  // When viewing payments table, prefetch MRR data
  'payments:view': ['mrr:summary', 'clients:all'],
};

export class SmartCache {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private config: CacheConfig;
  private metrics: CacheMetrics;
  private dbName = 'crm_cache_v1';
  private indexedDB: IDBDatabase | null = null;
  
  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = {
      hits: 0,
      misses: 0,
      totalQueries: 0,
      avgResponseTime: 0,
      memoryUsage: 0,
      storageUsage: 0,
      compressionRatio: 0,
    };
    
    this.initializeIndexedDB();
    this.startMaintenanceRoutine();
  }

  // Initialize IndexedDB for persistent caching
  private async initializeIndexedDB(): Promise<void> {
    if (!this.config.enableIndexedDB || typeof indexedDB === 'undefined') {
      return;
    }

    try {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => {
        logger.warn('IndexedDB initialization failed, falling back to localStorage');
      };
      
      request.onsuccess = () => {
        this.indexedDB = request.result;
        logger.log('✅ IndexedDB cache initialized');
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('queryPattern', 'queryPattern', { unique: false });
        }
      };
    } catch (error) {
      logger.warn('IndexedDB not available:', error);
    }
  }

  // Generate cache key with pattern recognition
  private generateCacheKey(queryType: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    
    return `${queryType}:${sortedParams}`;
  }

  // Determine query pattern for invalidation and prediction
  private getQueryPattern(queryType: string, params: Record<string, any>): string {
    if (queryType.includes('company')) {
      return params.companyId ? `company:${params.companyId}` : 'company:*';
    }
    if (queryType.includes('deals')) {
      return params.companyId ? `deals:company:${params.companyId}` : 'deals:*';
    }
    if (queryType.includes('clients')) {
      return params.companyId ? `clients:company:${params.companyId}` : 'clients:*';
    }
    if (queryType.includes('activities')) {
      return params.companyId ? `activities:company:${params.companyId}` : 'activities:*';
    }
    if (queryType.includes('payments')) {
      return 'payments:*';
    }
    if (queryType.includes('mrr')) {
      return 'mrr:*';
    }
    
    return queryType;
  }

  // Get dependencies for cache invalidation
  private getDependencies(queryPattern: string): string[] {
    const dependencies: string[] = [];
    
    for (const [pattern, deps] of Object.entries(INVALIDATION_PATTERNS)) {
      if (this.matchesPattern(queryPattern, pattern)) {
        dependencies.push(...deps);
      }
    }
    
    return dependencies;
  }

  // Pattern matching utility
  private matchesPattern(value: string, pattern: string): boolean {
    if (pattern.endsWith('*')) {
      return value.startsWith(pattern.slice(0, -1));
    }
    return value === pattern;
  }

  // Compress data if it exceeds threshold
  private compressData<T>(data: T): { compressed: string; isCompressed: boolean; originalSize: number } {
    const serialized = JSON.stringify(data);
    const originalSize = new Blob([serialized]).size;
    
    if (originalSize < this.config.compressionThreshold) {
      return { compressed: serialized, isCompressed: false, originalSize };
    }
    
    const compressed = LZString.compress(serialized);
    const compressedSize = new Blob([compressed]).size;
    
    // Update compression ratio metrics
    this.metrics.compressionRatio = (originalSize - compressedSize) / originalSize;
    
    return { compressed, isCompressed: true, originalSize };
  }

  // Decompress data
  private decompressData<T>(compressed: string, isCompressed: boolean): T {
    if (!isCompressed) {
      return JSON.parse(compressed);
    }
    
    const decompressed = LZString.decompress(compressed);
    return JSON.parse(decompressed);
  }

  // Memory management: LRU eviction
  private evictLRU(): void {
    if (this.memoryCache.size === 0) return;
    
    // Find least recently used entry
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.memoryCache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      logger.log(`🗑️ Evicted LRU cache entry: ${oldestKey}`);
    }
  }

  // Get current memory usage in MB
  private getMemoryUsage(): number {
    let totalSize = 0;
    for (const entry of this.memoryCache.values()) {
      totalSize += entry.size;
    }
    return totalSize / (1024 * 1024); // Convert to MB
  }

  // Store in persistent storage (localStorage or IndexedDB)
  private async storePersistent(key: string, entry: CacheEntry<any>): Promise<void> {
    const { compressed, isCompressed } = this.compressData(entry.data);
    const persistentEntry = {
      ...entry,
      data: compressed,
      isCompressed,
    };

    if (this.indexedDB) {
      try {
        const transaction = this.indexedDB.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');
        await store.put({ key, ...persistentEntry });
      } catch (error) {
        logger.warn('IndexedDB storage failed, falling back to localStorage:', error);
        this.storeInLocalStorage(key, persistentEntry);
      }
    } else {
      this.storeInLocalStorage(key, persistentEntry);
    }
  }

  private storeInLocalStorage(key: string, entry: any): void {
    try {
      localStorage.setItem(`cache:${key}`, JSON.stringify(entry));
    } catch (error) {
      logger.warn('localStorage storage failed:', error);
    }
  }

  // Retrieve from persistent storage
  private async retrievePersistent(key: string): Promise<CacheEntry<any> | null> {
    if (this.indexedDB) {
      try {
        const transaction = this.indexedDB.transaction(['cache'], 'readonly');
        const store = transaction.objectStore('cache');
        const request = store.get(key);
        
        return new Promise((resolve) => {
          request.onsuccess = () => {
            const result = request.result;
            if (result) {
              const data = this.decompressData(result.data, result.isCompressed);
              resolve({ ...result, data });
            } else {
              resolve(null);
            }
          };
          request.onerror = () => resolve(null);
        });
      } catch (error) {
        logger.warn('IndexedDB retrieval failed:', error);
      }
    }
    
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(`cache:${key}`);
      if (stored) {
        const entry = JSON.parse(stored);
        const data = this.decompressData(entry.data, entry.isCompressed);
        return { ...entry, data };
      }
    } catch (error) {
      logger.warn('localStorage retrieval failed:', error);
    }
    
    return null;
  }

  // Public cache operations
  async get<T>(queryType: string, params: Record<string, any> = {}): Promise<T | null> {
    const startTime = performance.now();
    const key = this.generateCacheKey(queryType, params);
    
    // Try memory cache first
    let entry = this.memoryCache.get(key);
    
    // Try persistent storage if not in memory
    if (!entry) {
      entry = await this.retrievePersistent(key);
      if (entry) {
        // Promote to memory cache
        this.memoryCache.set(key, entry);
      }
    }
    
    const duration = performance.now() - startTime;
    this.metrics.totalQueries++;
    
    if (entry) {
      // Check if expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
        this.metrics.misses++;
        return null;
      }
      
      // Update access tracking
      entry.hitCount++;
      entry.lastAccessed = Date.now();
      this.metrics.hits++;
      
      logger.log(`⚡ Cache hit for ${key} (${duration.toFixed(2)}ms)`);
      return entry.data;
    }
    
    this.metrics.misses++;
    logger.log(`❌ Cache miss for ${key} (${duration.toFixed(2)}ms)`);
    return null;
  }

  async set<T>(
    queryType: string, 
    params: Record<string, any>, 
    data: T, 
    customTTL?: number
  ): Promise<void> {
    const key = this.generateCacheKey(queryType, params);
    const queryPattern = this.getQueryPattern(queryType, params);
    const dependencies = this.getDependencies(queryPattern);
    const ttl = customTTL || this.config.defaultTTL;
    
    const { compressed, originalSize } = this.compressData(data);
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      size: originalSize,
      hitCount: 0,
      lastAccessed: Date.now(),
      queryPattern,
      dependencies,
    };

    // Memory management
    while (this.getMemoryUsage() >= this.config.maxMemorySize && this.memoryCache.size > 0) {
      this.evictLRU();
    }
    
    // Store in memory
    this.memoryCache.set(key, entry);
    
    // Store in persistent storage for larger datasets
    if (originalSize > 1024) { // Store datasets larger than 1KB persistently
      await this.storePersistent(key, entry);
    }
    
    this.updateMetrics();
    logger.log(`💾 Cached ${key} (${(originalSize / 1024).toFixed(2)}KB, TTL: ${ttl / 1000}s)`);
    
    // Predictive caching
    if (this.config.enablePredictive) {
      this.triggerPredictiveCaching(queryType, params);
    }
  }

  // Intelligent cache invalidation
  async invalidate(pattern: string): Promise<void> {
    const invalidatedKeys: string[] = [];
    
    // Invalidate memory cache
    for (const [key, entry] of this.memoryCache) {
      if (this.shouldInvalidate(entry.queryPattern, pattern)) {
        this.memoryCache.delete(key);
        invalidatedKeys.push(key);
      }
    }
    
    // Invalidate persistent storage
    if (this.indexedDB) {
      try {
        const transaction = this.indexedDB.transaction(['cache'], 'readwrite');
        const store = transaction.objectStore('cache');
        const index = store.index('queryPattern');
        
        // This is a simplified approach - in production you'd want more sophisticated pattern matching
        const request = index.openCursor();
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            if (this.shouldInvalidate(cursor.value.queryPattern, pattern)) {
              cursor.delete();
              invalidatedKeys.push(cursor.value.key);
            }
            cursor.continue();
          }
        };
      } catch (error) {
        logger.warn('IndexedDB invalidation failed:', error);
      }
    }
    
    logger.log(`🗑️ Invalidated ${invalidatedKeys.length} cache entries for pattern: ${pattern}`);
  }

  private shouldInvalidate(entryPattern: string, invalidationPattern: string): boolean {
    return this.matchesPattern(entryPattern, invalidationPattern);
  }

  // Predictive caching
  private async triggerPredictiveCaching(queryType: string, params: Record<string, any>): Promise<void> {
    const pattern = this.getQueryPattern(queryType, params);
    const predictiveQueries = PREDICTIVE_PATTERNS[pattern];
    
    if (predictiveQueries) {
      logger.log(`🔮 Triggering predictive caching for pattern: ${pattern}`);
      // This would be implemented with actual query functions
      // For now, just log the intention
    }
  }

  // Performance monitoring
  private updateMetrics(): void {
    this.metrics.memoryUsage = this.getMemoryUsage();
    
    if (this.metrics.totalQueries > 0) {
      this.metrics.avgResponseTime = (this.metrics.hits + this.metrics.misses) / this.metrics.totalQueries;
    }
  }

  // Maintenance routine
  private startMaintenanceRoutine(): void {
    setInterval(() => {
      this.cleanupExpiredEntries();
      this.updateMetrics();
    }, 5 * 60 * 1000); // Run every 5 minutes
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.memoryCache) {
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  // Public API methods
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  getStats() {
    return {
      memoryEntries: this.memoryCache.size,
      memoryUsageMB: this.getMemoryUsage(),
      hitRate: this.metrics.totalQueries > 0 ? (this.metrics.hits / this.metrics.totalQueries) * 100 : 0,
      compressionRatio: this.metrics.compressionRatio * 100,
      ...this.metrics,
    };
  }

  clear(): void {
    this.memoryCache.clear();
    
    if (this.indexedDB) {
      const transaction = this.indexedDB.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      store.clear();
    }
    
    // Clear localStorage cache
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('cache:')) {
        localStorage.removeItem(key);
      }
    }
    
    logger.log('🗑️ All cache cleared');
  }
}

// Singleton instance
export const smartCache = new SmartCache();

// Helper functions for easy integration
export async function getCachedData<T>(queryType: string, params: Record<string, any> = {}): Promise<T | null> {
  return smartCache.get<T>(queryType, params);
}

export async function setCachedData<T>(
  queryType: string, 
  params: Record<string, any>, 
  data: T, 
  ttl?: number
): Promise<void> {
  return smartCache.set(queryType, params, data, ttl);
}

export async function invalidateCache(pattern: string): Promise<void> {
  return smartCache.invalidate(pattern);
}

export function getCacheStats() {
  return smartCache.getStats();
}