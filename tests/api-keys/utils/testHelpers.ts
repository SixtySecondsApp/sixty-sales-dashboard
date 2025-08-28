import { vi } from 'vitest';

// Security testing helpers
export class SecurityTestHelper {
  static generateXSSPayloads(): string[] {
    return [
      '<script>alert("xss")</script>',
      '"><script>alert("xss")</script>',
      'javascript:alert("xss")',
      '<img src=x onerror=alert("xss")>',
      '&lt;script&gt;alert("xss")&lt;/script&gt;',
      '<svg/onload=alert("xss")>',
      '<iframe src="javascript:alert(\'xss\')"></iframe>',
      '{{constructor.constructor("alert(\'xss\')")()}}',
      '${alert("xss")}',
      '<%=alert("xss")%>',
    ];
  }

  static generateSQLInjectionPayloads(): string[] {
    return [
      "'; DROP TABLE api_keys; --",
      "1' OR '1'='1",
      "'; UPDATE users SET is_admin = true; --",
      "UNION SELECT * FROM users--",
      "'; INSERT INTO api_keys (user_id, key_hash) VALUES ('evil', 'hash'); --",
      "1'; EXEC xp_cmdshell('dir'); --",
      "admin'--",
      "admin' /*",
      "' OR 1=1--",
      "' OR 'a'='a",
    ];
  }

  static generateLongInputs(): Record<string, string> {
    return {
      shortString: 'a'.repeat(10),
      normalString: 'a'.repeat(100),
      longString: 'a'.repeat(1000),
      veryLongString: 'a'.repeat(10000),
      maxLengthString: 'a'.repeat(65535),
    };
  }

  static generateInvalidJWT(): string[] {
    return [
      '', // Empty token
      'invalid.token.here', // Invalid format
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature', // Invalid payload
      'header.payload', // Missing signature
      'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIn0.', // None algorithm
      'expired.jwt.token.here', // Expired token simulation
    ];
  }
}

// API testing helpers
export class APITestHelper {
  static createMockRequest(
    method: string = 'POST',
    body: any = null,
    headers: Record<string, string> = {}
  ): Request {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'test-agent/1.0',
      'X-Forwarded-For': '192.168.1.1',
      'X-Real-IP': '192.168.1.1',
      ...headers
    };

    return new Request('https://test.example.com/create-api-key', {
      method,
      headers: defaultHeaders,
      body: body ? JSON.stringify(body) : null
    });
  }

  static createMockResponse(
    status: number,
    body: any,
    headers: Record<string, string> = {}
  ): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    });
  }

  static async parseResponse(response: Response): Promise<any> {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}

// Rate limiting test helpers
export class RateLimitTestHelper {
  private static store = new Map<string, { count: number; resetTime: number }>();

  static mockRateLimitStore() {
    return {
      get: (key: string) => this.store.get(key),
      set: (key: string, value: { count: number; resetTime: number }) => {
        this.store.set(key, value);
      },
      clear: () => this.store.clear(),
      size: () => this.store.size
    };
  }

  static simulateRateLimit(clientId: string, requests: number, timeWindow: number = 60000) {
    const now = Date.now();
    const data = { count: requests, resetTime: now + timeWindow };
    this.store.set(clientId, data);
    return data;
  }

  static clearRateLimit() {
    this.store.clear();
  }

  static getRateLimitData(clientId: string) {
    return this.store.get(clientId);
  }
}

// Performance testing helpers
export class PerformanceTestHelper {
  static async measureExecutionTime<T>(
    fn: () => Promise<T> | T,
    iterations: number = 1
  ): Promise<{ averageTime: number; minTime: number; maxTime: number; results: T[] }> {
    const times: number[] = [];
    const results: T[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const result = await fn();
      const end = performance.now();
      times.push(end - start);
      results.push(result);
    }

    return {
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      results
    };
  }

  static async loadTest<T>(
    fn: () => Promise<T> | T,
    concurrency: number = 10,
    duration: number = 5000
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    requestsPerSecond: number;
  }> {
    const startTime = Date.now();
    const promises: Promise<any>[] = [];
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    let totalResponseTime = 0;

    while (Date.now() - startTime < duration) {
      const concurrentPromises: Promise<any>[] = [];

      for (let i = 0; i < concurrency; i++) {
        const requestStart = Date.now();
        const promise = Promise.resolve(fn())
          .then(result => {
            successfulRequests++;
            totalResponseTime += Date.now() - requestStart;
            return result;
          })
          .catch(error => {
            failedRequests++;
            totalResponseTime += Date.now() - requestStart;
            return error;
          });

        concurrentPromises.push(promise);
        totalRequests++;
      }

      await Promise.all(concurrentPromises);
    }

    const totalDuration = Date.now() - startTime;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: totalResponseTime / totalRequests,
      requestsPerSecond: (totalRequests / totalDuration) * 1000
    };
  }

  static generateConcurrentRequests(count: number, delay: number = 0) {
    const requests = Array.from({ length: count }, (_, i) => ({
      id: `request-${i}`,
      name: `Concurrent API Key ${i}`,
      permissions: ['deals:read'],
      rate_limit: 500
    }));

    return requests.map((request, index) => 
      delay > 0 
        ? new Promise(resolve => setTimeout(() => resolve(request), index * delay))
        : Promise.resolve(request)
    );
  }
}

