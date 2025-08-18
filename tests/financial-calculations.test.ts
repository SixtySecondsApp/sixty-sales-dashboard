/**
 * COMPREHENSIVE FINANCIAL CALCULATIONS TEST SUITE
 * 
 * Critical QA testing for financial calculations including:
 * - LTV formula consistency: (monthlyMRR * 3) + oneOffRevenue
 * - MRR calculations only for subscription deals
 * - Input validation for financial data (NaN, Infinity, negative values)
 * - Edge cases and security validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  validateFinancialNumber,
  validateRevenue,
  validateMRR,
  validateDealValue,
  calculateLifetimeValue,
  safeParseFinancial,
  validateFinancialObject,
  FinancialLogger,
  getFinancialValidationHealth,
  FINANCIAL_FIELD_CONFIGS
} from '../src/lib/utils/financialValidation';
import { calculateLTVValue, formatCurrency, formatActivityAmount } from '../src/lib/utils/calculations';

describe('Financial Calculations - Critical QA Testing', () => {
  beforeEach(() => {
    // Clear logs before each test
    FinancialLogger.clearLogs();
    FinancialLogger.setLogLevel('debug');
  });

  afterEach(() => {
    // Clean up after each test
    FinancialLogger.clearLogs();
  });

  describe('LTV Formula Consistency Tests', () => {
    it('should calculate LTV correctly with both MRR and one-off revenue', () => {
      const deal = {
        monthly_mrr: 1000,
        one_off_revenue: 5000,
        annual_value: 12000
      };

      const ltv = calculateLTVValue(deal);
      
      // Business rule: (monthlyMRR * 3) + oneOffRevenue
      const expected = (1000 * 3) + 5000; // 3000 + 5000 = 8000
      expect(ltv).toBe(expected);
      expect(ltv).toBe(8000);
    });

    it('should calculate LTV with only MRR (no one-off revenue)', () => {
      const deal = {
        monthly_mrr: 500,
        one_off_revenue: 0,
        annual_value: 6000
      };

      const ltv = calculateLTVValue(deal);
      
      // Business rule: (500 * 3) + 0 = 1500
      expect(ltv).toBe(1500);
    });

    it('should calculate LTV with only one-off revenue (no MRR)', () => {
      const deal = {
        monthly_mrr: 0,
        one_off_revenue: 10000,
        annual_value: 0
      };

      const ltv = calculateLTVValue(deal);
      
      // Business rule: (0 * 3) + 10000 = 10000
      expect(ltv).toBe(10000);
    });

    it('should use fallback amount for legacy deals without revenue fields', () => {
      const deal = {}; // No revenue fields
      const fallback = 7500;

      const ltv = calculateLTVValue(deal, fallback);
      expect(ltv).toBe(fallback);
    });

    it('should return 0 for null/undefined deals', () => {
      expect(calculateLTVValue(null)).toBe(0);
      expect(calculateLTVValue(undefined)).toBe(0);
      expect(calculateLTVValue(null, 1000)).toBe(1000);
    });

    it('should handle decimal values correctly', () => {
      const deal = {
        monthly_mrr: 999.99,
        one_off_revenue: 4999.99
      };

      const ltv = calculateLTVValue(deal);
      const expected = (999.99 * 3) + 4999.99; // 2999.97 + 4999.99 = 7999.96
      expect(ltv).toBeCloseTo(expected, 2);
    });
  });

  describe('Financial Validation - Security Tests', () => {
    it('should reject malicious object inputs', () => {
      const maliciousInputs = [
        { toString: () => '1000', valueOf: () => 999 },
        [1000],
        { amount: 1000 },
        new Date(),
        () => 1000
      ];

      maliciousInputs.forEach(input => {
        const result = validateFinancialNumber(input);
        expect(result.isValid).toBe(false);
        expect(result.severity).toBe('critical');
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should reject boolean values', () => {
      const result = validateFinancialNumber(true);
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe('high');
      expect(result.errors[0]).toContain('cannot be a boolean');
    });

    it('should handle SQL injection attempts', () => {
      const sqlInjectionInputs = [
        "1000; DROP TABLE deals;",
        "1000' OR 1=1 --",
        "1000 UNION SELECT * FROM users",
        "1000\"; DELETE FROM activities; --"
      ];

      sqlInjectionInputs.forEach(input => {
        const result = validateFinancialNumber(input);
        // Should either be invalid or sanitized to a safe number
        if (result.isValid) {
          expect(result.value).toBeGreaterThanOrEqual(0);
          expect(result.value).toBeLessThanOrEqual(10000000);
        }
      });
    });

    it('should handle NaN and Infinity inputs', () => {
      const dangerousInputs = [NaN, Infinity, -Infinity, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

      dangerousInputs.forEach(input => {
        const result = validateFinancialNumber(input);
        expect(result.isValid).toBe(false);
        expect(['high', 'critical']).toContain(result.severity);
      });
    });

    it('should handle very large numbers safely', () => {
      const largeNumbers = [
        Number.MAX_VALUE,
        Number.MAX_SAFE_INTEGER + 1,
        1e20,
        999999999999999999999
      ];

      largeNumbers.forEach(input => {
        const result = validateFinancialNumber(input);
        if (!result.isValid) {
          expect(result.errors.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle empty and null values correctly', () => {
      const emptyValues = [null, undefined, '', '   ', 0];

      emptyValues.forEach(value => {
        const result = validateFinancialNumber(value, { allowZero: true });
        expect(result.value).toBe(0);
        expect(result.isValid).toBe(true);
      });
    });

    it('should clean currency symbols correctly', () => {
      const currencyInputs = [
        { input: '£1,000.50', expected: 1000.50 },
        { input: '$2,500', expected: 2500 },
        { input: '€3 500,75', expected: 3500 },
        { input: '1,234.56', expected: 1234.56 },
        { input: '  £  1,000  ', expected: 1000 }
      ];

      currencyInputs.forEach(({ input, expected }) => {
        const result = validateFinancialNumber(input);
        expect(result.isValid).toBe(true);
        expect(result.value).toBeCloseTo(expected, 2);
      });
    });

    it('should handle negative values based on configuration', () => {
      const negativeValue = -1000;

      // Should reject negative by default
      const defaultResult = validateFinancialNumber(negativeValue);
      expect(defaultResult.isValid).toBe(false);

      // Should accept when explicitly allowed
      const allowedResult = validateFinancialNumber(negativeValue, { allowNegative: true });
      expect(allowedResult.isValid).toBe(true);
      expect(allowedResult.value).toBe(-1000);
    });

    it('should validate range constraints', () => {
      const options = {
        minValue: 100,
        maxValue: 10000,
        fieldName: 'test_field'
      };

      // Below minimum
      const belowMin = validateFinancialNumber(50, options);
      expect(belowMin.isValid).toBe(false);
      expect(belowMin.errors[0]).toContain('at least 100');

      // Above maximum
      const aboveMax = validateFinancialNumber(15000, options);
      expect(aboveMax.isValid).toBe(false);
      expect(aboveMax.errors[0]).toContain('cannot exceed 10000');

      // Within range
      const valid = validateFinancialNumber(5000, options);
      expect(valid.isValid).toBe(true);
      expect(valid.value).toBe(5000);
    });
  });

  describe('Specific Field Validations', () => {
    it('should validate revenue amounts correctly', () => {
      const validRevenue = validateRevenue(50000);
      expect(validRevenue.isValid).toBe(true);
      expect(validRevenue.value).toBe(50000);

      const invalidRevenue = validateRevenue(-1000);
      expect(invalidRevenue.isValid).toBe(false);
    });

    it('should validate MRR amounts correctly', () => {
      const validMRR = validateMRR(5000);
      expect(validMRR.isValid).toBe(true);
      expect(validMRR.value).toBe(5000);

      const tooLargeMRR = validateMRR(2000000); // Above £1M monthly limit
      expect(tooLargeMRR.isValid).toBe(false);
    });

    it('should validate deal values correctly', () => {
      const validDeal = validateDealValue(100000);
      expect(validDeal.isValid).toBe(true);

      const tooLargeDeal = validateDealValue(20000000); // Above £10M limit
      expect(tooLargeDeal.isValid).toBe(false);
    });
  });

  describe('Safe Parsing Functions', () => {
    it('should safely parse valid financial values', () => {
      expect(safeParseFinancial('1000')).toBe(1000);
      expect(safeParseFinancial(2500.50)).toBe(2500.50);
      expect(safeParseFinancial('£3,000')).toBe(3000);
    });

    it('should use fallback for invalid values', () => {
      expect(safeParseFinancial('invalid', 500)).toBe(500);
      expect(safeParseFinancial(NaN, 1000)).toBe(1000);
      expect(safeParseFinancial(null, 0)).toBe(0);
    });
  });

  describe('Object Validation', () => {
    it('should validate multiple fields simultaneously', () => {
      const financialData = {
        one_off_revenue: 10000,
        monthly_mrr: 2000,
        annual_value: 24000,
        deal_value: 15000
      };

      const result = validateFinancialObject(financialData);
      
      expect(result.isValid).toBe(true);
      expect(result.validatedData.one_off_revenue).toBe(10000);
      expect(result.validatedData.monthly_mrr).toBe(2000);
      expect(result.overallSeverity).toBe('low');
    });

    it('should handle mixed valid/invalid data', () => {
      const mixedData = {
        one_off_revenue: 10000, // valid
        monthly_mrr: 'invalid', // invalid
        annual_value: -5000     // invalid (negative)
      };

      const result = validateFinancialObject(mixedData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.monthly_mrr).toBeDefined();
      expect(result.errors.annual_value).toBeDefined();
      expect(result.validatedData.one_off_revenue).toBe(10000);
    });
  });

  describe('Lifetime Value Calculation with Validation', () => {
    it('should calculate and validate LTV correctly', () => {
      const result = calculateLifetimeValue(1000, 5000);
      
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(8000); // (1000 * 3) + 5000
      expect(result.errors.length).toBe(0);
    });

    it('should handle invalid inputs in LTV calculation', () => {
      const result = calculateLifetimeValue('invalid_mrr', 'invalid_revenue');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(err => err.includes('MRR'))).toBe(true);
      expect(result.errors.some(err => err.includes('One-off Revenue'))).toBe(true);
    });

    it('should validate calculated LTV against business rules', () => {
      // Test with values that would create an invalid LTV
      const result = calculateLifetimeValue(5000000, 10000000); // Very large values
      
      // Should either be valid within limits or flag as invalid
      if (!result.isValid) {
        expect(result.errors.length).toBeGreaterThan(0);
      } else {
        expect(result.value).toBeLessThanOrEqual(FINANCIAL_FIELD_CONFIGS.dealValue.maxValue!);
      }
    });
  });

  describe('Currency Formatting', () => {
    it('should format currency correctly', () => {
      expect(formatCurrency(1000)).toBe('£1,000');
      expect(formatCurrency(1234.56)).toBe('£1,235'); // Rounds to nearest pound
      expect(formatCurrency(0)).toBe('£0');
      expect(formatCurrency(null)).toBe('£0');
      expect(formatCurrency(undefined)).toBe('£0');
    });

    it('should format large amounts correctly', () => {
      expect(formatCurrency(1000000)).toBe('£1,000,000');
      expect(formatCurrency(1234567)).toBe('£1,234,567');
    });
  });

  describe('Activity Amount Formatting', () => {
    it('should format proposal amounts correctly', () => {
      expect(formatActivityAmount(1000, 1500, 'proposal')).toBe('£1,500'); // Shows LTV for proposals
      expect(formatActivityAmount(null, 1500, 'proposal')).toBe('£1,500');
      expect(formatActivityAmount(1000, null, 'proposal')).toBe('£1,000');
      expect(formatActivityAmount(null, null, 'proposal')).toBe('-');
    });

    it('should format non-proposal amounts correctly', () => {
      expect(formatActivityAmount(1000, 1500, 'meeting')).toBe('£1,000 (LTV: £1,500)'); // Shows both
      expect(formatActivityAmount(1000, 1000, 'meeting')).toBe('£1,000'); // Same values
      expect(formatActivityAmount(1000, null, 'meeting')).toBe('£1,000'); // Only original
      expect(formatActivityAmount(null, 1500, 'meeting')).toBe('£1,500'); // Only LTV
    });
  });

  describe('Health Monitoring', () => {
    it('should track validation health correctly', () => {
      // Generate some validation events
      validateFinancialNumber('invalid'); // Should create a high severity log
      validateFinancialNumber(Infinity);  // Should create a critical severity log
      validateFinancialNumber(1000);      // Should create a low severity log

      const health = getFinancialValidationHealth();
      
      expect(health.totalLogs).toBeGreaterThan(0);
      expect(health.severityCounts.critical).toBeGreaterThanOrEqual(1);
      expect(health.severityCounts.high).toBeGreaterThanOrEqual(1);
      
      // Health status should reflect the critical errors
      expect(['warning', 'critical']).toContain(health.status);
    });

    it('should maintain log size limits', () => {
      // Generate more than 100 logs
      for (let i = 0; i < 150; i++) {
        validateFinancialNumber(`test_${i}`);
      }

      const logs = FinancialLogger.getLogs();
      expect(logs.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Precision and Rounding', () => {
    it('should handle floating point precision correctly', () => {
      const result = validateFinancialNumber(0.1 + 0.2); // Classic floating point issue
      expect(result.isValid).toBe(true);
      expect(result.value).toBeCloseTo(0.3, 2);
    });

    it('should round to 2 decimal places', () => {
      const result = validateFinancialNumber(1234.567);
      expect(result.isValid).toBe(true);
      expect(result.value).toBe(1234.57); // Rounded to 2 decimal places
    });
  });

  describe('Performance Tests', () => {
    it('should validate large datasets efficiently', () => {
      const startTime = performance.now();
      
      // Test with 1000 validations
      for (let i = 0; i < 1000; i++) {
        validateFinancialNumber(Math.random() * 10000);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete 1000 validations in under 100ms
      expect(duration).toBeLessThan(100);
    });
  });
});