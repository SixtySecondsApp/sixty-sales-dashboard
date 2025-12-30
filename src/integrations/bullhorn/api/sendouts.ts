/**
 * Bullhorn Sendout API Module
 *
 * Provides CRUD operations and search for Bullhorn Sendout/JobSubmission entities.
 * Sendouts (JobSubmissions) represent candidate applications/submissions to job orders.
 * They track the interview process and candidate pipeline stages.
 */

import type { BullhornSendout, BullhornJobSubmission, BullhornSearchResponse } from '../types/bullhorn';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_JOB_SUBMISSION_FIELDS = [
  'id',
  'candidate',
  'jobOrder',
  'status',
  'source',
  'dateAdded',
  'dateLastModified',
  'dateWebResponse',
  'sendingUser',
  'owners',
  'isDeleted',
  'isHidden',
  'comments',
  'customText1',
  'customText2',
  'customText3',
  'customDate1',
  'customFloat1',
].join(',');

const DEFAULT_SENDOUT_FIELDS = [
  'id',
  'candidate',
  'jobOrder',
  'clientContact',
  'clientCorporation',
  'sendingUser',
  'dateAdded',
  'dateLastModified',
  'email',
  'isRead',
  'externalID',
  'customText1',
  'customText2',
].join(',');

// JobSubmission status values in Bullhorn
export const JOB_SUBMISSION_STATUS = {
  NEW: 'New Lead',
  WEBRESPONSE: 'Web Response',
  SUBMITTED: 'Submitted',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  FIRST_INTERVIEW: '1st Interview',
  SECOND_INTERVIEW: '2nd Interview',
  THIRD_INTERVIEW: '3rd Interview',
  OFFER_MADE: 'Offer Made',
  OFFER_ACCEPTED: 'Offer Accepted',
  PLACED: 'Placed',
  REJECTED: 'Rejected',
  WITHDREW: 'Withdrew',
} as const;

// =============================================================================
// Types
// =============================================================================

export interface JobSubmissionSearchParams {
  query: string;
  fields?: string;
  count?: number;
  start?: number;
  sort?: string;
}

export interface JobSubmissionCreateData {
  candidate: { id: number };
  jobOrder: { id: number };
  status?: string;
  source?: string;
  comments?: string;
  sendingUser?: { id: number };
  customText1?: string;
  customText2?: string;
  customText3?: string;
  customDate1?: number;
  customFloat1?: number;
}

export interface JobSubmissionUpdateData extends Partial<Omit<JobSubmissionCreateData, 'candidate' | 'jobOrder'>> {
  // All fields optional for updates except candidate/jobOrder which can't be changed
}

export interface SendoutCreateData {
  candidate: { id: number };
  jobOrder: { id: number };
  clientContact: { id: number };
  clientCorporation: { id: number };
  sendingUser?: { id: number };
  email?: string;
  externalID?: string;
  customText1?: string;
  customText2?: string;
}

// =============================================================================
// JobSubmission API Functions
// =============================================================================

/**
 * Get a single job submission by ID
 */
export function getJobSubmissionRequest(
  id: number,
  fields: string = DEFAULT_JOB_SUBMISSION_FIELDS
): { method: 'GET'; path: string; query: Record<string, string> } {
  return {
    method: 'GET',
    path: `entity/JobSubmission/${id}`,
    query: { fields },
  };
}

/**
 * Search job submissions using Lucene query syntax
 */
export function searchJobSubmissionsRequest(
  params: JobSubmissionSearchParams
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/JobSubmission',
    query: {
      query: params.query,
      fields: params.fields || DEFAULT_JOB_SUBMISSION_FIELDS,
      count: params.count || 50,
      start: params.start || 0,
      ...(params.sort && { sort: params.sort }),
    },
  };
}

/**
 * Search job submissions by candidate
 */
export function searchJobSubmissionsByCandidateRequest(
  candidateId: number,
  fields: string = DEFAULT_JOB_SUBMISSION_FIELDS,
  count: number = 50
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/JobSubmission',
    query: {
      query: `candidate.id:${candidateId} AND isDeleted:false`,
      fields,
      count,
      start: 0,
      sort: '-dateAdded',
    },
  };
}

/**
 * Search job submissions by job order
 */
export function searchJobSubmissionsByJobOrderRequest(
  jobOrderId: number,
  fields: string = DEFAULT_JOB_SUBMISSION_FIELDS,
  count: number = 100
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/JobSubmission',
    query: {
      query: `jobOrder.id:${jobOrderId} AND isDeleted:false`,
      fields,
      count,
      start: 0,
      sort: '-dateAdded',
    },
  };
}

