import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { ApiContactService } from '@/lib/services/apiContactService';
import { API_BASE_URL } from '@/lib/config';

// Mock fetch for testing API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Supabase auth
vi.mock('@/lib/supabase/clientV2', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'mock-token',
            user: { id: 'test-user-123' }
          }
        }
      })
    }
  }
}));

// Mock API utils
vi.mock('@/lib/utils/apiUtils', () => ({
  getSupabaseHeaders: vi.fn().mockResolvedValue({
    'Authorization': 'Bearer mock-token',
    'Content-Type': 'application/json',
  })
}));

describe('API Proxy Validation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Proxy Configuration Validation', () => {
    it('should verify API calls go through the correct proxy endpoint', async () => {
      const mockContacts = [
        {
          id: 'contact-1',
          email: 'proxy@test.com',
          first_name: 'Proxy',
          last_name: 'Test',
          full_name: 'Proxy Test'
        }
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: mockContacts })
      });

      await ApiContactService.getContacts({ search: 'proxy' });

      // Verify the request was made to the correct API endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/contacts'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json',
          })
        })
      );

      // Verify the URL includes the search parameter
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toMatch(/\/api\/contacts\?.*search=proxy/);
    });

    it('should handle proxy routing for contact creation', async () => {
      const newContact = {
        first_name: 'New',
        last_name: 'Contact',
        email: 'new@proxy.com',
        owner_id: 'test-user-123',
        is_primary: false
      };

      const createdContact = {
        id: 'new-contact-123',
        ...newContact,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ data: createdContact })
      });

      await ApiContactService.createContact(newContact);

      // Verify POST request to contacts endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/contacts'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(newContact)
        })
      );
    });

    it('should verify proxy routes work for all contact operations', async () => {
      const operations = [
        // GET all contacts
        () => ApiContactService.getContacts(),
        // GET with search
        () => ApiContactService.searchContacts('test'),
        // GET by company
        () => ApiContactService.getContactsByCompany('company-123'),
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] })
      });

      for (const operation of operations) {
        await operation();
      }

      // Should have made 3 requests through proxy
      expect(mockFetch).toHaveBeenCalledTimes(3);
      
      // All calls should be to /api/contacts
      mockFetch.mock.calls.forEach(call => {
        expect(call[0]).toMatch(/\/api\/contacts/);
      });
    });
  });

  describe('Development vs Production Environment', () => {
    it('should use development proxy in local environment', () => {
      // API_BASE_URL should be '/api' in development (via Vite proxy)
      expect(API_BASE_URL).toBe('/api');
    });

    it('should handle proxy configuration in development server', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] })
      });

      await ApiContactService.getContacts();

      // Should call the proxied endpoint
      const [url] = mockFetch.mock.calls[0];
      expect(url).toMatch(/^\/api\/contacts/);
    });

    it('should pass through correct headers for authentication', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] })
      });

      await ApiContactService.getContacts();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers).toEqual(
        expect.objectContaining({
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        })
      );
    });
  });

  describe('Proxy Error Handling', () => {
    it('should handle 502 Bad Gateway from proxy', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway'
      });

      await expect(ApiContactService.getContacts()).rejects.toThrow('HTTP error! status: 502');
    });

    it('should handle proxy timeout (504 Gateway Timeout)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 504,
        statusText: 'Gateway Timeout'
      });

      await expect(ApiContactService.searchContacts('test')).rejects.toThrow('HTTP error! status: 504');
    });

    it('should handle proxy connection refused', async () => {
      mockFetch.mockRejectedValue(new Error('fetch failed - ECONNREFUSED'));

      await expect(ApiContactService.getContacts()).rejects.toThrow('fetch failed - ECONNREFUSED');
    });

    it('should handle proxy service unavailable (503)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable'
      });

      await expect(ApiContactService.createContact({
        first_name: 'Test',
        email: 'test@example.com',
        owner_id: 'user-123',
        is_primary: false
      })).rejects.toThrow('HTTP error! status: 503');
    });
  });

  describe('API Endpoint Validation', () => {
    it('should construct correct URLs with query parameters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] })
      });

      const params = {
        search: 'john doe',
        companyId: 'company-123',
        includeCompany: true,
        limit: 10,
        ownerId: 'user-456'
      };

      await ApiContactService.getContacts(params);

      const [url] = mockFetch.mock.calls[0];
      const urlObj = new URL(url, 'http://localhost');

      expect(urlObj.pathname).toBe('/api/contacts');
      expect(urlObj.searchParams.get('search')).toBe('john doe');
      expect(urlObj.searchParams.get('companyId')).toBe('company-123');
      expect(urlObj.searchParams.get('includeCompany')).toBe('true');
      expect(urlObj.searchParams.get('limit')).toBe('10');
      expect(urlObj.searchParams.get('ownerId')).toBe('user-456');
    });

    it('should handle special characters in query parameters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] })
      });

      const searchQuery = 'test@email.com & company!';
      await ApiContactService.searchContacts(searchQuery);

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain(encodeURIComponent(searchQuery));
    });

    it('should properly format update requests with ID parameter', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { id: 'contact-123' } })
      });

      const contactId = 'contact-123';
      const updates = { first_name: 'Updated' };

      await ApiContactService.updateContact(contactId, updates);

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/contacts?id=${contactId}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(updates)
        })
      );
    });

    it('should properly format delete requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      });

      const contactId = 'contact-delete-123';
      await ApiContactService.deleteContact(contactId);

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/contacts?id=${contactId}`,
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  describe('Response Format Validation', () => {
    it('should handle successful API responses correctly', async () => {
      const mockData = [
        { id: '1', email: 'test1@example.com' },
        { id: '2', email: 'test2@example.com' }
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: mockData })
      });

      const result = await ApiContactService.getContacts();
      expect(result).toEqual(mockData);
    });

    it('should handle API error responses correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ error: 'Invalid request' })
      });

      await expect(ApiContactService.getContacts()).rejects.toThrow('Invalid request');
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('SyntaxError: Unexpected token'))
      });

      await expect(ApiContactService.getContacts()).rejects.toThrow('SyntaxError: Unexpected token');
    });
  });

  describe('Real API Integration Tests', () => {
    // These tests would run against a real backend in CI
    // Skip in unit tests but provide examples of integration testing

    it.skip('should successfully connect to real API backend', async () => {
      // This test would only run in integration test environment
      const realApiUrl = process.env.VITE_API_URL || 'http://localhost:8000';
      
      const response = await fetch(`${realApiUrl}/api/contacts`, {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });

      expect(response.status).toBeLessThan(500); // Any response that's not server error
    });

    it.skip('should handle CORS correctly in development', async () => {
      // Test CORS headers in development environment
      const response = await fetch('/api/contacts', {
        method: 'OPTIONS'
      });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });
  });

  describe('Proxy Configuration Edge Cases', () => {
    it('should handle requests when API server is down', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED: Connection refused'));

      await expect(ApiContactService.getContacts()).rejects.toThrow('ECONNREFUSED');
    });

    it('should handle malformed proxy responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 502,
        text: () => Promise.resolve('<html><body>502 Bad Gateway</body></html>')
      });

      await expect(ApiContactService.getContacts()).rejects.toThrow('HTTP error! status: 502');
    });

    it('should handle proxy SSL/TLS errors in development', async () => {
      mockFetch.mockRejectedValue(new Error('unable to verify the first certificate'));

      await expect(ApiContactService.getContacts()).rejects.toThrow('unable to verify the first certificate');
    });

    it('should validate proxy preserves request body for POST/PATCH', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ data: { id: 'new-contact' } })
      });

      const contactData = {
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
        phone: '+1234567890',
        company: 'Test Corp',
        owner_id: 'user-123',
        is_primary: false
      };

      await ApiContactService.createContact(contactData);

      const [, options] = mockFetch.mock.calls[0];
      expect(options.body).toBe(JSON.stringify(contactData));
    });

    it('should handle proxy timeout configuration', async () => {
      // Simulate slow response that times out
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 1000);
        })
      );

      await expect(ApiContactService.getContacts()).rejects.toThrow('Request timeout');
    });
  });

  describe('Performance and Load Testing Scenarios', () => {
    it('should handle concurrent API requests through proxy', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] })
      });

      const requests = Array.from({ length: 10 }, (_, i) => 
        ApiContactService.searchContacts(`query-${i}`)
      );

      await Promise.all(requests);

      expect(mockFetch).toHaveBeenCalledTimes(10);
    });

    it('should validate request throttling through proxy', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });

      await expect(ApiContactService.getContacts()).rejects.toThrow('HTTP error! status: 429');
    });
  });
});