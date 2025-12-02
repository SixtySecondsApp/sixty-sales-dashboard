/**
 * Waitlist Service
 * Handles all operations for the meetings product waitlist system
 */

import { supabase } from '@/lib/supabase/clientV2';
import type {
  WaitlistEntry,
  WaitlistSignupData,
  WaitlistPosition,
  WaitlistStats,
  ToolAnalytics,
  WaitlistFilters
} from '../types/waitlist';

/**
 * PUBLIC API - No authentication required
 */

/**
 * Sign up for the waitlist
 * Public API - no authentication required
 */
export async function signupForWaitlist(
  data: WaitlistSignupData
): Promise<WaitlistEntry> {
  // Validate referral code if provided
  if (data.referred_by_code) {
    const isValid = await validateReferralCode(data.referred_by_code);
    if (!isValid) {
      throw new Error('Invalid referral code. Please check the link or sign up without a referral.');
    }
  }

  // Clean up empty referral code
  const cleanData = {
    ...data,
    referred_by_code: data.referred_by_code || null
  };

  const { data: entry, error } = await supabase
    .from('meetings_waitlist')
    .insert([cleanData])
    .select()
    .single();

  if (error) {
    if (error.code === '23505') { // Unique violation
      throw new Error('This email is already on the waitlist');
    }
    if (error.code === '23503') { // Foreign key violation
      throw new Error('Invalid referral code. Please check the link or sign up without a referral.');
    }
    console.error('Error signing up for waitlist:', error);
    throw new Error('Failed to join waitlist. Please try again.');
  }

  return entry;
}

/**
 * Get waitlist position by email
 * Public API - no authentication required
 */
export async function getWaitlistPosition(email: string): Promise<WaitlistPosition | null> {
  const { data, error } = await supabase
    .from('meetings_waitlist')
    .select('signup_position, effective_position, referral_count, referral_code, email, full_name')
    .eq('email', email)
    .single();

  if (error) {
    if (error.code === 'PGRST116') { // Not found
      return null;
    }
    console.error('Error getting waitlist position:', error);
    throw new Error('Failed to get waitlist position');
  }

  return data;
}

/**
 * Validate if a referral code exists
 * Public API - no authentication required
 */
export async function validateReferralCode(code: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('meetings_waitlist')
    .select('id')
    .eq('referral_code', code)
    .single();

  if (error) {
    return false;
  }

  return !!data;
}

/**
 * ADMIN API - Requires platform admin authentication
 */

/**
 * Get all waitlist entries with optional filters
 * Admin only
 */
export async function getWaitlistEntries(
  filters?: WaitlistFilters
): Promise<WaitlistEntry[]> {
  let query = supabase
    .from('meetings_waitlist')
    .select('*')
    .order('effective_position', { ascending: true });

  // Apply filters
  if (filters) {
    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters.dialer_tool) {
      query = query.eq('dialer_tool', filters.dialer_tool);
    }

    if (filters.meeting_recorder_tool) {
      query = query.eq('meeting_recorder_tool', filters.meeting_recorder_tool);
    }

    if (filters.crm_tool) {
      query = query.eq('crm_tool', filters.crm_tool);
    }

    if (filters.date_from) {
      query = query.gte('created_at', filters.date_from);
    }

    if (filters.date_to) {
      query = query.lte('created_at', filters.date_to);
    }

    if (filters.search) {
      query = query.or(
        `email.ilike.%${filters.search}%,full_name.ilike.%${filters.search}%,company_name.ilike.%${filters.search}%`
      );
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error getting waitlist entries:', error);
    throw new Error('Failed to get waitlist entries');
  }

  return data || [];
}

/**
 * Get waitlist statistics
 * Admin only
 */
