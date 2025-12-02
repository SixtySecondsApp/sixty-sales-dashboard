/**
 * Email Activity Logger Service
 * Automatically logs email activities for CRM contacts
 */

import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

export interface EmailActivityData {
  emailId: string;
  subject: string;
  from: string;
  to: string;
  cc?: string;
  direction: 'inbound' | 'outbound';
  timestamp: Date;
  body?: string;
  threadId?: string;
}

class EmailActivityLogger {
  /**
   * Extract email address from formatted string like "Name <email@example.com>"
   */
  private extractEmail(emailString: string): string {
    const match = emailString.match(/<(.+?)>/);
    return match ? match[1].trim() : emailString.trim();
  }

  /**
   * Extract all email addresses from comma/semicolon separated list
   */
  private extractEmails(emailString: string): string[] {
    if (!emailString) return [];

    return emailString
      .split(/[,;]/)
      .map(email => this.extractEmail(email))
      .filter(email => email && email.includes('@'));
  }

  /**
   * Find contact by email address
   */
  private async findContactByEmail(email: string, userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', userId)
        .eq('email', email)
        .single();

      if (error || !data) {
        return null;
      }

      return data.id;
    } catch (error) {
      logger.error('Error finding contact by email:', error);
      return null;
    }
  }

  /**
   * Create an activity log for an email
   */
  private async createActivityLog(
    contactId: string,
    userId: string,
    activityData: EmailActivityData
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('activities')
        .insert({
          user_id: userId,
          contact_id: contactId,
          activity_type: 'email',
          title: `${activityData.direction === 'outbound' ? 'Sent' : 'Received'}: ${activityData.subject}`,
          description: activityData.body?.substring(0, 500) || '', // Limit to 500 chars
          activity_date: activityData.timestamp.toISOString(),
          metadata: {
            email_id: activityData.emailId,
            thread_id: activityData.threadId,
            from: activityData.from,
            to: activityData.to,
            cc: activityData.cc,
            direction: activityData.direction,
          }
        });

      if (error) {
        logger.error('Error creating activity log:', error);
      } else {
        logger.log(`✅ Activity logged for contact ${contactId}:`, activityData.subject);
      }
    } catch (error) {
      logger.error('Error in createActivityLog:', error);
    }
  }

  /**
   * Log an outbound email activity
   */
  async logOutboundEmail(emailData: EmailActivityData): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        logger.warn('No authenticated user for activity logging');
        return;
      }

      // Extract all recipient emails
      const toEmails = this.extractEmails(emailData.to);
      const ccEmails = this.extractEmails(emailData.cc || '');
      const allRecipients = [...toEmails, ...ccEmails];

      logger.log('📧 Logging outbound email activity for recipients:', allRecipients);

      // Log activity for each recipient that exists as a contact
      for (const recipientEmail of allRecipients) {
        const contactId = await this.findContactByEmail(recipientEmail, user.id);

        if (contactId) {
          await this.createActivityLog(contactId, user.id, {
            ...emailData,
            direction: 'outbound'
          });
        } else {
          logger.log(`ℹ️  No contact found for ${recipientEmail}, skipping activity log`);
        }
      }
    } catch (error) {
      logger.error('Error logging outbound email:', error);
    }
  }

  /**
   * Log an inbound email activity
   */
  async logInboundEmail(emailData: EmailActivityData): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        logger.warn('No authenticated user for activity logging');
        return;
      }

      // Extract sender email
      const senderEmail = this.extractEmail(emailData.from);

      logger.log('📨 Logging inbound email activity from:', senderEmail);

      // Find contact by sender email
      const contactId = await this.findContactByEmail(senderEmail, user.id);

      if (contactId) {
        await this.createActivityLog(contactId, user.id, {
          ...emailData,
          direction: 'inbound'
        });
      } else {
        logger.log(`ℹ️  No contact found for ${senderEmail}, skipping activity log`);
      }
    } catch (error) {
      logger.error('Error logging inbound email:', error);
    }
  }

  /**
   * Log email activity (auto-detects direction based on from field)
   */
  async logEmailActivity(emailData: EmailActivityData): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's email to determine direction
      const userEmail = user.email;
      const fromEmail = this.extractEmail(emailData.from);

      // If the email is from the current user, it's outbound
      if (fromEmail === userEmail) {
        await this.logOutboundEmail(emailData);
      } else {
        await this.logInboundEmail(emailData);
      }
    } catch (error) {
      logger.error('Error in logEmailActivity:', error);
    }
  }

  /**
   * Batch log multiple emails (useful for initial sync)
   */
  async logEmailBatch(emails: EmailActivityData[]): Promise<void> {
    logger.log(`📊 Batch logging ${emails.length} email activities...`);

    for (const email of emails) {
      await this.logEmailActivity(email);
    }

    logger.log('✅ Batch logging complete');
  }
}

// Export singleton instance
export const emailActivityLogger = new EmailActivityLogger();
