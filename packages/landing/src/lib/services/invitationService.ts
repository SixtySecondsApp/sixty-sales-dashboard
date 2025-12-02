/**
 * Invitation Service
 *
 * Manages organization invitations - creating, sending, accepting, and revoking.
 */

import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

export interface Invitation {
  id: string;
  org_id: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'readonly';
  invited_by: string | null;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  organization?: {
    id: string;
    name: string;
  };
}

export interface CreateInvitationParams {
  orgId: string;
  email: string;
  role: 'admin' | 'member';
}

export interface AcceptInvitationResult {
  success: boolean;
  org_id: string | null;
  org_name: string | null;
  role: string | null;
  error_message: string | null;
}

// =====================================================
// Create Invitation
// =====================================================

export async function createInvitation({
  orgId,
  email,
  role,
}: CreateInvitationParams): Promise<{ data: Invitation | null; error: string | null }> {
  try {
    logger.log('[InvitationService] Creating invitation:', { orgId, email, role });

    // Check if user already exists and is a member
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    const profileId = (profileData as { id: string } | null)?.id;
    if (profileId) {
      const { data: existingMembership } = await supabase
        .from('organization_memberships')
        .select('user_id')
        .eq('org_id', orgId)
        .eq('user_id', profileId)
        .single();

      if (existingMembership) {
        return { data: null, error: 'User is already a member of this organization' };
      }
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabase
      .from('organization_invitations')
      .select('id')
      .eq('org_id', orgId)
      .eq('email', email.toLowerCase())
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingInvite) {
      return { data: null, error: 'A pending invitation already exists for this email' };
    }

    // Create the invitation
    // Note: organization_invitations table is created by our migrations but not in generated types
    const { data, error } = await supabase
      .from('organization_invitations' as any)
      .insert({
        org_id: orgId,
        email: email.toLowerCase(),
        role,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      } as any)
      .select()
      .single();

    if (error) {
      logger.error('[InvitationService] Error creating invitation:', error);
      return { data: null, error: error.message };
    }

    const invitationData = data as unknown as Invitation;
    logger.log('[InvitationService] Invitation created:', invitationData?.id);

    // TODO: Send invitation email via Edge Function
    // await sendInvitationEmail(invitationData);

    return { data: invitationData, error: null };
  } catch (err: any) {
    logger.error('[InvitationService] Exception creating invitation:', err);
    return { data: null, error: err.message || 'Failed to create invitation' };
  }
}

// =====================================================
// Accept Invitation
// =====================================================

export async function acceptInvitation(
  token: string
): Promise<AcceptInvitationResult> {
  try {
    logger.log('[InvitationService] Accepting invitation with token');

    // Note: accept_org_invitation is defined in our migrations but not in generated types
    // Use type assertion on the whole result to work around missing types
    const response = await (supabase.rpc as any)('accept_org_invitation', {
      p_token: token,
    }) as { data: AcceptInvitationResult[] | null; error: any };

    if (response.error) {
      logger.error('[InvitationService] Error accepting invitation:', response.error);
      return {
        success: false,
        org_id: null,
        org_name: null,
        role: null,
        error_message: response.error.message,
      };
    }

    // The function returns a table, so data will be an array
    const result = response.data?.[0] || null;

    if (!result?.success) {
      return {
        success: false,
        org_id: result?.org_id || null,
        org_name: result?.org_name || null,
        role: result?.role || null,
        error_message: result?.error_message || 'Failed to accept invitation',
      };
    }

    logger.log('[InvitationService] Invitation accepted:', result);

    return {
      success: true,
      org_id: result.org_id,
      org_name: result.org_name,
      role: result.role,
      error_message: null,
    };
  } catch (err: any) {
    logger.error('[InvitationService] Exception accepting invitation:', err);
    return {
      success: false,
      org_id: null,
      org_name: null,
      role: null,
      error_message: err.message || 'Failed to accept invitation',
    };
  }
}

// =====================================================
// Get Pending Invitations for Organization
// =====================================================

export async function getOrgInvitations(
  orgId: string
): Promise<{ data: Invitation[] | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('organization_invitations')
      .select('*')
      .eq('org_id', orgId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('[InvitationService] Error fetching invitations:', error);
      return { data: null, error: error.message };
    }

    return { data: data || [], error: null };
  } catch (err: any) {
    logger.error('[InvitationService] Exception fetching invitations:', err);
    return { data: null, error: err.message || 'Failed to fetch invitations' };
  }
}

// =====================================================
// Get Invitation by Token (for accept page)
// =====================================================

export async function getInvitationByToken(
  token: string
): Promise<{ data: Invitation | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('organization_invitations')
      .select(`
        *,
        organization:organizations(id, name)
      `)
      .eq('token', token)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { data: null, error: 'Invitation not found or has expired' };
      }
      logger.error('[InvitationService] Error fetching invitation:', error);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    logger.error('[InvitationService] Exception fetching invitation:', err);
    return { data: null, error: err.message || 'Failed to fetch invitation' };
  }
}

// =====================================================
// Revoke Invitation
// =====================================================

export async function revokeInvitation(
  invitationId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    logger.log('[InvitationService] Revoking invitation:', invitationId);

    const { error } = await supabase
      .from('organization_invitations')
      .delete()
      .eq('id', invitationId)
      .is('accepted_at', null);

    if (error) {
      logger.error('[InvitationService] Error revoking invitation:', error);
      return { success: false, error: error.message };
    }

    logger.log('[InvitationService] Invitation revoked');
    return { success: true, error: null };
  } catch (err: any) {
    logger.error('[InvitationService] Exception revoking invitation:', err);
    return { success: false, error: err.message || 'Failed to revoke invitation' };
  }
}

// =====================================================
// Resend Invitation (update expiry and resend email)
// =====================================================

export async function resendInvitation(
  invitationId: string
): Promise<{ data: Invitation | null; error: string | null }> {
  try {
    logger.log('[InvitationService] Resending invitation:', invitationId);

    // Update expiry date
    // Use type assertion to work around missing types for organization_invitations
    const response = await (supabase
      .from('organization_invitations') as any)
      .update({
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        // Generate new token for security
        token: crypto.randomUUID(),
      })
      .eq('id', invitationId)
      .is('accepted_at', null)
      .select()
      .single() as { data: Invitation | null; error: any };

    if (response.error) {
      logger.error('[InvitationService] Error resending invitation:', response.error);
      return { data: null, error: response.error.message };
    }

    const invitationData = response.data;

    // TODO: Send invitation email via Edge Function
    // await sendInvitationEmail(invitationData);

    logger.log('[InvitationService] Invitation resent');
    return { data: invitationData, error: null };
  } catch (err: any) {
    logger.error('[InvitationService] Exception resending invitation:', err);
    return { data: null, error: err.message || 'Failed to resend invitation' };
  }
}
