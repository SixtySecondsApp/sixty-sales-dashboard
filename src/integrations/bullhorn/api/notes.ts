/**
 * Bullhorn Notes API Module
 *
 * Provides operations for creating and managing Notes in Bullhorn.
 * Notes are used to record meeting summaries, call logs, and activities.
 */

import type { BullhornNote } from '../types/bullhorn';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_NOTE_FIELDS = [
  'id',
  'action',
  'comments',
  'commentingPerson',
  'personReference',
  'jobOrder',
  'clientContact',
  'dateAdded',
  'dateLastModified',
  'minutesSpent',
  'isDeleted',
  'externalID',
].join(',');

/**
 * Standard Bullhorn note action types
 */
export const NOTE_ACTION_TYPES = {
  GENERAL: 'General Note',
  CALL: 'Phone Call',
  EMAIL: 'Email',
  MEETING: 'Meeting',
  INTERVIEW: 'Interview',
  SUBMISSION: 'Submission',
  REFERENCE_CHECK: 'Reference Check',
  PLACEMENT: 'Placement',
  LEFT_MESSAGE: 'Left Message',
  BD_MEETING: 'BD Meeting',
  CLIENT_VISIT: 'Client Visit',
  FOLLOW_UP: 'Follow Up',
} as const;

export type NoteActionType = typeof NOTE_ACTION_TYPES[keyof typeof NOTE_ACTION_TYPES];

// =============================================================================
// Types
// =============================================================================

export interface NoteCreateData {
  action: string;
  comments: string;
  personReference?: { id: number; _subtype?: 'Candidate' | 'ClientContact' };
  jobOrder?: { id: number };
  clientContact?: { id: number };
  minutesSpent?: number;
  externalID?: string;
}

export interface NoteSearchParams {
  query: string;
  fields?: string;
  count?: number;
  start?: number;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Create a new note
 * Note: Bullhorn uses PUT for creates
 */
export function createNoteRequest(
  data: NoteCreateData
): { method: 'PUT'; path: string; body: NoteCreateData } {
  return {
    method: 'PUT',
    path: 'entity/Note',
    body: data,
  };
}

/**
 * Get a note by ID
 */
export function getNoteRequest(
  id: number,
  fields: string = DEFAULT_NOTE_FIELDS
): { method: 'GET'; path: string; query: Record<string, string> } {
  return {
    method: 'GET',
    path: `entity/Note/${id}`,
    query: { fields },
  };
}

/**
 * Update an existing note
 */
export function updateNoteRequest(
  id: number,
  data: Partial<NoteCreateData>
): { method: 'POST'; path: string; body: Partial<NoteCreateData> } {
  return {
    method: 'POST',
    path: `entity/Note/${id}`,
    body: data,
  };
}

/**
 * Soft delete a note
 */
export function deleteNoteRequest(
  id: number
): { method: 'POST'; path: string; body: { isDeleted: boolean } } {
  return {
    method: 'POST',
    path: `entity/Note/${id}`,
    body: { isDeleted: true },
  };
}

/**
 * Search notes using Lucene query syntax
 */
export function searchNotesRequest(
  params: NoteSearchParams
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Note',
    query: {
      query: params.query,
      fields: params.fields || DEFAULT_NOTE_FIELDS,
      count: params.count || 20,
      start: params.start || 0,
    },
  };
}

/**
 * Get notes for a specific candidate
 */
export function getCandidateNotesRequest(
  candidateId: number,
  count: number = 50,
  start: number = 0
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Note',
    query: {
      query: `personReference.id:${candidateId}`,
      fields: DEFAULT_NOTE_FIELDS,
      count,
      start,
      sort: '-dateAdded',
    },
  };
}

/**
 * Get notes for a specific client contact
 */
export function getClientContactNotesRequest(
  clientContactId: number,
  count: number = 50,
  start: number = 0
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Note',
    query: {
      query: `clientContact.id:${clientContactId}`,
      fields: DEFAULT_NOTE_FIELDS,
      count,
      start,
      sort: '-dateAdded',
    },
  };
}

/**
 * Get notes for a specific job order
 */
