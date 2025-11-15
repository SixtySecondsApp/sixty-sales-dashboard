import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Helper function to get CORS headers with dynamic origin
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin');
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://sales.sixtyseconds.video'
  ];
  
  const isAllowed = origin && allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'http://localhost:5173',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
}

serve(async (req) => {
  // Get CORS headers
  const corsHeaders = getCorsHeaders(req);
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });
  }

  try {
    // Get the authorization header - this is an authenticated endpoint
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Get the request body
    const { code, state } = await req.json();
    
    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Verify the JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid authentication token');
    }
    // Retrieve the state and PKCE verifier from database
    const { data: oauthState, error: stateError } = await supabase
      .from('google_oauth_states')
      .select('user_id, code_verifier, redirect_uri')
      .eq('state', state)
      .eq('user_id', user.id) // Ensure the state belongs to this user
      .single();

    if (stateError || !oauthState) {
      throw new Error('Invalid or expired state parameter');
    }
    // Exchange authorization code for tokens
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID') || '';
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
    const redirectUri = oauthState.redirect_uri;

    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const tokenParams = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: oauthState.code_verifier,
    });
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || 'Failed to exchange authorization code');
    }
    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const userInfo = await userInfoResponse.json();
    // Calculate token expiration
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    // Store or update the Google integration
    const { data: existingIntegration } = await supabase
      .from('google_integrations')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let integrationResult;
    
    if (existingIntegration) {
      // Update existing integration
      integrationResult = await supabase
        .from('google_integrations')
        .update({
          email: userInfo.email,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          expires_at: expiresAt.toISOString(),
          scopes: tokenData.scope || '',
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingIntegration.id)
        .select()
        .single();
    } else {
      // Create new integration
      integrationResult = await supabase
        .from('google_integrations')
        .insert({
          user_id: user.id,
          email: userInfo.email,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          expires_at: expiresAt.toISOString(),
          scopes: tokenData.scope || '',
          is_active: true,
        })
        .select()
        .single();
    }

    if (integrationResult.error) {
      throw new Error('Failed to save Google integration');
    }
    // Clean up the OAuth state
    await supabase
      .from('google_oauth_states')
      .delete()
      .eq('state', state);

    // Log the successful integration
    await supabase
      .from('google_service_logs')
      .insert({
        integration_id: integrationResult.data.id,
        service: 'oauth',
        action: 'connect',
        status: 'success',
        request_data: { email: userInfo.email },
        response_data: { scopes: tokenData.scope },
      });
    return new Response(
      JSON.stringify({
        success: true,
        email: userInfo.email,
        integration_id: integrationResult.data.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});