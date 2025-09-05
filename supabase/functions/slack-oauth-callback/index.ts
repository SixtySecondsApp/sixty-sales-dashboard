import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  console.log('[Slack OAuth] Request method:', req.method);
  console.log('[Slack OAuth] Request URL:', req.url);
  console.log('[Slack OAuth] Headers:', Object.fromEntries(req.headers.entries()));
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  // For OAuth callbacks, we don't need JWT verification
  // Slack will call this directly without any auth headers
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // Contains user_id
    
    console.log('[Slack OAuth] Received code:', code ? 'present' : 'missing');
    console.log('[Slack OAuth] Received state:', state ? 'present' : 'missing');
    
    if (!code) {
      throw new Error('No authorization code provided');
    }

    // Exchange code for access token
    const clientId = Deno.env.get('SLACK_CLIENT_ID') || '';
    const clientSecret = Deno.env.get('SLACK_CLIENT_SECRET') || '';
    
    console.log('[Slack OAuth] Client ID configured:', clientId ? 'yes' : 'no');
    console.log('[Slack OAuth] Client Secret configured:', clientSecret ? 'yes' : 'no');
    
    const slackResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/slack-oauth-callback',
      }),
    });

    const slackData = await slackResponse.json();

    if (!slackData.ok) {
      throw new Error(`Slack OAuth failed: ${slackData.error}`);
    }

    // Initialize Supabase client
    // Use the built-in Supabase environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://ewtuefzeogytgmsnkpmb.supabase.co';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse state to get user_id
    let userId;
    try {
      const stateData = JSON.parse(atob(state || ''));
      userId = stateData.user_id;
    } catch (e) {
      throw new Error('Invalid state parameter');
    }

    // Log the Slack data for debugging
    console.log('[Slack OAuth] Slack data received:', {
      team_id: slackData.team?.id,
      team_name: slackData.team?.name,
      bot_user_id: slackData.bot_user_id,
      app_id: slackData.app_id,
      has_access_token: !!slackData.access_token,
      scope: slackData.scope,
    });

    // Store the access token in database
    const { data: integration, error: dbError } = await supabase
      .from('slack_integrations')
      .upsert({
        user_id: userId,
        team_id: slackData.team?.id || slackData.team_id,
        team_name: slackData.team?.name || slackData.team_name || 'Unknown Team',
        access_token: slackData.access_token,
        bot_user_id: slackData.bot_user_id || '',
        app_id: slackData.app_id || '',
        authed_user: slackData.authed_user || {},
        scope: slackData.scope || '',
        token_type: 'bot',
        is_active: true,
      }, {
        onConflict: 'user_id,team_id',
      })
      .select()
      .single();

    if (dbError) {
      console.error('[Slack OAuth] Database error details:', dbError);
      const errorMessage = dbError.message || JSON.stringify(dbError);
      throw new Error(`Database error: ${errorMessage}`);
    }

    // Fetch and cache available channels
    const channelsResponse = await fetch('https://slack.com/api/conversations.list', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${slackData.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    const channelsData = await channelsResponse.json();

    if (channelsData.ok && channelsData.channels) {
      // Store channels in database
      const channelsToInsert = channelsData.channels.map((channel: any) => ({
        integration_id: integration.id,
        channel_id: channel.id,
        channel_name: channel.name,
        is_private: channel.is_private || false,
        is_member: channel.is_member || false,
        is_archived: channel.is_archived || false,
      }));

      await supabase
        .from('slack_channels')
        .upsert(channelsToInsert, {
          onConflict: 'integration_id,channel_id',
        });
    }

    // Redirect back to the app with success
    const redirectUrl = `${Deno.env.get('PUBLIC_URL')}/workflows?slack_connected=true`;
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl,
        ...corsHeaders,
      },
    });

  } catch (error) {
    console.error('Slack OAuth error:', error);
    
    // Redirect with error
    const redirectUrl = `${Deno.env.get('PUBLIC_URL')}/workflows?slack_error=${encodeURIComponent(error.message)}`;
    
    return new Response(null, {
      status: 302,
      headers: {
        'Location': redirectUrl,
        ...corsHeaders,
      },
    });
  }
});