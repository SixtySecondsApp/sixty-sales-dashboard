import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock environment variables
process.env.VITE_SUPABASE_URL = 'https://test-project.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret-very-long-key-for-testing-purposes-minimum-256-bits';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
      limit: vi.fn().mockReturnThis()
    })),
    functions: {
      invoke: vi.fn()
    },
    rpc: vi.fn()
  }))
}));

// Mock DOM APIs
Object.defineProperty(window, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2, 15),
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: {
      digest: vi.fn().mockImplementation(async (algorithm: string, data: BufferSource) => {
        // Simple mock hash function
        const text = new TextDecoder().decode(data);
        return new TextEncoder().encode('mocked-hash-' + text.length);
      })
    }
  }
});

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue('')
  }
});

// Mock fetch for Edge Function calls
global.fetch = vi.fn();

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Suppress console output during tests unless needed
  console.error = vi.fn();
  console.warn = vi.fn();
});

afterAll(() => {
  // Restore console methods
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Reset fetch mock
  (global.fetch as any).mockClear();
  
  // Reset DOM
  document.body.innerHTML = '';
});

afterEach(() => {
  // Cleanup after each test
  cleanup();
  vi.clearAllMocks();
});

// Helper function to create mock JWT tokens
export function createMockJWT(payload: Record<string, any> = {}, isValid: boolean = true): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const defaultPayload = {
    sub: 'test-user-id',
    email: 'test@example.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    ...payload
  };

  if (!isValid) {
    // Create an invalid token by corrupting the signature
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid_signature';
  }

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(defaultPayload)).toString('base64url');
  const signature = 'mocked_signature_' + Math.random().toString(36);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Helper function to create mock API key
export function createMockApiKey(overrides: Partial<any> = {}): any {
  return {
    id: 'test-key-id',
    name: 'Test API Key',
    key_preview: 'ak_test_1234...5678',
    full_key: 'ak_test_1234567890abcdef',
    permissions: ['deals:read', 'contacts:read'],
    rate_limit: 500,
    usage_count: 0,
    last_used: null,
    created_at: new Date(),
    expires_at: null,
    is_active: true,
    user_id: 'test-user-id',
    ...overrides
  };
}

// Helper function to mock Supabase responses
export function mockSupabaseResponse(data: any, error: any = null) {
  return { data, error };
}

// Helper function to mock Edge Function responses
export function mockEdgeFunctionResponse(
  status: number = 200,
  body: any = {},
  headers: Record<string, string> = {}
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers({
      'Content-Type': 'application/json',
      ...headers
    }),
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body))
  } as any;
}

// Rate limit testing helpers
export class MockRateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  get(key: string) {
    return this.store.get(key);
  }

  set(key: string, value: { count: number; resetTime: number }) {
    this.store.set(key, value);
  }

  clear() {
    this.store.clear();
  }

  size() {
    return this.store.size;
  }
}

// Error testing helpers
export const commonErrors = {
  // Database errors
  TABLE_NOT_FOUND: { code: '42P01', message: 'relation "api_keys" does not exist' },
  DUPLICATE_KEY: { code: '23505', message: 'duplicate key value violates unique constraint' },
  INVALID_USER: { code: '23503', message: 'invalid user reference' },
  
  // Authentication errors
  INVALID_TOKEN: { message: 'Invalid or expired token' },
  MISSING_AUTH: { message: 'Authorization header is missing' },
  
  // Rate limiting errors
  RATE_LIMIT_EXCEEDED: { message: 'Rate limit exceeded' },
  
  // Validation errors
  INVALID_JSON: { message: 'Invalid JSON in request body' },
  INVALID_PERMISSIONS: { message: 'Invalid permissions specified' },
  INVALID_NAME: { message: 'Invalid name field' }
};

// Test data generators
export const testData = {
  validCreateRequest: {
    name: 'Test API Key',
    permissions: ['deals:read', 'contacts:read'],
    rate_limit: 500,
    expires_in_days: 90
  },
  
  invalidCreateRequests: [
    { name: '', permissions: ['deals:read'] }, // Empty name
    { name: 'Test', permissions: [] }, // No permissions
    { name: 'Test', permissions: ['invalid:permission'] }, // Invalid permission
    { name: 'Test', permissions: ['deals:read'], rate_limit: 0 }, // Invalid rate limit
    { name: 'Test', permissions: ['deals:read'], expires_in_days: 0 }, // Invalid expiration
  ],
  
  xssPayloads: [
    '<script>alert("xss")</script>',
    '"><script>alert("xss")</script>',
    'javascript:alert("xss")',
    '<img src=x onerror=alert("xss")>',
    '&lt;script&gt;alert("xss")&lt;/script&gt;',
  ],
  
  sqlInjectionPayloads: [
    "'; DROP TABLE api_keys; --",
    "1' OR '1'='1",
    "'; UPDATE users SET is_admin = true; --",
    "UNION SELECT * FROM users--",
  ]
};

// Performance testing helpers
export function measureExecutionTime<T>(fn: () => T | Promise<T>): Promise<{ result: T; duration: number }> {
  return new Promise(async (resolve) => {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      resolve({ result, duration });
    } catch (error) {
      const duration = performance.now() - start;
      throw new Error(`Function failed after ${duration}ms: ${error}`);
    }
  });
}

export function generateLoadTestData(count: number = 100) {
  return Array.from({ length: count }, (_, i) => ({
    name: `Load Test Key ${i + 1}`,
    permissions: ['deals:read', 'contacts:read'],
    rate_limit: 500,
    expires_in_days: 90
  }));
}

// Memory leak detection
export function detectMemoryLeaks() {
  if (typeof performance !== 'undefined' && performance.memory) {
    return {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
    };
  }
  return null;
}

// Export all utilities
export * from './utils/testHelpers';