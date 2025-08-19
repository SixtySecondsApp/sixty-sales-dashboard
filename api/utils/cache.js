// In-memory cache for Vercel Edge Functions
const cache = new Map();
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  evictions: 0
};

// Cache configuration
const CACHE_CONFIG = {
  maxSize: 1000, // Maximum number of entries
  defaultTTL: 300, // 5 minutes default TTL
  cleanupInterval: 60000, // Clean expired entries every minute
};

// Cache entry structure
class CacheEntry {
  constructor(data, ttl) {
    this.data = data;
    this.expiresAt = Date.now() + (ttl * 1000);
    this.createdAt = Date.now();
    this.accessCount = 0;
    this.lastAccessed = Date.now();
  }

  isExpired() {
    return Date.now() > this.expiresAt;
  }

  touch() {
    this.accessCount++;
    this.lastAccessed = Date.now();
  }
}

// Generate cache keys with consistent hashing
export function createCacheKey(prefix, params = {}) {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join('|');
  
  return `${prefix}:${sortedParams}`;
}

// Get data from cache
export async function getFromCache(key) {
  const entry = cache.get(key);
  
  if (!entry) {
    cacheStats.misses++;
    return null;
  }
  
  if (entry.isExpired()) {
    cache.delete(key);
    cacheStats.misses++;
    cacheStats.evictions++;
    return null;
  }
  
  entry.touch();
  cacheStats.hits++;
  
  console.log(`Cache HIT for key: ${key} (age: ${Math.round((Date.now() - entry.createdAt) / 1000)}s)`);
  return entry.data;
}

// Set data in cache
export async function setCache(key, data, ttl = CACHE_CONFIG.defaultTTL) {
  // Implement LRU eviction if cache is full
  if (cache.size >= CACHE_CONFIG.maxSize) {
    evictLRU();
  }
  
  const entry = new CacheEntry(data, ttl);
  cache.set(key, entry);
  cacheStats.sets++;
  
  console.log(`Cache SET for key: ${key} (TTL: ${ttl}s)`);
  return true;
}

// Invalidate specific cache entry
export async function invalidateCache(key) {
  const deleted = cache.delete(key);
  if (deleted) {
    cacheStats.evictions++;
    console.log(`Cache INVALIDATED for key: ${key}`);
  }
  return deleted;
}

// Invalidate cache by pattern
export async function invalidateCachePattern(pattern) {
  const regex = new RegExp(pattern);
  let count = 0;
  
  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key);
      count++;
    }
  }
  
  cacheStats.evictions += count;
  console.log(`Cache PATTERN INVALIDATED: ${pattern} (${count} entries)`);
  return count;
}

// LRU eviction strategy
function evictLRU() {
  let oldestKey = null;
  let oldestTime = Date.now();
  
  for (const [key, entry] of cache.entries()) {
    if (entry.lastAccessed < oldestTime) {
      oldestTime = entry.lastAccessed;
      oldestKey = key;
    }
  }
  
  if (oldestKey) {
    cache.delete(oldestKey);
    cacheStats.evictions++;
    console.log(`Cache LRU EVICTION: ${oldestKey}`);
  }
}

// Cleanup expired entries
function cleanupExpired() {
  let cleanedCount = 0;
  
  for (const [key, entry] of cache.entries()) {
    if (entry.isExpired()) {
      cache.delete(key);
      cleanedCount++;
    }
  }
  
  cacheStats.evictions += cleanedCount;
  
  if (cleanedCount > 0) {
    console.log(`Cache CLEANUP: ${cleanedCount} expired entries removed`);
  }
}

// Get cache statistics
export function getCacheStats() {
  const hitRate = cacheStats.hits + cacheStats.misses > 0 
    ? (cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100).toFixed(2)
    : 0;
    
  return {
    ...cacheStats,
    hitRate: `${hitRate}%`,
    size: cache.size,
    maxSize: CACHE_CONFIG.maxSize,
    memoryUsage: cache.size / CACHE_CONFIG.maxSize * 100
  };
}

// Warm cache with common queries
export async function warmCache(ownerId) {
  const warmupQueries = [
    { key: createCacheKey('dashboard', { ownerId }), fetcher: 'dashboard' },
    { key: createCacheKey('deals-list', { ownerId }), fetcher: 'deals' },
    { key: createCacheKey('companies-list', { ownerId }), fetcher: 'companies' },
    { key: createCacheKey('activities-recent', { ownerId }), fetcher: 'activities' }
  ];
  
  console.log(`Starting cache warmup for owner: ${ownerId}`);
  
  // Note: In a real implementation, you'd call the actual data fetchers here
  // This is a placeholder for the warmup logic
  return warmupQueries.length;
}

// Initialize cleanup interval
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpired, CACHE_CONFIG.cleanupInterval);
}

// Cache middleware for API endpoints
export function withCache(ttl = CACHE_CONFIG.defaultTTL) {
  return function cacheMiddleware(handler) {
    return async function cachedHandler(request, response) {
      // Skip caching for non-GET requests
      if (request.method !== 'GET') {
        return handler(request, response);
      }
      
      // Create cache key from URL and query params
      const cacheKey = createCacheKey('api', { 
        url: request.url,
        method: request.method 
      });
      
      // Check cache first
      const cachedData = await getFromCache(cacheKey);
      if (cachedData) {
        response.setHeader('X-Cache', 'HIT');
        response.setHeader('X-Cache-Key', cacheKey);
        return response.status(200).json(cachedData);
      }
      
      // Call original handler
      const originalJson = response.json;
      let responseData = null;
      
      response.json = function(data) {
        responseData = data;
        return originalJson.call(this, data);
      };
      
      const result = await handler(request, response);
      
      // Cache successful responses
      if (response.statusCode === 200 && responseData) {
        await setCache(cacheKey, responseData, ttl);
        response.setHeader('X-Cache', 'MISS');
        response.setHeader('X-Cache-Key', cacheKey);
      }
      
      return result;
    };
  };
}

export default {
  createCacheKey,
  getFromCache,
  setCache,
  invalidateCache,
  invalidateCachePattern,
  getCacheStats,
  warmCache,
  withCache
};