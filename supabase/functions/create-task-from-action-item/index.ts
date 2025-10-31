import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Manual Task Creation from Action Item
 *
 * Purpose: Creates a task from a meeting action item when user clicks "Create Task" button
 * This replaces the automatic trigger with manual user control
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Parse request body
    const { action_item_id } = await req.json()

    if (!action_item_id) {
      throw new Error('action_item_id is required')
    }

    console.log(`📋 Creating task for action item: ${action_item_id}`)

    // Get the action item
    const { data: actionItem, error: fetchError } = await supabase
      .from('meeting_action_items')
      .select(`
        *,
        meeting:meetings(
          id,
          title,
          company_id,
          primary_contact_id,
          owner_user_id
        )
      `)
      .eq('id', action_item_id)
      .single()

    if (fetchError || !actionItem) {
      throw new Error(`Action item not found: ${fetchError?.message}`)
    }

    // Check if task already exists
    if (actionItem.task_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Task already exists for this action item',
          task_id: actionItem.task_id
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Determine assignee
    let assignedTo = user.id // Default to current user

    if (actionItem.assignee_email) {
      // Try to find user by email
      const { data: assigneeUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', actionItem.assignee_email)
        .single()

      if (assigneeUser) {
        assignedTo = assigneeUser.id
      }
    }

    // Calculate due date
    let dueDate = null
    if (actionItem.due_date) {
      dueDate = actionItem.due_date
    } else {
      // Default to 3 days from now
      const threeDays = new Date()
      threeDays.setDate(threeDays.getDate() + 3)
      dueDate = threeDays.toISOString()
    }

    // Map category to task_type
    const taskTypeMapping: Record<string, string> = {
      'follow_up': 'follow_up',
      'follow-up': 'follow_up',
      'proposal': 'proposal',
      'demo': 'demo',
      'meeting': 'meeting',
      'research': 'research',
      'internal': 'internal'
    }
    const taskType = taskTypeMapping[actionItem.category?.toLowerCase() || ''] || 'follow_up'

    // Create the task
    const { data: newTask, error: taskError } = await supabase
      .from('tasks')
      .insert({
        title: actionItem.title || actionItem.description,
        description: `Action item from meeting: ${actionItem.meeting?.title}\n\n${actionItem.description || ''}`,
        due_date: dueDate,
        priority: actionItem.priority || 'medium',
        status: actionItem.completed ? 'completed' : 'pending',
        task_type: taskType,
        assigned_to: assignedTo,
        user_id: user.id,
        company_id: actionItem.meeting?.company_id,
        contact_id: actionItem.meeting?.primary_contact_id,
        meeting_id: actionItem.meeting_id,
        source: 'fathom_action_item',
        metadata: {
          action_item_id: actionItem.id,
          fathom_meeting_id: actionItem.meeting_id,
          recording_timestamp: actionItem.recording_timestamp,
          recording_playback_url: actionItem.recording_playback_url
        }
      })
      .select()
      .single()

    if (taskError) {
      console.error('❌ Task creation error:', taskError)
      throw new Error(`Failed to create task: ${taskError.message}`)
    }

    console.log(`✅ Task created: ${newTask.id}`)

    // Update action item with task_id and sync status
    const { error: updateError } = await supabase
      .from('meeting_action_items')
      .update({
        task_id: newTask.id,
        synced_to_task: true,
        sync_status: 'synced',
        updated_at: new Date().toISOString()
      })
      .eq('id', action_item_id)

    if (updateError) {
      console.warn('⚠️ Failed to update action item:', updateError)
      // Don't fail the request - task was created successfully
    }

    return new Response(
      JSON.stringify({
        success: true,
        task: newTask,
        message: 'Task created successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('❌ Error:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