export function getJobOrderNotesRequest(
  jobOrderId: number,
  count: number = 50,
  start: number = 0
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Note',
    query: {
      query: `jobOrder.id:${jobOrderId}`,
      fields: DEFAULT_NOTE_FIELDS,
      count,
      start,
      sort: '-dateAdded',
    },
  };
}

// =============================================================================
// Data Mapping
// =============================================================================

/**
 * Map meeting summary to Bullhorn Note format
 */
export function mapMeetingSummaryToNote(summary: {
  id: string;
  title?: string;
  content: string;
  meeting_type?: string;
  duration_minutes?: number;
  created_at: string;
  contact_id?: string;
  deal_id?: string;
  bullhorn_candidate_id?: number;
  bullhorn_client_contact_id?: number;
  bullhorn_job_order_id?: number;
}): NoteCreateData {
  // Determine action type based on meeting type
  const action = mapMeetingTypeToNoteAction(summary.meeting_type);

  // Build formatted comments
  const comments = formatMeetingSummaryForNote(summary);

  const noteData: NoteCreateData = {
    action,
    comments,
    minutesSpent: summary.duration_minutes,
    externalID: `use60_meeting_${summary.id}`,
  };

  // Attach to appropriate entity
  if (summary.bullhorn_candidate_id) {
    noteData.personReference = {
      id: summary.bullhorn_candidate_id,
      _subtype: 'Candidate',
    };
  } else if (summary.bullhorn_client_contact_id) {
    noteData.clientContact = { id: summary.bullhorn_client_contact_id };
  }

  if (summary.bullhorn_job_order_id) {
    noteData.jobOrder = { id: summary.bullhorn_job_order_id };
  }

  return noteData;
}

/**
 * Map activity to Bullhorn Note format
 */
export function mapActivityToNote(activity: {
  id: string;
  type?: string;
  title?: string;
  description?: string;
  duration_minutes?: number;
  bullhorn_candidate_id?: number;
  bullhorn_client_contact_id?: number;
  bullhorn_job_order_id?: number;
}): NoteCreateData {
  const action = mapActivityTypeToNoteAction(activity.type);

  const noteData: NoteCreateData = {
    action,
    comments: activity.description || activity.title || '',
    minutesSpent: activity.duration_minutes,
    externalID: `use60_activity_${activity.id}`,
  };

  // Attach to appropriate entity
  if (activity.bullhorn_candidate_id) {
    noteData.personReference = {
      id: activity.bullhorn_candidate_id,
      _subtype: 'Candidate',
    };
  } else if (activity.bullhorn_client_contact_id) {
    noteData.clientContact = { id: activity.bullhorn_client_contact_id };
  }

  if (activity.bullhorn_job_order_id) {
    noteData.jobOrder = { id: activity.bullhorn_job_order_id };
  }

  return noteData;
}

/**
 * Map Bullhorn Note to use60 activity format
 */
