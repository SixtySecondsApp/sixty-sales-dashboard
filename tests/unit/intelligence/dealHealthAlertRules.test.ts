import { describe, expect, test } from 'vitest';
import { __dealHealthAlertTestables } from '@/lib/services/dealHealthAlertService';

describe('deal health alert testables', () => {
  test('evaluateThreshold respects operators', () => {
    const f = __dealHealthAlertTestables.evaluateThreshold;
    expect(f(5, '>', 3)).toBe(true);
    expect(f(5, '<', 3)).toBe(false);
    expect(f(5, '>=', 5)).toBe(true);
    expect(f(5, '<=', 5)).toBe(true);
    expect(f(5, '=', 5)).toBe(true);
  });

  test('renderTemplate replaces placeholders', () => {
    const render = __dealHealthAlertTestables.renderTemplate;
    const out = render('Deal {{deal_name}} in {{stage}}', {
      deal: { name: 'BigCo', company: 'BigCo' },
      healthScore: {
        days_in_current_stage: 10,
        sentiment_trend: 'stable',
        avg_sentiment_last_3_meetings: null,
        meeting_count_last_30_days: 0,
        avg_response_time_hours: null,
        days_since_last_activity: null,
      },
      stageName: 'Opportunity',
      dealValue: 10000,
      expectedCloseDate: null,
    } as any);

    expect(out).toContain('BigCo');
    expect(out).toContain('Opportunity');
    expect(out).not.toContain('{{deal_name}}');
  });
});

