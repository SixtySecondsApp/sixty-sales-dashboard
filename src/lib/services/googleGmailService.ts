import { google, gmail_v1 } from 'googleapis';
import { googleOAuthService } from './googleOAuthService';
import { supabase } from '../supabase/clientV2';

interface EmailMessage {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  labels?: string[];
  threadId?: string; // For replying to existing threads
  variables?: Record<string, string>; // For template variable replacement
}

interface EmailFilter {
  query?: string;
  labelIds?: string[];
  maxResults?: number;
  pageToken?: string;
  includeSpamTrash?: boolean;
}

class GoogleGmailService {
  /**
   * Send an email via Gmail
   */
  async sendEmail(userId: string, message: EmailMessage): Promise<string> {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const integration = await googleOAuthService.getTokens(userId);
    
    if (!integration) {
      throw new Error('No Google integration found');
    }

    const gmail = google.gmail({ version: 'v1', auth: authClient });

    try {
      // Build the email
      const email = this.buildEmail(message);
      
      // Send the email
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: email,
          threadId: message.threadId
        }
      });

      // Apply labels if specified
      if (message.labels && message.labels.length > 0) {
        await this.addLabelsToMessage(gmail, response.data.id!, message.labels);
      }

      // Log the activity
      await googleOAuthService.logActivity(
        integration.id,
        'gmail',
        'send_email',
        'success',
        { to: message.to, subject: message.subject },
        { messageId: response.data.id }
      );

      return response.data.id!;
    } catch (error) {
      console.error('Error sending email:', error);
      
      await googleOAuthService.logActivity(
        integration.id,
        'gmail',
        'send_email',
        'error',
        { to: message.to, subject: message.subject },
        null,
        error.message
      );

      throw new Error('Failed to send email');
    }
  }

  /**
   * Build RFC 2822 formatted email
   */
  private buildEmail(message: EmailMessage): string {
    const boundary = `boundary_${Date.now()}`;
    const headers: string[] = [];

    // Replace variables in subject and body
    const subject = this.replaceVariables(message.subject, message.variables);
    const body = this.replaceVariables(message.body, message.variables);

    // Build headers
    headers.push(`To: ${message.to.join(', ')}`);
    if (message.cc && message.cc.length > 0) {
      headers.push(`Cc: ${message.cc.join(', ')}`);
    }
    if (message.bcc && message.bcc.length > 0) {
      headers.push(`Bcc: ${message.bcc.join(', ')}`);
    }
    headers.push(`Subject: ${subject}`);
    headers.push('MIME-Version: 1.0');

    if (message.attachments && message.attachments.length > 0) {
      // Multipart message with attachments
      headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      headers.push('');
      headers.push(`--${boundary}`);
      
      // Body part
      headers.push(`Content-Type: ${message.isHtml ? 'text/html' : 'text/plain'}; charset="UTF-8"`);
      headers.push('');
      headers.push(body);

      // Attachments
      for (const attachment of message.attachments) {
        headers.push(`--${boundary}`);
        headers.push(`Content-Type: ${attachment.contentType || 'application/octet-stream'}`);
        headers.push('Content-Transfer-Encoding: base64');
        headers.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
        headers.push('');
        
        const content = typeof attachment.content === 'string' 
          ? attachment.content 
          : attachment.content.toString('base64');
        headers.push(content);
      }

      headers.push(`--${boundary}--`);
    } else {
      // Simple message without attachments
      headers.push(`Content-Type: ${message.isHtml ? 'text/html' : 'text/plain'}; charset="UTF-8"`);
      headers.push('');
      headers.push(body);
    }

    const email = headers.join('\r\n');
    return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  }

  /**
   * Get emails from Gmail
   */
  async getEmails(userId: string, filter: EmailFilter = {}) {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    try {
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: filter.query,
        labelIds: filter.labelIds,
        maxResults: filter.maxResults || 10,
        pageToken: filter.pageToken,
        includeSpamTrash: filter.includeSpamTrash
      });

      const messages = response.data.messages || [];
      
      // Fetch full message details
      const fullMessages = await Promise.all(
        messages.map(msg => this.getMessage(gmail, msg.id!))
      );

      return {
        messages: fullMessages,
        nextPageToken: response.data.nextPageToken
      };
    } catch (error) {
      console.error('Error fetching emails:', error);
      throw new Error('Failed to fetch emails');
    }
  }

  /**
   * Get a single email message
   */
  private async getMessage(gmail: gmail_v1.Gmail, messageId: string) {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId
    });

    const message = response.data;
    const headers = message.payload?.headers || [];
    
    return {
      id: message.id,
      threadId: message.threadId,
      labelIds: message.labelIds,
      snippet: message.snippet,
      subject: headers.find(h => h.name === 'Subject')?.value,
      from: headers.find(h => h.name === 'From')?.value,
      to: headers.find(h => h.name === 'To')?.value,
      date: headers.find(h => h.name === 'Date')?.value,
      body: this.extractBody(message.payload)
    };
  }

  /**
   * Extract body from email payload
   */
  private extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
    if (!payload) return '';

    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
          if (part.body?.data) {
            return Buffer.from(part.body.data, 'base64').toString('utf-8');
          }
        }
      }
    }

    return '';
  }

  /**
   * Create a draft email
   */
  async createDraft(userId: string, message: EmailMessage): Promise<string> {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const integration = await googleOAuthService.getTokens(userId);
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    try {
      const email = this.buildEmail(message);
      
      const response = await gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: email,
            threadId: message.threadId
          }
        }
      });

      await googleOAuthService.logActivity(
        integration!.id,
        'gmail',
        'create_draft',
        'success',
        { subject: message.subject },
        { draftId: response.data.id }
      );

      return response.data.id!;
    } catch (error) {
      console.error('Error creating draft:', error);
      throw new Error('Failed to create draft');
    }
  }

  /**
   * Get Gmail labels
   */
  async getLabels(userId: string) {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const integration = await googleOAuthService.getTokens(userId);
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    try {
      const response = await gmail.users.labels.list({
        userId: 'me'
      });

      const labels = response.data.labels || [];

      // Cache labels in database
      for (const label of labels) {
        await supabase
          .from('google_email_labels')
          .upsert({
            integration_id: integration!.id,
            label_id: label.id,
            name: label.name,
            type: label.type,
            message_list_visibility: label.messageListVisibility,
            label_list_visibility: label.labelListVisibility,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'integration_id,label_id'
          });
      }

      return labels;
    } catch (error) {
      console.error('Error fetching labels:', error);
      throw new Error('Failed to fetch labels');
    }
  }

  /**
   * Create a new label
   */
  async createLabel(userId: string, name: string) {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    try {
      const response = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error creating label:', error);
      throw new Error('Failed to create label');
    }
  }

  /**
   * Add labels to a message
   */
  private async addLabelsToMessage(
    gmail: gmail_v1.Gmail,
    messageId: string,
    labelIds: string[]
  ) {
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        addLabelIds: labelIds
      }
    });
  }

  /**
   * Reply to an email thread
   */
  async replyToThread(
    userId: string,
    threadId: string,
    message: Omit<EmailMessage, 'threadId'>
  ): Promise<string> {
    return this.sendEmail(userId, { ...message, threadId });
  }

  /**
   * Forward an email
   */
  async forwardEmail(
    userId: string,
    messageId: string,
    to: string[],
    additionalMessage?: string
  ) {
    const authClient = await googleOAuthService.getAuthenticatedClient(userId);
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    try {
      // Get the original message
      const original = await gmail.users.messages.get({
        userId: 'me',
        id: messageId
      });

      const headers = original.data.payload?.headers || [];
      const originalSubject = headers.find(h => h.name === 'Subject')?.value || '';
      const originalFrom = headers.find(h => h.name === 'From')?.value || '';
      const originalDate = headers.find(h => h.name === 'Date')?.value || '';
      const originalBody = this.extractBody(original.data.payload);

      // Build forwarded message
      let forwardBody = '';
      if (additionalMessage) {
        forwardBody += `${additionalMessage}\n\n`;
      }
      forwardBody += `---------- Forwarded message ---------\n`;
      forwardBody += `From: ${originalFrom}\n`;
      forwardBody += `Date: ${originalDate}\n`;
      forwardBody += `Subject: ${originalSubject}\n\n`;
      forwardBody += originalBody;

      return this.sendEmail(userId, {
        to,
        subject: `Fwd: ${originalSubject}`,
        body: forwardBody,
        threadId: original.data.threadId
      });
    } catch (error) {
      console.error('Error forwarding email:', error);
      throw new Error('Failed to forward email');
    }
  }

  /**
   * Helper: Replace variables in text
   */
  private replaceVariables(text: string, variables?: Record<string, string>): string {
    if (!variables) return text;

    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }
}

export const googleGmailService = new GoogleGmailService();