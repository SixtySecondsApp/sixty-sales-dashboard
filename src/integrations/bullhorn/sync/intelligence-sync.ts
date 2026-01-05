/**
 * Bullhorn Intelligence Sync Service
 *
 * Handles pushing AI-extracted meeting intelligence to Bullhorn entities.
 * This includes meeting summaries, extracted insights, and action items.
 */

import { supabase } from '@/lib/supabase/clientV2';
import { mapMeetingSummaryToNote, createIntelligenceNote, type NoteCreateData } from '../api/notes';

// =============================================================================
// Types
// =============================================================================

export interface MeetingIntelligence {
  meetingId: string;
  orgId: string;
  summary: string;
  extractedInsights: ExtractedInsight[];
  actionItems: ActionItem[];
  participants: Participant[];
  meetingType?: string;
  durationMinutes?: number;
  createdAt: string;
}

export interface ExtractedInsight {
  type: 'availability' | 'salary' | 'notice_period' | 'skills' | 'interest' | 'objection' | 'requirement' | 'timeline' | 'budget';
  value: string;
  confidence: number;
  source: string;
  entityType: 'Candidate' | 'ClientContact' | 'JobOrder';
  entityId?: number;
}

export interface ActionItem {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  assigneeId?: string;
  priority?: 'high' | 'medium' | 'low';
  relatedEntityType?: 'Candidate' | 'ClientContact' | 'JobOrder';
  relatedEntityId?: number;
}

export interface Participant {
  contactId?: string;
  email?: string;
  name?: string;
  role?: 'candidate' | 'client' | 'recruiter' | 'other';
  bullhornEntityType?: 'Candidate' | 'ClientContact';
  bullhornEntityId?: number;
}

export interface IntelligenceSyncResult {
  success: boolean;
  noteIds: number[];
  updatedFields: FieldUpdate[];
  taskIds: number[];
  errors: string[];
}

export interface FieldUpdate {
  entityType: string;
  entityId: number;
  field: string;
  oldValue?: string | number;
  newValue: string | number;
}

// =============================================================================
// Main Sync Function
// =============================================================================

/**
 * Sync meeting intelligence to Bullhorn
 * Creates notes, updates custom fields, and creates tasks
 */
export async function syncMeetingIntelligenceToBullhorn(
  intelligence: MeetingIntelligence
): Promise<{
  notesToCreate: NoteCreateData[];
  fieldsToUpdate: FieldUpdateRequest[];
  tasksToCreate: TaskCreateRequest[];
}> {
  const notesToCreate: NoteCreateData[] = [];
  const fieldsToUpdate: FieldUpdateRequest[] = [];
  const tasksToCreate: TaskCreateRequest[] = [];

  // Get Bullhorn mappings for participants
  const participantMappings = await resolveParticipantMappings(
    intelligence.orgId,
    intelligence.participants
  );

  // 1. Create meeting summary notes for each participant
  for (const participant of participantMappings) {
    if (participant.bullhornEntityId) {
      const noteData = mapMeetingSummaryToNote({
        id: intelligence.meetingId,
        title: `Meeting Summary - ${new Date(intelligence.createdAt).toLocaleDateString()}`,
        content: intelligence.summary,
        meeting_type: intelligence.meetingType,
        duration_minutes: intelligence.durationMinutes,
        created_at: intelligence.createdAt,
        bullhorn_candidate_id:
          participant.bullhornEntityType === 'Candidate' ? participant.bullhornEntityId : undefined,
        bullhorn_client_contact_id:
          participant.bullhornEntityType === 'ClientContact' ? participant.bullhornEntityId : undefined,
      });
      notesToCreate.push(noteData);
    }
  }

  // 2. Process extracted insights
  for (const insight of intelligence.extractedInsights) {
    const entityMapping = participantMappings.find(
      (p) => p.bullhornEntityType === insight.entityType && p.bullhornEntityId === insight.entityId
    ) || participantMappings.find((p) => p.bullhornEntityType === insight.entityType);

    if (!entityMapping?.bullhornEntityId) continue;

    // Create intelligence note
    if (insight.type === 'availability' || insight.type === 'skills' || insight.type === 'objection') {
      const intelligenceNote = createIntelligenceNote({
        candidateId: entityMapping.bullhornEntityId,
        type: insight.type as 'availability' | 'salary' | 'skills' | 'interest' | 'objection',
        value: insight.value,
        source: `Meeting: ${intelligence.meetingId}`,
        meetingId: intelligence.meetingId,
      });
      notesToCreate.push(intelligenceNote);
    }

    // Update custom fields based on insight type
    const fieldMapping = getInsightToFieldMapping(insight.type, insight.entityType);
    if (fieldMapping) {
      fieldsToUpdate.push({
        entityType: insight.entityType,
        entityId: entityMapping.bullhornEntityId,
        field: fieldMapping.field,
        value: formatInsightValue(insight.type, insight.value, fieldMapping.type),
      });
    }
  }

  // 3. Convert action items to Bullhorn tasks
  for (const actionItem of intelligence.actionItems) {
    const entityMapping = actionItem.relatedEntityId
      ? participantMappings.find((p) => p.bullhornEntityId === actionItem.relatedEntityId)
      : participantMappings[0];

    tasksToCreate.push({
      subject: actionItem.title,
      description: actionItem.description,
      dueDate: actionItem.dueDate ? new Date(actionItem.dueDate).getTime() : undefined,
      priority: mapPriorityToBullhorn(actionItem.priority),
      candidateId:
        entityMapping?.bullhornEntityType === 'Candidate'
          ? entityMapping.bullhornEntityId
          : undefined,
      clientContactId:
        entityMapping?.bullhornEntityType === 'ClientContact'
          ? entityMapping.bullhornEntityId
          : undefined,
      externalId: `use60_task_${actionItem.id}`,
    });
  }

  return {
    notesToCreate,
    fieldsToUpdate,
    tasksToCreate,
  };
}