export async function getWaitlistStats(): Promise<WaitlistStats> {
  const { data: allEntries, error: allError } = await supabase
    .from('meetings_waitlist')
    .select('status, referral_count, created_at');

  if (allError) {
    console.error('Error getting waitlist stats:', allError);
    throw new Error('Failed to get waitlist statistics');
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const stats = allEntries.reduce(
    (acc, entry) => {
      // Count by status
      acc.total_signups++;
      if (entry.status === 'pending') acc.pending_count++;
      if (entry.status === 'released') acc.released_count++;
      if (entry.status === 'declined') acc.declined_count++;
      if (entry.status === 'converted') acc.converted_count++;

      // Sum referrals
      acc.total_referrals += entry.referral_count;

      // Count recent signups
      const createdAt = new Date(entry.created_at);
      if (createdAt >= sevenDaysAgo) acc.signups_last_7_days++;
      if (createdAt >= thirtyDaysAgo) acc.signups_last_30_days++;

      return acc;
    },
    {
      total_signups: 0,
      pending_count: 0,
      released_count: 0,
      declined_count: 0,
      converted_count: 0,
      total_referrals: 0,
      signups_last_7_days: 0,
      signups_last_30_days: 0
    }
  );

  return {
    total_signups: stats.total_signups,
    pending_count: stats.pending_count,
    released_count: stats.released_count,
    declined_count: stats.declined_count,
    converted_count: stats.converted_count,
    avg_referrals: stats.total_signups > 0
      ? Math.round((stats.total_referrals / stats.total_signups) * 10) / 10
      : 0,
    signups_last_7_days: stats.signups_last_7_days,
    signups_last_30_days: stats.signups_last_30_days
  };
}

/**
 * Get tool usage analytics
 * Admin only
 */
export async function getToolAnalytics(): Promise<ToolAnalytics> {
  const { data, error } = await supabase
    .from('meetings_waitlist')
    .select('dialer_tool, meeting_recorder_tool, crm_tool');

  if (error) {
    console.error('Error getting tool analytics:', error);
    throw new Error('Failed to get tool analytics');
  }

  const analytics = data.reduce(
    (acc, entry) => {
      if (entry.dialer_tool) {
        acc.dialers[entry.dialer_tool] = (acc.dialers[entry.dialer_tool] || 0) + 1;
      }
      if (entry.meeting_recorder_tool) {
        acc.meeting_recorders[entry.meeting_recorder_tool] =
          (acc.meeting_recorders[entry.meeting_recorder_tool] || 0) + 1;
      }
      if (entry.crm_tool) {
        acc.crms[entry.crm_tool] = (acc.crms[entry.crm_tool] || 0) + 1;
      }
      return acc;
    },
    {
      dialers: {} as Record<string, number>,
      meeting_recorders: {} as Record<string, number>,
      crms: {} as Record<string, number>
    }
  );

  return analytics;
}

/**
 * Release a user from the waitlist
 * Admin only
 */
export async function releaseWaitlistUser(
  id: string,
  notes?: string
): Promise<void> {
  const { error } = await supabase
    .from('meetings_waitlist')
    .update({
      status: 'released',
      released_at: new Date().toISOString(),
      admin_notes: notes || null
    })
    .eq('id', id);

  if (error) {
    console.error('Error releasing waitlist user:', error);
    throw new Error('Failed to release user from waitlist');
  }
}

/**
 * Update a waitlist entry
 * Admin only
 */
export async function updateWaitlistEntry(
  id: string,
  updates: Partial<WaitlistEntry>
): Promise<void> {
  const { error } = await supabase
    .from('meetings_waitlist')
    .update(updates)
    .eq('id', id);

  if (error) {
    console.error('Error updating waitlist entry:', error);
    throw new Error('Failed to update waitlist entry');
  }
}

/**
 * Export waitlist data as CSV
 * Admin only
 */
export async function exportWaitlistCSV(filters?: WaitlistFilters): Promise<Blob> {
  const entries = await getWaitlistEntries(filters);

  // Create CSV header
  const headers = [
    'Position',
    'Email',
    'Name',
    'Company',
    'Dialer',
    'Meeting Recorder',
    'CRM',
    'Referrals',
    'Status',
    'Referral Code',
    'Referred By',
    'Created At'
  ];

  // Create CSV rows
  const rows = entries.map(entry => [
    entry.effective_position || '',
    entry.email,
    entry.full_name,
    entry.company_name,
    entry.dialer_tool || '',
    entry.meeting_recorder_tool || '',
    entry.crm_tool || '',
    entry.referral_count,
    entry.status,
    entry.referral_code,
    entry.referred_by_code || '',
    new Date(entry.created_at).toLocaleDateString()
  ]);

  // Combine header and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // Create blob
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}

/**
 * Delete a waitlist entry (use with caution)
 * Admin only
 */
export async function deleteWaitlistEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('meetings_waitlist')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting waitlist entry:', error);
    throw new Error('Failed to delete waitlist entry');
  }
}
