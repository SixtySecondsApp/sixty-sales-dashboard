import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface ListFilesRequest {
  folderId?: string;
  query?: string;
  maxResults?: number;
  pageToken?: string;
}

interface CreateFolderRequest {
  name: string;
  parentId?: string;
}

interface UploadFileRequest {
  name: string;
  parentId?: string;
  content: string; // Base64 encoded content
  mimeType: string;
}

interface ShareFileRequest {
  fileId: string;
  email?: string;
  role: 'reader' | 'writer' | 'commenter';
  type: 'user' | 'anyone';
}

serve(async (req) => {
  console.log('[Google Drive] Request method:', req.method);
  console.log('[Google Drive] Request URL:', req.url);
  
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
      console.error('[Google Drive] User verification failed:', userError);
      throw new Error('Invalid authentication token');
    }

    console.log('[Google Drive] User verified:', user.id);

    // Get user's Google integration
    const { data: integration, error: integrationError } = await supabase
      .from('google_integrations')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      console.error('[Google Drive] No active Google integration found:', integrationError);
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
      case 'list-files':
        response = await listFiles(integration.access_token, requestBody as ListFilesRequest);
        break;
      
      case 'create-folder':
        response = await createFolder(integration.access_token, requestBody as CreateFolderRequest);
        break;
      
      case 'upload-file':
        response = await uploadFile(integration.access_token, requestBody as UploadFileRequest);
        break;
      
      case 'share-file':
        response = await shareFile(integration.access_token, requestBody as ShareFileRequest);
        break;
      
      case 'get-file':
        response = await getFile(integration.access_token, requestBody.fileId);
        break;
      
      case 'delete-file':
        response = await deleteFile(integration.access_token, requestBody.fileId);
        break;
      
      case 'search':
        response = await searchFiles(integration.access_token, requestBody.query, requestBody.maxResults);
        break;
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Log the successful operation
    await supabase
      .from('google_service_logs')
      .insert({
        integration_id: null, // We'd need to get this from the integration
        service: 'drive',
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
    console.error('[Google Drive] Error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: 'Drive service error'
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

async function listFiles(accessToken: string, request: ListFilesRequest): Promise<any> {
  console.log('[Google Drive] Listing files');

  const params = new URLSearchParams();
  
  if (request.folderId) {
    params.set('q', `'${request.folderId}' in parents and trashed=false`);
  } else if (request.query) {
    params.set('q', request.query);
  } else {
    params.set('q', 'trashed=false');
  }
  
  if (request.maxResults) params.set('pageSize', request.maxResults.toString());
  if (request.pageToken) params.set('pageToken', request.pageToken);
  
  // Include common fields
  params.set('fields', 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink, iconLink, thumbnailLink)');

  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Google Drive] List files error:', errorData);
    throw new Error(`Drive API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  console.log('[Google Drive] Found', data.files?.length || 0, 'files');
  
  return {
    files: data.files || [],
    nextPageToken: data.nextPageToken
  };
}

async function createFolder(accessToken: string, request: CreateFolderRequest): Promise<any> {
  console.log('[Google Drive] Creating folder:', request.name);

  const folderData = {
    name: request.name,
    mimeType: 'application/vnd.google-apps.folder',
    ...(request.parentId && { parents: [request.parentId] })
  };

  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(folderData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Google Drive] Create folder error:', errorData);
    throw new Error(`Drive API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  console.log('[Google Drive] Folder created successfully:', data.id);
  
  return {
    success: true,
    folderId: data.id,
    name: data.name,
    webViewLink: data.webViewLink
  };
}

async function uploadFile(accessToken: string, request: UploadFileRequest): Promise<any> {
  console.log('[Google Drive] Uploading file:', request.name);

  // First, create the file metadata
  const metadata = {
    name: request.name,
    ...(request.parentId && { parents: [request.parentId] })
  };

  // Use multipart upload for files with content
  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  let body = delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) + delimiter +
    'Content-Type: ' + request.mimeType + '\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    request.content +
    close_delim;

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body: body,
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Google Drive] Upload file error:', errorData);
    throw new Error(`Drive API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  console.log('[Google Drive] File uploaded successfully:', data.id);
  
  return {
    success: true,
    fileId: data.id,
    name: data.name,
    webViewLink: data.webViewLink,
    webContentLink: data.webContentLink
  };
}

async function shareFile(accessToken: string, request: ShareFileRequest): Promise<any> {
  console.log('[Google Drive] Sharing file:', request.fileId);

  const permissionData = {
    role: request.role,
    type: request.type,
    ...(request.email && { emailAddress: request.email })
  };

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${request.fileId}/permissions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(permissionData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Google Drive] Share file error:', errorData);
    throw new Error(`Drive API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  console.log('[Google Drive] File shared successfully:', data.id);
  
  return {
    success: true,
    permissionId: data.id,
    role: data.role,
    type: data.type
  };
}

async function getFile(accessToken: string, fileId: string): Promise<any> {
  console.log('[Google Drive] Getting file:', fileId);

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,modifiedTime,webViewLink,webContentLink,iconLink,thumbnailLink,description`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Google Drive] Get file error:', errorData);
    throw new Error(`Drive API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  console.log('[Google Drive] File retrieved successfully:', data.name);
  
  return data;
}

async function deleteFile(accessToken: string, fileId: string): Promise<any> {
  console.log('[Google Drive] Deleting file:', fileId);

  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Google Drive] Delete file error:', errorData);
    throw new Error(`Drive API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  console.log('[Google Drive] File deleted successfully');
  
  return {
    success: true,
    deleted: true
  };
}

async function searchFiles(accessToken: string, query: string, maxResults: number = 10): Promise<any> {
  console.log('[Google Drive] Searching files:', query);

  const params = new URLSearchParams();
  params.set('q', `name contains '${query}' and trashed=false`);
  params.set('pageSize', maxResults.toString());
  params.set('fields', 'files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink, iconLink, thumbnailLink)');

  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Google Drive] Search files error:', errorData);
    throw new Error(`Drive API error: ${errorData.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  console.log('[Google Drive] Found', data.files?.length || 0, 'files matching search');
  
  return {
    files: data.files || []
  };
}