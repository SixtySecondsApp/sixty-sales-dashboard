import { gmail_v1 } from 'googleapis';
import { z } from 'zod';
import { GmailOAuthManager } from './auth/oauth.js';

// Validation schemas
const MessageIdSchema = z.string().min(1, 'Message ID is required');
const ThreadIdSchema = z.string().min(1, 'Thread ID is required');
const LabelIdSchema = z.string().min(1, 'Label ID is required');
const EmailAddressSchema = z.string().email('Valid email address required');

const EmailSearchParamsSchema = z.object({
  query: z.string().optional(),
  maxResults: z.number().min(1).max(500).default(10),
  labelIds: z.array(z.string()).optional(),
  includeSpamTrash: z.boolean().default(false),
});

const SendEmailParamsSchema = z.object({
  to: z.array(EmailAddressSchema).min(1, 'At least one recipient required'),
  cc: z.array(EmailAddressSchema).optional(),
  bcc: z.array(EmailAddressSchema).optional(),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Email body is required'),
  isHtml: z.boolean().default(false),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(), // base64 encoded
    contentType: z.string(),
  })).optional(),
});

const ReplyParamsSchema = z.object({
  messageId: MessageIdSchema,
  body: z.string().min(1, 'Reply body is required'),
  replyAll: z.boolean().default(false),
  isHtml: z.boolean().default(false),
});

const ForwardParamsSchema = z.object({
  messageId: MessageIdSchema,
  to: z.array(EmailAddressSchema).min(1, 'At least one recipient required'),
  additionalMessage: z.string().optional(),
});

const CreateLabelParamsSchema = z.object({
  name: z.string().min(1, 'Label name is required'),
  messageListVisibility: z.enum(['show', 'hide']).default('show'),
  labelListVisibility: z.enum(['labelShow', 'labelHide', 'labelShowIfUnread']).default('labelShow'),
  color: z.object({
    textColor: z.string().optional(),
    backgroundColor: z.string().optional(),
  }).optional(),
});

// Type definitions
export type EmailSearchParams = z.infer<typeof EmailSearchParamsSchema>;
export type SendEmailParams = z.infer<typeof SendEmailParamsSchema>;
export type ReplyParams = z.infer<typeof ReplyParamsSchema>;
export type ForwardParams = z.infer<typeof ForwardParamsSchema>;
export type CreateLabelParams = z.infer<typeof CreateLabelParamsSchema>;

export interface EmailSummary {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  to: string[];
  subject: string;
  date: string;
  labels: string[];
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
}

export interface EmailContent extends EmailSummary {
  body: string;
  bodyHtml?: string | undefined;
  attachments: {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
  }[];
}

export interface ThreadSummary {
  id: string;
  snippet: string;
  historyId: string;
  messageCount: number;
  messages: EmailSummary[];
  participants: string[];
  subject: string;
  lastMessageDate: string;
  labels: string[];
}

/**
 * Gmail API Client Wrapper
 * Provides high-level methods for Gmail operations
 */
export class GmailClient {
  constructor(private authManager: GmailOAuthManager) {
    if (!authManager.isAuthenticated()) {
      throw new Error('Gmail client requires authenticated OAuth manager');
    }
  }

