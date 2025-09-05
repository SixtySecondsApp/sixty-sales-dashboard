import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!authHeader) {
      throw new Error('No authorization provided');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user's JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { 
      channel,
      message,
      blocks,
      attachments,
      team_id 
    } = await req.json();

    if (!channel || !message) {
      throw new Error('Channel and message are required');
    }

    // Get the user's Slack integration
    let { data: integration, error: integrationError } = await supabase
      .from('slack_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('team_id', team_id || '')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      // If no team_id provided, try to get the first active integration
      const { data: firstIntegration, error: firstError } = await supabase
        .from('slack_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (firstError || !firstIntegration) {
        throw new Error('No active Slack integration found. Please connect Slack first.');
      }

      integration = firstIntegration;
    }

    // Prepare the Slack message
    const slackMessage: any = {
      channel: channel,
      text: message,
    };

    if (blocks) {
      slackMessage.blocks = blocks;
    }

    if (attachments) {
      slackMessage.attachments = attachments;
    }

    // Send message to Slack using Web API
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackMessage),
    });

    const slackData = await slackResponse.json();

    if (!slackData.ok) {
      // Handle specific Slack errors
      if (slackData.error === 'not_in_channel') {
        // Try to join the channel first
        const joinResponse = await fetch('https://slack.com/api/conversations.join', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ channel }),
        });

        const joinData = await joinResponse.json();
        
        if (joinData.ok) {
          // Retry sending the message
          const retryResponse = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${integration.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(slackMessage),
          });

          const retryData = await retryResponse.json();
          
          if (!retryData.ok) {
            throw new Error(`Slack API error: ${retryData.error}`);
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Message sent after joining channel',
              ts: retryData.ts,
              channel: retryData.channel 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
      }

      throw new Error(`Slack API error: ${slackData.error}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Message sent to Slack',
        ts: slackData.ts,
        channel: slackData.channel 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error sending Slack message:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});