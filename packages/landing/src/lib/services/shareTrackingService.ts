/**
 * Share Tracking Service
 * Handles analytics for waitlist referral sharing across platforms
 */

import { supabase } from '@/lib/supabase/clientV2';
import type { SharePlatform } from '@/lib/types/waitlist';

export interface TrackShareParams {
  waitlist_entry_id: string;
  platform: SharePlatform;
}

export interface ShareStats {
  total_shares: number;
  twitter_shares: number;
  linkedin_shares: number;
  email_shares: number;
  copy_shares: number;
  clicks: number;
  conversions: number;
  conversion_rate: number;
}

/**
 * Track a share event when user clicks a share button
 */
export async function trackShare(params: TrackShareParams): Promise<void> {
  try {
    const { error } = await supabase
      .from('waitlist_shares')
      .insert({
        waitlist_entry_id: params.waitlist_entry_id,
        platform: params.platform,
        referral_clicked: false,
        referral_converted: false
      });

    if (error) {
      console.error('Failed to track share:', error);
      throw error;
    }

    // Optional: Send to external analytics
    if (typeof window !== 'undefined' && (window as any).analytics) {
      (window as any).analytics.track('Waitlist Share', {
        platform: params.platform,
        entry_id: params.waitlist_entry_id
      });
    }
  } catch (err) {
    console.error('Share tracking error:', err);
    // Don't throw - failing to track shouldn't break the user experience
  }
}

/**
 * Get share statistics for a waitlist entry
 */
export async function getShareStats(entryId: string): Promise<ShareStats | null> {
  try {
    const { data, error } = await supabase
      .rpc('get_share_stats', { entry_id: entryId });

    if (error) {
      console.error('Failed to get share stats:', error);
      return null;
    }

    return data && data.length > 0 ? data[0] : null;
  } catch (err) {
    console.error('Get share stats error:', err);
    return null;
  }
}

/**
 * Get all shares for an entry (for admin/debugging)
 */
export async function getShareHistory(entryId: string) {
  try {
    const { data, error} = await supabase
      .from('waitlist_shares')
      .select('*')
      .eq('waitlist_entry_id', entryId)
      .order('shared_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Get share history error:', err);
    return [];
  }
}

/**
 * Check if user has already claimed LinkedIn boost
 */
export async function hasClaimedLinkedInBoost(entryId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('meetings_waitlist')
      .select('linkedin_boost_claimed')
      .eq('id', entryId)
      .single();

    if (error) {
      console.error('Failed to check LinkedIn boost:', error);
      return false;
    }

    return data?.linkedin_boost_claimed || false;
  } catch (err) {
    console.error('Check LinkedIn boost error:', err);
    return false;
  }
}

/**
 * Check if user has already claimed Twitter boost
 */
export async function hasClaimedTwitterBoost(entryId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('meetings_waitlist')
      .select('twitter_boost_claimed')
      .eq('id', entryId)
      .single();

    if (error) {
      console.error('Failed to check Twitter boost:', error);
      return false;
    }

    return data?.twitter_boost_claimed || false;
  } catch (err) {
    console.error('Check Twitter boost error:', err);
    return false;
  }
}

/**
 * Track first LinkedIn share and grant 50-point boost
 * The database trigger will automatically recalculate total_points and effective_position
 * Returns the updated entry data so the UI can refresh
 */
