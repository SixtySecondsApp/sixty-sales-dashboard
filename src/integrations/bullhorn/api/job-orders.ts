/**
 * Bullhorn JobOrder API Module
 *
 * Provides CRUD operations and search for Bullhorn JobOrder entities.
 * JobOrders represent job requisitions/openings in the recruitment pipeline.
 */

import type { BullhornJobOrder, BullhornSearchResponse } from '../types/bullhorn';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_JOB_ORDER_FIELDS = [
  'id',
  'title',
  'status',
  'employmentType',
  'publicDescription',
  'description',
  'salary',
  'salaryUnit',
  'payRate',
  'clientBillRate',
  'numOpenings',
  'onSite',
  'startDate',
  'dateEnd',
  'isOpen',
  'isPublic',
  'isDeleted',
  'clientCorporation',
  'clientContact',
  'owner',
  'address',
  'skills',
  'categories',
  'yearsRequired',
  'educationDegree',
  'dateAdded',
  'dateLastModified',
  'externalID',
  'customText1',
  'customText2',
  'customText3',
  'customFloat1',
  'customFloat2',
  'customDate1',
].join(',');

// =============================================================================
// Types
// =============================================================================

export interface JobOrderSearchParams {
  query: string;
  fields?: string;
  count?: number;
  start?: number;
  sort?: string;
}

export interface JobOrderCreateData {
  title: string;
  status?: string;
  employmentType?: string;
  publicDescription?: string;
  description?: string;
  salary?: number;
  salaryUnit?: string;
  payRate?: number;
  clientBillRate?: number;
  numOpenings?: number;
  onSite?: string;
  startDate?: number;
  dateEnd?: number;
  isOpen?: boolean;
  isPublic?: boolean;
  clientCorporation?: { id: number };
  clientContact?: { id: number };
  owner?: { id: number };
  address?: {
    address1?: string;
    city?: string;
    state?: string;
    zip?: string;
    countryID?: number;
  };
  skills?: { id: number; name?: string }[];
  yearsRequired?: number;
  educationDegree?: string;
  externalID?: string;
  customText1?: string;
  customText2?: string;
  customText3?: string;
  customFloat1?: number;
  customFloat2?: number;
  customDate1?: number;
}

export interface JobOrderUpdateData extends Partial<JobOrderCreateData> {
  // All fields optional for updates
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Get a single job order by ID
 */
export function getJobOrderRequest(
  id: number,
  fields: string = DEFAULT_JOB_ORDER_FIELDS
): { method: 'GET'; path: string; query: Record<string, string> } {
  return {
    method: 'GET',
    path: `entity/JobOrder/${id}`,
    query: { fields },
  };
}

/**
 * Search job orders using Lucene query syntax
 */
export function searchJobOrdersRequest(
  params: JobOrderSearchParams
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/JobOrder',
    query: {
      query: params.query,
      fields: params.fields || DEFAULT_JOB_ORDER_FIELDS,
      count: params.count || 20,
      start: params.start || 0,
      ...(params.sort && { sort: params.sort }),
    },
  };
}

/**
 * Search job orders by title
 */
export function searchJobOrderByTitleRequest(
  title: string,
  fields: string = DEFAULT_JOB_ORDER_FIELDS
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  const escapedTitle = title.replace(/[+\-&|!(){}[\]^"~*?:\\]/g, '\\$&');

  return {
    method: 'GET',
    path: 'search/JobOrder',
    query: {
      query: `title:"${escapedTitle}"`,
      fields,
      count: 10,
      start: 0,
    },
  };
}

/**
 * Search job orders by client corporation ID
 */
export function searchJobOrdersByClientRequest(
  clientCorporationId: number,
  fields: string = DEFAULT_JOB_ORDER_FIELDS,
  count: number = 50
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/JobOrder',
    query: {
      query: `clientCorporation.id:${clientCorporationId} AND isOpen:true`,
      fields,
      count,
      start: 0,
      sort: '-dateAdded',
    },
  };
}

/**
 * Search open job orders
 */
export function searchOpenJobOrdersRequest(
  fields: string = DEFAULT_JOB_ORDER_FIELDS,
  count: number = 100,
  start: number = 0
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/JobOrder',
    query: {
      query: 'isOpen:true AND isDeleted:false',
      fields,
      count,
      start,
      sort: '-dateAdded',
    },
  };
}