/**
 * Search job submissions by status
 */
export function searchJobSubmissionsByStatusRequest(
  status: string,
  fields: string = DEFAULT_JOB_SUBMISSION_FIELDS,
  count: number = 100
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/JobSubmission',
    query: {
      query: `status:"${status}" AND isDeleted:false`,
      fields,
      count,
      start: 0,
      sort: '-dateLastModified',
    },
  };
}

/**
 * Search active job submissions (in interview process)
 */
export function searchActiveJobSubmissionsRequest(
  fields: string = DEFAULT_JOB_SUBMISSION_FIELDS,
  count: number = 100
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  // Active submissions are those not rejected, withdrew, or placed
  return {
    method: 'GET',
    path: 'search/JobSubmission',
    query: {
      query: `isDeleted:false AND NOT status:"${JOB_SUBMISSION_STATUS.REJECTED}" AND NOT status:"${JOB_SUBMISSION_STATUS.WITHDREW}" AND NOT status:"${JOB_SUBMISSION_STATUS.PLACED}"`,
      fields,
      count,
      start: 0,
      sort: '-dateLastModified',
    },
  };
}

/**
 * Create a new job submission
 */
export function createJobSubmissionRequest(
  data: JobSubmissionCreateData
): { method: 'PUT'; path: string; body: JobSubmissionCreateData } {
  return {
    method: 'PUT',
    path: 'entity/JobSubmission',
    body: data,
  };
}

/**
 * Update an existing job submission
 */
export function updateJobSubmissionRequest(
  id: number,
  data: JobSubmissionUpdateData
): { method: 'POST'; path: string; body: JobSubmissionUpdateData } {
  return {
    method: 'POST',
    path: `entity/JobSubmission/${id}`,
    body: data,
  };
}

/**
 * Update job submission status
 */
export function updateJobSubmissionStatusRequest(
  id: number,
  status: string
): { method: 'POST'; path: string; body: { status: string } } {
  return {
    method: 'POST',
    path: `entity/JobSubmission/${id}`,
    body: { status },
  };
}

/**
 * Soft delete a job submission
 */
export function deleteJobSubmissionRequest(
  id: number
): { method: 'POST'; path: string; body: { isDeleted: boolean } } {
  return {
    method: 'POST',
    path: `entity/JobSubmission/${id}`,
    body: { isDeleted: true },
  };
}

/**
 * Get multiple job submissions by IDs
 */
export function getJobSubmissionsByIdsRequest(
  ids: number[],
  fields: string = DEFAULT_JOB_SUBMISSION_FIELDS
): { method: 'GET'; path: string; query: Record<string, string> } {
  return {
    method: 'GET',
    path: `entity/JobSubmission/${ids.join(',')}`,
    query: { fields },
  };
}

/**
 * Query job submissions modified since a timestamp
 */
export function getJobSubmissionsModifiedSinceRequest(
  sinceTimestamp: number,
  fields: string = DEFAULT_JOB_SUBMISSION_FIELDS,
  count: number = 100,
  start: number = 0
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/JobSubmission',
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
// Sendout API Functions
// =============================================================================

/**
 * Get a single sendout by ID
 */
export function getSendoutRequest(
  id: number,
  fields: string = DEFAULT_SENDOUT_FIELDS
): { method: 'GET'; path: string; query: Record<string, string> } {
  return {
    method: 'GET',
    path: `entity/Sendout/${id}`,
    query: { fields },
  };
}

/**
 * Search sendouts by candidate
 */
export function searchSendoutsByCandidateRequest(
  candidateId: number,
  fields: string = DEFAULT_SENDOUT_FIELDS,
  count: number = 50
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Sendout',
    query: {
      query: `candidate.id:${candidateId}`,
      fields,
      count,
      start: 0,
      sort: '-dateAdded',
    },
  };
}

/**
 * Search sendouts by job order
 */
export function searchSendoutsByJobOrderRequest(
  jobOrderId: number,
  fields: string = DEFAULT_SENDOUT_FIELDS,
  count: number = 100
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Sendout',
    query: {
      query: `jobOrder.id:${jobOrderId}`,
      fields,
      count,
      start: 0,
      sort: '-dateAdded',
    },
  };
}

/**
 * Create a new sendout
 */
