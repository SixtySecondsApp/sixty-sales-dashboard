/**
 * COMPREHENSIVE FINANCIAL VALIDATION TESTS
 * 
 * Critical test suite for financial data validation covering all edge cases
 * including NaN, Infinity, negative values, extremely large numbers, and
 * potential security vulnerabilities.
 */

import {
  validateFinancialNumber,
  validateRevenue,
  validateMRR,
  validateDealValue,
  validateSubscriptionAmount,
  safeParseFinancial,
  calculateLifetimeValue,
  validateFinancialObject,
  FinancialLogger,
  getFinancialValidationHealth,
  FINANCIAL_FIELD_CONFIGS
} from '../financialValidation';

describe('Financial Validation Security Tests', () => {
  
  beforeEach(() => {
    // Clear logs before each test
    FinancialLogger.clearLogs();
  });

  describe('Core validateFinancialNumber Edge Cases', () => {
    
    test('should handle NaN values correctly', () => {
      const testCases = [
        NaN,
        'NaN',
        'not-a-number',
        '£abc',
        'infinity',
        '1/0',
        '0/0'
      ];

      testCases.forEach(value => {
        const result = validateFinancialNumber(value, { fieldName: 'test_nan' });
        expect(result.isValid).toBe(false);
        expect(result.value).toBe(0);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.severity).toBeOneOf(['high', 'critical']);
      });
    });

    test('should handle Infinity values correctly', () => {
      const testCases = [
        Infinity,
        -Infinity,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        '1e999',
        '-1e999'
      ];

      testCases.forEach(value => {
        const result = validateFinancialNumber(value, { fieldName: 'test_infinity' });
        expect(result.isValid).toBe(false);
        expect(result.value).toBe(0);
        expect(result.errors).toContain('test_infinity cannot be infinite');
        expect(result.severity).toBe('critical');
      });
    });

    test('should handle negative values based on configuration', () => {
      // Test with negative values not allowed (default)
      const result1 = validateFinancialNumber(-100, { fieldName: 'test_negative' });
      expect(result1.isValid).toBe(false);
      expect(result1.errors).toContain('test_negative cannot be negative');

      // Test with negative values allowed
      const result2 = validateFinancialNumber(-100, { 
        fieldName: 'test_negative_allowed', 
        allowNegative: true 
      });
      expect(result2.isValid).toBe(true);
      expect(result2.value).toBe(-100);
    });

    test('should handle extremely large numbers', () => {
      const testCases = [
        999999999999999999999, // Larger than MAX_SAFE_INTEGER
        Number.MAX_VALUE,
        1e20,
        9007199254740992, // Number.MAX_SAFE_INTEGER + 1
      ];

      testCases.forEach(value => {
        const result = validateFinancialNumber(value, { 
          fieldName: 'test_large',
          maxValue: 10_000_000 // £10M max
        });
        
        if (value > 10_000_000) {
          expect(result.isValid).toBe(false);
          expect(result.errors).toContain('test_large cannot exceed 10000000');
        }
        
        if (!Number.isSafeInteger(value * 100)) {
          expect(result.warnings.length).toBeGreaterThan(0);
        }
      });
    });

    test('should handle zero values based on configuration', () => {
      // Test with zero not allowed
      const result1 = validateFinancialNumber(0, { 
        fieldName: 'test_zero', 
        allowZero: false 
      });
      expect(result1.isValid).toBe(false);
      expect(result1.errors).toContain('test_zero cannot be zero');

      // Test with zero allowed (default)
      const result2 = validateFinancialNumber(0, { fieldName: 'test_zero_allowed' });
      expect(result2.isValid).toBe(true);
      expect(result2.value).toBe(0);
    });

    test('should handle null, undefined, and empty values', () => {
      const testCases = [null, undefined, '', '   ', '0', 0];

      testCases.forEach(value => {
        const result = validateFinancialNumber(value, { 
          fieldName: 'test_empty',
          allowZero: true 
        });
        expect(result.isValid).toBe(true);
        expect(result.value).toBe(0);
      });
    });

    test('should handle boolean values as security risk', () => {
      const testCases = [true, false];

      testCases.forEach(value => {
        const result = validateFinancialNumber(value, { fieldName: 'test_boolean' });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('test_boolean cannot be a boolean value');
        expect(result.severity).toBe('high');
      });
    });

    test('should handle object and array values as security risk', () => {
      const testCases = [
        {},
        { valueOf: () => 100 },
        [],
        [100],
        new Date(),
        /regex/,
        () => 100
      ];

      testCases.forEach(value => {
        const result = validateFinancialNumber(value, { fieldName: 'test_object' });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('test_object cannot be an object or array');
        expect(result.severity).toBe('critical');
      });
    });

    test('should clean and parse currency strings correctly', () => {
      const testCases = [
        { input: '£100', expected: 100 },
        { input: '$1,000.50', expected: 1000.50 },
        { input: '€ 2 500,75', expected: 2500.75 },
        { input: '1.234.567,89', expected: 1234567.89 },
        { input: '  £  123.45  ', expected: 123.45 },
        { input: '£-50', expected: -50 }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = validateFinancialNumber(input, { 
          fieldName: 'test_currency',
          allowNegative: expected < 0,
          maxValue: 10_000_000 
        });
        expect(result.isValid).toBe(true);
        expect(result.value).toBe(expected);
      });
    });

    test('should detect invalid decimal formats', () => {
      const testCases = [
        '100.50.25',
        '1.2.3.4',
        '..123',
        '123..',
        '1..23'
      ];

      testCases.forEach(value => {
        const result = validateFinancialNumber(value, { fieldName: 'test_decimal' });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('test_decimal has invalid decimal format');
        expect(result.severity).toBe('high');
      });
    });

    test('should detect invalid negative formats', () => {
      const testCases = [
        '--100',
        '1-00',
        '10-0',
        '-10-',
        '1-2-3'
      ];

      testCases.forEach(value => {
        const result = validateFinancialNumber(value, { fieldName: 'test_negative_format' });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('test_negative_format has invalid negative format');
        expect(result.severity).toBe('high');
      });
    });

    test('should round to 2 decimal places to avoid floating point issues', () => {
      const testCases = [
        { input: 10.999999999, expected: 11 },
        { input: 10.995, expected: 11 },
        { input: 10.994, expected: 10.99 },
        { input: 0.1 + 0.2, expected: 0.3 }, // Classic floating point issue
      ];

      testCases.forEach(({ input, expected }) => {
        const result = validateFinancialNumber(input, { fieldName: 'test_rounding' });
        expect(result.isValid).toBe(true);
        expect(result.value).toBe(expected);
      });
    });
  });

  describe('Specific Field Validators', () => {
    
    test('validateRevenue should use correct configuration', () => {
      const config = FINANCIAL_FIELD_CONFIGS.revenue;
      
      // Valid case
      const validResult = validateRevenue(5000);
      expect(validResult.isValid).toBe(true);
      expect(validResult.value).toBe(5000);

      // Negative value (not allowed for revenue)
      const negativeResult = validateRevenue(-1000);
      expect(negativeResult.isValid).toBe(false);

      // Exceeds maximum
      const largeResult = validateRevenue(20_000_000);
      expect(largeResult.isValid).toBe(false);
    });

    test('validateMRR should use correct configuration', () => {
      // Valid case
      const validResult = validateMRR(1500);
      expect(validResult.isValid).toBe(true);
      expect(validResult.value).toBe(1500);

      // Exceeds MRR maximum
      const largeResult = validateMRR(2_000_000);
      expect(largeResult.isValid).toBe(false);
    });

    test('validateDealValue should use correct configuration', () => {
      // Valid case
      const validResult = validateDealValue(50000);
      expect(validResult.isValid).toBe(true);
      expect(validResult.value).toBe(50000);

      // Zero value (allowed)
      const zeroResult = validateDealValue(0);
      expect(zeroResult.isValid).toBe(true);
      expect(zeroResult.value).toBe(0);
    });

    test('validateSubscriptionAmount should use correct configuration', () => {
      // Valid case
      const validResult = validateSubscriptionAmount(800);
      expect(validResult.isValid).toBe(true);
      expect(validResult.value).toBe(800);

      // Exceeds subscription maximum
      const largeResult = validateSubscriptionAmount(600_000);
      expect(largeResult.isValid).toBe(false);
    });
  });

  describe('safeParseFinancial', () => {
    
    test('should return fallback for invalid values', () => {
      const testCases = [
        { input: NaN, fallback: 100, expected: 100 },
        { input: 'invalid', fallback: 0, expected: 0 },
        { input: Infinity, fallback: 500, expected: 500 },
        { input: null, fallback: 50, expected: 0 }, // null with allowZero=true returns 0, not fallback
      ];

      testCases.forEach(({ input, fallback, expected }) => {
        const result = safeParseFinancial(input, fallback, { 
          fieldName: 'test_safe',
          allowZero: true 
        });
        expect(result).toBe(expected);
      });
    });

    test('should return valid values unchanged', () => {
      const testCases = [100, 0, 1000.50, '£500', '$1,234.56'];

      testCases.forEach(input => {
        const result = safeParseFinancial(input, 999, { 
          fieldName: 'test_valid',
          allowZero: true,
          maxValue: 10000 
        });
        expect(typeof result).toBe('number');
        expect(result).not.toBe(999); // Should not use fallback for valid values
      });
    });
  });

  describe('calculateLifetimeValue', () => {
    
    test('should calculate correct lifetime value with valid inputs', () => {
      const testCases = [
        { mrr: 1000, revenue: 5000, expected: 8000 }, // (1000 * 3) + 5000
        { mrr: 0, revenue: 10000, expected: 10000 }, // (0 * 3) + 10000
        { mrr: 500, revenue: 0, expected: 1500 }, // (500 * 3) + 0
        { mrr: 0, revenue: 0, expected: 0 }, // (0 * 3) + 0
      ];

      testCases.forEach(({ mrr, revenue, expected }) => {
        const result = calculateLifetimeValue(mrr, revenue);
        expect(result.isValid).toBe(true);
        expect(result.value).toBe(expected);
        expect(result.errors).toHaveLength(0);
      });
    });

    test('should handle invalid inputs', () => {
      const testCases = [
        { mrr: NaN, revenue: 5000 },
        { mrr: 1000, revenue: Infinity },
        { mrr: -500, revenue: 5000 },
        { mrr: 1000, revenue: -2000 },
      ];

      testCases.forEach(({ mrr, revenue }) => {
        const result = calculateLifetimeValue(mrr, revenue);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    test('should validate calculated result', () => {
      // Test case where inputs are valid but calculated result exceeds limits
      const result = calculateLifetimeValue(5_000_000, 5_000_000);
      // This would result in 20M lifetime value, which exceeds max deal value
      expect(result.isValid).toBe(false);
      expect(result.errors.some(err => err.includes('Lifetime Value'))).toBe(true);
    });
  });

  describe('validateFinancialObject', () => {
    
    test('should validate multiple fields correctly', () => {
      const validData = {
        one_off_revenue: 5000,
        monthly_mrr: 1000,
        annual_value: 8000,
        deal_value: 50000
      };

      const result = validateFinancialObject(validData);
      expect(result.isValid).toBe(true);
      expect(result.validatedData.one_off_revenue).toBe(5000);
      expect(result.validatedData.monthly_mrr).toBe(1000);
      expect(result.overallSeverity).toBe('low');
    });

    test('should handle mixed valid and invalid fields', () => {
      const mixedData = {
        one_off_revenue: 5000, // Valid
        monthly_mrr: NaN, // Invalid
        annual_value: -1000, // Invalid (negative)
        deal_value: 50000 // Valid
      };

      const result = validateFinancialObject(mixedData);
      expect(result.isValid).toBe(false);
      expect(result.errors.monthly_mrr).toBeDefined();
      expect(result.errors.annual_value).toBeDefined();
      expect(result.errors.one_off_revenue).toBeUndefined();
      expect(result.errors.deal_value).toBeUndefined();
    });

    test('should determine correct overall severity', () => {
      const criticalData = {
        monthly_mrr: Infinity // Critical severity
      };

      const result = validateFinancialObject(criticalData);
      expect(result.overallSeverity).toBe('critical');
    });
  });

  describe('Financial Logger', () => {
    
    test('should log with correct severity levels', () => {
      FinancialLogger.log('critical', 'Test critical message', { test: 'data' });
      FinancialLogger.log('high', 'Test high message');
      FinancialLogger.log('medium', 'Test medium message');
      FinancialLogger.log('low', 'Test low message');

      const logs = FinancialLogger.getLogs();
      expect(logs).toHaveLength(4);
      expect(logs[0].severity).toBe('critical');
      expect(logs[1].severity).toBe('high');
      expect(logs[2].severity).toBe('medium');
      expect(logs[3].severity).toBe('low');
    });

    test('should store additional data correctly', () => {
      const testData = { value: 'test', number: 123 };
      FinancialLogger.log('high', 'Test with data', testData);

      const logs = FinancialLogger.getLogs();
      expect(logs[0].data).toEqual(testData);
    });

    test('should limit log storage to 100 entries', () => {
      // Add 110 log entries
      for (let i = 0; i < 110; i++) {
        FinancialLogger.log('low', `Test message ${i}`);
      }

      const logs = FinancialLogger.getLogs();
      expect(logs).toHaveLength(100);
      expect(logs[0].message).toBe('Test message 10'); // First 10 should be removed
    });

    test('should clear logs correctly', () => {
      FinancialLogger.log('low', 'Test message');
      expect(FinancialLogger.getLogs()).toHaveLength(1);

      FinancialLogger.clearLogs();
      expect(FinancialLogger.getLogs()).toHaveLength(0);
    });
  });

  describe('Health Monitoring', () => {
    
    test('should return healthy status with no issues', () => {
      const health = getFinancialValidationHealth();
      expect(health.status).toBe('healthy');
      expect(health.severityCounts.critical).toBe(0);
      expect(health.severityCounts.high).toBe(0);
    });

    test('should return warning status with medium issues', () => {
      // Add many medium severity logs
      for (let i = 0; i < 55; i++) {
        FinancialLogger.log('medium', 'Test medium issue');
      }

      const health = getFinancialValidationHealth();
      expect(health.status).toBe('warning');
    });

    test('should return critical status with high/critical issues', () => {
      FinancialLogger.log('critical', 'Test critical issue');

      const health = getFinancialValidationHealth();
      expect(health.status).toBe('critical');
    });
  });

  describe('Performance Tests', () => {
    
    test('should validate large datasets efficiently', () => {
      const startTime = performance.now();
      
      // Validate 1000 financial records
      for (let i = 0; i < 1000; i++) {
        validateFinancialNumber(Math.random() * 10000, { fieldName: 'perf_test' });
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Should complete in under 1 second
      expect(duration).toBeLessThan(1000);
    });

    test('should handle concurrent validations', async () => {
      const promises = [];
      
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve(validateFinancialNumber(Math.random() * 1000, { fieldName: 'concurrent_test' }))
        );
      }
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(100);
      expect(results.every(result => typeof result.value === 'number')).toBe(true);
    });
  });

  describe('Security Attack Vectors', () => {
    
    test('should resist prototype pollution attacks', () => {
      const maliciousInput = JSON.parse('{"__proto__": {"polluted": true}, "value": 100}');
      
      const result = validateFinancialNumber(maliciousInput, { fieldName: 'security_test' });
      expect(result.isValid).toBe(false);
      expect(result.severity).toBe('critical');
      
      // Ensure prototype was not polluted
      expect((Object.prototype as any).polluted).toBeUndefined();
    });

    test('should handle malicious string inputs', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        '${process.env}',
        '#{7*7}',
        '{{7*7}}',
        '<!--#exec cmd="/bin/cat /etc/passwd"-->',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>'
      ];

      maliciousInputs.forEach(input => {
        const result = validateFinancialNumber(input, { fieldName: 'xss_test' });
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    test('should resist ReDoS attacks with complex regex patterns', () => {
      const startTime = performance.now();
      
      // Potential ReDoS payload
      const maliciousInput = 'a'.repeat(10000) + '!';
      
      const result = validateFinancialNumber(maliciousInput, { fieldName: 'redos_test' });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      expect(result.isValid).toBe(false);
      expect(duration).toBeLessThan(100); // Should complete quickly
    });
  });
});

// Helper function for Jest custom matchers
expect.extend({
  toBeOneOf(received, validOptions) {
    const pass = validOptions.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${validOptions}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${validOptions}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(validOptions: any[]): R;
    }
  }
}