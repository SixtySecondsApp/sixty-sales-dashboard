/**
 * Bullhorn Candidate API Module
 *
 * Provides CRUD operations and search for Bullhorn Candidate entities.
 * Candidates represent job seekers/consultants in the recruitment pipeline.
 */

import type { BullhornCandidate, BullhornSearchResponse } from '../types/bullhorn';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CANDIDATE_FIELDS = [
  'id',
  'firstName',
  'lastName',
  'name',
  'email',
  'email2',
  'email3',
  'phone',
  'mobile',
  'status',
  'source',
  'owner',
  'address',
  'salary',
  'dayRate',
  'hourlyRate',
  'skillSet',
  'experience',
  'dateAvailable',
  'employmentPreference',
  'customText1',
  'customText2',
  'customText3',
  'customFloat1',
  'dateAdded',
  'dateLastModified',
  'externalID',
].join(',');

// =============================================================================
// Types
// =============================================================================

export interface CandidateSearchParams {
  query: string;
  fields?: string;
  count?: number;
  start?: number;
  sort?: string;
}

export interface CandidateCreateData {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  status?: string;
  source?: string;
  address?: {
    address1?: string;
    city?: string;
    state?: string;
    zip?: string;
    countryID?: number;
  };
  salary?: number;
  dayRate?: number;
  hourlyRate?: number;
  skillSet?: string;
  dateAvailable?: number;
  employmentPreference?: string;
  customText1?: string;
  customText2?: string;
  customText3?: string;
  customFloat1?: number;
  externalID?: string;
  owner?: { id: number };
}

export interface CandidateUpdateData extends Partial<CandidateCreateData> {
  // All fields optional for updates
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Get a single candidate by ID
 */
export function getCandidateRequest(
  id: number,
  fields: string = DEFAULT_CANDIDATE_FIELDS
): { method: 'GET'; path: string; query: Record<string, string> } {
  return {
    method: 'GET',
    path: `entity/Candidate/${id}`,
    query: { fields },
  };
}

/**
 * Search candidates using Lucene query syntax
 *
 * Query examples:
 * - email:john@example.com
 * - firstName:John AND lastName:Doe
 * - status:Active AND dateLastModified:[2024-01-01 TO *]
 */
export function searchCandidatesRequest(
  params: CandidateSearchParams
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Candidate',
    query: {
      query: params.query,
      fields: params.fields || DEFAULT_CANDIDATE_FIELDS,
      count: params.count || 20,
      start: params.start || 0,
      ...(params.sort && { sort: params.sort }),
    },
  };
}

/**
 * Search candidate by email address
 */
