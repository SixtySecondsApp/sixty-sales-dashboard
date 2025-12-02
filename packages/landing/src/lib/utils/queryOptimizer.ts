/**
 * Query Optimization Utility
 * 
 * Implements database query optimizations based on Phase 3 audit findings.
 * Provides caching, query batching, and performance monitoring.
 * 
 * Based on audit findings: 78.1% score, target 85%
 * - Dashboard queries: 70% performance improvement potential
 * - Pipeline loading: 60% performance improvement potential  
 * - Activity filtering: 80% performance improvement potential
 */

import { supabase } from '@/lib/supabase/clientV2';
import logger from './logger';

// Query cache with TTL
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class QueryCache {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: any, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL
    });
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

const queryCache = new QueryCache();

// Performance monitoring
interface QueryPerformanceMetric {
  query: string;
  duration: number;
  timestamp: number;
  cacheHit: boolean;
}

class PerformanceMonitor {
  private metrics: QueryPerformanceMetric[] = [];
  private readonly MAX_METRICS = 1000;

  track(query: string, duration: number, cacheHit: boolean): void {
    this.metrics.push({
      query,
      duration,
      timestamp: Date.now(),
      cacheHit
    });

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Log slow queries (>500ms as mentioned in audit)
    if (duration > 500 && !cacheHit) {
      logger.warn('Slow query detected:', { query, duration });
    }
  }

  getMetrics(): {
    averageDuration: number;
    cacheHitRate: number;
    slowQueries: number;
    totalQueries: number;
  } {
    if (this.metrics.length === 0) {
      return { averageDuration: 0, cacheHitRate: 0, slowQueries: 0, totalQueries: 0 };
    }

    const totalDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const cacheHits = this.metrics.filter(m => m.cacheHit).length;
    const slowQueries = this.metrics.filter(m => m.duration > 500 && !m.cacheHit).length;

    return {
      averageDuration: totalDuration / this.metrics.length,
      cacheHitRate: (cacheHits / this.metrics.length) * 100,
      slowQueries,
      totalQueries: this.metrics.length
    };
  }
}

const performanceMonitor = new PerformanceMonitor();

/**
 * Optimized query execution with caching and performance monitoring
 */
export async function optimizedQuery<T>(
  queryKey: string,
  queryFn: () => Promise<T>,
  options: {
    ttl?: number;
    skipCache?: boolean;
  } = {}
): Promise<T> {
  const startTime = Date.now();

  // Check cache first (unless explicitly skipped)
  if (!options.skipCache) {
    const cachedResult = queryCache.get(queryKey);
    if (cachedResult) {
      const duration = Date.now() - startTime;
      performanceMonitor.track(queryKey, duration, true);
      return cachedResult;
    }
  }

  // Execute query
  try {
    const result = await queryFn();
    const duration = Date.now() - startTime;

    // Cache successful results
    if (result && !options.skipCache) {
      queryCache.set(queryKey, result, options.ttl);
    }

    performanceMonitor.track(queryKey, duration, false);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    performanceMonitor.track(queryKey + '_ERROR', duration, false);
    throw error;
  }
}

/**
 * Batch multiple queries for better performance
 * Addresses audit finding: "Multiple separate queries for different metrics"
 */
export async function batchQueries<T extends Record<string, any>>(
  queries: Array<{
    key: string;
    query: () => Promise<any>;
    ttl?: number;
  }>
): Promise<T> {
  const startTime = Date.now();
  
  try {
    // Execute all queries in parallel
    const results = await Promise.all(
      queries.map(async ({ key, query, ttl }) => {
        const result = await optimizedQuery(key, query, { ttl });
        return [key, result];
      })
    );

    const batchResult = Object.fromEntries(results) as T;
    const duration = Date.now() - startTime;
    
    logger.log('Batch query completed:', {
      queries: queries.length,
      duration,
      keys: queries.map(q => q.key)
    });

    return batchResult;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Batch query failed:', { error, duration });
    throw error;
  }
}

/**
 * Optimized deals query with proper joins
 * Addresses audit finding: "Basic query without relationships"
 */
export async function getOptimizedDeals(ownerId?: string) {
  const queryKey = `deals_optimized_${ownerId || 'all'}`;
  
  return optimizedQuery(queryKey, async () => {
    let query = (supabase as any)
      .from('deals')
      .select(`
        id,
        name,
        value,
        one_off_revenue,
        monthly_mrr,
        annual_value,
        stage_id,
        owner_id,
        company_id,
        contact_name,
        contact_email,
        probability,
        created_at,
        updated_at,
        deal_stages!inner(
          id,
          name,
          color,
          default_probability
        ),
        companies(
          id,
          name,
          domain
        )
      `);

    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    const { data, error } = await query
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  });
}

/**
 * Optimized activities query with deal relationships
 * Addresses audit finding: "N+1 query pattern in useActivities"
 */
export async function getOptimizedActivities(userId: string, dateRange?: { start: Date; end: Date }) {
  const queryKey = `activities_optimized_${userId}_${dateRange ? `${dateRange.start.toISOString()}_${dateRange.end.toISOString()}` : 'all'}`;
  
  return optimizedQuery(queryKey, async () => {
    let query = (supabase as any)
      .from('activities')
      .select(`
        id,
        type,
        client_name,
        date,
        amount,
        user_id,
        sales_rep,
        status,
        details,
        priority,
        deal_id,
        deals(
          id,
          name,
          value,
          one_off_revenue,
          monthly_mrr,
          stage_id,
          deal_stages(name, color)
        )
      `)
      .eq('user_id', userId);

    if (dateRange) {
      query = query
        .gte('date', dateRange.start.toISOString())
        .lte('date', dateRange.end.toISOString());
    }

    const { data, error } = await query.order('date', { ascending: false });

    if (error) throw error;
    return data;
  });
}

/**
 * Dashboard aggregation query optimization
 * Addresses audit finding: "2-3 second dashboard load times"
 */
export async function getDashboardMetrics(ownerId?: string) {
  const queryKey = `dashboard_metrics_${ownerId || 'all'}`;
  
  return batchQueries([
    {
      key: 'revenue_summary',
      query: async () => {
        const { data, error } = await (supabase as any)
          .rpc('get_revenue_summary', { owner_id: ownerId });
        if (error) throw error;
        return data;
      }
    },
    {
      key: 'pipeline_summary', 
      query: async () => {
        const { data, error } = await (supabase as any)
          .rpc('get_pipeline_summary', { owner_id: ownerId });
        if (error) throw error;
        return data;
      }
    },
    {
      key: 'activity_summary',
      query: async () => {
        const { data, error } = await (supabase as any)
          .rpc('get_activity_summary', { owner_id: ownerId });
        if (error) throw error;
        return data;
      }
    }
  ]);
}

/**
 * Clear query cache (useful for testing or data updates)
 */
export function clearQueryCache(): void {
  queryCache.clear();
  logger.log('Query cache cleared');
}

/**
 * Get query performance metrics
 */
export function getQueryMetrics() {
  return performanceMonitor.getMetrics();
}

/**
 * Clean up expired cache entries (call periodically)
 */
export function cleanupCache(): void {
  queryCache.cleanup();
}

// Auto-cleanup every 10 minutes
setInterval(cleanupCache, 10 * 60 * 1000);

export default {
  optimizedQuery,
  batchQueries,
  getOptimizedDeals,
  getOptimizedActivities,
  getDashboardMetrics,
  clearQueryCache,
  getQueryMetrics,
  cleanupCache
};