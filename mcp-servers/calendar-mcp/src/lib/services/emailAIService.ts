/**
 * Email AI Service
 * AI-powered email categorization, prioritization, and smart features
 */

export interface EmailCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  confidence: number;
}

export interface EmailPriority {
  score: number; // 1-5 scale
  level: 'Low' | 'Medium' | 'High' | 'Urgent' | 'Critical';
  factors: string[];
  confidence: number;
}

export interface EmailSentiment {
  score: number; // -1 to 1 scale
  label: 'Negative' | 'Neutral' | 'Positive';
  confidence: number;
  emotions: {
    joy: number;
    anger: number;
    fear: number;
    sadness: number;
    surprise: number;
  };
}

export interface SmartReply {
  id: string;
  content: string;
  tone: 'Professional' | 'Casual' | 'Friendly' | 'Formal';
  confidence: number;
  suggestedAction?: string;
}

export interface MeetingExtraction {
  id: string;
  title: string;
  dateTime?: Date;
  duration?: number; // minutes
  attendees: string[];
  location?: string;
  description: string;
  confidence: number;
  isProposal: boolean;
}

export interface EmailAnalysis {
  categories: EmailCategory[];
  priority: EmailPriority;
  sentiment: EmailSentiment;
  smartReplies: SmartReply[];
  meetingExtractions: MeetingExtraction[];
  keyEntities: {
    people: string[];
    organizations: string[];
    locations: string[];
    dates: string[];
    actions: string[];
  };
  summary: string;
  tags: string[];
}

class EmailAIService {
  private readonly categories = [
    { id: 'primary', name: 'Primary', description: 'Important personal emails', color: '#3B82F6' },
    { id: 'updates', name: 'Updates', description: 'Notifications and updates', color: '#10B981' },
    { id: 'promotions', name: 'Promotions', description: 'Marketing and promotional emails', color: '#F59E0B' },
    { id: 'forums', name: 'Forums', description: 'Mailing lists and forums', color: '#8B5CF6' },
    { id: 'social', name: 'Social', description: 'Social media notifications', color: '#EF4444' },
  ];

  private readonly priorityKeywords = {
    urgent: ['urgent', 'asap', 'immediately', 'emergency', 'critical', 'deadline'],
    high: ['important', 'priority', 'action required', 'time-sensitive', 'follow up'],
    medium: ['meeting', 'schedule', 'proposal', 'review', 'feedback'],
    low: ['newsletter', 'update', 'notification', 'reminder', 'fyi'],
  };

  private readonly meetingKeywords = [
    'meeting', 'call', 'conference', 'appointment', 'schedule', 'calendar',
    'zoom', 'teams', 'webinar', 'interview', 'discussion', 'sync',
  ];

