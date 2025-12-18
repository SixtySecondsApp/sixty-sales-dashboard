/**
 * Send Waitlist Invitation Edge Function
 *
 * Replaces the magic link system with password-based invitation flow.
 * Uses Supabase's admin.inviteUserByEmail() to create user and send invitation.
 *
 * Flow:
 * 1. Validate waitlist entry exists
 * 2. Check if user already has an account
 * 3. Send invitation via Supabase Admin API
 * 4. Update waitlist entry with invitation tracking
 * 5. Return success/error response
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface InvitationRequest {
  entryId: string;
  adminUserId: string;
  adminNotes?: string;
}

interface InvitationResponse {
  success: boolean;
  error?: string;
  invitedUserId?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS headers for local development
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Initialize Supabase Admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Parse request body
    const { entryId, adminUserId, adminNotes }: InvitationRequest = await req.json();

    if (!entryId || !adminUserId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameters: entryId and adminUserId'
        } as InvitationResponse),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    // 1. Get waitlist entry
    const { data: entry, error: fetchError } = await supabaseAdmin
      .from('meetings_waitlist')
      .select('id, email, full_name, company_name, user_id')
      .eq('id', entryId)
      .single();

    if (fetchError || !entry) {
      console.error('Failed to fetch waitlist entry:', fetchError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Waitlist entry not found'
        } as InvitationResponse),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    // 2. Check if user already exists - check waitlist link first
    if (entry.user_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `${entry.email} already has an account. They can log in at ${Deno.env.get('SITE_URL')}/login`
        } as InvitationResponse),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    // Check if email exists in auth.users (might not be linked to waitlist)
    const { data: userExists, error: checkError } = await supabaseAdmin.rpc('check_user_exists_by_email', {
      p_email: entry.email
    });

    if (checkError) {
      console.error('Error checking if user exists:', checkError);
      // Continue anyway - better to try invitation than block
    }

    if (userExists) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `${entry.email} already has an account but isn't linked to this waitlist entry. Please contact support.`
        } as InvitationResponse),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    // 3. Generate invitation link using Supabase Admin API
    // Use generateLink instead of inviteUserByEmail to get the URL without Supabase sending an email
    // This way we only send our custom branded email
    const nameParts = (entry.full_name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    console.log(`Generating invitation for ${entry.email} (${entry.full_name})`);

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: entry.email,
      options: {
        data: {
          waitlist_entry_id: entryId,
          first_name: firstName,
          last_name: lastName,
          company_name: entry.company_name || '',
          source: 'waitlist_invitation'
        },
        redirectTo: `${Deno.env.get('SITE_URL')}/auth/callback?waitlist_entry=${entryId}`
      }
    });

    if (inviteError) {
      console.error('Failed to generate invitation link:', inviteError);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to generate invitation: ${inviteError.message}`
        } as InvitationResponse),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    if (!inviteData?.properties?.hashed_token) {
      console.error('Invitation link generation succeeded but no token returned');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invitation failed: no token generated'
        } as InvitationResponse),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    // The invitation URL from Supabase includes the token
    const invitationUrl = inviteData.properties.action_link;
    const invitedUserId = inviteData.user.id;

    console.log(`Generated invitation link for ${entry.email}, user ID: ${invitedUserId}`);

    // 4. Update waitlist entry with invitation tracking
    const invitedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    const { error: updateError } = await supabaseAdmin
      .from('meetings_waitlist')
      .update({
        status: 'released',
        invited_at: invitedAt.toISOString(),
        invitation_expires_at: expiresAt.toISOString(),
        invited_user_id: invitedUserId,
        granted_access_at: invitedAt.toISOString(),
        granted_by: adminUserId,
        admin_notes: adminNotes || null
      })
      .eq('id', entryId);

    if (updateError) {
      console.error('Failed to update waitlist entry:', updateError);
      // Don't fail the invitation if update fails - user was already created
      console.warn('Invitation generated but failed to update waitlist entry');
    }

    // 5. Log admin action (optional - table may not exist)
    try {
      await supabaseAdmin.from('waitlist_admin_actions').insert({
        waitlist_entry_id: entryId,
        admin_user_id: adminUserId,
        action_type: 'grant_access',
        action_details: {
          type: 'invitation',
          invited_user_id: invitedUserId,
          invitation_expires_at: expiresAt.toISOString()
        },
        notes: adminNotes,
        new_value: {
          status: 'invited',
          invited_at: invitedAt.toISOString()
        }
      });
    } catch (logError) {
      // Admin actions table may not exist, continue without logging
      console.warn('Failed to log admin action:', logError);
    }

    // 6. Send custom branded email with the real invitation URL
    // This is the ONLY email sent (Supabase doesn't send one when using generateLink)
    try {
      // Send custom branded email via encharge-send-email edge function
      await supabaseAdmin.functions.invoke('encharge-send-email', {
        body: {
          template_type: 'waitlist_invitation',
          to_email: entry.email,
          to_name: firstName || entry.email.split('@')[0],
          variables: {
            invitation_url: invitationUrl,
            user_name: firstName || entry.email.split('@')[0],
            user_email: entry.email,
            full_name: entry.full_name || '',
            company_name: entry.company_name || ''
          }
        }
      });
      console.log(`Successfully sent invitation email to ${entry.email} with link: ${invitationUrl.substring(0, 50)}...`);
    } catch (emailError) {
      // Critical error - this is the only email being sent
      console.error('CRITICAL: Failed to send invitation email:', emailError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'User was created but failed to send invitation email. Please contact support.'
        } as InvitationResponse),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }

    // 7. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        invitedUserId: invitedUserId
      } as InvitationResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    );

  } catch (error) {
    console.error('Unexpected error in send-waitlist-invitation:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      } as InvitationResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      }
    );
  }
});
