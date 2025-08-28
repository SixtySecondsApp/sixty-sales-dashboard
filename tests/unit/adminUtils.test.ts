import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canSplitDeals } from '../../src/lib/utils/adminUtils';

// Mock logger
vi.mock('../../src/lib/utils/logger', () => ({
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('adminUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('canSplitDeals', () => {
    it('should return true for user with is_admin flag', () => {
      const adminUser = {
        id: 'user123',
        email: 'admin@example.com',
        is_admin: true,
        user_metadata: {}
      };

      expect(canSplitDeals(adminUser)).toBe(true);
    });

    it('should return true for user with admin role in user_metadata', () => {
      const adminUser = {
        id: 'user123',
        email: 'admin@example.com',
        user_metadata: {
          role: 'admin'
        }
      };

      expect(canSplitDeals(adminUser)).toBe(true);
    });

    it('should return true for user with super_admin role', () => {
      const superAdminUser = {
        id: 'user123',
        email: 'superadmin@example.com',
        user_metadata: {
          role: 'super_admin'
        }
      };

      expect(canSplitDeals(superAdminUser)).toBe(true);
    });

    it('should return false for regular user', () => {
      const regularUser = {
        id: 'user123',
        email: 'user@example.com',
        is_admin: false,
        user_metadata: {
          role: 'user'
        }
      };

      expect(canSplitDeals(regularUser)).toBe(false);
    });

    it('should return false for user without role', () => {
      const userWithoutRole = {
        id: 'user123',
        email: 'user@example.com',
        user_metadata: {}
      };

      expect(canSplitDeals(userWithoutRole)).toBe(false);
    });

    it('should return false for null user', () => {
      expect(canSplitDeals(null)).toBe(false);
    });

    it('should return false for undefined user', () => {
      expect(canSplitDeals(undefined)).toBe(false);
    });

    it('should return false for user without user_metadata', () => {
      const userWithoutMetadata = {
        id: 'user123',
        email: 'user@example.com'
      };

      expect(canSplitDeals(userWithoutMetadata)).toBe(false);
    });

    it('should handle case-insensitive role comparison', () => {
      const adminUserUpperCase = {
        id: 'user123',
        email: 'admin@example.com',
        user_metadata: {
          role: 'ADMIN'
        }
      };

      const adminUserMixedCase = {
        id: 'user123',
        email: 'admin@example.com',
        user_metadata: {
          role: 'Admin'
        }
      };

      expect(canSplitDeals(adminUserUpperCase)).toBe(true);
      expect(canSplitDeals(adminUserMixedCase)).toBe(true);
    });

    it('should prioritize is_admin flag over role', () => {
      const userWithConflictingData = {
        id: 'user123',
        email: 'user@example.com',
        is_admin: true,
        user_metadata: {
          role: 'user' // Conflicting role
        }
      };

      expect(canSplitDeals(userWithConflictingData)).toBe(true);
    });
  });

  // Additional admin utility tests would go here
  // These would test other functions like canRemoveSplitDeals, canEditDeal, etc.
  // if they exist in the adminUtils file
});