  private readonly timeExpressions = [
    /\b(?:tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
    /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?\b/gi,
    /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g,
    /\b\d{1,2}:\d{2}\s*(?:am|pm)?\b/gi,
  ];

  /**
   * Analyze email content with AI features
   */
  async analyzeEmail(
    subject: string,
    content: string,
    sender: string,
    metadata?: Record<string, any>
  ): Promise<EmailAnalysis> {
    const fullText = `${subject} ${content}`;
    
    const [
      categories,
      priority,
      sentiment,
      smartReplies,
      meetingExtractions,
      keyEntities,
      summary,
      tags,
    ] = await Promise.all([
      this.categorizeEmail(subject, content, sender, metadata),
      this.calculatePriority(subject, content, sender, metadata),
      this.analyzeSentiment(content),
      this.generateSmartReplies(subject, content, sender),
      this.extractMeetings(subject, content),
      this.extractKeyEntities(fullText),
      this.generateSummary(subject, content),
      this.generateTags(fullText),
    ]);

    return {
      categories,
      priority,
      sentiment,
      smartReplies,
      meetingExtractions,
      keyEntities,
      summary,
      tags,
    };
  }

  /**
   * Categorize email into predefined categories
   */
  private async categorizeEmail(
    subject: string,
    content: string,
    sender: string,
    metadata?: Record<string, any>
  ): Promise<EmailCategory[]> {
    const fullText = `${subject} ${content}`.toLowerCase();
    const senderDomain = sender.split('@')[1]?.toLowerCase() || '';
    
    const categoryScores = await Promise.all(
      this.categories.map(async (category) => {
        let score = 0;
        let confidence = 0;

        switch (category.id) {
          case 'primary':
            // Personal emails from known contacts
            if (!senderDomain.includes('noreply') && 
                !senderDomain.includes('no-reply') &&
                !fullText.includes('unsubscribe') &&
                (fullText.includes('meeting') || 
                 fullText.includes('proposal') || 
                 fullText.includes('follow up') ||
                 metadata?.isFromContact)) {
              score = 0.8;
              confidence = 0.9;
            }
            break;

          case 'updates':
            // Notifications and system updates
            if (fullText.includes('notification') ||
                fullText.includes('update') ||
                fullText.includes('status') ||
                fullText.includes('alert') ||
                senderDomain.includes('noreply')) {
              score = 0.7;
              confidence = 0.8;
            }
            break;

          case 'promotions':
            // Marketing emails
            if (fullText.includes('sale') ||
                fullText.includes('discount') ||
                fullText.includes('offer') ||
                fullText.includes('deal') ||
                fullText.includes('promotion') ||
                fullText.includes('unsubscribe')) {
              score = 0.6;
              confidence = 0.85;
            }
            break;

          case 'forums':
            // Mailing lists and forums
            if (fullText.includes('mailing list') ||
                fullText.includes('forum') ||
                fullText.includes('discussion') ||
                fullText.includes('thread') ||
                senderDomain.includes('groups.') ||
                senderDomain.includes('list.')) {
              score = 0.75;
              confidence = 0.9;
            }
            break;

          case 'social':
            // Social media notifications
            if (senderDomain.includes('facebook') ||
                senderDomain.includes('twitter') ||
                senderDomain.includes('linkedin') ||
                senderDomain.includes('instagram') ||
                fullText.includes('social') ||
                fullText.includes('connection')) {
              score = 0.8;
              confidence = 0.95;
            }
            break;
        }

        return {
          ...category,
          confidence: Math.min(confidence + (score * 0.1), 1),
        };
      })
    );

    // Return categories with confidence > 0.5, sorted by confidence
    return categoryScores
      .filter(cat => cat.confidence > 0.5)
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate email priority based on content and sender
   */
  private async calculatePriority(
    subject: string,
    content: string,
    sender: string,
    metadata?: Record<string, any>
  ): Promise<EmailPriority> {
    const fullText = `${subject} ${content}`.toLowerCase();
    const factors: string[] = [];
    let score = 2; // Default medium priority
    let confidence = 0.7;

    // Check urgent keywords
    if (this.priorityKeywords.urgent.some(keyword => fullText.includes(keyword))) {
      score = Math.max(score, 5);
      factors.push('Contains urgent keywords');
      confidence = 0.9;
    }

    // Check high priority keywords
    if (this.priorityKeywords.high.some(keyword => fullText.includes(keyword))) {
      score = Math.max(score, 4);
      factors.push('Contains high priority keywords');
      confidence = Math.max(confidence, 0.8);
    }

    // Check medium priority keywords
    if (this.priorityKeywords.medium.some(keyword => fullText.includes(keyword))) {
      score = Math.max(score, 3);
      factors.push('Contains meeting or business keywords');
    }

    // Check low priority keywords
    if (this.priorityKeywords.low.some(keyword => fullText.includes(keyword))) {
      score = Math.min(score, 2);
      factors.push('Contains informational keywords');
    }

    // From known contact or VIP
    if (metadata?.isFromContact || metadata?.isVIP) {
      score = Math.min(score + 1, 5);
      factors.push('From known contact');
      confidence = Math.max(confidence, 0.85);
    }

    // Time-sensitive indicators
    const timeMatches = this.timeExpressions.some(regex => regex.test(fullText));
    if (timeMatches) {
      score = Math.min(score + 1, 5);
      factors.push('Contains time-sensitive information');
    }

    // Subject line indicators
    if (subject.includes('RE:') || subject.includes('FW:')) {
      score = Math.max(score, 3);
      factors.push('Reply or forward');
    }

    const levelMap: Record<number, EmailPriority['level']> = {
      1: 'Low',
      2: 'Medium',
      3: 'Medium',
      4: 'High',
      5: 'Urgent',
    };

    // Critical override for specific patterns
    if (fullText.includes('critical') || fullText.includes('emergency')) {
      score = 5;
      return {
        score: 5,
        level: 'Critical',
        factors: [...factors, 'Critical/Emergency keywords'],
        confidence: 0.95,
      };
    }

    return {
      score,
      level: levelMap[score] || 'Medium',
      factors,
      confidence,
    };
  }

  /**
   * Analyze email sentiment
   */
  private async analyzeSentiment(content: string): Promise<EmailSentiment> {
    const text = content.toLowerCase();
    
    // Simple sentiment analysis based on keyword matching
    const positiveWords = [
      'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'perfect',
      'love', 'like', 'enjoy', 'pleased', 'happy', 'excited', 'thank',
      'appreciate', 'congratulations', 'success', 'achieve', 'accomplish',
    ];

    const negativeWords = [
      'terrible', 'awful', 'horrible', 'bad', 'worst', 'hate', 'dislike',
      'angry', 'frustrated', 'disappointed', 'upset', 'problem', 'issue',
      'error', 'mistake', 'fail', 'wrong', 'concern', 'worried',
    ];

    const positiveCount = positiveWords.filter(word => text.includes(word)).length;
    const negativeCount = negativeWords.filter(word => text.includes(word)).length;
    
    const totalWords = text.split(' ').length;
    const sentimentScore = (positiveCount - negativeCount) / Math.max(totalWords / 100, 1);
    
    let label: EmailSentiment['label'];
    let confidence = 0.7;
    
    if (sentimentScore > 0.1) {
      label = 'Positive';
      confidence = 0.8;
    } else if (sentimentScore < -0.1) {
      label = 'Negative';
      confidence = 0.8;
    } else {
      label = 'Neutral';
      confidence = 0.6;
    }

    // Mock emotion scores
    const emotions = {
      joy: label === 'Positive' ? 0.8 : 0.2,
      anger: label === 'Negative' ? 0.7 : 0.1,
      fear: text.includes('concern') || text.includes('worry') ? 0.6 : 0.1,
      sadness: label === 'Negative' ? 0.5 : 0.1,
      surprise: text.includes('surprise') || text.includes('unexpected') ? 0.7 : 0.1,
    };

    return {
      score: Math.max(-1, Math.min(1, sentimentScore)),
      label,
      confidence,
      emotions,
    };
  }

  /**
   * Generate smart reply suggestions
   */
  private async generateSmartReplies(
    subject: string,
    content: string,
    sender: string
  ): Promise<SmartReply[]> {
    const text = content.toLowerCase();
    const replies: SmartReply[] = [];

    // Meeting request reply
    if (this.meetingKeywords.some(keyword => text.includes(keyword))) {
      replies.push({
        id: 'meeting-accept',
        content: "Thank you for the meeting invitation. I'm available at the proposed time. Looking forward to our discussion.",
        tone: 'Professional',
        confidence: 0.9,
        suggestedAction: 'Accept meeting',
      });

      replies.push({
        id: 'meeting-reschedule',
        content: "Thank you for reaching out. Unfortunately, I'm not available at the proposed time. Could we schedule for [alternative time]?",
        tone: 'Professional',
        confidence: 0.85,
        suggestedAction: 'Request reschedule',
      });
    }

    // Question response
    if (text.includes('?') || text.includes('question')) {
      replies.push({
        id: 'acknowledge-question',
        content: "Thank you for your question. I'll review this and get back to you with a detailed response shortly.",
        tone: 'Professional',
        confidence: 0.8,
      });
    }

    // Thank you responses
    if (text.includes('thank') || text.includes('appreciate')) {
      replies.push({
        id: 'thank-response',
        content: "You're very welcome! Please don't hesitate to reach out if you need anything else.",
        tone: 'Friendly',
        confidence: 0.9,
      });
    }

    // Information request
    if (text.includes('information') || text.includes('details')) {
      replies.push({
        id: 'info-provide',
        content: "I'll gather the requested information and send it over by [date]. Thank you for your patience.",
        tone: 'Professional',
        confidence: 0.85,
      });
    }

    // General acknowledgment
    replies.push({
      id: 'acknowledge',
      content: "Thank you for your email. I've received your message and will respond accordingly.",
      tone: 'Professional',
      confidence: 0.7,
    });

    return replies;
  }

  /**
   * Extract meeting information from email content
   */
  private async extractMeetings(subject: string, content: string): Promise<MeetingExtraction[]> {
    const fullText = `${subject} ${content}`;
    const meetings: MeetingExtraction[] = [];

    // Check if email contains meeting-related content
    const hasMeetingKeywords = this.meetingKeywords.some(keyword => 
      fullText.toLowerCase().includes(keyword)
    );

    if (!hasMeetingKeywords) {
      return meetings;
    }

    // Extract potential meeting title
    let title = subject;
    if (title.startsWith('RE: ') || title.startsWith('FW: ')) {
      title = title.substring(4);
    }

    // Extract time information
    const timeMatches = [];
    for (const regex of this.timeExpressions) {
      const matches = fullText.match(regex);
      if (matches) {
        timeMatches.push(...matches);
      }
    }

    // Extract attendees (email addresses)
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emailMatches = fullText.match(emailRegex) || [];
    const attendees = [...new Set(emailMatches)]; // Remove duplicates

    // Extract location
    const locationKeywords = ['room', 'office', 'zoom', 'teams', 'meet', 'conference'];
    const locationMatch = locationKeywords.find(keyword => 
      fullText.toLowerCase().includes(keyword)
    );

    const isProposal = fullText.toLowerCase().includes('propose') || 
                      fullText.toLowerCase().includes('available') ||
                      subject.toLowerCase().includes('meeting request');

    meetings.push({
      id: `meeting-${Date.now()}`,
      title: title.replace(/^(meeting|call|sync):?\s*/i, ''),
      dateTime: timeMatches.length > 0 ? this.parseDateTime(timeMatches[0]) : undefined,
      duration: this.extractDuration(fullText),
      attendees,
      location: locationMatch ? this.extractLocation(fullText, locationMatch) : undefined,
      description: content.slice(0, 200) + (content.length > 200 ? '...' : ''),
      confidence: timeMatches.length > 0 ? 0.9 : 0.7,
      isProposal,
    });

    return meetings;
  }

  /**
   * Extract key entities from text
   */
  private async extractKeyEntities(text: string): Promise<EmailAnalysis['keyEntities']> {
    // Simple entity extraction using patterns
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const people = (text.match(emailRegex) || []).map(email => email.split('@')[0]);

    // Organization patterns
    const orgKeywords = ['company', 'corp', 'inc', 'llc', 'ltd', 'organization'];
    const organizations: string[] = [];
    orgKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b\\w+\\s+${keyword}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        organizations.push(...matches);
      }
    });

