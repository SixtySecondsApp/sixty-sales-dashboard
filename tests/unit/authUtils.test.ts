import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authUtils } from '../../src/lib/supabase/clientV2';

// Mock Supabase client
const mockSupabaseAuth = {
  getSession: vi.fn(),
  refreshSession: vi.fn()
};

vi.mock('../../src/lib/supabase/clientV2', async () => {
  const actual = await vi.importActual('../../src/lib/supabase/clientV2');
  return {
    ...actual,
    supabase: {
      auth: mockSupabaseAuth
    }
  };
});

describe('authUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  describe('isAuthenticated', () => {
    it('should return true for valid session', () => {
      const validSession = {
        user: { id: 'user123' },
        access_token: 'token123'
      };
      expect(authUtils.isAuthenticated(validSession as any)).toBe(true);
    });

    it('should return false for null session', () => {
      expect(authUtils.isAuthenticated(null)).toBe(false);
    });

    it('should return false for session without user', () => {
      const invalidSession = {
        access_token: 'token123'
      };
      expect(authUtils.isAuthenticated(invalidSession as any)).toBe(false);
    });

    it('should return false for session without access token', () => {
      const invalidSession = {
        user: { id: 'user123' }
      };
      expect(authUtils.isAuthenticated(invalidSession as any)).toBe(false);
    });
  });

  describe('getUserId', () => {
    it('should return user ID from valid session', () => {
      const session = {
        user: { id: 'user123' }
      };
      expect(authUtils.getUserId(session as any)).toBe('user123');
    });

    it('should return null for null session', () => {
      expect(authUtils.getUserId(null)).toBe(null);
    });

    it('should return null for session without user', () => {
      const session = {};
      expect(authUtils.getUserId(session as any)).toBe(null);
    });
  });

  describe('formatAuthError', () => {
    it('should format 403 errors correctly', () => {
      const error = { status: 403, message: 'Forbidden' };
      const formatted = authUtils.formatAuthError(error);
      expect(formatted).toContain('Access denied');
      expect(formatted).toContain('permission');
    });

    it('should format 401 errors correctly', () => {
      const error = { status: 401, message: 'Unauthorized' };
      const formatted = authUtils.formatAuthError(error);
      expect(formatted).toContain('Authentication required');
    });

    it('should format rate limit errors correctly', () => {
      const error = { status: 429, message: 'Too many requests' };
      const formatted = authUtils.formatAuthError(error);
      expect(formatted).toContain('Too many requests');
    });

    it('should handle common error messages', () => {
      const scenarios = [
        {
          input: { message: 'Invalid login credentials' },
          expected: 'Invalid email or password'
        },
        {
          input: { message: 'Email not confirmed' },
          expected: 'check your email'
        },
        {
          input: { message: 'JWT expired' },
          expected: 'session has expired'
        },
        {
          input: { message: 'permission denied' },
          expected: 'permission to perform'
        }
      ];

      scenarios.forEach(({ input, expected }) => {
        const result = authUtils.formatAuthError(input);
        expect(result.toLowerCase()).toContain(expected.toLowerCase());
      });
    });

    it('should handle null or undefined errors', () => {
      expect(authUtils.formatAuthError(null)).toBe('An unknown error occurred');
      expect(authUtils.formatAuthError(undefined)).toBe('An unknown error occurred');
    });
  });

  describe('isAuthError', () => {
    it('should identify 401 as auth error', () => {
      const error = { status: 401 };
      expect(authUtils.isAuthError(error)).toBe(true);
    });

    it('should identify 403 as auth error', () => {
      const error = { status: 403 };
      expect(authUtils.isAuthError(error)).toBe(true);
    });

    it('should identify JWT errors as auth errors', () => {
      const errors = [
        { message: 'JWT expired' },
        { message: 'jwt malformed' },
        { message: 'JWT token invalid' }
      ];
      errors.forEach(error => {
        expect(authUtils.isAuthError(error)).toBe(true);
      });
    });

    it('should identify permission errors as auth errors', () => {
      const errors = [
        { message: 'unauthorized access' },
        { message: 'forbidden operation' },
        { message: 'permission denied' },
        { message: 'row-level security violation' }
      ];
      errors.forEach(error => {
        expect(authUtils.isAuthError(error)).toBe(true);
      });
    });

    it('should not identify non-auth errors', () => {
      const errors = [
        { status: 404 },
        { status: 500 },
        { message: 'Network error' },
        { message: 'Validation failed' }
      ];
      errors.forEach(error => {
        expect(authUtils.isAuthError(error)).toBe(false);
      });
    });
  });

  describe('clearAuthStorage', () => {
    it('should clear all auth-related localStorage items', () => {
      const mockRemoveItem = vi.fn();
      Object.defineProperty(window, 'localStorage', {
        value: { removeItem: mockRemoveItem },
        writable: true,
      });

      authUtils.clearAuthStorage();

      const expectedKeys = [
        'sb.auth.v2',
        'sb.auth.admin.v2',
        'supabase.auth.token',
        'sb-refresh-token',
        'sb-access-token'
      ];

      expectedKeys.forEach(key => {
        expect(mockRemoveItem).toHaveBeenCalledWith(key);
      });
    });

    it('should handle localStorage errors gracefully', () => {
      const mockRemoveItem = vi.fn(() => {
        throw new Error('localStorage error');
      });
      Object.defineProperty(window, 'localStorage', {
        value: { removeItem: mockRemoveItem },
        writable: true,
      });

      // Should not throw
      expect(() => authUtils.clearAuthStorage()).not.toThrow();
    });
  });

  describe('diagnoseSession', () => {
    it('should return invalid for session error', async () => {
      const error = new Error('Session error');
      mockSupabaseAuth.getSession.mockResolvedValue({ error, data: { session: null } });

      const result = await authUtils.diagnoseSession();

      expect(result.isValid).toBe(false);
      expect(result.session).toBe(null);
      expect(result.issues).toContain('Session error: Session error');
    });

    it('should return invalid for no session', async () => {
      mockSupabaseAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });

      const result = await authUtils.diagnoseSession();

      expect(result.isValid).toBe(false);
      expect(result.session).toBe(null);
      expect(result.issues).toContain('No active session found');
    });

    it('should identify missing access token', async () => {
      const session = { user: { id: 'user123' } };
      mockSupabaseAuth.getSession.mockResolvedValue({ data: { session }, error: null });

      const result = await authUtils.diagnoseSession();

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Session missing access token');
    });

    it('should identify missing user data', async () => {
      const session = { access_token: 'token123' };
      mockSupabaseAuth.getSession.mockResolvedValue({ data: { session }, error: null });

      const result = await authUtils.diagnoseSession();

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Session missing user data');
    });

    it('should identify expired session', async () => {
      const expiredTime = Date.now() / 1000 - 1000; // 1000 seconds ago
      const session = {
        user: { id: 'user123' },
        access_token: 'token123',
        expires_at: expiredTime
      };
      mockSupabaseAuth.getSession.mockResolvedValue({ data: { session }, error: null });

      const result = await authUtils.diagnoseSession();

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Session has expired');
    });

    it('should return valid for complete session', async () => {
      const futureTime = Date.now() / 1000 + 1000; // 1000 seconds in future
      const session = {
        user: { id: 'user123', email: 'test@example.com' },
        access_token: 'token123',
        expires_at: futureTime
      };
      mockSupabaseAuth.getSession.mockResolvedValue({ data: { session }, error: null });

      const result = await authUtils.diagnoseSession();

      expect(result.isValid).toBe(true);
      expect(result.session).toEqual(session);
      expect(result.user).toEqual(session.user);
      expect(result.issues).toHaveLength(0);
    });

    it('should handle unexpected errors', async () => {
      mockSupabaseAuth.getSession.mockRejectedValue(new Error('Unexpected error'));

      const result = await authUtils.diagnoseSession();

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Unexpected error: Unexpected error');
    });
  });
});