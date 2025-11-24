import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduledEmail {
  id: string;
  user_id: string;
  to_email: string;
  cc_email?: string;
  bcc_email?: string;
  subject: string;
  body: string;
  scheduled_for: string;
  reply_to_message_id?: string;
  thread_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[Scheduled Email Sender] Starting scheduled email processing...');

    // Create Supabase client with service role key for bypassing RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get all pending scheduled emails that are due to be sent
    const now = new Date().toISOString();
    const { data: pendingEmails, error: fetchError } = await supabaseAdmin
      .from('scheduled_emails')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .limit(50); // Process up to 50 emails per run

    if (fetchError) {
      console.error('[Scheduled Email Sender] Error fetching pending emails:', fetchError);
      throw fetchError;
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log('[Scheduled Email Sender] No pending emails to send');
      return new Response(
        JSON.stringify({ message: 'No pending emails to send', processed: 0 }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`[Scheduled Email Sender] Found ${pendingEmails.length} emails to send`);

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each email
    for (const email of pendingEmails as ScheduledEmail[]) {
      try {
        console.log(`[Scheduled Email Sender] Processing email ${email.id}...`);

        // Get user's Gmail credentials
        const { data: userIntegration, error: integrationError } = await supabaseAdmin
          .from('user_integrations')
          .select('access_token, refresh_token, expires_at')
          .eq('user_id', email.user_id)
          .eq('provider', 'google')
          .single();

        if (integrationError || !userIntegration) {
          throw new Error(`No Gmail integration found for user ${email.user_id}`);
        }

        // Check if access token is expired and refresh if needed
        let accessToken = userIntegration.access_token;
        const expiresAt = new Date(userIntegration.expires_at);

        if (expiresAt < new Date()) {
          console.log('[Scheduled Email Sender] Access token expired, refreshing...');

          // Refresh the access token
          const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
              client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
              refresh_token: userIntegration.refresh_token,
              grant_type: 'refresh_token',
            }),
          });

          if (!refreshResponse.ok) {
            throw new Error('Failed to refresh access token');
          }

          const refreshData = await refreshResponse.json();
          accessToken = refreshData.access_token;

          // Update the stored access token
          await supabaseAdmin
            .from('user_integrations')
            .update({
              access_token: accessToken,
              expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
            })
            .eq('user_id', email.user_id)
            .eq('provider', 'google');
        }

        // Build the email message in RFC 2822 format
        const emailLines: string[] = [];
        emailLines.push(`To: ${email.to_email}`);
        if (email.cc_email) emailLines.push(`Cc: ${email.cc_email}`);
        if (email.bcc_email) emailLines.push(`Bcc: ${email.bcc_email}`);
        emailLines.push(`Subject: ${email.subject}`);
        emailLines.push('Content-Type: text/html; charset=utf-8');
        emailLines.push('');
        emailLines.push(email.body);

        const rawMessage = emailLines.join('\r\n');
        const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        // Send email via Gmail API
        const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            raw: encodedMessage,
            threadId: email.thread_id,
          }),
        });

        if (!gmailResponse.ok) {
          const errorText = await gmailResponse.text();
          throw new Error(`Gmail API error: ${errorText}`);
        }

        // Mark email as sent
        const { error: updateError } = await supabaseAdmin
          .from('scheduled_emails')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', email.id);

        if (updateError) {
          console.error(`[Scheduled Email Sender] Error updating email ${email.id}:`, updateError);
        }

        console.log(`[Scheduled Email Sender] Successfully sent email ${email.id}`);
        results.sent++;
      } catch (error) {
        console.error(`[Scheduled Email Sender] Error sending email ${email.id}:`, error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.failed++;
        results.errors.push(`Email ${email.id}: ${errorMessage}`);

        // Mark email as failed
        await supabaseAdmin
          .from('scheduled_emails')
          .update({
            status: 'failed',
            error_message: errorMessage,
          })
          .eq('id', email.id);
      }
    }

    console.log('[Scheduled Email Sender] Processing complete:', results);

    return new Response(
      JSON.stringify({
        message: 'Scheduled email processing complete',
        processed: pendingEmails.length,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[Scheduled Email Sender] Fatal error:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
