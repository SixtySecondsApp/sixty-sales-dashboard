/**
 * Handle Join Request Action Edge Function
 *
 * Processes admin approval/rejection of organization join requests.
 * When approved: generates magic link token, sets expiry, sends approval email
 * When rejected: marks request as rejected, sends rejection email
 *
 * Flow:
 * 1. Validate request and admin permissions
 * 2. Generate magic link token (if approving)
 * 3. Update database records
 * 4. Send appropriate email via encharge-send-email
 */

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.190.0/crypto/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE_URL = Deno.env.get('SITE_URL') || 'https://app.use60.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface HandleJoinRequestRequest {
  action: 'approve' | 'reject';
  request_id: string;
  admin_user_id: string;
  rejection_reason?: string;
}

interface HandleJoinRequestResponse {
  success: boolean;
  error?: string;
  message?: string;
  token?: string;
}

/**
 * Generate a cryptographically secure random token
 */
function generateToken(length: number = 64): string {
  const chars = '0123456789abcdef';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars[bytes[i] % 16];
  }
  return token;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const requestBody: HandleJoinRequestRequest = await req.json();
    const { action, request_id, admin_user_id, rejection_reason } = requestBody;

    if (!action || !request_id || !admin_user_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameters: action, request_id, admin_user_id',
        } as HandleJoinRequestResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (action !== 'approve' && action !== 'reject') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid action. Must be "approve" or "reject"',
        } as HandleJoinRequestResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 1. Fetch the join request
    const { data: joinRequest, error: fetchError } = await supabaseAdmin
      .from('organization_join_requests')
      .select('id, org_id, user_id, email, status')
      .eq('id', request_id)
      .maybeSingle();

    if (fetchError || !joinRequest) {
      console.error('Failed to fetch join request:', fetchError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Join request not found',
        } as HandleJoinRequestResponse),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (joinRequest.status !== 'pending') {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Join request has already been ${joinRequest.status}`,
        } as HandleJoinRequestResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Verify admin is an owner/admin of the org
    const { data: adminMembership, error: adminCheckError } = await supabaseAdmin
      .from('organization_memberships')
      .select('id, role')
      .eq('org_id', joinRequest.org_id)
      .eq('user_id', admin_user_id)
      .maybeSingle();

    if (adminCheckError || !adminMembership || !['owner', 'admin'].includes(adminMembership.role)) {
      console.error('Admin permission check failed:', adminCheckError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized: only org admins can approve/reject requests',
        } as HandleJoinRequestResponse),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Get organization details
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .select('id, name, domain')
      .eq('id', joinRequest.org_id)
      .single();

    if (orgError || !org) {
      console.error('Failed to fetch organization:', orgError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Organization not found',
        } as HandleJoinRequestResponse),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Get user profile for name
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('id', joinRequest.user_id)
      .maybeSingle();

    if (profileError) {
      console.error('Failed to fetch profile:', profileError);
    }

    const userName = profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : joinRequest.email.split('@')[0];

    if (action === 'approve') {
      // Check if user is already a member (shouldn't happen, but be safe)
      const { data: existingMembership } = await supabaseAdmin
        .from('organization_memberships')
        .select('id')
        .eq('org_id', joinRequest.org_id)
        .eq('user_id', joinRequest.user_id)
        .maybeSingle();

      if (existingMembership) {
        // Update request status but don't create duplicate membership
        await supabaseAdmin
          .from('organization_join_requests')
          .update({
            status: 'approved',
            actioned_by: admin_user_id,
            actioned_at: new Date().toISOString(),
          })
          .eq('id', request_id);

        return new Response(
          JSON.stringify({
            success: false,
            error: 'User is already a member of this organization',
          } as HandleJoinRequestResponse),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // IMMEDIATELY CREATE MEMBERSHIP (no magic link needed)
      const { error: membershipError } = await supabaseAdmin
        .from('organization_memberships')
        .insert({
          org_id: joinRequest.org_id,
          user_id: joinRequest.user_id,
          role: 'member',
        });

      if (membershipError) {
        console.error('Failed to create membership:', membershipError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to create membership',
          } as HandleJoinRequestResponse),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Update profile status to active
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({
          profile_status: 'active',
        })
        .eq('id', joinRequest.user_id);

      if (profileUpdateError) {
        console.error('Failed to update profile status:', profileUpdateError);
        // Don't fail - membership was already created
      }

      // Update join request status
      const { error: updateError } = await supabaseAdmin
        .from('organization_join_requests')
        .update({
          status: 'approved',
          actioned_by: admin_user_id,
          actioned_at: new Date().toISOString(),
        })
        .eq('id', request_id);

      if (updateError) {
        console.error('Failed to update join request:', updateError);
        // Don't fail - membership was already created
      }

      // Send welcome email via encharge-send-email (no magic link needed)
      const enchargeFunctionUrl = `${SUPABASE_URL}/functions/v1/encharge-send-email`;
      const dashboardLink = `${SITE_URL}/dashboard`;

      const emailResponse = await fetch(enchargeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
          template_type: 'join_request_approved',
          to_email: joinRequest.email,
          to_name: userName,
          user_id: joinRequest.user_id,
          variables: {
            first_name: profile?.first_name || userName,
            org_name: org.name,
            approval_link: dashboardLink,
            action_url: dashboardLink,
          },
        }),
      });

      if (!emailResponse.ok) {
        console.error('Failed to send welcome email:', emailResponse.status);
        // Don't fail the whole request if email fails - the membership was created
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Join request approved, membership created, and email sent',
        } as HandleJoinRequestResponse),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      // REJECT action
      // Update join request status
      const { error: updateError } = await supabaseAdmin
        .from('organization_join_requests')
        .update({
          status: 'rejected',
          actioned_by: admin_user_id,
          actioned_at: new Date().toISOString(),
          rejection_reason: rejection_reason || null,
        })
        .eq('id', request_id);

      if (updateError) {
        console.error('Failed to update join request:', updateError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to update join request',
          } as HandleJoinRequestResponse),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Update profile status to rejected
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({
          profile_status: 'rejected',
        })
        .eq('id', joinRequest.user_id);

      if (profileUpdateError) {
        console.error('Failed to update profile status:', profileUpdateError);
        // Don't fail - rejection was already recorded
      }

      // Send rejection email via encharge-send-email
      const enchargeFunctionUrl = `${SUPABASE_URL}/functions/v1/encharge-send-email`;

      const emailResponse = await fetch(enchargeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
          template_type: 'join_request_rejected',
          to_email: joinRequest.email,
          to_name: userName,
          user_id: joinRequest.user_id,
          variables: {
            first_name: profile?.first_name || userName,
            org_name: org.name,
            rejection_reason: rejection_reason || 'Your request does not meet our criteria at this time.',
          },
        }),
      });

      if (!emailResponse.ok) {
        console.error('Failed to send rejection email:', emailResponse.status);
        // Don't fail the whole request if email fails - the rejection was still recorded
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Join request rejected and email sent',
        } as HandleJoinRequestResponse),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error: any) {
    console.error('[handle-join-request-action] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error',
      } as HandleJoinRequestResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
