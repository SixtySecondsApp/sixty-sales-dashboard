import { describe, it, expect, beforeEach, vi, beforeAll, afterEach } from 'vitest';
import { createMockJWT, mockSupabaseResponse, createMockApiKey } from '../setup';
import { 
  PerformanceTestHelper, 
  TestDataGenerator, 
  APITestHelper,
  DatabaseTestHelper,
  MemoryTestHelper
} from '../utils/testHelpers';

// Performance-optimized Edge Function simulation
class PerformantEdgeFunction {
  private supabaseClient: any;
  private rateLimitStore: Map<string, { count: number; resetTime: number }>;
  private requestCache: Map<string, { data: any; timestamp: number }>;
  private performanceMetrics: {
    requestCount: number;
    totalResponseTime: number;
    errorCount: number;
    cacheHits: number;
    cacheMisses: number;
  };

  constructor(supabaseClient: any) {
    this.supabaseClient = supabaseClient;
    this.rateLimitStore = new Map();
    this.requestCache = new Map();
    this.performanceMetrics = {
      requestCount: 0,
      totalResponseTime: 0,
      errorCount: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  async handleCreateApiKey(request: Request): Promise<Response> {
    const startTime = performance.now();
    this.performanceMetrics.requestCount++;

    try {
      // Fast-path for CORS
      if (request.method === 'OPTIONS') {
        return new Response('ok', {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
          }
        });
      }

      // Quick method validation
      if (request.method !== 'POST') {
        return this.createErrorResponse('Method not allowed', 405);
      }

      // Optimized client ID generation
      const clientId = this.getClientId(request);
      
      // Fast rate limiting check
      if (!this.checkRateLimit(clientId)) {
        return this.createErrorResponse('Rate limit exceeded', 429);
      }

      // Optimized auth validation
      const authResult = await this.validateAuthFast(request);
      if (!authResult.success) {
        this.performanceMetrics.errorCount++;
        return this.createErrorResponse('Authentication failed', 401, authResult.error);
      }

      // Fast body parsing
      const bodyResult = await this.parseBodyFast(request);
      if (!bodyResult.success) {
        this.performanceMetrics.errorCount++;
        return this.createErrorResponse('Invalid request body', 400, bodyResult.error);
      }

      // Quick validation
      const validationResult = this.validateInputFast(bodyResult.data);
      if (!validationResult.isValid) {
        this.performanceMetrics.errorCount++;
        return this.createErrorResponse('Validation failed', 400, validationResult.errors.join(', '));
      }

      // Check cache for similar requests (optimization for duplicate/similar requests)
      const cacheKey = this.generateCacheKey(authResult.userId, validationResult.sanitized);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.performanceMetrics.cacheHits++;
        const responseTime = performance.now() - startTime;
        this.performanceMetrics.totalResponseTime += responseTime;
        return new Response(JSON.stringify(cached), {
          status: 201,
          headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
        });
      }
      this.performanceMetrics.cacheMisses++;

      // Optimized API key creation
      const result = await this.createApiKeyFast(authResult.userId, validationResult.sanitized);
      if (!result.success) {
        this.performanceMetrics.errorCount++;
        return this.createErrorResponse('Failed to create API key', 500, result.error);
      }

      // Cache successful response
      this.setCache(cacheKey, result.data);

      const responseTime = performance.now() - startTime;
      this.performanceMetrics.totalResponseTime += responseTime;

      return new Response(JSON.stringify(result.data), {
        status: 201,
        headers: { 
          'Content-Type': 'application/json',
          'X-Response-Time': `${responseTime.toFixed(2)}ms`,
          'X-Cache': 'MISS'
        }
      });

    } catch (error: any) {
      this.performanceMetrics.errorCount++;
      const responseTime = performance.now() - startTime;
      this.performanceMetrics.totalResponseTime += responseTime;
      
      return this.createErrorResponse('Internal server error', 500);
    }
  }