// Memory testing helpers
export class MemoryTestHelper {
  static getMemoryUsage() {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };
    }
    return null;
  }

  static async detectMemoryLeak(
    testFunction: () => Promise<void> | void,
    iterations: number = 100,
    threshold: number = 10 // MB
  ): Promise<{ hasLeak: boolean; initialMemory: number; finalMemory: number; difference: number }> {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const initialMemory = this.getMemoryUsage();
    
    for (let i = 0; i < iterations; i++) {
      await testFunction();
    }

    // Force garbage collection again
    if (global.gc) {
      global.gc();
    }

    const finalMemory = this.getMemoryUsage();
    
    if (!initialMemory || !finalMemory) {
      return { hasLeak: false, initialMemory: 0, finalMemory: 0, difference: 0 };
    }

    const difference = (finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize) / (1024 * 1024);
    
    return {
      hasLeak: difference > threshold,
      initialMemory: initialMemory.usedJSHeapSize,
      finalMemory: finalMemory.usedJSHeapSize,
      difference
    };
  }
}

// Database testing helpers
export class DatabaseTestHelper {
  static createMockSupabaseClient(overrides: any = {}) {
    const defaultMethods = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        like: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null })
      },
      functions: {
        invoke: vi.fn().mockResolvedValue({ data: null, error: null })
      },
      rpc: vi.fn().mockResolvedValue({ data: null, error: null })
    };

    return { ...defaultMethods, ...overrides };
  }

  static createMockDatabaseError(code: string, message: string, details?: any) {
    return {
      code,
      message,
      details,
      hint: null,
      error: null
    };
  }

  static simulateNetworkLatency(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Validation testing helpers
export class ValidationTestHelper {
  static generateInvalidInputs() {
    return {
      strings: {
        empty: '',
        tooLong: 'a'.repeat(1000),
        withSpecialChars: '<script>alert("xss")</script>',
        withNullBytes: 'test\x00test',
        withUnicode: '🔥💥🚀',
        justSpaces: '   ',
        mixedSpaces: '  test  '
      },
      numbers: {
        negative: -1,
        zero: 0,
        tooLarge: Number.MAX_SAFE_INTEGER + 1,
        float: 1.5,
        infinity: Infinity,
        negativeInfinity: -Infinity,
        nan: NaN
      },
      arrays: {
        empty: [],
        tooLarge: Array.from({ length: 1000 }, (_, i) => i),
        withNulls: [null, undefined, ''],
        mixed: [1, 'string', null, true, {}]
      },
      objects: {
        null: null,
        undefined: undefined,
        empty: {},
        circular: (() => {
          const obj: any = {};
          obj.self = obj;
          return obj;
        })()
      }
    };
  }

  static validateEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateUUIDFormat(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  static validatePermissionFormat(permission: string): boolean {
    const permissionRegex = /^[a-z_]+:(read|write|delete)$/;
    return permissionRegex.test(permission);
  }
}

// Async testing helpers
export class AsyncTestHelper {
  static timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    );
  }

  static race<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([promise, this.timeout(timeoutMs)]);
  }

  static async retry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 100
  ): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }

  static createDelayedPromise<T>(value: T, delay: number): Promise<T> {
    return new Promise(resolve => setTimeout(() => resolve(value), delay));
  }
}

// Test data generators
export class TestDataGenerator {
  static randomString(length: number = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static randomEmail(): string {
    const domains = ['example.com', 'test.com', 'demo.org', 'sample.net'];
    const username = this.randomString(8).toLowerCase();
    const domain = domains[Math.floor(Math.random() * domains.length)];
    return `${username}@${domain}`;
  }

  static randomUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  static randomApiKey(): string {
    return `ak_test_${this.randomString(16)}`;
  }

  static randomPermissions(count: number = 3): string[] {
    const allPermissions = [
      'deals:read', 'deals:write', 'deals:delete',
      'contacts:read', 'contacts:write', 'contacts:delete',
      'activities:read', 'activities:write', 'activities:delete',
      'analytics:read'
    ];
    
    const shuffled = allPermissions.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, allPermissions.length));
  }

  static randomRateLimit(): number {
    const limits = [100, 500, 1000, 5000];
    return limits[Math.floor(Math.random() * limits.length)];
  }

  static randomExpirationDays(): number | null {
    const days = [null, 30, 90, 365];
    return days[Math.floor(Math.random() * days.length)];
  }
}

export { SecurityTestHelper, APITestHelper, RateLimitTestHelper, PerformanceTestHelper, MemoryTestHelper, DatabaseTestHelper, ValidationTestHelper, AsyncTestHelper, TestDataGenerator };