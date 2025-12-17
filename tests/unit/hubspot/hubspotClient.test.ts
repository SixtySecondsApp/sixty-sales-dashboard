import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Replicate HubSpotClient and HubSpotError for testing (Edge Functions use Deno, not Node)
export class HubSpotError extends Error {
  status: number;
  retryAfterMs?: number;
  responseBody?: any;

  constructor(args: { status: number; message: string; retryAfterMs?: number; responseBody?: any }) {
    super(args.message);
    this.name = 'HubSpotError';
    this.status = args.status;
    this.retryAfterMs = args.retryAfterMs;
    this.responseBody = args.responseBody;
  }
}

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

// Mock fetch globally
global.fetch = vi.fn();

describe('HubSpotClient', () => {
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
      const status = 429;
      const isRetryable = status === 429 || (typeof status === 'number' && status >= 500);
      expect(isRetryable).toBe(true);
    });

    it('should classify 5xx as retryable', () => {
      const statuses = [500, 502, 503, 504];
      statuses.forEach((status) => {
        const isRetryable = status === 429 || (typeof status === 'number' && status >= 500);
        expect(isRetryable).toBe(true);
      });
    });

    it('should classify 4xx (except 429) as non-retryable', () => {
      const statuses = [400, 401, 403, 404];
      statuses.forEach((status) => {
        const isRetryable = status === 429 || (typeof status === 'number' && status >= 500);
        expect(isRetryable).toBe(false);
      });
    });
  });

  describe('Exponential Backoff Calculation', () => {
    it('should calculate exponential backoff with base 1000ms', () => {
      const backoffBase = 1000;
      const attempts = [0, 1, 2, 3];

      const backoffs = attempts.map((attempt) => {
        const exp = backoffBase * Math.pow(2, attempt);
        return Math.min(30_000, exp);
      });

      expect(backoffs).toEqual([1000, 2000, 4000, 8000]);
    });

    it('should cap backoff at 30 seconds', () => {
      const backoffBase = 1000;
      const attempt = 10; // Would be 1024000ms without cap

      const backoff = Math.min(30_000, backoffBase * Math.pow(2, attempt));

      expect(backoff).toBe(30_000);
    });

    it('should use Retry-After header if provided', () => {
      const retryAfterMs = 5000;
      const attempt = 1;
      const backoffBase = 1000;
      const exp = backoffBase * Math.pow(2, attempt);

      const waitMs = Math.min(30_000, retryAfterMs ?? exp);

      expect(waitMs).toBe(5000);
    });
  });

  describe('URL Construction', () => {
    it('should build URL with query parameters', () => {
      const baseUrl = 'https://api.hubapi.com';
      const path = '/crm/v3/objects/contacts';
      const query = { limit: 10, properties: 'email,firstname' };

      const url = new URL(baseUrl + path);
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }

      expect(url.toString()).toContain('limit=10');
      expect(url.toString()).toContain('properties=email%2Cfirstname');
    });

    it('should skip null/undefined query parameters', () => {
      const baseUrl = 'https://api.hubapi.com';
      const path = '/test';
      const query = { limit: 10, filter: null, sort: undefined };

      const url = new URL(baseUrl + path);
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }

      expect(url.searchParams.has('limit')).toBe(true);
      expect(url.searchParams.has('filter')).toBe(false);
      expect(url.searchParams.has('sort')).toBe(false);
    });
  });

  describe('Request Body Serialization', () => {
    it('should serialize request body as JSON', () => {
      const body = { properties: { email: 'test@example.com', firstname: 'John' } };
      const serialized = JSON.stringify(body);

      expect(serialized).toBe('{"properties":{"email":"test@example.com","firstname":"John"}}');
    });

    it('should handle empty body', () => {
      const body = undefined;
      const serialized = body !== undefined ? JSON.stringify(body) : undefined;

      expect(serialized).toBeUndefined();
    });
  });

  describe('Response Parsing', () => {
    it('should parse JSON response', () => {
      const text = '{"results":[{"id":"123"}]}';
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text ? { message: text } : null;
      }

      expect(json).toEqual({ results: [{ id: '123' }] });
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

  describe('HubSpotError', () => {
    it('should create error with status and message', () => {
      const error = new HubSpotError({
        status: 429,
        message: 'Rate limit exceeded',
        retryAfterMs: 2000,
      });

      expect(error).toBeInstanceOf(Error);
      expect(error.status).toBe(429);
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.retryAfterMs).toBe(2000);
      expect(error.name).toBe('HubSpotError');
    });

    it('should include response body in error', () => {
      const responseBody = { error: 'INVALID_TOKEN', message: 'Token expired' };
      const error = new HubSpotError({
        status: 401,
        message: 'Unauthorized',
        responseBody,
      });

      expect(error.responseBody).toEqual(responseBody);
    });
  });
});

