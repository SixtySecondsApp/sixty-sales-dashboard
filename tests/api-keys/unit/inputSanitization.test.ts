import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityTestHelper, ValidationTestHelper, TestDataGenerator } from '../utils/testHelpers';

// Mock the Edge Function input sanitization logic
class InputSanitizer {
  sanitizeString(input: string, maxLength: number = 255): string {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }
    
    return input
      .trim()
      .replace(/[<>\"'&]/g, '') // Remove potentially dangerous characters
      .slice(0, maxLength);
  }

  validatePermissions(permissions: string[]): { isValid: boolean; error?: string; sanitizedPermissions?: string[] } {
    const validPermissions = [
      'deals:read', 'deals:write', 'deals:delete',
      'contacts:read', 'contacts:write', 'contacts:delete',
      'activities:read', 'activities:write', 'activities:delete',
      'analytics:read', 'admin:read', 'admin:write'
    ];
    
    if (!permissions || !Array.isArray(permissions)) {
      return { isValid: false, error: 'Permissions must be an array' };
    }
    
    if (permissions.length === 0) {
      return { isValid: false, error: 'At least one permission is required' };
    }
    
    if (permissions.length > 20) {
      return { isValid: false, error: 'Too many permissions specified (maximum 20)' };
    }
    
    const sanitizedPermissions: string[] = [];
    
    for (const permission of permissions) {
      if (typeof permission !== 'string') {
        return { isValid: false, error: 'All permissions must be strings' };
      }
      
      const cleanPermission = permission.trim().toLowerCase();
      if (!validPermissions.includes(cleanPermission)) {
        return { isValid: false, error: `Invalid permission: ${permission}` };
      }
      
      if (!sanitizedPermissions.includes(cleanPermission)) {
        sanitizedPermissions.push(cleanPermission);
      }
    }
    
    return { isValid: true, sanitizedPermissions };
  }

  validateRateLimit(rateLimit: number): { isValid: boolean; error?: string; sanitizedRateLimit?: number } {
    if (typeof rateLimit !== 'number' || rateLimit < 1 || rateLimit > 10000) {
      return { isValid: false, error: 'rate_limit must be a number between 1 and 10000' };
    }
    return { isValid: true, sanitizedRateLimit: rateLimit };
  }

  validateExpirationDays(expirationDays: number | null): { isValid: boolean; error?: string; sanitizedDays?: number | null } {
    if (expirationDays === null || expirationDays === undefined) {
      return { isValid: true, sanitizedDays: null };
    }
    
    if (typeof expirationDays !== 'number' || 
        expirationDays < 1 || 
        expirationDays > 3650) {
      return { isValid: false, error: 'expires_in_days must be a number between 1 and 3650 days' };
    }
    
    return { isValid: true, sanitizedDays: expirationDays };
  }

  sanitizeCreateKeyRequest(request: any) {
    const errors: string[] = [];
    const sanitized: any = {};

    // Validate and sanitize name
    if (!request.name || typeof request.name !== 'string') {
      errors.push('name is required and must be a string');
    } else {
      try {
        const sanitizedName = this.sanitizeString(request.name, 100);
        if (!sanitizedName || sanitizedName.length < 3) {
          errors.push('name must be at least 3 characters long after sanitization');
        } else {
          sanitized.name = sanitizedName;
        }
      } catch (e) {
        errors.push('name contains invalid characters');
      }
    }

    // Validate and sanitize permissions
    const permissionResult = this.validatePermissions(request.permissions);
    if (!permissionResult.isValid) {
      errors.push(permissionResult.error!);
    } else {
      sanitized.permissions = permissionResult.sanitizedPermissions;
    }

    // Validate and sanitize rate limit
    const rateLimit = request.rate_limit ?? 500;
    const rateLimitResult = this.validateRateLimit(rateLimit);
    if (!rateLimitResult.isValid) {
      errors.push(rateLimitResult.error!);
    } else {
      sanitized.rate_limit = rateLimitResult.sanitizedRateLimit;
    }

    // Validate and sanitize expiration
    const expirationResult = this.validateExpirationDays(request.expires_in_days);
    if (!expirationResult.isValid) {
      errors.push(expirationResult.error!);
    } else {
      sanitized.expires_in_days = expirationResult.sanitizedDays;
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: errors.length === 0 ? sanitized : null
    };
  }
}

describe('Input Sanitization Unit Tests', () => {
  let sanitizer: InputSanitizer;

  beforeEach(() => {
    sanitizer = new InputSanitizer();
  });

  describe('String Sanitization', () => {
    it('should remove dangerous characters from strings', async () => {
      // Arrange
      const dangerousStrings = [
        { input: '<script>alert("xss")</script>', expected: 'scriptalert(xss)/script' },
        { input: 'Hello "world"', expected: 'Hello world' },
        { input: "O'Reilly & Associates", expected: 'OReilly  Associates' },
        { input: '<img src="x" onerror="alert(1)">', expected: 'img src=x onerror=alert(1)' },
        { input: 'Normal text', expected: 'Normal text' }
      ];

      // Act & Assert
      for (const testCase of dangerousStrings) {
        const result = sanitizer.sanitizeString(testCase.input);
        expect(result).toBe(testCase.expected);
      }
    });

    it('should trim whitespace from strings', async () => {
      // Arrange
      const testCases = [
        { input: '  hello  ', expected: 'hello' },
        { input: '\n\ttab and newline\r\n', expected: 'tab and newline' },
        { input: '   ', expected: '' },
        { input: 'no-whitespace', expected: 'no-whitespace' }
      ];

      // Act & Assert
      for (const testCase of testCases) {
        const result = sanitizer.sanitizeString(testCase.input);
        expect(result).toBe(testCase.expected);
      }
    });

    it('should enforce maximum length limits', async () => {
      // Arrange
      const longString = 'a'.repeat(1000);
      
      // Act
      const result50 = sanitizer.sanitizeString(longString, 50);
      const result100 = sanitizer.sanitizeString(longString, 100);
      const resultDefault = sanitizer.sanitizeString(longString); // Default 255

      // Assert
      expect(result50).toHaveLength(50);
      expect(result100).toHaveLength(100);
      expect(resultDefault).toHaveLength(255);
      expect(result50).toBe('a'.repeat(50));
      expect(result100).toBe('a'.repeat(100));
      expect(resultDefault).toBe('a'.repeat(255));
    });

    it('should handle XSS payloads correctly', async () => {
      // Arrange
      const xssPayloads = SecurityTestHelper.generateXSSPayloads();

      // Act & Assert
      for (const payload of xssPayloads) {
        const sanitized = sanitizer.sanitizeString(payload);
        
        // Should not contain dangerous characters
        expect(sanitized).not.toMatch(/[<>"'&]/);
        
        // Should not contain script tags
        expect(sanitized.toLowerCase()).not.toContain('script');
        expect(sanitized.toLowerCase()).not.toContain('onerror');
        expect(sanitized.toLowerCase()).not.toContain('javascript:');
      }
    });

    it('should reject non-string inputs', async () => {
      // Arrange
      const nonStringInputs = [
        123,
        true,
        null,
        undefined,
        {},
        [],
        Symbol('test')
      ];

      // Act & Assert
      for (const input of nonStringInputs) {
        expect(() => sanitizer.sanitizeString(input as any))
          .toThrow('Input must be a string');
      }
    });

    it('should handle Unicode characters safely', async () => {
      // Arrange
      const unicodeStrings = [
        '🔥 Fire emoji',
        'Café résumé naïve',
        '测试中文字符',
        '🚀💥⭐',
        'Mixed ASCII and 中文 and emoji 🎉'
      ];

      // Act & Assert
      for (const unicodeString of unicodeStrings) {
        const result = sanitizer.sanitizeString(unicodeString);
        
        // Should preserve Unicode characters (only removes <>"'&)
        expect(result).toBe(unicodeString); // No dangerous chars to remove
        expect(result.length).toBeLessThanOrEqual(255);
      }
    });
  });

  describe('Permissions Validation', () => {
    it('should validate correct permissions arrays', async () => {
      // Arrange
      const validPermissions = [
        ['deals:read'],
        ['deals:read', 'contacts:write'],
        ['deals:read', 'deals:write', 'deals:delete'],
        ['analytics:read'],
        ['admin:read', 'admin:write']
      ];

      // Act & Assert
      for (const permissions of validPermissions) {
        const result = sanitizer.validatePermissions(permissions);
        
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.sanitizedPermissions).toEqual(permissions);
      }
    });

    it('should reject invalid permission formats', async () => {
      // Arrange
      const invalidPermissions = [
        ['deals:invalid'],
        ['invalid_module:read'],
        ['deals:read', 'contacts:invalid'],
        [''],
        ['deals:read:extra'],
        ['DEALS:READ'], // Wrong case (should be lowercase after sanitization)
      ];

      // Act & Assert
      for (const permissions of invalidPermissions) {
        const result = sanitizer.validatePermissions(permissions);
        
        if (permissions[0] === 'DEALS:READ') {
          // This should actually be valid after lowercasing
          expect(result.isValid).toBe(true);
          expect(result.sanitizedPermissions).toEqual(['deals:read']);
        } else {
          expect(result.isValid).toBe(false);
          expect(result.error).toBeDefined();
        }
      }
    });

    it('should handle case sensitivity and normalization', async () => {
      // Arrange
      const caseVariations = [
        ['Deals:Read', 'CONTACTS:WRITE'],
        ['  deals:read  ', ' contacts:write '],
        ['DeAlS:rEaD']
      ];

      // Act & Assert
      for (const permissions of caseVariations) {
        const result = sanitizer.validatePermissions(permissions);
        
        expect(result.isValid).toBe(true);
        expect(result.sanitizedPermissions).toEqual(['deals:read', 'contacts:write']);
      }
    });

    it('should deduplicate permissions', async () => {
      // Arrange
      const duplicatePermissions = [
        'deals:read',
        'deals:read', // Duplicate
        'contacts:write',
        'DEALS:READ', // Duplicate after lowercasing
        ' deals:read ' // Duplicate after trimming
      ];

      // Act
      const result = sanitizer.validatePermissions(duplicatePermissions);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.sanitizedPermissions).toHaveLength(2);
      expect(result.sanitizedPermissions).toEqual(['deals:read', 'contacts:write']);
    });

    it('should reject empty or invalid permission arrays', async () => {
      // Arrange
      const invalidArrays = [
        [],
        null,
        undefined,
        'not-an-array',
        [123, 'deals:read'], // Mixed types
        Array(25).fill('deals:read'), // Too many permissions
      ];

      // Act & Assert
      for (const permissions of invalidArrays) {
        const result = sanitizer.validatePermissions(permissions as any);
        
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should validate all available permission types', async () => {
      // Arrange
      const allValidPermissions = [
        'deals:read', 'deals:write', 'deals:delete',
        'contacts:read', 'contacts:write', 'contacts:delete',
        'activities:read', 'activities:write', 'activities:delete',
        'analytics:read', 'admin:read', 'admin:write'
      ];

      // Act
      const result = sanitizer.validatePermissions(allValidPermissions);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.sanitizedPermissions).toEqual(allValidPermissions);
      expect(result.sanitizedPermissions).toHaveLength(12);
    });
  });

  describe('Rate Limit Validation', () => {
    it('should validate correct rate limits', async () => {
      // Arrange
      const validRateLimits = [1, 100, 500, 1000, 5000, 10000];

      // Act & Assert
      for (const rateLimit of validRateLimits) {
        const result = sanitizer.validateRateLimit(rateLimit);
        
        expect(result.isValid).toBe(true);
        expect(result.sanitizedRateLimit).toBe(rateLimit);
        expect(result.error).toBeUndefined();
      }
    });

    it('should reject invalid rate limits', async () => {
      // Arrange
      const invalidRateLimits = [
        0, -1, -100, // Too low
        10001, 50000, 999999, // Too high
        1.5, 500.7, // Decimals
        NaN, Infinity, -Infinity, // Special numbers
        '500', 'high', null, undefined, // Wrong types
      ];

      // Act & Assert
      for (const rateLimit of invalidRateLimits) {
        const result = sanitizer.validateRateLimit(rateLimit as any);
        
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('rate_limit must be a number between 1 and 10000');
      }
    });

    it('should handle edge case numbers', async () => {
      // Arrange
      const edgeCases = [
        { input: 1, shouldPass: true }, // Minimum
        { input: 10000, shouldPass: true }, // Maximum
        { input: 0.9, shouldPass: false }, // Just below minimum
        { input: 10000.1, shouldPass: false }, // Just above maximum
      ];

      // Act & Assert
      for (const testCase of edgeCases) {
        const result = sanitizer.validateRateLimit(testCase.input);
        
        expect(result.isValid).toBe(testCase.shouldPass);
        if (testCase.shouldPass) {
          expect(result.sanitizedRateLimit).toBe(testCase.input);
        } else {
          expect(result.error).toBeDefined();
        }
      }
    });
  });

  describe('Expiration Days Validation', () => {
    it('should validate correct expiration days', async () => {
      // Arrange
      const validExpirations = [
        null, // Never expires
        1, 30, 90, 365, 3650
      ];

      // Act & Assert
      for (const expiration of validExpirations) {
        const result = sanitizer.validateExpirationDays(expiration);
        
        expect(result.isValid).toBe(true);
        expect(result.sanitizedDays).toBe(expiration);
        expect(result.error).toBeUndefined();
      }
    });

    it('should reject invalid expiration days', async () => {
      // Arrange
      const invalidExpirations = [
        0, -1, -30, // Too low
        3651, 10000, // Too high
        1.5, 30.7, // Decimals
        NaN, Infinity, // Special numbers
        '30', 'month', // Wrong types
      ];

      // Act & Assert
      for (const expiration of invalidExpirations) {
        const result = sanitizer.validateExpirationDays(expiration as any);
        
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('expires_in_days must be a number between 1 and 3650 days');
      }
    });

    it('should handle null and undefined correctly', async () => {
      // Act
      const nullResult = sanitizer.validateExpirationDays(null);
      const undefinedResult = sanitizer.validateExpirationDays(undefined);

      // Assert
      expect(nullResult.isValid).toBe(true);
      expect(nullResult.sanitizedDays).toBeNull();
      
      expect(undefinedResult.isValid).toBe(true);
      expect(undefinedResult.sanitizedDays).toBeNull();
    });
  });

  describe('Complete Request Sanitization', () => {
    it('should sanitize valid create key requests', async () => {
      // Arrange
      const validRequest = {
        name: '  My API Key  ',
        permissions: ['DEALS:READ', ' contacts:write '],
        rate_limit: 500,
        expires_in_days: 90
      };

      // Act
      const result = sanitizer.sanitizeCreateKeyRequest(validRequest);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitized).toEqual({
        name: 'My API Key',
        permissions: ['deals:read', 'contacts:write'],
        rate_limit: 500,
        expires_in_days: 90
      });
    });

    it('should handle requests with default values', async () => {
      // Arrange
      const minimalRequest = {
        name: 'Test Key',
        permissions: ['deals:read']
        // rate_limit will default to 500
        // expires_in_days will default to null
      };

      // Act
      const result = sanitizer.sanitizeCreateKeyRequest(minimalRequest);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.sanitized.rate_limit).toBe(500);
      expect(result.sanitized.expires_in_days).toBeNull();
    });

    it('should collect multiple validation errors', async () => {
      // Arrange
      const invalidRequest = {
        name: '', // Invalid: empty
        permissions: ['invalid:permission'], // Invalid: wrong permission
        rate_limit: -1, // Invalid: too low
        expires_in_days: 10000 // Invalid: too high
      };

      // Act
      const result = sanitizer.sanitizeCreateKeyRequest(invalidRequest);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(4);
      expect(result.sanitized).toBeNull();
    });

    it('should handle malicious input attempts', async () => {
      // Arrange
      const maliciousRequest = {
        name: '<script>alert("xss")</script>',
        permissions: ['deals:read; DROP TABLE api_keys; --'],
        rate_limit: 'Infinity',
        expires_in_days: '999999 OR 1=1'
      };

      // Act
      const result = sanitizer.sanitizeCreateKeyRequest(maliciousRequest);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Should not contain dangerous content
      if (result.sanitized?.name) {
        expect(result.sanitized.name).not.toMatch(/[<>"'&]/);
      }
    });

    it('should handle missing required fields', async () => {
      // Arrange
      const incompleteRequests = [
        {}, // Missing everything
        { name: 'Test' }, // Missing permissions
        { permissions: ['deals:read'] }, // Missing name
        { name: null, permissions: ['deals:read'] }, // Null name
        { name: 'Test', permissions: null }, // Null permissions
      ];

      // Act & Assert
      for (const request of incompleteRequests) {
        const result = sanitizer.sanitizeCreateKeyRequest(request);
        
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.sanitized).toBeNull();
      }
    });

    it('should handle extremely large payloads', async () => {
      // Arrange
      const hugeRequest = {
        name: 'x'.repeat(10000),
        permissions: Array(100).fill('deals:read'),
        rate_limit: 500,
        expires_in_days: 90
      };

      // Act
      const result = sanitizer.sanitizeCreateKeyRequest(hugeRequest);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Too many permissions specified (maximum 20)');
      
      // Name should be truncated
      if (result.errors.length === 1) { // Only the permissions error
        expect(result.sanitized).toBeNull(); // Should be null due to invalid permissions
      }
    });
  });

  describe('Performance Tests', () => {
    it('should sanitize input efficiently', async () => {
      // Arrange
      const request = {
        name: 'Performance Test Key',
        permissions: ['deals:read', 'contacts:write'],
        rate_limit: 1000,
        expires_in_days: 30
      };

      // Act
      const iterations = 1000;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        sanitizer.sanitizeCreateKeyRequest(request);
      }
      
      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      // Assert
      expect(averageTime).toBeLessThan(1); // Should be under 1ms per sanitization
    });

    it('should handle concurrent sanitization requests', async () => {
      // Arrange
      const request = {
        name: 'Concurrent Test Key',
        permissions: ['deals:read'],
        rate_limit: 500
      };

      // Act
      const concurrentPromises = Array.from({ length: 100 }, () => 
        Promise.resolve(sanitizer.sanitizeCreateKeyRequest(request))
      );

      const results = await Promise.all(concurrentPromises);

      // Assert
      results.forEach(result => {
        expect(result.isValid).toBe(true);
        expect(result.sanitized.name).toBe('Concurrent Test Key');
      });
    });
  });
});