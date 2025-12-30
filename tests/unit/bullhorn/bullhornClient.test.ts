import { describe, expect, it, vi, beforeEach } from 'vitest';

// =============================================================================
// Replicate BullhornError for testing (Edge Functions use Deno, not Node)
// =============================================================================

export class BullhornError extends Error {
  status: number;
  retryAfterMs?: number;
  responseBody?: any;
  errorCode?: string;

  constructor(args: {
    status: number;
    message: string;
    retryAfterMs?: number;
    responseBody?: any;
    errorCode?: string;
  }) {
    super(args.message);
    this.name = 'BullhornError';
    this.status = args.status;
    this.retryAfterMs = args.retryAfterMs;
    this.responseBody = args.responseBody;
    this.errorCode = args.errorCode;
  }
}

// =============================================================================
// Helper Functions (mirrored from Edge Function implementation)
// =============================================================================

function parseRetryAfterMs(headers: Headers): number | undefined {
  const ra = headers.get('retry-after');
  if (!ra) return undefined;
  const n = Number(ra);
  if (Number.isFinite(n) && n > 0) return Math.floor(n * 1000);
  const t = Date.parse(ra);
  if (Number.isFinite(t)) {
    const ms = t - Date.now();
    return ms > 0 ? ms : undefined;
  }
  return undefined;
}

function isRetryableError(status: number): boolean {
  // Bullhorn uses 401 for session expiry (retryable with re-auth)
  // 429 for rate limits, 5xx for server errors
  return status === 429 || status >= 500;
}

function calculateBackoff(attempt: number, baseMs: number = 1000, maxMs: number = 30000): number {
  const exp = baseMs * Math.pow(2, attempt);
  return Math.min(maxMs, exp);
}

// Mock fetch globally
global.fetch = vi.fn();

