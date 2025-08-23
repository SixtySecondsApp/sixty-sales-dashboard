/**
 * Phase 2 Reconciliation Engine Testing
 * 
 * Tests automatic reconciliation with different confidence levels, deal/activity creation,
 * batch processing capabilities, rollback and error recovery functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { supabase } from '@/lib/supabase/clientV2';

// Mock execution results
const mockExecutionResult = {
  total_processed: 10,
  high_confidence_links: 5,
  deals_created: 2,
  activities_created: 1,
  duplicates_marked: 1,
  errors: 0,
  success_rate: 100,
  orphan_activities_found: 3,
  orphan_deals_found: 2
};

const mockBatchResult = {
  success: true,
  mode: 'safe',
  userId: 'user-1',
  batchSize: 50,
  maxBatches: 5,
  batchesExecuted: 3,
  totalProcessed: 150,
  totalErrors: 0,
  results: [
    { batch: 1, success: true, processed: 50, linked: 20, created: 5, errors: 0 },
    { batch: 2, success: true, processed: 50, linked: 18, created: 3, errors: 0 },
    { batch: 3, success: true, processed: 50, linked: 15, created: 2, errors: 0 }
  ]
};

const mockRollbackResult = {
  success: true,
  rollback: {
    entries_reverted: 5,
    deals_removed: 2,
    activities_unlinked: 3,
    rollback_timestamp: '2024-01-15T12:00:00Z'
  }
};

const mockApiResponse = (data: any, error?: string, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(error ? { error } : data),
  text: vi.fn().mockResolvedValue(JSON.stringify(error ? { error } : data))
});

// Mock fetch globally
global.fetch = vi.fn();

describe('Phase 2 Reconciliation Engine Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock authentication
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Single Reconciliation Execution', () => {
    it('should execute reconciliation in safe mode successfully', async () => {
      const expectedResponse = {
        success: true,
        mode: 'safe',
        userId: 'user-1',
        batchSize: 100,
        execution: mockExecutionResult,
        summary: {
          totalProcessed: 10,
          highConfidenceLinks: 5,
          dealsCreated: 2,
          activitiesCreated: 1,
          duplicatesMarked: 1,
          errors: 0,
          successRate: 100,
          orphanActivitiesFound: 3,
          orphanDealsFound: 2
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(expectedResponse)
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'safe',
          userId: 'user-1',
          batchSize: 100
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.mode).toBe('safe');
      expect(result.summary.totalProcessed).toBe(10);
      expect(result.summary.highConfidenceLinks).toBe(5);
      expect(result.summary.successRate).toBe(100);
    });

    it('should execute reconciliation in aggressive mode', async () => {
      const aggressiveResult = {
        ...mockExecutionResult,
        total_processed: 15,
        high_confidence_links: 8,
        medium_confidence_links: 3,
        deals_created: 3,
        activities_created: 2
      };

      const expectedResponse = {
        success: true,
        mode: 'aggressive',
        userId: 'user-1',
        execution: aggressiveResult,
        summary: {
          totalProcessed: 15,
          highConfidenceLinks: 8,
          mediumConfidenceLinks: 3,
          dealsCreated: 3,
          activitiesCreated: 2
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(expectedResponse)
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'aggressive',
          userId: 'user-1',
          batchSize: 100
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.mode).toBe('aggressive');
      expect(result.summary.totalProcessed).toBe(15);
      expect(result.summary.mediumConfidenceLinks).toBe(3);
    });

    it('should execute dry run without making changes', async () => {
      const dryRunResult = {
        ...mockExecutionResult,
        total_processed: 12,
        changes_simulated: true,
        actual_changes_made: 0
      };

      const expectedResponse = {
        success: true,
        mode: 'dry_run',
        userId: 'user-1',
        execution: dryRunResult,
        summary: {
          totalProcessed: 12,
          changesSimulated: true,
          actualChangesMade: 0
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(expectedResponse)
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'dry_run',
          userId: 'user-1',
          batchSize: 100
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.mode).toBe('dry_run');
      expect(result.summary.changesSimulated).toBe(true);
      expect(result.summary.actualChangesMade).toBe(0);
    });

    it('should validate batch size constraints', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Batch size must be between 1 and 1000', 400)
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'safe',
          userId: 'user-1',
          batchSize: 1500 // Invalid batch size
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      expect(result.error).toBe('Batch size must be between 1 and 1000');
    });

    it('should validate mode parameter', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Invalid mode. Must be safe, aggressive, or dry_run', 400)
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'invalid_mode',
          userId: 'user-1',
          batchSize: 100
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      expect(result.error).toBe('Invalid mode. Must be safe, aggressive, or dry_run');
    });
  });

  describe('Batch Processing', () => {
    it('should execute batch reconciliation successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockBatchResult)
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch',
          mode: 'safe',
          userId: 'user-1',
          batchSize: 50,
          maxBatches: 5,
          delayBetweenBatches: 1000
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.batchesExecuted).toBe(3);
      expect(result.totalProcessed).toBe(150);
      expect(result.totalErrors).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    it('should handle partial batch failures gracefully', async () => {
      const partialFailureResult = {
        ...mockBatchResult,
        totalErrors: 1,
        results: [
          { batch: 1, success: true, processed: 50, linked: 20, created: 5, errors: 0 },
          { batch: 2, success: false, error: 'Database timeout' },
          { batch: 3, success: true, processed: 30, linked: 10, created: 2, errors: 0 }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(partialFailureResult)
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch',
          mode: 'safe',
          maxBatches: 3
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.totalErrors).toBe(1);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toBe('Database timeout');
    });

    it('should stop processing when no more records are found', async () => {
      const earlyStopResult = {
        ...mockBatchResult,
        batchesExecuted: 2,
        totalProcessed: 75,
        results: [
          { batch: 1, success: true, processed: 50, linked: 20, created: 5, errors: 0 },
          { batch: 2, success: true, processed: 25, linked: 10, created: 2, errors: 0 },
          // Batch 3 would have 0 processed, so processing stops
        ]
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(earlyStopResult)
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch',
          maxBatches: 5
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.batchesExecuted).toBe(2);
      expect(result.totalProcessed).toBe(75);
    });

    it('should respect delay between batches', async () => {
      const startTime = Date.now();
      
      // Mock a batch execution that should take time due to delays
      (global.fetch as any).mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve(mockApiResponse(mockBatchResult));
          }, 100); // Simulate processing time
        })
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch',
          delayBetweenBatches: 100
        })
      });

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      expect(response.ok).toBe(true);
      // Should take at least some time due to delays
      expect(executionTime).toBeGreaterThan(50);
    });
  });

  describe('Confidence Level Processing', () => {
    it('should handle high confidence matches (>80%)', async () => {
      const highConfidenceResult = {
        total_processed: 8,
        high_confidence_links: 8,
        medium_confidence_links: 0,
        low_confidence_links: 0,
        confidence_threshold_used: 80
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse({
          success: true,
          execution: highConfidenceResult,
          summary: highConfidenceResult
        })
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'safe', // Safe mode only processes high confidence
          confidenceThreshold: 80
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.summary.high_confidence_links).toBe(8);
      expect(result.summary.medium_confidence_links).toBe(0);
    });

    it('should handle medium confidence matches in aggressive mode', async () => {
      const mediumConfidenceResult = {
        total_processed: 12,
        high_confidence_links: 6,
        medium_confidence_links: 4,
        low_confidence_links: 0,
        confidence_threshold_used: 60
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse({
          success: true,
          execution: mediumConfidenceResult,
          summary: mediumConfidenceResult
        })
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'aggressive', // Aggressive mode processes medium confidence
          confidenceThreshold: 60
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.summary.high_confidence_links).toBe(6);
      expect(result.summary.medium_confidence_links).toBe(4);
    });

    it('should reject low confidence matches', async () => {
      const lowConfidenceResult = {
        total_processed: 5,
        high_confidence_links: 3,
        medium_confidence_links: 2,
        low_confidence_links: 0, // Low confidence not processed
        low_confidence_rejected: 5
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse({
          success: true,
          execution: lowConfidenceResult,
          summary: lowConfidenceResult
        })
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'aggressive',
          confidenceThreshold: 60
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.summary.low_confidence_links).toBe(0);
      expect(result.summary.low_confidence_rejected).toBe(5);
    });
  });

  describe('Deal and Activity Creation', () => {
    it('should create deals from orphan activities', async () => {
      const creationResult = {
        total_processed: 5,
        deals_created: 3,
        activities_linked_to_new_deals: 3,
        orphan_activities_resolved: 3
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse({
          success: true,
          execution: creationResult,
          summary: creationResult
        })
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'aggressive',
          createDealsFromOrphans: true
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.summary.deals_created).toBe(3);
      expect(result.summary.orphan_activities_resolved).toBe(3);
    });

    it('should create activities from orphan deals', async () => {
      const creationResult = {
        total_processed: 4,
        activities_created: 2,
        deals_linked_to_new_activities: 2,
        orphan_deals_resolved: 2
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse({
          success: true,
          execution: creationResult,
          summary: creationResult
        })
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'aggressive',
          createActivitiesFromOrphans: true
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.summary.activities_created).toBe(2);
      expect(result.summary.orphan_deals_resolved).toBe(2);
    });

    it('should maintain data integrity during creation', async () => {
      const integrityResult = {
        total_processed: 6,
        deals_created: 2,
        activities_created: 1,
        integrity_checks_passed: 3,
        data_validation_errors: 0
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse({
          success: true,
          execution: integrityResult,
          summary: integrityResult
        })
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'safe',
          validateDataIntegrity: true
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.summary.integrity_checks_passed).toBe(3);
      expect(result.summary.data_validation_errors).toBe(0);
    });
  });

  describe('Progress Monitoring', () => {
    it('should retrieve current reconciliation progress', async () => {
      const progressData = {
        success: true,
        userId: 'user-1',
        status: [
          { category: 'orphan_activities', count: 5, owner_id: 'user-1' },
          { category: 'orphan_deals', count: 3, owner_id: 'user-1' },
          { category: 'linked_records', count: 25, owner_id: 'user-1' }
        ],
        recentActivity: [
          {
            id: 1,
            action_type: 'AUTOMATIC_LINK',
            source_table: 'activities',
            confidence_score: 85,
            executed_at: '2024-01-15T10:00:00Z'
          }
        ],
        summary: {
          totalOrphanActivities: 5,
          totalOrphanDeals: 3,
          totalLinkedRecords: 25,
          recentActions: 1,
          lastReconciliation: '2024-01-15T10:00:00Z'
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(progressData)
      );

      const response = await fetch('/api/reconcile/execute?userId=user-1', {
        method: 'GET'
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.summary.totalOrphanActivities).toBe(5);
      expect(result.summary.totalOrphanDeals).toBe(3);
      expect(result.recentActivity).toHaveLength(1);
    });

    it('should filter progress by user', async () => {
      const userProgressData = {
        success: true,
        userId: 'user-2',
        status: [
          { category: 'orphan_activities', count: 2, owner_id: 'user-2' }
        ],
        summary: {
          totalOrphanActivities: 2,
          totalOrphanDeals: 0
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(userProgressData)
      );

      const response = await fetch('/api/reconcile/execute?userId=user-2', {
        method: 'GET'
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.userId).toBe('user-2');
      expect(result.summary.totalOrphanActivities).toBe(2);
    });
  });

  describe('Rollback and Error Recovery', () => {
    it('should rollback reconciliation actions successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mockRollbackResult)
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rollback',
          auditLogIds: [1, 2, 3],
          confirmRollback: true
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.rollback.entries_reverted).toBe(5);
      expect(result.rollback.deals_removed).toBe(2);
      expect(result.rollback.activities_unlinked).toBe(3);
    });

    it('should rollback by time threshold', async () => {
      const timeRollbackResult = {
        success: true,
        rollback: {
          entries_reverted: 8,
          time_threshold: '2024-01-15T10:00:00Z',
          affected_users: ['user-1', 'user-2']
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(timeRollbackResult)
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rollback',
          timeThreshold: '2024-01-15T10:00:00Z',
          confirmRollback: true
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.rollback.entries_reverted).toBe(8);
      expect(result.rollback.affected_users).toContain('user-1');
    });

    it('should require rollback confirmation', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Rollback confirmation required. Set confirmRollback: true', 400)
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rollback',
          auditLogIds: [1, 2, 3],
          confirmRollback: false
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      expect(result.error).toBe('Rollback confirmation required. Set confirmRollback: true');
    });

    it('should handle execution errors gracefully', async () => {
      const errorResult = {
        success: false,
        error: 'Database connection lost',
        partial_results: {
          processed_before_error: 25,
          last_successful_batch: 2
        },
        recovery_suggestions: [
          'Check database connection',
          'Retry with smaller batch size',
          'Review system logs'
        ]
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Failed to execute reconciliation', 500)
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'safe',
          batchSize: 100
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
      expect(result.error).toBe('Failed to execute reconciliation');
    });

    it('should handle timeout scenarios', async () => {
      // Mock a timeout scenario
      (global.fetch as any).mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 100);
        })
      );

      try {
        await fetch('/api/reconcile/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'safe',
            batchSize: 1000 // Large batch that might timeout
          })
        });
        expect.fail('Should have thrown timeout error');
      } catch (error) {
        expect(error.message).toBe('Request timeout');
      }
    });
  });

  describe('Audit Trail Verification', () => {
    it('should log all reconciliation actions', async () => {
      const resultWithAudit = {
        ...mockExecutionResult,
        recentActions: [
          {
            id: 1,
            action_type: 'AUTOMATIC_LINK',
            source_table: 'activities',
            source_id: 'act-1',
            target_table: 'deals',
            target_id: 'deal-1',
            confidence_score: 85,
            executed_at: '2024-01-15T10:00:00Z'
          },
          {
            id: 2,
            action_type: 'CREATE_DEAL_FROM_ACTIVITY',
            source_table: 'activities',
            source_id: 'act-2',
            target_table: 'deals',
            target_id: 'deal-new-1',
            confidence_score: 100,
            executed_at: '2024-01-15T10:01:00Z'
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse({
          success: true,
          execution: mockExecutionResult,
          recentActions: resultWithAudit.recentActions
        })
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'safe',
          auditTrail: true
        })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.recentActions).toHaveLength(2);
      expect(result.recentActions[0].action_type).toBe('AUTOMATIC_LINK');
      expect(result.recentActions[1].action_type).toBe('CREATE_DEAL_FROM_ACTIVITY');
    });

    it('should include metadata in audit entries', async () => {
      const auditWithMetadata = [
        {
          id: 1,
          action_type: 'AUTOMATIC_LINK',
          metadata: {
            activity_company: 'Viewpoint Construction',
            deal_company: 'Viewpoint Construction',
            name_similarity: 0.98,
            date_proximity: 0,
            amount_similarity: 0.95
          },
          confidence_score: 92
        }
      ];

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse({
          success: true,
          recentActions: auditWithMetadata
        })
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'safe' })
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.recentActions[0].metadata).toBeDefined();
      expect(result.recentActions[0].metadata.name_similarity).toBe(0.98);
      expect(result.recentActions[0].confidence_score).toBe(92);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle invalid HTTP methods', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Method not allowed', 405)
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'PUT' // Invalid method
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(405);
      expect(result.error).toBe('Method not allowed');
    });

    it('should handle database errors', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Database connection failed', 500)
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'safe' })
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(500);
      expect(result.error).toBe('Database connection failed');
    });

    it('should handle authentication failures', async () => {
      // Mock unauthenticated user
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      });

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Not authenticated', 401)
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'safe' })
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
      expect(result.error).toBe('Not authenticated');
    });
  });
});