// =============================================================================
// Candidate Intelligence Writeback
// =============================================================================

/**
 * Update candidate with extracted intelligence from a meeting
 */
export function prepareCandidateIntelligenceUpdate(
  candidateId: number,
  insights: ExtractedInsight[]
): { entityType: 'Candidate'; entityId: number; updates: Record<string, unknown> } {
  const updates: Record<string, unknown> = {};

  for (const insight of insights) {
    switch (insight.type) {
      case 'availability':
        updates.customText1 = insight.value; // Map to customText1 for availability
        updates.dateAvailable = parseAvailabilityDate(insight.value);
        break;
      case 'notice_period':
        updates.customText2 = insight.value;
        break;
      case 'salary':
        const salary = parseSalaryValue(insight.value);
        if (salary) {
          updates.salary = salary;
          updates.customFloat1 = salary;
        }
        break;
      case 'interest':
        updates.customText3 = insight.value; // hot/warm/cold
        break;
      case 'skills':
        // Append to skillSet rather than replace
        updates.skillSetAppend = insight.value;
        break;
    }
  }

  return {
    entityType: 'Candidate',
    entityId: candidateId,
    updates,
  };
}

// =============================================================================
// Client Intelligence Writeback
// =============================================================================

/**
 * Update client contact/job order with extracted intelligence
 */
export function prepareClientIntelligenceUpdate(
  entityType: 'ClientContact' | 'JobOrder',
  entityId: number,
  insights: ExtractedInsight[]
): { entityType: string; entityId: number; updates: Record<string, unknown> } {
  const updates: Record<string, unknown> = {};

  for (const insight of insights) {
    switch (insight.type) {
      case 'requirement':
        if (entityType === 'JobOrder') {
          updates.descriptionAppend = insight.value;
        }
        break;
      case 'timeline':
        if (entityType === 'JobOrder') {
          const startDate = parseTimelineDate(insight.value);
          if (startDate) {
            updates.startDate = startDate;
            updates.customDate1 = startDate;
          }
        }
        break;
      case 'budget':
        if (entityType === 'JobOrder') {
          const budget = parseSalaryValue(insight.value);
          if (budget) {
            updates.salary = budget;
            updates.payRate = budget;
          }
        }
        break;
    }
  }

  return {
    entityType,
    entityId,
    updates,
  };
}

