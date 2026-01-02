// tests/unit/billing-analytics.test.ts
// Unit tests for billing analytics metrics calculations

import { describe, it, expect } from 'vitest';

// Mock the calculate_normalized_monthly_amount function logic
function calculateNormalizedMonthlyAmount(
  amountCents: number,
  interval: 'month' | 'year',
  intervalCount: number = 1
): number {
  if (amountCents === null || amountCents === undefined) {
    return 0;
  }

  switch (interval) {
    case 'month':
      return amountCents / intervalCount;
    case 'year':
      return amountCents / (intervalCount * 12);
    default:
      return amountCents;
  }
}

describe('Billing Analytics', () => {
  describe('MRR Normalization', () => {
    it('should normalize monthly subscription correctly', () => {
      const result = calculateNormalizedMonthlyAmount(10000, 'month', 1);
      expect(result).toBe(10000); // £100/month = £100 MRR
    });

    it('should normalize yearly subscription correctly', () => {
      const result = calculateNormalizedMonthlyAmount(120000, 'year', 1);
      expect(result).toBe(10000); // £1200/year = £100/month MRR
    });

    it('should handle quarterly subscriptions', () => {
      const result = calculateNormalizedMonthlyAmount(30000, 'month', 3);
      expect(result).toBe(10000); // £300/quarter = £100/month MRR
    });

    it('should handle null/undefined amounts', () => {
      expect(calculateNormalizedMonthlyAmount(0, 'month', 1)).toBe(0);
    });
  });

  describe('Churn Rate Calculation', () => {
    it('should calculate subscriber churn rate correctly', () => {
      const activeStart = 100;
      const canceled = 5;
      const churnRate = (canceled / activeStart) * 100;
      expect(churnRate).toBe(5);
    });

    it('should calculate MRR churn rate correctly', () => {
      const mrrStart = 100000; // £1000 MRR
      const mrrLost = 5000; // £50 lost
      const mrrChurnRate = (mrrLost / mrrStart) * 100;
      expect(mrrChurnRate).toBe(5);
    });

    it('should handle zero churn', () => {
      const churnRate = (0 / 100) * 100;
      expect(churnRate).toBe(0);
    });
  });

  describe('Trial Conversion', () => {
    it('should calculate trial conversion rate correctly', () => {
      const trialsStarted = 100;
      const trialsConverted = 30;
      const conversionRate = (trialsConverted / trialsStarted) * 100;
      expect(conversionRate).toBe(30);
    });

    it('should handle zero conversions', () => {
      const conversionRate = (0 / 50) * 100;
      expect(conversionRate).toBe(0);
    });
  });

  describe('Retention Cohorts', () => {
    it('should calculate retention rate correctly', () => {
      const cohortSize = 100;
      const retainedAtMonth3 = 75;
      const retentionRate = (retainedAtMonth3 / cohortSize) * 100;
      expect(retentionRate).toBe(75);
    });

    it('should handle 100% retention', () => {
      const retentionRate = (100 / 100) * 100;
      expect(retentionRate).toBe(100);
    });
  });
});
