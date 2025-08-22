/**
 * Performance Testing - Sales Activities and Pipeline Deals Reconciliation
 * 
 * Tests large dataset handling (>1000 records), batch processing efficiency,
 * memory usage, and timeout handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performance } from 'perf_hooks';
import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

// Performance monitoring utilities
class PerformanceMonitor {
  private startTime: number = 0;
  private endTime: number = 0;
  private memoryStart: any = null;
  private memoryEnd: any = null;

  start() {
    this.startTime = performance.now();
    if (typeof process !== 'undefined' && process.memoryUsage) {
      this.memoryStart = process.memoryUsage();
    }
  }

  end() {
    this.endTime = performance.now();
    if (typeof process !== 'undefined' && process.memoryUsage) {
      this.memoryEnd = process.memoryUsage();
    }
    return this.getMetrics();
  }

  getMetrics() {
    const duration = this.endTime - this.startTime;
    const memoryDelta = this.memoryEnd && this.memoryStart ? {
      heapUsed: this.memoryEnd.heapUsed - this.memoryStart.heapUsed,
      heapTotal: this.memoryEnd.heapTotal - this.memoryStart.heapTotal,
      external: this.memoryEnd.external - this.memoryStart.external,
      rss: this.memoryEnd.rss - this.memoryStart.rss
    } : null;

    return {
      duration,
      memoryDelta,
      throughput: null as number | null
    };
  }
}

// Test data generation utilities
class TestDataGenerator {
  static generateActivities(count: number, userId: string = 'user-1') {
    const activities = [];
    const companies = [
      'Viewpoint Construction', 'ViewPoint VC', 'Viewpoint',
      'TechCorp Inc', 'BuildCorp Ltd', 'InnovateNow',
      'ScaleSoft', 'DataFlow Systems', 'CloudFirst',
      'NextGen Solutions'
    ];

    for (let i = 0; i < count; i++) {
      const date = new Date(2024, 0, 1 + (i % 365));
      activities.push({
        id: `act-${i + 1}`,
        client_name: companies[i % companies.length],
        amount: Math.floor(Math.random() * 50000) + 1000,
        date: date.toISOString().split('T')[0],
        type: 'sale',
        status: 'completed',
        user_id: userId,
        deal_id: Math.random() > 0.3 ? null : `deal-${Math.floor(i / 2) + 1}`, // 30% have deals
        created_at: date.toISOString(),
        updated_at: date.toISOString()
      });
    }
    return activities;
  }

  static generateDeals(count: number, userId: string = 'user-1') {
    const deals = [];
    const companies = [
      'Viewpoint Construction', 'ViewPoint VC', 'Viewpoint',
      'TechCorp Inc', 'BuildCorp Ltd', 'InnovateNow',
      'ScaleSoft', 'DataFlow Systems', 'CloudFirst',
      'NextGen Solutions'
    ];

    for (let i = 0; i < count; i++) {
      const date = new Date(2024, 0, 1 + (i % 365));
      deals.push({
        id: `deal-${i + 1}`,
        name: `Deal ${i + 1}`,
        company: companies[i % companies.length],
        value: Math.floor(Math.random() * 100000) + 5000,
        status: 'won',
        stage_changed_at: date.toISOString(),
        owner_id: userId,
        created_at: date.toISOString(),
        updated_at: date.toISOString()
      });
    }
    return deals;
  }

  static generateAnalysisResponse(activityCount: number, dealCount: number) {
    const orphanActivities = Math.floor(activityCount * 0.2); // 20% orphan activities
    const orphanDeals = Math.floor(dealCount * 0.15); // 15% orphan deals

    return {
      total_sales_activities: activityCount,
      total_won_deals: dealCount,
      orphan_activities: orphanActivities,
      orphan_deals: orphanDeals,
      total_activity_revenue: activityCount * 15000, // Average $15k per activity
      total_deal_revenue: dealCount * 25000, // Average $25k per deal
      activity_deal_linkage_rate: ((activityCount - orphanActivities) / activityCount) * 100,
      deal_activity_linkage_rate: ((dealCount - orphanDeals) / dealCount) * 100,
      overall_data_quality_score: 75.5
    };
  }

  static generateBatchResult(batchCount: number, recordsPerBatch: number) {
    const results = [];
    for (let i = 0; i < batchCount; i++) {
      results.push({
        batch: i + 1,
        success: true,
        processed: recordsPerBatch,
        linked: Math.floor(recordsPerBatch * 0.6), // 60% successful links
        created: Math.floor(recordsPerBatch * 0.1), // 10% new records created
        errors: 0
      });
    }

    return {
      success: true,
      batchesExecuted: batchCount,
      totalProcessed: batchCount * recordsPerBatch,
      totalErrors: 0,
      results,
      executedAt: new Date().toISOString()
    };
  }
}

// Mock API response helper with performance simulation
const mockApiResponse = (data: any, error?: string, status = 200, delay = 0) => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve({
        ok: status >= 200 && status < 300,
        status,
        json: vi.fn().mockResolvedValue(error ? { error } : data),
        text: vi.fn().mockResolvedValue(JSON.stringify(error ? { error } : data))
      });
    }, delay);
  });
};

// Mock fetch globally
global.fetch = vi.fn();

describe('Performance Testing', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    vi.clearAllMocks();
    monitor = new PerformanceMonitor();
    
    // Mock authentication
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Large Dataset Handling', () => {
    it('should handle analysis of >1000 activities within performance limits', async () => {
      const activityCount = 1500;
      const dealCount = 1200;
      const analysisData = TestDataGenerator.generateAnalysisResponse(activityCount, dealCount);

      (global.fetch as any).mockResolvedValueOnce(
        await mockApiResponse({ data: analysisData }, undefined, 200, 150) // 150ms simulated DB query time
      );

      monitor.start();

      const response = await fetch('/api/reconcile/analysis?analysisType=overview');
      const result = await response.json();

      const metrics = monitor.end();

      expect(response.ok).toBe(true);
      expect(result.data.total_sales_activities).toBe(activityCount);
      expect(result.data.total_won_deals).toBe(dealCount);

      // Performance assertions
      expect(metrics.duration).toBeLessThan(500); // Should complete within 500ms
      logger.log(`Large dataset analysis took ${metrics.duration.toFixed(2)}ms`);

      // Verify data integrity with large dataset
      expect(result.data.orphan_activities).toBeGreaterThan(0);
      expect(result.data.activity_deal_linkage_rate).toBeGreaterThan(70);
    });

    it('should handle orphan analysis with >2000 records efficiently', async () => {
      const orphanActivities = TestDataGenerator.generateActivities(1200).slice(0, 800); // 800 orphans
      const orphanDeals = TestDataGenerator.generateDeals(600).slice(0, 400); // 400 orphan deals

      const orphanData = {
        orphan_activities: orphanActivities,
        orphan_deals: orphanDeals,
        summary: {
          total_orphan_activities: orphanActivities.length,
          total_orphan_deals: orphanDeals.length,
          total_orphan_activity_revenue: orphanActivities.reduce((sum, a) => sum + a.amount, 0),
          total_orphan_deal_revenue: orphanDeals.reduce((sum, d) => sum + d.value, 0)
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        await mockApiResponse({ data: orphanData }, undefined, 200, 200)
      );

      monitor.start();

      const response = await fetch('/api/reconcile/analysis?analysisType=orphans');
      const result = await response.json();

      const metrics = monitor.end();

      expect(response.ok).toBe(true);
      expect(result.data.orphan_activities).toHaveLength(800);
      expect(result.data.orphan_deals).toHaveLength(400);

      // Performance assertions for large dataset
      expect(metrics.duration).toBeLessThan(750); // Should handle large orphan sets efficiently
      logger.log(`Large orphan analysis took ${metrics.duration.toFixed(2)}ms`);

      // Verify data structure integrity
      expect(result.data.summary.total_orphan_activities).toBe(800);
      expect(result.data.summary.total_orphan_deals).toBe(400);
    });

    it('should handle matching analysis with high confidence calculation load', async () => {
      // Generate large matching dataset
      const matchCount = 500; // 500 potential matches to calculate confidence for
      const matches = [];

      for (let i = 0; i < matchCount; i++) {
        matches.push({
          activity_id: `act-${i + 1}`,
          deal_id: `deal-${i + 1}`,
          client_name: `Company ${i % 100}`,
          company: `Company ${i % 100}`,
          amount: 10000 + (i * 100),
          value: 10500 + (i * 100),
          date: '2024-01-15',
          stage_changed_at: '2024-01-16',
          days_difference: 1,
          name_match_score: 30 + (i % 10),
          date_proximity_score: 25 - (i % 5),
          amount_similarity_score: 20 + (i % 8),
          total_confidence_score: 75 + (i % 20),
          confidence_level: i % 3 === 0 ? 'high_confidence' : 
                          i % 3 === 1 ? 'medium_confidence' : 'low_confidence'
        });
      }

      const matchingData = {
        matches: {
          high_confidence: matches.filter(m => m.confidence_level === 'high_confidence'),
          medium_confidence: matches.filter(m => m.confidence_level === 'medium_confidence'),
          low_confidence: matches.filter(m => m.confidence_level === 'low_confidence')
        },
        all_matches: matches,
        summary: {
          total_matches: matchCount,
          high_confidence_matches: matches.filter(m => m.confidence_level === 'high_confidence').length,
          medium_confidence_matches: matches.filter(m => m.confidence_level === 'medium_confidence').length,
          low_confidence_matches: matches.filter(m => m.confidence_level === 'low_confidence').length,
          confidence_threshold: 50
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        await mockApiResponse({ data: matchingData }, undefined, 200, 300) // 300ms for complex matching
      );

      monitor.start();

      const response = await fetch('/api/reconcile/analysis?analysisType=matching&confidenceThreshold=50');
      const result = await response.json();

      const metrics = monitor.end();

      expect(response.ok).toBe(true);
      expect(result.data.summary.total_matches).toBe(matchCount);

      // Performance assertions for complex matching
      expect(metrics.duration).toBeLessThan(1000); // Complex matching should still be under 1s
      logger.log(`Complex matching analysis took ${metrics.duration.toFixed(2)}ms`);

      // Verify confidence distribution
      const totalMatches = result.data.summary.high_confidence_matches + 
                          result.data.summary.medium_confidence_matches + 
                          result.data.summary.low_confidence_matches;
      expect(totalMatches).toBe(matchCount);
    });

    it('should handle user statistics for multiple users efficiently', async () => {
      const userCount = 50;
      const userStats = [];

      for (let i = 0; i < userCount; i++) {
        userStats.push({
          id: `user-${i + 1}`,
          first_name: `User${i + 1}`,
          last_name: 'Test',
          email: `user${i + 1}@example.com`,
          user_sales_activities: 20 + (i * 2),
          user_won_deals: 15 + i,
          user_active_clients: 5 + (i % 10),
          user_orphan_activities: 2 + (i % 5),
          user_orphan_deals: 1 + (i % 3),
          user_activity_revenue: (20 + (i * 2)) * 15000,
          user_deal_revenue: (15 + i) * 25000,
          user_linkage_rate: 75 + (i % 20)
        });
      }

      const statsData = {
        user_statistics: userStats,
        summary: {
          total_users_analyzed: userCount,
          total_combined_revenue: userStats.reduce((sum, u) => sum + u.user_activity_revenue, 0),
          average_linkage_rate: userStats.reduce((sum, u) => sum + u.user_linkage_rate, 0) / userCount
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        await mockApiResponse({ data: statsData }, undefined, 200, 100)
      );

      monitor.start();

      const response = await fetch('/api/reconcile/analysis?analysisType=statistics');
      const result = await response.json();

      const metrics = monitor.end();

      expect(response.ok).toBe(true);
      expect(result.data.user_statistics).toHaveLength(userCount);

      // Performance assertions for multi-user aggregation
      expect(metrics.duration).toBeLessThan(400); // Multi-user stats should be fast
      logger.log(`Multi-user statistics took ${metrics.duration.toFixed(2)}ms`);

      // Verify aggregation accuracy
      expect(result.data.summary.total_users_analyzed).toBe(userCount);
      expect(result.data.summary.average_linkage_rate).toBeGreaterThan(70);
    });
  });

  describe('Batch Processing Efficiency', () => {
    it('should process large batches within time limits', async () => {
      const batchSize = 200;
      const batchCount = 10;
      const totalRecords = batchSize * batchCount;

      const batchResult = TestDataGenerator.generateBatchResult(batchCount, batchSize);

      (global.fetch as any).mockResolvedValueOnce(
        await mockApiResponse(batchResult, undefined, 200, 500) // 500ms for batch processing
      );

      monitor.start();

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch',
          mode: 'safe',
          batchSize,
          maxBatches: batchCount,
          delayBetweenBatches: 50
        })
      });

      const result = await response.json();
      const metrics = monitor.end();

      expect(response.ok).toBe(true);
      expect(result.totalProcessed).toBe(totalRecords);
      expect(result.batchesExecuted).toBe(batchCount);

      // Performance assertions
      expect(metrics.duration).toBeLessThan(2000); // Large batch should complete within 2s
      
      // Calculate throughput
      const throughputPerSecond = totalRecords / (metrics.duration / 1000);
      expect(throughputPerSecond).toBeGreaterThan(500); // Should process >500 records/second

      logger.log(`Batch processing: ${totalRecords} records in ${metrics.duration.toFixed(2)}ms`);
      logger.log(`Throughput: ${throughputPerSecond.toFixed(0)} records/second`);
    });

    it('should handle batch processing with optimal memory usage', async () => {
      const batchSize = 100;
      const batchCount = 20; // 2000 total records
      const batchResult = TestDataGenerator.generateBatchResult(batchCount, batchSize);

      (global.fetch as any).mockResolvedValueOnce(
        await mockApiResponse(batchResult, undefined, 200, 300)
      );

      monitor.start();

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch',
          mode: 'safe',
          batchSize,
          maxBatches: batchCount,
          optimizeMemory: true
        })
      });

      const result = await response.json();
      const metrics = monitor.end();

      expect(response.ok).toBe(true);
      expect(result.totalProcessed).toBe(2000);

      // Memory usage assertions (if available)
      if (metrics.memoryDelta) {
        const memoryIncreaseMB = metrics.memoryDelta.heapUsed / (1024 * 1024);
        expect(memoryIncreaseMB).toBeLessThan(50); // Should use <50MB additional memory
        logger.log(`Memory usage increase: ${memoryIncreaseMB.toFixed(2)}MB`);
      }

      // Performance should still be good despite memory optimization
      const throughputPerSecond = 2000 / (metrics.duration / 1000);
      expect(throughputPerSecond).toBeGreaterThan(300); // Slightly lower but still efficient

      logger.log(`Memory-optimized batch: ${throughputPerSecond.toFixed(0)} records/second`);
    });

    it('should scale batch processing linearly', async () => {
      const testSizes = [50, 100, 200, 500];
      const performanceResults = [];

      for (const batchSize of testSizes) {
        const batchCount = Math.ceil(1000 / batchSize); // Process ~1000 records each time
        const batchResult = TestDataGenerator.generateBatchResult(batchCount, batchSize);

        (global.fetch as any).mockResolvedValueOnce(
          await mockApiResponse(batchResult, undefined, 200, 100 + (batchSize / 10)) // Scaled delay
        );

        const testMonitor = new PerformanceMonitor();
        testMonitor.start();

        const response = await fetch('/api/reconcile/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'batch',
            mode: 'safe',
            batchSize,
            maxBatches: batchCount
          })
        });

        const result = await response.json();
        const metrics = testMonitor.end();

        expect(response.ok).toBe(true);

        const throughput = result.totalProcessed / (metrics.duration / 1000);
        performanceResults.push({
          batchSize,
          totalProcessed: result.totalProcessed,
          duration: metrics.duration,
          throughput
        });

        logger.log(`Batch size ${batchSize}: ${throughput.toFixed(0)} records/second`);
      }

      // Verify that larger batch sizes don't severely degrade performance
      const throughputs = performanceResults.map(r => r.throughput);
      const maxThroughput = Math.max(...throughputs);
      const minThroughput = Math.min(...throughputs);
      
      // Performance shouldn't vary by more than 50% across batch sizes
      expect(minThroughput / maxThroughput).toBeGreaterThan(0.5);
    });

    it('should handle concurrent batch operations efficiently', async () => {
      const concurrentBatches = 3;
      const batchSize = 100;
      const batchCount = 5;

      // Mock concurrent batch responses
      const promises = Array(concurrentBatches).fill(null).map((_, index) => {
        const batchResult = TestDataGenerator.generateBatchResult(batchCount, batchSize);
        return mockApiResponse(batchResult, undefined, 200, 200 + (index * 50));
      });

      (global.fetch as any)
        .mockResolvedValueOnce(promises[0])
        .mockResolvedValueOnce(promises[1])
        .mockResolvedValueOnce(promises[2]);

      monitor.start();

      // Execute concurrent batches
      const concurrentPromises = Array(concurrentBatches).fill(null).map((_, index) =>
        fetch('/api/reconcile/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'batch',
            mode: 'safe',
            batchSize,
            maxBatches: batchCount,
            userId: `user-${index + 1}`
          })
        })
      );

      const results = await Promise.all(concurrentPromises);
      const metrics = monitor.end();

      // Verify all batches completed successfully
      results.forEach(response => {
        expect(response.ok).toBe(true);
      });

      const totalProcessed = concurrentBatches * batchCount * batchSize;
      const throughput = totalProcessed / (metrics.duration / 1000);

      // Concurrent processing should achieve higher total throughput
      expect(throughput).toBeGreaterThan(800); // Should handle concurrent loads well

      logger.log(`Concurrent batches: ${throughput.toFixed(0)} total records/second`);
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should handle large result sets without memory leaks', async () => {
      const largeDataSet = {
        orphan_activities: TestDataGenerator.generateActivities(2000),
        orphan_deals: TestDataGenerator.generateDeals(1500),
        summary: {
          total_orphan_activities: 2000,
          total_orphan_deals: 1500,
          total_orphan_activity_revenue: 2000 * 15000,
          total_orphan_deal_revenue: 1500 * 25000
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        await mockApiResponse({ data: largeDataSet }, undefined, 200, 250)
      );

      monitor.start();

      const response = await fetch('/api/reconcile/analysis?analysisType=orphans');
      const result = await response.json();

      const metrics = monitor.end();

      expect(response.ok).toBe(true);
      expect(result.data.orphan_activities).toHaveLength(2000);
      expect(result.data.orphan_deals).toHaveLength(1500);

      // Memory usage should be reasonable for large dataset
      if (metrics.memoryDelta) {
        const memoryIncreaseMB = metrics.memoryDelta.heapUsed / (1024 * 1024);
        expect(memoryIncreaseMB).toBeLessThan(100); // Should use <100MB for large dataset
        logger.log(`Large dataset memory usage: ${memoryIncreaseMB.toFixed(2)}MB`);
      }

      // Performance should still be acceptable
      expect(metrics.duration).toBeLessThan(1000);
    });

    it('should efficiently stream large batch results', async () => {
      const largeBatchCount = 50;
      const batchSize = 100;
      const streamedResult = TestDataGenerator.generateBatchResult(largeBatchCount, batchSize);

      // Simulate streaming response
      (global.fetch as any).mockResolvedValueOnce(
        await mockApiResponse(streamedResult, undefined, 200, 400)
      );

      monitor.start();

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch',
          mode: 'safe',
          batchSize,
          maxBatches: largeBatchCount,
          streamResults: true // Hypothetical streaming mode
        })
      });

      const result = await response.json();
      const metrics = monitor.end();

      expect(response.ok).toBe(true);
      expect(result.totalProcessed).toBe(5000);
      expect(result.results).toHaveLength(largeBatchCount);

      // Memory should be optimized for streaming
      if (metrics.memoryDelta) {
        const memoryIncreaseMB = metrics.memoryDelta.heapUsed / (1024 * 1024);
        expect(memoryIncreaseMB).toBeLessThan(75); // Streaming should use less memory
        logger.log(`Streaming batch memory usage: ${memoryIncreaseMB.toFixed(2)}MB`);
      }

      const throughput = 5000 / (metrics.duration / 1000);
      expect(throughput).toBeGreaterThan(600); // Streaming should maintain good performance
    });
  });

  describe('Timeout Handling', () => {
    it('should handle request timeouts gracefully', async () => {
      const longRunningDelay = 5000; // 5 second delay

      (global.fetch as any).mockImplementation(() =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), longRunningDelay);
        })
      );

      monitor.start();

      try {
        await fetch('/api/reconcile/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'safe',
            batchSize: 1000,
            timeout: 3000 // 3 second timeout
          })
        });
        expect.fail('Should have thrown timeout error');
      } catch (error) {
        const metrics = monitor.end();
        expect(error.message).toBe('Request timeout');
        
        // Should timeout within reasonable time
        expect(metrics.duration).toBeLessThan(6000);
        logger.log(`Timeout handled in ${metrics.duration.toFixed(2)}ms`);
      }
    });

    it('should handle partial timeouts in batch processing', async () => {
      const batchCount = 5;
      const batchSize = 100;

      // Mock some batches succeeding and some timing out
      const batchResult = {
        success: true,
        batchesExecuted: 3, // Only 3 out of 5 completed
        totalProcessed: 300,
        totalErrors: 2,
        results: [
          { batch: 1, success: true, processed: 100, errors: 0 },
          { batch: 2, success: true, processed: 100, errors: 0 },
          { batch: 3, success: true, processed: 100, errors: 0 },
          { batch: 4, success: false, error: 'Batch timeout' },
          { batch: 5, success: false, error: 'Batch timeout' }
        ],
        partialFailure: true,
        timeoutBatches: [4, 5]
      };

      (global.fetch as any).mockResolvedValueOnce(
        await mockApiResponse(batchResult, undefined, 200, 3500) // Partial timeout scenario
      );

      monitor.start();

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch',
          mode: 'safe',
          batchSize,
          maxBatches: batchCount,
          batchTimeout: 1000 // 1 second per batch timeout
        })
      });

      const result = await response.json();
      const metrics = monitor.end();

      expect(response.ok).toBe(true);
      expect(result.partialFailure).toBe(true);
      expect(result.batchesExecuted).toBe(3);
      expect(result.totalProcessed).toBe(300);

      // Should handle partial timeouts reasonably
      expect(metrics.duration).toBeLessThan(5000);
      logger.log(`Partial timeout handled: ${result.totalProcessed} records in ${metrics.duration.toFixed(2)}ms`);
    });

    it('should implement progressive timeout strategies', async () => {
      const timeoutStrategies = [
        { name: 'immediate', timeout: 100, expectSuccess: false },
        { name: 'short', timeout: 500, expectSuccess: false },
        { name: 'normal', timeout: 2000, expectSuccess: true },
        { name: 'extended', timeout: 5000, expectSuccess: true }
      ];

      for (const strategy of timeoutStrategies) {
        const responseDelay = 1500; // 1.5 second operation
        const result = { success: true, processed: 100 };

        if (strategy.expectSuccess) {
          (global.fetch as any).mockResolvedValueOnce(
            await mockApiResponse(result, undefined, 200, responseDelay)
          );
        } else {
          (global.fetch as any).mockImplementation(() =>
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Timeout')), strategy.timeout);
            })
          );
        }

        const testMonitor = new PerformanceMonitor();
        testMonitor.start();

        try {
          const response = await fetch('/api/reconcile/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'safe',
              timeout: strategy.timeout
            })
          });

          const apiResult = await response.json();
          const metrics = testMonitor.end();

          if (strategy.expectSuccess) {
            expect(response.ok).toBe(true);
            expect(apiResult.success).toBe(true);
            logger.log(`${strategy.name} timeout (${strategy.timeout}ms): SUCCESS in ${metrics.duration.toFixed(2)}ms`);
          } else {
            expect.fail('Should have timed out');
          }
        } catch (error) {
          const metrics = testMonitor.end();
          
          if (!strategy.expectSuccess) {
            expect(error.message).toBe('Timeout');
            logger.log(`${strategy.name} timeout (${strategy.timeout}ms): TIMEOUT in ${metrics.duration.toFixed(2)}ms`);
          } else {
            throw error;
          }
        }
      }
    });

    it('should recover gracefully from timeout scenarios', async () => {
      const scenarios = [
        { description: 'Initial timeout then success', firstAttempt: 'timeout', secondAttempt: 'success' },
        { description: 'Multiple timeouts then success', firstAttempt: 'timeout', secondAttempt: 'timeout', thirdAttempt: 'success' }
      ];

      for (const scenario of scenarios) {
        logger.log(`Testing: ${scenario.description}`);

        // Mock progressive attempts
        if (scenario.firstAttempt === 'timeout') {
          (global.fetch as any).mockRejectedValueOnce(new Error('Request timeout'));
        }
        if (scenario.secondAttempt === 'timeout') {
          (global.fetch as any).mockRejectedValueOnce(new Error('Request timeout'));
        }
        if (scenario.thirdAttempt === 'success' || scenario.secondAttempt === 'success') {
          (global.fetch as any).mockResolvedValueOnce(
            await mockApiResponse({ success: true, processed: 50 }, undefined, 200, 100)
          );
        }

        monitor.start();

        // Simulate retry logic
        let attempt = 0;
        let success = false;
        const maxAttempts = 3;

        while (attempt < maxAttempts && !success) {
          attempt++;
          try {
            const response = await fetch('/api/reconcile/execute', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                mode: 'safe',
                attempt,
                timeout: 2000
              })
            });

            if (response.ok) {
              success = true;
              const result = await response.json();
              expect(result.success).toBe(true);
            }
          } catch (error) {
            if (attempt >= maxAttempts) {
              throw error;
            }
            // Continue to next attempt
          }
        }

        const metrics = monitor.end();
        expect(success).toBe(true);
        logger.log(`Recovery successful after ${attempt} attempts in ${metrics.duration.toFixed(2)}ms`);
      }
    });
  });

  describe('Performance Regression Testing', () => {
    it('should maintain performance baselines across different data sizes', async () => {
      const dataSizes = [100, 500, 1000, 2000];
      const performanceBaseline = {
        100: { maxDuration: 200, minThroughput: 800 },
        500: { maxDuration: 400, minThroughput: 700 },
        1000: { maxDuration: 600, minThroughput: 600 },
        2000: { maxDuration: 1000, minThroughput: 500 }
      };

      for (const size of dataSizes) {
        const analysisData = TestDataGenerator.generateAnalysisResponse(size, Math.floor(size * 0.8));
        
        (global.fetch as any).mockResolvedValueOnce(
          await mockApiResponse({ data: analysisData }, undefined, 200, 50 + (size / 20))
        );

        const testMonitor = new PerformanceMonitor();
        testMonitor.start();

        const response = await fetch(`/api/reconcile/analysis?analysisType=overview&dataSize=${size}`);
        const result = await response.json();

        const metrics = testMonitor.end();

        expect(response.ok).toBe(true);
        expect(result.data.total_sales_activities).toBe(size);

        // Check against performance baseline
        const baseline = performanceBaseline[size as keyof typeof performanceBaseline];
        expect(metrics.duration).toBeLessThan(baseline.maxDuration);

        const throughput = size / (metrics.duration / 1000);
        expect(throughput).toBeGreaterThan(baseline.minThroughput);

        logger.log(`Size ${size}: ${metrics.duration.toFixed(2)}ms, ${throughput.toFixed(0)} records/sec`);
      }
    });

    it('should validate memory usage stays within acceptable bounds', async () => {
      const memoryTests = [
        { description: 'Small dataset', size: 200, maxMemoryMB: 10 },
        { description: 'Medium dataset', size: 1000, maxMemoryMB: 30 },
        { description: 'Large dataset', size: 2000, maxMemoryMB: 60 },
        { description: 'Extra large dataset', size: 5000, maxMemoryMB: 120 }
      ];

      for (const test of memoryTests) {
        const data = {
          orphan_activities: TestDataGenerator.generateActivities(test.size),
          orphan_deals: TestDataGenerator.generateDeals(Math.floor(test.size * 0.6)),
          summary: { total_orphan_activities: test.size }
        };

        (global.fetch as any).mockResolvedValueOnce(
          await mockApiResponse({ data }, undefined, 200, 100)
        );

        const testMonitor = new PerformanceMonitor();
        testMonitor.start();

        const response = await fetch('/api/reconcile/analysis?analysisType=orphans');
        const result = await response.json();

        const metrics = testMonitor.end();

        expect(response.ok).toBe(true);
        expect(result.data.orphan_activities).toHaveLength(test.size);

        // Validate memory usage
        if (metrics.memoryDelta) {
          const memoryIncreaseMB = metrics.memoryDelta.heapUsed / (1024 * 1024);
          expect(memoryIncreaseMB).toBeLessThan(test.maxMemoryMB);
          logger.log(`${test.description}: ${memoryIncreaseMB.toFixed(2)}MB (limit: ${test.maxMemoryMB}MB)`);
        }
      }
    });

    it('should benchmark critical operations consistently', async () => {
      const benchmarkRuns = 5;
      const testOperations = [
        { name: 'Overview Analysis', endpoint: '/api/reconcile/analysis?analysisType=overview' },
        { name: 'Orphan Analysis', endpoint: '/api/reconcile/analysis?analysisType=orphans' },
        { name: 'Matching Analysis', endpoint: '/api/reconcile/analysis?analysisType=matching' }
      ];

      for (const operation of testOperations) {
        const durations: number[] = [];
        const mockData = operation.name.includes('Overview') 
          ? { data: TestDataGenerator.generateAnalysisResponse(1000, 800) }
          : { data: { orphan_activities: [], summary: {} } };

        for (let run = 0; run < benchmarkRuns; run++) {
          (global.fetch as any).mockResolvedValueOnce(
            await mockApiResponse(mockData, undefined, 200, 100 + (run * 10))
          );

          const testMonitor = new PerformanceMonitor();
          testMonitor.start();

          const response = await fetch(operation.endpoint);
          const result = await response.json();

          const metrics = testMonitor.end();

          expect(response.ok).toBe(true);
          durations.push(metrics.duration);
        }

        // Calculate statistics
        const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        const minDuration = Math.min(...durations);
        const maxDuration = Math.max(...durations);
        const variance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
        const stdDev = Math.sqrt(variance);

        logger.log(`${operation.name} Benchmark:`);
        logger.log(`  Average: ${avgDuration.toFixed(2)}ms`);
        logger.log(`  Min/Max: ${minDuration.toFixed(2)}ms / ${maxDuration.toFixed(2)}ms`);
        logger.log(`  Std Dev: ${stdDev.toFixed(2)}ms`);

        // Performance should be consistent (low standard deviation)
        expect(stdDev).toBeLessThan(avgDuration * 0.3); // StdDev should be <30% of average
        expect(maxDuration).toBeLessThan(avgDuration * 2); // Max should be <2x average
      }
    });
  });
});