export function createSendoutRequest(
  data: SendoutCreateData
): { method: 'PUT'; path: string; body: SendoutCreateData } {
  return {
    method: 'PUT',
    path: 'entity/Sendout',
    body: data,
  };
}

// =============================================================================
// Data Mapping
// =============================================================================

/**
 * Map interview stage to Bullhorn JobSubmission status
 */
export function mapInterviewStageToStatus(stage?: string): string {
  const stageMap: Record<string, string> = {
    new: JOB_SUBMISSION_STATUS.NEW,
    submitted: JOB_SUBMISSION_STATUS.SUBMITTED,
    screening: JOB_SUBMISSION_STATUS.SUBMITTED,
    first_interview: JOB_SUBMISSION_STATUS.FIRST_INTERVIEW,
    second_interview: JOB_SUBMISSION_STATUS.SECOND_INTERVIEW,
    third_interview: JOB_SUBMISSION_STATUS.THIRD_INTERVIEW,
    final_interview: JOB_SUBMISSION_STATUS.THIRD_INTERVIEW,
    offer: JOB_SUBMISSION_STATUS.OFFER_MADE,
    offer_accepted: JOB_SUBMISSION_STATUS.OFFER_ACCEPTED,
    placed: JOB_SUBMISSION_STATUS.PLACED,
    rejected: JOB_SUBMISSION_STATUS.REJECTED,
    withdrew: JOB_SUBMISSION_STATUS.WITHDREW,
    declined: JOB_SUBMISSION_STATUS.WITHDREW,
  };
  return stageMap[stage?.toLowerCase() || ''] || JOB_SUBMISSION_STATUS.NEW;
}

/**
 * Map Bullhorn JobSubmission status to interview stage
 */
export function mapStatusToInterviewStage(status?: string): string {
  const statusMap: Record<string, string> = {
    [JOB_SUBMISSION_STATUS.NEW]: 'new',
    [JOB_SUBMISSION_STATUS.WEBRESPONSE]: 'new',
    [JOB_SUBMISSION_STATUS.SUBMITTED]: 'submitted',
    [JOB_SUBMISSION_STATUS.INTERVIEW_SCHEDULED]: 'scheduled',
    [JOB_SUBMISSION_STATUS.FIRST_INTERVIEW]: 'first_interview',
    [JOB_SUBMISSION_STATUS.SECOND_INTERVIEW]: 'second_interview',
    [JOB_SUBMISSION_STATUS.THIRD_INTERVIEW]: 'third_interview',
    [JOB_SUBMISSION_STATUS.OFFER_MADE]: 'offer',
    [JOB_SUBMISSION_STATUS.OFFER_ACCEPTED]: 'offer_accepted',
    [JOB_SUBMISSION_STATUS.PLACED]: 'placed',
    [JOB_SUBMISSION_STATUS.REJECTED]: 'rejected',
    [JOB_SUBMISSION_STATUS.WITHDREW]: 'withdrew',
  };
  return statusMap[status || ''] || 'new';
}

/**
 * Map JobSubmission to pipeline activity
 */
export function mapJobSubmissionToActivity(submission: BullhornJobSubmission): {
  type: string;
  title: string;
  description: string;
  stage: string;
  candidate_id?: number;
  job_order_id?: number;
  source: string;
  external_id: string;
  metadata: Record<string, unknown>;
} {
  return {
    type: 'interview_stage',
    title: `Job Submission: ${submission.status || 'New'}`,
    description: submission.comments || '',
    stage: mapStatusToInterviewStage(submission.status),
    candidate_id: submission.candidate?.id,
    job_order_id: submission.jobOrder?.id,
    source: 'bullhorn',
    external_id: `bullhorn_job_submission_${submission.id}`,
    metadata: {
      bullhorn_id: submission.id,
      bullhorn_type: 'JobSubmission',
      bullhorn_status: submission.status,
      bullhorn_source: submission.source,
      bullhorn_sending_user: submission.sendingUser?.id,
      synced_at: new Date().toISOString(),
    },
  };
}

/**
 * Map Sendout to pipeline activity
 */
