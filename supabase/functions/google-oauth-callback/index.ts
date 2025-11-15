import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // This endpoint handles the OAuth callback from Google, which comes as a GET request
  // It doesn't require authentication because Google is redirecting the user here
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    // Handle OAuth errors
    if (error) {
      const errorDescription = url.searchParams.get('error_description');
      // Redirect to app with error
      const redirectUrl = new URL(Deno.env.get('FRONTEND_URL') || 'http://localhost:5173');
      redirectUrl.pathname = '/integrations';
      redirectUrl.searchParams.set('error', error);
      if (errorDescription) {
        redirectUrl.searchParams.set('error_description', errorDescription);
      }
      
      return Response.redirect(redirectUrl.toString(), 302);
    }

    if (!code || !state) {
      throw new Error('Missing authorization code or state');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Retrieve the state and PKCE verifier from database
    const { data: oauthState, error: stateError } = await supabase
      .from('google_oauth_states')
      .select('user_id, code_verifier, redirect_uri')
      .eq('state', state)
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

    // Store the tokens in the database (encrypted in production)
    const { error: insertError } = await supabase
      .from('google_integrations')
      .upsert({
        user_id: oauthState.user_id,
        email: userInfo.email,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
        scopes: tokenData.scope,
        is_active: true,
      }, {
        onConflict: 'user_id,email',
      });

    if (insertError) {
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
        integration_id: null, // Will be set once we retrieve the integration ID
        service: 'oauth',
        action: 'connect',
        status: 'success',
        request_data: { email: userInfo.email },
        response_data: { scopes: tokenData.scope },
      });

    // Redirect back to the app with success
    const redirectUrl = new URL(Deno.env.get('FRONTEND_URL') || 'http://localhost:5173');
    redirectUrl.pathname = '/integrations';
    redirectUrl.searchParams.set('status', 'connected');
    redirectUrl.searchParams.set('email', userInfo.email);
    
    return Response.redirect(redirectUrl.toString(), 302);
  } catch (error) {
    // Redirect to app with error
    const redirectUrl = new URL(Deno.env.get('FRONTEND_URL') || 'http://localhost:5173');
    redirectUrl.pathname = '/integrations';
    redirectUrl.searchParams.set('error', 'callback_failed');
    redirectUrl.searchParams.set('error_description', error.message);
    
    return Response.redirect(redirectUrl.toString(), 302);
  }
});