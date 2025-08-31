/**
 * Response Caching Utility for Edge Functions
 * 
 * Based on Phase 3 audit findings:
 * - "Cache Hit Rate: 67% (client-side)" - improve to server-side caching
 * - "Edge Function Cold Starts: 200-400ms initial latency"
 * - "Average Response Time: 240ms (Edge Functions)"
 * 
 * Target: Reduce response times by 30-50% through server-side caching
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  etag: string;
  headers?: Record<string, string>;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  staleWhileRevalidate?: number; // Serve stale data while refreshing
  cacheKey?: string; // Custom cache key
  skipCache?: boolean; // Skip caching for this request
  varyHeaders?: string[]; // Headers that affect caching
}

class EdgeFunctionCache {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000; // Prevent memory leaks

  generateCacheKey(req: Request, customKey?: string): string {
    if (customKey) return customKey;
    
    const url = new URL(req.url);
    const method = req.method;
    const pathname = url.pathname;
    const searchParams = url.searchParams.toString();
    
    // Include user ID in cache key for user-specific data
    const authHeader = req.headers.get('Authorization');
    const userHash = authHeader ? this.hashString(authHeader) : 'anonymous';
    
    return `${method}:${pathname}:${searchParams}:${userHash}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  generateETag(data: any): string {
    const content = JSON.stringify(data);
    return this.hashString(content);
  }

  get(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.timestamp;
    
    // Return fresh data
    if (age < this.DEFAULT_TTL) {
      return entry;
    }

    // Clean up expired entry
    this.cache.delete(key);
    return null;
  }

  set(key: string, data: any, options: CacheOptions = {}): void {
    // Prevent cache from growing too large
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      etag: this.generateETag(data),
      headers: options.varyHeaders ? this.extractHeaders(data, options.varyHeaders) : undefined
    };

    this.cache.set(key, entry);
  }

  private extractHeaders(data: any, headerNames: string[]): Record<string, string> {
    const headers: Record<string, string> = {};
    // This would extract relevant headers if needed
    return headers;
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; hitRate: number } {
    // This would track hit rates in a real implementation
    return {
      size: this.cache.size,
      hitRate: 0 // Placeholder
    };
  }
}

const cache = new EdgeFunctionCache();

/**
 * Cache middleware for Edge Functions
 */
export async function cacheMiddleware(
  req: Request,
  handler: () => Promise<Response>,
  options: CacheOptions = {}
): Promise<Response> {
  
  // Skip caching for non-GET requests or when explicitly disabled
  if (req.method !== 'GET' || options.skipCache) {
    return await handler();
  }

  const cacheKey = cache.generateCacheKey(req, options.cacheKey);
  
  // Check for cached response
  const cachedEntry = cache.get(cacheKey);
  
  // Handle conditional requests (ETag)
  const ifNoneMatch = req.headers.get('If-None-Match');
  if (cachedEntry && ifNoneMatch === cachedEntry.etag) {
    return new Response(null, {
      status: 304,
      headers: {
        'ETag': cachedEntry.etag,
        'Cache-Control': `max-age=${Math.floor((options.ttl || cache.DEFAULT_TTL) / 1000)}`
      }
    });
  }

  // Return cached response if available
  if (cachedEntry) {
    const response = new Response(JSON.stringify(cachedEntry.data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'ETag': cachedEntry.etag,
        'Cache-Control': `max-age=${Math.floor((options.ttl || cache.DEFAULT_TTL) / 1000)}`,
        'X-Cache': 'HIT',
        'X-Cache-Age': Math.floor((Date.now() - cachedEntry.timestamp) / 1000).toString()
      }
    });
    return response;
  }

  // Execute handler and cache response
  try {
    const response = await handler();
    
    // Only cache successful responses
    if (response.status === 200) {
      const responseData = await response.clone().json();
      cache.set(cacheKey, responseData, options);
      
      const etag = cache.generateETag(responseData);
      
      // Return response with cache headers
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'ETag': etag,
          'Cache-Control': `max-age=${Math.floor((options.ttl || cache.DEFAULT_TTL) / 1000)}`,
          'X-Cache': 'MISS'
        }
      });
    }

    return response;
  } catch (error) {
    console.error('Cache middleware error:', error);
    return await handler(); // Fallback to uncached response
  }
}

/**
 * Invalidate cache entries by pattern
 */
export function invalidateCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }

  // Remove entries matching pattern
  const keysToDelete: string[] = [];
  for (const key of cache.cache.keys()) {
    if (key.includes(pattern)) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => cache.cache.delete(key));
}

/**
 * Warm up cache with commonly accessed data
 */
export async function warmupCache(
  supabaseClient: any,
  commonQueries: Array<{ key: string; query: () => Promise<any> }>
): Promise<void> {
  try {
    const warmupPromises = commonQueries.map(async ({ key, query }) => {
      try {
        const data = await query();
        cache.set(key, data);
        console.log(`Cache warmed up for key: ${key}`);
      } catch (error) {
        console.error(`Failed to warm up cache for key ${key}:`, error);
      }
    });

    await Promise.all(warmupPromises);
    console.log('Cache warmup completed');
  } catch (error) {
    console.error('Cache warmup failed:', error);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return cache.getStats();
}

export default {
  cacheMiddleware,
  invalidateCache,
  warmupCache,
  getCacheStats
};