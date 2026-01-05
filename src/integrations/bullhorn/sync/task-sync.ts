/**
 * Bullhorn Task Sync Service
 *
 * Handles bi-directional synchronization between use60 tasks and
 * Bullhorn Task entities. Manages action item push and completion sync.
 */

import { supabase } from '@/lib/supabase/clientV2';
import {
  mapTaskToBullhornTask,
  mapBullhornTaskToTask,
  mapTaskStatusToBullhorn,
  mapBullhornStatusToTask,
  calculateTaskMatchScore,
  TASK_STATUS,
} from '../api/tasks';
import type { BullhornTask } from '../types/bullhorn';

// =============================================================================
// Types
// =============================================================================

export interface TaskSyncResult {
  success: boolean;
  taskId?: string;
  bullhornId?: number;
  action: 'created' | 'updated' | 'matched' | 'skipped' | 'error';
  error?: string;
}

export interface TaskMatchResult {
  matched: boolean;
  bullhornTaskId?: number;
  matchScore: number;
  matchedFields: string[];
}

// =============================================================================
// Task Sync Functions
// =============================================================================

/**
 * Sync a Bullhorn Task to use60 task
 */
export async function syncBullhornTaskToTask(
  orgId: string,
  bullhornTask: BullhornTask,
  options: {
    createIfNotExists?: boolean;
    updateIfExists?: boolean;
    forceUpdate?: boolean;
  } = {}
): Promise<TaskSyncResult> {
  const { createIfNotExists = true, updateIfExists = true, forceUpdate = false } = options;

  try {
    // Check for existing mapping
    const { data: existingMapping } = await supabase
      .from('bullhorn_object_mappings')
      .select('use60_id, use60_last_modified, bullhorn_last_modified')
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'Task')
      .eq('bullhorn_entity_id', bullhornTask.id)
      .maybeSingle();

    if (existingMapping?.use60_id) {
      // Check for conflict (use60 was modified more recently)
      if (!forceUpdate && updateIfExists) {
        const use60LastMod = existingMapping.use60_last_modified
          ? new Date(existingMapping.use60_last_modified).getTime()
          : 0;
        const bullhornLastMod = bullhornTask.dateLastModified || 0;

        if (use60LastMod > bullhornLastMod) {
          return {
            success: true,
            taskId: existingMapping.use60_id,
            bullhornId: bullhornTask.id,
            action: 'skipped',
          };
        }
      }

      // Update existing task
      const taskData = mapBullhornTaskToTask(bullhornTask);
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          title: taskData.title,
          description: taskData.description,
          due_date: taskData.due_date,
          completed: taskData.completed,
          priority: taskData.priority,
          metadata: taskData.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingMapping.use60_id);

      if (updateError) {
        throw new Error(`Failed to update task: ${updateError.message}`);
      }

      // Update mapping timestamp
      await supabase
        .from('bullhorn_object_mappings')
        .update({
          last_synced_at: new Date().toISOString(),
          bullhorn_last_modified: bullhornTask.dateLastModified,
        })
        .eq('org_id', orgId)
        .eq('bullhorn_entity_id', bullhornTask.id);

      return {
        success: true,
        taskId: existingMapping.use60_id,
        bullhornId: bullhornTask.id,
        action: 'updated',
      };
    }

    // Try to match by external ID (use60 task ID stored in customText1)
    if (bullhornTask.customText1) {
      const { data: existingTask } = await supabase
        .from('tasks')
        .select('id')
        .eq('org_id', orgId)
        .eq('id', bullhornTask.customText1)
        .maybeSingle();

      if (existingTask) {
        // Create mapping for matched task
        await supabase.from('bullhorn_object_mappings').insert({
          org_id: orgId,
          bullhorn_entity_type: 'Task',
          bullhorn_entity_id: bullhornTask.id,
          use60_table: 'tasks',
          use60_id: existingTask.id,
          sync_direction: 'bullhorn_to_use60',
          last_synced_at: new Date().toISOString(),
          bullhorn_last_modified: bullhornTask.dateLastModified,
        });

        // Update task metadata
        const taskData = mapBullhornTaskToTask(bullhornTask);
        await supabase
          .from('tasks')
          .update({
            external_id: taskData.external_id,
            metadata: taskData.metadata,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingTask.id);

        return {
          success: true,
          taskId: existingTask.id,
          bullhornId: bullhornTask.id,
          action: 'matched',
        };
      }
    }

    // Create new task if allowed
    if (!createIfNotExists) {
      return {
        success: true,
        bullhornId: bullhornTask.id,
        action: 'skipped',
      };
    }

    const taskData = mapBullhornTaskToTask(bullhornTask);
    const { data: newTask, error: insertError } = await supabase
      .from('tasks')
      .insert({
        org_id: orgId,
        title: taskData.title,
        description: taskData.description,
        due_date: taskData.due_date,
        completed: taskData.completed,
        priority: taskData.priority,
        source: taskData.source,
        external_id: taskData.external_id,
        metadata: taskData.metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to create task: ${insertError.message}`);
    }

    // Create mapping
    await supabase.from('bullhorn_object_mappings').insert({
      org_id: orgId,
      bullhorn_entity_type: 'Task',
      bullhorn_entity_id: bullhornTask.id,
      use60_table: 'tasks',
      use60_id: newTask.id,
      sync_direction: 'bullhorn_to_use60',
      last_synced_at: new Date().toISOString(),
      bullhorn_last_modified: bullhornTask.dateLastModified,
    });

    return {
      success: true,
      taskId: newTask.id,
      bullhornId: bullhornTask.id,
      action: 'created',
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('[task-sync] syncBullhornTaskToTask error:', error);
    return {
      success: false,
      bullhornId: bullhornTask.id,
      action: 'error',
      error,
    };
  }
}

/**
 * Prepare use60 task data for Bullhorn sync
 */
export function prepareTaskForBullhornSync(
  task: {
    id: string;
    title: string;
    description?: string;
    due_date?: string;
    completed?: boolean;
    priority?: string;
    contact_id?: string;
    deal_id?: string;
    metadata?: Record<string, unknown>;
  },
  entityAssociations?: {
    candidateId?: number;
    clientContactId?: number;
    jobOrderId?: number;
    placementId?: number;
    ownerId?: number;
  }
): {
  type: string;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  dateEnd?: number;
  isCompleted: boolean;
  externalID: string;
  customText1: string;
  candidate?: { id: number };
  clientContact?: { id: number };
  jobOrder?: { id: number };
  placement?: { id: number };
  owner?: { id: number };
} {
  const bullhornData = mapTaskToBullhornTask(task);

  // Add entity associations if provided
  if (entityAssociations) {
    if (entityAssociations.candidateId) {
      (bullhornData as Record<string, unknown>).candidate = { id: entityAssociations.candidateId };
    }
    if (entityAssociations.clientContactId) {
      (bullhornData as Record<string, unknown>).clientContact = {
        id: entityAssociations.clientContactId,
      };
    }
    if (entityAssociations.jobOrderId) {
      (bullhornData as Record<string, unknown>).jobOrder = { id: entityAssociations.jobOrderId };
    }
    if (entityAssociations.placementId) {
      (bullhornData as Record<string, unknown>).placement = { id: entityAssociations.placementId };
    }
    if (entityAssociations.ownerId) {
      (bullhornData as Record<string, unknown>).owner = { id: entityAssociations.ownerId };
    }
  }

  return bullhornData as ReturnType<typeof prepareTaskForBullhornSync>;
}

/**
 * Batch sync multiple Bullhorn tasks
 */
export async function batchSyncBullhornTasksToTasks(
  orgId: string,
  bullhornTasks: BullhornTask[],
  options: {
    createIfNotExists?: boolean;
    updateIfExists?: boolean;
  } = {}
): Promise<TaskSyncResult[]> {
  const results: TaskSyncResult[] = [];

  for (const task of bullhornTasks) {
    const result = await syncBullhornTaskToTask(orgId, task, options);
    results.push(result);
  }

  return results;
}

// =============================================================================
// Completion Sync
// =============================================================================

/**
 * Sync task completion status to Bullhorn
 */
export async function syncTaskCompletionToBullhorn(
  orgId: string,
  taskId: string,
  completed: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get Bullhorn mapping
    const { data: mapping } = await supabase
      .from('bullhorn_object_mappings')
      .select('bullhorn_entity_id')
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'Task')
      .eq('use60_id', taskId)
      .maybeSingle();

    if (!mapping) {
      return { success: true }; // No mapping, nothing to sync
    }

    // Return Bullhorn update payload
    // Actual API call should be made by the caller with BullhornClient
    return {
      success: true,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('[task-sync] syncTaskCompletionToBullhorn error:', error);
    return { success: false, error };
  }
}

/**
 * Get task update payload for completion sync
 */
export function getTaskCompletionPayload(completed: boolean): {
  isCompleted: boolean;
  status: string;
} {
  return {
    isCompleted: completed,
    status: completed ? TASK_STATUS.COMPLETED : TASK_STATUS.NOT_STARTED,
  };
}

// =============================================================================
// Webhook Handlers
// =============================================================================

/**
 * Handle Task created webhook event
 */
export async function handleTaskCreated(
  orgId: string,
  bullhornTask: BullhornTask
): Promise<TaskSyncResult> {
  return syncBullhornTaskToTask(orgId, bullhornTask, {
    createIfNotExists: true,
    updateIfExists: false,
  });
}

/**
 * Handle Task updated webhook event
 */
export async function handleTaskUpdated(
  orgId: string,
  bullhornTask: BullhornTask
): Promise<TaskSyncResult> {
  return syncBullhornTaskToTask(orgId, bullhornTask, {
    createIfNotExists: true,
    updateIfExists: true,
  });
}

/**
 * Handle Task deleted webhook event
 */
export async function handleTaskDeleted(
  orgId: string,
  taskId: number
): Promise<TaskSyncResult> {
  try {
    // Get existing mapping
    const { data: mapping } = await supabase
      .from('bullhorn_object_mappings')
      .select('use60_id')
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'Task')
      .eq('bullhorn_entity_id', taskId)
      .maybeSingle();

    if (!mapping) {
      return {
        success: true,
        bullhornId: taskId,
        action: 'skipped',
      };
    }

    // Soft delete: Mark mapping as deleted
    await supabase
      .from('bullhorn_object_mappings')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId)
      .eq('bullhorn_entity_id', taskId);

    // Update task metadata to indicate Bullhorn deletion
    await supabase
      .from('tasks')
      .update({
        metadata: {
          bullhorn_id: taskId,
          bullhorn_type: 'Task',
          bullhorn_deleted: true,
          bullhorn_deleted_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', mapping.use60_id);

    return {
      success: true,
      taskId: mapping.use60_id,
      bullhornId: taskId,
      action: 'skipped', // soft_deleted
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('[task-sync] handleTaskDeleted error:', error);
    return {
      success: false,
      bullhornId: taskId,
      action: 'error',
      error,
    };
  }
}

// =============================================================================
// Action Item Sync
// =============================================================================

/**
 * Sync action item as Bullhorn Task
 * Action items from meeting intelligence become Bullhorn Tasks
 */
export async function syncActionItemToBullhornTask(
  orgId: string,
  actionItem: {
    id: string;
    title: string;
    description?: string;
    due_date?: string;
    completed?: boolean;
    priority?: string;
    meeting_id?: string;
    contact_id?: string;
    deal_id?: string;
  },
  entityAssociations: {
    candidateId?: number;
    clientContactId?: number;
    jobOrderId?: number;
    ownerId?: number;
  }
): Promise<{
  success: boolean;
  bullhornTaskData?: ReturnType<typeof prepareTaskForBullhornSync>;
  existingBullhornId?: number;
  error?: string;
}> {
  try {
    // Check if action item already synced
    const { data: existingMapping } = await supabase
      .from('bullhorn_object_mappings')
      .select('bullhorn_entity_id')
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'Task')
      .eq('use60_id', actionItem.id)
      .maybeSingle();

    // Prepare task data for Bullhorn
    const bullhornTaskData = prepareTaskForBullhornSync(actionItem, entityAssociations);

    if (existingMapping) {
      return {
        success: true,
        bullhornTaskData,
        existingBullhornId: existingMapping.bullhorn_entity_id,
      };
    }

    return {
      success: true,
      bullhornTaskData,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('[task-sync] syncActionItemToBullhornTask error:', error);
    return { success: false, error };
  }
}

// =============================================================================
// Initial Sync
// =============================================================================

/**
 * Perform initial matching of existing tasks with Bullhorn Tasks
 */
export async function performInitialTaskMatch(
  orgId: string,
  tasks: Array<{
    id: string;
    title: string;
    due_date?: string;
  }>,
  bullhornTasks: BullhornTask[]
): Promise<{
  matched: number;
  unmatched: number;
  results: Array<{ taskId: string; bullhornId?: number; matched: boolean; score: number }>;
}> {
  const results: Array<{
    taskId: string;
    bullhornId?: number;
    matched: boolean;
    score: number;
  }> = [];
  let matched = 0;
  let unmatched = 0;

  for (const task of tasks) {
    const matchResult = await findMatchingBullhornTask(orgId, task, bullhornTasks);

    if (matchResult.matched && matchResult.bullhornTaskId) {
      // Create mapping
      await supabase.from('bullhorn_object_mappings').insert({
        org_id: orgId,
        bullhorn_entity_type: 'Task',
        bullhorn_entity_id: matchResult.bullhornTaskId,
        use60_table: 'tasks',
        use60_id: task.id,
        sync_direction: 'bidirectional',
        last_synced_at: new Date().toISOString(),
      });

      results.push({
        taskId: task.id,
        bullhornId: matchResult.bullhornTaskId,
        matched: true,
        score: matchResult.matchScore,
      });
      matched++;
    } else {
      results.push({
        taskId: task.id,
        matched: false,
        score: matchResult.matchScore,
      });
      unmatched++;
    }
  }

  return { matched, unmatched, results };
}

/**
 * Find best matching Bullhorn Task for a use60 task
 */
async function findMatchingBullhornTask(
  _orgId: string,
  task: {
    title: string;
    due_date?: string;
  },
  bullhornTasks: BullhornTask[]
): Promise<TaskMatchResult> {
  let bestMatch: BullhornTask | null = null;
  let bestScore = 0;
  const matchedFields: string[] = [];

  for (const bullhornTask of bullhornTasks) {
    const score = calculateTaskMatchScore(bullhornTask, task);

    if (score > bestScore && score >= 50) {
      bestScore = score;
      bestMatch = bullhornTask;

      matchedFields.length = 0;
      if (
        task.title &&
        bullhornTask.subject?.toLowerCase().includes(task.title.toLowerCase())
      ) {
        matchedFields.push('subject');
      }
      if (task.due_date && bullhornTask.dateEnd) {
        const taskDue = new Date(task.due_date).setHours(0, 0, 0, 0);
        const bullhornDue = new Date(bullhornTask.dateEnd).setHours(0, 0, 0, 0);
        if (taskDue === bullhornDue) {
          matchedFields.push('dateEnd');
        }
      }
    }
  }

  return {
    matched: bestMatch !== null,
    bullhornTaskId: bestMatch?.id,
    matchScore: bestScore,
    matchedFields,
  };
}

// =============================================================================
// Metrics
// =============================================================================

/**
 * Get synced task metrics for an organization
 */
export async function getSyncedTaskMetrics(
  orgId: string
): Promise<{
  total: number;
  synced: number;
  pending: number;
  completed: number;
  overdue: number;
}> {
  // Get total tasks
  const { count: totalCount } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId);

  // Get synced tasks (have Bullhorn mapping)
  const { data: syncedMappings } = await supabase
    .from('bullhorn_object_mappings')
    .select('use60_id')
    .eq('org_id', orgId)
    .eq('bullhorn_entity_type', 'Task')
    .eq('is_deleted', false);

  // Get pending tasks
  const { count: pendingCount } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('completed', false);

  // Get completed tasks
  const { count: completedCount } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('completed', true);

  // Get overdue tasks
  const now = new Date().toISOString();
  const { count: overdueCount } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('completed', false)
    .lt('due_date', now);

  return {
    total: totalCount || 0,
    synced: syncedMappings?.length || 0,
    pending: pendingCount || 0,
    completed: completedCount || 0,
    overdue: overdueCount || 0,
  };
}
