import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockJWT, mockSupabaseResponse, commonErrors } from '../setup';
import { SecurityTestHelper, ValidationTestHelper, TestDataGenerator } from '../utils/testHelpers';

// Mock the Edge Function JWT validation logic
class JWTValidator {
  constructor(private supabaseClient: any) {}

  async verifyJWTToken(token: string): Promise<{ userId: string; error?: string }> {
    try {
      // Use Supabase's secure JWT verification
      const { data: { user }, error: authError } = await this.supabaseClient.auth.getUser(token);
      
      if (authError || !user) {
        return { userId: '', error: 'Invalid or expired token' };
      }
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(user.id)) {
        return { userId: '', error: 'Invalid user ID format' };
      }
      
      return { userId: user.id };
    } catch (e) {
      return { userId: '', error: 'Token verification failed' };
    }
  }
}

describe('JWT Validation Unit Tests', () => {
  let mockSupabaseClient: any;
  let jwtValidator: JWTValidator;

  beforeEach(() => {
    mockSupabaseClient = {
      auth: {
        getUser: vi.fn()
      }
    };
    jwtValidator = new JWTValidator(mockSupabaseClient);
  });

  describe('Valid JWT Tokens', () => {
    it('should successfully validate a valid JWT token', async () => {
      // Arrange
      const validUserId = TestDataGenerator.randomUUID();
      const validToken = createMockJWT({ sub: validUserId });
      
      mockSupabaseClient.auth.getUser.mockResolvedValue(
        mockSupabaseResponse({ user: { id: validUserId, email: 'test@example.com' } })
      );

      // Act
      const result = await jwtValidator.verifyJWTToken(validToken);

      // Assert
      expect(result.error).toBeUndefined();
      expect(result.userId).toBe(validUserId);
      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledWith(validToken);
    });

    it('should validate JWT with different payload structures', async () => {
      // Arrange
      const validUserId = TestDataGenerator.randomUUID();
      const tokenWithExtraData = createMockJWT({ 
        sub: validUserId,
        email: 'test@example.com',
        role: 'user',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600
      });
      
      mockSupabaseClient.auth.getUser.mockResolvedValue(
        mockSupabaseResponse({ user: { id: validUserId, email: 'test@example.com' } })
      );

      // Act
      const result = await jwtValidator.verifyJWTToken(tokenWithExtraData);

      // Assert
      expect(result.error).toBeUndefined();
      expect(result.userId).toBe(validUserId);
    });

    it('should handle tokens with minimum required fields', async () => {
      // Arrange
      const validUserId = TestDataGenerator.randomUUID();
      const minimalToken = createMockJWT({ sub: validUserId });
      
      mockSupabaseClient.auth.getUser.mockResolvedValue(
        mockSupabaseResponse({ user: { id: validUserId } })
      );

      // Act
      const result = await jwtValidator.verifyJWTToken(minimalToken);

      // Assert
      expect(result.error).toBeUndefined();
      expect(result.userId).toBe(validUserId);
    });
  });

  describe('Invalid JWT Tokens', () => {
    it('should reject completely malformed tokens', async () => {
      // Arrange
      const invalidTokens = SecurityTestHelper.generateInvalidJWT();

      // Act & Assert
      for (const token of invalidTokens) {
        mockSupabaseClient.auth.getUser.mockResolvedValue(
          mockSupabaseResponse(null, commonErrors.INVALID_TOKEN)
        );

        const result = await jwtValidator.verifyJWTToken(token);
        
        expect(result.error).toBeDefined();
        expect(result.userId).toBe('');
      }
    });

    it('should reject empty or null tokens', async () => {
      // Arrange
      const emptyTokens = ['', ' ', null, undefined];

      // Act & Assert
      for (const token of emptyTokens) {
        mockSupabaseClient.auth.getUser.mockResolvedValue(
          mockSupabaseResponse(null, commonErrors.INVALID_TOKEN)
        );

        const result = await jwtValidator.verifyJWTToken(token as any);
        
        expect(result.error).toBeDefined();
        expect(result.userId).toBe('');
      }
    });

    it('should reject tokens with invalid user ID format', async () => {
      // Arrange
      const invalidUserIds = [
        'not-a-uuid',
        '123',
        'user-id-too-short',
        '12345678-1234-1234-1234-12345678901', // Too short
        '12345678-1234-1234-1234-1234567890123', // Too long
        '12345678-1234-6234-1234-123456789012', // Invalid version number
        '12345678-1234-1234-c234-123456789012', // Invalid variant
      ];

      for (const invalidUserId of invalidUserIds) {
        const token = createMockJWT({ sub: invalidUserId });
        
        mockSupabaseClient.auth.getUser.mockResolvedValue(
          mockSupabaseResponse({ user: { id: invalidUserId } })
        );

        // Act
        const result = await jwtValidator.verifyJWTToken(token);

        // Assert
        expect(result.error).toBe('Invalid user ID format');
        expect(result.userId).toBe('');
      }
    });

    it('should handle Supabase auth errors gracefully', async () => {
      // Arrange
      const token = createMockJWT();
      const authErrors = [
        { message: 'JWT expired' },
        { message: 'Invalid signature' },
        { message: 'User not found' },
        { message: 'Token malformed' }
      ];

      for (const authError of authErrors) {
        mockSupabaseClient.auth.getUser.mockResolvedValue(
          mockSupabaseResponse(null, authError)
        );

        // Act
        const result = await jwtValidator.verifyJWTToken(token);

        // Assert
        expect(result.error).toBe('Invalid or expired token');
        expect(result.userId).toBe('');
      }
    });

    it('should handle network/connection errors', async () => {
      // Arrange
      const token = createMockJWT();
      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Network error'));

      // Act
      const result = await jwtValidator.verifyJWTToken(token);

      // Assert
      expect(result.error).toBe('Token verification failed');
      expect(result.userId).toBe('');
    });
  });

  describe('Token Format Validation', () => {
    it('should validate proper JWT structure (header.payload.signature)', async () => {
      // Arrange
      const validUserId = TestDataGenerator.randomUUID();
      const properJWT = createMockJWT({ sub: validUserId });
      
      // Verify it has three parts separated by dots
      expect(properJWT.split('.')).toHaveLength(3);

      mockSupabaseClient.auth.getUser.mockResolvedValue(
        mockSupabaseResponse({ user: { id: validUserId } })
      );

      // Act
      const result = await jwtValidator.verifyJWTToken(properJWT);

      // Assert
      expect(result.error).toBeUndefined();
      expect(result.userId).toBe(validUserId);
    });

    it('should reject JWT with missing parts', async () => {
      // Arrange
      const incompleteBJTs = [
        'header.payload', // Missing signature
        'header', // Missing payload and signature
        '.payload.signature', // Missing header
        'header..signature', // Missing payload
        'header.payload.', // Empty signature
      ];

      for (const incompleteJWT of incompleteBJTs) {
        mockSupabaseClient.auth.getUser.mockResolvedValue(
          mockSupabaseResponse(null, commonErrors.INVALID_TOKEN)
        );

        // Act
        const result = await jwtValidator.verifyJWTToken(incompleteJWT);

        // Assert
        expect(result.error).toBeDefined();
        expect(result.userId).toBe('');
      }
    });

    it('should reject JWT with too many parts', async () => {
      // Arrange
      const oversizedJWT = 'header.payload.signature.extra.parts';
      
      mockSupabaseClient.auth.getUser.mockResolvedValue(
        mockSupabaseResponse(null, commonErrors.INVALID_TOKEN)
      );

      // Act
      const result = await jwtValidator.verifyJWTToken(oversizedJWT);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.userId).toBe('');
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle extremely long tokens', async () => {
      // Arrange
      const veryLongToken = 'a'.repeat(10000);
      
      mockSupabaseClient.auth.getUser.mockResolvedValue(
        mockSupabaseResponse(null, commonErrors.INVALID_TOKEN)
      );

      // Act
      const result = await jwtValidator.verifyJWTToken(veryLongToken);

      // Assert
      expect(result.error).toBeDefined();
      expect(result.userId).toBe('');
    });

    it('should handle tokens with special characters', async () => {
      // Arrange
      const specialCharTokens = [
        'header.payload.signature\n',
        'header.payload.signature\r',
        'header.payload.signature\t',
        'header.payload.signature\x00',
        'header.payload.signature\u2028',
      ];

      for (const specialToken of specialCharTokens) {
        mockSupabaseClient.auth.getUser.mockResolvedValue(
          mockSupabaseResponse(null, commonErrors.INVALID_TOKEN)
        );

        // Act
        const result = await jwtValidator.verifyJWTToken(specialToken);

        // Assert
        expect(result.error).toBeDefined();
        expect(result.userId).toBe('');
      }
    });

    it('should validate UUID format strictly', async () => {
      // Arrange
      const validToken = createMockJWT();
      const testCases = [
        { userId: TestDataGenerator.randomUUID(), shouldPass: true },
        { userId: TestDataGenerator.randomUUID().toUpperCase(), shouldPass: true }, // Uppercase should work
        { userId: TestDataGenerator.randomUUID().toLowerCase(), shouldPass: true }, // Lowercase should work
        { userId: 'not-a-uuid-at-all', shouldPass: false },
        { userId: '12345678-1234-1234-1234-123456789012', shouldPass: true }, // Valid format
        { userId: '12345678-1234-5234-a234-123456789012', shouldPass: true }, // Valid variant
      ];

      for (const testCase of testCases) {
        mockSupabaseClient.auth.getUser.mockResolvedValue(
          mockSupabaseResponse({ user: { id: testCase.userId } })
        );

        // Act
        const result = await jwtValidator.verifyJWTToken(validToken);

        // Assert
        if (testCase.shouldPass) {
          expect(result.error).toBeUndefined();
          expect(result.userId).toBe(testCase.userId);
        } else {
          expect(result.error).toBe('Invalid user ID format');
          expect(result.userId).toBe('');
        }
      }
    });
  });

  describe('Performance Tests', () => {
    it('should validate tokens efficiently under normal load', async () => {
      // Arrange
      const validUserId = TestDataGenerator.randomUUID();
      const validToken = createMockJWT({ sub: validUserId });
      
      mockSupabaseClient.auth.getUser.mockResolvedValue(
        mockSupabaseResponse({ user: { id: validUserId } })
      );

      // Act & Measure
      const iterations = 100;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        await jwtValidator.verifyJWTToken(validToken);
      }
      
      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      // Assert
      expect(averageTime).toBeLessThan(10); // Should be under 10ms per validation
    });

    it('should handle concurrent token validations', async () => {
      // Arrange
      const validUserId = TestDataGenerator.randomUUID();
      const validToken = createMockJWT({ sub: validUserId });
      
      mockSupabaseClient.auth.getUser.mockResolvedValue(
        mockSupabaseResponse({ user: { id: validUserId } })
      );

      // Act
      const concurrentPromises = Array.from({ length: 50 }, () => 
        jwtValidator.verifyJWTToken(validToken)
      );

      const results = await Promise.all(concurrentPromises);

      // Assert
      results.forEach(result => {
        expect(result.error).toBeUndefined();
        expect(result.userId).toBe(validUserId);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Supabase client being null/undefined', async () => {
      // Arrange
      const nullValidator = new JWTValidator(null as any);
      const undefinedValidator = new JWTValidator(undefined as any);
      const token = createMockJWT();

      // Act & Assert
      const nullResult = await nullValidator.verifyJWTToken(token);
      expect(nullResult.error).toBe('Token verification failed');
      
      const undefinedResult = await undefinedValidator.verifyJWTToken(token);
      expect(undefinedResult.error).toBe('Token verification failed');
    });

    it('should handle malformed auth responses', async () => {
      // Arrange
      const token = createMockJWT();
      const malformedResponses = [
        mockSupabaseResponse(null), // No user, no error
        mockSupabaseResponse({ user: null }), // Explicit null user
        mockSupabaseResponse({ user: {} }), // User without ID
        mockSupabaseResponse({ user: { id: null } }), // Null ID
      ];

      for (const response of malformedResponses) {
        mockSupabaseClient.auth.getUser.mockResolvedValue(response);

        // Act
        const result = await jwtValidator.verifyJWTToken(token);

        // Assert
        expect(result.error).toBeDefined();
        expect(result.userId).toBe('');
      }
    });

    it('should handle timeout scenarios', async () => {
      // Arrange
      const token = createMockJWT();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 100)
      );
      
      mockSupabaseClient.auth.getUser.mockReturnValue(timeoutPromise);

      // Act
      const result = await jwtValidator.verifyJWTToken(token);

      // Assert
      expect(result.error).toBe('Token verification failed');
      expect(result.userId).toBe('');
    });
  });
});