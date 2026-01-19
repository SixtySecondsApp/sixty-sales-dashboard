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
  user_profile?: {
    first_name?: string;
    last_name?: string;
  };
  organizations?: {
    id: string;
    name: string;
    company_domain?: string;
  };
}

export interface CreateJoinRequestParams {
  orgId: string;
  userId: string;
  userProfile?: {
    first_name?: string;
    last_name?: string;
  };
}

export interface ApproveJoinRequestResult {
  success: boolean;
  message: string;
  org_id?: string;
  user_id?: string;
}

export interface RejectJoinRequestResult {
  success: boolean;
  message: string;
}

export const joinRequestService = {
  /**
   * Create a join request for an organization
   */
  async createJoinRequest(params: CreateJoinRequestParams) {
    const { data, error } = await supabase.rpc('create_join_request', {
      p_org_id: params.orgId,
      p_user_id: params.userId,
      p_user_profile: params.userProfile || null,
    });

    if (error) throw error;
    return data[0];
  },

  /**
   * Get pending join requests for an organization (admin view)
   */
  async getPendingJoinRequests(orgId: string): Promise<JoinRequest[]> {
    const { data, error } = await supabase
      .from('organization_join_requests')
      .select('*')
      .eq('org_id', orgId)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get all join requests for an organization (with status filter)
   */
  async getJoinRequests(
    orgId: string,
    status?: 'pending' | 'approved' | 'rejected'
  ): Promise<JoinRequest[]> {
    let query = supabase
      .from('organization_join_requests')
      .select('*')
      .eq('org_id', orgId);

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('requested_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  /**
   * Get user's own join requests
   */
  async getUserJoinRequests(userId: string): Promise<JoinRequest[]> {
    const { data, error } = await supabase
      .from('organization_join_requests')
      .select(
        `
        *,
        organizations (
          id,
          name,
          company_domain
        )
      `
      )
      .eq('user_id', userId)
      .order('requested_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Approve a join request (admin action)
   */
  async approveJoinRequest(requestId: string): Promise<ApproveJoinRequestResult> {
    const { data, error } = await supabase.rpc('approve_join_request', {
      p_request_id: requestId,
    });

    if (error) throw error;
    return data[0];
  },

  /**
   * Reject a join request (admin action)
   */
  async rejectJoinRequest(
    requestId: string,
    reason?: string
  ): Promise<RejectJoinRequestResult> {
    const { data, error } = await supabase.rpc('reject_join_request', {
      p_request_id: requestId,
      p_reason: reason || null,
    });

    if (error) throw error;
    return data[0];
  },
};
