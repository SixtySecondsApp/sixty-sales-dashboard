import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import { createMockJWT, mockSupabaseResponse, createMockApiKey, commonErrors } from '../setup';
import { 
  APITestHelper, 
  DatabaseTestHelper, 
  RateLimitTestHelper, 
  TestDataGenerator,
  AsyncTestHelper
} from '../utils/testHelpers';

// Mock the complete Edge Function flow
class EdgeFunctionService {
  private supabaseClient: any;
  private rateLimitStore: Map<string, { count: number; resetTime: number }>;

  constructor(supabaseClient: any) {
    this.supabaseClient = supabaseClient;
    this.rateLimitStore = new Map();
  }

  // Complete Edge Function handler simulation
  async handleCreateApiKey(request: Request): Promise<Response> {
    try {
      // CORS handling
      if (request.method === 'OPTIONS') {
        return new Response('ok', {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
          }
        });
      }

      // Method validation
      if (request.method !== 'POST') {
        return this.createErrorResponse('Method not allowed', 405, 'Only POST method is supported');
      }

      // Rate limiting
      const clientId = this.getClientId(request);
      if (!this.checkRateLimit(clientId, 5, 60000)) {
        return this.createErrorResponse('Rate limit exceeded', 429, 'Too many requests');
      }

      // JWT validation
      const authResult = await this.validateAuth(request);
      if (!authResult.success) {
        return this.createErrorResponse('Authentication failed', 401, authResult.error);
      }

      // Parse and validate request body
      const body = await request.json();
      const validationResult = this.validateRequestBody(body);
      if (!validationResult.isValid) {
        return this.createErrorResponse('Validation failed', 400, validationResult.errors.join(', '));
      }

      // Generate and store API key
      const apiKeyResult = await this.createAndStoreApiKey(authResult.userId, validationResult.sanitized);
      if (!apiKeyResult.success) {
        return this.createErrorResponse('Failed to create API key', 500, apiKeyResult.error);
      }

      // Return success response
      return new Response(JSON.stringify({
        message: 'API key created successfully',
        api_key: apiKeyResult.apiKey,
        key_data: apiKeyResult.keyData
      }), {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (error: any) {
      return this.createErrorResponse('Internal server error', 500, error.message);
    }
  }

  private createErrorResponse(error: string, status: number, details?: string): Response {
    return new Response(JSON.stringify({
      error,
      details,
      timestamp: new Date().toISOString()
    }), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  private getClientId(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipAddress = forwarded?.split(',')[0] || realIp || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    return `${ipAddress}-${userAgent.slice(0, 50)}`;
  }

  private checkRateLimit(clientId: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const clientData = this.rateLimitStore.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      this.rateLimitStore.set(clientId, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (clientData.count >= limit) {
      return false;
    }
    
    clientData.count++;
    return true;
  }

  private async validateAuth(request: Request): Promise<{ success: boolean; userId?: string; error?: string }> {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return { success: false, error: 'Authorization header is missing' };
    }

    if (!authHeader.startsWith('Bearer ')) {
      return { success: false, error: 'Invalid authorization format' };
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
      const { data: { user }, error } = await this.supabaseClient.auth.getUser(token);
      
      if (error || !user) {
        return { success: false, error: 'Invalid or expired token' };
      }

      return { success: true, userId: user.id };
    } catch (error: any) {
      return { success: false, error: 'Token verification failed' };
    }
  }

  private validateRequestBody(body: any): { isValid: boolean; errors: string[]; sanitized?: any } {
    const errors: string[] = [];
    const sanitized: any = {};

    // Validate name
    if (!body.name || typeof body.name !== 'string') {
      errors.push('name is required and must be a string');
    } else {
      const sanitizedName = body.name.trim().replace(/[<>\"'&]/g, '').slice(0, 100);
      if (sanitizedName.length < 3) {
        errors.push('name must be at least 3 characters long');
      } else {
        sanitized.name = sanitizedName;
      }
    }

    // Validate permissions
    if (!body.permissions || !Array.isArray(body.permissions)) {
      errors.push('permissions is required and must be an array');
    } else {
      const validPermissions = ['deals:read', 'deals:write', 'contacts:read', 'contacts:write', 'activities:read'];
      const sanitizedPermissions = body.permissions
        .filter((p: any) => typeof p === 'string' && validPermissions.includes(p.toLowerCase()))
        .map((p: string) => p.toLowerCase());
      
      if (sanitizedPermissions.length === 0) {
        errors.push('At least one valid permission is required');
      } else {
        sanitized.permissions = sanitizedPermissions;
      }
    }

    // Validate rate limit
    const rateLimit = body.rate_limit ?? 500;
    if (typeof rateLimit !== 'number' || rateLimit < 1 || rateLimit > 10000) {
      errors.push('rate_limit must be a number between 1 and 10000');
    } else {
      sanitized.rate_limit = rateLimit;
    }

    // Validate expiration
    if (body.expires_in_days !== undefined && body.expires_in_days !== null) {
      if (typeof body.expires_in_days !== 'number' || body.expires_in_days < 1 || body.expires_in_days > 3650) {
        errors.push('expires_in_days must be a number between 1 and 3650 days');
      } else {
        sanitized.expires_in_days = body.expires_in_days;
      }
    } else {
      sanitized.expires_in_days = null;
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: errors.length === 0 ? sanitized : undefined
    };
  }

  private async createAndStoreApiKey(userId: string, data: any): Promise<{ success: boolean; apiKey?: string; keyData?: any; error?: string }> {
    try {
      // Generate API key
      const { data: apiKey, error: keyGenError } = await this.supabaseClient.rpc('generate_api_key', { user_uuid: userId });
      
      if (keyGenError || !apiKey) {
        return { success: false, error: 'Failed to generate API key' };
      }

      // Hash the key
      const { data: hashedKey, error: hashError } = await this.supabaseClient.rpc('hash_api_key', { key_text: apiKey });
      
      if (hashError || !hashedKey) {
        return { success: false, error: 'Failed to hash API key' };
      }

      // Store in database
      const keyPreview = `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`;
      const expiresAt = data.expires_in_days 
        ? new Date(Date.now() + data.expires_in_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data: dbResult, error: dbError } = await this.supabaseClient
        .from('api_keys')
        .insert({
          user_id: userId,
          name: data.name,
          key_hash: hashedKey,
          key_preview: keyPreview,
          permissions: data.permissions,
          rate_limit: data.rate_limit,
          expires_at: expiresAt,
          is_active: true,
          usage_count: 0
        })
        .select()
        .single();

      if (dbError) {
        return { success: false, error: `Database error: ${dbError.message}` };
      }

      return {
        success: true,
        apiKey,
        keyData: {
          id: dbResult.id,
          name: dbResult.name,
          key_preview: dbResult.key_preview,
          permissions: dbResult.permissions,
          rate_limit: dbResult.rate_limit,
          expires_at: dbResult.expires_at,
          created_at: dbResult.created_at
        }
      };
    } catch (error: any) {
      return { success: false, error: `Unexpected error: ${error.message}` };
    }
  }
}

describe('Edge Function Integration Tests', () => {
  let edgeFunction: EdgeFunctionService;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = DatabaseTestHelper.createMockSupabaseClient();
    edgeFunction = new EdgeFunctionService(mockSupabase);
  });

  describe('Complete API Key Creation Flow', () => {
    it('should successfully create API key with valid input', async () => {
      // Arrange
      const userId = TestDataGenerator.randomUUID();
      const validToken = createMockJWT({ sub: userId });
      const validRequest = {
        name: 'Test API Key',
        permissions: ['deals:read', 'contacts:read'],
        rate_limit: 1000,
        expires_in_days: 90
      };

      const request = APITestHelper.createMockRequest('POST', validRequest, {
        'Authorization': `Bearer ${validToken}`
      });

      // Mock Supabase responses
      mockSupabase.auth.getUser.mockResolvedValue(
        mockSupabaseResponse({ user: { id: userId, email: 'test@example.com' } })
      );
      
      mockSupabase.rpc
        .mockResolvedValueOnce(mockSupabaseResponse('ak_test_1234567890abcdef')) // generate_api_key
        .mockResolvedValueOnce(mockSupabaseResponse('hashed_key_12345')); // hash_api_key

      const mockKeyData = createMockApiKey({
        id: 'key-id-123',
        name: 'Test API Key',
        user_id: userId,
        permissions: ['deals:read', 'contacts:read'],
        rate_limit: 1000
      });

      mockSupabase.from().insert().select().single.mockResolvedValue(mockSupabaseResponse(mockKeyData));

      // Act
      const response = await edgeFunction.handleCreateApiKey(request);
      const result = await APITestHelper.parseResponse(response);

      // Assert
      expect(response.status).toBe(201);
      expect(result.message).toBe('API key created successfully');
      expect(result.api_key).toBe('ak_test_1234567890abcdef');
      expect(result.key_data).toBeDefined();
      expect(result.key_data.id).toBe('key-id-123');
      expect(result.key_data.permissions).toEqual(['deals:read', 'contacts:read']);
    });

    it('should handle the complete flow with edge cases', async () => {
      // Arrange
      const userId = TestDataGenerator.randomUUID();
      const validToken = createMockJWT({ sub: userId });
      const edgeCaseRequest = {
        name: '  Edge Case Key  ', // With whitespace
        permissions: ['DEALS:READ', 'contacts:write '], // Mixed case and whitespace
        rate_limit: 1, // Minimum
        expires_in_days: 3650 // Maximum
      };

      const request = APITestHelper.createMockRequest('POST', edgeCaseRequest, {
        'Authorization': `Bearer ${validToken}`
      });

      // Mock responses
      mockSupabase.auth.getUser.mockResolvedValue(mockSupabaseResponse({ user: { id: userId } }));
      mockSupabase.rpc
        .mockResolvedValueOnce(mockSupabaseResponse('ak_edge_case_key'))
        .mockResolvedValueOnce(mockSupabaseResponse('hashed_edge_case'));

      const mockKeyData = createMockApiKey({
        name: 'Edge Case Key', // Should be trimmed
        permissions: ['deals:read', 'contacts:write'], // Should be normalized
        rate_limit: 1
      });

      mockSupabase.from().insert().select().single.mockResolvedValue(mockSupabaseResponse(mockKeyData));

      // Act
      const response = await edgeFunction.handleCreateApiKey(request);
      const result = await APITestHelper.parseResponse(response);

      // Assert
      expect(response.status).toBe(201);
      expect(result.api_key).toBeDefined();
      expect(mockSupabase.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Edge Case Key',
          permissions: ['deals:read', 'contacts:write'],
          rate_limit: 1
        })
      );
    });

    it('should persist data correctly across the entire flow', async () => {
      // Arrange
      const userId = TestDataGenerator.randomUUID();
      const validToken = createMockJWT({ sub: userId });
      const request = APITestHelper.createMockRequest('POST', {
        name: 'Persistence Test Key',
        permissions: ['deals:read', 'activities:read'],
        rate_limit: 2000,
        expires_in_days: 30
      }, {
        'Authorization': `Bearer ${validToken}`
      });

      // Mock all stages
      mockSupabase.auth.getUser.mockResolvedValue(mockSupabaseResponse({ user: { id: userId } }));
      mockSupabase.rpc
        .mockResolvedValueOnce(mockSupabaseResponse('ak_persistence_test'))
        .mockResolvedValueOnce(mockSupabaseResponse('hashed_persistence'));

      mockSupabase.from().insert().select().single.mockResolvedValue(
        mockSupabaseResponse({
          id: 'persist-123',
          name: 'Persistence Test Key',
          key_preview: 'ak_persi...test',
          permissions: ['deals:read', 'activities:read'],
          rate_limit: 2000,
          expires_at: '2024-09-26T10:00:00.000Z',
          created_at: '2024-08-26T10:00:00.000Z'
        })
      );

      // Act
      const response = await edgeFunction.handleCreateApiKey(request);
      const result = await APITestHelper.parseResponse(response);

      // Assert - Verify complete data flow
      expect(response.status).toBe(201);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('generate_api_key', { user_uuid: userId });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('hash_api_key', { key_text: 'ak_persistence_test' });
      
      const insertCall = mockSupabase.from().insert.mock.calls[0][0];
      expect(insertCall).toMatchObject({
        user_id: userId,
        name: 'Persistence Test Key',
        key_hash: 'hashed_persistence',
        key_preview: 'ak_persi...test',
        permissions: ['deals:read', 'activities:read'],
        rate_limit: 2000,
        is_active: true,
        usage_count: 0
      });

      expect(result.key_data).toMatchObject({
        id: 'persist-123',
        name: 'Persistence Test Key',
        permissions: ['deals:read', 'activities:read'],
        rate_limit: 2000
      });
    });
  });

  describe('Error Flow Integration', () => {
    it('should handle authentication errors in the complete flow', async () => {
      // Arrange
      const request = APITestHelper.createMockRequest('POST', {
        name: 'Test Key',
        permissions: ['deals:read']
      }, {
        'Authorization': 'Bearer invalid_token'
      });

      mockSupabase.auth.getUser.mockResolvedValue(mockSupabaseResponse(null, commonErrors.INVALID_TOKEN));

      // Act
      const response = await edgeFunction.handleCreateApiKey(request);
      const result = await APITestHelper.parseResponse(response);

      // Assert
      expect(response.status).toBe(401);
      expect(result.error).toBe('Authentication failed');
      expect(result.details).toContain('Invalid or expired token');
      
      // Should not proceed to API key generation
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should handle validation errors without proceeding to creation', async () => {
      // Arrange
      const userId = TestDataGenerator.randomUUID();
      const validToken = createMockJWT({ sub: userId });
      const invalidRequest = {
        name: '', // Invalid name
        permissions: ['invalid:permission'], // Invalid permission
        rate_limit: -1 // Invalid rate limit
      };

      const request = APITestHelper.createMockRequest('POST', invalidRequest, {
        'Authorization': `Bearer ${validToken}`
      });

      mockSupabase.auth.getUser.mockResolvedValue(mockSupabaseResponse({ user: { id: userId } }));

      // Act
      const response = await edgeFunction.handleCreateApiKey(request);
      const result = await APITestHelper.parseResponse(response);

      // Assert
      expect(response.status).toBe(400);
      expect(result.error).toBe('Validation failed');
      expect(result.details).toContain('name must be at least 3 characters long');
      
      // Should not proceed to API key generation
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      const userId = TestDataGenerator.randomUUID();
      const validToken = createMockJWT({ sub: userId });
      const request = APITestHelper.createMockRequest('POST', {
        name: 'Test Key',
        permissions: ['deals:read']
      }, {
        'Authorization': `Bearer ${validToken}`
      });

      mockSupabase.auth.getUser.mockResolvedValue(mockSupabaseResponse({ user: { id: userId } }));
      mockSupabase.rpc
        .mockResolvedValueOnce(mockSupabaseResponse('ak_test_key'))
        .mockResolvedValueOnce(mockSupabaseResponse('hashed_key'));

      // Simulate database error
      mockSupabase.from().insert().select().single.mockResolvedValue(
        mockSupabaseResponse(null, commonErrors.TABLE_NOT_FOUND)
      );

      // Act
      const response = await edgeFunction.handleCreateApiKey(request);
      const result = await APITestHelper.parseResponse(response);

      // Assert
      expect(response.status).toBe(500);
      expect(result.error).toBe('Failed to create API key');
      expect(result.details).toContain('Database error');
    });

    it('should handle partial failures and maintain consistency', async () => {
      // Arrange
      const userId = TestDataGenerator.randomUUID();
      const validToken = createMockJWT({ sub: userId });
      const request = APITestHelper.createMockRequest('POST', {
        name: 'Partial Failure Test',
        permissions: ['deals:read']
      }, {
        'Authorization': `Bearer ${validToken}`
      });

      mockSupabase.auth.getUser.mockResolvedValue(mockSupabaseResponse({ user: { id: userId } }));
      mockSupabase.rpc
        .mockResolvedValueOnce(mockSupabaseResponse('ak_partial_test'))
        .mockResolvedValueOnce(mockSupabaseResponse(null, { message: 'Hash function failed' })); // Hash fails

      // Act
      const response = await edgeFunction.handleCreateApiKey(request);
      const result = await APITestHelper.parseResponse(response);

      // Assert
      expect(response.status).toBe(500);
      expect(result.error).toBe('Failed to create API key');
      expect(result.details).toBe('Failed to hash API key');
      
      // Database insert should not have been called due to hash failure
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should enforce rate limits across multiple requests', async () => {
      // Arrange
      const userId = TestDataGenerator.randomUUID();
      const validToken = createMockJWT({ sub: userId });
      const requestData = {
        name: 'Rate Limit Test',
        permissions: ['deals:read']
      };

      mockSupabase.auth.getUser.mockResolvedValue(mockSupabaseResponse({ user: { id: userId } }));

      // Act - Make requests up to rate limit (5)
      const responses: Response[] = [];
      for (let i = 0; i < 7; i++) {
        const request = APITestHelper.createMockRequest('POST', requestData, {
          'Authorization': `Bearer ${validToken}`,
          'X-Forwarded-For': '192.168.1.1',
          'User-Agent': 'test-agent'
        });

        responses.push(await edgeFunction.handleCreateApiKey(request));
      }

      // Assert
      const successCount = responses.filter(r => r.status === 201).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      expect(successCount).toBe(5); // First 5 should succeed
      expect(rateLimitedCount).toBe(2); // Last 2 should be rate limited
    });

    it('should handle rate limiting before authentication', async () => {
      // Arrange - Exhaust rate limit first
      for (let i = 0; i < 5; i++) {
        const request = APITestHelper.createMockRequest('POST', {}, {
          'X-Forwarded-For': '192.168.1.2',
          'User-Agent': 'exhausting-agent'
        });
        await edgeFunction.handleCreateApiKey(request);
      }

      // Act - Try with valid auth but exhausted rate limit
      const rateLimitedRequest = APITestHelper.createMockRequest('POST', {
        name: 'Should Be Blocked',
        permissions: ['deals:read']
      }, {
        'Authorization': `Bearer ${createMockJWT()}`,
        'X-Forwarded-For': '192.168.1.2',
        'User-Agent': 'exhausting-agent'
      });

      const response = await edgeFunction.handleCreateApiKey(rateLimitedRequest);
      const result = await APITestHelper.parseResponse(response);

      // Assert
      expect(response.status).toBe(429);
      expect(result.error).toBe('Rate limit exceeded');
      
      // Auth should not have been checked
      expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
    });
  });

  describe('CORS and Method Handling', () => {
    it('should handle OPTIONS requests for CORS', async () => {
      // Arrange
      const corsRequest = new Request('https://test.example.com', {
        method: 'OPTIONS'
      });

      // Act
      const response = await edgeFunction.handleCreateApiKey(corsRequest);

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('authorization');
    });

    it('should reject non-POST methods', async () => {
      // Arrange
      const methods = ['GET', 'PUT', 'DELETE', 'PATCH'];

      // Act & Assert
      for (const method of methods) {
        const request = new Request('https://test.example.com', { method });
        const response = await edgeFunction.handleCreateApiKey(request);
        const result = await APITestHelper.parseResponse(response);

        expect(response.status).toBe(405);
        expect(result.error).toBe('Method not allowed');
      }
    });
  });

  describe('End-to-End Error Scenarios', () => {
    it('should handle malformed JSON in request body', async () => {
      // Arrange
      const userId = TestDataGenerator.randomUUID();
      const validToken = createMockJWT({ sub: userId });
      
      const malformedRequest = new Request('https://test.example.com', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${validToken}`,
          'Content-Type': 'application/json'
        },
        body: '{invalid json'
      });

      mockSupabase.auth.getUser.mockResolvedValue(mockSupabaseResponse({ user: { id: userId } }));

      // Act
      const response = await edgeFunction.handleCreateApiKey(malformedRequest);
      const result = await APITestHelper.parseResponse(response);

      // Assert
      expect(response.status).toBe(500); // JSON parsing error
      expect(result.error).toBe('Internal server error');
    });

    it('should handle network timeouts gracefully', async () => {
      // Arrange
      const userId = TestDataGenerator.randomUUID();
      const validToken = createMockJWT({ sub: userId });
      const request = APITestHelper.createMockRequest('POST', {
        name: 'Timeout Test',
        permissions: ['deals:read']
      }, {
        'Authorization': `Bearer ${validToken}`
      });

      // Simulate timeout in auth check
      mockSupabase.auth.getUser.mockImplementation(() => 
        new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), 100))
      );

      // Act
      const response = await edgeFunction.handleCreateApiKey(request);
      const result = await APITestHelper.parseResponse(response);

      // Assert
      expect(response.status).toBe(401);
      expect(result.error).toBe('Authentication failed');
      expect(result.details).toBe('Token verification failed');
    });

    it('should maintain transaction-like behavior on failures', async () => {
      // Arrange
      const userId = TestDataGenerator.randomUUID();
      const validToken = createMockJWT({ sub: userId });
      const request = APITestHelper.createMockRequest('POST', {
        name: 'Transaction Test',
        permissions: ['deals:read']
      }, {
        'Authorization': `Bearer ${validToken}`
      });

      mockSupabase.auth.getUser.mockResolvedValue(mockSupabaseResponse({ user: { id: userId } }));
      mockSupabase.rpc
        .mockResolvedValueOnce(mockSupabaseResponse('ak_transaction_test'))
        .mockResolvedValueOnce(mockSupabaseResponse('hashed_transaction'));

      // Database insert fails
      mockSupabase.from().insert().select().single.mockResolvedValue(
        mockSupabaseResponse(null, { message: 'Constraint violation' })
      );

      // Act
      const response = await edgeFunction.handleCreateApiKey(request);

      // Assert
      expect(response.status).toBe(500);
      
      // Should not return the API key if storage failed
      const result = await APITestHelper.parseResponse(response);
      expect(result.api_key).toBeUndefined();
      expect(result.key_data).toBeUndefined();
    });
  });

  describe('Performance Integration', () => {
    it('should handle concurrent requests efficiently', async () => {
      // Arrange
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => {
        const userId = TestDataGenerator.randomUUID();
        const token = createMockJWT({ sub: userId });
        
        // Setup mocks for each request
        mockSupabase.auth.getUser.mockResolvedValue(mockSupabaseResponse({ user: { id: userId } }));
        
        return APITestHelper.createMockRequest('POST', {
          name: `Concurrent Key ${i}`,
          permissions: ['deals:read']
        }, {
          'Authorization': `Bearer ${token}`,
          'X-Forwarded-For': `192.168.1.${i + 10}`, // Different IPs to avoid rate limiting
          'User-Agent': `test-agent-${i}`
        });
      });

      // Mock successful flow for all requests
      mockSupabase.rpc.mockResolvedValue(mockSupabaseResponse('ak_concurrent_test'));
      mockSupabase.from().insert().select().single.mockResolvedValue(
        mockSupabaseResponse(createMockApiKey())
      );

      // Act
      const startTime = performance.now();
      const responses = await Promise.all(
        concurrentRequests.map(req => edgeFunction.handleCreateApiKey(req))
      );
      const endTime = performance.now();

      // Assert
      expect(responses).toHaveLength(10);
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });

      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(1000); // Should handle 10 concurrent requests quickly
    });

    it('should maintain performance under load', async () => {
      // Arrange
      const userId = TestDataGenerator.randomUUID();
      const validToken = createMockJWT({ sub: userId });
      
      mockSupabase.auth.getUser.mockResolvedValue(mockSupabaseResponse({ user: { id: userId } }));
      mockSupabase.rpc.mockResolvedValue(mockSupabaseResponse('ak_load_test'));
      mockSupabase.from().insert().select().single.mockResolvedValue(
        mockSupabaseResponse(createMockApiKey())
      );

      // Act - Sequential requests to test performance degradation
      const iterations = 50;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const request = APITestHelper.createMockRequest('POST', {
          name: `Load Test ${i}`,
          permissions: ['deals:read']
        }, {
          'Authorization': `Bearer ${validToken}`,
          'X-Forwarded-For': `10.0.0.${i % 255}`, // Vary IP to avoid rate limiting
          'User-Agent': `load-test-${i}`
        });

        const start = performance.now();
        const response = await edgeFunction.handleCreateApiKey(request);
        const end = performance.now();

        times.push(end - start);
        expect(response.status).toBe(201);
      }

      // Assert - Performance should remain consistent
      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      
      expect(averageTime).toBeLessThan(10); // Average should be fast
      expect(maxTime).toBeLessThan(50); // Even worst case should be reasonable
    });
  });
});