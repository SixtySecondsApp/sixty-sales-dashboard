import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimitTestHelper, TestDataGenerator, PerformanceTestHelper } from '../utils/testHelpers';

// Mock the Edge Function rate limiting logic
class RateLimiter {
  private store: Map<string, { count: number; resetTime: number }>;

  constructor() {
    this.store = new Map();
  }

  checkRateLimit(clientId: string, limit: number = 10, windowMs: number = 60000): boolean {
    const now = Date.now();
    const clientData = this.store.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      // Reset or initialize
      this.store.set(clientId, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (clientData.count >= limit) {
      return false; // Rate limit exceeded
    }
    
    clientData.count++;
    return true;
  }

  getClientId(req: Request): string {
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const ipAddress = forwarded?.split(',')[0] || realIp || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    // Combine IP and User-Agent for better rate limiting
    return `${ipAddress}-${userAgent.slice(0, 50)}`;
  }

  getRateLimitData(clientId: string) {
    return this.store.get(clientId);
  }

  clearRateLimit(clientId?: string) {
    if (clientId) {
      this.store.delete(clientId);
    } else {
      this.store.clear();
    }
  }

  getRemainingRequests(clientId: string, limit: number = 10): number {
    const clientData = this.store.get(clientId);
    if (!clientData) return limit;
    
    const now = Date.now();
    if (now > clientData.resetTime) return limit;
    
    return Math.max(0, limit - clientData.count);
  }

  getResetTime(clientId: string): number | null {
    const clientData = this.store.get(clientId);
    if (!clientData) return null;
    
    const now = Date.now();
    if (now > clientData.resetTime) return null;
    
    return clientData.resetTime;
  }
}

// Helper to create mock Request objects
function createMockRequest(
  ip: string = '192.168.1.1',
  userAgent: string = 'test-agent/1.0',
  headers: Record<string, string> = {}
): Request {
  return new Request('https://test.example.com', {
    method: 'POST',
    headers: {
      'X-Forwarded-For': ip,
      'User-Agent': userAgent,
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

describe('Rate Limiting Unit Tests', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
    // Clear any existing rate limit data
    rateLimiter.clearRateLimit();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      // Arrange
      const clientId = 'test-client';
      const limit = 5;

      // Act & Assert
      for (let i = 1; i <= limit; i++) {
        const allowed = rateLimiter.checkRateLimit(clientId, limit);
        expect(allowed).toBe(true);
        
        const remaining = rateLimiter.getRemainingRequests(clientId, limit);
        expect(remaining).toBe(limit - i);
      }
    });

    it('should block requests exceeding rate limit', async () => {
      // Arrange
      const clientId = 'test-client';
      const limit = 3;

      // Act - make requests up to limit
      for (let i = 0; i < limit; i++) {
        const allowed = rateLimiter.checkRateLimit(clientId, limit);
        expect(allowed).toBe(true);
      }

      // Assert - next requests should be blocked
      for (let i = 0; i < 5; i++) {
        const allowed = rateLimiter.checkRateLimit(clientId, limit);
        expect(allowed).toBe(false);
        
        const remaining = rateLimiter.getRemainingRequests(clientId, limit);
        expect(remaining).toBe(0);
      }
    });

    it('should reset rate limit after window expires', async () => {
      // Arrange
      const clientId = 'test-client';
      const limit = 2;
      const windowMs = 100; // 100ms window

      // Act - exhaust rate limit
      expect(rateLimiter.checkRateLimit(clientId, limit, windowMs)).toBe(true);
      expect(rateLimiter.checkRateLimit(clientId, limit, windowMs)).toBe(true);
      expect(rateLimiter.checkRateLimit(clientId, limit, windowMs)).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Assert - should be allowed again
      expect(rateLimiter.checkRateLimit(clientId, limit, windowMs)).toBe(true);
      expect(rateLimiter.getRemainingRequests(clientId, limit)).toBe(limit - 1);
    });

    it('should handle multiple clients independently', async () => {
      // Arrange
      const client1 = 'client-1';
      const client2 = 'client-2';
      const limit = 2;

      // Act - exhaust client1's limit
      expect(rateLimiter.checkRateLimit(client1, limit)).toBe(true);
      expect(rateLimiter.checkRateLimit(client1, limit)).toBe(true);
      expect(rateLimiter.checkRateLimit(client1, limit)).toBe(false);

      // Assert - client2 should still be allowed
      expect(rateLimiter.checkRateLimit(client2, limit)).toBe(true);
      expect(rateLimiter.checkRateLimit(client2, limit)).toBe(true);
      expect(rateLimiter.checkRateLimit(client2, limit)).toBe(false);

      // Both clients should be blocked for additional requests
      expect(rateLimiter.checkRateLimit(client1, limit)).toBe(false);
      expect(rateLimiter.checkRateLimit(client2, limit)).toBe(false);
    });
  });

  describe('Client ID Generation', () => {
    it('should generate consistent client IDs for same IP and user agent', async () => {
      // Arrange
      const req1 = createMockRequest('192.168.1.1', 'Mozilla/5.0');
      const req2 = createMockRequest('192.168.1.1', 'Mozilla/5.0');

      // Act
      const clientId1 = rateLimiter.getClientId(req1);
      const clientId2 = rateLimiter.getClientId(req2);

      // Assert
      expect(clientId1).toBe(clientId2);
      expect(clientId1).toContain('192.168.1.1');
      expect(clientId1).toContain('Mozilla/5.0');
    });

    it('should generate different client IDs for different IPs', async () => {
      // Arrange
      const req1 = createMockRequest('192.168.1.1', 'Mozilla/5.0');
      const req2 = createMockRequest('192.168.1.2', 'Mozilla/5.0');

      // Act
      const clientId1 = rateLimiter.getClientId(req1);
      const clientId2 = rateLimiter.getClientId(req2);

      // Assert
      expect(clientId1).not.toBe(clientId2);
      expect(clientId1).toContain('192.168.1.1');
      expect(clientId2).toContain('192.168.1.2');
    });

    it('should generate different client IDs for different user agents', async () => {
      // Arrange
      const req1 = createMockRequest('192.168.1.1', 'Mozilla/5.0');
      const req2 = createMockRequest('192.168.1.1', 'Chrome/90.0');

      // Act
      const clientId1 = rateLimiter.getClientId(req1);
      const clientId2 = rateLimiter.getClientId(req2);

      // Assert
      expect(clientId1).not.toBe(clientId2);
      expect(clientId1).toContain('Mozilla/5.0');
      expect(clientId2).toContain('Chrome/90.0');
    });

    it('should handle X-Forwarded-For header with multiple IPs', async () => {
      // Arrange
      const req = createMockRequest('', 'Mozilla/5.0', {
        'X-Forwarded-For': '10.0.0.1, 192.168.1.1, 172.16.0.1'
      });

      // Act
      const clientId = rateLimiter.getClientId(req);

      // Assert
      expect(clientId).toContain('10.0.0.1'); // Should use the first IP
      expect(clientId).not.toContain('192.168.1.1');
    });

    it('should handle X-Real-IP header when X-Forwarded-For is missing', async () => {
      // Arrange
      const req = new Request('https://test.example.com', {
        headers: {
          'X-Real-IP': '10.0.0.1',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      // Act
      const clientId = rateLimiter.getClientId(req);

      // Assert
      expect(clientId).toContain('10.0.0.1');
    });

    it('should handle missing IP headers gracefully', async () => {
      // Arrange
      const req = new Request('https://test.example.com', {
        headers: {
          'User-Agent': 'Mozilla/5.0'
        }
      });

      // Act
      const clientId = rateLimiter.getClientId(req);

      // Assert
      expect(clientId).toContain('unknown'); // Should use 'unknown' for IP
      expect(clientId).toContain('Mozilla/5.0');
    });

    it('should handle missing User-Agent header gracefully', async () => {
      // Arrange
      const req = new Request('https://test.example.com', {
        headers: {
          'X-Forwarded-For': '192.168.1.1'
        }
      });

      // Act
      const clientId = rateLimiter.getClientId(req);

      // Assert
      expect(clientId).toContain('192.168.1.1');
      expect(clientId).toContain('unknown'); // Should use 'unknown' for User-Agent
    });

    it('should truncate long user agent strings', async () => {
      // Arrange
      const longUserAgent = 'A'.repeat(200);
      const req = createMockRequest('192.168.1.1', longUserAgent);

      // Act
      const clientId = rateLimiter.getClientId(req);

      // Assert
      expect(clientId.length).toBeLessThan(longUserAgent.length + 20); // Should be truncated
      expect(clientId).toContain('A'.repeat(50)); // First 50 chars
    });
  });

  describe('Rate Limit Window Management', () => {
    it('should handle different window sizes correctly', async () => {
      // Arrange
      const clientId = 'test-client';
      const limit = 2;

      // Test short window
      const shortWindow = 50;
      expect(rateLimiter.checkRateLimit(clientId, limit, shortWindow)).toBe(true);
      expect(rateLimiter.checkRateLimit(clientId, limit, shortWindow)).toBe(true);
      expect(rateLimiter.checkRateLimit(clientId, limit, shortWindow)).toBe(false);

      // Wait for short window to expire
      await new Promise(resolve => setTimeout(resolve, 60));

      // Should be allowed again
      expect(rateLimiter.checkRateLimit(clientId, limit, shortWindow)).toBe(true);
    });

    it('should provide accurate reset time information', async () => {
      // Arrange
      const clientId = 'test-client';
      const windowMs = 1000;
      const startTime = Date.now();

      // Act
      rateLimiter.checkRateLimit(clientId, 1, windowMs);
      const resetTime = rateLimiter.getResetTime(clientId);

      // Assert
      expect(resetTime).toBeGreaterThan(startTime);
      expect(resetTime).toBeLessThanOrEqual(startTime + windowMs + 10); // Allow small margin for execution time
    });

    it('should return null reset time for non-existent clients', async () => {
      // Act
      const resetTime = rateLimiter.getResetTime('non-existent-client');

      // Assert
      expect(resetTime).toBeNull();
    });

    it('should return null reset time for expired windows', async () => {
      // Arrange
      const clientId = 'test-client';
      const shortWindow = 50;

      // Act
      rateLimiter.checkRateLimit(clientId, 1, shortWindow);
      await new Promise(resolve => setTimeout(resolve, 60));
      
      const resetTime = rateLimiter.getResetTime(clientId);

      // Assert
      expect(resetTime).toBeNull();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle zero and negative limits gracefully', async () => {
      // Arrange
      const clientId = 'test-client';

      // Act & Assert - zero limit
      expect(rateLimiter.checkRateLimit(clientId, 0)).toBe(false);
      
      // Negative limit should still work (though not recommended)
      expect(rateLimiter.checkRateLimit(clientId, -1)).toBe(false);
    });

    it('should handle zero and negative window times', async () => {
      // Arrange
      const clientId = 'test-client';

      // Act - zero window should immediately expire
      expect(rateLimiter.checkRateLimit(clientId, 1, 0)).toBe(true);
      expect(rateLimiter.checkRateLimit(clientId, 1, 0)).toBe(true); // Should be allowed again

      // Negative window should also immediately expire
      expect(rateLimiter.checkRateLimit(clientId, 1, -1000)).toBe(true);
    });

    it('should handle extremely large limits and windows', async () => {
      // Arrange
      const clientId = 'test-client';
      const largeLimit = Number.MAX_SAFE_INTEGER;
      const largeWindow = Number.MAX_SAFE_INTEGER;

      // Act
      const allowed = rateLimiter.checkRateLimit(clientId, largeLimit, largeWindow);
      
      // Assert
      expect(allowed).toBe(true);
      expect(rateLimiter.getRemainingRequests(clientId, largeLimit)).toBe(largeLimit - 1);
    });

    it('should handle concurrent access from same client', async () => {
      // Arrange
      const clientId = 'concurrent-client';
      const limit = 10;

      // Act - simulate concurrent requests
      const promises = Array.from({ length: 20 }, () => 
        Promise.resolve(rateLimiter.checkRateLimit(clientId, limit))
      );

      const results = await Promise.all(promises);

      // Assert
      const allowedCount = results.filter(allowed => allowed).length;
      const blockedCount = results.filter(allowed => !allowed).length;

      expect(allowedCount).toBe(limit);
      expect(blockedCount).toBe(20 - limit);
    });

    it('should clear specific client rate limit data', async () => {
      // Arrange
      const client1 = 'client-1';
      const client2 = 'client-2';
      const limit = 1;

      // Exhaust both clients' limits
      rateLimiter.checkRateLimit(client1, limit);
      rateLimiter.checkRateLimit(client2, limit);
      
      expect(rateLimiter.checkRateLimit(client1, limit)).toBe(false);
      expect(rateLimiter.checkRateLimit(client2, limit)).toBe(false);

      // Act - clear only client1
      rateLimiter.clearRateLimit(client1);

      // Assert
      expect(rateLimiter.checkRateLimit(client1, limit)).toBe(true); // Reset
      expect(rateLimiter.checkRateLimit(client2, limit)).toBe(false); // Still blocked
    });

    it('should handle malformed request headers', async () => {
      // Arrange
      const malformedRequests = [
        createMockRequest('', '', { 'X-Forwarded-For': '' }),
        createMockRequest('', '', { 'User-Agent': '' }),
        createMockRequest('', '', { 'X-Forwarded-For': null as any }),
        createMockRequest('', '', { 'User-Agent': null as any }),
      ];

      // Act & Assert
      for (const req of malformedRequests) {
        const clientId = rateLimiter.getClientId(req);
        
        // Should not throw error and should generate some ID
        expect(typeof clientId).toBe('string');
        expect(clientId.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Performance Tests', () => {
    it('should handle high-frequency requests efficiently', async () => {
      // Arrange
      const clientId = 'performance-client';
      const limit = 1000;
      const iterations = 5000;

      // Act
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        rateLimiter.checkRateLimit(clientId, limit);
      }
      
      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      // Assert
      expect(averageTime).toBeLessThan(1); // Should be under 1ms per check
    });

    it('should handle many concurrent clients efficiently', async () => {
      // Arrange
      const clientCount = 1000;
      const limit = 5;

      // Act
      const startTime = performance.now();
      
      const promises = Array.from({ length: clientCount }, (_, i) => {
        const clientId = `client-${i}`;
        return Promise.resolve(rateLimiter.checkRateLimit(clientId, limit));
      });

      await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Assert
      expect(totalTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should maintain performance with large rate limit stores', async () => {
      // Arrange - create many clients with data
      const clientCount = 10000;
      for (let i = 0; i < clientCount; i++) {
        rateLimiter.checkRateLimit(`client-${i}`, 1);
      }

      // Act - test performance with large store
      const testClient = 'performance-test-client';
      const iterations = 100;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        rateLimiter.checkRateLimit(testClient, 10);
      }
      
      const endTime = performance.now();
      const averageTime = (endTime - startTime) / iterations;

      // Assert
      expect(averageTime).toBeLessThan(5); // Should still be fast even with large store
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with expired entries', async () => {
      // This test would ideally check memory usage, but we'll simulate
      // by ensuring expired entries are handled correctly
      
      // Arrange
      const shortWindow = 10;
      const limit = 1;

      // Create many short-lived rate limit entries
      for (let i = 0; i < 100; i++) {
        rateLimiter.checkRateLimit(`client-${i}`, limit, shortWindow);
      }

      // Wait for entries to expire
      await new Promise(resolve => setTimeout(resolve, 20));

      // Act - accessing expired entries should reset them
      for (let i = 0; i < 10; i++) {
        const allowed = rateLimiter.checkRateLimit(`client-${i}`, limit, shortWindow);
        expect(allowed).toBe(true); // Should be allowed as entries expired
      }
    });

    it('should handle cleanup of expired entries', async () => {
      // Arrange
      const clientId = 'cleanup-test';
      const shortWindow = 10;

      // Create entry
      rateLimiter.checkRateLimit(clientId, 1, shortWindow);
      expect(rateLimiter.getRateLimitData(clientId)).toBeDefined();

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 20));

      // Act - next check should treat as new client
      const remaining = rateLimiter.getRemainingRequests(clientId, 5);
      
      // Assert
      expect(remaining).toBe(5); // Should be full limit as expired
    });
  });

  describe('Integration with Request Processing', () => {
    it('should integrate properly with request flow', async () => {
      // Arrange
      const req = createMockRequest('192.168.1.100', 'test-agent/1.0');
      const limit = 5;
      const windowMs = 60000;

      // Act - simulate multiple requests from same client
      const results: boolean[] = [];
      for (let i = 0; i < 10; i++) {
        const clientId = rateLimiter.getClientId(req);
        const allowed = rateLimiter.checkRateLimit(clientId, limit, windowMs);
        results.push(allowed);
      }

      // Assert
      const allowedRequests = results.filter(r => r).length;
      const blockedRequests = results.filter(r => !r).length;
      
      expect(allowedRequests).toBe(limit);
      expect(blockedRequests).toBe(10 - limit);
    });

    it('should handle different request patterns realistically', async () => {
      // Arrange - simulate different types of clients
      const normalClient = createMockRequest('192.168.1.1', 'Mozilla/5.0');
      const mobileClient = createMockRequest('10.0.0.1', 'Mobile Safari');
      const botClient = createMockRequest('172.16.0.1', 'bot/1.0');
      
      const limit = 3;

      // Act & Assert - each client should have independent limits
      for (let i = 0; i < limit; i++) {
        expect(rateLimiter.checkRateLimit(rateLimiter.getClientId(normalClient), limit)).toBe(true);
        expect(rateLimiter.checkRateLimit(rateLimiter.getClientId(mobileClient), limit)).toBe(true);
        expect(rateLimiter.checkRateLimit(rateLimiter.getClientId(botClient), limit)).toBe(true);
      }

      // All should now be rate limited
      expect(rateLimiter.checkRateLimit(rateLimiter.getClientId(normalClient), limit)).toBe(false);
      expect(rateLimiter.checkRateLimit(rateLimiter.getClientId(mobileClient), limit)).toBe(false);
      expect(rateLimiter.checkRateLimit(rateLimiter.getClientId(botClient), limit)).toBe(false);
    });

    it('should provide helpful rate limit information for responses', async () => {
      // Arrange
      const clientId = 'info-test-client';
      const limit = 5;
      const windowMs = 60000;

      // Act - make some requests
      for (let i = 0; i < 3; i++) {
        rateLimiter.checkRateLimit(clientId, limit, windowMs);
      }

      // Assert - should provide useful info for rate limit headers
      const remaining = rateLimiter.getRemainingRequests(clientId, limit);
      const resetTime = rateLimiter.getResetTime(clientId);
      const rateLimitData = rateLimiter.getRateLimitData(clientId);

      expect(remaining).toBe(2); // 5 - 3 used
      expect(resetTime).toBeGreaterThan(Date.now());
      expect(rateLimitData).toBeDefined();
      expect(rateLimitData?.count).toBe(3);
    });
  });
});