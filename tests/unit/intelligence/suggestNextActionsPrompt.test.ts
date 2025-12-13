import { describe, expect, test } from 'vitest';
import {
  buildCompanySection,
  buildDealSection,
  buildContactSection,
  buildContentSection,
  buildRecentActivitiesSection,
  buildExistingContextSection,
} from '@/lib/prompts/suggestNextActions';

describe('suggestNextActions prompt builders', () => {
  test('buildCompanySection returns empty when missing', () => {
    expect(buildCompanySection(undefined)).toBe('');
  });

  test('buildCompanySection includes name + domain', () => {
    const out = buildCompanySection({ name: 'Acme', domain: 'acme.com', size: '50-100' });
    expect(out).toContain('Company Information');
    expect(out).toContain('Acme');
    expect(out).toContain('acme.com');
    expect(out).toContain('50-100');
  });

  test('buildDealSection includes stage + value', () => {
    const out = buildDealSection({ title: 'Enterprise', stage: 'Opportunity', value: 50000 });
    expect(out).toContain('Deal Information');
    expect(out).toContain('Enterprise');
    expect(out).toContain('Opportunity');
    expect(out).toContain('50,000');
  });

  test('buildContactSection prefers full_name', () => {
    const out = buildContactSection({ full_name: 'Jane Doe', title: 'VP Sales' });
    expect(out).toContain('Primary Contact');
    expect(out).toContain('Jane Doe');
    expect(out).toContain('VP Sales');
  });

  test('buildContentSection prefers transcript', () => {
    const longTranscript = 'TRANSCRIPT '.repeat(20); // > 100 chars
    const out = buildContentSection(longTranscript, 'SUMMARY', 'NOTES');
    expect(out).toContain('Full Meeting Transcript');
    expect(out).toContain('TRANSCRIPT');
    expect(out).not.toContain('SUMMARY');
  });

  test('buildRecentActivitiesSection formats entries', () => {
    const out = buildRecentActivitiesSection([
      { type: 'email', created_at: '2025-01-01T00:00:00Z', notes: 'Sent proposal' },
      { type: 'call', created_at: '2025-01-02T00:00:00Z' },
    ]);
    expect(out).toContain('Recent Activity History');
    expect(out).toContain('[email]');
    expect(out).toContain('Sent proposal');
    expect(out).toContain('[call]');
  });

  test('buildExistingContextSection includes suggestions + tasks', () => {
    const out = buildExistingContextSection({
      suggestions: [{ title: 'Send ROI calculator', action_type: 'email', status: 'pending' }],
      tasks: [{ title: 'Follow up', task_type: 'follow_up', status: 'todo' }],
    });
    expect(out).toContain('EXISTING TASKS AND SUGGESTIONS');
    expect(out).toContain('Send ROI calculator');
    expect(out).toContain('Follow up');
  });
});

