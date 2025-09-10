import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface SendEmailRequest {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
}

interface ListEmailsRequest {
  query?: string;
  maxResults?: number;
  pageToken?: string;
}

serve(async (req) => {
  console.log('[Google Gmail] Request method:', req.method);
  console.log('[Google Gmail] Request URL:', req.url);
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
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

    // Initialize Supabase client
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
      console.error('[Google Gmail] User verification failed:', userError);
      throw new Error('Invalid authentication token');
    }

    console.log('[Google Gmail] User verified:', user.id);

    // Get user's Google integration
    const { data: integration, error: integrationError } = await supabase
      .from('google_integrations')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.error('[Google Gmail] No active Google integration found:', integrationError);
      throw new Error('Google integration not found. Please connect your Google account first.');
    }

    // Check if token needs refresh
    const expiresAt = new Date(integration.expires_at);
    const now = new Date();
    if (expiresAt <= now) {
      // TODO: Implement token refresh logic
      throw new Error('Access token expired. Token refresh not yet implemented.');
    }

    // Parse request based on method and URL
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    let requestBody: any = {};
    if (req.method === 'POST') {
      requestBody = await req.json();
    }

    let response;

    switch (action) {
      case 'send':
        response = await sendEmail(integration.access_token, requestBody as SendEmailRequest);
        break;
      
      case 'list':
        response = await listEmails(integration.access_token, requestBody as ListEmailsRequest);
        break;
      
      case 'labels':
        response = await getLabels(integration.access_token);
        break;
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Log the successful operation
    await supabase
      .from('google_service_logs')
      .insert({
        integration_id: null, // We'd need to get this from the integration
        service: 'gmail',
        action: action || 'unknown',
        status: 'success',
        request_data: requestBody,
        response_data: { success: true },
      });

    return new Response(
      JSON.stringify(response),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );

  } catch (error) {
    console.error('[Google Gmail] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: 'Gmail service error'
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

async function sendEmail(accessToken: string, request: SendEmailRequest): Promise<any> {
  console.log('[Google Gmail] Sending email to:', request.to);

  // Create the email message in RFC 2822 format
  const emailLines = [
    `To: ${request.to}`,
    `Subject: ${request.subject}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    request.body
  ];
  
  const emailMessage = emailLines.join('\r\n');
  
  // Base64 encode the message (URL-safe)
  const encodedMessage = btoa(emailMessage)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: encodedMessage
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Google Gmail] Send email error:', errorData);
    throw new Error(`Gmail API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  console.log('[Google Gmail] Email sent successfully:', data.id);
  
  return {
    success: true,
    messageId: data.id,
    threadId: data.threadId
  };
}

async function listEmails(accessToken: string, request: ListEmailsRequest): Promise<any> {
  console.log('[Google Gmail] Listing emails with query:', request.query);

  const params = new URLSearchParams();
  if (request.query) params.set('q', request.query);
  if (request.maxResults) params.set('maxResults', request.maxResults.toString());
  if (request.pageToken) params.set('pageToken', request.pageToken);

  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Google Gmail] List emails error:', errorData);
    throw new Error(`Gmail API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  console.log('[Google Gmail] Found', data.messages?.length || 0, 'emails');
  
  return {
    messages: data.messages || [],
    nextPageToken: data.nextPageToken,
    resultSizeEstimate: data.resultSizeEstimate
  };
}

async function getLabels(accessToken: string): Promise<any> {
  console.log('[Google Gmail] Fetching labels');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Google Gmail] Get labels error:', errorData);
    throw new Error(`Gmail API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  console.log('[Google Gmail] Found', data.labels?.length || 0, 'labels');
  
  return {
    labels: data.labels || []
  };
}