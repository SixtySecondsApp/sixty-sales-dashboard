import { describe, expect, test, vi, beforeEach } from 'vitest';

// Create chainable mock helpers with proper chain resolution
const createChainableMock = () => {
  const chain: any = {};

  // All methods return the chain to allow proper chaining
  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.upsert = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.single = vi.fn(() => chain);

  return chain;
};

// Hoist the supabase mock
const { supabaseMock, mockChainRef } = vi.hoisted(() => {
  const ref = { chain: null as any };
  return {
    supabaseMock: {
      from: vi.fn(() => ref.chain),
    },
    mockChainRef: ref,
  };
});

vi.mock('@/lib/supabase/clientV2', () => ({
  supabase: supabaseMock,
}));

import { ExtractionRulesService, type TaskExtractionRule, type MeetingTypeTemplate } from '@/lib/services/extractionRulesService';
import { supabase } from '@/lib/supabase/clientV2';

describe('ExtractionRulesService', () => {
  let mockChain: ReturnType<typeof createChainableMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChain = createChainableMock();
    mockChainRef.chain = mockChain;
    supabaseMock.from.mockReturnValue(mockChain);
  });

  describe('getExtractionRules', () => {
    test('returns all rules for a user', async () => {
      const mockRules: TaskExtractionRule[] = [
        {
          id: 'rule-1',
          user_id: 'user-123',
          name: 'Follow-up Rule',
          trigger_phrases: ['follow up', 'next steps'],
          task_category: 'follow_up',
          default_priority: 'high',
          default_deadline_days: 3,
          is_active: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'rule-2',
          user_id: 'user-123',
          name: 'Proposal Rule',
          trigger_phrases: ['send proposal'],
          task_category: 'proposal',
          default_priority: 'urgent',
          default_deadline_days: 1,
          is_active: false,
          created_at: '2024-01-02',
          updated_at: '2024-01-02',
        },
      ];

      mockChain.order.mockResolvedValue({ data: mockRules, error: null });

      const result = await ExtractionRulesService.getExtractionRules('user-123');

      expect(supabase.from).toHaveBeenCalledWith('task_extraction_rules');
      expect(result).toEqual(mockRules);
      expect(result).toHaveLength(2);
    });

    test('returns empty array when no rules exist', async () => {
      mockChain.order.mockResolvedValue({ data: [], error: null });

      const result = await ExtractionRulesService.getExtractionRules('user-123');

      expect(result).toEqual([]);
    });

    test('returns empty array when data is null', async () => {
      mockChain.order.mockResolvedValue({ data: null, error: null });

      const result = await ExtractionRulesService.getExtractionRules('user-123');

      expect(result).toEqual([]);
    });

    test('throws error on database failure', async () => {
      mockChain.order.mockResolvedValue({ data: null, error: { message: 'Database error' } });

      await expect(ExtractionRulesService.getExtractionRules('user-123')).rejects.toThrow();
    });
  });

  describe('getActiveExtractionRules', () => {
    test('returns only active rules', async () => {
      const mockRules: TaskExtractionRule[] = [
        {
          id: 'rule-1',
          user_id: 'user-123',
          name: 'Active Rule',
          trigger_phrases: ['action item'],
          task_category: 'general',
          default_priority: 'medium',
          default_deadline_days: null,
          is_active: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      mockChain.order.mockResolvedValue({ data: mockRules, error: null });

      const result = await ExtractionRulesService.getActiveExtractionRules('user-123');

      expect(result).toEqual(mockRules);
      expect(mockChain.eq).toHaveBeenCalledWith('is_active', true);
    });
  });

  describe('createExtractionRule', () => {
    test('creates a new rule', async () => {
      const newRule = {
        name: 'New Rule',
        trigger_phrases: ['new phrase'],
        task_category: 'general',
        default_priority: 'low' as const,
        default_deadline_days: 5,
        is_active: true,
      };

      const createdRule: TaskExtractionRule = {
        id: 'rule-new',
        user_id: 'user-123',
        ...newRule,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      mockChain.single.mockResolvedValue({ data: createdRule, error: null });

      const result = await ExtractionRulesService.createExtractionRule('user-123', newRule);

      expect(mockChain.insert).toHaveBeenCalledWith({
        user_id: 'user-123',
        ...newRule,
      });
      expect(result).toEqual(createdRule);
    });

    test('throws error on creation failure', async () => {
      mockChain.single.mockResolvedValue({ data: null, error: { message: 'Insert failed' } });

      await expect(
        ExtractionRulesService.createExtractionRule('user-123', {
          name: 'Test',
          trigger_phrases: [],
          task_category: 'general',
          default_priority: 'low',
          default_deadline_days: null,
          is_active: true,
        })
      ).rejects.toThrow();
    });
  });

  describe('updateExtractionRule', () => {
    test('updates an existing rule', async () => {
      const updates = {
        name: 'Updated Rule',
        is_active: false,
      };

      const updatedRule: TaskExtractionRule = {
        id: 'rule-1',
        user_id: 'user-123',
        name: 'Updated Rule',
        trigger_phrases: ['test'],
        task_category: 'general',
        default_priority: 'medium',
        default_deadline_days: null,
        is_active: false,
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
      };

      mockChain.single.mockResolvedValue({ data: updatedRule, error: null });

      const result = await ExtractionRulesService.updateExtractionRule('user-123', 'rule-1', updates);

      expect(mockChain.update).toHaveBeenCalledWith(updates);
      expect(result).toEqual(updatedRule);
    });

    test('validates user_id when updating', async () => {
      mockChain.single.mockResolvedValue({ data: {}, error: null });

      await ExtractionRulesService.updateExtractionRule('user-123', 'rule-1', { name: 'Test' });

      expect(mockChain.eq).toHaveBeenCalledWith('user_id', 'user-123');
    });
  });

  describe('deleteExtractionRule', () => {
    test('deletes a rule', async () => {
      // Set up the mock chain to return a promise at the end
      const finalPromise = Promise.resolve({ error: null });
      mockChain.eq.mockReturnValueOnce(mockChain); // First .eq() returns chain
      mockChain.eq.mockReturnValueOnce(finalPromise); // Second .eq() returns promise

      await ExtractionRulesService.deleteExtractionRule('user-123', 'rule-1');

      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.eq).toHaveBeenCalledWith('id', 'rule-1');
      expect(mockChain.eq).toHaveBeenCalledWith('user_id', 'user-123');
    });

    test('throws error on delete failure', async () => {
      const finalPromise = Promise.resolve({ error: { message: 'Delete failed' } });
      mockChain.eq.mockReturnValueOnce(mockChain);
      mockChain.eq.mockReturnValueOnce(finalPromise);

      await expect(
        ExtractionRulesService.deleteExtractionRule('user-123', 'rule-1')
      ).rejects.toThrow();
    });
  });

  describe('matchExtractionRules', () => {
    test('returns rules that match transcript', async () => {
      const mockRules: TaskExtractionRule[] = [
        {
          id: 'rule-1',
          user_id: 'user-123',
          name: 'Follow-up Rule',
          trigger_phrases: ['follow up', 'action item'],
          task_category: 'follow_up',
          default_priority: 'high',
          default_deadline_days: 3,
          is_active: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'rule-2',
          user_id: 'user-123',
          name: 'Demo Rule',
          trigger_phrases: ['schedule demo'],
          task_category: 'demo',
          default_priority: 'medium',
          default_deadline_days: 7,
          is_active: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      mockChain.order.mockResolvedValue({ data: mockRules, error: null });

      const transcript = 'We need to follow up on this action item.';
      const result = await ExtractionRulesService.matchExtractionRules('user-123', transcript);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('rule-1');
    });

    test('matches case-insensitively', async () => {
      const mockRules: TaskExtractionRule[] = [
        {
          id: 'rule-1',
          user_id: 'user-123',
          name: 'Test Rule',
          trigger_phrases: ['IMPORTANT TASK'],
          task_category: 'general',
          default_priority: 'high',
          default_deadline_days: null,
          is_active: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      mockChain.order.mockResolvedValue({ data: mockRules, error: null });

      const transcript = 'This is an important task we discussed.';
      const result = await ExtractionRulesService.matchExtractionRules('user-123', transcript);

      expect(result).toHaveLength(1);
    });

    test('returns empty array when no rules match', async () => {
      const mockRules: TaskExtractionRule[] = [
        {
          id: 'rule-1',
          user_id: 'user-123',
          name: 'Test Rule',
          trigger_phrases: ['specific phrase'],
          task_category: 'general',
          default_priority: 'medium',
          default_deadline_days: null,
          is_active: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      mockChain.order.mockResolvedValue({ data: mockRules, error: null });

      const transcript = 'This transcript has nothing relevant.';
      const result = await ExtractionRulesService.matchExtractionRules('user-123', transcript);

      expect(result).toHaveLength(0);
    });

    test('returns empty array on error', async () => {
      mockChain.order.mockResolvedValue({ data: null, error: { message: 'Error' } });

      const result = await ExtractionRulesService.matchExtractionRules('user-123', 'transcript');

      expect(result).toEqual([]);
    });

    test('matches multiple rules when applicable', async () => {
      const mockRules: TaskExtractionRule[] = [
        {
          id: 'rule-1',
          user_id: 'user-123',
          name: 'Rule A',
          trigger_phrases: ['follow up'],
          task_category: 'follow_up',
          default_priority: 'high',
          default_deadline_days: 3,
          is_active: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
        {
          id: 'rule-2',
          user_id: 'user-123',
          name: 'Rule B',
          trigger_phrases: ['send email'],
          task_category: 'email',
          default_priority: 'medium',
          default_deadline_days: 1,
          is_active: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      mockChain.order.mockResolvedValue({ data: mockRules, error: null });

      const transcript = 'Please follow up and send email to the client.';
      const result = await ExtractionRulesService.matchExtractionRules('user-123', transcript);

      expect(result).toHaveLength(2);
    });
  });

  describe('getMeetingTypeTemplates', () => {
    test('returns all templates for a user', async () => {
      const mockTemplates: MeetingTypeTemplate[] = [
        {
          id: 'template-1',
          user_id: 'user-123',
          meeting_type: 'discovery',
          extraction_template: { focus: ['pain_points'] },
          content_templates: {},
          is_active: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      mockChain.order.mockResolvedValue({ data: mockTemplates, error: null });

      const result = await ExtractionRulesService.getMeetingTypeTemplates('user-123');

      expect(supabase.from).toHaveBeenCalledWith('meeting_type_templates');
      expect(result).toEqual(mockTemplates);
    });
  });

  describe('getMeetingTypeTemplate', () => {
    test('returns specific template for meeting type', async () => {
      const mockTemplate: MeetingTypeTemplate = {
        id: 'template-1',
        user_id: 'user-123',
        meeting_type: 'demo',
        extraction_template: { focus: ['features'] },
        content_templates: {},
        is_active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      mockChain.single.mockResolvedValue({ data: mockTemplate, error: null });

      const result = await ExtractionRulesService.getMeetingTypeTemplate('user-123', 'demo');

      expect(mockChain.eq).toHaveBeenCalledWith('meeting_type', 'demo');
      expect(mockChain.eq).toHaveBeenCalledWith('is_active', true);
      expect(result).toEqual(mockTemplate);
    });

    test('returns null when template not found', async () => {
      mockChain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      const result = await ExtractionRulesService.getMeetingTypeTemplate('user-123', 'unknown');

      expect(result).toBeNull();
    });

    test('throws error for non-404 errors', async () => {
      mockChain.single.mockResolvedValue({ data: null, error: { code: 'OTHER', message: 'Error' } });

      await expect(
        ExtractionRulesService.getMeetingTypeTemplate('user-123', 'demo')
      ).rejects.toThrow();
    });
  });

  describe('upsertMeetingTypeTemplate', () => {
    test('creates or updates a template', async () => {
      const template = {
        meeting_type: 'discovery' as const,
        extraction_template: { focus: ['budget'] },
        content_templates: {},
        is_active: true,
      };

      const resultTemplate: MeetingTypeTemplate = {
        id: 'template-new',
        user_id: 'user-123',
        ...template,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      };

      mockChain.single.mockResolvedValue({ data: resultTemplate, error: null });

      const result = await ExtractionRulesService.upsertMeetingTypeTemplate('user-123', template);

      expect(mockChain.upsert).toHaveBeenCalledWith(
        { user_id: 'user-123', ...template },
        { onConflict: 'user_id,meeting_type' }
      );
      expect(result).toEqual(resultTemplate);
    });
  });

  describe('deleteMeetingTypeTemplate', () => {
    test('deletes a template by meeting type', async () => {
      const finalPromise = Promise.resolve({ error: null });
      mockChain.eq.mockReturnValueOnce(mockChain);
      mockChain.eq.mockReturnValueOnce(finalPromise);

      await ExtractionRulesService.deleteMeetingTypeTemplate('user-123', 'discovery');

      expect(supabase.from).toHaveBeenCalledWith('meeting_type_templates');
      expect(mockChain.delete).toHaveBeenCalled();
      expect(mockChain.eq).toHaveBeenCalledWith('meeting_type', 'discovery');
    });
  });
});
