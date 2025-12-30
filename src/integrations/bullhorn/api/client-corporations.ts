/**
 * Bullhorn ClientCorporation API Module
 *
 * Provides CRUD operations and search for Bullhorn ClientCorporation entities.
 * ClientCorporations represent companies/clients in the recruitment system.
 */

import type { BullhornClientCorporation, BullhornSearchResponse } from '../types/bullhorn';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CLIENT_CORPORATION_FIELDS = [
  'id',
  'name',
  'companyDescription',
  'status',
  'phone',
  'fax',
  'address',
  'billingAddress',
  'annualRevenue',
  'numEmployees',
  'numOffices',
  'industry',
  'businessSectorList',
  'notes',
  'dateAdded',
  'dateLastModified',
  'externalID',
  'customText1',
  'customText2',
  'customText3',
].join(',');

// =============================================================================
// Types
// =============================================================================

export interface ClientCorporationSearchParams {
  query: string;
  fields?: string;
  count?: number;
  start?: number;
  sort?: string;
}

export interface ClientCorporationCreateData {
  name: string;
  companyDescription?: string;
  status?: string;
  phone?: string;
  fax?: string;
  address?: {
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    zip?: string;
    countryID?: number;
  };
  annualRevenue?: number;
  numEmployees?: number;
  industry?: string;
  notes?: string;
  externalID?: string;
  customText1?: string;
  customText2?: string;
  customText3?: string;
}

export interface ClientCorporationUpdateData extends Partial<ClientCorporationCreateData> {
  // All fields optional for updates
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Get a single client corporation by ID
 */
export function getClientCorporationRequest(
  id: number,
  fields: string = DEFAULT_CLIENT_CORPORATION_FIELDS
): { method: 'GET'; path: string; query: Record<string, string> } {
  return {
    method: 'GET',
    path: `entity/ClientCorporation/${id}`,
    query: { fields },
  };
}

/**
 * Search client corporations using Lucene query syntax
 */
export function searchClientCorporationsRequest(
  params: ClientCorporationSearchParams
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/ClientCorporation',
    query: {
      query: params.query,
      fields: params.fields || DEFAULT_CLIENT_CORPORATION_FIELDS,
      count: params.count || 20,
      start: params.start || 0,
      ...(params.sort && { sort: params.sort }),
    },
  };
}

/**
 * Search client corporation by name
 */
