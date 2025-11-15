import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PATCH, DELETE',
};

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

interface ListTaskListsRequest {
  maxResults?: number;
}

interface ListTasksRequest {
  taskListId?: string;
  maxResults?: number;
  showCompleted?: boolean;
  showDeleted?: boolean;
  showHidden?: boolean;
  updatedMin?: string; // RFC3339 timestamp for incremental sync
}

interface CreateTaskRequest {
  taskListId?: string;
  title: string;
  notes?: string;
  due?: string; // RFC3339 date
  status?: 'needsAction' | 'completed';
  position?: string;
}

interface UpdateTaskRequest {
  taskListId: string;
  taskId: string;
  title?: string;
  notes?: string;
  due?: string;
  status?: 'needsAction' | 'completed';
  position?: string;
}

interface DeleteTaskRequest {
  taskListId: string;
  taskId: string;
}

interface SyncTasksRequest {
  lastSyncTime?: string; // ISO timestamp for incremental sync
  taskListId?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Extract action from URL or body
    const url = new URL(req.url);
    let action = url.searchParams.get('action');
    
    // If no action in URL and it's a POST request, check the body
    if (!action && req.method === 'POST') {
      const body = await req.clone().json();
      action = body.action;
    }
    // Get authorization header
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

    // Verify user and get Google integration
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid authentication token');
    }
    // Get Google integration
    const { data: integration, error: integrationError } = await supabase
      .from('google_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (integrationError || !integration) {
      throw new Error('Google integration not found. Please connect your Google account first.');
    }

    // Check if token needs refresh
    let accessToken = integration.access_token;
    const expiresAt = new Date(integration.expires_at);
    const now = new Date();
    
    if (now >= expiresAt) {
      accessToken = await refreshAccessToken(integration.refresh_token, supabase, user.id);
    }

    let result;

    switch (action) {
      case 'list-tasklists': {
        const params = req.method === 'POST' ? await req.json() as ListTaskListsRequest : {};
        
        const queryParams = new URLSearchParams();
        if (params.maxResults) queryParams.set('maxResults', params.maxResults.toString());
        
        const response = await fetch(
          `https://tasks.googleapis.com/tasks/v1/users/@me/lists?${queryParams}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Failed to list task lists');
        }

        result = await response.json();
        break;
      }

      case 'list-tasks': {
        const params = req.method === 'POST' ? await req.json() as ListTasksRequest : {};
        const taskListId = params.taskListId || '@default';
        
        const queryParams = new URLSearchParams();
        if (params.maxResults) queryParams.set('maxResults', params.maxResults.toString());
        if (params.showCompleted !== undefined) queryParams.set('showCompleted', params.showCompleted.toString());
        if (params.showDeleted !== undefined) queryParams.set('showDeleted', params.showDeleted.toString());
        if (params.showHidden !== undefined) queryParams.set('showHidden', params.showHidden.toString());
        if (params.updatedMin) queryParams.set('updatedMin', params.updatedMin);
        
        const response = await fetch(
          `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks?${queryParams}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Failed to list tasks');
        }

        result = await response.json();
        break;
      }

      case 'create-task': {
        if (req.method !== 'POST') {
          throw new Error('Method not allowed');
        }

        const params = await req.json() as CreateTaskRequest;
        const taskListId = params.taskListId || '@default';
        
        // Log the exact parameters being used
        const taskData: any = {
          title: params.title,
        };
        
        if (params.notes) taskData.notes = params.notes;
        if (params.due) taskData.due = params.due;
        if (params.status) taskData.status = params.status;
        
        const queryParams = new URLSearchParams();
        if (params.position) queryParams.set('position', params.position);
        
        const url = `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks?${queryParams}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(taskData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Failed to create task');
        }

        result = await response.json();
        break;
      }

      case 'update-task': {
        if (req.method !== 'POST' && req.method !== 'PATCH') {
          throw new Error('Method not allowed');
        }

        const params = await req.json() as UpdateTaskRequest;
        const { taskListId, taskId, ...updateData } = params;
        
        const taskData: any = {};
        if (updateData.title !== undefined) taskData.title = updateData.title;
        if (updateData.notes !== undefined) taskData.notes = updateData.notes;
        if (updateData.due !== undefined) taskData.due = updateData.due;
        if (updateData.status !== undefined) taskData.status = updateData.status;
        
        const response = await fetch(
          `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(taskData),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Failed to update task');
        }

        result = await response.json();
        break;
      }

      case 'delete-task': {
        if (req.method !== 'POST' && req.method !== 'DELETE') {
          throw new Error('Method not allowed');
        }

        const params = await req.json() as DeleteTaskRequest;
        const { taskListId, taskId } = params;
        
        const response = await fetch(
          `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${taskId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok && response.status !== 204) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Failed to delete task');
        }

        result = { success: true };
        break;
      }

      case 'create-tasklist': {
        if (req.method !== 'POST') {
          throw new Error('Method not allowed');
        }

        const params = await req.json();
        const { title } = params;
        
        if (!title) {
          throw new Error('Task list title is required');
        }
        
        const response = await fetch(
          'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Failed to create task list');
        }

        result = await response.json();
        break;
      }

      case 'sync-tasks': {
        // This is a higher-level operation that performs incremental sync
        const params = req.method === 'POST' ? await req.json() as SyncTasksRequest : {};
        const taskListId = params.taskListId || '@default';
        
        // Get all tasks updated since last sync
        const queryParams = new URLSearchParams();
        queryParams.set('showCompleted', 'true');
        queryParams.set('showHidden', 'false');
        queryParams.set('maxResults', '100');
        
        if (params.lastSyncTime) {
          // Convert ISO timestamp to RFC3339
          const lastSync = new Date(params.lastSyncTime);
          queryParams.set('updatedMin', lastSync.toISOString());
        }
        
        const response = await fetch(
          `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks?${queryParams}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Failed to sync tasks');
        }

        const tasks = await response.json();
        
        // Also get the task lists for complete sync
        const listsResponse = await fetch(
          'https://tasks.googleapis.com/tasks/v1/users/@me/lists',
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (!listsResponse.ok) {
          const error = await listsResponse.json();
          throw new Error(error.error?.message || 'Failed to get task lists');
        }

        const lists = await listsResponse.json();
        
        result = {
          tasks: tasks.items || [],
          lists: lists.items || [],
          syncTime: new Date().toISOString(),
        };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
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