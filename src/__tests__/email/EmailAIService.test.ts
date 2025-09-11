import { describe, it, expect, beforeEach } from 'vitest';
import {
  categorizeEmail,
  scoreEmailPriority,
  analyzeSentiment,
  generateSmartReplies,
  extractMeetingFromEmail,
  extractKeyEntities,
  summarizeEmail,
  generateEmailTags,
  batchCategorizeEmails
} from '@/lib/services/emailAIService';

describe('EmailAIService', () => {
  describe('categorizeEmail', () => {
    it('should categorize newsletters as Updates', () => {
      const result = categorizeEmail({
        subject: 'Weekly Newsletter - Tech Updates',
        from: 'newsletter@techcompany.com',
        body: 'Here are this week\'s updates from our team...'
      });
      
      expect(result.category).toBe('Updates');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should categorize sales emails as Promotions', () => {
      const result = categorizeEmail({
        subject: '50% OFF - Limited Time Offer!',
        from: 'sales@store.com',
        body: 'Don\'t miss out on our biggest sale of the year! Use code SAVE50'
      });
      
      expect(result.category).toBe('Promotions');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should categorize work emails as Primary', () => {
      const result = categorizeEmail({
        subject: 'Project Update - Q4 Planning',
        from: 'john.doe@company.com',
        body: 'Hi team, I wanted to update you on our Q4 planning progress...'
      });
      
      expect(result.category).toBe('Primary');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('should categorize social media notifications as Social', () => {
      const result = categorizeEmail({
        subject: 'You have a new follower on Twitter',
        from: 'notifications@twitter.com',
        body: 'John Smith is now following you on Twitter'
      });
      
      expect(result.category).toBe('Social');
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('scoreEmailPriority', () => {
    it('should score urgent emails as high priority', () => {
      const result = scoreEmailPriority({
        subject: 'URGENT: Server Down - Immediate Action Required',
        from: 'alerts@monitoring.com',
        body: 'Critical: Production server is down and requires immediate attention',
        to: ['team@company.com']
      });
      
      expect(result.priority).toBe(5);
      expect(result.reasons).toContain('Urgent keywords detected');
    });

    it('should score CEO emails as high priority', () => {
      const result = scoreEmailPriority({
        subject: 'Company Update',
        from: 'ceo@company.com',
        body: 'Team, I wanted to share some important updates...',
        to: ['all@company.com']
      });
      
      expect(result.priority).toBeGreaterThanOrEqual(4);
      expect(result.reasons).toContain('VIP sender');
    });

    it('should score promotional emails as low priority', () => {
      const result = scoreEmailPriority({
        subject: 'Special Offer Just for You',
        from: 'marketing@store.com',
        body: 'Check out our latest deals and save big!',
        to: ['customer@email.com']
      });
      
      expect(result.priority).toBeLessThanOrEqual(2);
    });
  });

  describe('analyzeSentiment', () => {
    it('should detect positive sentiment', () => {
      const result = analyzeSentiment(
        'Great job on the presentation! I\'m really impressed with your work. Keep it up!'
      );
      
      expect(result.sentiment).toBe('positive');
      expect(result.score).toBeGreaterThan(0);
      expect(result.emotions.joy).toBeGreaterThan(0);
    });

    it('should detect negative sentiment', () => {
      const result = analyzeSentiment(
        'I\'m disappointed with the delays. This is unacceptable and needs immediate improvement.'
      );
      
      expect(result.sentiment).toBe('negative');
      expect(result.score).toBeLessThan(0);
      expect(result.emotions.anger).toBeGreaterThan(0);
    });

    it('should detect neutral sentiment', () => {
      const result = analyzeSentiment(
        'Please find the attached report for your review. Let me know if you need any changes.'
      );
      
      expect(result.sentiment).toBe('neutral');
      expect(Math.abs(result.score)).toBeLessThan(0.3);
    });
  });

  describe('generateSmartReplies', () => {
    it('should generate replies for meeting requests', () => {
      const email = {
        subject: 'Meeting Request - Project Discussion',
        body: 'Can we schedule a meeting to discuss the project timeline?',
        from: 'colleague@company.com'
      };
      
      const replies = generateSmartReplies(email);
      
      expect(replies).toHaveLength(3);
      expect(replies[0].tone).toBe('professional');
      expect(replies[0].text).toContain('available');
    });

    it('should generate different tones of replies', () => {
      const email = {
        subject: 'Thank you for your help',
        body: 'I really appreciate your assistance with the project.',
        from: 'client@company.com'
      };
      
      const replies = generateSmartReplies(email);
      
      const tones = replies.map(r => r.tone);
      expect(tones).toContain('professional');
      expect(tones).toContain('friendly');
    });
  });

  describe('extractMeetingFromEmail', () => {
    it('should extract meeting details from email', () => {
      const email = {
        subject: 'Meeting: Project Review',
        body: 'Let\'s meet tomorrow at 2pm in Conference Room A to discuss the Q4 roadmap. Expected duration: 1 hour.',
        from: 'manager@company.com'
      };
      
      const result = extractMeetingFromEmail(email);
      
      expect(result.found).toBe(true);
      expect(result.details?.title).toContain('Project Review');
      expect(result.details?.location).toBe('Conference Room A');
      expect(result.details?.duration).toBe(60);
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should detect Zoom meetings', () => {
      const email = {
        subject: 'Zoom Meeting Invitation',
        body: 'Join Zoom Meeting: https://zoom.us/j/123456789',
        from: 'organizer@company.com'
      };
      
      const result = extractMeetingFromEmail(email);
      
      expect(result.found).toBe(true);
      expect(result.details?.type).toBe('zoom');
      expect(result.details?.meetingUrl).toContain('zoom.us');
    });

    it('should return not found for non-meeting emails', () => {
      const email = {
        subject: 'Invoice Attached',
        body: 'Please find the invoice for last month attached.',
        from: 'billing@vendor.com'
      };
      
      const result = extractMeetingFromEmail(email);
      
      expect(result.found).toBe(false);
      expect(result.confidence).toBeLessThan(0.3);
    });
  });

  describe('extractKeyEntities', () => {
    it('should extract people, organizations, and locations', () => {
      const text = 'John Smith from Microsoft will meet Sarah Johnson at the Seattle office tomorrow.';
      const result = extractKeyEntities(text);
      
      expect(result.people).toContain('John Smith');
      expect(result.people).toContain('Sarah Johnson');
      expect(result.organizations).toContain('Microsoft');
      expect(result.locations).toContain('Seattle office');
    });

    it('should extract dates and action items', () => {
      const text = 'Please review the document by Friday and send feedback by next Monday.';
      const result = extractKeyEntities(text);
      
      expect(result.dates).toContain('Friday');
      expect(result.dates).toContain('next Monday');
      expect(result.actions).toContain('review the document');
      expect(result.actions).toContain('send feedback');
    });
  });

  describe('summarizeEmail', () => {
    it('should create a brief summary', () => {
      const longEmail = `
        Dear Team,
        
        I wanted to provide an update on our Q4 planning. We've made significant progress 
        on the roadmap and have identified key milestones. The product team has completed 
        the feature specifications, and engineering has provided estimates.
        
        We need to finalize the timeline by Friday and get approval from stakeholders.
        Please review the attached documents and provide your feedback.
        
        Best regards,
        John
      `;
      
      const summary = summarizeEmail(longEmail, 50);
      
      expect(summary.length).toBeLessThanOrEqual(50);
      expect(summary).toContain('Q4');
      expect(summary).toContain('timeline');
    });
  });

  describe('generateEmailTags', () => {
    it('should generate relevant tags', () => {
      const email = {
        subject: 'Invoice #12345 - Payment Due',
        body: 'Your invoice for consulting services is attached. Payment due by month end.',
        from: 'billing@consultant.com'
      };
      
      const tags = generateEmailTags(email);
      
      expect(tags).toContain('invoice');
      expect(tags).toContain('payment');
      expect(tags).toContain('billing');
    });
  });

  describe('batchCategorizeEmails', () => {
    it('should categorize multiple emails efficiently', async () => {
      const emails = [
        {
          id: '1',
          subject: 'Team Meeting Notes',
          from: 'manager@company.com',
          body: 'Here are the notes from today\'s meeting...'
        },
        {
          id: '2',
          subject: '50% OFF Everything!',
          from: 'sales@store.com',
          body: 'Limited time offer - shop now!'
        },
        {
          id: '3',
          subject: 'Your Weekly Digest',
          from: 'newsletter@service.com',
          body: 'Here\'s what happened this week...'
        }
      ];
      
      const results = await batchCategorizeEmails(emails);
      
      expect(results).toHaveLength(3);
      expect(results[0].category).toBe('Primary');
      expect(results[1].category).toBe('Promotions');
      expect(results[2].category).toBe('Updates');
    });
  });
});