import { supabase } from '@/lib/supabase/clientV2';

export interface SendEmailRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  isHtml?: boolean;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string[];
  subject: string;
  snippet: string;
  body?: string;
  date: string;
  labels: string[];
}

export interface ContactEmail {
  id: string;
  contact_id: string;
  gmail_message_id: string;
  subject: string;
  from_email: string;
  from_name?: string;
  to_emails: string[];
  body_plain?: string;
  sent_at: string;
  direction: 'inbound' | 'outbound';
  is_read: boolean;
  labels: string[];
}

class GoogleEmailService {
  /**
   * Send an email using Gmail
   */
  async sendEmail(request: SendEmailRequest): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('google-gmail', {
        body: request,
        headers: {
          'Content-Type': 'application/json',
        },
      }, {
        method: 'POST',
      });

      if (error) {
        console.error('Failed to send email:', error);
        return { success: false, error: error.message };
      }

      return { success: true, messageId: data?.messageId };
    } catch (err) {
      console.error('Error sending email:', err);
      return { success: false, error: 'Failed to send email' };
    }
  }

  /**
   * Send email to a contact
   */
  async sendEmailToContact(contactEmail: string, subject: string, body: string, isHtml: boolean = true): Promise<{ success: boolean; error?: string }> {
    return this.sendEmail({
      to: [contactEmail],
      subject,
      body,
      isHtml,
    });
  }

  /**
   * List emails from Gmail
   */
  async listEmails(query?: string, maxResults: number = 20): Promise<EmailMessage[]> {
    try {
      const { data, error } = await supabase.functions.invoke('google-gmail', {
        body: { query, maxResults },
        headers: {
          'Content-Type': 'application/json',
        },
      }, {
        method: 'POST',
      });

      if (error) {
        console.error('Failed to list emails:', error);
        return [];
      }

      return data?.messages || [];
    } catch (err) {
      console.error('Error listing emails:', err);
      return [];
    }
  }

  /**
   * Sync emails from Gmail to contacts
   */
  async syncEmailsToContacts(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('google-gmail', {
        body: {},
        headers: {
          'Content-Type': 'application/json',
        },
      }, {
        method: 'POST',
      });

      if (error) {
        console.error('Failed to sync emails:', error);
        return { success: false, syncedCount: 0, error: error.message };
      }

      return { 
        success: true, 
        syncedCount: data?.syncedCount || 0,
      };
    } catch (err) {
      console.error('Error syncing emails:', err);
      return { success: false, syncedCount: 0, error: 'Failed to sync emails' };
    }
  }

  /**
   * Get emails for a specific contact
   */
  async getContactEmails(contactId: string, limit: number = 50): Promise<ContactEmail[]> {
    try {
      const { data, error } = await supabase
        .from('contact_emails')
        .select('*')
        .eq('contact_id', contactId)
        .order('sent_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Failed to get contact emails:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Error getting contact emails:', err);
      return [];
    }
  }

  /**
   * Get email sync status
   */
  async getSyncStatus(): Promise<{ 
    lastSync: string | null; 
    totalSynced: number; 
    syncEnabled: boolean;
    nextSync?: string;
  }> {
    try {
      // Get user's Google integration
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { lastSync: null, totalSynced: 0, syncEnabled: false };
      }

      // Get integration
      const { data: integration } = await supabase
        .from('google_integrations')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!integration) {
        return { lastSync: null, totalSynced: 0, syncEnabled: false };
      }

      // Get sync status
      const { data: syncStatus } = await supabase
        .from('email_sync_status')
        .select('*')
        .eq('integration_id', integration.id)
        .single();

      if (!syncStatus) {
        return { lastSync: null, totalSynced: 0, syncEnabled: false };
      }

      // Calculate next sync time
      let nextSync;
      if (syncStatus.last_sync_at && syncStatus.sync_enabled) {
        const lastSync = new Date(syncStatus.last_sync_at);
        const intervalMs = (syncStatus.sync_interval_minutes || 15) * 60 * 1000;
        nextSync = new Date(lastSync.getTime() + intervalMs).toISOString();
      }

      return {
        lastSync: syncStatus.last_sync_at,
        totalSynced: syncStatus.total_emails_synced || 0,
        syncEnabled: syncStatus.sync_enabled || false,
        nextSync,
      };
    } catch (err) {
      console.error('Error getting sync status:', err);
      return { lastSync: null, totalSynced: 0, syncEnabled: false };
    }
  }

  /**
   * Enable or disable email sync
   */
  async toggleEmailSync(enabled: boolean): Promise<{ success: boolean; error?: string }> {
    try {
      // Get user's Google integration
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Get integration
      const { data: integration } = await supabase
        .from('google_integrations')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (!integration) {
        return { success: false, error: 'Google integration not found' };
      }

      // Update or create sync status
      const { error } = await supabase
        .from('email_sync_status')
        .upsert({
          integration_id: integration.id,
          sync_enabled: enabled,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'integration_id',
        });

      if (error) {
        console.error('Failed to toggle email sync:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('Error toggling email sync:', err);
      return { success: false, error: 'Failed to toggle email sync' };
    }
  }

  /**
   * Mark email as read
   */
  async markEmailAsRead(emailId: string): Promise<{ success: boolean }> {
    try {
      const { error } = await supabase
        .from('contact_emails')
        .update({ is_read: true })
        .eq('id', emailId);

      if (error) {
        console.error('Failed to mark email as read:', error);
        return { success: false };
      }

      return { success: true };
    } catch (err) {
      console.error('Error marking email as read:', err);
      return { success: false };
    }
  }
}

export const googleEmailService = new GoogleEmailService();