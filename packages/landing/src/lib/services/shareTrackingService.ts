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

export interface TrackShareResult {
  success: boolean;
  points_awarded?: number;
  entry?: {
    total_points: number;
    effective_position: number;
    referral_count: number;
  };
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
 * Track a share event via RPC (awards 5 points per share)
 */
async function trackShareViaRPC(entryId: string, platform: string): Promise<TrackShareResult> {
  try {
    const { data, error } = await supabase.rpc('track_waitlist_link_share', {
      p_entry_id: entryId,
      p_platform: platform
    });

    if (error) {
      console.error('[ShareTracking] RPC error:', error);
      if (error.message.includes('function') || error.message.includes('does not exist')) {
        return { success: false };
      }
      return { success: false };
    }

    if (data && typeof data === 'object' && data.success) {
      console.log(`[ShareTracking] Share tracked via RPC: +${data.points_awarded} points`);
      return {
        success: true,
        points_awarded: data.points_awarded,
        entry: data.entry
      };
    }

    return { success: false };
  } catch (err) {
    console.error('[ShareTracking] RPC exception:', err);
    return { success: false };
  }
}

/**
 * Track a share event when user clicks a share button
 * Awards 5 points per share via RPC function
 */
export async function trackShare(params: TrackShareParams): Promise<TrackShareResult> {
  try {
    // Try RPC first (awards points)
    const rpcResult = await trackShareViaRPC(params.waitlist_entry_id, params.platform);

    if (rpcResult.success) {
      // Optional: Send to external analytics
      if (typeof window !== 'undefined' && (window as any).analytics) {
        (window as any).analytics.track('Waitlist Share', {
          platform: params.platform,
          entry_id: params.waitlist_entry_id,
          points_awarded: rpcResult.points_awarded
        });
      }
      return rpcResult;
    }

    // Fallback to direct insert (no points awarded - RPC not available)
    console.warn('[ShareTracking] RPC not available, falling back to direct insert (no points)');
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
      return { success: false };
    }

    // Optional: Send to external analytics
    if (typeof window !== 'undefined' && (window as any).analytics) {
      (window as any).analytics.track('Waitlist Share', {
        platform: params.platform,
        entry_id: params.waitlist_entry_id
      });
    }

    return { success: true, points_awarded: 0 };
  } catch (err) {
    console.error('Share tracking error:', err);
    return { success: false };
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
 * Check if user has already claimed Email boost
 * Email boost is tracked via waitlist_shares table with platform='email'
 */
export async function hasClaimedEmailBoost(entryId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('waitlist_shares')
      .select('id')
      .eq('waitlist_entry_id', entryId)
      .eq('platform', 'email')
      .limit(1);

    if (error) {
      console.error('Failed to check Email boost:', error);
      return false;
    }

    return (data && data.length > 0) || false;
  } catch (err) {
    console.error('Check Email boost error:', err);
    return false;
  }
}

/**
 * Track first Email share and grant boost
 * Email boost is simpler - just track the share without point modification
 */
export async function trackEmailFirstShare(entryId: string): Promise<{
  success: boolean;
  boosted: boolean;
  updatedEntry?: {
    total_points: number;
    effective_position: number;
    email_boost_claimed: boolean;
  };
}> {
  try {
    console.log('[ShareTracking] Tracking Email share for entry:', entryId);

    // Check if already tracked
    const alreadyClaimed = await hasClaimedEmailBoost(entryId);
    if (alreadyClaimed) {
      return { success: true, boosted: false };
    }

    // Track the share
    const { error: insertError } = await supabase
      .from('waitlist_shares')
      .insert({
        waitlist_entry_id: entryId,
        platform: 'email',
        referral_clicked: false,
        referral_converted: false
      });

    if (insertError) {
      console.error('[ShareTracking] Failed to track email share:', insertError);
      return { success: false, boosted: false };
    }

    // Get current entry data for response
    const { data: entry } = await supabase
      .from('meetings_waitlist')
      .select('total_points, effective_position')
      .eq('id', entryId)
      .single();

    // Analytics
    if (typeof window !== 'undefined' && (window as any).analytics) {
      (window as any).analytics.track('Email Share Tracked', {
        entry_id: entryId
      });
    }

    return {
      success: true,
      boosted: true,
      updatedEntry: {
        total_points: entry?.total_points || 0,
        effective_position: entry?.effective_position || 0,
        email_boost_claimed: true,
      },
    };
  } catch (err) {
    console.error('Email share tracking error:', err);
    return { success: false, boosted: false };
  }
}

/**
 * Claim a waitlist boost using the RPC function (bypasses RLS)
 * This is the preferred method as direct updates are blocked by RLS for anonymous users
 */
async function claimBoostViaRPC(entryId: string, platform: 'twitter' | 'linkedin'): Promise<{
  success: boolean;
  boosted: boolean;
  error?: string;
  entry?: {
    total_points: number;
    effective_position: number;
    twitter_boost_claimed: boolean;
    linkedin_boost_claimed: boolean;
    referral_count: number;
  };
}> {
  try {
    const { data, error } = await supabase.rpc('claim_waitlist_boost', {
      p_entry_id: entryId,
      p_platform: platform
    });

    if (error) {
      console.error(`[ShareTracking] RPC error for ${platform} boost:`, error);
      return { success: false, boosted: false, error: error.message };
    }

    console.log(`[ShareTracking] RPC result for ${platform} boost:`, data);

    // The RPC returns a JSON object
    if (data && typeof data === 'object') {
      return {
        success: data.success === true,
        boosted: data.boosted === true,
        error: data.error,
        entry: data.entry
      };
    }

    return { success: false, boosted: false, error: 'Invalid RPC response' };
  } catch (err) {
    console.error(`[ShareTracking] Exception calling RPC for ${platform}:`, err);
    return { success: false, boosted: false, error: String(err) };
  }
}

/**
 * Fallback: Calculate total points based on boosts and referrals (client-side)
 */
function calculateTotalPoints(
  referralCount: number,
  linkedInBoostClaimed: boolean,
  twitterBoostClaimed: boolean
): number {
  let points = 0;
  // 5 points per referral
  points += (referralCount || 0) * 5;
  // 50 points for LinkedIn boost
  if (linkedInBoostClaimed) points += 50;
  // 50 points for Twitter boost
  if (twitterBoostClaimed) points += 50;
  return points;
}

/**
 * Fallback: Calculate effective position based on signup position and total points
 */
function calculateEffectivePosition(signupPosition: number, totalPoints: number): number {
  // Each point moves you 1 spot forward
  return Math.max(1, signupPosition - totalPoints);
}

/**
 * Track first LinkedIn share and grant 50-point boost
 * Uses RPC function to bypass RLS restrictions
 */
export async function trackLinkedInFirstShare(entryId: string): Promise<{
  success: boolean;
  boosted: boolean;
  updatedEntry?: {
    total_points: number;
    effective_position: number;
    linkedin_boost_claimed: boolean;
  };
}> {
  try {
    console.log('[ShareTracking] Claiming LinkedIn boost for entry:', entryId);

    // Try RPC function first (bypasses RLS)
    const rpcResult = await claimBoostViaRPC(entryId, 'linkedin');

    if (rpcResult.success && rpcResult.entry) {
      console.log('[ShareTracking] LinkedIn boost claimed via RPC:', rpcResult.entry);

      // Track the share
      await supabase
        .from('waitlist_shares')
        .insert({
          waitlist_entry_id: entryId,
          platform: 'linkedin',
          referral_clicked: false,
          referral_converted: false
        });

      // Analytics
      if (typeof window !== 'undefined' && (window as any).analytics) {
        (window as any).analytics.track('LinkedIn Boost Claimed', {
          entry_id: entryId,
          new_position: rpcResult.entry.effective_position,
          new_points: rpcResult.entry.total_points,
          boost_points: 50
        });
      }

      return {
        success: true,
        boosted: rpcResult.boosted,
        updatedEntry: {
          total_points: rpcResult.entry.total_points,
          effective_position: rpcResult.entry.effective_position,
          linkedin_boost_claimed: rpcResult.entry.linkedin_boost_claimed,
        },
      };
    }

    // RPC might not exist yet - fall back to direct update (will fail if RLS blocks it)
    if (rpcResult.error?.includes('function') || rpcResult.error?.includes('does not exist')) {
      console.warn('[ShareTracking] RPC function not found, falling back to direct update');
      return await trackLinkedInFirstShareFallback(entryId);
    }

    // Boost already claimed or other non-error case
    if (rpcResult.success && !rpcResult.boosted) {
      return { success: true, boosted: false };
    }

    console.error('[ShareTracking] LinkedIn boost failed:', rpcResult.error);
    return { success: false, boosted: false };
  } catch (err) {
    console.error('LinkedIn first share error:', err);
    return { success: false, boosted: false };
  }
}

/**
 * Fallback method using direct update (may fail due to RLS)
 */
async function trackLinkedInFirstShareFallback(entryId: string): Promise<{
  success: boolean;
  boosted: boolean;
  updatedEntry?: {
    total_points: number;
    effective_position: number;
    linkedin_boost_claimed: boolean;
  };
}> {
  // Check if already claimed
  const alreadyClaimed = await hasClaimedLinkedInBoost(entryId);
  if (alreadyClaimed) {
    await trackShare({ waitlist_entry_id: entryId, platform: 'linkedin' });
    return { success: true, boosted: false };
  }

  // Get current entry data
  const { data: entry, error: fetchError } = await supabase
    .from('meetings_waitlist')
    .select('effective_position, total_points, signup_position, referral_count, linkedin_boost_claimed, twitter_boost_claimed')
    .eq('id', entryId)
    .single();

  if (fetchError || !entry) {
    console.error('Failed to fetch entry:', fetchError);
    return { success: false, boosted: false };
  }

  // Calculate new points
  const newTotalPoints = calculateTotalPoints(entry.referral_count || 0, true, entry.twitter_boost_claimed || false);
  const newEffectivePosition = calculateEffectivePosition(entry.signup_position || entry.effective_position || 1, newTotalPoints);

  console.log('[ShareTracking] LinkedIn boost calculation (fallback):', {
    oldPoints: entry.total_points,
    newPoints: newTotalPoints,
    oldPosition: entry.effective_position,
    newPosition: newEffectivePosition
  });

  // Try direct update
  const { error: updateError } = await supabase
    .from('meetings_waitlist')
    .update({
      linkedin_boost_claimed: true,
      linkedin_first_share_at: new Date().toISOString(),
      total_points: newTotalPoints,
      effective_position: newEffectivePosition
    })
    .eq('id', entryId);

  if (updateError) {
    console.error('Failed to apply LinkedIn boost (fallback):', updateError);
    return { success: false, boosted: false };
  }

  // Track the share
  await supabase.from('waitlist_shares').insert({
    waitlist_entry_id: entryId,
    platform: 'linkedin',
    referral_clicked: false,
    referral_converted: false
  });

  return {
    success: true,
    boosted: true,
    updatedEntry: {
      total_points: newTotalPoints,
      effective_position: newEffectivePosition,
      linkedin_boost_claimed: true,
    },
  };
}

/**
 * Track first Twitter/X share and grant 50-point boost
 * Uses RPC function to bypass RLS restrictions
 */
export async function trackTwitterFirstShare(entryId: string): Promise<{
  success: boolean;
  boosted: boolean;
  updatedEntry?: {
    total_points: number;
    effective_position: number;
    twitter_boost_claimed: boolean;
  };
}> {
  try {
    console.log('[ShareTracking] Claiming Twitter boost for entry:', entryId);

    // Try RPC function first (bypasses RLS)
    const rpcResult = await claimBoostViaRPC(entryId, 'twitter');

    if (rpcResult.success && rpcResult.entry) {
      console.log('[ShareTracking] Twitter boost claimed via RPC:', rpcResult.entry);

      // Track the share
      await supabase
        .from('waitlist_shares')
        .insert({
          waitlist_entry_id: entryId,
          platform: 'twitter',
          referral_clicked: false,
          referral_converted: false
        });

      // Analytics
      if (typeof window !== 'undefined' && (window as any).analytics) {
        (window as any).analytics.track('Twitter Boost Claimed', {
          entry_id: entryId,
          new_position: rpcResult.entry.effective_position,
          new_points: rpcResult.entry.total_points,
          boost_points: 50
        });
      }

      return {
        success: true,
        boosted: rpcResult.boosted,
        updatedEntry: {
          total_points: rpcResult.entry.total_points,
          effective_position: rpcResult.entry.effective_position,
          twitter_boost_claimed: rpcResult.entry.twitter_boost_claimed,
        },
      };
    }

    // RPC might not exist yet - fall back to direct update (will fail if RLS blocks it)
    if (rpcResult.error?.includes('function') || rpcResult.error?.includes('does not exist')) {
      console.warn('[ShareTracking] RPC function not found, falling back to direct update');
      return await trackTwitterFirstShareFallback(entryId);
    }

    // Boost already claimed or other non-error case
    if (rpcResult.success && !rpcResult.boosted) {
      return { success: true, boosted: false };
    }

    console.error('[ShareTracking] Twitter boost failed:', rpcResult.error);
    return { success: false, boosted: false };
  } catch (err) {
    console.error('Twitter first share error:', err);
    return { success: false, boosted: false };
  }
}

/**
 * Fallback method using direct update (may fail due to RLS)
 */
async function trackTwitterFirstShareFallback(entryId: string): Promise<{
  success: boolean;
  boosted: boolean;
  updatedEntry?: {
    total_points: number;
    effective_position: number;
    twitter_boost_claimed: boolean;
  };
}> {
  // Check if already claimed
  const alreadyClaimed = await hasClaimedTwitterBoost(entryId);
  if (alreadyClaimed) {
    await trackShare({ waitlist_entry_id: entryId, platform: 'twitter' });
    return { success: true, boosted: false };
  }

  // Get current entry data
  const { data: entry, error: fetchError } = await supabase
    .from('meetings_waitlist')
    .select('effective_position, total_points, signup_position, referral_count, linkedin_boost_claimed, twitter_boost_claimed')
    .eq('id', entryId)
    .single();

  if (fetchError || !entry) {
    console.error('Failed to fetch entry:', fetchError);
    return { success: false, boosted: false };
  }

  // Calculate new points
  const newTotalPoints = calculateTotalPoints(entry.referral_count || 0, entry.linkedin_boost_claimed || false, true);
  const newEffectivePosition = calculateEffectivePosition(entry.signup_position || entry.effective_position || 1, newTotalPoints);

  console.log('[ShareTracking] Twitter boost calculation (fallback):', {
    oldPoints: entry.total_points,
    newPoints: newTotalPoints,
    oldPosition: entry.effective_position,
    newPosition: newEffectivePosition
  });

  // Try direct update
  const { error: updateError } = await supabase
    .from('meetings_waitlist')
    .update({
      twitter_boost_claimed: true,
      twitter_first_share_at: new Date().toISOString(),
      total_points: newTotalPoints,
      effective_position: newEffectivePosition
    })
    .eq('id', entryId);

  if (updateError) {
    console.error('Failed to apply Twitter boost (fallback):', updateError);
    return { success: false, boosted: false };
  }

  // Track the share
  await supabase.from('waitlist_shares').insert({
    waitlist_entry_id: entryId,
    platform: 'twitter',
    referral_clicked: false,
    referral_converted: false
  });

  return {
    success: true,
    boosted: true,
    updatedEntry: {
      total_points: newTotalPoints,
      effective_position: newEffectivePosition,
      twitter_boost_claimed: true,
    },
  };
}