/**
 * Create a new job order
 */
export function createJobOrderRequest(
  data: JobOrderCreateData
): { method: 'PUT'; path: string; body: JobOrderCreateData } {
  return {
    method: 'PUT',
    path: 'entity/JobOrder',
    body: data,
  };
}

/**
 * Update an existing job order
 */
export function updateJobOrderRequest(
  id: number,
  data: JobOrderUpdateData
): { method: 'POST'; path: string; body: JobOrderUpdateData } {
  return {
    method: 'POST',
    path: `entity/JobOrder/${id}`,
    body: data,
  };
}

/**
 * Soft delete a job order
 */
export function deleteJobOrderRequest(
  id: number
): { method: 'POST'; path: string; body: { isDeleted: boolean } } {
  return {
    method: 'POST',
    path: `entity/JobOrder/${id}`,
    body: { isDeleted: true },
  };
}

/**
 * Close a job order
 */
export function closeJobOrderRequest(
  id: number
): { method: 'POST'; path: string; body: { isOpen: boolean; status: string } } {
  return {
    method: 'POST',
    path: `entity/JobOrder/${id}`,
    body: { isOpen: false, status: 'Closed' },
  };
}

/**
 * Get multiple job orders by IDs
 */
export function getJobOrdersByIdsRequest(
  ids: number[],
  fields: string = DEFAULT_JOB_ORDER_FIELDS
): { method: 'GET'; path: string; query: Record<string, string> } {
  return {
    method: 'GET',
    path: `entity/JobOrder/${ids.join(',')}`,
    query: { fields },
  };
}

/**
 * Query job orders modified since a timestamp
 */