export function mapSendoutToActivity(sendout: BullhornSendout): {
  type: string;
  title: string;
  candidate_id?: number;
  job_order_id?: number;
  client_contact_id?: number;
  source: string;
  external_id: string;
  metadata: Record<string, unknown>;
} {
  return {
    type: 'resume_sent',
    title: 'Resume Sent to Client',
    candidate_id: sendout.candidate?.id,
    job_order_id: sendout.jobOrder?.id,
    client_contact_id: sendout.clientContact?.id,
    source: 'bullhorn',
    external_id: `bullhorn_sendout_${sendout.id}`,
    metadata: {
      bullhorn_id: sendout.id,
      bullhorn_type: 'Sendout',
      bullhorn_client_corporation_id: sendout.clientCorporation?.id,
      bullhorn_sending_user: sendout.sendingUser?.id,
      bullhorn_is_read: sendout.isRead,
      synced_at: new Date().toISOString(),
    },
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build search query for finding job submissions
 */
export function buildJobSubmissionSearchQuery(criteria: {
  candidateId?: number;
  jobOrderId?: number;
  status?: string;
  sendingUserId?: number;
  isDeleted?: boolean;
  modifiedSince?: number;
}): string {
  const parts: string[] = [];

  if (criteria.candidateId) {
    parts.push(`candidate.id:${criteria.candidateId}`);
  }

  if (criteria.jobOrderId) {
    parts.push(`jobOrder.id:${criteria.jobOrderId}`);
  }

  if (criteria.status) {
    parts.push(`status:"${criteria.status}"`);
  }

  if (criteria.sendingUserId) {
    parts.push(`sendingUser.id:${criteria.sendingUserId}`);
  }

  if (criteria.isDeleted !== undefined) {
    parts.push(`isDeleted:${criteria.isDeleted}`);
  } else {
    // Default to excluding deleted
    parts.push('isDeleted:false');
  }

  if (criteria.modifiedSince) {
    parts.push(`dateLastModified:[${criteria.modifiedSince} TO *]`);
  }

  return parts.length > 0 ? parts.join(' AND ') : '*';
}

/**
 * Check if status indicates interview is in progress
 */
export function isInterviewInProgress(status?: string): boolean {
  const inProgressStatuses = [
    JOB_SUBMISSION_STATUS.INTERVIEW_SCHEDULED,
    JOB_SUBMISSION_STATUS.FIRST_INTERVIEW,
    JOB_SUBMISSION_STATUS.SECOND_INTERVIEW,
    JOB_SUBMISSION_STATUS.THIRD_INTERVIEW,
  ];
  return inProgressStatuses.includes(status as (typeof inProgressStatuses)[number]);
}

/**
 * Check if status indicates offer stage
 */
export function isOfferStage(status?: string): boolean {
  const offerStatuses = [
    JOB_SUBMISSION_STATUS.OFFER_MADE,
    JOB_SUBMISSION_STATUS.OFFER_ACCEPTED,
  ];
  return offerStatuses.includes(status as (typeof offerStatuses)[number]);
}

/**
 * Check if status indicates closed/final status
 */
export function isFinalStatus(status?: string): boolean {
  const finalStatuses = [
    JOB_SUBMISSION_STATUS.PLACED,
    JOB_SUBMISSION_STATUS.REJECTED,
    JOB_SUBMISSION_STATUS.WITHDREW,
  ];
  return finalStatuses.includes(status as (typeof finalStatuses)[number]);
}

/**
 * Get next interview stage
 */
export function getNextInterviewStage(currentStatus?: string): string | null {
  const stageProgression: Record<string, string> = {
    [JOB_SUBMISSION_STATUS.NEW]: JOB_SUBMISSION_STATUS.SUBMITTED,
    [JOB_SUBMISSION_STATUS.WEBRESPONSE]: JOB_SUBMISSION_STATUS.SUBMITTED,
    [JOB_SUBMISSION_STATUS.SUBMITTED]: JOB_SUBMISSION_STATUS.FIRST_INTERVIEW,
    [JOB_SUBMISSION_STATUS.INTERVIEW_SCHEDULED]: JOB_SUBMISSION_STATUS.FIRST_INTERVIEW,
    [JOB_SUBMISSION_STATUS.FIRST_INTERVIEW]: JOB_SUBMISSION_STATUS.SECOND_INTERVIEW,
    [JOB_SUBMISSION_STATUS.SECOND_INTERVIEW]: JOB_SUBMISSION_STATUS.THIRD_INTERVIEW,
    [JOB_SUBMISSION_STATUS.THIRD_INTERVIEW]: JOB_SUBMISSION_STATUS.OFFER_MADE,
    [JOB_SUBMISSION_STATUS.OFFER_MADE]: JOB_SUBMISSION_STATUS.OFFER_ACCEPTED,
    [JOB_SUBMISSION_STATUS.OFFER_ACCEPTED]: JOB_SUBMISSION_STATUS.PLACED,
  };
  return stageProgression[currentStatus || ''] || null;
}
