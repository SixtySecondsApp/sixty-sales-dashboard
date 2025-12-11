/**
 * Encharge Send Email Edge Function
 * 
 * Sends emails via AWS SES using templates stored in Supabase
 * Tracks events in Encharge for analytics and segmentation
 * No Encharge UI required - everything managed programmatically
 */

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SESClient, SendEmailCommand } from 'https://esm.sh/@aws-sdk/client-ses@3';

const ENCHARGE_WRITE_KEY = Deno.env.get('ENCHARGE_WRITE_KEY');
const AWS_REGION = Deno.env.get('AWS_REGION') || 'eu-west-2';
const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID');
const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface SendEmailRequest {
  template_type: string; // 'welcome', 'trial_ending', etc.
  to_email: string;
  to_name?: string;
  user_id?: string;
  variables?: Record<string, any>; // Template variables: { user_name: "John", days_remaining: 3 }
}

/**
 * Replace template variables in HTML/text
 */
function processTemplate(template: string, variables: Record<string, any>): string {
  let processed = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processed = processed.replace(regex, String(value || ''));
  }
  return processed;
}

/**
 * Send event to Encharge for tracking
 */
async function trackEnchargeEvent(
  email: string,
  userId: string | undefined,
  eventName: string,
  properties: Record<string, any>
): Promise<void> {
  if (!ENCHARGE_WRITE_KEY) {
    console.warn('[encharge-send-email] No ENCHARGE_WRITE_KEY, skipping tracking');
    return;
  }

  try {
    const nameParts = properties.user_name?.split(' ') || [];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || undefined;

    await fetch('https://ingest.encharge.io/v1/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Encharge-Token': ENCHARGE_WRITE_KEY,
      },
      body: JSON.stringify({
        name: eventName,
        user: {
          email,
          ...(userId && { userId }),
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
        },
        properties,
      }),
    });
  } catch (error) {
    console.error('[encharge-send-email] Failed to track event:', error);
    // Non-fatal, continue
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const request: SendEmailRequest = await req.json();

    if (!request.template_type || !request.to_email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing template_type or to_email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get template from database
    const { data: template, error: templateError } = await supabase
      .from('encharge_email_templates')
      .select('*')
      .eq('template_type', request.template_type)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Template not found: ${request.template_type}`,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Process template variables
    const variables = {
      user_name: request.to_name || request.to_email.split('@')[0],
      user_email: request.to_email,
      ...request.variables,
    };

    const subject = processTemplate(template.subject_line, variables);
    const htmlBody = processTemplate(template.html_body, variables);
    const textBody = template.text_body ? processTemplate(template.text_body, variables) : undefined;

    // 3. Send email via AWS SES
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'AWS credentials not configured',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sesClient = new SESClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });

    const sendEmailCommand = new SendEmailCommand({
      Source: 'Sixty Seconds <workflows@sixtyseconds.ai>',
      Destination: {
        ToAddresses: [request.to_email],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
          ...(textBody && {
            Text: {
              Data: textBody,
              Charset: 'UTF-8',
            },
          }),
        },
      },
    });

    const sesResult = await sesClient.send(sendEmailCommand);
    const messageId = sesResult.MessageId;

    // 4. Track event in Encharge
    const eventNameMap: Record<string, string> = {
      welcome: 'Account Created',
      waitlist_invite: 'Waitlist Invite Sent',
      trial_ending: 'Trial Ending Soon',
      trial_expired: 'Trial Expired',
      first_summary_viewed: 'First Summary Viewed',
      fathom_connected: 'Fathom Connected',
      first_meeting_synced: 'First Meeting Synced',
    };

    const eventName = eventNameMap[request.template_type] || 'Email Sent';
    await trackEnchargeEvent(
      request.to_email,
      request.user_id,
      eventName,
      {
        template_type: request.template_type,
        template_name: template.template_name,
        ...variables,
      }
    );

    // 5. Log to database
    try {
      await supabase.from('email_logs').insert({
        email_type: request.template_type,
        to_email: request.to_email,
        user_id: request.user_id,
        status: 'sent',
        metadata: {
          template_id: template.id,
          template_name: template.template_name,
          message_id: messageId,
          variables,
        },
        sent_via: 'aws_ses',
      });
    } catch (logError) {
      console.warn('[encharge-send-email] Failed to log email:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: messageId,
        template_type: request.template_type,
        template_name: template.template_name,
        event_tracked: eventName,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[encharge-send-email] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
