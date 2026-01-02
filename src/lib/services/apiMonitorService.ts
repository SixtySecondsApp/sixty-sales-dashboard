/**
 * API Monitor Service
 * 
 * Lightweight per-user request tracking for Supabase client usage.
 * Batches and writes to api_monitor_rollups_daily periodically.
 */

import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

interface RequestCount {
  endpoint: string;
  method: string;
  status: number;
  timestamp: number;
}

class ApiMonitorService {
  private requestQueue: RequestCount[] = [];
  private flushInterval: number = 5 * 60 * 1000; // 5 minutes
  private flushTimer: NodeJS.Timeout | null = null;
  private userId: string | null = null;
  private isEnabled: boolean = true;

  constructor() {
    // Only enable in production or when explicitly enabled
    this.isEnabled = import.meta.env.PROD || import.meta.env.VITE_ENABLE_API_MONITOR === 'true';
    
    if (this.isEnabled) {
      this.startFlushTimer();
    }
  }

  /**
   * Initialize with user ID (call after auth)
   */
  setUserId(userId: string | null) {
    this.userId = userId;
    if (userId && this.isEnabled) {
      // Flush any pending requests for previous user
      this.flush();
    }
  }

  /**
   * Track a request (non-blocking, batched)
   */
  trackRequest(endpoint: string, method: string = 'GET', status: number = 200) {
    if (!this.isEnabled || !this.userId) return;

    // Only track REST API endpoints (not Edge Functions or other paths)
    if (!endpoint.includes('/rest/v1/') && !endpoint.includes('/rpc/')) {
      return;
    }

    this.requestQueue.push({
      endpoint,
      method,
      status,
      timestamp: Date.now(),
    });

    // Auto-flush if queue gets large (prevent memory issues)
    if (this.requestQueue.length >= 100) {
      this.flush();
    }
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Flush queued requests to database
   */
  async flush(): Promise<void> {
    if (this.requestQueue.length === 0 || !this.userId) return;

    const queue = [...this.requestQueue];
    this.requestQueue = [];

    try {
      // Aggregate by endpoint/method/status
      const aggregated = new Map<string, { count: number; errors: number }>();

      for (const req of queue) {
        const key = `${req.method}:${req.endpoint}:${req.status}`;
        const existing = aggregated.get(key) || { count: 0, errors: 0 };
        existing.count++;
        if (req.status >= 400) existing.errors++;
        aggregated.set(key, existing);
      }

      // Get today's date
      const today = new Date().toISOString().split('T')[0];

      // Fetch existing rollup for today
      const { data: existing } = await supabase
        .from('api_monitor_rollups_daily')
        .select('*')
        .eq('date', today)
        .eq('user_id', this.userId)
        .maybeSingle();

      // Calculate totals
      let totalRequests = 0;
      let totalErrors = 0;
      const topEndpoints: Array<{ endpoint: string; method: string; count: number }> = [];
      const errorBreakdown: Record<string, number> = {};

      for (const [key, data] of aggregated.entries()) {
        const [method, endpoint, statusStr] = key.split(':');
        const status = parseInt(statusStr, 10);
        
        totalRequests += data.count;
        totalErrors += data.errors;

        // Track top endpoints
        const existingEndpoint = topEndpoints.find((e) => e.endpoint === endpoint && e.method === method);
        if (existingEndpoint) {
          existingEndpoint.count += data.count;
        } else {
          topEndpoints.push({ endpoint, method, count: data.count });
        }

        // Track error breakdown
        if (status >= 400) {
          errorBreakdown[status] = (errorBreakdown[status] || 0) + data.errors;
        }
      }

      // Sort top endpoints
      topEndpoints.sort((a, b) => b.count - a.count);

      const errorRate = totalRequests > 0 ? Number(((totalErrors / totalRequests) * 100).toFixed(2)) : 0;

      // Upsert rollup
      const rollupData = {
        date: today,
        user_id: this.userId,
        total_requests: (existing?.total_requests || 0) + totalRequests,
        total_errors: (existing?.total_errors || 0) + totalErrors,
        error_rate: errorRate,
        top_endpoints: topEndpoints.slice(0, 20), // Keep top 20
        error_breakdown: {
          ...(existing?.error_breakdown as Record<string, number> || {}),
          ...errorBreakdown,
        },
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('api_monitor_rollups_daily')
        .upsert(rollupData, { onConflict: 'date,user_id' });

      if (error) {
        logger.warn('[ApiMonitorService] Failed to flush rollup:', error);
        // Re-queue on error (but limit to prevent infinite loops)
        if (this.requestQueue.length < 1000) {
          this.requestQueue.unshift(...queue);
        }
      }
    } catch (error) {
      logger.error('[ApiMonitorService] Flush error:', error);
      // Re-queue on error
      if (this.requestQueue.length < 1000) {
        this.requestQueue.unshift(...queue);
      }
    }
  }

  /**
   * Cleanup (call on logout or app shutdown)
   */
  cleanup() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    // Final flush
    this.flush();
    this.userId = null;
  }
}

// Singleton instance
export const apiMonitorService = new ApiMonitorService();