export function getJobOrdersModifiedSinceRequest(
  sinceTimestamp: number,
  fields: string = DEFAULT_JOB_ORDER_FIELDS,
  count: number = 100,
  start: number = 0
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/JobOrder',
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
 * Map use60 deal/opportunity to Bullhorn JobOrder format
 */
export function mapDealToJobOrder(deal: {
  name: string;
  description?: string;
  value?: number;
  stage?: string;
  expected_close_date?: string;
  company_id?: string;
  contact_id?: string;
  metadata?: Record<string, unknown>;
}): JobOrderCreateData {
  return {
    title: deal.name,
    publicDescription: deal.description || undefined,
    salary: deal.value || undefined,
    startDate: deal.expected_close_date ? Date.parse(deal.expected_close_date) : undefined,
    status: mapDealStageToJobOrderStatus(deal.stage),
    isOpen: !['won', 'lost', 'closed'].includes(deal.stage?.toLowerCase() || ''),
    externalID: `use60_deal_${deal.metadata?.deal_id || ''}`,
  };
}

/**
 * Map Bullhorn JobOrder to use60 deal format
 */
export function mapJobOrderToDeal(jobOrder: BullhornJobOrder): {
  name: string;
  description: string | null;
  value: number | null;
  stage: string;
  expected_close_date: string | null;
  status: string;
  source: string;
  external_id: string;
  metadata: Record<string, unknown>;
} {
  return {
    name: jobOrder.title || '',
    description: jobOrder.publicDescription || jobOrder.description || null,
    value: jobOrder.salary || jobOrder.payRate || null,
    stage: mapJobOrderStatusToDealStage(jobOrder.status, jobOrder.isOpen),
    expected_close_date: jobOrder.startDate ? new Date(jobOrder.startDate).toISOString() : null,
    status: jobOrder.isOpen ? 'active' : 'closed',
    source: 'bullhorn',
    external_id: `bullhorn_job_order_${jobOrder.id}`,
    metadata: {
      bullhorn_id: jobOrder.id,
      bullhorn_type: 'JobOrder',
      bullhorn_status: jobOrder.status,
      bullhorn_employment_type: jobOrder.employmentType,
      bullhorn_client_corporation_id: jobOrder.clientCorporation?.id,
      bullhorn_client_contact_id: jobOrder.clientContact?.id,
      bullhorn_num_openings: jobOrder.numOpenings,
      bullhorn_is_open: jobOrder.isOpen,
      synced_at: new Date().toISOString(),
    },
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Map deal stage to Bullhorn JobOrder status
 */
function mapDealStageToJobOrderStatus(stage?: string): string {
  const stageMap: Record<string, string> = {
    lead: 'Accepting Candidates',
    qualified: 'Accepting Candidates',
    proposal: 'Currently Interviewing',
    negotiation: 'Offer Pending',
    won: 'Placed',
    lost: 'Cancelled',
    closed: 'Closed',
  };
  return stageMap[stage?.toLowerCase() || ''] || 'Accepting Candidates';
}

/**
 * Map Bullhorn JobOrder status to deal stage
 */
function mapJobOrderStatusToDealStage(status?: string, isOpen?: boolean): string {
  if (!isOpen) return 'closed';

  const statusMap: Record<string, string> = {
    'Accepting Candidates': 'qualified',
    'Currently Interviewing': 'proposal',
    'Offer Pending': 'negotiation',
    'Offer Extended': 'negotiation',
    'Placed': 'won',
    'Cancelled': 'lost',
    'Closed': 'closed',
    'On Hold': 'qualified',
  };
  return statusMap[status || ''] || 'qualified';
}

/**
 * Build search query for finding job orders
 */
export function buildJobOrderSearchQuery(criteria: {
  title?: string;
  clientCorporationId?: number;
  clientContactId?: number;
  status?: string;
  isOpen?: boolean;
  employmentType?: string;
  modifiedSince?: number;
}): string {
  const parts: string[] = [];

  if (criteria.title) {
    parts.push(`title:${criteria.title}*`);
  }

  if (criteria.clientCorporationId) {
    parts.push(`clientCorporation.id:${criteria.clientCorporationId}`);
  }

  if (criteria.clientContactId) {
    parts.push(`clientContact.id:${criteria.clientContactId}`);
  }

  if (criteria.status) {
    parts.push(`status:"${criteria.status}"`);
  }

  if (criteria.isOpen !== undefined) {
    parts.push(`isOpen:${criteria.isOpen}`);
  }

  if (criteria.employmentType) {
    parts.push(`employmentType:"${criteria.employmentType}"`);
  }

  if (criteria.modifiedSince) {
    parts.push(`dateLastModified:[${criteria.modifiedSince} TO *]`);
  }

  // Always exclude deleted
  parts.push('isDeleted:false');

  return parts.length > 0 ? parts.join(' AND ') : '*';
}

/**
 * Calculate match score for job order matching
 */
export function calculateJobOrderMatchScore(
  jobOrder: BullhornJobOrder,
  deal: { name?: string; company_id?: string; value?: number }
): number {
  let score = 0;

  // Title match (primary)
  if (deal.name && jobOrder.title) {
    const jobTitleLower = jobOrder.title.toLowerCase();
    const dealNameLower = deal.name.toLowerCase();

    if (jobTitleLower === dealNameLower) {
      score += 100;
    } else if (jobTitleLower.includes(dealNameLower) || dealNameLower.includes(jobTitleLower)) {
      score += 50;
    }
  }

  // Value match (secondary)
  if (deal.value && jobOrder.salary) {
    const valueDiff = Math.abs(deal.value - jobOrder.salary) / Math.max(deal.value, jobOrder.salary);
    if (valueDiff < 0.1) {
      score += 30; // Within 10%
    } else if (valueDiff < 0.25) {
      score += 15; // Within 25%
    }
  }

  return score;
}

// =============================================================================
// Submission Association
// =============================================================================

/**
 * Get submissions (candidate applications) for a job order
 */
export function getJobOrderSubmissionsRequest(
  jobOrderId: number,
  count: number = 100,
  start: number = 0
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/JobSubmission',
    query: {
      query: `jobOrder.id:${jobOrderId}`,
      fields: 'id,candidate,status,dateAdded,dateLastModified',
      count,
      start,
      sort: '-dateAdded',
    },
  };
}

/**
 * Associate a skill with a job order
 */
export function addJobOrderSkillRequest(
  jobOrderId: number,
  skillId: number
): { method: 'PUT'; path: string } {
  return {
    method: 'PUT',
    path: `entity/JobOrder/${jobOrderId}/skills/${skillId}`,
  };
}

/**
 * Remove a skill from a job order
 */
export function removeJobOrderSkillRequest(
  jobOrderId: number,
  skillId: number
): { method: 'DELETE'; path: string } {
  return {
    method: 'DELETE',
    path: `entity/JobOrder/${jobOrderId}/skills/${skillId}`,
  };
}
