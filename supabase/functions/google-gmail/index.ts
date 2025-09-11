import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  modifyEmail,
  archiveEmail,
  trashEmail,
  starEmail,
  markAsRead,
  getFullLabel
} from './gmail-actions.ts';

async function refreshAccessToken(refreshToken: string, supabase: any, userId: string): Promise<string> {
  console.log('[Google Gmail] Refreshing access token...');
  
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID') || '';
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Google Gmail] Token refresh failed:', errorData);
    throw new Error(`Failed to refresh token: ${errorData.error_description || 'Unknown error'}`);
  }

  const data = await response.json();
  
  // Update the stored access token
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (data.expires_in || 3600));
  
  const { error: updateError } = await supabase
    .from('google_integrations')
    .update({
      access_token: data.access_token,
      expires_at: expiresAt.toISOString(),
    })
    .eq('user_id', userId);
  
  if (updateError) {
    console.error('[Google Gmail] Failed to update access token:', updateError);
    throw new Error('Failed to update access token in database');
  }
  
  console.log('[Google Gmail] Access token refreshed successfully');
  return data.access_token;
}

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
    let accessToken = integration.access_token;
    
    if (expiresAt <= now) {
      console.log('[Google Gmail] Token expired, refreshing...');
      accessToken = await refreshAccessToken(integration.refresh_token, supabase, user.id);
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
        response = await sendEmail(accessToken, requestBody as SendEmailRequest);
        break;
      
      case 'list':
        response = await listEmails(accessToken, requestBody as ListEmailsRequest);
        break;
      
      case 'list-labels':
        response = await getLabels(accessToken);
        break;
      
      case 'labels':
        response = await getLabels(accessToken);
        break;
      
      case 'modify':
        response = await modifyEmail(accessToken, requestBody);
        break;
      
      case 'archive':
        response = await archiveEmail(accessToken, requestBody.messageId);
        break;
      
      case 'delete':
        response = await trashEmail(accessToken, requestBody.messageId);
        break;
      
      case 'trash':
        // Keep for backward compatibility
        response = await trashEmail(accessToken, requestBody.messageId);
        break;
      
      case 'star':
        response = await starEmail(accessToken, requestBody.messageId, requestBody.starred);
        break;
      
      case 'mark-as-read':
        response = await markAsRead(accessToken, requestBody.messageId, requestBody.read);
        break;
      
      case 'markAsRead':
        // Keep for backward compatibility
        response = await markAsRead(accessToken, requestBody.messageId, requestBody.read);
        break;
      
      case 'sync':
        response = await syncEmailsToContacts(accessToken, supabase, user.id, integration.id);
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

  // First, get the list of message IDs
  const listResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!listResponse.ok) {
    const errorData = await listResponse.json();
    console.error('[Google Gmail] List emails error:', errorData);
    throw new Error(`Gmail API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const listData = await listResponse.json();
  console.log('[Google Gmail] Found', listData.messages?.length || 0, 'email IDs');
  
  // If no messages, return empty array
  if (!listData.messages || listData.messages.length === 0) {
    return {
      messages: [],
      nextPageToken: listData.nextPageToken,
      resultSizeEstimate: listData.resultSizeEstimate
    };
  }
  
  // Now fetch full details for each message (limit to first 10 for performance)
  const messagePromises = listData.messages.slice(0, 10).map(async (msg: any) => {
    try {
      const messageResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      
      if (!messageResponse.ok) {
        console.error(`[Google Gmail] Failed to fetch message ${msg.id}`);
        return msg; // Return the basic message if fetch fails
      }
      
      const fullMessage = await messageResponse.json();
      return fullMessage;
    } catch (error) {
      console.error(`[Google Gmail] Error fetching message ${msg.id}:`, error);
      return msg; // Return the basic message if error occurs
    }
  });
  
  const fullMessages = await Promise.all(messagePromises);
  console.log('[Google Gmail] Fetched full details for', fullMessages.length, 'messages');
  
  return {
    messages: fullMessages,
    nextPageToken: listData.nextPageToken,
    resultSizeEstimate: listData.resultSizeEstimate
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
  
  // Fetch full details for each label to get colors and other metadata
  const labelPromises = data.labels?.map(async (label: any) => {
    try {
      const fullLabel = await getFullLabel(accessToken, label.id);
      return fullLabel;
    } catch (error) {
      console.error(`Failed to fetch label ${label.id}:`, error);
      return label; // Return basic label if fetch fails
    }
  }) || [];
  
  const fullLabels = await Promise.all(labelPromises);
  
  return {
    labels: fullLabels
  };
}

async function refreshAccessToken(refreshToken: string, supabase: any, userId: string): Promise<string> {
  console.log('[Google Gmail] Refreshing access token...');
  
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID') || '';
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Google Gmail] Token refresh error:', errorData);
    throw new Error('Failed to refresh access token');
  }

  const data = await response.json();
  const newAccessToken = data.access_token;
  const expiresIn = data.expires_in || 3600;
  
  // Update the integration with new token
  const expiresAt = new Date(Date.now() + (expiresIn * 1000));
  await supabase
    .from('google_integrations')
    .update({
      access_token: newAccessToken,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
  
  console.log('[Google Gmail] Access token refreshed successfully');
  return newAccessToken;
}

async function syncEmailsToContacts(
  accessToken: string, 
  supabase: any, 
  userId: string, 
  integrationId: string
): Promise<any> {
  console.log('[Google Gmail] Syncing emails to contacts...');
  
  try {
    // Get or create sync status
    let { data: syncStatus, error: statusError } = await supabase
      .from('email_sync_status')
      .select('*')
      .eq('integration_id', integrationId)
      .single();
    
    if (statusError || !syncStatus) {
      // Create new sync status
      const { data: newStatus, error: createError } = await supabase
        .from('email_sync_status')
        .insert({
          integration_id: integrationId,
          sync_enabled: true,
          sync_interval_minutes: 15,
          sync_direction: 'both',
        })
        .select()
        .single();
      
      if (createError) {
        console.error('[Google Gmail] Failed to create sync status:', createError);
        throw new Error('Failed to initialize sync status');
      }
      
      syncStatus = newStatus;
    }
    
    // Get user's contacts
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, email')
      .eq('owner_id', userId);
    
    if (contactsError || !contacts || contacts.length === 0) {
      console.log('[Google Gmail] No contacts found for user');
      return {
        success: true,
        message: 'No contacts to sync',
        syncedCount: 0,
      };
    }
    
    // Build email search query
    const emailAddresses = contacts.map(c => c.email).filter(Boolean);
    const query = emailAddresses.map(email => `from:${email} OR to:${email}`).join(' OR ');
    
    // Fetch emails from Gmail
    const params = new URLSearchParams({
      q: query,
      maxResults: '50', // Limit for initial sync
    });
    
    if (syncStatus.next_page_token) {
      params.set('pageToken', syncStatus.next_page_token);
    }
    
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
    const messages = data.messages || [];
    let syncedCount = 0;
    
    // Process each message
    for (const message of messages.slice(0, 10)) { // Limit to 10 for now
      try {
        // Get full message details
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );
        
        if (!msgResponse.ok) continue;
        
        const msgData = await msgResponse.json();
        
        // Extract email details
        const headers = msgData.payload?.headers || [];
        const fromHeader = headers.find((h: any) => h.name === 'From');
        const toHeader = headers.find((h: any) => h.name === 'To');
        const subjectHeader = headers.find((h: any) => h.name === 'Subject');
        const dateHeader = headers.find((h: any) => h.name === 'Date');
        
        if (!fromHeader || !toHeader) continue;
        
        // Parse email addresses
        const fromEmail = extractEmail(fromHeader.value);
        const toEmails = extractEmails(toHeader.value);
        
        // Determine direction and find matching contact
        let contactId = null;
        let direction = 'inbound';
        
        // Check if from email matches a contact
        const fromContact = contacts.find(c => c.email?.toLowerCase() === fromEmail.toLowerCase());
        if (fromContact) {
          contactId = fromContact.id;
          direction = 'inbound';
        } else {
          // Check if any to email matches a contact
          for (const toEmail of toEmails) {
            const toContact = contacts.find(c => c.email?.toLowerCase() === toEmail.toLowerCase());
            if (toContact) {
              contactId = toContact.id;
              direction = 'outbound';
              break;
            }
          }
        }
        
        if (!contactId) continue;
        
        // Extract body
        const body = extractBody(msgData.payload);
        
        // Store in database
        const { error: insertError } = await supabase
          .from('contact_emails')
          .upsert({
            contact_id: contactId,
            integration_id: integrationId,
            gmail_message_id: message.id,
            gmail_thread_id: message.threadId || '',
            subject: subjectHeader?.value || '',
            snippet: msgData.snippet || '',
            from_email: fromEmail,
            from_name: extractName(fromHeader.value),
            to_emails: toEmails,
            body_plain: body,
            sent_at: dateHeader ? new Date(dateHeader.value).toISOString() : new Date().toISOString(),
            direction,
            labels: msgData.labelIds || [],
          }, {
            onConflict: 'gmail_message_id',
          });
        
        if (!insertError) {
          syncedCount++;
        }
      } catch (err) {
        console.error(`[Google Gmail] Error processing message ${message.id}:`, err);
      }
    }
    
    // Update sync status
    await supabase
      .from('email_sync_status')
      .update({
        last_sync_at: new Date().toISOString(),
        next_page_token: data.nextPageToken || null,
        total_emails_synced: (syncStatus.total_emails_synced || 0) + syncedCount,
        updated_at: new Date().toISOString(),
      })
      .eq('integration_id', integrationId);
    
    console.log(`[Google Gmail] Synced ${syncedCount} emails`);
    
    return {
      success: true,
      syncedCount,
      totalMessages: messages.length,
      hasMore: !!data.nextPageToken,
    };
  } catch (error) {
    console.error('[Google Gmail] Sync error:', error);
    
    // Update sync status with error
    await supabase
      .from('email_sync_status')
      .update({
        last_error: error.message,
        last_error_at: new Date().toISOString(),
        consecutive_errors: supabase.sql`consecutive_errors + 1`,
        updated_at: new Date().toISOString(),
      })
      .eq('integration_id', integrationId);
    
    throw error;
  }
}

// Helper functions
function extractEmail(emailString: string): string {
  const match = emailString.match(/<(.+)>/);
  return match ? match[1] : emailString.trim();
}

function extractEmails(emailString: string): string[] {
  return emailString.split(',').map(e => extractEmail(e.trim()));
}

function extractName(emailString: string): string {
  const match = emailString.match(/^(.+) </);
  return match ? match[1].trim() : '';
}

function extractBody(payload: any): string {
  if (!payload) return '';
  
  // Try to find plain text part
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      }
    }
  }
  
  // Fallback to body data if no parts
  if (payload.body?.data) {
    return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
  }
  
  return '';
}