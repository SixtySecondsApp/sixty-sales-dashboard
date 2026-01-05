/**
 * Bullhorn Placement API Module
 *
 * Provides read operations and search for Bullhorn Placement entities.
 * Placements represent successful hires - candidates placed in job orders.
 * They track billing, employment dates, and placement details.
 */

import type { BullhornPlacement, BullhornSearchResponse } from '../types/bullhorn';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_PLACEMENT_FIELDS = [
  'id',
  'status',
  'candidate',
  'jobOrder',
  'clientContact',
  'clientCorporation',
  'jobSubmission',
  'dateBegin',
  'dateEnd',
  'dateAdded',
  'dateLastModified',
  'employmentType',
  'fee',
  'payRate',
  'clientBillRate',
  'salary',
  'salaryUnit',
  'hoursPerDay',
  'daysPerWeek',
  'correlatedCustomText1',
  'correlatedCustomText2',
  'customText1',
  'customText2',
  'customText3',
  'customFloat1',
  'customFloat2',
  'customDate1',
  'externalID',
  'referralFee',
  'referralFeeType',
  'onboardingStatus',
  'employeeType',
  'owner',
  'comments',
].join(',');

// Placement status values in Bullhorn
export const PLACEMENT_STATUS = {
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  TERMINATED: 'Terminated',
} as const;

// Employment types
export const EMPLOYMENT_TYPE = {
  CONTRACT: 'Contract',
  DIRECT_HIRE: 'Direct Hire',
  PERMANENT: 'Permanent',
  TEMP_TO_PERM: 'Temp to Perm',
  RIGHT_TO_HIRE: 'Right to Hire',
} as const;

// =============================================================================
// Types
// =============================================================================

export interface PlacementSearchParams {
  query: string;
  fields?: string;
  count?: number;
  start?: number;
  sort?: string;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Get a single placement by ID
 */
export function getPlacementRequest(
  id: number,
  fields: string = DEFAULT_PLACEMENT_FIELDS
): { method: 'GET'; path: string; query: Record<string, string> } {
  return {
    method: 'GET',
    path: `entity/Placement/${id}`,
    query: { fields },
  };
}

/**
 * Search placements using Lucene query syntax
 */
export function searchPlacementsRequest(
  params: PlacementSearchParams
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Placement',
    query: {
      query: params.query,
      fields: params.fields || DEFAULT_PLACEMENT_FIELDS,
      count: params.count || 50,
      start: params.start || 0,
      ...(params.sort && { sort: params.sort }),
    },
  };
}

/**
 * Search placements by candidate
 */
export function searchPlacementsByCandidateRequest(
  candidateId: number,
  fields: string = DEFAULT_PLACEMENT_FIELDS,
  count: number = 20
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Placement',
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
 * Search placements by job order
 */
export function searchPlacementsByJobOrderRequest(
  jobOrderId: number,
  fields: string = DEFAULT_PLACEMENT_FIELDS,
  count: number = 50
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Placement',
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
 * Search placements by client corporation
 */
export function searchPlacementsByClientRequest(
  clientCorporationId: number,
  fields: string = DEFAULT_PLACEMENT_FIELDS,
  count: number = 100
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Placement',
    query: {
      query: `clientCorporation.id:${clientCorporationId}`,
      fields,
      count,
      start: 0,
      sort: '-dateAdded',
    },
  };
}

/**
 * Search placements by status
 */
export function searchPlacementsByStatusRequest(
  status: string,
  fields: string = DEFAULT_PLACEMENT_FIELDS,
  count: number = 100
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Placement',
    query: {
      query: `status:"${status}"`,
      fields,
      count,
      start: 0,
      sort: '-dateAdded',
    },
  };
}

/**
 * Search active placements
 */
export function searchActivePlacementsRequest(
  fields: string = DEFAULT_PLACEMENT_FIELDS,
  count: number = 100
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Placement',
    query: {
      query: `status:"${PLACEMENT_STATUS.ACTIVE}"`,
      fields,
      count,
      start: 0,
      sort: '-dateBegin',
    },
  };
}

/**
 * Search placements ending soon (within next 30 days)
 */
export function searchPlacementsEndingSoonRequest(
  daysAhead: number = 30,
  fields: string = DEFAULT_PLACEMENT_FIELDS,
  count: number = 100
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  const now = Date.now();
  const futureDate = now + daysAhead * 24 * 60 * 60 * 1000;
  return {
    method: 'GET',
    path: 'search/Placement',
    query: {
      query: `status:"${PLACEMENT_STATUS.ACTIVE}" AND dateEnd:[${now} TO ${futureDate}]`,
      fields,
      count,
      start: 0,
      sort: 'dateEnd',
    },
  };
}

