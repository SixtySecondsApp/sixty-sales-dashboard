/**
 * Bullhorn Task API Module
 *
 * Provides CRUD operations and search for Bullhorn Task entities.
 * Tasks represent follow-up items linked to Candidates, ClientContacts, or JobOrders.
 */

import type { BullhornTask, BullhornSearchResponse } from '../types/bullhorn';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TASK_FIELDS = [
  'id',
  'type',
  'subject',
  'description',
  'status',
  'priority',
  'dateBegin',
  'dateEnd',
  'isCompleted',
  'isDeleted',
  'isPrivate',
  'notificationMinutes',
  'recurrencePattern',
  'owner',
  'candidate',
  'clientContact',
  'jobOrder',
  'placement',
  'lead',
  'opportunity',
  'dateAdded',
  'dateLastModified',
  'externalID',
  'customText1',
  'customText2',
].join(',');

// Task status values in Bullhorn
export const TASK_STATUS = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  DEFERRED: 'Deferred',
  WAITING: 'Waiting On Someone Else',
} as const;

// Task priority values in Bullhorn
export const TASK_PRIORITY = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
} as const;

// Task type values in Bullhorn
export const TASK_TYPE = {
  CALL: 'Call',
  EMAIL: 'Email',
  MEETING: 'Meeting',
  FOLLOW_UP: 'Follow-up',
  REFERENCE_CHECK: 'Reference Check',
  INTERVIEW: 'Interview',
  SEND_RESUME: 'Send Resume',
  OTHER: 'Other',
} as const;

// =============================================================================
// Types
// =============================================================================

export interface TaskSearchParams {
  query: string;
  fields?: string;
  count?: number;
  start?: number;
  sort?: string;
}

export interface TaskCreateData {
  type: string;
  subject: string;
  description?: string;
  status?: string;
  priority?: string;
  dateBegin?: number;
  dateEnd?: number;
  isCompleted?: boolean;
  isPrivate?: boolean;
  notificationMinutes?: number;
  owner?: { id: number };
  candidate?: { id: number };
  clientContact?: { id: number };
  jobOrder?: { id: number };
  placement?: { id: number };
  lead?: { id: number };
  opportunity?: { id: number };
  externalID?: string;
  customText1?: string;
  customText2?: string;
}

export interface TaskUpdateData extends Partial<TaskCreateData> {
  // All fields optional for updates
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Get a single task by ID
 */
export function getTaskRequest(
  id: number,
  fields: string = DEFAULT_TASK_FIELDS
): { method: 'GET'; path: string; query: Record<string, string> } {
  return {
    method: 'GET',
    path: `entity/Task/${id}`,
    query: { fields },
  };
}

/**
 * Search tasks using Lucene query syntax
 */
export function searchTasksRequest(
  params: TaskSearchParams
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Task',
    query: {
      query: params.query,
      fields: params.fields || DEFAULT_TASK_FIELDS,
      count: params.count || 50,
      start: params.start || 0,
      ...(params.sort && { sort: params.sort }),
    },
  };
}

/**
 * Search tasks by owner
 */
export function searchTasksByOwnerRequest(
  ownerId: number,
  fields: string = DEFAULT_TASK_FIELDS,
  count: number = 50
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Task',
    query: {
      query: `owner.id:${ownerId} AND isDeleted:false`,
      fields,
      count,
      start: 0,
      sort: '-dateBegin',
    },
  };
}

/**
 * Search tasks by candidate
 */
export function searchTasksByCandidateRequest(
  candidateId: number,
  fields: string = DEFAULT_TASK_FIELDS,
  count: number = 50
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Task',
    query: {
      query: `candidate.id:${candidateId} AND isDeleted:false`,
      fields,
      count,
      start: 0,
      sort: '-dateBegin',
    },
  };
}

/**
 * Search tasks by job order
 */
export function searchTasksByJobOrderRequest(
  jobOrderId: number,
  fields: string = DEFAULT_TASK_FIELDS,
  count: number = 50
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Task',
    query: {
      query: `jobOrder.id:${jobOrderId} AND isDeleted:false`,
      fields,
      count,
      start: 0,
      sort: '-dateBegin',
    },
  };
}

/**
 * Search incomplete tasks
 */
export function searchIncompleteTasksRequest(
  ownerId?: number,
  fields: string = DEFAULT_TASK_FIELDS,
  count: number = 100
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  const ownerClause = ownerId ? ` AND owner.id:${ownerId}` : '';
  return {
    method: 'GET',
    path: 'search/Task',
    query: {
      query: `isCompleted:false AND isDeleted:false${ownerClause}`,
      fields,
      count,
      start: 0,
      sort: 'dateBegin',
    },
  };
}

/**
 * Search overdue tasks
 */
