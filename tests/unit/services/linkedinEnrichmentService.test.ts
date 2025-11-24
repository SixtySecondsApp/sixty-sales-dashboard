import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinkedInEnrichmentService } from '@/lib/services/linkedinEnrichmentService';

// Mock logger
vi.mock('@/lib/utils/logger', () => ({
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock Copilot Service
vi.mock('@/lib/services/copilotService', () => ({
  CopilotService: {
    sendMessage: vi.fn().mockResolvedValue({
      response: { content: 'https://www.linkedin.com/in/john-doe' }
    })
  }
}));

describe('LinkedInEnrichmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findLinkedInUrl', () => {
    it('should construct a valid URL from name', async () => {
      const url = await LinkedInEnrichmentService.findLinkedInUrl('John Doe', 'TechCorp');
      expect(url).toBe('https://www.linkedin.com/in/john-doe');
    });

    it('should return null for empty inputs', async () => {
      const url = await LinkedInEnrichmentService.findLinkedInUrl('', '');
      expect(url).toBeNull();
    });
  });

  describe('scrapeProfile', () => {
    it('should return mock profile data when API token is missing', async () => {
      // Ensure no API key
      vi.stubEnv('VITE_APIFY_TOKEN', '');
      
      const profile = await LinkedInEnrichmentService.scrapeProfile('https://linkedin.com/in/test');
      
      expect(profile).toBeDefined();
      expect(profile?.fullName).toBe('John Doe');
      expect(profile?.url).toBe('https://linkedin.com/in/test');
      expect(profile?.recentPosts.length).toBeGreaterThan(0);
    });
  });
});
