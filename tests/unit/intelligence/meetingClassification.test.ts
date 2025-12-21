import { describe, expect, test, vi, beforeEach } from 'vitest';

// Mock Supabase before importing the service
vi.mock('@/lib/supabase/clientV2', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),
  },
}));

vi.mock('@/lib/utils/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { classifyMeeting, type MeetingType, type ClassificationResult } from '@/lib/services/meetingClassificationService';
import { supabase } from '@/lib/supabase/clientV2';

describe('meetingClassificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('classifyMeeting with provided content', () => {
    test('classifies discovery meeting from pain points discussion', async () => {
      const transcript = `
        Let me understand your current situation.
        What are your pain points with the current system?
        What challenges are you facing?
        Tell me about your goals and objectives.
      `;

      const result = await classifyMeeting('meeting-123', transcript, null);

      expect(result.type).toBe('discovery');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('classifies demo meeting from demonstration keywords', async () => {
      const transcript = `
        Let me show you how this feature works.
        Here is how the demo process goes.
        I'll do a walkthrough of the dashboard.
        Let me showcase this example.
      `;

      const result = await classifyMeeting('meeting-123', transcript, null);

      expect(result.type).toBe('demo');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('classifies negotiation meeting from pricing discussion', async () => {
      const transcript = `
        Let's discuss the pricing for this contract.
        What's your budget for this project?
        We can offer a discount on the annual payment.
        Here's our proposal with the cost breakdown.
      `;

      const result = await classifyMeeting('meeting-123', transcript, null);

      expect(result.type).toBe('negotiation');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('classifies closing meeting from sign-off keywords', async () => {
      const transcript = `
        Are you ready to move forward with the agreement?
        Let's finalize the contract terms.
        What's your start date for onboarding?
        We need your approval to execute the paperwork.
      `;

      const result = await classifyMeeting('meeting-123', transcript, null);

      expect(result.type).toBe('closing');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('classifies follow-up meeting from check-in keywords', async () => {
      const transcript = `
        Just wanted to follow up on our last discussion.
        How is it going with the implementation?
        Let me check in on the progress.
        Any questions or concerns since our last meeting?
      `;

      const result = await classifyMeeting('meeting-123', transcript, null);

      expect(result.type).toBe('follow_up');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('returns general for content with no strong indicators', async () => {
      const transcript = `
        Hello everyone.
        Today we are here to talk.
        That sounds good.
        See you next time.
      `;

      const result = await classifyMeeting('meeting-123', transcript, null);

      expect(result.type).toBe('general');
      expect(result.confidence).toBe(0.5);
    });

    test('returns general with 0.5 confidence for very short content', async () => {
      const transcript = 'Hi';

      const result = await classifyMeeting('meeting-123', transcript, null);

      expect(result.type).toBe('general');
      expect(result.confidence).toBe(0.5);
    });

    test('returns general for empty transcript and summary', async () => {
      const result = await classifyMeeting('meeting-123', '', '');

      expect(result.type).toBe('general');
      expect(result.confidence).toBe(0.5);
    });

    test('combines transcript and summary for classification', async () => {
      const transcript = 'We had a good meeting.';
      const summary = 'Discussed pain points and current challenges with the customer.';

      const result = await classifyMeeting('meeting-123', transcript, summary);

      expect(result.type).toBe('discovery');
    });

    test('handles case-insensitive matching', async () => {
      // The service lowercases everything, so word boundaries work correctly
      const transcript = 'Tell me about your pain points and what challenges you face';

      const result = await classifyMeeting('meeting-123', transcript, null);

      expect(result.type).toBe('discovery');
    });

    test('counts multiple occurrences of indicators', async () => {
      // Multiple demo indicators should increase confidence
      const transcript = `
        Demo demo demo.
        Let me show you this.
        Here is how it works.
        Another demonstration.
        Showcase the feature.
        Example after example.
      `;

      const result = await classifyMeeting('meeting-123', transcript, null);

      expect(result.type).toBe('demo');
      // Confidence is calculated based on the formula, so just check it's above baseline
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test('confidence is capped at 0.95', async () => {
      // Many many indicators
      const transcript = Array(50).fill('demo feature show you walkthrough demonstration showcase preview').join(' ');

      const result = await classifyMeeting('meeting-123', transcript, null);

      expect(result.confidence).toBeLessThanOrEqual(0.95);
    });

    test('handles special regex characters in content', async () => {
      const transcript = 'Price is $100.00 (with 10% discount)';

      // Should not throw and should classify based on negotiation keywords
      const result = await classifyMeeting('meeting-123', transcript, null);

      expect(result).toBeDefined();
      expect(['negotiation', 'general']).toContain(result.type);
    });

    test('matches word boundaries for indicators', async () => {
      // "demo" should match but "demographic" should not boost demo score
      const transcript = 'We discussed demographic information and population data.';

      const result = await classifyMeeting('meeting-123', transcript, null);

      // "demo" is within "demographic" but word boundary matching should prevent match
      expect(result.type).toBe('general');
    });

    test('picks highest scoring type when multiple types match', async () => {
      // Mix of indicators, more discovery than others
      const transcript = `
        Tell me about your challenges.
        What are your pain points?
        What are your goals?
        Let me show you one feature.
      `;

      const result = await classifyMeeting('meeting-123', transcript, null);

      expect(result.type).toBe('discovery');
    });
  });

  describe('classifyMeeting fetches from database when no content provided', () => {
    test('fetches meeting from database when no transcript/summary provided', async () => {
      const mockMeeting = {
        transcript_text: 'Let me show you a demo of the product.',
        summary: 'Product demonstration meeting',
      };

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockMeeting, error: null }),
          }),
        }),
        update: vi.fn(),
      } as any);

      const result = await classifyMeeting('meeting-123');

      expect(supabase.from).toHaveBeenCalledWith('meetings');
      expect(result.type).toBe('demo');
    });

    test('returns general when meeting not found in database', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Not found' },
            }),
          }),
        }),
        update: vi.fn(),
      } as any);

      const result = await classifyMeeting('meeting-123');

      expect(result.type).toBe('general');
      expect(result.confidence).toBe(0.5);
    });
  });

  describe('confidence calculation', () => {
    test('confidence increases with more indicator matches', async () => {
      const fewIndicators = 'Tell me about your challenges.';
      const manyIndicators = `
        Tell me about your challenges.
        What are your pain points?
        What are your goals and objectives?
        How do you handle the current process?
        What problems do you face?
      `;

      const resultFew = await classifyMeeting('m1', fewIndicators, null);
      const resultMany = await classifyMeeting('m2', manyIndicators, null);

      expect(resultMany.confidence).toBeGreaterThan(resultFew.confidence);
    });

    test('confidence rounds to 2 decimal places', async () => {
      const transcript = 'Demo feature show you walkthrough';

      const result = await classifyMeeting('meeting-123', transcript, null);

      const decimalPlaces = (result.confidence.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });
  });

  describe('edge cases', () => {
    test('handles null transcript gracefully', async () => {
      const result = await classifyMeeting('meeting-123', null, 'Summary only');

      expect(result).toBeDefined();
    });

    test('handles null summary gracefully', async () => {
      const result = await classifyMeeting('meeting-123', 'Transcript only', null);

      expect(result).toBeDefined();
    });

    test('handles unicode content', async () => {
      // Include enough content to pass the 50-character minimum and have matching indicators
      const transcript = '我们讨论了关于客户的问题。We discussed their pain points and the challenges they face with their current process.';

      const result = await classifyMeeting('meeting-123', transcript, null);

      expect(result.type).toBe('discovery');
    });

    test('handles very long content', async () => {
      const longTranscript = Array(1000).fill('This is a demo of our product features.').join(' ');

      const result = await classifyMeeting('meeting-123', longTranscript, null);

      expect(result.type).toBe('demo');
      expect(result.confidence).toBeLessThanOrEqual(0.95);
    });
  });
});
