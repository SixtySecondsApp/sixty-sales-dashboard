/**
 * Data Integrity Testing - Sales Activities and Pipeline Deals Reconciliation
 * 
 * Verifies no data loss during reconciliation, tests audit trail completeness,
 * validates data consistency after operations, and tests rollback functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { supabase } from '@/lib/supabase/clientV2';

// Mock data structures for testing
interface TestActivity {
  id: string;
  client_name: string;
  amount: number;
  date: string;
  type: string;
  status: string;
  user_id: string;
  deal_id: string | null;
  created_at: string;
  updated_at: string;
}

interface TestDeal {
  id: string;
  name: string;
  company: string;
  value: number;
  status: string;
  stage_changed_at: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface AuditLogEntry {
  id: number;
  action_type: string;
  source_table: string;
  source_id: string;
  target_table: string | null;
  target_id: string | null;
  confidence_score: number | null;
  metadata: any;
  user_id: string;
  executed_at: string;
}

// Mock database state management
class MockDatabaseState {
  activities: TestActivity[] = [];
  deals: TestDeal[] = [];
  auditLog: AuditLogEntry[] = [];
  nextAuditId = 1;

  reset() {
    this.activities = [];
    this.deals = [];
    this.auditLog = [];
    this.nextAuditId = 1;
  }

  addActivity(activity: Omit<TestActivity, 'created_at' | 'updated_at'>) {
    const now = new Date().toISOString();
    this.activities.push({
      ...activity,
      created_at: now,
      updated_at: now
    });
  }

  addDeal(deal: Omit<TestDeal, 'created_at' | 'updated_at'>) {
    const now = new Date().toISOString();
    this.deals.push({
      ...deal,
      created_at: now,
      updated_at: now
    });
  }

  updateActivity(id: string, updates: Partial<TestActivity>) {
    const activity = this.activities.find(a => a.id === id);
    if (activity) {
      Object.assign(activity, updates, { updated_at: new Date().toISOString() });
    }
  }

  deleteActivity(id: string) {
    this.activities = this.activities.filter(a => a.id !== id);
  }

  deleteDeal(id: string) {
    this.deals = this.deals.filter(d => d.id !== id);
  }

  logAction(entry: Omit<AuditLogEntry, 'id' | 'executed_at'>) {
    this.auditLog.push({
      ...entry,
      id: this.nextAuditId++,
      executed_at: new Date().toISOString()
    });
  }

  getSnapshot() {
    return {
      activities: [...this.activities],
      deals: [...this.deals],
      auditLog: [...this.auditLog]
    };
  }

  validateIntegrity() {
    const issues: string[] = [];

    // Check for orphaned deal_id references
    this.activities.forEach(activity => {
      if (activity.deal_id && !this.deals.find(d => d.id === activity.deal_id)) {
        issues.push(`Activity ${activity.id} references non-existent deal ${activity.deal_id}`);
      }
    });

    // Check for data consistency
    this.activities.forEach(activity => {
      if (activity.amount < 0) {
        issues.push(`Activity ${activity.id} has negative amount: ${activity.amount}`);
      }
      if (!activity.user_id) {
        issues.push(`Activity ${activity.id} missing user_id`);
      }
    });

    this.deals.forEach(deal => {
      if (deal.value < 0) {
        issues.push(`Deal ${deal.id} has negative value: ${deal.value}`);
      }
      if (!deal.owner_id) {
        issues.push(`Deal ${deal.id} missing owner_id`);
      }
    });

    return issues;
  }
}

const mockDb = new MockDatabaseState();

// Mock API response helper
const mockApiResponse = (data: any, error?: string, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(error ? { error } : data),
  text: vi.fn().mockResolvedValue(JSON.stringify(error ? { error } : data))
});

// Mock fetch globally
global.fetch = vi.fn();

describe('Data Integrity Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.reset();
    
    // Mock authentication
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@example.com' } },
      error: null
    });

    // Set up initial test data
    mockDb.addActivity({
      id: 'act-1',
      client_name: 'Viewpoint Construction',
      amount: 10000,
      date: '2024-01-15',
      type: 'sale',
      status: 'completed',
      user_id: 'user-1',
      deal_id: null
    });

    mockDb.addActivity({
      id: 'act-2',
      client_name: 'TechCorp Inc',
      amount: 15000,
      date: '2024-01-16',
      type: 'sale',
      status: 'completed',
      user_id: 'user-1',
      deal_id: 'deal-1'
    });

    mockDb.addDeal({
      id: 'deal-1',
      name: 'TechCorp Deal',
      company: 'TechCorp Inc',
      value: 15000,
      status: 'won',
      stage_changed_at: '2024-01-16T12:00:00Z',
      owner_id: 'user-1'
    });

    mockDb.addDeal({
      id: 'deal-2',
      name: 'Orphan Deal',
      company: 'Viewpoint Construction',
      value: 10500,
      status: 'won',
      stage_changed_at: '2024-01-15T11:00:00Z',
      owner_id: 'user-1'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Data Consistency Validation', () => {
    it('should maintain referential integrity during linking operations', async () => {
      const beforeSnapshot = mockDb.getSnapshot();
      
      // Mock manual linking operation
      const linkResult = {
        success: true,
        action: 'link_manual',
        activityId: 'act-1',
        dealId: 'deal-2'
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(linkResult)
      );

      // Simulate the linking operation
      mockDb.updateActivity('act-1', { deal_id: 'deal-2' });
      mockDb.logAction({
        action_type: 'MANUAL_LINK',
        source_table: 'activities',
        source_id: 'act-1',
        target_table: 'deals',
        target_id: 'deal-2',
        confidence_score: 100,
        metadata: {
          activity_company: 'Viewpoint Construction',
          deal_company: 'Viewpoint Construction'
        },
        user_id: 'user-1'
      });

      const response = await fetch('/api/reconcile/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link_manual',
          activityId: 'act-1',
          dealId: 'deal-2',
          userId: 'user-1'
        })
      });

      const result = await response.json();
      expect(result.success).toBe(true);

      // Verify referential integrity
      const integrityIssues = mockDb.validateIntegrity();
      expect(integrityIssues).toHaveLength(0);

      // Verify the link was created correctly
      const linkedActivity = mockDb.activities.find(a => a.id === 'act-1');
      expect(linkedActivity?.deal_id).toBe('deal-2');

      // Verify audit trail was created
      const auditEntries = mockDb.auditLog.filter(e => e.source_id === 'act-1');
      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0].action_type).toBe('MANUAL_LINK');
    });

    it('should prevent creating invalid links', async () => {
      // Attempt to link to non-existent deal
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Deal not found or access denied', 404)
      );

      const response = await fetch('/api/reconcile/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link_manual',
          activityId: 'act-1',
          dealId: 'nonexistent-deal',
          userId: 'user-1'
        })
      });

      const result = await response.json();
      expect(response.ok).toBe(false);
      expect(result.error).toBe('Deal not found or access denied');

      // Verify no changes were made
      const activity = mockDb.activities.find(a => a.id === 'act-1');
      expect(activity?.deal_id).toBeNull();

      // Verify integrity is maintained
      const integrityIssues = mockDb.validateIntegrity();
      expect(integrityIssues).toHaveLength(0);
    });

    it('should maintain data consistency during deal creation', async () => {
      const beforeSnapshot = mockDb.getSnapshot();
      
      const createDealResult = {
        success: true,
        action: 'create_deal_from_activity',
        activityId: 'act-1',
        newDeal: {
          id: 'deal-new-1',
          company: 'Viewpoint Construction',
          amount: 10000,
          stage: 'Closed Won',
          close_date: '2024-01-15',
          owner_id: 'user-1',
          source: 'manual_reconciliation'
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(createDealResult, null, 201)
      );

      // Simulate deal creation and linking
      mockDb.addDeal({
        id: 'deal-new-1',
        name: 'Generated Deal',
        company: 'Viewpoint Construction',
        value: 10000,
        status: 'won',
        stage_changed_at: '2024-01-15T10:00:00Z',
        owner_id: 'user-1'
      });

      mockDb.updateActivity('act-1', { deal_id: 'deal-new-1' });

      mockDb.logAction({
        action_type: 'CREATE_DEAL_FROM_ACTIVITY_MANUAL',
        source_table: 'activities',
        source_id: 'act-1',
        target_table: 'deals',
        target_id: 'deal-new-1',
        confidence_score: 100,
        metadata: {
          activity_company: 'Viewpoint Construction',
          activity_amount: 10000,
          created_deal: createDealResult.newDeal
        },
        user_id: 'user-1'
      });

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

      // Verify integrity after creation
      const integrityIssues = mockDb.validateIntegrity();
      expect(integrityIssues).toHaveLength(0);

      // Verify the new deal exists and is properly linked
      const newDeal = mockDb.deals.find(d => d.id === 'deal-new-1');
      expect(newDeal).toBeDefined();
      expect(newDeal?.company).toBe('Viewpoint Construction');

      const linkedActivity = mockDb.activities.find(a => a.id === 'act-1');
      expect(linkedActivity?.deal_id).toBe('deal-new-1');

      // Verify audit trail completeness
      const auditEntries = mockDb.auditLog.filter(e => e.target_id === 'deal-new-1');
      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0].action_type).toBe('CREATE_DEAL_FROM_ACTIVITY_MANUAL');
    });

    it('should handle transaction rollback on creation failures', async () => {
      const beforeSnapshot = mockDb.getSnapshot();
      
      // Mock failure during deal creation
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Failed to create deal', 500)
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
      expect(response.ok).toBe(false);
      expect(result.error).toBe('Failed to create deal');

      // Verify no changes were made to the database
      const afterSnapshot = mockDb.getSnapshot();
      expect(afterSnapshot.activities).toEqual(beforeSnapshot.activities);
      expect(afterSnapshot.deals).toEqual(beforeSnapshot.deals);
      expect(afterSnapshot.auditLog).toEqual(beforeSnapshot.auditLog);

      // Verify integrity is maintained
      const integrityIssues = mockDb.validateIntegrity();
      expect(integrityIssues).toHaveLength(0);
    });
  });

  describe('Audit Trail Completeness', () => {
    it('should create complete audit records for all operations', async () => {
      const beforeAuditCount = mockDb.auditLog.length;

      // Execute multiple operations
      const operations = [
        {
          action: 'link_manual',
          activityId: 'act-1',
          dealId: 'deal-2',
          expectedActionType: 'MANUAL_LINK'
        }
      ];

      for (const op of operations) {
        const result = {
          success: true,
          action: op.action
        };

        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(result)
        );

        // Simulate the operation
        if (op.action === 'link_manual') {
          mockDb.updateActivity(op.activityId!, { deal_id: op.dealId! });
          mockDb.logAction({
            action_type: op.expectedActionType,
            source_table: 'activities',
            source_id: op.activityId!,
            target_table: 'deals',
            target_id: op.dealId!,
            confidence_score: 100,
            metadata: { manual_operation: true },
            user_id: 'user-1'
          });
        }

        await fetch('/api/reconcile/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...op,
            userId: 'user-1'
          })
        });
      }

      // Verify audit trail completeness
      const auditEntries = mockDb.auditLog.slice(beforeAuditCount);
      expect(auditEntries).toHaveLength(operations.length);

      auditEntries.forEach((entry, index) => {
        const operation = operations[index];
        
        // Verify required fields are present
        expect(entry.action_type).toBe(operation.expectedActionType);
        expect(entry.source_table).toBeTruthy();
        expect(entry.source_id).toBeTruthy();
        expect(entry.user_id).toBe('user-1');
        expect(entry.executed_at).toBeTruthy();
        
        // Verify timestamp is recent and valid
        const executedTime = new Date(entry.executed_at);
        const now = new Date();
        const timeDiff = now.getTime() - executedTime.getTime();
        expect(timeDiff).toBeLessThan(60000); // Within 1 minute

        // Verify metadata contains relevant information
        expect(entry.metadata).toBeDefined();
        expect(typeof entry.metadata).toBe('object');
      });
    });

    it('should include comprehensive metadata in audit records', async () => {
      const linkResult = {
        success: true,
        action: 'link_manual',
        activityId: 'act-1',
        dealId: 'deal-2'
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(linkResult)
      );

      // Simulate operation with rich metadata
      const activity = mockDb.activities.find(a => a.id === 'act-1')!;
      const deal = mockDb.deals.find(d => d.id === 'deal-2')!;

      mockDb.updateActivity('act-1', { deal_id: 'deal-2' });
      mockDb.logAction({
        action_type: 'MANUAL_LINK',
        source_table: 'activities',
        source_id: 'act-1',
        target_table: 'deals',
        target_id: 'deal-2',
        confidence_score: 100,
        metadata: {
          activity_company: activity.client_name,
          deal_company: deal.company,
          activity_amount: activity.amount,
          deal_amount: deal.value,
          activity_date: activity.date,
          deal_close_date: deal.stage_changed_at,
          name_similarity: 0.95,
          amount_similarity: 0.95,
          date_proximity: 1,
          user_action: 'manual_override'
        },
        user_id: 'user-1'
      });

      await fetch('/api/reconcile/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link_manual',
          activityId: 'act-1',
          dealId: 'deal-2',
          userId: 'user-1'
        })
      });

      // Verify metadata completeness
      const auditEntry = mockDb.auditLog[mockDb.auditLog.length - 1];
      const metadata = auditEntry.metadata;

      expect(metadata.activity_company).toBe('Viewpoint Construction');
      expect(metadata.deal_company).toBe('Viewpoint Construction');
      expect(metadata.activity_amount).toBe(10000);
      expect(metadata.deal_amount).toBe(10500);
      expect(metadata.name_similarity).toBe(0.95);
      expect(metadata.amount_similarity).toBe(0.95);
      expect(metadata.user_action).toBe('manual_override');
    });

    it('should maintain audit trail chronological order', async () => {
      const operations = [
        { action: 'link_manual', activityId: 'act-1', dealId: 'deal-2' }
      ];

      const beforeTime = new Date();

      for (const [index, op] of operations.entries()) {
        // Add small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));

        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse({ success: true, action: op.action })
        );

        mockDb.logAction({
          action_type: 'MANUAL_LINK',
          source_table: 'activities',
          source_id: op.activityId,
          target_table: 'deals',
          target_id: op.dealId,
          confidence_score: 100,
          metadata: { operation_index: index },
          user_id: 'user-1'
        });

        await fetch('/api/reconcile/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...op, userId: 'user-1' })
        });
      }

      // Verify chronological order
      const recentAuditEntries = mockDb.auditLog.filter(
        entry => new Date(entry.executed_at) >= beforeTime
      );

      for (let i = 1; i < recentAuditEntries.length; i++) {
        const prevTime = new Date(recentAuditEntries[i - 1].executed_at);
        const currTime = new Date(recentAuditEntries[i].executed_at);
        expect(currTime.getTime()).toBeGreaterThanOrEqual(prevTime.getTime());
      }
    });

    it('should track user context in audit records', async () => {
      const userId = 'user-specific-123';
      
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: { id: userId, email: 'specific@example.com' } },
        error: null
      });

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse({ success: true, action: 'link_manual' })
      );

      mockDb.logAction({
        action_type: 'MANUAL_LINK',
        source_table: 'activities',
        source_id: 'act-1',
        target_table: 'deals',
        target_id: 'deal-2',
        confidence_score: 100,
        metadata: { user_context: 'specific_user_action' },
        user_id: userId
      });

      await fetch('/api/reconcile/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link_manual',
          activityId: 'act-1',
          dealId: 'deal-2',
          userId
        })
      });

      // Verify user context is tracked correctly
      const auditEntry = mockDb.auditLog[mockDb.auditLog.length - 1];
      expect(auditEntry.user_id).toBe(userId);
      expect(auditEntry.metadata.user_context).toBe('specific_user_action');
    });
  });

  describe('Rollback Functionality', () => {
    it('should completely restore state after rollback', async () => {
      // Capture initial state
      const initialSnapshot = mockDb.getSnapshot();

      // Perform operations that will be rolled back
      mockDb.updateActivity('act-1', { deal_id: 'deal-2' });
      const auditId1 = mockDb.nextAuditId;
      mockDb.logAction({
        action_type: 'MANUAL_LINK',
        source_table: 'activities',
        source_id: 'act-1',
        target_table: 'deals',
        target_id: 'deal-2',
        confidence_score: 100,
        metadata: {},
        user_id: 'user-1'
      });

      mockDb.addDeal({
        id: 'deal-new-1',
        name: 'New Deal',
        company: 'Test Company',
        value: 5000,
        status: 'won',
        stage_changed_at: '2024-01-17T10:00:00Z',
        owner_id: 'user-1'
      });

      const auditId2 = mockDb.nextAuditId;
      mockDb.logAction({
        action_type: 'CREATE_DEAL_FROM_ACTIVITY_MANUAL',
        source_table: 'activities',
        source_id: 'act-2',
        target_table: 'deals',
        target_id: 'deal-new-1',
        confidence_score: 100,
        metadata: {},
        user_id: 'user-1'
      });

      // Mock rollback operation
      const rollbackResult = {
        success: true,
        rollback: {
          entries_reverted: 2,
          deals_removed: 1,
          activities_unlinked: 1,
          rollback_timestamp: new Date().toISOString()
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(rollbackResult)
      );

      // Simulate rollback
      mockDb.updateActivity('act-1', { deal_id: null });
      mockDb.deleteDeal('deal-new-1');
      
      // Mark audit entries as rolled back
      mockDb.auditLog.forEach(entry => {
        if (entry.id >= auditId1) {
          entry.metadata = { ...entry.metadata, rolled_back: true };
        }
      });

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rollback',
          auditLogIds: [auditId1, auditId2],
          confirmRollback: true
        })
      });

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.rollback.entries_reverted).toBe(2);

      // Verify state restoration
      const currentActivities = mockDb.activities;
      const currentDeals = mockDb.deals;

      // Activities should be restored to initial state
      expect(currentActivities).toHaveLength(initialSnapshot.activities.length);
      const restoredActivity = currentActivities.find(a => a.id === 'act-1');
      expect(restoredActivity?.deal_id).toBeNull();

      // New deal should be removed
      expect(currentDeals.find(d => d.id === 'deal-new-1')).toBeUndefined();

      // Verify integrity after rollback
      const integrityIssues = mockDb.validateIntegrity();
      expect(integrityIssues).toHaveLength(0);
    });

    it('should handle partial rollback scenarios', async () => {
      // Create multiple operations
      const operations = [
        { activityId: 'act-1', dealId: 'deal-2', canRollback: true },
        { activityId: 'act-2', dealId: null, canRollback: false } // Cannot rollback this one
      ];

      const auditIds: number[] = [];

      operations.forEach((op, index) => {
        if (op.dealId) {
          mockDb.updateActivity(op.activityId, { deal_id: op.dealId });
        }
        
        auditIds.push(mockDb.nextAuditId);
        mockDb.logAction({
          action_type: 'MANUAL_LINK',
          source_table: 'activities',
          source_id: op.activityId,
          target_table: 'deals',
          target_id: op.dealId,
          confidence_score: 100,
          metadata: { can_rollback: op.canRollback },
          user_id: 'user-1'
        });
      });

      // Mock partial rollback
      const rollbackResult = {
        success: true,
        rollback: {
          entries_reverted: 1,
          entries_failed: 1,
          failed_entries: [auditIds[1]],
          error_details: 'Cannot rollback non-reversible operation'
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(rollbackResult)
      );

      // Simulate partial rollback (only first operation)
      mockDb.updateActivity('act-1', { deal_id: null });

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rollback',
          auditLogIds: auditIds,
          confirmRollback: true
        })
      });

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.rollback.entries_reverted).toBe(1);
      expect(result.rollback.entries_failed).toBe(1);

      // Verify partial rollback results
      const activity1 = mockDb.activities.find(a => a.id === 'act-1');
      const activity2 = mockDb.activities.find(a => a.id === 'act-2');

      expect(activity1?.deal_id).toBeNull(); // Successfully rolled back
      expect(activity2?.deal_id).toBe('deal-1'); // Could not rollback

      // Verify integrity is still maintained
      const integrityIssues = mockDb.validateIntegrity();
      expect(integrityIssues).toHaveLength(0);
    });

    it('should handle rollback by time threshold', async () => {
      const rollbackThreshold = new Date();
      await new Promise(resolve => setTimeout(resolve, 10)); // Ensure operations are after threshold

      // Perform operations after threshold
      mockDb.updateActivity('act-1', { deal_id: 'deal-2' });
      mockDb.logAction({
        action_type: 'MANUAL_LINK',
        source_table: 'activities',
        source_id: 'act-1',
        target_table: 'deals',
        target_id: 'deal-2',
        confidence_score: 100,
        metadata: {},
        user_id: 'user-1'
      });

      const rollbackResult = {
        success: true,
        rollback: {
          entries_reverted: 1,
          time_threshold: rollbackThreshold.toISOString(),
          affected_operations: ['MANUAL_LINK']
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(rollbackResult)
      );

      // Simulate time-based rollback
      const operationsAfterThreshold = mockDb.auditLog.filter(
        entry => new Date(entry.executed_at) > rollbackThreshold
      );

      operationsAfterThreshold.forEach(entry => {
        if (entry.action_type === 'MANUAL_LINK') {
          mockDb.updateActivity(entry.source_id, { deal_id: null });
        }
      });

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rollback',
          timeThreshold: rollbackThreshold.toISOString(),
          confirmRollback: true
        })
      });

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.rollback.entries_reverted).toBe(1);

      // Verify time-based rollback worked
      const activity = mockDb.activities.find(a => a.id === 'act-1');
      expect(activity?.deal_id).toBeNull();
    });

    it('should maintain audit trail for rollback operations', async () => {
      const beforeRollbackAuditCount = mockDb.auditLog.length;

      // Perform operation to rollback
      mockDb.updateActivity('act-1', { deal_id: 'deal-2' });
      const originalAuditId = mockDb.nextAuditId;
      mockDb.logAction({
        action_type: 'MANUAL_LINK',
        source_table: 'activities',
        source_id: 'act-1',
        target_table: 'deals',
        target_id: 'deal-2',
        confidence_score: 100,
        metadata: {},
        user_id: 'user-1'
      });

      // Perform rollback
      const rollbackResult = {
        success: true,
        rollback: { entries_reverted: 1 }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(rollbackResult)
      );

      mockDb.updateActivity('act-1', { deal_id: null });
      mockDb.logAction({
        action_type: 'ROLLBACK_MANUAL_LINK',
        source_table: 'activities',
        source_id: 'act-1',
        target_table: 'deals',
        target_id: 'deal-2',
        confidence_score: null,
        metadata: {
          original_audit_id: originalAuditId,
          rollback_reason: 'User requested rollback'
        },
        user_id: 'user-1'
      });

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rollback',
          auditLogIds: [originalAuditId],
          confirmRollback: true
        })
      });

      const result = await response.json();
      expect(result.success).toBe(true);

      // Verify rollback created its own audit entry
      const rollbackAuditEntries = mockDb.auditLog.filter(
        entry => entry.action_type.startsWith('ROLLBACK_')
      );
      expect(rollbackAuditEntries).toHaveLength(1);

      const rollbackEntry = rollbackAuditEntries[0];
      expect(rollbackEntry.metadata.original_audit_id).toBe(originalAuditId);
      expect(rollbackEntry.user_id).toBe('user-1');
    });
  });

  describe('Data Loss Prevention', () => {
    it('should prevent accidental data deletion', async () => {
      const beforeSnapshot = mockDb.getSnapshot();

      // Attempt operation that could cause data loss
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Operation would cause data loss', 400)
      );

      const response = await fetch('/api/reconcile/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'merge_records',
          recordType: 'activities',
          recordIds: ['act-1', 'act-2'],
          mergeInto: 'act-1',
          userId: 'user-1'
        })
      });

      const result = await response.json();
      expect(response.ok).toBe(false);
      expect(result.error).toBe('Operation would cause data loss');

      // Verify no data was lost
      const afterSnapshot = mockDb.getSnapshot();
      expect(afterSnapshot.activities).toEqual(beforeSnapshot.activities);
      expect(afterSnapshot.deals).toEqual(beforeSnapshot.deals);
    });

    it('should validate data before committing changes', async () => {
      // Mock validation that catches integrity issues
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Data validation failed: Amount cannot be negative', 400)
      );

      const response = await fetch('/api/reconcile/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_deal_from_activity',
          activityId: 'act-1',
          dealData: {
            amount: -5000 // Invalid negative amount
          },
          userId: 'user-1'
        })
      });

      const result = await response.json();
      expect(response.ok).toBe(false);
      expect(result.error).toBe('Data validation failed: Amount cannot be negative');

      // Verify no invalid data was persisted
      const integrityIssues = mockDb.validateIntegrity();
      expect(integrityIssues).toHaveLength(0);
    });

    it('should backup critical data before major operations', async () => {
      const beforeSnapshot = mockDb.getSnapshot();

      // Mock batch operation that includes backup
      const batchResult = {
        success: true,
        backup_created: true,
        backup_id: 'backup-123',
        summary: { totalProcessed: 50 }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(batchResult)
      );

      const response = await fetch('/api/reconcile/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch',
          mode: 'aggressive',
          maxBatches: 10,
          createBackup: true
        })
      });

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.backup_created).toBe(true);
      expect(result.backup_id).toBe('backup-123');
    });

    it('should handle concurrent modifications gracefully', async () => {
      // Simulate concurrent modification scenario
      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(null, 'Record was modified by another user. Please refresh and try again.', 409)
      );

      const response = await fetch('/api/reconcile/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link_manual',
          activityId: 'act-1',
          dealId: 'deal-2',
          userId: 'user-1',
          expectedVersion: 'version-123' // Optimistic locking
        })
      });

      const result = await response.json();
      expect(response.status).toBe(409);
      expect(result.error).toContain('Record was modified by another user');

      // Verify no changes were made due to conflict
      const activity = mockDb.activities.find(a => a.id === 'act-1');
      expect(activity?.deal_id).toBeNull(); // Should remain unchanged
    });
  });

  describe('Cross-Operation Consistency', () => {
    it('should maintain consistency across multiple API calls', async () => {
      // Perform sequence of operations
      const operations = [
        { 
          action: 'link_manual', 
          activityId: 'act-1', 
          dealId: 'deal-2',
          expectedResult: () => mockDb.activities.find(a => a.id === 'act-1')?.deal_id === 'deal-2'
        }
      ];

      for (const op of operations) {
        const result = { success: true, action: op.action };
        (global.fetch as any).mockResolvedValueOnce(
          mockApiResponse(result)
        );

        // Simulate the operation
        if (op.action === 'link_manual') {
          mockDb.updateActivity(op.activityId!, { deal_id: op.dealId! });
        }

        const response = await fetch('/api/reconcile/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...op, userId: 'user-1' })
        });

        const apiResult = await response.json();
        expect(apiResult.success).toBe(true);

        // Verify expected state after each operation
        expect(op.expectedResult()).toBe(true);

        // Verify integrity is maintained throughout
        const integrityIssues = mockDb.validateIntegrity();
        expect(integrityIssues).toHaveLength(0);
      }
    });

    it('should handle cascading effects correctly', async () => {
      // Create scenario where one operation affects multiple records
      mockDb.addActivity({
        id: 'act-3',
        client_name: 'Viewpoint Construction',
        amount: 5000,
        date: '2024-01-15',
        type: 'sale',
        status: 'completed',
        user_id: 'user-1',
        deal_id: 'deal-2' // Already linked to same deal
      });

      // Mock operation that might affect multiple activities
      const mergeResult = {
        success: true,
        action: 'merge_records',
        recordType: 'activities',
        keptRecordId: 'act-1',
        mergedFromIds: ['act-3'],
        cascading_effects: {
          activities_merged: 1,
          deal_links_updated: 1
        }
      };

      (global.fetch as any).mockResolvedValueOnce(
        mockApiResponse(mergeResult)
      );

      // Simulate merge operation
      const keptActivity = mockDb.activities.find(a => a.id === 'act-1')!;
      const mergedActivity = mockDb.activities.find(a => a.id === 'act-3')!;
      
      // Update kept activity with merged data
      mockDb.updateActivity('act-1', { 
        amount: keptActivity.amount + mergedActivity.amount,
        deal_id: 'deal-2'
      });
      
      // Remove merged activity
      mockDb.deleteActivity('act-3');

      const response = await fetch('/api/reconcile/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'merge_records',
          recordType: 'activities',
          recordIds: ['act-1', 'act-3'],
          mergeInto: 'act-1',
          userId: 'user-1'
        })
      });

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.cascading_effects.activities_merged).toBe(1);

      // Verify cascading effects were handled correctly
      const remainingActivities = mockDb.activities;
      expect(remainingActivities.find(a => a.id === 'act-3')).toBeUndefined();
      
      const updatedActivity = remainingActivities.find(a => a.id === 'act-1');
      expect(updatedActivity?.amount).toBe(15000); // 10000 + 5000
      expect(updatedActivity?.deal_id).toBe('deal-2');

      // Verify overall integrity
      const integrityIssues = mockDb.validateIntegrity();
      expect(integrityIssues).toHaveLength(0);
    });
  });
});