export function mapNoteToActivity(note: BullhornNote): {
  type: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  source: string;
  external_id: string;
  metadata: Record<string, unknown>;
} {
  return {
    type: mapNoteActionToActivityType(note.action),
    title: note.action || 'Note',
    description: note.comments || null,
    duration_minutes: note.minutesSpent || null,
    source: 'bullhorn',
    external_id: `bullhorn_note_${note.id}`,
    metadata: {
      bullhorn_id: note.id,
      bullhorn_action: note.action,
      bullhorn_person_reference: note.personReference,
      synced_at: new Date().toISOString(),
    },
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Map meeting type to Bullhorn note action
 */
function mapMeetingTypeToNoteAction(meetingType?: string): string {
  const typeMap: Record<string, string> = {
    call: NOTE_ACTION_TYPES.CALL,
    phone: NOTE_ACTION_TYPES.CALL,
    video: NOTE_ACTION_TYPES.MEETING,
    in_person: NOTE_ACTION_TYPES.MEETING,
    interview: NOTE_ACTION_TYPES.INTERVIEW,
    screening: NOTE_ACTION_TYPES.INTERVIEW,
    bd_meeting: NOTE_ACTION_TYPES.BD_MEETING,
    client_visit: NOTE_ACTION_TYPES.CLIENT_VISIT,
    follow_up: NOTE_ACTION_TYPES.FOLLOW_UP,
  };
  return typeMap[meetingType?.toLowerCase() || ''] || NOTE_ACTION_TYPES.MEETING;
}

/**
 * Map activity type to Bullhorn note action
 */
function mapActivityTypeToNoteAction(activityType?: string): string {
  const typeMap: Record<string, string> = {
    call: NOTE_ACTION_TYPES.CALL,
    email: NOTE_ACTION_TYPES.EMAIL,
    meeting: NOTE_ACTION_TYPES.MEETING,
    note: NOTE_ACTION_TYPES.GENERAL,
    task: NOTE_ACTION_TYPES.FOLLOW_UP,
    follow_up: NOTE_ACTION_TYPES.FOLLOW_UP,
    interview: NOTE_ACTION_TYPES.INTERVIEW,
    submission: NOTE_ACTION_TYPES.SUBMISSION,
    reference: NOTE_ACTION_TYPES.REFERENCE_CHECK,
  };
  return typeMap[activityType?.toLowerCase() || ''] || NOTE_ACTION_TYPES.GENERAL;
}

/**
 * Map Bullhorn note action to activity type
 */
function mapNoteActionToActivityType(action?: string): string {
  const actionMap: Record<string, string> = {
    [NOTE_ACTION_TYPES.CALL]: 'call',
    [NOTE_ACTION_TYPES.EMAIL]: 'email',
    [NOTE_ACTION_TYPES.MEETING]: 'meeting',
    [NOTE_ACTION_TYPES.INTERVIEW]: 'interview',
    [NOTE_ACTION_TYPES.GENERAL]: 'note',
    [NOTE_ACTION_TYPES.FOLLOW_UP]: 'follow_up',
    [NOTE_ACTION_TYPES.SUBMISSION]: 'submission',
    [NOTE_ACTION_TYPES.REFERENCE_CHECK]: 'reference',
  };
  return actionMap[action || ''] || 'note';
}

/**
 * Format meeting summary content for Bullhorn note
 */
function formatMeetingSummaryForNote(summary: {
  title?: string;
  content: string;
  meeting_type?: string;
  created_at: string;
}): string {
  const lines: string[] = [];

  if (summary.title) {
    lines.push(`📋 ${summary.title}`);
    lines.push('');
  }

  lines.push('🤖 AI-Generated Meeting Summary (use60)');
  lines.push(`📅 ${new Date(summary.created_at).toLocaleString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(summary.content);
  lines.push('');
  lines.push('---');
  // Use environment-specific URL (staging or production)
  const appUrl = import.meta.env.VITE_PUBLIC_URL || 'https://app.use60.com';
  lines.push(`Synced from use60 • ${appUrl}`);

  return lines.join('\n');
}

/**
 * Generate a note for candidate intelligence update
 */
export function createIntelligenceNote(intelligence: {
  candidateId: number;
  type: 'availability' | 'salary' | 'skills' | 'interest' | 'objection';
  value: string;
  source: string;
  meetingId?: string;
}): NoteCreateData {
  const typeLabels: Record<string, string> = {
    availability: '📅 Availability Update',
    salary: '💰 Salary/Rate Discussion',
    skills: '🛠️ Skills & Experience',
    interest: '🎯 Interest Level',
    objection: '⚠️ Concerns/Objections',
  };

  return {
    action: NOTE_ACTION_TYPES.GENERAL,
    comments: [
      typeLabels[intelligence.type] || 'Intelligence Update',
      '',
      intelligence.value,
      '',
      '---',
      `Source: ${intelligence.source}`,
      intelligence.meetingId ? `Meeting ID: ${intelligence.meetingId}` : '',
      'Extracted by use60 AI',
    ].filter(Boolean).join('\n'),
    personReference: {
      id: intelligence.candidateId,
      _subtype: 'Candidate',
    },
    externalID: `use60_intel_${intelligence.type}_${Date.now()}`,
  };
}