/**
 * Search recent placements (created in last N days)
 */
export function searchRecentPlacementsRequest(
  daysBack: number = 30,
  fields: string = DEFAULT_PLACEMENT_FIELDS,
  count: number = 100
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  const pastDate = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  return {
    method: 'GET',
    path: 'search/Placement',
    query: {
      query: `dateAdded:[${pastDate} TO *]`,
      fields,
      count,
      start: 0,
      sort: '-dateAdded',
    },
  };
}

/**
 * Get multiple placements by IDs
 */
export function getPlacementsByIdsRequest(
  ids: number[],
  fields: string = DEFAULT_PLACEMENT_FIELDS
): { method: 'GET'; path: string; query: Record<string, string> } {
  return {
    method: 'GET',
    path: `entity/Placement/${ids.join(',')}`,
    query: { fields },
  };
}

/**
 * Query placements modified since a timestamp
 */
export function getPlacementsModifiedSinceRequest(
  sinceTimestamp: number,
  fields: string = DEFAULT_PLACEMENT_FIELDS,
  count: number = 100,
  start: number = 0
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Placement',
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
 * Map Bullhorn Placement to deal/win data
 */
export function mapPlacementToDealWin(placement: BullhornPlacement): {
  status: string;
  stage: string;
  value: number | null;
  close_date: string | null;
  employment_type: string | null;
  start_date: string | null;
  end_date: string | null;
  source: string;
  external_id: string;
  metadata: Record<string, unknown>;
} {
  // Calculate total value based on employment type
  let totalValue = null;
  if (placement.fee) {
    totalValue = placement.fee;
  } else if (placement.salary) {
    // For permanent placements, fee might be percentage of salary
    totalValue = placement.salary;
  } else if (placement.payRate && placement.dateBegin && placement.dateEnd) {
    // For contract placements, estimate total value
    const startDate = new Date(placement.dateBegin);
    const endDate = new Date(placement.dateEnd);
    const weeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const hoursPerWeek = (placement.hoursPerDay || 8) * (placement.daysPerWeek || 5);
    totalValue = placement.payRate * hoursPerWeek * weeks;
  }

  return {
    status: 'won',
    stage: 'won',
    value: totalValue,
    close_date: placement.dateAdded ? new Date(placement.dateAdded).toISOString() : null,
    employment_type: placement.employmentType || null,
    start_date: placement.dateBegin ? new Date(placement.dateBegin).toISOString() : null,
    end_date: placement.dateEnd ? new Date(placement.dateEnd).toISOString() : null,
    source: 'bullhorn',
    external_id: `bullhorn_placement_${placement.id}`,
    metadata: {
      bullhorn_id: placement.id,
      bullhorn_type: 'Placement',
      bullhorn_status: placement.status,
      bullhorn_employment_type: placement.employmentType,
      bullhorn_candidate_id: placement.candidate?.id,
      bullhorn_job_order_id: placement.jobOrder?.id,
      bullhorn_client_corporation_id: placement.clientCorporation?.id,
      bullhorn_client_contact_id: placement.clientContact?.id,
      bullhorn_job_submission_id: placement.jobSubmission?.id,
      bullhorn_fee: placement.fee,
      bullhorn_pay_rate: placement.payRate,
      bullhorn_bill_rate: placement.clientBillRate,
      bullhorn_salary: placement.salary,
      synced_at: new Date().toISOString(),
    },
  };
}

/**
 * Map Placement to activity record
 */
export function mapPlacementToActivity(placement: BullhornPlacement): {
  type: string;
  title: string;
  description: string;
  date: string;
  value: number | null;
  source: string;
  external_id: string;
  metadata: Record<string, unknown>;
} {
  return {
    type: 'placement',
    title: `Placement: ${placement.status || 'New'}`,
    description: placement.comments || `${placement.employmentType || 'Placement'} starting ${placement.dateBegin ? new Date(placement.dateBegin).toLocaleDateString() : 'TBD'}`,
    date: placement.dateAdded ? new Date(placement.dateAdded).toISOString() : new Date().toISOString(),
    value: placement.fee || placement.salary || null,
    source: 'bullhorn',
    external_id: `bullhorn_placement_${placement.id}`,
    metadata: {
      bullhorn_id: placement.id,
      bullhorn_type: 'Placement',
      bullhorn_status: placement.status,
      bullhorn_candidate_id: placement.candidate?.id,
      bullhorn_job_order_id: placement.jobOrder?.id,
      synced_at: new Date().toISOString(),
    },
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build search query for finding placements
 */
export function buildPlacementSearchQuery(criteria: {
  candidateId?: number;
  jobOrderId?: number;
  clientCorporationId?: number;
  clientContactId?: number;
  status?: string;
  employmentType?: string;
  dateBeginFrom?: number;
  dateBeginTo?: number;
  modifiedSince?: number;
}): string {
  const parts: string[] = [];

  if (criteria.candidateId) {
    parts.push(`candidate.id:${criteria.candidateId}`);
  }

  if (criteria.jobOrderId) {
    parts.push(`jobOrder.id:${criteria.jobOrderId}`);
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

  if (criteria.employmentType) {
    parts.push(`employmentType:"${criteria.employmentType}"`);
  }

  if (criteria.dateBeginFrom && criteria.dateBeginTo) {
    parts.push(`dateBegin:[${criteria.dateBeginFrom} TO ${criteria.dateBeginTo}]`);
  } else if (criteria.dateBeginFrom) {
    parts.push(`dateBegin:[${criteria.dateBeginFrom} TO *]`);
  } else if (criteria.dateBeginTo) {
    parts.push(`dateBegin:[* TO ${criteria.dateBeginTo}]`);
  }

  if (criteria.modifiedSince) {
    parts.push(`dateLastModified:[${criteria.modifiedSince} TO *]`);
  }

  return parts.length > 0 ? parts.join(' AND ') : '*';
}

/**
 * Check if placement is active
 */
export function isPlacementActive(placement: BullhornPlacement): boolean {
  if (placement.status !== PLACEMENT_STATUS.ACTIVE) {
    return false;
  }

  const now = Date.now();
  const startDate = placement.dateBegin || 0;
  const endDate = placement.dateEnd || Number.MAX_SAFE_INTEGER;

  return now >= startDate && now <= endDate;
}

/**
 * Check if placement is ending soon
 */
export function isPlacementEndingSoon(
  placement: BullhornPlacement,
  daysThreshold: number = 30
): boolean {
  if (!placement.dateEnd || placement.status !== PLACEMENT_STATUS.ACTIVE) {
    return false;
  }

  const now = Date.now();
  const endDate = placement.dateEnd;
  const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000;

  return endDate > now && endDate <= now + thresholdMs;
}

/**
 * Calculate placement duration in days
 */
export function calculatePlacementDuration(placement: BullhornPlacement): number | null {
  if (!placement.dateBegin) {
    return null;
  }

  const endDate = placement.dateEnd || Date.now();
  const startDate = placement.dateBegin;

  return Math.floor((endDate - startDate) / (24 * 60 * 60 * 1000));
}

/**
 * Calculate gross margin from placement
 */
export function calculatePlacementMargin(placement: BullhornPlacement): number | null {
  if (!placement.payRate || !placement.clientBillRate) {
    return null;
  }

  return ((placement.clientBillRate - placement.payRate) / placement.clientBillRate) * 100;
}

/**
 * Get placement value summary
 */
export function getPlacementValueSummary(placement: BullhornPlacement): {
  fee: number | null;
  payRate: number | null;
  billRate: number | null;
  salary: number | null;
  margin: number | null;
  estimatedRevenue: number | null;
} {
  let estimatedRevenue = null;

  if (placement.fee) {
    estimatedRevenue = placement.fee;
  } else if (placement.clientBillRate && placement.payRate && placement.dateBegin && placement.dateEnd) {
    const startDate = new Date(placement.dateBegin);
    const endDate = new Date(placement.dateEnd);
    const weeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const hoursPerWeek = (placement.hoursPerDay || 8) * (placement.daysPerWeek || 5);
    const margin = placement.clientBillRate - placement.payRate;
    estimatedRevenue = margin * hoursPerWeek * weeks;
  }

  return {
    fee: placement.fee || null,
    payRate: placement.payRate || null,
    billRate: placement.clientBillRate || null,
    salary: placement.salary || null,
    margin: calculatePlacementMargin(placement),
    estimatedRevenue,
  };
}

/**
 * Map placement status to deal outcome
 */
export function mapPlacementStatusToOutcome(status?: string): 'won' | 'active' | 'completed' | 'lost' {
  const statusMap: Record<string, 'won' | 'active' | 'completed' | 'lost'> = {
    [PLACEMENT_STATUS.SUBMITTED]: 'active',
    [PLACEMENT_STATUS.APPROVED]: 'won',
    [PLACEMENT_STATUS.ACTIVE]: 'active',
    [PLACEMENT_STATUS.COMPLETED]: 'completed',
    [PLACEMENT_STATUS.TERMINATED]: 'lost',
  };
  return statusMap[status || ''] || 'active';
}
