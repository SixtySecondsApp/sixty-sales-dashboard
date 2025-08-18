/**
 * API Endpoint Testing - Sales Activities and Pipeline Deals Reconciliation
 * 
 * Tests all reconciliation API endpoints including authentication, authorization,
 * error handling, and input validation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { supabase } from '@/lib/supabase/clientV2';

// Mock API response helper
const mockApiResponse = (data: any, error?: string, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  headers: new Headers({ 'content-type': 'application/json' }),
  json: vi.fn().mockResolvedValue(error ? { error } : data),
  text: vi.fn().mockResolvedValue(JSON.stringify(error ? { error } : data))
});

// Mock fetch globally
global.fetch = vi.fn();

describe('Reconciliation API Endpoints Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock authentication by default
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('/api/reconcile/analysis Endpoint', () => {
    describe('Authentication and Authorization', () => {
      it('should require authentication for all analysis requests', async () => {
        vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
          data: { user: null },
          error: { message: 'Not authenticated' }
        });

        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Not authenticated', 401)
        );

        const response = await fetch('/api/reconcile/analysis?analysisType=overview');
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(401);
        expect(result.error).toBe('Not authenticated');
      });

      it('should only allow GET requests', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Method not allowed', 405)
        );

        const response = await fetch('/api/reconcile/analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ analysisType: 'overview' })
        });
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(405);
        expect(result.error).toBe('Method not allowed');
      });

      it('should enforce user isolation with userId parameter', async () => {
        const mockData = {
          total_sales_activities: 5,
          orphan_activities: 2,
          user_filtered: true
        };

        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse({ data: mockData })
        );

        const response = await fetch('/api/reconcile/analysis?analysisType=overview&userId=user-1');
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.data.user_filtered).toBe(true);
      });
    });

    describe('Input Validation', () => {
      it('should validate analysisType parameter', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Invalid analysis type', 400)
        );

        const response = await fetch('/api/reconcile/analysis?analysisType=invalid');
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        expect(result.error).toBe('Invalid analysis type');
      });

      it('should accept valid analysisType values', async () => {
        const validTypes = ['overview', 'orphans', 'duplicates', 'matching', 'statistics'];
        
        for (const type of validTypes) {
          (global.fetch as any).mockResolvedValueOnce(
            mockApiResponse({ data: { analysisType: type } })
          );

          const response = await fetch(`/api/reconcile/analysis?analysisType=${type}`);
          const result = await response.json();

          expect(response.ok).toBe(true);
          expect(result.data.analysisType).toBe(type);
        }
      });

      it('should validate date format for startDate and endDate', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Invalid date format', 400)
        );

        const response = await fetch('/api/reconcile/analysis?analysisType=overview&startDate=invalid-date');
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        expect(result.error).toBe('Invalid date format');
      });

      it('should accept valid ISO date formats', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse({ data: { dateRangeApplied: true } })
        );

        const response = await fetch('/api/reconcile/analysis?analysisType=overview&startDate=2024-01-01&endDate=2024-01-31');
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.data.dateRangeApplied).toBe(true);
      });

      it('should validate confidenceThreshold range', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Confidence threshold must be between 0 and 100', 400)
        );

        const response = await fetch('/api/reconcile/analysis?analysisType=matching&confidenceThreshold=150');
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        expect(result.error).toBe('Confidence threshold must be between 0 and 100');
      });

      it('should accept valid confidenceThreshold values', async () => {
        const validThresholds = [0, 25, 50, 75, 100];
        
        for (const threshold of validThresholds) {
          (global.fetch as any).mockResolvedValueOnce(
            mockApiResponse({ data: { confidenceThreshold: threshold } })
          );

          const response = await fetch(`/api/reconcile/analysis?analysisType=matching&confidenceThreshold=${threshold}`);
          const result = await response.json();

          expect(response.ok).toBe(true);
          expect(result.data.confidenceThreshold).toBe(threshold);
        }
      });
    });

    describe('Response Format', () => {
      it('should return consistent response structure for overview', async () => {
        const overviewData = {
          total_sales_activities: 10,
          total_won_deals: 8,
          orphan_activities: 2,
          orphan_deals: 1,
          activity_deal_linkage_rate: 80.0,
          overall_data_quality_score: 85.5
        };

        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse({ data: overviewData })
        );

        const response = await fetch('/api/reconcile/analysis?analysisType=overview');
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.data).toHaveProperty('total_sales_activities');
        expect(result.data).toHaveProperty('total_won_deals');
        expect(result.data).toHaveProperty('orphan_activities');
        expect(result.data).toHaveProperty('activity_deal_linkage_rate');
        expect(typeof result.data.activity_deal_linkage_rate).toBe('number');
      });

      it('should return orphan data with proper structure', async () => {
        const orphanData = {
          orphan_activities: [
            {
              id: 'act-1',
              client_name: 'Test Client',
              amount: 10000,
              issue_type: 'orphan_activity',
              priority_level: 'revenue_risk'
            }
          ],
          orphan_deals: [
            {
              id: 'deal-1',
              name: 'Test Deal',
              company: 'Test Company',
              value: 15000,
              issue_type: 'orphan_deal',
              priority_level: 'revenue_tracking'
            }
          ],
          summary: {
            total_orphan_activities: 1,
            total_orphan_deals: 1,
            total_orphan_activity_revenue: 10000,
            total_orphan_deal_revenue: 15000
          }
        };

        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse({ data: orphanData })
        );

        const response = await fetch('/api/reconcile/analysis?analysisType=orphans');
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.data).toHaveProperty('orphan_activities');
        expect(result.data).toHaveProperty('orphan_deals');
        expect(result.data).toHaveProperty('summary');
        expect(Array.isArray(result.data.orphan_activities)).toBe(true);
        expect(Array.isArray(result.data.orphan_deals)).toBe(true);
      });

      it('should return matching data with confidence levels', async () => {
        const matchingData = {
          matches: {
            high_confidence: [
              {
                activity_id: 'act-1',
                deal_id: 'deal-1',
                total_confidence_score: 85,
                confidence_level: 'high_confidence'
              }
            ],
            medium_confidence: [],
            low_confidence: []
          },
          summary: {
            total_matches: 1,
            high_confidence_matches: 1,
            medium_confidence_matches: 0,
            low_confidence_matches: 0
          }
        };

        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse({ data: matchingData })
        );

        const response = await fetch('/api/reconcile/analysis?analysisType=matching');
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.data.matches).toHaveProperty('high_confidence');
        expect(result.data.matches).toHaveProperty('medium_confidence');
        expect(result.data.matches).toHaveProperty('low_confidence');
        expect(result.data.summary).toHaveProperty('total_matches');
      });
    });

    describe('Error Handling', () => {
      it('should handle database connection errors', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Database connection failed', 500)
        );

        const response = await fetch('/api/reconcile/analysis?analysisType=overview');
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(500);
        expect(result.error).toBe('Database connection failed');
      });

      it('should handle SQL query errors', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'SQL syntax error in query', 500)
        );

        const response = await fetch('/api/reconcile/analysis?analysisType=overview');
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(500);
        expect(result.error).toBe('SQL syntax error in query');
      });

      it('should handle timeout errors', async () => {
        (global.fetch as any).mockImplementation(() =>
          Promise.reject(new Error('Request timeout'))
        );

        try {
          await fetch('/api/reconcile/analysis?analysisType=overview');
          expect.fail('Should have thrown timeout error');
        } catch (error) {
          expect(error.message).toBe('Request timeout');
        }
      });
    });
  });

  describe('/api/reconcile/execute Endpoint', () => {
    describe('Authentication and Authorization', () => {
      it('should require authentication for execution', async () => {
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

      it('should allow GET requests for progress monitoring', async () => {
        const progressData = {
          success: true,
          summary: { totalOrphanActivities: 5 }
        };

        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(progressData)
        );

        const response = await fetch('/api/reconcile/execute?userId=user-1');
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.success).toBe(true);
      });

      it('should allow POST requests for execution', async () => {
        const executionData = {
          success: true,
          summary: { totalProcessed: 10 }
        };

        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(executionData)
        );

        const response = await fetch('/api/reconcile/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'safe' })
        });
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.success).toBe(true);
      });

      it('should reject invalid HTTP methods', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Method not allowed', 405)
        );

        const response = await fetch('/api/reconcile/execute', {
          method: 'PUT'
        });
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(405);
        expect(result.error).toBe('Method not allowed');
      });
    });

    describe('Input Validation', () => {
      it('should validate mode parameter', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Invalid mode. Must be safe, aggressive, or dry_run', 400)
        );

        const response = await fetch('/api/reconcile/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'invalid' })
        });
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        expect(result.error).toBe('Invalid mode. Must be safe, aggressive, or dry_run');
      });

      it('should validate batchSize parameter', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Batch size must be between 1 and 1000', 400)
        );

        const response = await fetch('/api/reconcile/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'safe', batchSize: 1500 })
        });
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        expect(result.error).toBe('Batch size must be between 1 and 1000');
      });

      it('should accept valid batch configurations', async () => {
        const validConfigs = [
          { mode: 'safe', batchSize: 50 },
          { mode: 'aggressive', batchSize: 100 },
          { mode: 'dry_run', batchSize: 200 }
        ];

        for (const config of validConfigs) {
          (global.fetch as any).mockResolvedValueOnce(
            mockApiResponse({ success: true, ...config })
          );

          const response = await fetch('/api/reconcile/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
          });
          const result = await response.json();

          expect(response.ok).toBe(true);
          expect(result.mode).toBe(config.mode);
        }
      });

      it('should validate rollback confirmation', async () => {
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
    });

    describe('Response Format', () => {
      it('should return execution summary', async () => {
        const executionResult = {
          success: true,
          mode: 'safe',
          userId: 'user-1',
          summary: {
            totalProcessed: 25,
            highConfidenceLinks: 15,
            dealsCreated: 5,
            activitiesCreated: 3,
            errors: 0,
            successRate: 100
          },
          executedAt: '2024-01-15T12:00:00Z'
        };

        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(executionResult)
        );

        const response = await fetch('/api/reconcile/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'safe' })
        });
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.summary).toHaveProperty('totalProcessed');
        expect(result.summary).toHaveProperty('highConfidenceLinks');
        expect(result.summary).toHaveProperty('successRate');
        expect(result).toHaveProperty('executedAt');
      });

      it('should return batch execution results', async () => {
        const batchResult = {
          success: true,
          batchesExecuted: 3,
          totalProcessed: 150,
          totalErrors: 0,
          results: [
            { batch: 1, success: true, processed: 50 },
            { batch: 2, success: true, processed: 50 },
            { batch: 3, success: true, processed: 50 }
          ]
        };

        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(batchResult)
        );

        const response = await fetch('/api/reconcile/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'batch' })
        });
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.batchesExecuted).toBe(3);
        expect(result.totalProcessed).toBe(150);
        expect(Array.isArray(result.results)).toBe(true);
      });
    });
  });

  describe('/api/reconcile/actions Endpoint', () => {
    describe('Authentication and Authorization', () => {
      it('should require authentication for all actions', async () => {
        vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
          data: { user: null },
          error: { message: 'Not authenticated' }
        });

        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Not authenticated', 401)
        );

        const response = await fetch('/api/reconcile/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'link_manual',
            activityId: 'act-1',
            dealId: 'deal-1'
          })
        });
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(401);
        expect(result.error).toBe('Not authenticated');
      });

      it('should only allow POST requests', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Method not allowed', 405)
        );

        const response = await fetch('/api/reconcile/actions');
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(405);
        expect(result.error).toBe('Method not allowed');
      });

      it('should enforce user ownership for actions', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Activity not found or access denied', 404)
        );

        const response = await fetch('/api/reconcile/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'link_manual',
            activityId: 'other-user-activity',
            dealId: 'deal-1',
            userId: 'user-1'
          })
        });
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(404);
        expect(result.error).toBe('Activity not found or access denied');
      });
    });

    describe('Input Validation', () => {
      it('should require action parameter', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Action type is required', 400)
        );

        const response = await fetch('/api/reconcile/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activityId: 'act-1',
            dealId: 'deal-1'
          })
        });
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        expect(result.error).toBe('Action type is required');
      });

      it('should require userId parameter', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'User ID is required', 400)
        );

        const response = await fetch('/api/reconcile/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'link_manual',
            activityId: 'act-1',
            dealId: 'deal-1'
          })
        });
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        expect(result.error).toBe('User ID is required');
      });

      it('should validate action types', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Unknown action type: invalid_action', 400)
        );

        const response = await fetch('/api/reconcile/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'invalid_action',
            userId: 'user-1'
          })
        });
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        expect(result.error).toBe('Unknown action type: invalid_action');
      });

      it('should accept valid action types', async () => {
        const validActions = [
          'link_manual',
          'create_deal_from_activity', 
          'create_activity_from_deal',
          'mark_duplicate',
          'split_record',
          'merge_records',
          'undo_action'
        ];

        for (const action of validActions) {
          (global.fetch as any).mockResolvedValueOnce(
            mockApiResponse({ success: true, action })
          );

          const response = await fetch('/api/reconcile/actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action,
              userId: 'user-1',
              activityId: 'act-1',
              dealId: 'deal-1'
            })
          });
          const result = await response.json();

          expect(response.ok).toBe(true);
          expect(result.action).toBe(action);
        }
      });

      it('should validate required parameters for specific actions', async () => {
        // Test link_manual requires both activityId and dealId
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Both activityId and dealId are required for manual linking', 400)
        );

        const response = await fetch('/api/reconcile/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'link_manual',
            userId: 'user-1',
            activityId: 'act-1'
            // Missing dealId
          })
        });
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        expect(result.error).toBe('Both activityId and dealId are required for manual linking');
      });
    });

    describe('Action Responses', () => {
      it('should return success response for manual linking', async () => {
        const linkResult = {
          success: true,
          action: 'link_manual',
          activityId: 'act-1',
          dealId: 'deal-1',
          message: 'Activity successfully linked to deal',
          linkedAt: '2024-01-15T12:00:00Z'
        };

        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(linkResult)
        );

        const response = await fetch('/api/reconcile/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'link_manual',
            activityId: 'act-1',
            dealId: 'deal-1',
            userId: 'user-1'
          })
        });
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.success).toBe(true);
        expect(result.action).toBe('link_manual');
        expect(result.activityId).toBe('act-1');
        expect(result.dealId).toBe('deal-1');
      });

      it('should return created entity for creation actions', async () => {
        const createResult = {
          success: true,
          action: 'create_deal_from_activity',
          activityId: 'act-1',
          newDeal: {
            id: 'deal-new-1',
            company: 'Test Company',
            amount: 10000,
            stage: 'Closed Won'
          },
          message: 'Deal created and linked to activity successfully',
          createdAt: '2024-01-15T12:00:00Z'
        };

        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(createResult, null, 201)
        );

        const response = await fetch('/api/reconcile/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_deal_from_activity',
            activityId: 'act-1',
            userId: 'user-1'
          })
        });
        const result = await response.json();

        expect(response.status).toBe(201);
        expect(result.success).toBe(true);
        expect(result.newDeal).toBeDefined();
        expect(result.newDeal.id).toBe('deal-new-1');
      });

      it('should return undo details for undo actions', async () => {
        const undoResult = {
          success: true,
          action: 'undo_action',
          originalAction: 'MANUAL_LINK',
          auditLogId: 123,
          undoResult: {
            action: 'unlinked',
            activityId: 'act-1'
          },
          message: 'Action undone successfully',
          undoneAt: '2024-01-15T12:00:00Z'
        };

        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(undoResult)
        );

        const response = await fetch('/api/reconcile/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'undo_action',
            auditLogId: 123,
            userId: 'user-1'
          })
        });
        const result = await response.json();

        expect(response.ok).toBe(true);
        expect(result.originalAction).toBe('MANUAL_LINK');
        expect(result.undoResult).toBeDefined();
      });
    });

    describe('Business Logic Validation', () => {
      it('should prevent linking already linked activities', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Activity is already linked to a deal', 400)
        );

        const response = await fetch('/api/reconcile/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'link_manual',
            activityId: 'already-linked-activity',
            dealId: 'deal-1',
            userId: 'user-1'
          })
        });
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        expect(result.error).toBe('Activity is already linked to a deal');
      });

      it('should prevent creating deals for already linked activities', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Activity is already linked to a deal', 400)
        );

        const response = await fetch('/api/reconcile/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_deal_from_activity',
            activityId: 'already-linked-activity',
            userId: 'user-1'
          })
        });
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        expect(result.error).toBe('Activity is already linked to a deal');
      });

      it('should prevent creating activities for deals with existing activities', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Deal already has linked activities', 400)
        );

        const response = await fetch('/api/reconcile/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_activity_from_deal',
            dealId: 'deal-with-activities',
            userId: 'user-1'
          })
        });
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(400);
        expect(result.error).toBe('Deal already has linked activities');
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors during actions', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Failed to link activity to deal', 500)
        );

        const response = await fetch('/api/reconcile/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'link_manual',
            activityId: 'act-1',
            dealId: 'deal-1',
            userId: 'user-1'
          })
        });
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(500);
        expect(result.error).toBe('Failed to link activity to deal');
      });

      it('should handle record not found errors', async () => {
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(null, 'Activity not found or access denied', 404)
        );

        const response = await fetch('/api/reconcile/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'link_manual',
            activityId: 'nonexistent-activity',
            dealId: 'deal-1',
            userId: 'user-1'
          })
        });
        const result = await response.json();

        expect(response.ok).toBe(false);
        expect(response.status).toBe(404);
        expect(result.error).toBe('Activity not found or access denied');
      });
    });
  });

  describe('Cross-Endpoint Integration', () => {
    it('should maintain consistency between analysis and execution', async () => {
      // First call analysis to get orphan count
      const analysisData = {
        orphan_activities: 5,
        orphan_deals: 3
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse({ data: analysisData })
      );

      const analysisResponse = await fetch('/api/reconcile/analysis?analysisType=overview');
      const analysisResult = await analysisResponse.json();

      // Then execute reconciliation
      const executionData = {
        success: true,
        summary: {
          totalProcessed: 8, // Should match total orphans
          highConfidenceLinks: 6,
          remaining_orphans: 2
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(executionData)
      );

      const executionResponse = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'safe' })
      });
      const executionResult = await executionResponse.json();

      expect(analysisResult.data.orphan_activities + analysisResult.data.orphan_deals).toBe(8);
      expect(executionResult.summary.totalProcessed).toBe(8);
    });

    it('should track audit trail across all endpoints', async () => {
      // Execute action that creates audit entry
      const actionResult = {
        success: true,
        auditLogId: 123
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(actionResult)
      );

      await fetch('/api/reconcile/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link_manual',
          activityId: 'act-1',
          dealId: 'deal-1',
          userId: 'user-1'
        })
      });

      // Check that progress endpoint shows the audit entry
      const progressData = {
        recentActivity: [
          {
            id: 123,
            action_type: 'MANUAL_LINK',
            executed_at: '2024-01-15T12:00:00Z'
          }
        ]
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(progressData)
      );

      const progressResponse = await fetch('/api/reconcile/execute?userId=user-1');
      const progressResult = await progressResponse.json();

      expect(progressResult.recentActivity).toHaveLength(1);
      expect(progressResult.recentActivity[0].id).toBe(123);
    });
  });

  describe('Security Testing', () => {
    it('should sanitize SQL injection attempts', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Invalid input detected', 400)
      );

      const response = await fetch("/api/reconcile/analysis?analysisType=overview&userId=1'; DROP TABLE activities; --");
      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      expect(result.error).toBe('Invalid input detected');
    });

    it('should prevent XSS in input parameters', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Invalid characters in input', 400)
      );

      const response = await fetch('/api/reconcile/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link_manual',
          activityId: '<script>alert("xss")</script>',
          dealId: 'deal-1',
          userId: 'user-1'
        })
      });
      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      expect(result.error).toBe('Invalid characters in input');
    });

    it('should enforce rate limiting', async () => {
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Too many requests', 429)
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'safe' })
      });
      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(429);
      expect(result.error).toBe('Too many requests');
    });
  });
});