export function searchCandidateByEmailRequest(
  email: string,
  fields: string = DEFAULT_CANDIDATE_FIELDS
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  // Escape special Lucene characters in email
  const escapedEmail = email.replace(/[+\-&|!(){}[\]^"~*?:\\]/g, '\\$&');

  return {
    method: 'GET',
    path: 'search/Candidate',
    query: {
      query: `email:"${escapedEmail}" OR email2:"${escapedEmail}" OR email3:"${escapedEmail}"`,
      fields,
      count: 10,
      start: 0,
    },
  };
}

/**
 * Create a new candidate
 * Note: Bullhorn uses PUT for creates
 */
export function createCandidateRequest(
  data: CandidateCreateData
): { method: 'PUT'; path: string; body: CandidateCreateData } {
  return {
    method: 'PUT',
    path: 'entity/Candidate',
    body: data,
  };
}

/**
 * Update an existing candidate
 * Note: Bullhorn uses POST for updates
 */
export function updateCandidateRequest(
  id: number,
  data: CandidateUpdateData
): { method: 'POST'; path: string; body: CandidateUpdateData } {
  return {
    method: 'POST',
    path: `entity/Candidate/${id}`,
    body: data,
  };
}

/**
 * Soft delete a candidate (set isDeleted = true)
 */
export function deleteCandidateRequest(
  id: number
): { method: 'POST'; path: string; body: { isDeleted: boolean } } {
  return {
    method: 'POST',
    path: `entity/Candidate/${id}`,
    body: { isDeleted: true },
  };
}

/**
 * Get multiple candidates by IDs in a single request
 */
export function getCandidatesByIdsRequest(
  ids: number[],
  fields: string = DEFAULT_CANDIDATE_FIELDS
): { method: 'GET'; path: string; query: Record<string, string> } {
  return {
    method: 'GET',
    path: `entity/Candidate/${ids.join(',')}`,
    query: { fields },
  };
}

/**
 * Query candidates modified since a timestamp (for incremental sync)
 */
export function getCandidatesModifiedSinceRequest(
  sinceTimestamp: number,
  fields: string = DEFAULT_CANDIDATE_FIELDS,
  count: number = 100,
  start: number = 0
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/Candidate',
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
 * Map use60 contact to Bullhorn Candidate format
 */
export function mapContactToCandidate(contact: {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}): CandidateCreateData {
  return {
    firstName: contact.first_name || '',
    lastName: contact.last_name || '',
    email: contact.email || undefined,
    phone: contact.phone || undefined,
    status: mapContactStatusToBullhorn(contact.status),
    source: 'use60',
  };
}

/**
 * Map Bullhorn Candidate to use60 contact format
 */
export function mapCandidateToContact(candidate: BullhornCandidate): {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  source: string;
  external_id: string;
  metadata: Record<string, unknown>;
} {
  return {
    first_name: candidate.firstName || '',
    last_name: candidate.lastName || '',
    email: candidate.email || null,
    phone: candidate.phone || candidate.mobile || null,
    status: mapBullhornStatusToContact(candidate.status),
    source: 'bullhorn',
    external_id: `bullhorn_candidate_${candidate.id}`,
    metadata: {
      bullhorn_id: candidate.id,
      bullhorn_type: 'Candidate',
      bullhorn_status: candidate.status,
      bullhorn_owner: candidate.owner,
      bullhorn_source: candidate.source,
      synced_at: new Date().toISOString(),
    },
  };
}

/**
 * Map use60 contact status to Bullhorn status
 */
function mapContactStatusToBullhorn(status?: string): string {
  const statusMap: Record<string, string> = {
    active: 'Active',
    inactive: 'Inactive',
    lead: 'New Lead',
    qualified: 'Qualified',
    // Add more mappings as needed
  };
  return statusMap[status || ''] || 'Active';
}

/**
 * Map Bullhorn status to use60 contact status
 */
function mapBullhornStatusToContact(status?: string): string {
  const statusMap: Record<string, string> = {
    Active: 'active',
    Inactive: 'inactive',
    'New Lead': 'lead',
    Qualified: 'qualified',
    Submitted: 'qualified',
    'Placed': 'active',
    // Add more mappings as needed
  };
  return statusMap[status || ''] || 'active';
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Build search query for finding candidates by multiple criteria
 */
export function buildCandidateSearchQuery(criteria: {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  status?: string;
  modifiedSince?: number;
}): string {
  const parts: string[] = [];

  if (criteria.email) {
    const escapedEmail = criteria.email.replace(/[+\-&|!(){}[\]^"~*?:\\]/g, '\\$&');
    parts.push(`(email:"${escapedEmail}" OR email2:"${escapedEmail}" OR email3:"${escapedEmail}")`);
  }

  if (criteria.firstName) {
    parts.push(`firstName:${criteria.firstName}*`);
  }

  if (criteria.lastName) {
    parts.push(`lastName:${criteria.lastName}*`);
  }

  if (criteria.phone) {
    const cleanPhone = criteria.phone.replace(/\D/g, '');
    parts.push(`(phone:*${cleanPhone}* OR mobile:*${cleanPhone}*)`);
  }

  if (criteria.status) {
    parts.push(`status:"${criteria.status}"`);
  }

  if (criteria.modifiedSince) {
    parts.push(`dateLastModified:[${criteria.modifiedSince} TO *]`);
  }

  return parts.length > 0 ? parts.join(' AND ') : '*';
}

/**
 * Extract candidate match score based on field similarity
 */
export function calculateCandidateMatchScore(
  candidate: BullhornCandidate,
  contact: { email?: string; first_name?: string; last_name?: string; phone?: string }
): number {
  let score = 0;
  const weights = { email: 50, firstName: 20, lastName: 20, phone: 10 };

  // Email match (highest weight)
  if (contact.email) {
    const candidateEmails = [candidate.email, candidate.email2, candidate.email3]
      .filter(Boolean)
      .map((e) => e?.toLowerCase());
    if (candidateEmails.includes(contact.email.toLowerCase())) {
      score += weights.email;
    }
  }

  // Name match
  if (contact.first_name && candidate.firstName?.toLowerCase() === contact.first_name.toLowerCase()) {
    score += weights.firstName;
  }
  if (contact.last_name && candidate.lastName?.toLowerCase() === contact.last_name.toLowerCase()) {
    score += weights.lastName;
  }

  // Phone match (normalize numbers)
  if (contact.phone) {
    const contactPhone = contact.phone.replace(/\D/g, '');
    const candidatePhones = [candidate.phone, candidate.mobile]
      .filter(Boolean)
      .map((p) => p?.replace(/\D/g, ''));
    if (candidatePhones.some((p) => p && (p.includes(contactPhone) || contactPhone.includes(p)))) {
      score += weights.phone;
    }
  }

  return score;
}