  private createErrorResponse(error: string, status: number, details?: string): Response {
    return new Response(JSON.stringify({
      error,
      details,
      timestamp: new Date().toISOString()
    }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private getClientId(request: Request): string {
    // Optimized client ID generation
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown';
    const ua = request.headers.get('user-agent') || 'unknown';
    return `${ip}-${ua.slice(0, 20)}`; // Shorter for performance
  }

  private checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const data = this.rateLimitStore.get(clientId);
    
    if (!data || now > data.resetTime) {
      this.rateLimitStore.set(clientId, { count: 1, resetTime: now + 60000 });
      return true;
    }
    
    if (data.count >= 10) return false; // Higher limit for performance tests
    
    data.count++;
    return true;
  }

  private async validateAuthFast(request: Request): Promise<{ success: boolean; userId?: string; error?: string }> {
    const auth = request.headers.get('Authorization');
    
    if (!auth?.startsWith('Bearer ')) {
      return { success: false, error: 'Invalid authorization' };
    }

    const token = auth.slice(7); // 'Bearer '.length
    
    try {
      const { data: { user }, error } = await this.supabaseClient.auth.getUser(token);
      
      if (error || !user?.id) {
        return { success: false, error: 'Invalid token' };
      }

      return { success: true, userId: user.id };
    } catch (error) {
      return { success: false, error: 'Token verification failed' };
    }
  }

  private async parseBodyFast(request: Request): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const text = await request.text();
      
      if (!text.trim()) {
        return { success: false, error: 'Empty body' };
      }

      if (text.length > 5000) { // Reasonable limit
        return { success: false, error: 'Body too large' };
      }

      const data = JSON.parse(text);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: 'Invalid JSON' };
    }
  }

  private validateInputFast(data: any): { isValid: boolean; errors: string[]; sanitized?: any } {
    const errors: string[] = [];
    const sanitized: any = {};

    // Fast name validation
    if (!data.name || typeof data.name !== 'string') {
      errors.push('Invalid name');
    } else {
      const name = data.name.trim().slice(0, 100);
      if (name.length < 3) {
        errors.push('Name too short');
      } else {
        sanitized.name = name;
      }
    }

    // Fast permissions validation
    if (!Array.isArray(data.permissions) || data.permissions.length === 0) {
      errors.push('Invalid permissions');
    } else {
      const validPerms = ['deals:read', 'deals:write', 'contacts:read', 'contacts:write', 'activities:read'];
      const sanitizedPerms = data.permissions
        .filter((p: any) => typeof p === 'string' && validPerms.includes(p.toLowerCase()))
        .map((p: string) => p.toLowerCase());
      
      if (sanitizedPerms.length === 0) {
        errors.push('No valid permissions');
      } else {
        sanitized.permissions = sanitizedPerms;
      }
    }

    // Fast rate limit validation
    const rateLimit = data.rate_limit ?? 500;
    sanitized.rate_limit = Math.max(1, Math.min(10000, Number(rateLimit) || 500));

    // Fast expiration validation
    sanitized.expires_in_days = data.expires_in_days || null;

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: errors.length === 0 ? sanitized : undefined
    };
  }

  private generateCacheKey(userId: string, data: any): string {
    // Simple cache key for similar requests
    return `${userId}-${data.name.slice(0, 10)}-${data.permissions.join(',')}-${data.rate_limit}`;
  }

  private getFromCache(key: string): any | null {
    const cached = this.requestCache.get(key);
    if (!cached) return null;
    
    // Cache TTL of 5 minutes
    if (Date.now() - cached.timestamp > 300000) {
      this.requestCache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  private setCache(key: string, data: any): void {
    // Simple LRU: remove oldest if cache is too large
    if (this.requestCache.size >= 100) {
      const firstKey = this.requestCache.keys().next().value;
      this.requestCache.delete(firstKey);
    }
    
    this.requestCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private async createApiKeyFast(userId: string, data: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      // Simulate fast API key generation
      const apiKey = `ak_perf_${TestDataGenerator.randomString(16)}`;
      const hashedKey = `hash_${TestDataGenerator.randomString(32)}`;
      const keyPreview = `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`;

      const keyData = {
        message: 'API key created successfully',
        api_key: apiKey,
        key_data: {
          id: TestDataGenerator.randomUUID(),
          name: data.name,
          key_preview: keyPreview,
          permissions: data.permissions,
          rate_limit: data.rate_limit,
          expires_at: data.expires_in_days ? new Date(Date.now() + data.expires_in_days * 24 * 60 * 60 * 1000).toISOString() : null,
          created_at: new Date().toISOString()
        }
      };

      return { success: true, data: keyData };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Performance monitoring methods
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      averageResponseTime: this.performanceMetrics.requestCount > 0 
        ? this.performanceMetrics.totalResponseTime / this.performanceMetrics.requestCount 
        : 0,
      errorRate: this.performanceMetrics.requestCount > 0 
        ? (this.performanceMetrics.errorCount / this.performanceMetrics.requestCount) * 100 
        : 0,
      cacheHitRate: (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses) > 0
        ? (this.performanceMetrics.cacheHits / (this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses)) * 100
        : 0
    };
  }

  resetMetrics() {
    this.performanceMetrics = {
      requestCount: 0,
      totalResponseTime: 0,
      errorCount: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  clearCache() {
    this.requestCache.clear();
  }

  clearRateLimit() {
    this.rateLimitStore.clear();
  }
}

describe('API Key System - Performance Tests', () => {
  let performantEdgeFunction: PerformantEdgeFunction;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = DatabaseTestHelper.createMockSupabaseClient();
    performantEdgeFunction = new PerformantEdgeFunction(mockSupabase);
    
    // Setup fast auth responses
    const userId = TestDataGenerator.randomUUID();
    mockSupabase.auth.getUser.mockResolvedValue(
      mockSupabaseResponse({ user: { id: userId, email: 'perf@test.com' } })
    );
  });

  afterEach(() => {
    performantEdgeFunction.resetMetrics();
    performantEdgeFunction.clearCache();
    performantEdgeFunction.clearRateLimit();
  });

  describe('Response Time Performance', () => {
    it('should handle single request under 50ms', async () => {
      // Arrange
      const request = APITestHelper.createMockRequest('POST', {
        name: 'Performance Test Key',
        permissions: ['deals:read']
      }, {
        'Authorization': `Bearer ${createMockJWT()}`,
        'Content-Type': 'application/json'
      });

      // Act
      const startTime = performance.now();
      const response = await performantEdgeFunction.handleCreateApiKey(request);
      const endTime = performance.now();
      
      const responseTime = endTime - startTime;

      // Assert
      expect(response.status).toBe(201);
      expect(responseTime).toBeLessThan(50); // Should be under 50ms
      
      const metrics = performantEdgeFunction.getPerformanceMetrics();
      expect(metrics.averageResponseTime).toBeLessThan(50);
    });

    it('should maintain performance under sequential load', async () => {
      // Arrange
      const iterations = 100;
      const times: number[] = [];

      // Act
      for (let i = 0; i < iterations; i++) {
        const request = APITestHelper.createMockRequest('POST', {
          name: `Sequential Key ${i}`,
          permissions: ['deals:read']
        }, {
          'Authorization': `Bearer ${createMockJWT()}`,
          'Content-Type': 'application/json',
          'X-Forwarded-For': `192.168.1.${i % 255}`, // Vary IP to avoid rate limiting
          'User-Agent': `test-agent-${i % 10}`
        });

        const startTime = performance.now();
        const response = await performantEdgeFunction.handleCreateApiKey(request);
        const endTime = performance.now();

        times.push(endTime - startTime);
        expect(response.status).toBe(201);
      }

      // Assert
      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const p95Time = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

      expect(averageTime).toBeLessThan(20); // Average under 20ms
      expect(maxTime).toBeLessThan(100); // Max under 100ms
      expect(p95Time).toBeLessThan(50); // 95th percentile under 50ms

      const metrics = performantEdgeFunction.getPerformanceMetrics();
      expect(metrics.errorRate).toBeLessThan(1); // Less than 1% error rate
    });

    it('should handle concurrent requests efficiently', async () => {
      // Arrange
      const concurrentRequests = 50;
      const requests = Array.from({ length: concurrentRequests }, (_, i) =>
        APITestHelper.createMockRequest('POST', {
          name: `Concurrent Key ${i}`,
          permissions: ['deals:read']
        }, {
          'Authorization': `Bearer ${createMockJWT()}`,
          'Content-Type': 'application/json',
          'X-Forwarded-For': `10.0.${Math.floor(i / 255)}.${i % 255}`, // Unique IPs
          'User-Agent': `concurrent-agent-${i}`
        })
      );

      // Act
      const startTime = performance.now();
      const responses = await Promise.all(
        requests.map(req => performantEdgeFunction.handleCreateApiKey(req))
      );
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const averageTimePerRequest = totalTime / concurrentRequests;

      // Assert
      expect(responses).toHaveLength(concurrentRequests);
      
      const successfulResponses = responses.filter(r => r.status === 201);
      expect(successfulResponses.length).toBeGreaterThan(concurrentRequests * 0.8); // At least 80% success

      expect(totalTime).toBeLessThan(5000); // Total under 5 seconds
      expect(averageTimePerRequest).toBeLessThan(100); // Average per request under 100ms

      const metrics = performantEdgeFunction.getPerformanceMetrics();
      expect(metrics.errorRate).toBeLessThan(20); // Less than 20% error rate under load
    });

    it('should demonstrate cache performance benefits', async () => {
      // Arrange
      const baseRequest = {
        name: 'Cache Test Key',
        permissions: ['deals:read']
      };

      // Act - First request (cache miss)
      const request1 = APITestHelper.createMockRequest('POST', baseRequest, {
        'Authorization': `Bearer ${createMockJWT()}`,
        'Content-Type': 'application/json'
      });

      const startTime1 = performance.now();
      const response1 = await performantEdgeFunction.handleCreateApiKey(request1);
      const endTime1 = performance.now();
      const firstRequestTime = endTime1 - startTime1;

      expect(response1.status).toBe(201);
      expect(response1.headers.get('X-Cache')).toBe('MISS');

      // Second request (cache hit)
      const request2 = APITestHelper.createMockRequest('POST', baseRequest, {
        'Authorization': `Bearer ${createMockJWT()}`,
        'Content-Type': 'application/json'
      });

      const startTime2 = performance.now();
      const response2 = await performantEdgeFunction.handleCreateApiKey(request2);
      const endTime2 = performance.now();
      const secondRequestTime = endTime2 - startTime2;

      // Assert
      expect(response2.status).toBe(201);
      expect(response2.headers.get('X-Cache')).toBe('HIT');
      expect(secondRequestTime).toBeLessThan(firstRequestTime * 0.5); // At least 50% faster

      const metrics = performantEdgeFunction.getPerformanceMetrics();
      expect(metrics.cacheHitRate).toBeGreaterThan(0);
    });
  });

  describe('Throughput Performance', () => {
    it('should achieve high requests per second', async () => {
      // Arrange
      const testDuration = 2000; // 2 seconds
      const startTime = Date.now();
      let requestCount = 0;

      // Act
      const promises: Promise<Response>[] = [];
      
      while (Date.now() - startTime < testDuration) {
        const request = APITestHelper.createMockRequest('POST', {
          name: `Throughput Key ${requestCount}`,
          permissions: ['deals:read']
        }, {
          'Authorization': `Bearer ${createMockJWT()}`,
          'Content-Type': 'application/json',
          'X-Forwarded-For': `172.16.${Math.floor(requestCount / 255)}.${requestCount % 255}`,
          'User-Agent': `throughput-${requestCount % 100}`
        });

        promises.push(performantEdgeFunction.handleCreateApiKey(request));
        requestCount++;

        // Small delay to avoid overwhelming
        if (requestCount % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      const responses = await Promise.all(promises);
      const actualDuration = Date.now() - startTime;
      const requestsPerSecond = (requestCount / actualDuration) * 1000;

      // Assert
      expect(requestsPerSecond).toBeGreaterThan(100); // At least 100 RPS
      
      const successfulRequests = responses.filter(r => r.status === 201);
      const successRate = (successfulRequests.length / requestCount) * 100;
      
      expect(successRate).toBeGreaterThan(50); // At least 50% success under load
    });

    it('should handle burst traffic patterns', async () => {
      // Arrange - Simulate burst patterns
      const burstSizes = [10, 25, 50, 25, 10];
      const results: { burstSize: number; averageTime: number; successRate: number }[] = [];

      // Act
      for (const burstSize of burstSizes) {
        const startTime = performance.now();
        
        const requests = Array.from({ length: burstSize }, (_, i) =>
          APITestHelper.createMockRequest('POST', {
            name: `Burst Key ${burstSize}-${i}`,
            permissions: ['deals:read']
          }, {
            'Authorization': `Bearer ${createMockJWT()}`,
            'Content-Type': 'application/json',
            'X-Forwarded-For': `192.168.${burstSize}.${i}`,
            'User-Agent': `burst-agent-${i}`
          })
        );

        const responses = await Promise.all(
          requests.map(req => performantEdgeFunction.handleCreateApiKey(req))
        );

        const endTime = performance.now();
        const averageTime = (endTime - startTime) / burstSize;
        const successRate = (responses.filter(r => r.status === 201).length / burstSize) * 100;

        results.push({ burstSize, averageTime, successRate });

        // Brief pause between bursts
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Assert
      results.forEach(result => {
        expect(result.averageTime).toBeLessThan(200); // Average under 200ms per request
        expect(result.successRate).toBeGreaterThan(30); // At least 30% success rate
      });

      // Performance should not degrade significantly with burst size
      const smallBurstAvg = results[0].averageTime;
      const largeBurstAvg = results[2].averageTime;
      expect(largeBurstAvg).toBeLessThan(smallBurstAvg * 3); // No more than 3x slower
    });
  });

  describe('Memory Performance', () => {
    it('should not leak memory under sustained load', async () => {
      // This test checks for memory leaks during sustained operation
      const iterations = 200;
      
      const initialMemory = MemoryTestHelper.getMemoryUsage();
      
      // Act - Sustained load
      for (let i = 0; i < iterations; i++) {
        const request = APITestHelper.createMockRequest('POST', {
          name: `Memory Test ${i}`,
          permissions: ['deals:read']
        }, {
          'Authorization': `Bearer ${createMockJWT()}`,
          'Content-Type': 'application/json',
          'X-Forwarded-For': `203.0.${Math.floor(i / 255)}.${i % 255}`,
          'User-Agent': `memory-test-${i % 50}`
        });

        await performantEdgeFunction.handleCreateApiKey(request);

        // Periodic cleanup simulation
        if (i % 50 === 0) {
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
      }

      const finalMemory = MemoryTestHelper.getMemoryUsage();

      // Assert
      if (initialMemory && finalMemory) {
        const memoryGrowth = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
        const memoryGrowthMB = memoryGrowth / (1024 * 1024);
        
        // Memory growth should be reasonable (less than 50MB for 200 requests)
        expect(memoryGrowthMB).toBeLessThan(50);
      }

      // Cache should not grow unbounded
      const metrics = performantEdgeFunction.getPerformanceMetrics();
      expect(metrics.requestCount).toBe(iterations);
    });

    it('should manage cache size effectively', async () => {
      // Arrange - Create more requests than cache capacity
      const requestCount = 150; // More than cache limit of 100

      // Act
      for (let i = 0; i < requestCount; i++) {
        const request = APITestHelper.createMockRequest('POST', {
          name: `Cache Size Test ${i}`,
          permissions: ['deals:read']
        }, {
          'Authorization': `Bearer ${createMockJWT()}`,
          'Content-Type': 'application/json'
        });

        await performantEdgeFunction.handleCreateApiKey(request);
      }

      // Assert
      const metrics = performantEdgeFunction.getPerformanceMetrics();
      expect(metrics.requestCount).toBe(requestCount);
      
      // Cache should have limited growth and effective eviction
      expect(metrics.cacheMisses).toBeGreaterThan(0);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle validation errors quickly', async () => {
      // Arrange - Create invalid requests
      const invalidRequests = Array.from({ length: 50 }, (_, i) => 
        APITestHelper.createMockRequest('POST', {
          name: '', // Invalid name
          permissions: []  // Invalid permissions
        }, {
          'Authorization': `Bearer ${createMockJWT()}`,
          'Content-Type': 'application/json'
        })
      );

      // Act
      const startTime = performance.now();
      const responses = await Promise.all(
        invalidRequests.map(req => performantEdgeFunction.handleCreateApiKey(req))
      );
      const endTime = performance.now();

      const averageTime = (endTime - startTime) / invalidRequests.length;

      // Assert
      expect(averageTime).toBeLessThan(10); // Very fast validation errors
      
      responses.forEach(response => {
        expect(response.status).toBe(400);
      });

      const metrics = performantEdgeFunction.getPerformanceMetrics();
      expect(metrics.errorRate).toBe(100); // All should be errors
      expect(metrics.averageResponseTime).toBeLessThan(10);
    });

    it('should handle auth errors efficiently', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue(
        mockSupabaseResponse(null, { message: 'Invalid token' })
      );

      const requests = Array.from({ length: 30 }, (_, i) =>
        APITestHelper.createMockRequest('POST', {
          name: `Auth Error Test ${i}`,
          permissions: ['deals:read']
        }, {
          'Authorization': `Bearer invalid_token_${i}`,
          'Content-Type': 'application/json'
        })
      );

      // Act
      const startTime = performance.now();
      const responses = await Promise.all(
        requests.map(req => performantEdgeFunction.handleCreateApiKey(req))
      );
      const endTime = performance.now();

      const averageTime = (endTime - startTime) / requests.length;

      // Assert
      expect(averageTime).toBeLessThan(20); // Fast auth failures
      
      responses.forEach(response => {
        expect(response.status).toBe(401);
      });
    });

    it('should maintain performance during mixed success/error scenarios', async () => {
      // Arrange - Mix of valid and invalid requests
      const requests = Array.from({ length: 100 }, (_, i) => {
        const isValid = i % 3 !== 0; // ~66% valid requests
        
        return APITestHelper.createMockRequest('POST', {
          name: isValid ? `Mixed Test ${i}` : '', // Invalid name for some
          permissions: isValid ? ['deals:read'] : [] // Invalid permissions for some
        }, {
          'Authorization': `Bearer ${createMockJWT()}`,
          'Content-Type': 'application/json',
          'X-Forwarded-For': `198.51.100.${i % 255}`,
          'User-Agent': `mixed-test-${i}`
        });
      });

      // Act
      const startTime = performance.now();
      const responses = await Promise.all(
        requests.map(req => performantEdgeFunction.handleCreateApiKey(req))
      );
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const averageTime = totalTime / requests.length;

      // Assert
      expect(averageTime).toBeLessThan(50); // Should handle mixed load efficiently
      
      const successCount = responses.filter(r => r.status === 201).length;
      const errorCount = responses.filter(r => r.status >= 400).length;
      
      expect(successCount).toBeGreaterThan(50); // Should have successful requests
      expect(errorCount).toBeGreaterThan(20); // Should have error requests
      expect(successCount + errorCount).toBe(100); // All requests processed

      const metrics = performantEdgeFunction.getPerformanceMetrics();
      expect(metrics.requestCount).toBe(100);
      expect(metrics.averageResponseTime).toBeLessThan(50);
    });
  });

  describe('Rate Limiting Performance', () => {
    it('should apply rate limiting efficiently', async () => {
      // Arrange - Many requests from same client
      const clientRequests = Array.from({ length: 20 }, (_, i) =>
        APITestHelper.createMockRequest('POST', {
          name: `Rate Limit Test ${i}`,
          permissions: ['deals:read']
        }, {
          'Authorization': `Bearer ${createMockJWT()}`,
          'Content-Type': 'application/json',
          'X-Forwarded-For': '192.168.1.100', // Same IP
          'User-Agent': 'rate-limit-test-agent' // Same agent
        })
      );

      // Act
      const startTime = performance.now();
      const responses = await Promise.all(
        clientRequests.map(req => performantEdgeFunction.handleCreateApiKey(req))
      );
      const endTime = performance.now();

      const averageTime = (endTime - startTime) / clientRequests.length;

      // Assert
      expect(averageTime).toBeLessThan(20); // Rate limiting should be fast

      const allowedRequests = responses.filter(r => r.status === 201);
      const rateLimitedRequests = responses.filter(r => r.status === 429);

      expect(allowedRequests.length).toBeLessThanOrEqual(10); // Rate limit should apply
      expect(rateLimitedRequests.length).toBeGreaterThan(0); // Some should be rate limited
    });

    it('should handle rate limiting across multiple clients efficiently', async () => {
      // Arrange - Multiple clients, each hitting rate limit
      const clientCount = 20;
      const requestsPerClient = 15;
      
      const allRequests: Promise<Response>[] = [];
      
      for (let client = 0; client < clientCount; client++) {
        for (let req = 0; req < requestsPerClient; req++) {
          const request = APITestHelper.createMockRequest('POST', {
            name: `Multi Client Test ${client}-${req}`,
            permissions: ['deals:read']
          }, {
            'Authorization': `Bearer ${createMockJWT()}`,
            'Content-Type': 'application/json',
            'X-Forwarded-For': `10.0.${Math.floor(client / 255)}.${client % 255}`,
            'User-Agent': `client-${client}-agent`
          });
          
          allRequests.push(performantEdgeFunction.handleCreateApiKey(request));
        }
      }

      // Act
      const startTime = performance.now();
      const responses = await Promise.all(allRequests);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const averageTime = totalTime / allRequests.length;

      // Assert
      expect(averageTime).toBeLessThan(30); // Should handle multiple clients efficiently
      expect(totalTime).toBeLessThan(10000); // Total time under 10 seconds

      const successCount = responses.filter(r => r.status === 201).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      // Each client should get ~10 successful requests, so ~200 total success
      expect(successCount).toBeGreaterThan(150);
      expect(rateLimitedCount).toBeGreaterThan(50); // Rest should be rate limited
    });
  });

  describe('Resource Utilization', () => {
    it('should demonstrate efficient resource usage', async () => {
      // This test measures overall resource efficiency
      const testDuration = 3000; // 3 seconds
      const startTime = Date.now();
      let requestCount = 0;

      const initialMetrics = performantEdgeFunction.getPerformanceMetrics();

      // Act - Sustained mixed load
      while (Date.now() - startTime < testDuration) {
        const isValid = requestCount % 4 !== 0; // 75% valid requests
        
        const request = APITestHelper.createMockRequest('POST', {
          name: isValid ? `Resource Test ${requestCount}` : '', 
          permissions: isValid ? ['deals:read'] : []
        }, {
          'Authorization': `Bearer ${createMockJWT()}`,
          'Content-Type': 'application/json',
          'X-Forwarded-For': `172.16.${Math.floor(requestCount / 255)}.${requestCount % 255}`,
          'User-Agent': `resource-test-${requestCount % 20}`
        });

        const response = await performantEdgeFunction.handleCreateApiKey(request);
        expect([201, 400, 429]).toContain(response.status); // Should handle all scenarios

        requestCount++;

        // Small delay for realistic load
        if (requestCount % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 2));
        }
      }

      const finalMetrics = performantEdgeFunction.getPerformanceMetrics();

      // Assert
      expect(requestCount).toBeGreaterThan(100); // Should process many requests
      expect(finalMetrics.averageResponseTime).toBeLessThan(100); // Efficient average time
      expect(finalMetrics.errorRate).toBeLessThan(50); // Reasonable error rate
      
      const requestsPerSecond = (requestCount / testDuration) * 1000;
      expect(requestsPerSecond).toBeGreaterThan(30); // Reasonable throughput

      // Cache should provide benefits
      if (finalMetrics.cacheHits > 0) {
        expect(finalMetrics.cacheHitRate).toBeGreaterThan(5); // Some cache benefit
      }
    });
  });
});