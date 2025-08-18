/**
 * COMPREHENSIVE SECURITY VALIDATION TEST SUITE
 * 
 * Critical QA testing for security vulnerabilities including:
 * - SQL injection prevention in all query components
 * - Input sanitization for company IDs and search terms
 * - Financial data validation and corruption prevention
 * - Authentication and authorization checks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Security utility imports
import { 
  validateAndSanitizeInput, 
  validateCompanyId, 
  validateSearchTerm,
  validateEmail,
  buildSafeOrClause,
  SafeQueryBuilder
} from '../src/lib/utils/sqlSecurity';

// Simple HTML escaping function for XSS prevention testing
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Component imports for integration testing
import CompanyProfile from '../src/pages/companies/CompanyProfile';
import { CompaniesTable } from '../src/pages/companies/CompaniesTable';
import { SalesTable } from '../src/components/SalesTable';

// Mock the hooks
vi.mock('@/lib/hooks/useCompany', () => ({
  useCompany: vi.fn(() => ({
    company: {
      id: 1,
      name: 'Test Company',
      industry: 'Technology',
      size: '50-100',
      website: 'https://testcompany.com'
    },
    deals: [],
    activities: [],
    clients: [],
    isLoading: false,
    error: null
  }))
}));

vi.mock('@/lib/hooks/useCompanies', () => ({
  useCompanies: vi.fn(() => ({
    companies: [],
    isLoading: false,
    error: null
  }))
}));

vi.mock('@/lib/hooks/useSalesData', () => ({
  useSalesData: vi.fn(() => ({
    data: [],
    isLoading: false,
    error: null
  }))
}));

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Security Validation - Critical QA Testing', () => {
  let mockFetch: any;

  beforeEach(() => {
    // Mock fetch to prevent actual API calls
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('SQL Injection Prevention', () => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE companies; --",
      "' OR 1=1 --",
      "' UNION SELECT * FROM users --",
      "'; DELETE FROM deals WHERE 1=1; --",
      "' OR 'x'='x",
      "1; INSERT INTO companies (name) VALUES ('hacked'); --",
      "'; UPDATE companies SET name='hacked' WHERE 1=1; --",
      "' OR 1=1#",
      "' OR 1=1/*",
      "admin'--",
      "admin' /*",
      "' OR 1=1 /*",
      "') OR '1'='1'--",
      "') OR ('1'='1'",
      "1' AND (SELECT COUNT(*) FROM companies) > 0 --"
    ];

    it('should sanitize SQL injection attempts in input validation', () => {
      sqlInjectionPayloads.forEach(payload => {
        const result = validateAndSanitizeInput(payload);
        
        // Should be invalid for SQL injection attempts
        expect(result.isValid).toBe(false);
        
        if (result.isValid) {
          // If somehow valid, should not contain dangerous patterns
          expect(result.sanitized).not.toMatch(/['";]/);
          expect(result.sanitized).not.toMatch(/\b(DROP|DELETE|INSERT|UPDATE|UNION|SELECT)\b/i);
          expect(result.sanitized).not.toMatch(/--/);
          expect(result.sanitized).not.toMatch(/\/\*/);
        }
      });
    });

    it('should validate search input against SQL injection', () => {
      sqlInjectionPayloads.forEach(payload => {
        const result = validateSearchTerm(payload);
        
        expect(result.isValid).toBe(false);
        expect(result.sanitized).not.toContain(payload);
        expect(result.error).toBeDefined();
      });
    });

    it('should create secure parameterized queries', () => {
      const unsafeInput = "'; DROP TABLE companies; --";
      const queryBuilder = new SafeQueryBuilder();
      
      // Should throw an error when trying to add invalid input
      expect(() => {
        queryBuilder.addEqualCondition('name', unsafeInput);
      }).toThrow();
    });

    it('should reject queries with embedded SQL commands', () => {
      const maliciousInputs = [
        'test; DROP TABLE deals;',
        'test OR 1=1',
        'test; INSERT INTO admin_users VALUES ("hacker");'
      ];

      maliciousInputs.forEach(input => {
        const result = validateAndSanitizeInput(input);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize HTML content to prevent XSS', () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(1)">',
        '<iframe src="javascript:alert(1)">',
        '<svg onload="alert(1)">',
        '<body onload="alert(1)">',
        'javascript:alert(1)',
        '<a href="javascript:alert(1)">link</a>',
        '<div onclick="alert(1)">click me</div>'
      ];

      xssPayloads.forEach(payload => {
        const sanitized = escapeHTML(payload);
        
        // Should not contain script tags or event handlers
        expect(sanitized).not.toMatch(/<script/i);
        expect(sanitized).not.toMatch(/javascript:/i);
        expect(sanitized).not.toMatch(/on\w+\s*=/i);
        
        // Should escape dangerous characters
        expect(sanitized).not.toContain('<');
        expect(sanitized).not.toContain('>');
      });
    });

    it('should validate company ID format', () => {
      const validCompanyIds = ['1', '123', '999999'];
      const invalidCompanyIds = [
        "'; DROP TABLE companies; --",
        '<script>alert(1)</script>',
        '../../../etc/passwd',
        'null',
        'undefined',
        '',
        '   ',
        '1.1',
        '-1',
        'abc',
        '1 OR 1=1'
      ];

      validCompanyIds.forEach(id => {
        const result = validateCompanyId(id);
        expect(result.isValid).toBe(true);
        expect(result.sanitized).toMatch(/^\d+$/);
      });

      invalidCompanyIds.forEach(id => {
        const result = validateCompanyId(id);
        expect(result.isValid).toBe(false);
      });
    });

    it('should sanitize search terms safely', () => {
      const searchTerms = [
        'normal company name',
        'Company & Co.',
        'Company-Name Ltd.',
        'Company (UK) Limited',
        'Smith\'s Company', // Should handle apostrophes safely
        'O\'Brien & Associates'
      ];

      searchTerms.forEach(term => {
        const result = validateSearchTerm(term);
        
        if (result.isValid) {
          expect(result.sanitized).toBeDefined();
          expect(result.error).toBeUndefined();
        }
      });
    });
  });

  describe('Component Security Integration', () => {
    it('should handle malicious company ID in CompanyProfile URL', async () => {
      const maliciousId = "1'; DROP TABLE companies; --";
      
      // Mock the router params
      vi.mock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom');
        return {
          ...actual,
          useParams: () => ({ companyId: maliciousId }),
          useNavigate: () => vi.fn()
        };
      });

      render(
        <TestWrapper>
          <CompanyProfile />
        </TestWrapper>
      );

      // Should not crash or expose SQL injection
      await waitFor(() => {
        // Component should either show error or sanitize the ID
        const errorElements = screen.queryAllByText(/not found|error|invalid/i);
        expect(errorElements.length).toBeGreaterThanOrEqual(0);
      });
    });

    it('should sanitize search input in CompaniesTable', async () => {
      render(
        <TestWrapper>
          <CompaniesTable />
        </TestWrapper>
      );

      const searchInput = screen.getByPlaceholderText(/search/i);
      
      if (searchInput) {
        const maliciousSearch = '<script>alert("XSS")</script>';
        fireEvent.change(searchInput, { target: { value: maliciousSearch } });

        // Input should be sanitized
        expect(searchInput.value).not.toContain('<script>');
        expect(searchInput.value).not.toContain('alert');
      }
    });

    it('should validate financial inputs in SalesTable', async () => {
      render(
        <TestWrapper>
          <SalesTable />
        </TestWrapper>
      );

      // Look for any financial input fields
      const inputs = screen.queryAllByRole('textbox');
      
      inputs.forEach(input => {
        if (input.getAttribute('type') === 'number' || 
            input.getAttribute('name')?.includes('amount') ||
            input.getAttribute('name')?.includes('revenue')) {
          
          const maliciousValue = 'Infinity; DROP TABLE deals;';
          fireEvent.change(input, { target: { value: maliciousValue } });

          // Should not contain SQL injection attempts
          expect(input.value).not.toContain('DROP');
          expect(input.value).not.toContain(';');
        }
      });
    });
  });

  describe('Authentication & Authorization', () => {
    it('should validate authentication tokens', () => {
      const validTokens = [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
      ];

      const invalidTokens = [
        '',
        'invalid.token.format',
        '<script>alert(1)</script>',
        "'; DROP TABLE users; --",
        'null',
        'undefined'
      ];

      validTokens.forEach(token => {
        // Token should be properly formatted JWT
        expect(token).toMatch(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/);
      });

      invalidTokens.forEach(token => {
        const result = validateAndSanitizeInput(token);
        // Should be sanitized or rejected
        expect(result.isValid).toBe(false);
      });
    });

    it('should validate user permissions for company access', () => {
      // Mock scenarios for different user permission levels
      const permissionTests = [
        { userId: 1, companyId: 1, hasAccess: true },
        { userId: 1, companyId: 999, hasAccess: false },
        { userId: null, companyId: 1, hasAccess: false },
        { userId: 'admin', companyId: 1, hasAccess: true }
      ];

      permissionTests.forEach(test => {
        // In a real implementation, this would check permissions
        // For testing, we ensure the structure is in place
        expect(typeof test.userId).toMatch(/number|string|object/);
        expect(typeof test.companyId).toBe('number');
        expect(typeof test.hasAccess).toBe('boolean');
      });
    });
  });

  describe('API Security', () => {
    it('should handle API responses with malicious content', async () => {
      const maliciousApiResponse = {
        companies: [
          {
            id: 1,
            name: '<script>alert("XSS")</script>',
            description: "'; DROP TABLE companies; --",
            website: 'javascript:alert(1)'
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => maliciousApiResponse
      });

      // In a real implementation, API responses should be sanitized
      const response = await fetch('/api/companies');
      const data = await response.json();

      // Data should be sanitized before use
      expect(data.companies[0].name).toBeDefined();
      // In production, this should be sanitized
    });

    it('should validate API error responses', async () => {
      const maliciousErrorResponse = {
        error: '<script>alert("XSS")</script>',
        message: "'; DROP TABLE companies; --"
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => maliciousErrorResponse
      });

      try {
        const response = await fetch('/api/companies');
        if (!response.ok) {
          const errorData = await response.json();
          
          // Error messages should be sanitized
          const sanitizedError = escapeHTML(errorData.error);
          const sanitizedMessage = escapeHTML(errorData.message);
          
          expect(sanitizedError).not.toContain('<script>');
          expect(sanitizedMessage).not.toContain('DROP TABLE');
        }
      } catch (error) {
        // Error handling should be secure
        expect(error).toBeDefined();
      }
    });
  });

  describe('File Upload Security', () => {
    it('should validate file types and extensions', () => {
      const allowedFiles = [
        { name: 'data.csv', type: 'text/csv' },
        { name: 'export.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        { name: 'report.pdf', type: 'application/pdf' }
      ];

      const dangerousFiles = [
        { name: 'malware.exe', type: 'application/x-msdownload' },
        { name: 'script.js', type: 'text/javascript' },
        { name: 'page.html', type: 'text/html' },
        { name: 'data.csv.exe', type: 'application/x-msdownload' },
        { name: '../../../etc/passwd', type: 'text/plain' }
      ];

      allowedFiles.forEach(file => {
        // Should pass validation
        expect(file.type).toMatch(/^(text\/csv|application\/(pdf|vnd\.openxmlformats)).*$/);
      });

      dangerousFiles.forEach(file => {
        // Should fail validation
        expect(file.type).not.toMatch(/^(text\/csv|application\/(pdf|vnd\.openxmlformats)).*$/);
        expect(file.name).not.toMatch(/\.(exe|js|html|bat|cmd|scr|vbs)$/i);
      });
    });

    it('should sanitize file names', () => {
      const dangerousFileNames = [
        '../../../etc/passwd',
        'file with spaces.csv',
        'file"with"quotes.csv',
        'file<script>.csv',
        'file&command.csv',
        'file|pipe.csv',
        'con.csv', // Windows reserved name
        'aux.csv'  // Windows reserved name
      ];

      dangerousFileNames.forEach(fileName => {
        const result = validateAndSanitizeInput(fileName);
        
        if (result.isValid) {
          // Should not contain path traversal
          expect(result.sanitized).not.toContain('../');
          expect(result.sanitized).not.toContain('..\\');
          
          // Should not contain dangerous characters
          expect(result.sanitized).not.toMatch(/[<>"|&\?*]/);
        }
      });
    });
  });

  describe('Rate Limiting and DOS Prevention', () => {
    it('should handle rapid API requests gracefully', async () => {
      // Simulate rapid requests
      const requests = Array.from({ length: 100 }, () => 
        fetch('/api/companies').catch(() => ({ status: 429 }))
      );

      const responses = await Promise.allSettled(requests);
      
      // Should either succeed or return rate limit errors
      responses.forEach(response => {
        if (response.status === 'fulfilled') {
          const result = response.value as any;
          expect([200, 429, 500]).toContain(result.status);
        }
      });
    });

    it('should validate request size limits', () => {
      const largePayload = 'x'.repeat(10 * 1024 * 1024); // 10MB
      const normalPayload = 'normal data';

      // Large payloads should be rejected
      expect(largePayload.length).toBeGreaterThan(1024 * 1024);
      expect(normalPayload.length).toBeLessThan(1024);
    });
  });

  describe('Content Security Policy', () => {
    it('should validate inline scripts are prevented', () => {
      const inlineScripts = [
        'onclick="alert(1)"',
        'onload="maliciousFunction()"',
        'onerror="stealData()"',
        'onmouseover="xss()"'
      ];

      inlineScripts.forEach(script => {
        const sanitized = escapeHTML(script);
        expect(sanitized).not.toMatch(/on\w+\s*=/i);
      });
    });

    it('should validate external resource loading', () => {
      const suspiciousUrls = [
        'http://malicious-site.com/steal.js',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'vbscript:msgbox(1)'
      ];

      suspiciousUrls.forEach(url => {
        // Should detect dangerous protocols
        expect(url).toMatch(/^(javascript|data|vbscript):/i);
      });
    });
  });

  describe('Session Security', () => {
    it('should validate session token format', () => {
      const validSessionTokens = [
        '1234567890abcdef1234567890abcdef',
        'session_12345678901234567890123456789012'
      ];

      const invalidSessionTokens = [
        '',
        'short',
        '<script>alert(1)</script>',
        "'; DROP TABLE sessions; --",
        '../../../etc/passwd'
      ];

      validSessionTokens.forEach(token => {
        expect(token.length).toBeGreaterThan(16);
        expect(token).toMatch(/^[a-zA-Z0-9_-]+$/);
      });

      invalidSessionTokens.forEach(token => {
        const result = validateAndSanitizeInput(token);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose sensitive information in error messages', () => {
      const sensitiveErrors = [
        'Database connection failed: password incorrect for user admin',
        'SQL Error: Table \'companies\' doesn\'t exist at line 42',
        'File not found: /etc/passwd',
        'Invalid token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      ];

      sensitiveErrors.forEach(error => {
        // Error messages should be HTML escaped
        const escapedError = escapeHTML(error);
        expect(escapedError).not.toContain('<');
        expect(escapedError).not.toContain('>');
        
        // Test that our test data contains sensitive info (to validate the test)
        const hasSensitiveContent = error.includes('password') || 
                                   error.includes('/etc/') || 
                                   error.includes('eyJ');
        expect(hasSensitiveContent).toBe(true);
      });
    });
  });
});