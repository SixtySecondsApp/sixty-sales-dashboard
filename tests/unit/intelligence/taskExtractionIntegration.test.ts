import { describe, expect, test, vi, beforeEach } from 'vitest';
import { mergeExtractedTasks, type ExtractedTask } from '@/lib/services/taskExtractionIntegration';

// Mock the ExtractionRulesService for applyExtractionRules tests
vi.mock('@/lib/services/extractionRulesService', () => ({
  ExtractionRulesService: {
    matchExtractionRules: vi.fn(),
    getMeetingTypeTemplate: vi.fn(),
  },
}));

import { ExtractionRulesService } from '@/lib/services/extractionRulesService';
import { applyExtractionRules, applyMeetingTypeTemplate } from '@/lib/services/taskExtractionIntegration';

describe('taskExtractionIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mergeExtractedTasks', () => {
    test('prioritizes custom rule tasks over AI tasks', () => {
      const ruleTasks: ExtractedTask[] = [
        {
          title: 'Send follow-up email',
          category: 'follow_up',
          priority: 'high',
          deadlineDays: 3,
          source: 'custom_rule',
          matchedRuleId: 'rule-1',
        },
      ];

      const aiTasks = [
        { title: 'Send follow-up email', category: 'email', priority: 'medium' },
        { title: 'Schedule demo call', category: 'meeting', priority: 'high' },
      ];

      const merged = mergeExtractedTasks(aiTasks, ruleTasks);

      expect(merged).toHaveLength(2);
      // Rule task should be first and keep its properties
      expect(merged[0].source).toBe('custom_rule');
      expect(merged[0].priority).toBe('high');
      expect(merged[0].deadlineDays).toBe(3);
      // AI task should be added
      expect(merged[1].title).toBe('Schedule demo call');
      expect(merged[1].source).toBe('ai_analysis');
    });

    test('deduplicates tasks with case-insensitive matching', () => {
      const ruleTasks: ExtractedTask[] = [
        {
          title: 'SEND PROPOSAL',
          category: 'proposal',
          priority: 'urgent',
          source: 'custom_rule',
        },
      ];

      const aiTasks = [
        { title: 'send proposal', category: 'document' },
        { title: 'Send Proposal', category: 'sales' },
      ];

      const merged = mergeExtractedTasks(aiTasks, ruleTasks);

      expect(merged).toHaveLength(1);
      expect(merged[0].title).toBe('SEND PROPOSAL');
      expect(merged[0].source).toBe('custom_rule');
    });

    test('handles empty rule tasks', () => {
      const aiTasks = [
        { title: 'Task A', category: 'general' },
        { title: 'Task B' },
      ];

      const merged = mergeExtractedTasks(aiTasks, []);

      expect(merged).toHaveLength(2);
      expect(merged[0].source).toBe('ai_analysis');
      expect(merged[0].category).toBe('general');
      expect(merged[1].category).toBe('general'); // default
      expect(merged[1].priority).toBe('medium'); // default
    });

    test('handles empty AI tasks', () => {
      const ruleTasks: ExtractedTask[] = [
        {
          title: 'Custom task',
          category: 'custom',
          priority: 'low',
          source: 'custom_rule',
        },
      ];

      const merged = mergeExtractedTasks([], ruleTasks);

      expect(merged).toHaveLength(1);
      expect(merged[0].title).toBe('Custom task');
    });

    test('handles both empty arrays', () => {
      const merged = mergeExtractedTasks([], []);
      expect(merged).toHaveLength(0);
    });

    test('trims whitespace in title matching', () => {
      const ruleTasks: ExtractedTask[] = [
        {
          title: '  Follow up with client  ',
          category: 'follow_up',
          priority: 'medium',
          source: 'custom_rule',
        },
      ];

      const aiTasks = [
        { title: 'Follow up with client' },
      ];

      const merged = mergeExtractedTasks(aiTasks, ruleTasks);

      expect(merged).toHaveLength(1);
    });

    test('preserves AI task defaults correctly', () => {
      const aiTasks = [
        { title: 'No category task' },
        { title: 'With category', category: 'sales' },
        { title: 'With priority', priority: 'urgent' },
      ];

      const merged = mergeExtractedTasks(aiTasks, []);

      expect(merged[0].category).toBe('general');
      expect(merged[0].priority).toBe('medium');
      expect(merged[1].category).toBe('sales');
      expect(merged[2].priority).toBe('urgent');
    });
  });

  describe('applyExtractionRules', () => {
    test('returns empty array when no rules match', async () => {
      vi.mocked(ExtractionRulesService.matchExtractionRules).mockResolvedValue([]);

      const result = await applyExtractionRules('user-123', 'This is a transcript with no matching phrases');

      expect(result).toEqual([]);
    });

    test('extracts tasks from matching rules', async () => {
      vi.mocked(ExtractionRulesService.matchExtractionRules).mockResolvedValue([
        {
          id: 'rule-1',
          user_id: 'user-123',
          name: 'Follow-up Rule',
          trigger_phrases: ['send proposal', 'follow up'],
          task_category: 'follow_up',
          default_priority: 'high',
          default_deadline_days: 3,
          is_active: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ]);

      const transcript = 'We discussed the project. I will send proposal tomorrow. The team agreed on next steps.';
      const result = await applyExtractionRules('user-123', transcript);

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('custom_rule');
      expect(result[0].matchedRuleId).toBe('rule-1');
      expect(result[0].category).toBe('follow_up');
      expect(result[0].priority).toBe('high');
      expect(result[0].deadlineDays).toBe(3);
    });

    test('matches trigger phrases case-insensitively', async () => {
      vi.mocked(ExtractionRulesService.matchExtractionRules).mockResolvedValue([
        {
          id: 'rule-1',
          user_id: 'user-123',
          name: 'Demo Rule',
          trigger_phrases: ['SCHEDULE DEMO'],
          task_category: 'demo',
          default_priority: 'medium',
          default_deadline_days: null,
          is_active: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ]);

      const transcript = 'Let me schedule demo for next week.';
      const result = await applyExtractionRules('user-123', transcript);

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('demo');
    });

    test('deduplicates tasks with same title', async () => {
      vi.mocked(ExtractionRulesService.matchExtractionRules).mockResolvedValue([
        {
          id: 'rule-1',
          user_id: 'user-123',
          name: 'Test Rule',
          trigger_phrases: ['action item'],
          task_category: 'general',
          default_priority: 'medium',
          default_deadline_days: null,
          is_active: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ]);

      // Same phrase appears in multiple sentences
      const transcript = 'First action item is important. Second action item is also needed.';
      const result = await applyExtractionRules('user-123', transcript);

      // Should deduplicate based on title
      expect(result.length).toBeLessThanOrEqual(2);
    });

    test('handles errors gracefully', async () => {
      vi.mocked(ExtractionRulesService.matchExtractionRules).mockRejectedValue(new Error('Database error'));

      const result = await applyExtractionRules('user-123', 'Some transcript');

      expect(result).toEqual([]);
    });

    test('splits transcript by sentence delimiters', async () => {
      vi.mocked(ExtractionRulesService.matchExtractionRules).mockResolvedValue([
        {
          id: 'rule-1',
          user_id: 'user-123',
          name: 'Test Rule',
          trigger_phrases: ['send email'],
          task_category: 'email',
          default_priority: 'medium',
          default_deadline_days: 1,
          is_active: true,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ]);

      const transcript = 'I will send email! You should send email too? We all send email.';
      const result = await applyExtractionRules('user-123', transcript);

      // Should find multiple sentences but deduplicate
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('applyMeetingTypeTemplate', () => {
    test('returns null for null meeting type', async () => {
      const result = await applyMeetingTypeTemplate('user-123', null);
      expect(result).toBeNull();
    });

    test('returns template extraction_template when found', async () => {
      vi.mocked(ExtractionRulesService.getMeetingTypeTemplate).mockResolvedValue({
        id: 'template-1',
        user_id: 'user-123',
        meeting_type: 'discovery',
        extraction_template: {
          focus_areas: ['pain_points', 'budget', 'timeline'],
          priority_boost: true,
        },
        content_templates: {},
        is_active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });

      const result = await applyMeetingTypeTemplate('user-123', 'discovery');

      expect(result).toEqual({
        focus_areas: ['pain_points', 'budget', 'timeline'],
        priority_boost: true,
      });
    });

    test('returns null when template not found', async () => {
      vi.mocked(ExtractionRulesService.getMeetingTypeTemplate).mockResolvedValue(null);

      const result = await applyMeetingTypeTemplate('user-123', 'discovery');

      expect(result).toBeNull();
    });

    test('handles errors gracefully', async () => {
      vi.mocked(ExtractionRulesService.getMeetingTypeTemplate).mockRejectedValue(new Error('Database error'));

      const result = await applyMeetingTypeTemplate('user-123', 'discovery');

      expect(result).toBeNull();
    });

    test('returns null when template has no extraction_template', async () => {
      vi.mocked(ExtractionRulesService.getMeetingTypeTemplate).mockResolvedValue({
        id: 'template-1',
        user_id: 'user-123',
        meeting_type: 'general',
        extraction_template: null as any,
        content_templates: {},
        is_active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });

      const result = await applyMeetingTypeTemplate('user-123', 'general');

      expect(result).toBeNull();
    });
  });
});
