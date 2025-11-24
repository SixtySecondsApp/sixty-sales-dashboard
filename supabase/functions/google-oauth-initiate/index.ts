import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Helper function to get CORS headers with dynamic origin
function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin');
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5175',
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

// Helper function to generate PKCE challenge
async function generatePKCEChallenge() {
  const codeVerifier = crypto.randomUUID() + crypto.randomUUID(); // 72 chars
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  return { codeVerifier, codeChallenge };
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
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Get request body to extract redirect URI
    let requestOrigin: string | undefined;
    try {
      const requestBody = await req.json();
      requestOrigin = requestBody.origin;
    } catch (error) {
      // If JSON parsing fails, continue without origin
    }
    
    // Dynamically determine redirect URI based on request origin
    let redirectUri: string;
    if (requestOrigin) {
      redirectUri = `${requestOrigin}/auth/google/callback`;
    } else {
      // Fallback to environment variable or localhost
      redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI') || 'http://localhost:5173/auth/google/callback';
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
    // Generate PKCE parameters
    const { codeVerifier, codeChallenge } = await generatePKCEChallenge();
    
    // Generate a secure random state
    const state = crypto.randomUUID();
    
    // Store the state and PKCE verifier in the database with dynamic redirect URI
    const { error: stateError } = await supabase
      .from('google_oauth_states')
      .insert({
        user_id: user.id,
        state: state,
        code_verifier: codeVerifier,
        code_challenge: codeChallenge,
        redirect_uri: redirectUri,
      });

    if (stateError) {
      throw new Error('Failed to initialize OAuth flow');
    }

    // Get Google OAuth configuration
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    
    if (!clientId) {
      throw new Error('Google OAuth not configured');
    }

    // Define the scopes we need
    const scopes = [
      // Google Docs
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.file',
      
      // Google Drive
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
      
      // Gmail
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.labels',
      
      // Google Calendar
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      
      // Google Tasks
      'https://www.googleapis.com/auth/tasks',
      
      // User info
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    // Build the authorization URL
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'offline'); // To get refresh token
    authUrl.searchParams.set('prompt', 'consent'); // Force consent to get refresh token
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    return new Response(
      JSON.stringify({ 
        authUrl: authUrl.toString(),
        state: state 
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error' 
      }),
      {
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );
  }
});