/**
 * Email Analysis Service
 * AI-powered email categorization, sentiment analysis, and smart features
 */

import { AIProviderService, type AINodeConfig } from './aiProvider';
import type { GmailMessage } from '../types/gmail';
import logger from '../utils/logger';

export interface EmailAnalysis {
  category: 'work' | 'personal' | 'marketing' | 'newsletter' | 'social' | 'notification' | 'spam';
  sentiment: 'positive' | 'neutral' | 'negative';
  priority: 'high' | 'medium' | 'low';
  intent: 'action_required' | 'fyi' | 'question' | 'meeting' | 'proposal' | 'follow_up' | 'general';
  summary?: string;
  confidence: number; // 0-1
  suggestedActions?: string[];
}

export interface SmartReply {
  tone: 'professional' | 'friendly' | 'casual' | 'formal';
  content: string;
  confidence: number;
}

export interface EmailSummary {
  shortSummary: string; // 1-2 sentences
  longSummary?: string; // Detailed summary for long threads
  keyPoints: string[];
  actionItems?: string[];
}

class EmailAnalysisServiceClass {
  private aiProvider: AIProviderService;
  private analysisCache: Map<string, EmailAnalysis> = new Map();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.aiProvider = AIProviderService.getInstance();
  }

  /**
   * Analyze an email for category, sentiment, priority, and intent
   */
  async analyzeEmail(email: GmailMessage, userId?: string): Promise<EmailAnalysis> {
    try {
      // Check cache first
      const cacheKey = `${email.id}_analysis`;
      if (this.analysisCache.has(cacheKey)) {
        const cached = this.analysisCache.get(cacheKey)!;
        logger.log('📊 Using cached email analysis:', { emailId: email.id });
        return cached;
      }

      logger.log('🤖 Analyzing email with AI:', {
        emailId: email.id,
        subject: email.subject,
        from: email.from
      });

      // Prepare email content for analysis
      const emailContent = `
Subject: ${email.subject}
From: ${email.from}
To: ${email.to}
Date: ${email.date}

Body (first 500 chars):
${email.snippet || email.body?.substring(0, 500) || 'No content'}
      `.trim();

      const config: AINodeConfig = {
        modelProvider: 'openai',
        model: 'gpt-4o-mini', // Fast and cost-effective for classification
        systemPrompt: `You are an email analysis assistant. Analyze the provided email and extract key information.

Respond with valid JSON only, using this exact schema:
{
  "category": "work" | "personal" | "marketing" | "newsletter" | "social" | "notification" | "spam",
  "sentiment": "positive" | "neutral" | "negative",
  "priority": "high" | "medium" | "low",
  "intent": "action_required" | "fyi" | "question" | "meeting" | "proposal" | "follow_up" | "general",
  "confidence": 0.0 to 1.0,
  "suggestedActions": ["action1", "action2"] (optional, max 3)
}

Guidelines:
- category: Classify based on sender, content, and purpose
- sentiment: Overall emotional tone of the email
- priority: Based on urgency indicators, deadlines, and importance
- intent: Primary purpose of the email
- confidence: Your confidence in this analysis (0.0-1.0)
- suggestedActions: Up to 3 recommended next steps`,
        userPrompt: emailContent,
        temperature: 0.3, // Lower temperature for consistent classification
        maxTokens: 300,
        outputFormat: 'json',
      };

      const response = await this.aiProvider.complete(config, {}, userId);

      if (response.error || !response.processedData) {
        throw new Error(response.error || 'Failed to analyze email');
      }

      const analysis: EmailAnalysis = {
        category: response.processedData.category || 'personal',
        sentiment: response.processedData.sentiment || 'neutral',
        priority: response.processedData.priority || 'medium',
        intent: response.processedData.intent || 'general',
        confidence: response.processedData.confidence || 0.7,
        suggestedActions: response.processedData.suggestedActions || [],
      };

      // Cache the result
      this.analysisCache.set(cacheKey, analysis);

      logger.log('✅ Email analysis complete:', analysis);
      return analysis;
    } catch (error) {
      logger.error('❌ Error analyzing email:', error);
      // Return default analysis on error
      return {
        category: 'personal',
        sentiment: 'neutral',
        priority: 'medium',
        intent: 'general',
        confidence: 0.0,
      };
    }
  }

  /**
   * Generate smart reply suggestions for an email
   */
  async generateSmartReplies(
    email: GmailMessage,
    userId?: string,
    tone: 'professional' | 'friendly' | 'casual' | 'formal' = 'professional'
  ): Promise<SmartReply[]> {
    try {
      logger.log('💡 Generating smart replies for email:', { emailId: email.id, tone });

      const emailContent = `
Subject: ${email.subject}
From: ${email.from}

Body:
${email.body?.substring(0, 1000) || email.snippet || 'No content'}
      `.trim();

      const config: AINodeConfig = {
        modelProvider: 'openai',
        model: 'gpt-4o-mini',
        systemPrompt: `You are an email reply assistant. Generate 3 short, contextual reply suggestions based on the email content.

Respond with valid JSON only:
{
  "replies": [
    {
      "tone": "professional" | "friendly" | "casual" | "formal",
      "content": "short reply text (2-3 sentences max)",
      "confidence": 0.0 to 1.0
    }
  ]
}

Guidelines:
- Keep replies concise and contextual
- Vary the approach (confirm, decline, request info, etc.)
- Match the requested tone: ${tone}
- Each reply should be different and useful`,
        userPrompt: emailContent,
        temperature: 0.7,
        maxTokens: 400,
        outputFormat: 'json',
      };

      const response = await this.aiProvider.complete(config, {}, userId);

      if (response.error || !response.processedData?.replies) {
        throw new Error(response.error || 'Failed to generate smart replies');
      }

      const replies: SmartReply[] = response.processedData.replies.map((r: any) => ({
        tone: r.tone || tone,
        content: r.content || '',
        confidence: r.confidence || 0.7,
      }));

      logger.log('✅ Generated smart replies:', { count: replies.length });
      return replies;
    } catch (error) {
      logger.error('❌ Error generating smart replies:', error);
      return [];
    }
  }

  /**
   * Summarize a long email or email thread
   */
  async summarizeEmail(
    email: GmailMessage | GmailMessage[],
    userId?: string
  ): Promise<EmailSummary> {
    try {
      const isThread = Array.isArray(email);
      const emails = isThread ? email : [email];

      logger.log('📝 Summarizing email(s):', {
        count: emails.length,
        isThread
      });

      // Prepare thread content
      const threadContent = emails.map((e, i) => `
--- Email ${i + 1} ---
From: ${e.from}
Date: ${e.date}
Subject: ${e.subject}

${e.body?.substring(0, 1500) || e.snippet || 'No content'}
      `).join('\n\n');

      const config: AINodeConfig = {
        modelProvider: 'openai',
        model: 'gpt-4o-mini',
        systemPrompt: `You are an email summarization assistant. Provide a concise summary of the email(s).

Respond with valid JSON only:
{
  "shortSummary": "1-2 sentence summary",
  "longSummary": "detailed paragraph summary (optional)",
  "keyPoints": ["point1", "point2", "point3"],
  "actionItems": ["action1", "action2"] (optional)
}

Guidelines:
- shortSummary: Capture the essence in 1-2 sentences
- longSummary: Provide more detail for complex emails
- keyPoints: 3-5 most important points from the email(s)
- actionItems: Specific actions requested or needed`,
        userPrompt: `Summarize this ${isThread ? 'email thread' : 'email'}:\n\n${threadContent}`,
        temperature: 0.5,
        maxTokens: 500,
        outputFormat: 'json',
      };

      const response = await this.aiProvider.complete(config, {}, userId);

      if (response.error || !response.processedData) {
        throw new Error(response.error || 'Failed to summarize email');
      }

      const summary: EmailSummary = {
        shortSummary: response.processedData.shortSummary || 'Summary not available',
        longSummary: response.processedData.longSummary,
        keyPoints: response.processedData.keyPoints || [],
        actionItems: response.processedData.actionItems || [],
      };

      logger.log('✅ Email summary generated:', summary);
      return summary;
    } catch (error) {
      logger.error('❌ Error summarizing email:', error);
      return {
        shortSummary: 'Error generating summary',
        keyPoints: [],
      };
    }
  }

  /**
   * Generate smart compose suggestions based on context
   */
  async generateSmartCompose(
    context: {
      recipient?: string;
      subject?: string;
      replyToEmail?: GmailMessage;
      tone?: 'professional' | 'friendly' | 'casual' | 'formal';
      purpose?: string;
    },
    userId?: string
  ): Promise<{ subject: string; body: string }> {
    try {
      logger.log('✍️ Generating smart compose:', context);

      const { recipient, subject, replyToEmail, tone = 'professional', purpose } = context;

      let promptContext = '';
      if (replyToEmail) {
        promptContext = `This is a reply to:\nFrom: ${replyToEmail.from}\nSubject: ${replyToEmail.subject}\n\n${replyToEmail.snippet}`;
      } else {
        promptContext = `Composing a new email to: ${recipient || 'recipient'}`;
        if (subject) promptContext += `\nSubject: ${subject}`;
        if (purpose) promptContext += `\nPurpose: ${purpose}`;
      }

      const config: AINodeConfig = {
        modelProvider: 'openai',
        model: 'gpt-4o',
        systemPrompt: `You are an email composition assistant. Generate a well-written email based on the context.

Respond with valid JSON only:
{
  "subject": "email subject line",
  "body": "email body with proper formatting and paragraphs"
}

Guidelines:
- Use ${tone} tone throughout
- Keep it concise but complete
- Include proper greeting and closing
- Use proper email formatting`,
        userPrompt: promptContext,
        temperature: 0.7,
        maxTokens: 600,
        outputFormat: 'json',
      };

      const response = await this.aiProvider.complete(config, {}, userId);

      if (response.error || !response.processedData) {
        throw new Error(response.error || 'Failed to generate email');
      }

      const result = {
        subject: response.processedData.subject || subject || '',
        body: response.processedData.body || '',
      };

      logger.log('✅ Smart compose generated');
      return result;
    } catch (error) {
      logger.error('❌ Error generating smart compose:', error);
      return {
        subject: context.subject || '',
        body: '',
      };
    }
  }

  /**
   * Batch analyze multiple emails
   */
  async batchAnalyzeEmails(
    emails: GmailMessage[],
    userId?: string
  ): Promise<Map<string, EmailAnalysis>> {
    const results = new Map<string, EmailAnalysis>();

    // Process in batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const analyses = await Promise.all(
        batch.map(email => this.analyzeEmail(email, userId))
      );

      batch.forEach((email, index) => {
        results.set(email.id, analyses[index]);
      });

      // Small delay between batches
      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
    logger.log('🗑️ Email analysis cache cleared');
  }
}

// Export singleton instance
export const emailAnalysisService = new EmailAnalysisServiceClass();