    // Location patterns
    const locations = text.match(/\b(?:room|office|building|street|avenue|drive)\s+\w+/gi) || [];

    // Date patterns
    const dates = [];
    for (const regex of this.timeExpressions) {
      const matches = text.match(regex);
      if (matches) {
        dates.push(...matches);
      }
    }

    // Action patterns
    const actionWords = ['schedule', 'meet', 'call', 'review', 'discuss', 'follow up', 'send', 'share'];
    const actions = actionWords.filter(action => text.toLowerCase().includes(action));

    return {
      people: [...new Set(people)],
      organizations: [...new Set(organizations)],
      locations: [...new Set(locations)],
      dates: [...new Set(dates)],
      actions: [...new Set(actions)],
    };
  }

  /**
   * Generate email summary
   */
  private async generateSummary(subject: string, content: string): Promise<string> {
    // Simple extractive summarization
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    if (sentences.length <= 2) {
      return content.slice(0, 200) + (content.length > 200 ? '...' : '');
    }

    // Score sentences based on position and keyword relevance
    const importantKeywords = ['meeting', 'proposal', 'urgent', 'deadline', 'important', 'schedule'];
    
    const scoredSentences = sentences.map((sentence, index) => {
      let score = 0;
      
      // Position scoring (earlier sentences are more important)
      score += (sentences.length - index) / sentences.length;
      
      // Keyword scoring
      const keywordCount = importantKeywords.filter(keyword => 
        sentence.toLowerCase().includes(keyword)
      ).length;
      score += keywordCount * 0.5;
      
      return { sentence: sentence.trim(), score };
    });

    // Get top 2 sentences
    const topSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(s => s.sentence);

    return topSentences.join('. ') + '.';
  }

  /**
   * Generate relevant tags for email
   */
  private async generateTags(text: string): Promise<string[]> {
    const lowerText = text.toLowerCase();
    const tags: string[] = [];

    // Business context tags
    if (lowerText.includes('meeting') || lowerText.includes('call')) {
      tags.push('meeting');
    }
    if (lowerText.includes('proposal') || lowerText.includes('quote')) {
      tags.push('proposal');
    }
    if (lowerText.includes('follow up') || lowerText.includes('follow-up')) {
      tags.push('follow-up');
    }
    if (lowerText.includes('urgent') || lowerText.includes('asap')) {
      tags.push('urgent');
    }
    if (lowerText.includes('deadline') || lowerText.includes('due')) {
      tags.push('deadline');
    }

    // Content type tags
    if (lowerText.includes('invoice') || lowerText.includes('payment')) {
      tags.push('financial');
    }
    if (lowerText.includes('contract') || lowerText.includes('agreement')) {
      tags.push('legal');
    }
    if (lowerText.includes('project') || lowerText.includes('task')) {
      tags.push('project');
    }

    return [...new Set(tags)];
  }

  /**
   * Helper method to parse date/time from text
   */
  private parseDateTime(dateStr: string): Date | undefined {
    try {
      // Simple date parsing - in production, use a proper date parsing library
      const now = new Date();
      
      if (dateStr.toLowerCase().includes('tomorrow')) {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      }
      
      if (dateStr.toLowerCase().includes('today')) {
        return now;
      }

      // Try to parse as regular date
      const parsed = new Date(dateStr);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    } catch {
      return undefined;
    }
  }

  /**
   * Extract duration from text
   */
  private extractDuration(text: string): number | undefined {
    const durationRegex = /(\d+)\s*(?:hour|hr|minute|min)/gi;
    const match = text.match(durationRegex);
    
    if (match) {
      const numbers = match[0].match(/\d+/);
      if (numbers) {
        const num = parseInt(numbers[0]);
        const isHours = match[0].toLowerCase().includes('hour') || match[0].toLowerCase().includes('hr');
        return isHours ? num * 60 : num;
      }
    }
    
    return 30; // Default 30 minutes
  }

  /**
   * Extract location from text
   */
  private extractLocation(text: string, keyword: string): string | undefined {
    const regex = new RegExp(`${keyword}\\s+[\\w\\s-]+`, 'i');
    const match = text.match(regex);
    return match ? match[0].trim() : undefined;
  }

  /**
   * Batch analyze multiple emails
   */
  async batchAnalyzeEmails(
    emails: Array<{
      id: string;
      subject: string;
      content: string;
      sender: string;
      metadata?: Record<string, any>;
    }>
  ): Promise<Record<string, EmailAnalysis>> {
    const results = await Promise.allSettled(
      emails.map(async email => ({
        id: email.id,
        analysis: await this.analyzeEmail(email.subject, email.content, email.sender, email.metadata),
      }))
    );

    const analysisMap: Record<string, EmailAnalysis> = {};
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        analysisMap[result.value.id] = result.value.analysis;
      } else {
      }
    });

    return analysisMap;
  }
}

export const emailAIService = new EmailAIService();