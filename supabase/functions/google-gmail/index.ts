import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { 
  modifyEmail,
  archiveEmail,
  trashEmail,
  starEmail,
  markAsRead,
  getFullLabel,
  replyToEmail,
  forwardEmail
} from './gmail-actions.ts';

async function refreshAccessToken(refreshToken: string, supabase: any, userId: string): Promise<string> {
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
    throw new Error('Failed to update access token in database');
  }
  return data.access_token;
}

// Import shared CORS headers for consistency
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset'
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

interface GetMessageRequest {
  messageId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }

  // Parse request based on method and URL (outside try block for error handling)
  const url = new URL(req.url);
  let action = url.searchParams.get('action');
  let requestBody: any = {};

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
      throw new Error('Invalid authentication token');
    }
    // Get user's Google integration
    const { data: integration, error: integrationError } = await supabase
      .from('google_integrations')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      throw new Error('Google integration not found. Please connect your Google account first.');
    }

    // Check if token needs refresh
    const expiresAt = new Date(integration.expires_at);
    const now = new Date();
    let accessToken = integration.access_token;
    
    if (expiresAt <= now) {
      accessToken = await refreshAccessToken(integration.refresh_token, supabase, user.id);
    }

    // Support action from both URL params and request body
    if (req.method === 'POST') {
      try {
        requestBody = await req.json();
        // If action not in URL, get it from body
        if (!action && requestBody.action) {
          action = requestBody.action;
        }
      } catch (parseError) {
        throw new Error('Invalid JSON in request body');
      }
    }

    let response;

    switch (action) {
      case 'send':
        response = await sendEmail(accessToken, requestBody as SendEmailRequest);
        break;
      
      case 'list':
        response = await listEmails(accessToken, requestBody as ListEmailsRequest);
        break;
      
      case 'get':
      case 'get-message':
        if (!requestBody.messageId) {
          throw new Error('messageId is required for get action');
        }
        response = await getMessage(accessToken, requestBody as GetMessageRequest);
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
        if (!requestBody.messageId) {
          throw new Error('messageId is required for archive action');
        }
        response = await archiveEmail(accessToken, requestBody.messageId);
        break;
      
      case 'delete':
        if (!requestBody.messageId) {
          throw new Error('messageId is required for delete action');
        }
        response = await trashEmail(accessToken, requestBody.messageId);
        break;
      
      case 'trash':
        // Keep for backward compatibility
        if (!requestBody.messageId) {
          throw new Error('messageId is required for trash action');
        }
        response = await trashEmail(accessToken, requestBody.messageId);
        break;
      
      case 'star':
        if (!requestBody.messageId) {
          throw new Error('messageId is required for star action');
        }
        if (typeof requestBody.starred !== 'boolean') {
          throw new Error('starred must be a boolean for star action');
        }
        response = await starEmail(accessToken, requestBody.messageId, requestBody.starred);
        break;
      
      case 'mark-as-read':
        if (!requestBody.messageId || typeof requestBody.messageId !== 'string' || requestBody.messageId.trim() === '') {
          throw new Error('messageId is required and must be a non-empty string for mark-as-read action');
        }
        if (typeof requestBody.read !== 'boolean') {
          throw new Error('read must be a boolean for mark-as-read action');
        }
        response = await markAsRead(accessToken, requestBody.messageId.trim(), requestBody.read);
        break;
      
      case 'markAsRead':
        // Keep for backward compatibility
        if (!requestBody.messageId || typeof requestBody.messageId !== 'string' || requestBody.messageId.trim() === '') {
          throw new Error('messageId is required and must be a non-empty string for markAsRead action');
        }
        if (typeof requestBody.read !== 'boolean') {
          throw new Error('read must be a boolean for markAsRead action');
        }
        response = await markAsRead(accessToken, requestBody.messageId.trim(), requestBody.read);
        break;
      
      case 'reply':
        if (!requestBody.messageId) {
          throw new Error('messageId is required for reply action');
        }
        if (!requestBody.body) {
          throw new Error('body is required for reply action');
        }
        response = await replyToEmail(
          accessToken,
          requestBody.messageId,
          requestBody.body,
          requestBody.replyAll || false,
          requestBody.isHtml || false
        );
        break;
      
      case 'forward':
        if (!requestBody.messageId) {
          throw new Error('messageId is required for forward action');
        }
        if (!requestBody.to || !Array.isArray(requestBody.to) || requestBody.to.length === 0) {
          throw new Error('to (array of recipients) is required for forward action');
        }
        response = await forwardEmail(
          accessToken,
          requestBody.messageId,
          requestBody.to,
          requestBody.additionalMessage
        );
        break;
      
      case 'sync':
        response = await syncEmailsToContacts(accessToken, supabase, user.id, integration.id);
        break;
      
      default:
        // If no action specified, default to list for backward compatibility
        if (!action) {
          response = await listEmails(accessToken, requestBody as ListEmailsRequest);
        } else {
          throw new Error(`Unknown action: ${action}`);
        }
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
    // Log error details for debugging
    console.error('[google-gmail] Error:', {
      message: error?.message || 'Unknown error',
      stack: error?.stack,
      action: action || url.searchParams.get('action') || 'unknown',
      requestBody: req.method === 'POST' ? requestBody : null,
      url: req.url
    });
    
    return new Response(
      JSON.stringify({ 
        error: error?.message || 'Internal server error',
        details: 'Gmail service error',
        action: action || url.searchParams.get('action') || 'unknown'
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
    throw new Error(`Gmail API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  return {
    success: true,
    messageId: data.id,
    threadId: data.threadId
  };
}

async function listEmails(accessToken: string, request: ListEmailsRequest): Promise<any> {
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
    throw new Error(`Gmail API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const listData = await listResponse.json();
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
        return msg; // Return the basic message if fetch fails
      }
      
      const fullMessage = await messageResponse.json();
      return fullMessage;
    } catch (error) {
      return msg; // Return the basic message if error occurs
    }
  });
  
  const fullMessages = await Promise.all(messagePromises);
  return {
    messages: fullMessages,
    nextPageToken: listData.nextPageToken,
    resultSizeEstimate: listData.resultSizeEstimate
  };
}