export function searchClientCorporationByNameRequest(
  name: string,
  fields: string = DEFAULT_CLIENT_CORPORATION_FIELDS
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  const escapedName = name.replace(/[+\-&|!(){}[\]^"~*?:\\]/g, '\\$&');

  return {
    method: 'GET',
    path: 'search/ClientCorporation',
    query: {
      query: `name:"${escapedName}"`,
      fields,
      count: 10,
      start: 0,
    },
  };
}

/**
 * Create a new client corporation
 */
export function createClientCorporationRequest(
  data: ClientCorporationCreateData
): { method: 'PUT'; path: string; body: ClientCorporationCreateData } {
  return {
    method: 'PUT',
    path: 'entity/ClientCorporation',
    body: data,
  };
}

/**
 * Update an existing client corporation
 */
export function updateClientCorporationRequest(
  id: number,
  data: ClientCorporationUpdateData
): { method: 'POST'; path: string; body: ClientCorporationUpdateData } {
  return {
    method: 'POST',
    path: `entity/ClientCorporation/${id}`,
    body: data,
  };
}

/**
 * Soft delete a client corporation
 */
export function deleteClientCorporationRequest(
  id: number
): { method: 'POST'; path: string; body: { isDeleted: boolean } } {
  return {
    method: 'POST',
    path: `entity/ClientCorporation/${id}`,
    body: { isDeleted: true },
  };
}

/**
 * Get multiple client corporations by IDs
 */
export function getClientCorporationsByIdsRequest(
  ids: number[],
  fields: string = DEFAULT_CLIENT_CORPORATION_FIELDS
): { method: 'GET'; path: string; query: Record<string, string> } {
  return {
    method: 'GET',
    path: `entity/ClientCorporation/${ids.join(',')}`,
    query: { fields },
  };
}

/**
 * Query client corporations modified since a timestamp
 */
export function getClientCorporationsModifiedSinceRequest(
  sinceTimestamp: number,
  fields: string = DEFAULT_CLIENT_CORPORATION_FIELDS,
  count: number = 100,
  start: number = 0
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/ClientCorporation',
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
 * Map use60 company/account to Bullhorn ClientCorporation format
 */
export function mapCompanyToClientCorporation(company: {
  name: string;
  description?: string;
  phone?: string;
  industry?: string;
  employee_count?: number;
  annual_revenue?: number;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
  metadata?: Record<string, unknown>;
}): ClientCorporationCreateData {
  return {
    name: company.name,
    companyDescription: company.description || undefined,
    phone: company.phone || undefined,
    industry: company.industry || undefined,
    numEmployees: company.employee_count || undefined,
    annualRevenue: company.annual_revenue || undefined,
    address: company.address
      ? {
          address1: company.address.street,
          city: company.address.city,
          state: company.address.state,
          zip: company.address.postal_code,
        }
      : undefined,
  };
}

/**
 * Map Bullhorn ClientCorporation to use60 company format
 */
export function mapClientCorporationToCompany(corporation: BullhornClientCorporation): {
  name: string;
  description: string | null;
  phone: string | null;
  industry: string | null;
  employee_count: number | null;
  annual_revenue: number | null;
  status: string;
  source: string;
  external_id: string;
  address: {
    street: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
  } | null;
  metadata: Record<string, unknown>;
} {
  const address = corporation.address;

  return {
    name: corporation.name || '',
    description: corporation.companyDescription || null,
    phone: corporation.phone || null,
    industry: corporation.industry || null,
    employee_count: corporation.numEmployees || null,
    annual_revenue: corporation.annualRevenue || null,
    status: mapBullhornStatusToCompanyStatus(corporation.status),
    source: 'bullhorn',
    external_id: `bullhorn_client_corporation_${corporation.id}`,
    address: address
      ? {
          street: address.address1 || null,
          city: address.city || null,
          state: address.state || null,
          postal_code: address.zip || null,
          country: address.countryName || null,
        }
      : null,
    metadata: {
      bullhorn_id: corporation.id,
      bullhorn_type: 'ClientCorporation',
      bullhorn_status: corporation.status,
      bullhorn_num_offices: corporation.numOffices,
      synced_at: new Date().toISOString(),
    },
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Map Bullhorn status to use60 company status
 */
function mapBullhornStatusToCompanyStatus(status?: string): string {
  const statusMap: Record<string, string> = {
    'Client': 'active',
    'Prospective Client': 'prospect',
    'Former Client': 'inactive',
    'Archive': 'archived',
  };
  return statusMap[status || ''] || 'active';
}

/**
 * Build search query for finding client corporations
 */
export function buildClientCorporationSearchQuery(criteria: {
  name?: string;
  phone?: string;
  industry?: string;
  status?: string;
  modifiedSince?: number;
}): string {
  const parts: string[] = [];

  if (criteria.name) {
    parts.push(`name:${criteria.name}*`);
  }

  if (criteria.phone) {
    const cleanPhone = criteria.phone.replace(/\D/g, '');
    parts.push(`phone:*${cleanPhone}*`);
  }

  if (criteria.industry) {
    parts.push(`industry:"${criteria.industry}"`);
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
 * Calculate match score for company matching
 */
export function calculateClientCorporationMatchScore(
  corporation: BullhornClientCorporation,
  company: { name?: string; phone?: string }
): number {
  let score = 0;

  // Name match (primary)
  if (company.name && corporation.name) {
    const corpNameLower = corporation.name.toLowerCase();
    const compNameLower = company.name.toLowerCase();

    if (corpNameLower === compNameLower) {
      score += 100;
    } else if (corpNameLower.includes(compNameLower) || compNameLower.includes(corpNameLower)) {
      score += 60;
    }
  }

  // Phone match (secondary)
  if (company.phone && corporation.phone) {
    const corpPhone = corporation.phone.replace(/\D/g, '');
    const compPhone = company.phone.replace(/\D/g, '');

    if (corpPhone === compPhone) {
      score += 30;
    } else if (corpPhone.includes(compPhone) || compPhone.includes(corpPhone)) {
      score += 15;
    }
  }

  return score;
}
