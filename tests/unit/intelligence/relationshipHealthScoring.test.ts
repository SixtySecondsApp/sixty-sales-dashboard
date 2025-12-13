import { describe, expect, test } from 'vitest';
import { __relationshipHealthTestables } from '@/lib/services/relationshipHealthService';

describe('relationship health scoring helpers', () => {
  test('calculateCommunicationFrequencyScore uses absolute thresholds without baseline', () => {
    const f = __relationshipHealthTestables.calculateCommunicationFrequencyScore;
    expect(f(0, null)).toBe(0);
    expect(f(1, null)).toBe(25);
    expect(f(2, null)).toBe(50);
    expect(f(4, null)).toBe(75);
    expect(f(8, null)).toBe(100);
  });

  test('calculateResponseBehaviorScore penalizes very slow responses vs baseline', () => {
    const f = __relationshipHealthTestables.calculateResponseBehaviorScore;
    // baseline 4h, recent avg 20h => 5x slower should score worse than baseline-speed
    const fast = f(80, 4, 4);
    const slow = f(80, 20, 4);
    expect(slow).toBeLessThan(fast);
    expect(slow).toBeLessThan(90);
  });

  test('calculateEngagementQualityScore boosts meeting frequency', () => {
    const f = __relationshipHealthTestables.calculateEngagementQualityScore;
    const scoreWithMeetings = f(70, 4, 3);
    const scoreWithoutMeetings = f(70, 0, 60);
    expect(scoreWithMeetings).toBeGreaterThan(scoreWithoutMeetings);
  });
});

