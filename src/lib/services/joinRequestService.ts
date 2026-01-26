/**
 * Join Request Service
 *
 * Handles organization join request operations:
 * - Approving requests (generates magic link token)
 * - Rejecting requests
 * - Validating tokens for accepting requests
 * - Accepting join requests via magic link
 */

import { supabase } from '@/lib/supabase/clientV2';

export interface JoinRequest {
  id: string;
  org_id: string;
  user_id: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  actioned_by?: string;
  actioned_at?: string;
  rejection_reason?: string;
  join_request_token?: string;
  join_request_expires_at?: string;
  user_profile?: Record<string, any>;
}

export interface ApproveRequestResult {
  success: boolean;
  error?: string;
  token?: string;
}

export interface RejectRequestResult {
  success: boolean;
  error?: string;
}

export interface ValidateTokenResult {
  success: boolean;
  error?: string;
  joinRequest?: JoinRequest;
  organization?: {
    id: string;
    name: string;
  };
}

export interface AcceptRequestResult {
  success: boolean;
  error?: string;
  organizationId?: string;
}

/**
 * Approve a join request
 * Calls edge function to generate token and send approval email
 */
export async function approveJoinRequest(
  requestId: string,
  adminUserId: string
): Promise<ApproveRequestResult> {
  try {
    const { data, error } = await supabase.functions.invoke('handle-join-request-action', {
      body: {
        action: 'approve',
        request_id: requestId,
        admin_user_id: adminUserId,
      },
    });

    if (error) {
      console.error('[joinRequestService] Failed to approve request:', error);
      return {
        success: false,
        error: error.message || 'Failed to approve join request',
      };
    }

    if (!data?.success) {
      return {
        success: false,
        error: data?.error || 'Failed to approve join request',
      };
    }

    return {
      success: true,
      token: data.token,
    };
  } catch (err) {
    console.error('[joinRequestService] Exception in approveJoinRequest:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Reject a join request
 * Calls edge function to reject and send rejection email
 */
export async function rejectJoinRequest(
  requestId: string,
  adminUserId: string,
  reason?: string
): Promise<RejectRequestResult> {
  try {
    const { data, error } = await supabase.functions.invoke('handle-join-request-action', {
      body: {
        action: 'reject',
        request_id: requestId,
        admin_user_id: adminUserId,
        rejection_reason: reason,
      },
    });

    if (error) {
      console.error('[joinRequestService] Failed to reject request:', error);
      return {
        success: false,
        error: error.message || 'Failed to reject join request',
      };
    }

    if (!data?.success) {
      return {
        success: false,
        error: data?.error || 'Failed to reject join request',
      };
    }

    return {
      success: true,
    };
  } catch (err) {
    console.error('[joinRequestService] Exception in rejectJoinRequest:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Validate a join request token
 * Called when user clicks magic link from approval email
 */
export async function validateJoinRequestToken(
  token: string,
  requestId: string
): Promise<ValidateTokenResult> {
  try {
    // Fetch the join request by token
    const { data: joinRequest, error: requestError } = await supabase
      .from('organization_join_requests')
      .select('id, org_id, user_id, email, status, join_request_token, join_request_expires_at')
      .eq('id', requestId)
      .eq('join_request_token', token)
      .eq('status', 'approved')
      .maybeSingle();

    if (requestError) {
      console.error('[joinRequestService] Failed to fetch join request:', requestError);
      return {
        success: false,
        error: 'Invalid or expired token',
      };
    }

    if (!joinRequest) {
      return {
        success: false,
        error: 'Invalid or expired token',
      };
    }

    // Check if token is expired
    if (joinRequest.join_request_expires_at) {
      const expiresAt = new Date(joinRequest.join_request_expires_at);
      if (expiresAt < new Date()) {
        return {
          success: false,
          error: 'Token has expired. Please contact the organization admin for a new link.',
        };
      }
    }

    // Fetch organization details
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', joinRequest.org_id)
      .single();

    if (orgError || !org) {
      console.error('[joinRequestService] Failed to fetch organization:', orgError);
      return {
        success: false,
        error: 'Organization not found',
      };
    }

    return {
      success: true,
      joinRequest: joinRequest as JoinRequest,
      organization: org,
    };
  } catch (err) {
    console.error('[joinRequestService] Exception in validateJoinRequestToken:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Accept a join request via magic link token
 * Creates membership and marks profile as active
 */
export async function acceptJoinRequest(
  token: string,
  requestId: string
): Promise<AcceptRequestResult> {
  try {
    // First validate the token
    const validation = await validateJoinRequestToken(token, requestId);

    if (!validation.success || !validation.joinRequest || !validation.organization) {
      return {
        success: false,
        error: validation.error || 'Invalid token',
      };
    }

    const joinRequest = validation.joinRequest;
    const orgId = validation.organization.id;

    // Check if user is already a member (shouldn't happen, but be safe)
    const { data: existingMembership } = await supabase
      .from('organization_memberships')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', joinRequest.user_id)
      .maybeSingle();

    if (existingMembership) {
      return {
        success: false,
        error: 'You are already a member of this organization',
      };
    }

    // Create membership
    const { error: membershipError } = await supabase
      .from('organization_memberships')
      .insert({
        org_id: orgId,
        user_id: joinRequest.user_id,
        role: 'member',
      });

    if (membershipError) {
      console.error('[joinRequestService] Failed to create membership:', membershipError);
      return {
        success: false,
        error: 'Failed to create membership',
      };
    }

    // Update profile status to active
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ profile_status: 'active' })
      .eq('id', joinRequest.user_id);

    if (profileError) {
      console.error('[joinRequestService] Failed to update profile status:', profileError);
      // Don't fail - membership was already created
    }

    // Mark the join request as having been used by clearing the token
    // Keep status as 'approved' since membership is now created
    const { error: requestUpdateError } = await supabase
      .from('organization_join_requests')
      .update({
        join_request_token: null, // Clear token after use to prevent reuse
      })
      .eq('id', requestId);

    if (requestUpdateError) {
      console.error('[joinRequestService] Failed to clear join request token:', requestUpdateError);
      // Don't fail - the important parts were already done
    }

    return {
      success: true,
      organizationId: orgId,
    };
  } catch (err) {
    console.error('[joinRequestService] Exception in acceptJoinRequest:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Get pending join requests for an organization
 * Used by org admins to review requests
 */
export async function getPendingJoinRequests(orgId: string): Promise<JoinRequest[]> {
  try {
    console.log('[joinRequestService] ===== FETCHING JOIN REQUESTS =====');
    console.log('[joinRequestService] Org ID:', orgId);

    // Check auth state
    const { data: { session } } = await supabase.auth.getSession();
    console.log('[joinRequestService] Auth session exists:', !!session);
    console.log('[joinRequestService] User ID:', session?.user?.id);
    console.log('[joinRequestService] User email:', session?.user?.email);

    // Step 1: Fetch join requests (without embedded profile join)
    const { data: joinRequests, error } = await supabase
      .from('organization_join_requests')
      .select(`
        id,
        org_id,
        user_id,
        email,
        status,
        requested_at,
        actioned_by,
        actioned_at,
        rejection_reason,
        join_request_token,
        join_request_expires_at
      `)
      .eq('org_id', orgId)
      .eq('status', 'pending') // Only show pending requests (approved ones become members immediately)
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('[joinRequestService] ❌ Query failed with error:', error);
      console.error('[joinRequestService] Error code:', error.code);
      console.error('[joinRequestService] Error message:', error.message);
      console.error('[joinRequestService] Error details:', error.details);
      console.error('[joinRequestService] Error hint:', error.hint);
      return [];
    }

    console.log('[joinRequestService] ✅ Join requests query succeeded');
    console.log('[joinRequestService] Number of results:', joinRequests?.length || 0);

    if (!joinRequests || joinRequests.length === 0) {
      console.warn('[joinRequestService] ⚠️ No pending requests found for org:', orgId);
      return [];
    }

    // Step 2: Fetch profiles for all user_ids
    const userIds = joinRequests.map(req => req.user_id);
    console.log('[joinRequestService] Fetching profiles for user IDs:', userIds);

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .in('id', userIds);

    if (profilesError) {
      console.warn('[joinRequestService] ⚠️ Failed to fetch profiles:', profilesError);
      // Continue without profiles - we still have email from join requests
    } else {
      console.log('[joinRequestService] ✅ Fetched', profiles?.length || 0, 'profiles');
    }

    // Step 3: Merge profiles with join requests
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    const enrichedRequests = joinRequests.map(req => ({
      ...req,
      user_profile: profileMap.get(req.user_id) || null,
    }));

    console.log('[joinRequestService] ✅ Enriched requests with profile data');
    enrichedRequests.forEach((req, idx) => {
      console.log(`[joinRequestService] Request ${idx + 1}:`, {
        email: req.email,
        status: req.status,
        org_id: req.org_id,
        has_profile: !!req.user_profile,
        profile_name: req.user_profile ? `${req.user_profile.first_name} ${req.user_profile.last_name}` : 'N/A',
      });
    });

    return enrichedRequests as JoinRequest[];
  } catch (err) {
    console.error('[joinRequestService] ❌ Exception in getPendingJoinRequests:', err);
    return [];
  }
}

/**
 * Get join request details by user
 * Check what requests a user has made
 */
export async function getUserJoinRequests(userId: string): Promise<JoinRequest[]> {
  try {
    const { data, error } = await supabase
      .from('organization_join_requests')
      .select('*')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false });

    if (error) {
      console.error('[joinRequestService] Failed to get user join requests:', error);
      return [];
    }

    return (data || []) as JoinRequest[];
  } catch (err) {
    console.error('[joinRequestService] Exception in getUserJoinRequests:', err);
    return [];
  }
}

/**
 * Cancel a pending join request
 * Allows user to cancel and restart onboarding
 */
export async function cancelJoinRequest(
  requestId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('cancel_join_request', {
      p_request_id: requestId,
      p_user_id: userId,
    });

    if (error) {
      console.error('[joinRequestService] Failed to cancel request:', error);
      return {
        success: false,
        error: error.message || 'Failed to cancel join request',
      };
    }

    if (!data?.[0]?.success) {
      return {
        success: false,
        error: data?.[0]?.message || 'Failed to cancel join request',
      };
    }

    return { success: true };
  } catch (err) {
    console.error('[joinRequestService] Exception in cancelJoinRequest:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