// =============================================================================
// Helper Types & Functions
// =============================================================================

interface FieldUpdateRequest {
  entityType: string;
  entityId: number;
  field: string;
  value: string | number;
}

interface TaskCreateRequest {
  subject: string;
  description?: string;
  dueDate?: number;
  priority?: number;
  candidateId?: number;
  clientContactId?: number;
  jobOrderId?: number;
  externalId: string;
}

interface FieldMapping {
  field: string;
  type: 'string' | 'number' | 'date';
}

/**
 * Get the Bullhorn field mapping for an insight type
 */
function getInsightToFieldMapping(
  insightType: ExtractedInsight['type'],
  entityType: ExtractedInsight['entityType']
): FieldMapping | null {
  const candidateFieldMap: Record<string, FieldMapping> = {
    availability: { field: 'customText1', type: 'string' },
    notice_period: { field: 'customText2', type: 'string' },
    salary: { field: 'salary', type: 'number' },
    interest: { field: 'customText3', type: 'string' },
    skills: { field: 'skillSet', type: 'string' },
  };

  const jobOrderFieldMap: Record<string, FieldMapping> = {
    requirement: { field: 'description', type: 'string' },
    timeline: { field: 'customDate1', type: 'date' },
    budget: { field: 'salary', type: 'number' },
  };

  if (entityType === 'Candidate') {
    return candidateFieldMap[insightType] || null;
  } else if (entityType === 'JobOrder') {
    return jobOrderFieldMap[insightType] || null;
  }

  return null;
}

/**
 * Format insight value for Bullhorn field
 */
function formatInsightValue(
  insightType: string,
  value: string,
  fieldType: 'string' | 'number' | 'date'
): string | number {
  if (fieldType === 'number') {
    return parseSalaryValue(value) || 0;
  }
  if (fieldType === 'date') {
    return parseTimelineDate(value) || Date.now();
  }
  return value;
}

/**
 * Parse availability text to date timestamp
 */
function parseAvailabilityDate(value: string): number | undefined {
  // Common patterns: "immediately", "2 weeks", "1 month", "January 2025"
  const lowerValue = value.toLowerCase();

  if (lowerValue.includes('immediate') || lowerValue.includes('now') || lowerValue.includes('asap')) {
    return Date.now();
  }

  // Try to parse relative time
  const weeksMatch = lowerValue.match(/(\d+)\s*weeks?/);
  if (weeksMatch) {
    return Date.now() + parseInt(weeksMatch[1]) * 7 * 24 * 60 * 60 * 1000;
  }

  const monthsMatch = lowerValue.match(/(\d+)\s*months?/);
  if (monthsMatch) {
    return Date.now() + parseInt(monthsMatch[1]) * 30 * 24 * 60 * 60 * 1000;
  }

  // Try to parse as date
  const parsed = Date.parse(value);
  if (!isNaN(parsed)) {
    return parsed;
  }

  return undefined;
}

/**
 * Parse salary/rate value from text
 */
function parseSalaryValue(value: string): number | undefined {
  // Remove currency symbols and common text
  const cleaned = value.replace(/[£$€,]/g, '').replace(/\s*(per|p\.?a\.?|annual|yearly)/gi, '');

  // Handle "k" notation (e.g., "50k", "65K")
  const kMatch = cleaned.match(/(\d+\.?\d*)\s*k/i);
  if (kMatch) {
    return parseFloat(kMatch[1]) * 1000;
  }

  // Handle range (take the higher value)
  const rangeMatch = cleaned.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
  if (rangeMatch) {
    return Math.max(parseFloat(rangeMatch[1]), parseFloat(rangeMatch[2]));
  }

  // Plain number
  const numMatch = cleaned.match(/(\d+\.?\d*)/);
  if (numMatch) {
    return parseFloat(numMatch[1]);
  }

  return undefined;
}

/**
 * Parse timeline/date from text
 */
