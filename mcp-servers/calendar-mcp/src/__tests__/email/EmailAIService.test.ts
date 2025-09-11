/**
 * EmailAIService Test Suite
 * Comprehensive tests for AI-powered email categorization, prioritization, and analysis
 */

import { emailAIService } from '../../lib/services/emailAIService';
import type {
  EmailAnalysis,
  EmailCategory,
  EmailPriority,
  EmailSentiment,
  SmartReply,
  MeetingExtraction,
} from '../../lib/services/emailAIService';

describe('EmailAIService', () => {
  // Test data
  const mockEmailData = {
    businessEmail: {
      subject: 'Urgent: Meeting proposal for project review',
      content: 'Hi John, I hope this email finds you well. We need to schedule an important meeting tomorrow at 2:00 PM to review the quarterly project status. Please confirm your availability. Best regards, Sarah',
      sender: 'sarah.manager@company.com',
      metadata: { isFromContact: true, isVIP: false },
    },
    promotionalEmail: {
      subject: '50% OFF Sale - Limited Time Offer!',
      content: 'Don\'t miss out on our amazing summer sale! Get 50% off all items with code SUMMER50. Shop now at our website and save big on your favorite products. Unsubscribe here if you no longer wish to receive these emails.',
      sender: 'sales@retailstore.com',
      metadata: {},
    },
    urgentEmail: {
      subject: 'CRITICAL: Server outage affecting production',
      content: 'URGENT: We are experiencing a critical server outage that is affecting all production systems. Immediate action required. Please join the emergency call at 555-0123. This is a high priority issue that needs immediate attention.',
      sender: 'alerts@company.com',
      metadata: { isFromContact: false, isVIP: true },
    },
    meetingInviteEmail: {
      subject: 'Weekly standup meeting - Tomorrow 10:00 AM',
      content: 'Hi team, reminder about our weekly standup meeting tomorrow (Tuesday, March 15th) at 10:00 AM in conference room B. We\'ll discuss project updates and blockers. The meeting will last approximately 30 minutes. Please bring your status updates. Thanks, Mike',
      sender: 'mike.lead@company.com',
      metadata: { isFromContact: true },
    },
    positiveEmail: {
      subject: 'Great job on the presentation!',
      content: 'Hi Lisa, I wanted to thank you for the excellent presentation yesterday. It was amazing and really helped us understand the project better. Your work is fantastic and truly appreciated. Congratulations on a job well done!',
      sender: 'boss@company.com',
      metadata: { isFromContact: true, isVIP: true },
    },
    negativeEmail: {
      subject: 'Issues with recent delivery',
      content: 'I am very disappointed with the recent delivery. The product arrived damaged and late. This is terrible service and I am frustrated with the whole experience. I need this issue resolved immediately or I will have to consider other options.',
      sender: 'customer@email.com',
      metadata: {},
    },
  };

  describe('Email Analysis', () => {
    it('should analyze business email correctly', async () => {
      const { businessEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        businessEmail.subject,
        businessEmail.content,
        businessEmail.sender,
        businessEmail.metadata
      );

      expect(analysis).toBeDefined();
      expect(analysis.categories).toBeDefined();
      expect(analysis.priority).toBeDefined();
      expect(analysis.sentiment).toBeDefined();
      expect(analysis.smartReplies).toBeDefined();
      expect(analysis.meetingExtractions).toBeDefined();
      expect(analysis.keyEntities).toBeDefined();
      expect(analysis.summary).toBeDefined();
      expect(analysis.tags).toBeDefined();
    });

    it('should handle promotional email analysis', async () => {
      const { promotionalEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        promotionalEmail.subject,
        promotionalEmail.content,
        promotionalEmail.sender,
        promotionalEmail.metadata
      );

      expect(analysis.categories.some(cat => cat.id === 'promotions')).toBe(true);
      expect(analysis.tags).toContain('financial');
      expect(analysis.priority.score).toBeLessThan(3);
    });

    it('should detect critical priority emails', async () => {
      const { urgentEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        urgentEmail.subject,
        urgentEmail.content,
        urgentEmail.sender,
        urgentEmail.metadata
      );

      expect(analysis.priority.level).toBe('Critical');
      expect(analysis.priority.score).toBe(5);
      expect(analysis.priority.confidence).toBeGreaterThan(0.9);
      expect(analysis.priority.factors).toContain('Critical/Emergency keywords');
    });
  });

  describe('Email Categorization', () => {
    it('should categorize primary business emails', async () => {
      const { businessEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        businessEmail.subject,
        businessEmail.content,
        businessEmail.sender,
        businessEmail.metadata
      );

      const primaryCategory = analysis.categories.find(cat => cat.id === 'primary');
      expect(primaryCategory).toBeDefined();
      expect(primaryCategory?.confidence).toBeGreaterThan(0.8);
    });

    it('should categorize promotional emails', async () => {
      const { promotionalEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        promotionalEmail.subject,
        promotionalEmail.content,
        promotionalEmail.sender,
        promotionalEmail.metadata
      );

      const promoCategory = analysis.categories.find(cat => cat.id === 'promotions');
      expect(promoCategory).toBeDefined();
      expect(promoCategory?.confidence).toBeGreaterThan(0.6);
    });

    it('should return categories sorted by confidence', async () => {
      const { businessEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        businessEmail.subject,
        businessEmail.content,
        businessEmail.sender,
        businessEmail.metadata
      );

      if (analysis.categories.length > 1) {
        for (let i = 1; i < analysis.categories.length; i++) {
          expect(analysis.categories[i - 1].confidence).toBeGreaterThanOrEqual(
            analysis.categories[i].confidence
          );
        }
      }
    });

    it('should only return categories with confidence > 0.5', async () => {
      const { businessEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        businessEmail.subject,
        businessEmail.content,
        businessEmail.sender,
        businessEmail.metadata
      );

      analysis.categories.forEach(category => {
        expect(category.confidence).toBeGreaterThan(0.5);
      });
    });
  });

  describe('Priority Calculation', () => {
    it('should assign high priority to urgent emails', async () => {
      const { urgentEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        urgentEmail.subject,
        urgentEmail.content,
        urgentEmail.sender,
        urgentEmail.metadata
      );

      expect(analysis.priority.score).toBeGreaterThanOrEqual(4);
      expect(analysis.priority.level).toMatch(/High|Urgent|Critical/);
    });

    it('should assign medium priority to business emails', async () => {
      const { businessEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        businessEmail.subject,
        businessEmail.content,
        businessEmail.sender,
        businessEmail.metadata
      );

      expect(analysis.priority.score).toBeGreaterThanOrEqual(2);
      expect(analysis.priority.score).toBeLessThanOrEqual(4);
    });

    it('should assign lower priority to promotional emails', async () => {
      const { promotionalEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        promotionalEmail.subject,
        promotionalEmail.content,
        promotionalEmail.sender,
        promotionalEmail.metadata
      );

      expect(analysis.priority.score).toBeLessThanOrEqual(3);
    });

    it('should boost priority for VIP contacts', async () => {
      const vipEmail = {
        ...mockEmailData.businessEmail,
        metadata: { ...mockEmailData.businessEmail.metadata, isVIP: true },
      };
      
      const analysis = await emailAIService.analyzeEmail(
        vipEmail.subject,
        vipEmail.content,
        vipEmail.sender,
        vipEmail.metadata
      );

      expect(analysis.priority.factors).toContain('From known contact');
      expect(analysis.priority.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('should detect time-sensitive emails', async () => {
      const timeSensitiveEmail = {
        subject: 'Meeting today at 3 PM',
        content: 'Don\'t forget about our meeting today at 3:00 PM. Please confirm.',
        sender: 'colleague@company.com',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        timeSensitiveEmail.subject,
        timeSensitiveEmail.content,
        timeSensitiveEmail.sender,
        timeSensitiveEmail.metadata
      );

      expect(analysis.priority.factors).toContain('Contains time-sensitive information');
    });

    it('should handle reply/forward indicators', async () => {
      const replyEmail = {
        subject: 'RE: Project update needed',
        content: 'Thanks for the update. Let me review and get back to you.',
        sender: 'manager@company.com',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        replyEmail.subject,
        replyEmail.content,
        replyEmail.sender,
        replyEmail.metadata
      );

      expect(analysis.priority.factors).toContain('Reply or forward');
      expect(analysis.priority.score).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Sentiment Analysis', () => {
    it('should detect positive sentiment', async () => {
      const { positiveEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        positiveEmail.subject,
        positiveEmail.content,
        positiveEmail.sender,
        positiveEmail.metadata
      );

      expect(analysis.sentiment.label).toBe('Positive');
      expect(analysis.sentiment.score).toBeGreaterThan(0);
      expect(analysis.sentiment.confidence).toBeGreaterThan(0.7);
      expect(analysis.sentiment.emotions.joy).toBeGreaterThan(0.5);
    });

    it('should detect negative sentiment', async () => {
      const { negativeEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        negativeEmail.subject,
        negativeEmail.content,
        negativeEmail.sender,
        negativeEmail.metadata
      );

      expect(analysis.sentiment.label).toBe('Negative');
      expect(analysis.sentiment.score).toBeLessThan(0);
      expect(analysis.sentiment.confidence).toBeGreaterThan(0.7);
      expect(analysis.sentiment.emotions.anger).toBeGreaterThan(0.5);
    });

    it('should detect neutral sentiment for business emails', async () => {
      const neutralEmail = {
        subject: 'Monthly report',
        content: 'Please find attached the monthly sales report for your review. Let me know if you need any additional information.',
        sender: 'reports@company.com',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        neutralEmail.subject,
        neutralEmail.content,
        neutralEmail.sender,
        neutralEmail.metadata
      );

      expect(analysis.sentiment.label).toBe('Neutral');
      expect(Math.abs(analysis.sentiment.score)).toBeLessThanOrEqual(0.1);
    });

    it('should detect concern/worry emotions', async () => {
      const concernEmail = {
        subject: 'Worried about project deadline',
        content: 'I am concerned about our ability to meet the project deadline. There are several issues we need to address urgently.',
        sender: 'team@company.com',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        concernEmail.subject,
        concernEmail.content,
        concernEmail.sender,
        concernEmail.metadata
      );

      expect(analysis.sentiment.emotions.fear).toBeGreaterThan(0.4);
    });
  });

  describe('Smart Replies', () => {
    it('should generate meeting-related replies', async () => {
      const { meetingInviteEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        meetingInviteEmail.subject,
        meetingInviteEmail.content,
        meetingInviteEmail.sender,
        meetingInviteEmail.metadata
      );

      const meetingReplies = analysis.smartReplies.filter(
        reply => reply.suggestedAction?.includes('meeting') || reply.content.toLowerCase().includes('meeting')
      );
      expect(meetingReplies.length).toBeGreaterThan(0);
    });

    it('should generate appropriate reply tones', async () => {
      const { businessEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        businessEmail.subject,
        businessEmail.content,
        businessEmail.sender,
        businessEmail.metadata
      );

      const professionalReplies = analysis.smartReplies.filter(
        reply => reply.tone === 'Professional'
      );
      expect(professionalReplies.length).toBeGreaterThan(0);
    });

    it('should include confidence scores for replies', async () => {
      const { businessEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        businessEmail.subject,
        businessEmail.content,
        businessEmail.sender,
        businessEmail.metadata
      );

      analysis.smartReplies.forEach(reply => {
        expect(reply.confidence).toBeGreaterThan(0);
        expect(reply.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should generate thank you responses for positive emails', async () => {
      const { positiveEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        positiveEmail.subject,
        positiveEmail.content,
        positiveEmail.sender,
        positiveEmail.metadata
      );

      const thankYouReplies = analysis.smartReplies.filter(
        reply => reply.content.toLowerCase().includes('thank') || 
                reply.content.toLowerCase().includes('appreciate')
      );
      expect(thankYouReplies.length).toBeGreaterThan(0);
    });

    it('should generate question acknowledgment replies', async () => {
      const questionEmail = {
        subject: 'Question about project timeline',
        content: 'Hi, I have a question about the project timeline. When do you expect the first milestone to be completed?',
        sender: 'stakeholder@company.com',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        questionEmail.subject,
        questionEmail.content,
        questionEmail.sender,
        questionEmail.metadata
      );

      const questionReplies = analysis.smartReplies.filter(
        reply => reply.id === 'acknowledge-question'
      );
      expect(questionReplies.length).toBe(1);
    });
  });

  describe('Meeting Extraction', () => {
    it('should extract meeting information', async () => {
      const { meetingInviteEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        meetingInviteEmail.subject,
        meetingInviteEmail.content,
        meetingInviteEmail.sender,
        meetingInviteEmail.metadata
      );

      expect(analysis.meetingExtractions.length).toBeGreaterThan(0);
      
      const meeting = analysis.meetingExtractions[0];
      expect(meeting.title).toBeDefined();
      expect(meeting.confidence).toBeGreaterThan(0.6);
    });

    it('should extract meeting duration', async () => {
      const meetingWithDuration = {
        subject: 'Strategy meeting - 2 hours',
        content: 'Let\'s schedule a 2 hour strategy meeting for next week to discuss the roadmap.',
        sender: 'exec@company.com',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        meetingWithDuration.subject,
        meetingWithDuration.content,
        meetingWithDuration.sender,
        meetingWithDuration.metadata
      );

      if (analysis.meetingExtractions.length > 0) {
        const meeting = analysis.meetingExtractions[0];
        expect(meeting.duration).toBe(120); // 2 hours = 120 minutes
      }
    });

    it('should extract attendees from email addresses', async () => {
      const meetingWithAttendees = {
        subject: 'Team meeting invitation',
        content: 'Please join our team meeting. Attendees: john@company.com, sarah@company.com, mike@company.com',
        sender: 'organizer@company.com',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        meetingWithAttendees.subject,
        meetingWithAttendees.content,
        meetingWithAttendees.sender,
        meetingWithAttendees.metadata
      );

      if (analysis.meetingExtractions.length > 0) {
        const meeting = analysis.meetingExtractions[0];
        expect(meeting.attendees).toContain('john@company.com');
        expect(meeting.attendees).toContain('sarah@company.com');
        expect(meeting.attendees).toContain('mike@company.com');
      }
    });

    it('should detect meeting proposals', async () => {
      const proposalEmail = {
        subject: 'Meeting request - are you available?',
        content: 'I would like to propose a meeting next Tuesday. Are you available at 2 PM?',
        sender: 'colleague@company.com',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        proposalEmail.subject,
        proposalEmail.content,
        proposalEmail.sender,
        proposalEmail.metadata
      );

      if (analysis.meetingExtractions.length > 0) {
        const meeting = analysis.meetingExtractions[0];
        expect(meeting.isProposal).toBe(true);
      }
    });

    it('should extract location information', async () => {
      const meetingWithLocation = {
        subject: 'Board meeting in conference room A',
        content: 'Monthly board meeting will be held in conference room A tomorrow at 10 AM.',
        sender: 'admin@company.com',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        meetingWithLocation.subject,
        meetingWithLocation.content,
        meetingWithLocation.sender,
        meetingWithLocation.metadata
      );

      if (analysis.meetingExtractions.length > 0) {
        const meeting = analysis.meetingExtractions[0];
        expect(meeting.location).toContain('conference room A');
      }
    });
  });

  describe('Key Entity Extraction', () => {
    it('should extract email addresses', async () => {
      const { businessEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        businessEmail.subject,
        businessEmail.content,
        businessEmail.sender,
        businessEmail.metadata
      );

      expect(analysis.keyEntities.people.length).toBeGreaterThan(0);
    });

    it('should extract dates', async () => {
      const { meetingInviteEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        meetingInviteEmail.subject,
        meetingInviteEmail.content,
        meetingInviteEmail.sender,
        meetingInviteEmail.metadata
      );

      expect(analysis.keyEntities.dates.length).toBeGreaterThan(0);
    });

    it('should extract actions', async () => {
      const { businessEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        businessEmail.subject,
        businessEmail.content,
        businessEmail.sender,
        businessEmail.metadata
      );

      expect(analysis.keyEntities.actions).toContain('schedule');
      expect(analysis.keyEntities.actions).toContain('review');
    });

    it('should extract organizations', async () => {
      const orgEmail = {
        subject: 'Partnership with Microsoft Corp',
        content: 'We are exploring a partnership opportunity with Microsoft Corp and Google Inc.',
        sender: 'business@company.com',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        orgEmail.subject,
        orgEmail.content,
        orgEmail.sender,
        orgEmail.metadata
      );

      expect(analysis.keyEntities.organizations.length).toBeGreaterThan(0);
    });

    it('should extract locations', async () => {
      const locationEmail = {
        subject: 'Office visit',
        content: 'Please visit our office at 123 Main Street, building A.',
        sender: 'hr@company.com',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        locationEmail.subject,
        locationEmail.content,
        locationEmail.sender,
        locationEmail.metadata
      );

      expect(analysis.keyEntities.locations.length).toBeGreaterThan(0);
    });
  });

  describe('Summary Generation', () => {
    it('should generate meaningful summaries', async () => {
      const { businessEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        businessEmail.subject,
        businessEmail.content,
        businessEmail.sender,
        businessEmail.metadata
      );

      expect(analysis.summary).toBeDefined();
      expect(analysis.summary.length).toBeGreaterThan(10);
      expect(analysis.summary.length).toBeLessThan(businessEmail.content.length);
    });

    it('should handle short emails', async () => {
      const shortEmail = {
        subject: 'Quick update',
        content: 'All good. Thanks!',
        sender: 'team@company.com',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        shortEmail.subject,
        shortEmail.content,
        shortEmail.sender,
        shortEmail.metadata
      );

      expect(analysis.summary).toBeDefined();
      expect(analysis.summary.length).toBeGreaterThan(0);
    });

    it('should prioritize important sentences', async () => {
      const importantEmail = {
        subject: 'Critical system update',
        content: 'Hello team. We will be performing a critical system update tonight. The system will be down from 11 PM to 1 AM. Please save all work before 11 PM. All users will be notified via email. The update is important for security. Have a great day!',
        sender: 'it@company.com',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        importantEmail.subject,
        importantEmail.content,
        importantEmail.sender,
        importantEmail.metadata
      );

      expect(analysis.summary.toLowerCase()).toContain('critical');
      expect(analysis.summary.toLowerCase()).toContain('system');
    });
  });

  describe('Tag Generation', () => {
    it('should generate relevant tags', async () => {
      const { businessEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        businessEmail.subject,
        businessEmail.content,
        businessEmail.sender,
        businessEmail.metadata
      );

      expect(analysis.tags).toContain('meeting');
      expect(analysis.tags).toContain('urgent');
    });

    it('should tag financial emails', async () => {
      const financialEmail = {
        subject: 'Invoice payment due',
        content: 'Your invoice #12345 payment is due next week. Please process the payment as soon as possible.',
        sender: 'billing@vendor.com',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        financialEmail.subject,
        financialEmail.content,
        financialEmail.sender,
        financialEmail.metadata
      );

      expect(analysis.tags).toContain('financial');
    });

    it('should tag legal documents', async () => {
      const legalEmail = {
        subject: 'Contract review needed',
        content: 'Please review the attached contract and agreement documents. We need your approval by Friday.',
        sender: 'legal@company.com',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        legalEmail.subject,
        legalEmail.content,
        legalEmail.sender,
        legalEmail.metadata
      );

      expect(analysis.tags).toContain('legal');
    });

    it('should tag project-related emails', async () => {
      const projectEmail = {
        subject: 'Project status update',
        content: 'Here is the latest project status update. We have completed task #1 and are working on task #2.',
        sender: 'pm@company.com',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        projectEmail.subject,
        projectEmail.content,
        projectEmail.sender,
        projectEmail.metadata
      );

      expect(analysis.tags).toContain('project');
    });

    it('should not duplicate tags', async () => {
      const { businessEmail } = mockEmailData;
      const analysis = await emailAIService.analyzeEmail(
        businessEmail.subject,
        businessEmail.content,
        businessEmail.sender,
        businessEmail.metadata
      );

      const uniqueTags = [...new Set(analysis.tags)];
      expect(analysis.tags).toEqual(uniqueTags);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple emails', async () => {
      const emails = [
        {
          id: '1',
          subject: mockEmailData.businessEmail.subject,
          content: mockEmailData.businessEmail.content,
          sender: mockEmailData.businessEmail.sender,
          metadata: mockEmailData.businessEmail.metadata,
        },
        {
          id: '2',
          subject: mockEmailData.urgentEmail.subject,
          content: mockEmailData.urgentEmail.content,
          sender: mockEmailData.urgentEmail.sender,
          metadata: mockEmailData.urgentEmail.metadata,
        },
      ];

      const results = await emailAIService.batchAnalyzeEmails(emails);

      expect(Object.keys(results)).toHaveLength(2);
      expect(results['1']).toBeDefined();
      expect(results['2']).toBeDefined();
      expect(results['2'].priority.level).toBe('Critical');
    });

    it('should handle batch processing errors gracefully', async () => {
      const emails = [
        {
          id: '1',
          subject: mockEmailData.businessEmail.subject,
          content: mockEmailData.businessEmail.content,
          sender: mockEmailData.businessEmail.sender,
          metadata: mockEmailData.businessEmail.metadata,
        },
        {
          id: '2',
          subject: null as any, // Invalid subject to trigger error
          content: mockEmailData.urgentEmail.content,
          sender: mockEmailData.urgentEmail.sender,
          metadata: mockEmailData.urgentEmail.metadata,
        },
      ];

      const results = await emailAIService.batchAnalyzeEmails(emails);

      // Should still process valid emails
      expect(results['1']).toBeDefined();
      // Should handle error for invalid email
      expect(results['2']).toBeUndefined();
    });

    it('should process empty batch', async () => {
      const results = await emailAIService.batchAnalyzeEmails([]);
      expect(results).toEqual({});
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty email content', async () => {
      const emptyEmail = {
        subject: 'Empty email',
        content: '',
        sender: 'test@company.com',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        emptyEmail.subject,
        emptyEmail.content,
        emptyEmail.sender,
        emptyEmail.metadata
      );

      expect(analysis).toBeDefined();
      expect(analysis.summary).toBeDefined();
      expect(analysis.categories).toBeDefined();
    });

    it('should handle emails with no sender domain', async () => {
      const noSenderEmail = {
        subject: 'Test email',
        content: 'This is a test email',
        sender: 'invalidemail',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        noSenderEmail.subject,
        noSenderEmail.content,
        noSenderEmail.sender,
        noSenderEmail.metadata
      );

      expect(analysis).toBeDefined();
      expect(analysis.categories).toBeDefined();
    });

    it('should handle very long emails', async () => {
      const longContent = 'This is a very long email. '.repeat(100);
      const longEmail = {
        subject: 'Long email test',
        content: longContent,
        sender: 'test@company.com',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        longEmail.subject,
        longEmail.content,
        longEmail.sender,
        longEmail.metadata
      );

      expect(analysis).toBeDefined();
      expect(analysis.summary.length).toBeLessThan(longContent.length);
    });

    it('should handle special characters and unicode', async () => {
      const unicodeEmail = {
        subject: 'Test with émojis 😀 and special chars: @#$%',
        content: 'Héllo wørld! This email contains spéciàl characters and émojis 🚀✨',
        sender: 'test@company.com',
        metadata: {},
      };

      const analysis = await emailAIService.analyzeEmail(
        unicodeEmail.subject,
        unicodeEmail.content,
        unicodeEmail.sender,
        unicodeEmail.metadata
      );

      expect(analysis).toBeDefined();
      expect(analysis.summary).toBeDefined();
    });

    it('should handle null metadata', async () => {
      const analysis = await emailAIService.analyzeEmail(
        'Test subject',
        'Test content',
        'test@company.com',
        undefined
      );

      expect(analysis).toBeDefined();
      expect(analysis.categories).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should complete analysis within reasonable time', async () => {
      const startTime = Date.now();
      
      await emailAIService.analyzeEmail(
        mockEmailData.businessEmail.subject,
        mockEmailData.businessEmail.content,
        mockEmailData.businessEmail.sender,
        mockEmailData.businessEmail.metadata
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within 1 second for typical email
      expect(duration).toBeLessThan(1000);
    });

    it('should handle concurrent analysis', async () => {
      const promises = Array(5).fill(null).map(() =>
        emailAIService.analyzeEmail(
          mockEmailData.businessEmail.subject,
          mockEmailData.businessEmail.content,
          mockEmailData.businessEmail.sender,
          mockEmailData.businessEmail.metadata
        )
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.categories).toBeDefined();
      });
    });
  });
});