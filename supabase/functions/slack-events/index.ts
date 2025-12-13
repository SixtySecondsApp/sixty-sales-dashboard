// supabase/functions/slack-events/index.ts
// Handles Slack Events API - URL verification and event routing

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const slackSigningSecret = Deno.env.get('SLACK_SIGNING_SECRET');

/**
 * Verify Slack request signature
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
async function verifySlackRequest(
  body: string,
  timestamp: string,
  signature: string
): Promise<boolean> {
  if (!slackSigningSecret) {
    // Allow opting into insecure mode for local development only.
    const allowInsecure = (Deno.env.get('ALLOW_INSECURE_SLACK_SIGNATURES') || '').toLowerCase() === 'true';
    if (allowInsecure) {
      console.warn('ALLOW_INSECURE_SLACK_SIGNATURES=true - skipping signature verification');
      return true;
    }
    console.error('SLACK_SIGNING_SECRET not set - refusing request');
    return false;
  }

  // Check timestamp to prevent replay attacks (within 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
    console.error('Request timestamp too old');
    return false;
  }

  // Create signature base string
  const sigBasestring = `v0:${timestamp}:${body}`;

  // Create HMAC SHA256 signature
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(slackSigningSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(sigBasestring)
  );

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(signatureBytes));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const computedSignature = `v0=${hashHex}`;

  return computedSignature === signature;
}

/**
 * Handle Slack URL verification challenge
 */
function handleUrlVerification(payload: { challenge: string }) {
  console.log('Handling URL verification challenge');
  return new Response(
    JSON.stringify({ challenge: payload.challenge }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Handle incoming Slack events
 */
async function handleEvent(
  supabase: ReturnType<typeof createClient>,
  event: {
    type: string;
    user?: string;
    channel?: string;
    text?: string;
    ts?: string;
    [key: string]: unknown;
  },
  teamId: string
) {
  console.log(`Processing event type: ${event.type}`, { teamId });

  switch (event.type) {
    case 'app_home_opened':
      // User opened the app home tab
      console.log('App home opened by user:', event.user);
      // Future: Show personalized dashboard in app home
      break;

    case 'member_joined_channel':
      // Bot was added to a channel
      console.log('Member joined channel:', event.channel);
      break;

    case 'channel_archive':
      // A channel was archived - update our deal rooms if applicable
      if (event.channel) {
        const { error } = await supabase
          .from('slack_deal_rooms')
          .update({ is_archived: true, archived_at: new Date().toISOString() })
          .eq('slack_channel_id', event.channel);

        if (error) {
          console.error('Error updating deal room archive status:', error);
        }
      }
      break;

    case 'channel_unarchive':
      // A channel was unarchived
      if (event.channel) {
        const { error } = await supabase
          .from('slack_deal_rooms')
          .update({ is_archived: false, archived_at: null })
          .eq('slack_channel_id', event.channel);

        if (error) {
          console.error('Error updating deal room unarchive status:', error);
        }
      }
      break;

    case 'team_join':
      // A new user joined the workspace - try to auto-map them
      if (event.user && typeof event.user === 'object') {
        const user = event.user as {
          id: string;
          name?: string;
          real_name?: string;
          profile?: {
            email?: string;
            display_name?: string;
            image_72?: string;
          };
        };

        // Find orgs connected to this workspace
        const { data: orgSettings } = await supabase
          .from('slack_org_settings')
          .select('org_id')
          .eq('slack_team_id', teamId)
          .eq('is_connected', true);

        if (orgSettings && orgSettings.length > 0) {
          for (const org of orgSettings) {
            // Try to auto-match by email
            if (user.profile?.email) {
              const { data: sixtyUser } = await supabase
                .from('profiles')
                .select('id, email')
                .eq('email', user.profile.email)
                .single();

              await supabase.from('slack_user_mappings').upsert({
                org_id: org.org_id,
                slack_user_id: user.id,
                slack_username: user.name,
                slack_display_name: user.profile?.display_name || user.real_name,
                slack_email: user.profile?.email,
                slack_avatar_url: user.profile?.image_72,
                sixty_user_id: sixtyUser?.id || null,
                is_auto_matched: !!sixtyUser,
              }, {
                onConflict: 'org_id,slack_user_id',
              });
            }
          }
        }
      }
      break;

    case 'user_change':
      // A user's profile was updated - update our mapping
      if (event.user && typeof event.user === 'object') {
        const user = event.user as {
          id: string;
          name?: string;
          real_name?: string;
          profile?: {
            email?: string;
            display_name?: string;
            image_72?: string;
          };
        };

        const { error } = await supabase
          .from('slack_user_mappings')
          .update({
            slack_username: user.name,
            slack_display_name: user.profile?.display_name || user.real_name,
            slack_email: user.profile?.email,
            slack_avatar_url: user.profile?.image_72,
          })
          .eq('slack_user_id', user.id);

        if (error) {
          console.error('Error updating user mapping:', error);
        }
      }
      break;

    case 'message':
      // A message was posted - we might handle slash command responses here
      // For now, just log
      console.log('Message event received in channel:', event.channel);
      break;

    case 'reaction_added':
      // A reaction was added - potential future feature for task completion
      console.log('Reaction added:', {
        reaction: (event as { reaction?: string }).reaction,
        user: event.user,
        item: (event as { item?: unknown }).item,
      });
      break;

    default:
      console.log('Unhandled event type:', event.type);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();

    // Verify Slack signature
    const timestamp = req.headers.get('x-slack-request-timestamp') || '';
    const signature = req.headers.get('x-slack-signature') || '';

    if (!await verifySlackRequest(body, timestamp, signature)) {
      console.error('Invalid Slack signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = JSON.parse(body);
    console.log('Received Slack event:', { type: payload.type });

    // Handle URL verification (required by Slack when setting up Events API)
    if (payload.type === 'url_verification') {
      return handleUrlVerification(payload);
    }

    // Initialize Supabase client for all other operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle event callbacks
    if (payload.type === 'event_callback') {
      const { event, team_id } = payload;

      if (!event) {
        return new Response(
          JSON.stringify({ error: 'No event in payload' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Respond immediately to Slack (they expect response within 3 seconds)
      // Process event asynchronously
      const responsePromise = handleEvent(supabase, event, team_id);

      // Don't await - respond immediately
      responsePromise.catch((err) => {
        console.error('Error processing event:', err);
      });

      return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Unknown payload type
    console.warn('Unknown payload type:', payload.type);
    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing Slack event:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
