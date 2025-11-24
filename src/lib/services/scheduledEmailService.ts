import { supabase } from '@/lib/supabase/clientV2';

export interface ScheduledEmailData {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  scheduledFor: Date;
  replyToMessageId?: string;
  threadId?: string;
  contactId?: string;
  dealId?: string;
  calendarEventId?: string;
}

export interface ScheduledEmail extends ScheduledEmailData {
  id: string;
  userId: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  errorMessage?: string;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Schedule an email to be sent at a later time
 */
export async function scheduleEmail(data: ScheduledEmailData): Promise<ScheduledEmail> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data: scheduledEmail, error } = await supabase
    .from('scheduled_emails')
    .insert({
      user_id: user.id,
      to_email: data.to,
      cc_email: data.cc,
      bcc_email: data.bcc,
      subject: data.subject,
      body: data.body,
      scheduled_for: data.scheduledFor.toISOString(),
      reply_to_message_id: data.replyToMessageId,
      thread_id: data.threadId,
      contact_id: data.contactId,
      deal_id: data.dealId,
      calendar_event_id: data.calendarEventId,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('[Schedule Email] Error scheduling email:', error);
    throw error;
  }

  return mapScheduledEmail(scheduledEmail);
}

/**
 * Get all scheduled emails for the current user
 */
export async function getScheduledEmails(): Promise<ScheduledEmail[]> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('scheduled_emails')
    .select('*')
    .eq('user_id', user.id)
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('[Get Scheduled Emails] Error fetching scheduled emails:', error);
    throw error;
  }

  return data.map(mapScheduledEmail);
}

/**
 * Get scheduled emails by status
 */
export async function getScheduledEmailsByStatus(
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
): Promise<ScheduledEmail[]> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('scheduled_emails')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', status)
    .order('scheduled_for', { ascending: true });

  if (error) {
    console.error('[Get Scheduled Emails By Status] Error:', error);
    throw error;
  }

  return data.map(mapScheduledEmail);
}

/**
 * Cancel a scheduled email
 */
export async function cancelScheduledEmail(id: string): Promise<void> {
  const { error } = await supabase
    .from('scheduled_emails')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (error) {
    console.error('[Cancel Scheduled Email] Error:', error);
    throw error;
  }
}

/**
 * Delete a scheduled email
 */
export async function deleteScheduledEmail(id: string): Promise<void> {
  const { error } = await supabase
    .from('scheduled_emails')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Delete Scheduled Email] Error:', error);
    throw error;
  }
}

/**
 * Reschedule an email to a new time
 */
export async function rescheduleEmail(id: string, newTime: Date): Promise<void> {
  const { error } = await supabase
    .from('scheduled_emails')
    .update({
      scheduled_for: newTime.toISOString(),
      status: 'pending', // Reset status if it was failed/cancelled
    })
    .eq('id', id);

  if (error) {
    console.error('[Reschedule Email] Error:', error);
    throw error;
  }
}

// Helper function to map database record to ScheduledEmail type
function mapScheduledEmail(record: any): ScheduledEmail {
  return {
    id: record.id,
    userId: record.user_id,
    to: record.to_email,
    cc: record.cc_email,
    bcc: record.bcc_email,
    subject: record.subject,
    body: record.body,
    scheduledFor: new Date(record.scheduled_for),
    status: record.status,
    errorMessage: record.error_message,
    sentAt: record.sent_at ? new Date(record.sent_at) : undefined,
    createdAt: new Date(record.created_at),
    updatedAt: new Date(record.updated_at),
    replyToMessageId: record.reply_to_message_id,
    threadId: record.thread_id,
    contactId: record.contact_id,
    dealId: record.deal_id,
    calendarEventId: record.calendar_event_id,
  };
}