export async function trackLinkedInFirstShare(entryId: string): Promise<{
  success: boolean;
  boosted: boolean;
  updatedEntry?: {
    total_points: number;
    effective_position: number;
    linkedin_boost_claimed: boolean;
    referral_count?: number;
  };
}> {
  try {
    console.log('[shareTrackingService] trackLinkedInFirstShare called for entry:', entryId);
    
    // Check if already claimed
    const alreadyClaimed = await hasClaimedLinkedInBoost(entryId);
    console.log('[shareTrackingService] Already claimed LinkedIn boost?', alreadyClaimed);
    
    if (alreadyClaimed) {
      console.log('[shareTrackingService] Boost already claimed, just tracking share');
      // Track the share but don't grant boost
      await trackShare({ waitlist_entry_id: entryId, platform: 'linkedin' });
      return { success: true, boosted: false };
    }

    // Get current entry data for analytics
    const { data: entry, error: fetchError } = await supabase
      .from('meetings_waitlist')
      .select('effective_position, total_points')
      .eq('id', entryId)
      .single();

    if (fetchError || !entry) {
      console.error('Failed to fetch entry:', fetchError);
      return { success: false, boosted: false };
    }

    // Update entry with LinkedIn boost flag and get the updated record back
    // The trigger will automatically:
    // - Add 50 to total_points
    // - Recalculate effective_position
    console.log('[shareTrackingService] Applying LinkedIn boost for entry:', entryId);
    console.log('[shareTrackingService] Current entry state:', {
      total_points: entry.total_points,
      effective_position: entry.effective_position
    });

    const { data: updatedData, error: updateError } = await supabase
      .from('meetings_waitlist')
      .update({
        linkedin_boost_claimed: true,
        linkedin_first_share_at: new Date().toISOString()
      })
      .eq('id', entryId)
      .select('total_points, effective_position, linkedin_boost_claimed, referral_count, linkedin_boost_claimed, twitter_boost_claimed')
      .single();

    if (updateError) {
      console.error('[shareTrackingService] Failed to apply LinkedIn boost:', updateError);
      console.error('[shareTrackingService] Update error details:', {
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint
      });
      return { success: false, boosted: false };
    }

    if (!updatedData) {
      console.error('[shareTrackingService] Update succeeded but no data returned!');
      return { success: false, boosted: false };
    }

    console.log('[shareTrackingService] LinkedIn boost applied successfully:', {
      old_points: entry.total_points,
      new_points: updatedData.total_points,
      old_position: entry.effective_position,
      new_position: updatedData.effective_position,
      linkedin_boost_claimed: updatedData.linkedin_boost_claimed,
      referral_count: updatedData.referral_count
    });

    // Track the share with boost indicator
    await supabase
      .from('waitlist_shares')
      .insert({
        waitlist_entry_id: entryId,
        platform: 'linkedin',
        referral_clicked: false,
        referral_converted: false
      });

    // Optional: Send to external analytics
    if (typeof window !== 'undefined' && (window as any).analytics) {
      (window as any).analytics.track('LinkedIn Boost Claimed', {
        entry_id: entryId,
        old_position: entry.effective_position,
        old_points: entry.total_points,
        new_position: updatedData?.effective_position,
        new_points: updatedData?.total_points,
        boost_points: 50
      });
    }

    return {
      success: true,
      boosted: true,
      updatedEntry: {
        total_points: updatedData.total_points,
        effective_position: updatedData.effective_position,
        linkedin_boost_claimed: updatedData.linkedin_boost_claimed,
        referral_count: updatedData.referral_count
      }
    };
  } catch (err) {
    console.error('[shareTrackingService] LinkedIn first share error:', err);
    console.error('[shareTrackingService] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
    return { success: false, boosted: false };
  }
}

/**
 * Track first Twitter/X share and grant 50-point boost
 * The database trigger will automatically recalculate total_points and effective_position
 * Returns the updated entry data so the UI can refresh
 */
export async function trackTwitterFirstShare(entryId: string): Promise<{
  success: boolean;
  boosted: boolean;
  updatedEntry?: {
    total_points: number;
    effective_position: number;
    twitter_boost_claimed: boolean;
    referral_count?: number;
  };
}> {
  try {
    console.log('[shareTrackingService] trackTwitterFirstShare called for entry:', entryId);
    
    // Check if already claimed
    const alreadyClaimed = await hasClaimedTwitterBoost(entryId);
    console.log('[shareTrackingService] Already claimed Twitter boost?', alreadyClaimed);
    
    if (alreadyClaimed) {
      console.log('[shareTrackingService] Boost already claimed, just tracking share');
      // Track the share but don't grant boost
      await trackShare({ waitlist_entry_id: entryId, platform: 'twitter' });
      return { success: true, boosted: false };
    }

    // Get current entry data for analytics
    const { data: entry, error: fetchError } = await supabase
      .from('meetings_waitlist')
      .select('effective_position, total_points')
      .eq('id', entryId)
      .single();

    if (fetchError || !entry) {
      console.error('Failed to fetch entry:', fetchError);
      return { success: false, boosted: false };
    }

    // Update entry with Twitter boost flag and get the updated record back
    // The trigger will automatically:
    // - Add 50 to total_points
    // - Recalculate effective_position
    console.log('[shareTrackingService] Applying Twitter boost for entry:', entryId);
    console.log('[shareTrackingService] Current entry state:', {
      total_points: entry.total_points,
      effective_position: entry.effective_position
    });

    const { data: updatedData, error: updateError } = await supabase
      .from('meetings_waitlist')
      .update({
        twitter_boost_claimed: true,
        twitter_first_share_at: new Date().toISOString()
      })
      .eq('id', entryId)
      .select('total_points, effective_position, twitter_boost_claimed, referral_count, linkedin_boost_claimed, twitter_boost_claimed')
      .single();

    if (updateError) {
      console.error('[shareTrackingService] Failed to apply Twitter boost:', updateError);
      console.error('[shareTrackingService] Update error details:', {
        code: updateError.code,
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint
      });
      return { success: false, boosted: false };
    }

    if (!updatedData) {
      console.error('[shareTrackingService] Update succeeded but no data returned!');
      return { success: false, boosted: false };
    }

    console.log('[shareTrackingService] Twitter boost applied successfully:', {
      old_points: entry.total_points,
      new_points: updatedData.total_points,
      old_position: entry.effective_position,
      new_position: updatedData.effective_position,
      twitter_boost_claimed: updatedData.twitter_boost_claimed,
      referral_count: updatedData.referral_count
    });

    // Track the share with boost indicator
    await supabase
      .from('waitlist_shares')
      .insert({
        waitlist_entry_id: entryId,
        platform: 'twitter',
        referral_clicked: false,
        referral_converted: false
      });

    // Optional: Send to external analytics
    if (typeof window !== 'undefined' && (window as any).analytics) {
      (window as any).analytics.track('Twitter Boost Claimed', {
        entry_id: entryId,
        old_position: entry.effective_position,
        old_points: entry.total_points,
        new_position: updatedData?.effective_position,
        new_points: updatedData?.total_points,
        boost_points: 50
      });
    }

    return {
      success: true,
      boosted: true,
      updatedEntry: {
        total_points: updatedData.total_points,
        effective_position: updatedData.effective_position,
        twitter_boost_claimed: updatedData.twitter_boost_claimed,
        referral_count: updatedData.referral_count
      }
    };
  } catch (err) {
    console.error('[shareTrackingService] Twitter first share error:', err);
    console.error('[shareTrackingService] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
    return { success: false, boosted: false };
  }
}