export function searchOverdueTasksRequest(
  ownerId?: number,
  fields: string = DEFAULT_TASK_FIELDS,
  count: number = 100
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  const ownerClause = ownerId ? ` AND owner.id:${ownerId}` : '';
  const now = Date.now();
  return {
    method: 'GET',
    path: 'search/Task',
    query: {
      query: `isCompleted:false AND isDeleted:false AND dateEnd:[* TO ${now}]${ownerClause}`,
      fields,
      count,
      start: 0,
      sort: 'dateEnd',
    },
  };
}

/**
 * Search tasks by external ID (use60 task ID)
 */
export function searchTaskByExternalIdRequest(
  externalId: string,
  fields: string = DEFAULT_TASK_FIELDS
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  const escapedId = externalId.replace(/[+\-&|!(){}[\]^"~*?:\\]/g, '\\$&');
  return {
    method: 'GET',
    path: 'search/Task',
    query: {
      query: `externalID:"${escapedId}"`,
      fields,
      count: 1,
      start: 0,
    },
  };
}

/**
 * Create a new task
 */
export function createTaskRequest(
  data: TaskCreateData
): { method: 'PUT'; path: string; body: TaskCreateData } {
  return {
    method: 'PUT',
    path: 'entity/Task',
    body: data,
  };
}

/**
 * Update an existing task
 */
export function updateTaskRequest(
  id: number,
  data: TaskUpdateData
): { method: 'POST'; path: string; body: TaskUpdateData } {
  return {
    method: 'POST',
    path: `entity/Task/${id}`,
    body: data,
  };
}

/**
 * Mark task as completed
 */
export function completeTaskRequest(
  id: number
): { method: 'POST'; path: string; body: { isCompleted: boolean; status: string } } {
  return {
    method: 'POST',
    path: `entity/Task/${id}`,
    body: { isCompleted: true, status: TASK_STATUS.COMPLETED },
  };
}

/**
 * Soft delete a task
 */
export function deleteTaskRequest(
  id: number
): { method: 'POST'; path: string; body: { isDeleted: boolean } } {
  return {
    method: 'POST',
    path: `entity/Task/${id}`,
    body: { isDeleted: true },
  };
}

/**
 * Get multiple tasks by IDs
 */
export function getTasksByIdsRequest(
  ids: number[],
  fields: string = DEFAULT_TASK_FIELDS
): { method: 'GET'; path: string; query: Record<string, string> } {
  return {
    method: 'GET',
    path: `entity/Task/${ids.join(',')}`,
    query: { fields },
  };
}

/**
 * Query tasks modified since a timestamp
 */
export function getTasksModifiedSinceRequest(
  sinceTimestamp: number,
  fields: string = DEFAULT_TASK_FIELDS,
  count: number = 100,
  start: number = 0
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Task',
    query: {
      query: `dateLastModified:[${sinceTimestamp} TO *]`,
      fields,
      count,
      start,
      sort: 'dateLastModified',
    },
  };
}

// =============================================================================
// Data Mapping
// =============================================================================

/**
 * Map use60 task to Bullhorn Task format
 */
export function mapTaskToBullhornTask(task: {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  completed?: boolean;
  priority?: string;
  contact_id?: string;
  deal_id?: string;
  metadata?: Record<string, unknown>;
}): TaskCreateData {
  return {
    type: TASK_TYPE.FOLLOW_UP,
    subject: task.title,
    description: task.description || undefined,
    status: task.completed ? TASK_STATUS.COMPLETED : TASK_STATUS.NOT_STARTED,
    priority: mapTaskPriorityToBullhorn(task.priority),
    dateEnd: task.due_date ? Date.parse(task.due_date) : undefined,
    isCompleted: task.completed || false,
    externalID: `use60_task_${task.id}`,
    customText1: task.id, // Store use60 task ID for reverse lookup
  };
}

/**
 * Map Bullhorn Task to use60 task format
 */
export function mapBullhornTaskToTask(task: BullhornTask): {
  title: string;
  description: string | null;
  due_date: string | null;
  completed: boolean;
  priority: string;
  source: string;
  external_id: string;
  metadata: Record<string, unknown>;
} {
  return {
    title: task.subject || '',
    description: task.description || null,
    due_date: task.dateEnd ? new Date(task.dateEnd).toISOString() : null,
    completed: task.isCompleted || false,
    priority: mapBullhornPriorityToTask(task.priority),
    source: 'bullhorn',
    external_id: `bullhorn_task_${task.id}`,
    metadata: {
      bullhorn_id: task.id,
      bullhorn_type: 'Task',
      bullhorn_status: task.status,
      bullhorn_task_type: task.type,
      bullhorn_candidate_id: task.candidate?.id,
      bullhorn_client_contact_id: task.clientContact?.id,
      bullhorn_job_order_id: task.jobOrder?.id,
      bullhorn_placement_id: task.placement?.id,
      synced_at: new Date().toISOString(),
    },
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Map use60 priority to Bullhorn priority
 */
function mapTaskPriorityToBullhorn(priority?: string): string {
  const priorityMap: Record<string, string> = {
    low: TASK_PRIORITY.LOW,
    medium: TASK_PRIORITY.NORMAL,
    normal: TASK_PRIORITY.NORMAL,
    high: TASK_PRIORITY.HIGH,
    urgent: TASK_PRIORITY.HIGH,
  };
  return priorityMap[priority?.toLowerCase() || ''] || TASK_PRIORITY.NORMAL;
}

/**
 * Map Bullhorn priority to use60 priority
 */
function mapBullhornPriorityToTask(priority?: string): string {
  const priorityMap: Record<string, string> = {
    [TASK_PRIORITY.LOW]: 'low',
    [TASK_PRIORITY.NORMAL]: 'medium',
    [TASK_PRIORITY.HIGH]: 'high',
  };
  return priorityMap[priority || ''] || 'medium';
}

/**
 * Map use60 task status to Bullhorn status
 */
export function mapTaskStatusToBullhorn(status?: string): string {
  const statusMap: Record<string, string> = {
    pending: TASK_STATUS.NOT_STARTED,
    not_started: TASK_STATUS.NOT_STARTED,
    in_progress: TASK_STATUS.IN_PROGRESS,
    completed: TASK_STATUS.COMPLETED,
    done: TASK_STATUS.COMPLETED,
    deferred: TASK_STATUS.DEFERRED,
    blocked: TASK_STATUS.WAITING,
  };
  return statusMap[status?.toLowerCase() || ''] || TASK_STATUS.NOT_STARTED;
}

/**
 * Map Bullhorn status to use60 task status
 */
export function mapBullhornStatusToTask(status?: string): string {
  const statusMap: Record<string, string> = {
    [TASK_STATUS.NOT_STARTED]: 'pending',
    [TASK_STATUS.IN_PROGRESS]: 'in_progress',
    [TASK_STATUS.COMPLETED]: 'completed',
    [TASK_STATUS.DEFERRED]: 'deferred',
    [TASK_STATUS.WAITING]: 'blocked',
  };
  return statusMap[status || ''] || 'pending';
}

/**
 * Build search query for finding tasks
 */
export function buildTaskSearchQuery(criteria: {
  subject?: string;
  ownerId?: number;
  candidateId?: number;
  clientContactId?: number;
  jobOrderId?: number;
  status?: string;
  isCompleted?: boolean;
  modifiedSince?: number;
}): string {
  const parts: string[] = [];

  if (criteria.subject) {
    parts.push(`subject:${criteria.subject}*`);
  }

  if (criteria.ownerId) {
    parts.push(`owner.id:${criteria.ownerId}`);
  }

  if (criteria.candidateId) {
    parts.push(`candidate.id:${criteria.candidateId}`);
  }

  if (criteria.clientContactId) {
    parts.push(`clientContact.id:${criteria.clientContactId}`);
  }

  if (criteria.jobOrderId) {
    parts.push(`jobOrder.id:${criteria.jobOrderId}`);
  }

  if (criteria.status) {
    parts.push(`status:"${criteria.status}"`);
  }

  if (criteria.isCompleted !== undefined) {
    parts.push(`isCompleted:${criteria.isCompleted}`);
  }

  if (criteria.modifiedSince) {
    parts.push(`dateLastModified:[${criteria.modifiedSince} TO *]`);
  }

  // Always exclude deleted
  parts.push('isDeleted:false');

  return parts.length > 0 ? parts.join(' AND ') : '*';
}

/**
 * Calculate match score for task matching
 */
export function calculateTaskMatchScore(
  bullhornTask: BullhornTask,
  use60Task: { title?: string; due_date?: string }
): number {
  let score = 0;

  // Subject match (primary)
  if (use60Task.title && bullhornTask.subject) {
    const subjectLower = bullhornTask.subject.toLowerCase();
    const titleLower = use60Task.title.toLowerCase();

    if (subjectLower === titleLower) {
      score += 100;
    } else if (subjectLower.includes(titleLower) || titleLower.includes(subjectLower)) {
      score += 50;
    }
  }

  // Due date match (secondary)
  if (use60Task.due_date && bullhornTask.dateEnd) {
    const use60Due = new Date(use60Task.due_date).setHours(0, 0, 0, 0);
    const bullhornDue = new Date(bullhornTask.dateEnd).setHours(0, 0, 0, 0);

    if (use60Due === bullhornDue) {
      score += 30;
    }
  }

  return score;
}