async function getLabels(accessToken: string): Promise<any> {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Gmail API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  // Fetch full details for each label to get colors and other metadata
  const labelPromises = data.labels?.map(async (label: any) => {
    try {
      const fullLabel = await getFullLabel(accessToken, label.id);
      return fullLabel;
    } catch (error) {
      return label; // Return basic label if fetch fails
    }
  }) || [];
  
  const fullLabels = await Promise.all(labelPromises);
  
  return {
    labels: fullLabels
  };
}

async function syncEmailsToContacts(
  accessToken: string, 
  supabase: any, 
  userId: string, 
  integrationId: string
): Promise<any> {
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
    return {
      success: true,
      syncedCount,
      totalMessages: messages.length,
      hasMore: !!data.nextPageToken,
    };
  } catch (error) {
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

function extractBody(payload: any): { text: string; html?: string } {
  if (!payload) return { text: '' };
  
  let textBody = '';
  let htmlBody = '';
  
  // Helper to decode base64
  const decodeBase64 = (data: string) => {
    try {
      return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    } catch {
      return '';
    }
  };
  
  // Helper to recursively extract from parts
  const extractFromParts = (parts: any[]) => {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        textBody = decodeBase64(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        htmlBody = decodeBase64(part.body.data);
      } else if (part.parts) {
        extractFromParts(part.parts);
      }
    }
  };
  
  // Check if payload has parts
  if (payload.parts) {
    extractFromParts(payload.parts);
  } else if (payload.mimeType === 'text/plain' && payload.body?.data) {
    textBody = decodeBase64(payload.body.data);
  } else if (payload.mimeType === 'text/html' && payload.body?.data) {
    htmlBody = decodeBase64(payload.body.data);
  }
  
  return {
    text: textBody || (htmlBody ? stripHtml(htmlBody) : ''),
    html: htmlBody || undefined
  };
}

function stripHtml(html: string): string {
  // Simple HTML stripping - remove tags and decode entities
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function getMessage(accessToken: string, request: GetMessageRequest): Promise<any> {
  if (!request.messageId) {
    throw new Error('messageId is required');
  }
  
  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${request.messageId}?format=full`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`Gmail API error: ${errorMessage}`);
    }

    const message = await response.json();
  
  // Extract headers
  const headers = message.payload?.headers || [];
  const fromHeader = headers.find((h: any) => h.name?.toLowerCase() === 'from')?.value || '';
  const subject = headers.find((h: any) => h.name?.toLowerCase() === 'subject')?.value || '(No Subject)';
  const dateHeader = headers.find((h: any) => h.name?.toLowerCase() === 'date')?.value || '';
  const toHeader = headers.find((h: any) => h.name?.toLowerCase() === 'to')?.value || '';
  const ccHeader = headers.find((h: any) => h.name?.toLowerCase() === 'cc')?.value || '';
  const replyToHeader = headers.find((h: any) => h.name?.toLowerCase() === 'reply-to')?.value || '';
  
  // Parse sender
  const fromMatch = fromHeader.match(/^(.+?)\s*<(.+)>$/);
  const fromName = fromMatch ? fromMatch[1].replace(/"/g, '') : fromHeader.split('@')[0];
  const fromEmail = fromMatch ? fromMatch[2] : fromHeader;
  
  // Extract body
  const bodyData = extractBody(message.payload);
  
  // Parse date
  let timestamp = new Date();
  if (dateHeader) {
    const parsedDate = new Date(dateHeader);
    if (!isNaN(parsedDate.getTime())) {
      timestamp = parsedDate;
    }
  } else if (message.internalDate) {
    timestamp = new Date(parseInt(message.internalDate));
  }
  
  // Extract attachments
  const attachments: any[] = [];
  const extractAttachments = (parts: any[]) => {
    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          id: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size || 0
        });
      }
      if (part.parts) {
        extractAttachments(part.parts);
      }
    }
  };
  
  if (message.payload?.parts) {
    extractAttachments(message.payload.parts);
  }
  
  return {
    id: message.id,
    threadId: message.threadId,
    from: fromEmail,
    fromName,
    subject,
    body: bodyData.text,
    bodyHtml: bodyData.html,
    timestamp: timestamp.toISOString(),
    read: !message.labelIds?.includes('UNREAD'),
    starred: message.labelIds?.includes('STARRED'),
    labels: message.labelIds || [],
    to: toHeader,
    cc: ccHeader,
    replyTo: replyToHeader || fromEmail,
    attachments,
    snippet: message.snippet || ''
  };
  } catch (error: any) {
    console.error('[getMessage] Error:', error);
    throw error instanceof Error ? error : new Error(`Failed to get message: ${error?.message || 'Unknown error'}`);
  }
}