function parseTimelineDate(value: string): number | undefined {
  const lowerValue = value.toLowerCase();

  // Relative time parsing
  const weeksMatch = lowerValue.match(/(\d+)\s*weeks?/);
  if (weeksMatch) {
    return Date.now() + parseInt(weeksMatch[1]) * 7 * 24 * 60 * 60 * 1000;
  }

  const monthsMatch = lowerValue.match(/(\d+)\s*months?/);
  if (monthsMatch) {
    return Date.now() + parseInt(monthsMatch[1]) * 30 * 24 * 60 * 60 * 1000;
  }

  // Quarter parsing
  if (lowerValue.includes('q1')) {
    const year = new Date().getFullYear();
    return new Date(year, 0, 1).getTime();
  }
  if (lowerValue.includes('q2')) {
    const year = new Date().getFullYear();
    return new Date(year, 3, 1).getTime();
  }
  if (lowerValue.includes('q3')) {
    const year = new Date().getFullYear();
    return new Date(year, 6, 1).getTime();
  }
  if (lowerValue.includes('q4')) {
    const year = new Date().getFullYear();
    return new Date(year, 9, 1).getTime();
  }

  // Try to parse as date
  const parsed = Date.parse(value);
  if (!isNaN(parsed)) {
    return parsed;
  }

  return undefined;
}

/**
 * Map use60 priority to Bullhorn priority (1-5 scale)
 */
function mapPriorityToBullhorn(priority?: 'high' | 'medium' | 'low'): number {
  switch (priority) {
    case 'high':
      return 1;
    case 'medium':
      return 3;
    case 'low':
      return 5;
    default:
      return 3;
  }
}

/**
 * Resolve Bullhorn entity IDs for meeting participants
 */
async function resolveParticipantMappings(
  orgId: string,
  participants: Participant[]
): Promise<
  Array<{
    contactId?: string;
    email?: string;
    bullhornEntityType?: 'Candidate' | 'ClientContact';
    bullhornEntityId?: number;
  }>
> {
  const result = [];

  for (const participant of participants) {
    if (participant.bullhornEntityId) {
      result.push({
        contactId: participant.contactId,
        email: participant.email,
        bullhornEntityType: participant.bullhornEntityType,
        bullhornEntityId: participant.bullhornEntityId,
      });
      continue;
    }

    // Try to find mapping by contact ID
    if (participant.contactId) {
      const { data: mapping } = await supabase
        .from('bullhorn_object_mappings')
        .select('bullhorn_entity_type, bullhorn_entity_id')
        .eq('org_id', orgId)
        .eq('use60_id', participant.contactId)
        .eq('use60_table', 'contacts')
        .maybeSingle();

      if (mapping) {
        result.push({
          contactId: participant.contactId,
          email: participant.email,
          bullhornEntityType: mapping.bullhorn_entity_type as 'Candidate' | 'ClientContact',
          bullhornEntityId: mapping.bullhorn_entity_id,
        });
        continue;
      }
    }

    // No mapping found
    result.push({
      contactId: participant.contactId,
      email: participant.email,
    });
  }

  return result;
}

// =============================================================================
// Batch Operations
// =============================================================================

/**
 * Queue intelligence sync jobs for background processing
 */
export async function queueIntelligenceSyncJobs(
  orgId: string,
  intelligence: MeetingIntelligence
): Promise<void> {
  const { notesToCreate, fieldsToUpdate, tasksToCreate } = await syncMeetingIntelligenceToBullhorn(
    intelligence
  );

  // Queue note creation jobs
  for (const note of notesToCreate) {
    await supabase.from('bullhorn_sync_queue').insert({
      org_id: orgId,
      job_type: 'sync_note',
      payload: { note_data: note, meeting_id: intelligence.meetingId },
      priority: 10,
      dedupe_key: note.externalID,
    });
  }

  // Queue field update jobs
  for (const fieldUpdate of fieldsToUpdate) {
    await supabase.from('bullhorn_sync_queue').insert({
      org_id: orgId,
      job_type: 'update_field',
      payload: fieldUpdate,
      priority: 5,
    });
  }

  // Queue task creation jobs
  for (const task of tasksToCreate) {
    await supabase.from('bullhorn_sync_queue').insert({
      org_id: orgId,
      job_type: 'sync_task',
      payload: { task_data: task, meeting_id: intelligence.meetingId },
      priority: 8,
      dedupe_key: task.externalId,
    });
  }
}