  /**
   * List emails with optional filtering
   */
  async listEmails(params: EmailSearchParams = { maxResults: 10, includeSpamTrash: false }): Promise<EmailSummary[]> {
    const validatedParams = EmailSearchParamsSchema.parse(params);
    const gmail = this.authManager.getGmailClient();

    try {
      const listParams: any = {
        userId: 'me',
        maxResults: validatedParams.maxResults,
        includeSpamTrash: validatedParams.includeSpamTrash,
      };

      if (validatedParams.query) {
        listParams.q = validatedParams.query;
      }

      if (validatedParams.labelIds) {
        listParams.labelIds = validatedParams.labelIds;
      }

      const response = await gmail.users.messages.list(listParams);

      if (!response.data.messages) {
        return [];
      }

      // Batch get message details
      const messageDetails = await this.batchGetMessages(
        response.data.messages.map(msg => msg.id!),
        'metadata'
      );

      return messageDetails.map(this.parseEmailSummary);
    } catch (error) {
      throw new Error(`Failed to list emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get specific email by ID
   */
  async getEmail(messageId: string, format: 'minimal' | 'full' | 'raw' | 'metadata' = 'full'): Promise<EmailContent> {
    const validatedId = MessageIdSchema.parse(messageId);
    const gmail = this.authManager.getGmailClient();

    try {
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: validatedId,
        format: format,
      });

      return this.parseEmailContent(response.data);
    } catch (error) {
      throw new Error(`Failed to get email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get email thread
   */
  async getThread(threadId: string, format: 'minimal' | 'full' | 'metadata' = 'full'): Promise<ThreadSummary> {
    const validatedId = ThreadIdSchema.parse(threadId);
    const gmail = this.authManager.getGmailClient();

    try {
      const response = await gmail.users.threads.get({
        userId: 'me',
        id: validatedId,
        format: format,
      });

      return this.parseThreadSummary(response.data);
    } catch (error) {
      throw new Error(`Failed to get thread: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search emails
   */
  async searchEmails(query: string, maxResults: number = 20, includeSpamTrash: boolean = false): Promise<EmailSummary[]> {
    return this.listEmails({
      query,
      maxResults,
      includeSpamTrash,
    });
  }

  /**
   * Send new email
   */
  async sendEmail(params: SendEmailParams): Promise<string> {
    const validatedParams = SendEmailParamsSchema.parse(params);
    const gmail = this.authManager.getGmailClient();

    try {
      const email = this.buildEmailMessage(validatedParams);
      
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: email,
        },
      });

      return response.data.id!;
    } catch (error) {
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Reply to email
   */
  async replyToEmail(params: ReplyParams): Promise<string> {
    const validatedParams = ReplyParamsSchema.parse(params);
    const gmail = this.authManager.getGmailClient();

    try {
      // Get original message details
      const originalMessage = await this.getEmail(validatedParams.messageId, 'full');
      
      // Build reply message
      const replyEmail = this.buildReplyMessage(originalMessage, validatedParams);
      
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: replyEmail,
          threadId: originalMessage.threadId,
        },
      });

      return response.data.id!;
    } catch (error) {
      throw new Error(`Failed to reply to email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Forward email
   */
  async forwardEmail(params: ForwardParams): Promise<string> {
    const validatedParams = ForwardParamsSchema.parse(params);
    const gmail = this.authManager.getGmailClient();

    try {
      // Get original message
      const originalMessage = await this.getEmail(validatedParams.messageId, 'full');
      
      // Build forward message
      const forwardEmail = this.buildForwardMessage(originalMessage, validatedParams);
      
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: forwardEmail,
        },
      });

      return response.data.id!;
    } catch (error) {
      throw new Error(`Failed to forward email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Archive emails
   */
  async archiveEmails(messageIds: string[]): Promise<void> {
    const validatedIds = messageIds.map(id => MessageIdSchema.parse(id));
    const gmail = this.authManager.getGmailClient();

    try {
      await Promise.all(validatedIds.map(id =>
        gmail.users.messages.modify({
          userId: 'me',
          id,
          requestBody: {
            removeLabelIds: ['INBOX'],
          },
        })
      ));
    } catch (error) {
      throw new Error(`Failed to archive emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete emails (move to trash)
   */
  async deleteEmails(messageIds: string[], permanent: boolean = false): Promise<void> {
    const validatedIds = messageIds.map(id => MessageIdSchema.parse(id));
    const gmail = this.authManager.getGmailClient();

    try {
      if (permanent) {
        // Permanent deletion (requires admin privileges)
        await Promise.all(validatedIds.map(id =>
          gmail.users.messages.delete({
            userId: 'me',
            id,
          })
        ));
      } else {
        // Move to trash
        await Promise.all(validatedIds.map(id =>
          gmail.users.messages.trash({
            userId: 'me',
            id,
          })
        ));
      }
    } catch (error) {
      throw new Error(`Failed to delete emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mark emails as read/unread
   */
  async markAsRead(messageIds: string[], read: boolean = true): Promise<void> {
    const validatedIds = messageIds.map(id => MessageIdSchema.parse(id));
    const gmail = this.authManager.getGmailClient();

    try {
      const labelChanges = read
        ? { removeLabelIds: ['UNREAD'] }
        : { addLabelIds: ['UNREAD'] };

      await Promise.all(validatedIds.map(id =>
        gmail.users.messages.modify({
          userId: 'me',
          id,
          requestBody: labelChanges,
        })
      ));
    } catch (error) {
      throw new Error(`Failed to mark emails as ${read ? 'read' : 'unread'}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Star/unstar emails
   */
  async starEmails(messageIds: string[], starred: boolean = true): Promise<void> {
    const validatedIds = messageIds.map(id => MessageIdSchema.parse(id));
    const gmail = this.authManager.getGmailClient();

    try {
      const labelChanges = starred
        ? { addLabelIds: ['STARRED'] }
        : { removeLabelIds: ['STARRED'] };

      await Promise.all(validatedIds.map(id =>
        gmail.users.messages.modify({
          userId: 'me',
          id,
          requestBody: labelChanges,
        })
      ));
    } catch (error) {
      throw new Error(`Failed to ${starred ? 'star' : 'unstar'} emails: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Apply or remove labels
   */
  async applyLabels(messageIds: string[], labelIds: string[], action: 'add' | 'remove' = 'add'): Promise<void> {
    const validatedIds = messageIds.map(id => MessageIdSchema.parse(id));
    const validatedLabelIds = labelIds.map(id => LabelIdSchema.parse(id));
    const gmail = this.authManager.getGmailClient();

    try {
      const labelChanges = action === 'add'
        ? { addLabelIds: validatedLabelIds }
        : { removeLabelIds: validatedLabelIds };

      await Promise.all(validatedIds.map(id =>
        gmail.users.messages.modify({
          userId: 'me',
          id,
          requestBody: labelChanges,
        })
      ));
    } catch (error) {
      throw new Error(`Failed to ${action} labels: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create new label
   */
  async createLabel(params: CreateLabelParams): Promise<string> {
    const validatedParams = CreateLabelParamsSchema.parse(params);
    const gmail = this.authManager.getGmailClient();

    try {
      const requestBody: any = {
        name: validatedParams.name,
        messageListVisibility: validatedParams.messageListVisibility,
        labelListVisibility: validatedParams.labelListVisibility,
      };

      if (validatedParams.color) {
        requestBody.color = validatedParams.color;
      }

      const response = await gmail.users.labels.create({
        userId: 'me',
        requestBody,
      });

      return response.data.id!;
    } catch (error) {
      throw new Error(`Failed to create label: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all labels
   */
  async getLabels(includeSystem: boolean = true): Promise<gmail_v1.Schema$Label[]> {
    const gmail = this.authManager.getGmailClient();

    try {
      const response = await gmail.users.labels.list({
        userId: 'me',
      });

      let labels = response.data.labels || [];
      
      if (!includeSystem) {
        // Filter out system labels
        labels = labels.filter(label => label.type === 'user');
      }

      return labels;
    } catch (error) {
      throw new Error(`Failed to get labels: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create draft
   */
  async createDraft(params: SendEmailParams): Promise<string> {
    const validatedParams = SendEmailParamsSchema.parse(params);
    const gmail = this.authManager.getGmailClient();

    try {
      const email = this.buildEmailMessage(validatedParams);
      
      const response = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: email,
          },
        },
      });

      return response.data.id!;
    } catch (error) {
      throw new Error(`Failed to create draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract attachments from email
   */
  async extractAttachments(messageId: string): Promise<Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    data: string; // base64
  }>> {
    const validatedId = MessageIdSchema.parse(messageId);
    const gmail = this.authManager.getGmailClient();

    try {
      const message = await gmail.users.messages.get({
        userId: 'me',
        id: validatedId,
      });

      const attachments: Array<{
        id: string;
        filename: string;
        mimeType: string;
        size: number;
        data: string;
      }> = [];

      // Process message parts for attachments
      if (message.data.payload?.parts) {
        for (const part of message.data.payload.parts) {
          if (part.body?.attachmentId && part.filename) {
            const attachment = await gmail.users.messages.attachments.get({
              userId: 'me',
              messageId: validatedId,
              id: part.body.attachmentId,
            });

            attachments.push({
              id: part.body.attachmentId,
              filename: part.filename,
              mimeType: part.mimeType || 'application/octet-stream',
              size: part.body.size || 0,
              data: attachment.data.data || '',
            });
          }
        }
      }

      return attachments;
    } catch (error) {
      throw new Error(`Failed to extract attachments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private helper methods

  private async batchGetMessages(messageIds: string[], format: string): Promise<gmail_v1.Schema$Message[]> {
    const gmail = this.authManager.getGmailClient();
    
    // Gmail API doesn't support true batch requests for messages.get,
    // so we make parallel requests
    const promises = messageIds.map(id =>
      gmail.users.messages.get({
        userId: 'me',
        id,
        format: format as any,
      })
    );

    const responses = await Promise.all(promises);
    return responses.map(response => response.data);
  }

  private parseEmailSummary(message: gmail_v1.Schema$Message): EmailSummary {
    const headers = message.payload?.headers || [];
    const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    return {
      id: message.id!,
      threadId: message.threadId!,
      snippet: message.snippet || '',
      from: getHeader('from'),
      to: [getHeader('to')],
      subject: getHeader('subject'),
      date: getHeader('date'),
      labels: message.labelIds || [],
      isRead: !message.labelIds?.includes('UNREAD'),
      isStarred: message.labelIds?.includes('STARRED') || false,
      hasAttachments: this.hasAttachments(message),
    };
  }

  private parseEmailContent(message: gmail_v1.Schema$Message): EmailContent {
    const summary = this.parseEmailSummary(message);
    const { body, bodyHtml } = this.extractBody(message.payload);
    const attachments = this.extractAttachmentInfo(message.payload);

    return {
      ...summary,
      body,
      bodyHtml: bodyHtml || undefined,
      attachments,
    };
  }

  private parseThreadSummary(thread: gmail_v1.Schema$Thread): ThreadSummary {
    const messages = thread.messages || [];
    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];

    const participants = new Set<string>();
    messages.forEach(msg => {
      const headers = msg.payload?.headers || [];
      const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value;
      const to = headers.find(h => h.name?.toLowerCase() === 'to')?.value;
      if (from) participants.add(from);
      if (to) participants.add(to);
    });

    const firstHeaders = firstMessage?.payload?.headers || [];
    const lastHeaders = lastMessage?.payload?.headers || [];

    return {
      id: thread.id!,
      snippet: thread.snippet || '',
      historyId: thread.historyId!,
      messageCount: messages.length,
      messages: messages.map(this.parseEmailSummary.bind(this)),
      participants: Array.from(participants),
      subject: firstHeaders.find(h => h.name?.toLowerCase() === 'subject')?.value || '',
      lastMessageDate: lastHeaders.find(h => h.name?.toLowerCase() === 'date')?.value || '',
      labels: Array.from(new Set(messages.flatMap(msg => msg.labelIds || []))),
    };
  }

  private hasAttachments(message: gmail_v1.Schema$Message): boolean {
    const checkParts = (parts: gmail_v1.Schema$MessagePart[]): boolean => {
      return parts.some(part => {
        if (part.body?.attachmentId) return true;
        if (part.parts) return checkParts(part.parts);
        return false;
      });
    };

    return message.payload?.parts ? checkParts(message.payload.parts) : false;
  }

  private extractBody(payload: gmail_v1.Schema$MessagePart | undefined): { body: string; bodyHtml?: string | undefined } {
    if (!payload) return { body: '' };

    // Simple text body
    if (payload.mimeType === 'text/plain' && payload.body?.data) {
      return { body: Buffer.from(payload.body.data, 'base64').toString() };
    }

    // HTML body
    if (payload.mimeType === 'text/html' && payload.body?.data) {
      const bodyHtml = Buffer.from(payload.body.data, 'base64').toString();
      return { body: this.stripHtml(bodyHtml), bodyHtml };
    }

    // Multipart body
    if (payload.parts) {
      let textBody = '';
      let htmlBody = '';

      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          textBody = Buffer.from(part.body.data, 'base64').toString();
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          htmlBody = Buffer.from(part.body.data, 'base64').toString();
        }
      }

      return {
        body: textBody || this.stripHtml(htmlBody),
        bodyHtml: htmlBody ? htmlBody : undefined,
      };
    }

    return { body: '' };
  }

  private extractAttachmentInfo(payload: gmail_v1.Schema$MessagePart | undefined): Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
  }> {
    const attachments: Array<{
      id: string;
      filename: string;
      mimeType: string;
      size: number;
    }> = [];

    const processParts = (parts: gmail_v1.Schema$MessagePart[]) => {
      parts.forEach(part => {
        if (part.body?.attachmentId && part.filename) {
          attachments.push({
            id: part.body.attachmentId,
            filename: part.filename,
            mimeType: part.mimeType || 'application/octet-stream',
            size: part.body.size || 0,
          });
        }
        if (part.parts) {
          processParts(part.parts);
        }
      });
    };

    if (payload?.parts) {
      processParts(payload.parts);
    }

    return attachments;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  private buildEmailMessage(params: SendEmailParams): string {
    const { to, cc, bcc, subject, body, isHtml, attachments } = params;

    const boundary = 'boundary_' + Math.random().toString(36).substring(2);
    let email = '';

    // Headers
    email += `To: ${to.join(', ')}\r\n`;
    if (cc && cc.length > 0) {
      email += `Cc: ${cc.join(', ')}\r\n`;
    }
    if (bcc && bcc.length > 0) {
      email += `Bcc: ${bcc.join(', ')}\r\n`;
    }
    email += `Subject: ${subject}\r\n`;
    email += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

    // Body
    email += `--${boundary}\r\n`;
    email += `Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=utf-8\r\n\r\n`;
    email += `${body}\r\n\r\n`;

    // Attachments
    if (attachments && attachments.length > 0) {
      attachments.forEach(attachment => {
        email += `--${boundary}\r\n`;
        email += `Content-Type: ${attachment.contentType}\r\n`;
        email += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
        email += `Content-Transfer-Encoding: base64\r\n\r\n`;
        email += `${attachment.content}\r\n\r\n`;
      });
    }

    email += `--${boundary}--`;

    return Buffer.from(email).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private buildReplyMessage(originalMessage: EmailContent, params: ReplyParams): string {
    const originalSubject = originalMessage.subject.startsWith('Re:') 
      ? originalMessage.subject 
      : `Re: ${originalMessage.subject}`;

    // Determine recipients
    const replyTo = originalMessage.from;
    const recipients = params.replyAll 
      ? [replyTo, ...originalMessage.to.filter(email => email !== replyTo)]
      : [replyTo];

    const replyBody = `${params.body}\r\n\r\n--- Original Message ---\r\nFrom: ${originalMessage.from}\r\nDate: ${originalMessage.date}\r\nSubject: ${originalMessage.subject}\r\n\r\n${originalMessage.body}`;

    return this.buildEmailMessage({
      to: recipients,
      subject: originalSubject,
      body: replyBody,
      isHtml: params.isHtml,
    });
  }

  private buildForwardMessage(originalMessage: EmailContent, params: ForwardParams): string {
    const forwardSubject = originalMessage.subject.startsWith('Fwd:') 
      ? originalMessage.subject 
      : `Fwd: ${originalMessage.subject}`;

    let forwardBody = '';
    if (params.additionalMessage) {
      forwardBody += `${params.additionalMessage}\r\n\r\n`;
    }
    
    forwardBody += `--- Forwarded Message ---\r\nFrom: ${originalMessage.from}\r\nDate: ${originalMessage.date}\r\nSubject: ${originalMessage.subject}\r\n\r\n${originalMessage.body}`;

    return this.buildEmailMessage({
      to: params.to,
      subject: forwardSubject,
      body: forwardBody,
      isHtml: false,
    });
  }
}