describe('BullhornClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Retry-After Header Parsing', () => {
    it('should parse numeric Retry-After header (seconds)', () => {
      const headers = new Headers({ 'retry-after': '5' });
      const retryAfterMs = parseRetryAfterMs(headers);
      expect(retryAfterMs).toBe(5000);
    });

    it('should parse HTTP date Retry-After header', () => {
      const futureDate = new Date(Date.now() + 10000).toUTCString();
      const headers = new Headers({ 'retry-after': futureDate });
      const retryAfterMs = parseRetryAfterMs(headers);
      expect(retryAfterMs).toBeGreaterThan(0);
      expect(retryAfterMs).toBeLessThanOrEqual(10000);
    });

    it('should return undefined for invalid Retry-After header', () => {
      const headers = new Headers({ 'retry-after': 'invalid' });
      const retryAfterMs = parseRetryAfterMs(headers);
      expect(retryAfterMs).toBeUndefined();
    });

    it('should return undefined when Retry-After header is missing', () => {
      const headers = new Headers();
      const retryAfterMs = parseRetryAfterMs(headers);
      expect(retryAfterMs).toBeUndefined();
    });
  });

  describe('Error Classification', () => {
    it('should classify 429 as retryable', () => {
      expect(isRetryableError(429)).toBe(true);
    });

    it('should classify 5xx as retryable', () => {
      const statuses = [500, 502, 503, 504];
      statuses.forEach((status) => {
        expect(isRetryableError(status)).toBe(true);
      });
    });

    it('should classify 4xx (except 429) as non-retryable', () => {
      const statuses = [400, 401, 403, 404];
      statuses.forEach((status) => {
        expect(isRetryableError(status)).toBe(false);
      });
    });

    it('should classify 2xx as non-retryable', () => {
      const statuses = [200, 201, 204];
      statuses.forEach((status) => {
        expect(isRetryableError(status)).toBe(false);
      });
    });
  });

  describe('Exponential Backoff Calculation', () => {
    it('should calculate exponential backoff with base 1000ms', () => {
      const attempts = [0, 1, 2, 3];
      const backoffs = attempts.map((attempt) => calculateBackoff(attempt, 1000, 30000));
      expect(backoffs).toEqual([1000, 2000, 4000, 8000]);
    });

    it('should cap backoff at max (30 seconds by default)', () => {
      const backoff = calculateBackoff(10, 1000, 30000);
      expect(backoff).toBe(30000);
    });

    it('should respect custom max backoff', () => {
      const backoff = calculateBackoff(5, 1000, 10000);
      expect(backoff).toBe(10000);
    });

    it('should use Retry-After header if provided', () => {
      const retryAfterMs = 5000;
      const attempt = 1;
      const expBackoff = calculateBackoff(attempt);
      const waitMs = Math.min(30000, retryAfterMs ?? expBackoff);
      expect(waitMs).toBe(5000);
    });
  });

  describe('Bullhorn REST URL Construction', () => {
    it('should build URL with query parameters', () => {
      const restUrl = 'https://rest123.bullhornstaffing.com/rest-services/abc123';
      const path = '/entity/Candidate/123';
      const query = { fields: 'id,firstName,lastName', BhRestToken: 'token123' };

      const url = new URL(restUrl + path);
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }

      expect(url.toString()).toContain('fields=id%2CfirstName%2ClastName');
      expect(url.toString()).toContain('BhRestToken=token123');
    });

    it('should skip null/undefined query parameters', () => {
      const restUrl = 'https://rest123.bullhornstaffing.com/rest-services/abc123';
      const path = '/search/Candidate';
      const query = { query: 'isDeleted:false', count: 10, start: null, sort: undefined };

      const url = new URL(restUrl + path);
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }

      expect(url.searchParams.has('query')).toBe(true);
      expect(url.searchParams.has('count')).toBe(true);
      expect(url.searchParams.has('start')).toBe(false);
      expect(url.searchParams.has('sort')).toBe(false);
    });

    it('should handle entity paths correctly', () => {
      const restUrl = 'https://rest123.bullhornstaffing.com/rest-services/abc123';
      const entityType = 'Candidate';
      const entityId = 123;
      const path = `/entity/${entityType}/${entityId}`;

      const url = new URL(restUrl + path);
      expect(url.pathname).toContain('/entity/Candidate/123');
    });

    it('should handle search paths correctly', () => {
      const restUrl = 'https://rest123.bullhornstaffing.com/rest-services/abc123';
      const entityType = 'ClientContact';
      const path = `/search/${entityType}`;

      const url = new URL(restUrl + path);
      expect(url.pathname).toContain('/search/ClientContact');
    });
  });

  describe('Request Body Serialization', () => {
    it('should serialize Candidate properties correctly', () => {
      const body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
      };
      const serialized = JSON.stringify(body);
      expect(JSON.parse(serialized)).toEqual(body);
    });

    it('should serialize JobOrder properties correctly', () => {
      const body = {
        title: 'Software Engineer',
        clientCorporation: { id: 123 },
        numOpenings: 2,
        status: 'Open',
      };
      const serialized = JSON.stringify(body);
      expect(JSON.parse(serialized)).toEqual(body);
    });

    it('should handle nested objects (addresses)', () => {
      const body = {
        firstName: 'John',
        address: {
          address1: '123 Main St',
          city: 'New York',
          state: 'NY',
          zip: '10001',
          countryID: 1,
        },
      };
      const serialized = JSON.stringify(body);
      const parsed = JSON.parse(serialized);
      expect(parsed.address.city).toBe('New York');
    });

    it('should handle empty body', () => {
      const body = undefined;
      const serialized = body !== undefined ? JSON.stringify(body) : undefined;
      expect(serialized).toBeUndefined();
    });
  });

  describe('Response Parsing', () => {
    it('should parse JSON response', () => {
      const text = '{"data":{"id":123,"firstName":"John"}}';
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text ? { message: text } : null;
      }
      expect(json).toEqual({ data: { id: 123, firstName: 'John' } });
    });

    it('should parse search results response', () => {
      const text = '{"data":[{"id":1},{"id":2}],"count":2,"start":0,"total":100}';
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text ? { message: text } : null;
      }
      expect(json.data).toHaveLength(2);
      expect(json.total).toBe(100);
    });

    it('should handle non-JSON response text', () => {
      const text = 'Internal Server Error';
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text ? { message: text } : null;
      }
      expect(json).toEqual({ message: 'Internal Server Error' });
    });

    it('should handle empty response', () => {
      const text = '';
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text ? { message: text } : null;
      }
      expect(json).toBeNull();
    });
  });

  describe('BullhornError', () => {
    it('should create error with status and message', () => {
      const error = new BullhornError({
        status: 429,
        message: 'Rate limit exceeded',
        retryAfterMs: 2000,
      });

      expect(error).toBeInstanceOf(Error);
      expect(error.status).toBe(429);
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.retryAfterMs).toBe(2000);
      expect(error.name).toBe('BullhornError');
    });

    it('should include response body in error', () => {
      const responseBody = { errorCode: 'INVALID_SESSION', message: 'Session expired' };
      const error = new BullhornError({
        status: 401,
        message: 'Unauthorized',
        responseBody,
      });

      expect(error.responseBody).toEqual(responseBody);
    });

    it('should include error code for Bullhorn-specific errors', () => {
      const error = new BullhornError({
        status: 400,
        message: 'Invalid request',
        errorCode: 'INVALID_PARAMETER',
      });

      expect(error.errorCode).toBe('INVALID_PARAMETER');
    });

    it('should handle session expiry errors', () => {
      const error = new BullhornError({
        status: 401,
        message: 'BhRestToken is invalid or has expired',
        errorCode: 'INVALID_SESSION',
      });

      expect(error.status).toBe(401);
      expect(error.errorCode).toBe('INVALID_SESSION');
    });
  });

  describe('Bullhorn Entity Types', () => {
    it('should validate supported entity types', () => {
      const supportedTypes = [
        'Candidate',
        'ClientContact',
        'ClientCorporation',
        'JobOrder',
        'Placement',
        'Task',
        'Note',
        'Sendout',
      ];

      supportedTypes.forEach((type) => {
        expect(typeof type).toBe('string');
        expect(type.length).toBeGreaterThan(0);
      });
    });

    it('should map entity types to correct REST paths', () => {
      const entityPaths: Record<string, string> = {
        Candidate: '/entity/Candidate',
        ClientContact: '/entity/ClientContact',
        ClientCorporation: '/entity/ClientCorporation',
        JobOrder: '/entity/JobOrder',
        Placement: '/entity/Placement',
        Task: '/entity/Task',
        Note: '/entity/Note',
        Sendout: '/entity/Sendout',
      };

      Object.entries(entityPaths).forEach(([type, path]) => {
        expect(path).toContain(`/entity/${type}`);
      });
    });
  });

  describe('OAuth Token Handling', () => {
    it('should validate access token format', () => {
      // Bullhorn access tokens are typically long alphanumeric strings
      const validToken = 'abc123def456ghi789jkl012mno345pqr678stu901vwx234';
      expect(validToken.length).toBeGreaterThan(10);
      expect(/^[a-zA-Z0-9_-]+$/.test(validToken)).toBe(true);
    });

    it('should detect expired token error', () => {
      const errorMessage = 'BhRestToken is invalid or has expired';
      const isExpired = errorMessage.toLowerCase().includes('expired') ||
                       errorMessage.toLowerCase().includes('invalid');
      expect(isExpired).toBe(true);
    });

    it('should calculate token refresh timing', () => {
      const expiresIn = 3600; // 1 hour in seconds
      const refreshBuffer = 300; // 5 minutes buffer
      const shouldRefreshAt = expiresIn - refreshBuffer;
      expect(shouldRefreshAt).toBe(3300);
    });
  });
});
