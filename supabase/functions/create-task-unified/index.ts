import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Unified Task Creation from Action Items
 *
 * Purpose: Single edge function for both automatic and manual task creation
 * Modes:
 *   - auto: Tasks created based on user's importance preferences
 *   - manual: Tasks created from user-selected action items (bulk support)
 *
 * Features:
 *   - Importance-based filtering (High/Medium/Low)
 *   - Bulk task creation
 *   - Bidirectional sync (task ↔ action item)
 *   - Fixed assignment logic (no mis-assignments)
 *   - Stale deadline detection and recalculation
 */

interface CreateTaskRequest {
  mode: 'auto' | 'manual'
  action_item_ids: string[]
  source: 'ai_suggestion' | 'action_item'
}

interface CreateTaskResponse {
  success: boolean
  tasks_created: number
  tasks: any[]
  errors?: Array<{ action_item_id: string, error: string }>
}

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
    const { mode, action_item_ids, source } = await req.json() as CreateTaskRequest

    if (!action_item_ids || action_item_ids.length === 0) {
      throw new Error('action_item_ids is required')
    }

    if (!mode || !['auto', 'manual'].includes(mode)) {
      throw new Error('mode must be "auto" or "manual"')
    }

    if (!source || !['ai_suggestion', 'action_item'].includes(source)) {
      throw new Error('source must be "ai_suggestion" or "action_item"')
    }

    console.log(`[create-task-unified] Processing ${action_item_ids.length} items in ${mode} mode from ${source}`)

    // Get user's auto-sync preferences (for auto mode)
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('preferences')
      .eq('user_id', user.id)
      .single()

    const autoSyncPrefs = userSettings?.preferences?.task_auto_sync || {
      enabled: false,
      importance_levels: ['high'],
      confidence_threshold: 0.8
    }

    console.log(`[create-task-unified] User auto-sync preferences:`, autoSyncPrefs)

    // Get action items from appropriate table
    const tableName = source === 'ai_suggestion' ? 'next_action_suggestions' : 'meeting_action_items'

    const { data: actionItems, error: fetchError } = await supabase
      .from(tableName)
      .select(`
        *,
        meeting:meetings(
          id,
          title,
          company_id,
          primary_contact_id,
          owner_user_id,
          meeting_start
        )
      `)
      .in('id', action_item_ids)

    if (fetchError) {
      console.error(`[create-task-unified] Error fetching action items:`, fetchError)
      throw new Error(`Action items not found: ${fetchError.message}`)
    }

    if (!actionItems || actionItems.length === 0) {
      console.warn(`[create-task-unified] No action items found for IDs:`, action_item_ids)
      return new Response(
        JSON.stringify({
          success: true,
          tasks_created: 0,
          tasks: [],
          errors: []
        } as CreateTaskResponse),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const tasksCreated: any[] = []
    const errors: Array<{ action_item_id: string, error: string }> = []

    // Process each action item
    for (const actionItem of actionItems) {
      try {
        console.log(`[create-task-unified] Processing action item ${actionItem.id} (importance: ${actionItem.importance})`)

        // MODE-SPECIFIC LOGIC
        if (mode === 'auto') {
          // Auto mode: Check if importance matches user preferences
          if (!autoSyncPrefs.enabled) {
            console.log(`[create-task-unified] Skipping ${actionItem.id} - auto-sync disabled`)
            continue
          }

          if (!autoSyncPrefs.importance_levels.includes(actionItem.importance)) {
            console.log(`[create-task-unified] Skipping ${actionItem.id} - importance ${actionItem.importance} not in ${autoSyncPrefs.importance_levels}`)
            continue
          }

          // Check confidence threshold (if applicable)
          if (actionItem.confidence_score && actionItem.confidence_score < autoSyncPrefs.confidence_threshold) {
            console.log(`[create-task-unified] Skipping ${actionItem.id} - confidence ${actionItem.confidence_score} below threshold ${autoSyncPrefs.confidence_threshold}`)
            continue
          }
        }
        // Manual mode: No filtering, user explicitly selected these items
        console.log(`[create-task-unified] ${mode} mode - proceeding with task creation for ${actionItem.id}`)

        // Check if task already exists (prevent duplicates)
        // Use different query based on source type
        let existingTask = null
        if (source === 'ai_suggestion') {
          // For AI suggestions, check metadata->>'suggestion_id'
          const { data } = await supabase
            .from('tasks')
            .select('id')
            .eq('source', 'ai_suggestion')
            .contains('metadata', { suggestion_id: actionItem.id })
            .maybeSingle()
          existingTask = data
        } else {
          // For meeting action items, check meeting_action_item_id FK
          const { data } = await supabase
            .from('tasks')
            .select('id')
            .eq('meeting_action_item_id', actionItem.id)
            .maybeSingle()
          existingTask = data
        }

        if (existingTask) {
          console.log(`[create-task-unified] Task already exists for action item ${actionItem.id}`)
          continue
        }

        // Determine assignee with strict validation
        let assignedTo: string | null = null

        if (actionItem.assignee_email) {
          // Try exact match first
          const { data: exactMatch } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', actionItem.assignee_email)
            .maybeSingle()

          if (exactMatch) {
            assignedTo = exactMatch.id
            console.log(`[create-task-unified] Found exact match for ${actionItem.assignee_email}`)
          } else {
            // Try fuzzy match (case-insensitive, trim whitespace)
            const cleanEmail = actionItem.assignee_email.toLowerCase().trim()
            const { data: fuzzyMatch } = await supabase
              .from('profiles')
              .select('id, email')
              .ilike('email', cleanEmail)
              .maybeSingle()

            if (fuzzyMatch) {
              assignedTo = fuzzyMatch.id
              console.log(`[create-task-unified] Found fuzzy match for ${cleanEmail}`)
            }
          }
        }

        // Fallback to meeting owner (NOT current user!)
        if (!assignedTo && actionItem.meeting?.owner_user_id) {
          assignedTo = actionItem.meeting.owner_user_id
          console.log(`[create-task-unified] Falling back to meeting owner: ${assignedTo}`)
        }

        // If still no valid assignee, REFUSE to create task
        if (!assignedTo) {
          const error = `Cannot assign task - assignee not found in system (${actionItem.assignee_email || 'no email'})`
          console.warn(`[create-task-unified] ${error}`)
          errors.push({
            action_item_id: actionItem.id,
            error
          })
          continue
        }

        // Calculate due date with stale deadline detection
        let dueDate = null
        const now = new Date()

        if (actionItem.due_date || actionItem.deadline_at) {
          const proposedDueDate = new Date(actionItem.due_date || actionItem.deadline_at)
          const meetingDate = actionItem.meeting?.meeting_start ? new Date(actionItem.meeting.meeting_start) : null

          // Check if this is a stale deadline (meeting >30 days old AND due date is in the past)
          const meetingAge = meetingDate ? (now.getTime() - meetingDate.getTime()) / (1000 * 60 * 60 * 24) : 0
          const isStaleDeadline = meetingAge > 30 && proposedDueDate < now

          if (isStaleDeadline) {
            // Stale deadline detected - recalculate relative to today
            const originalOffset = meetingDate ? (proposedDueDate.getTime() - meetingDate.getTime()) / (1000 * 60 * 60 * 24) : 3
            const adjustedOffset = Math.max(1, Math.min(30, Math.round(originalOffset)))
            const newDueDate = new Date()
            newDueDate.setDate(newDueDate.getDate() + adjustedOffset)
            dueDate = newDueDate.toISOString()
            console.log(`[create-task-unified] Stale deadline detected - adjusted from ${proposedDueDate.toISOString()} to ${dueDate}`)
          } else {
            dueDate = actionItem.due_date || actionItem.deadline_at
          }
        } else {
          // No due date provided - default to 3 days from now
          const threeDays = new Date()
          threeDays.setDate(threeDays.getDate() + 3)
          dueDate = threeDays.toISOString()
          console.log(`[create-task-unified] No deadline provided - defaulting to 3 days: ${dueDate}`)
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

        // Create the task with appropriate forward link based on source type
        // IMPORTANT: Two different linking patterns:
        // 1. AI suggestions: Link via metadata->>'suggestion_id' (no FK constraint)
        // 2. Meeting action items: Link via meeting_action_item_id FK
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
            created_by: user.id,
            company_id: actionItem.meeting?.company_id,
            contact_id: actionItem.meeting?.primary_contact_id,
            meeting_id: actionItem.meeting_id,
            // Only set FK for meeting action items (not AI suggestions)
            meeting_action_item_id: source === 'action_item' ? actionItem.id : null,
            source: source === 'ai_suggestion' ? 'ai_suggestion' : 'fathom_action_item',
            importance: actionItem.importance,  // Store importance
            metadata: {
              action_item_id: actionItem.id,
              suggestion_id: source === 'ai_suggestion' ? actionItem.id : null,
              fathom_meeting_id: actionItem.meeting_id,
              confidence_score: actionItem.confidence_score,
              recording_timestamp: actionItem.recording_timestamp,
              recording_playback_url: actionItem.recording_playback_url
            }
          })
          .select()
          .single()

        if (taskError) {
          console.error(`[create-task-unified] Failed to create task for ${actionItem.id}:`, taskError)
          errors.push({
            action_item_id: actionItem.id,
            error: `Failed to create task: ${taskError.message}`
          })
          continue
        }

        console.log(`[create-task-unified] Created task ${newTask.id} for action item ${actionItem.id}`)

        // Update action item with linked_task_id and sync status
        const { error: updateError } = await supabase
          .from(tableName)
          .update({
            linked_task_id: newTask.id,
            synced_to_task: true,
            sync_status: 'synced',
            updated_at: new Date().toISOString()
          })
          .eq('id', actionItem.id)

        if (updateError) {
          console.error(`[create-task-unified] Failed to update action item ${actionItem.id}:`, updateError)
          // Don't fail the request - task was created successfully
        } else {
          console.log(`[create-task-unified] Updated action item ${actionItem.id} with linked_task_id`)
        }

        tasksCreated.push(newTask)

      } catch (itemError) {
        console.error(`[create-task-unified] Error processing action item ${actionItem.id}:`, itemError)
        errors.push({
          action_item_id: actionItem.id,
          error: itemError instanceof Error ? itemError.message : 'Unknown error'
        })
      }
    }

    console.log(`[create-task-unified] Completed: Created ${tasksCreated.length} tasks, ${errors.length} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        tasks_created: tasksCreated.length,
        tasks: tasksCreated,
        errors: errors.length > 0 ? errors : undefined
      } as CreateTaskResponse),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error(`[create-task-unified] Fatal error:`, error)
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
