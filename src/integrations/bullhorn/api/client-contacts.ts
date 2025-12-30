/**
 * Bullhorn ClientContact API Module
 *
 * Provides CRUD operations and search for Bullhorn ClientContact entities.
 * ClientContacts represent hiring managers and client-side contacts.
 */

import type { BullhornClientContact, BullhornSearchResponse } from '../types/bullhorn';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CLIENT_CONTACT_FIELDS = [
  'id',
  'firstName',
  'lastName',
  'name',
  'email',
  'email2',
  'email3',
  'phone',
  'phone2',
  'phone3',
  'mobile',
  'status',
  'type',
  'division',
  'occupation',
  'clientCorporation',
  'owner',
  'address',
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

export interface ClientContactSearchParams {
  query: string;
  fields?: string;
  count?: number;
  start?: number;
  sort?: string;
}

export interface ClientContactCreateData {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  status?: string;
  type?: string;
  occupation?: string;
  clientCorporation?: { id: number };
  owner?: { id: number };
  address?: {
    address1?: string;
    city?: string;
    state?: string;
    zip?: string;
    countryID?: number;
  };
  externalID?: string;
  customText1?: string;
  customText2?: string;
  customText3?: string;
}

export interface ClientContactUpdateData extends Partial<ClientContactCreateData> {
  // All fields optional for updates
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Get a single client contact by ID
 */
export function getClientContactRequest(
  id: number,
  fields: string = DEFAULT_CLIENT_CONTACT_FIELDS
): { method: 'GET'; path: string; query: Record<string, string> } {
  return {
    method: 'GET',
    path: `entity/ClientContact/${id}`,
    query: { fields },
  };
}

/**
 * Search client contacts using Lucene query syntax
 */
export function searchClientContactsRequest(
  params: ClientContactSearchParams
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/ClientContact',
    query: {
      query: params.query,
      fields: params.fields || DEFAULT_CLIENT_CONTACT_FIELDS,
      count: params.count || 20,
      start: params.start || 0,
      ...(params.sort && { sort: params.sort }),
    },
  };
}

/**
 * Search client contact by email address
 */
export function searchClientContactByEmailRequest(
  email: string,
  fields: string = DEFAULT_CLIENT_CONTACT_FIELDS
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  const escapedEmail = email.replace(/[+\-&|!(){}[\]^"~*?:\\]/g, '\\$&');

  return {
    method: 'GET',
    path: 'search/ClientContact',
    query: {
      query: `email:"${escapedEmail}" OR email2:"${escapedEmail}" OR email3:"${escapedEmail}"`,
      fields,
      count: 10,
      start: 0,
    },
  };
}

/**
 * Search client contacts by client corporation ID
 */
export function searchClientContactsByCompanyRequest(
  clientCorporationId: number,
  fields: string = DEFAULT_CLIENT_CONTACT_FIELDS,
  count: number = 50
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/ClientContact',
    query: {
      query: `clientCorporation.id:${clientCorporationId}`,
      fields,
      count,
      start: 0,
      sort: 'lastName',
    },
  };
}

/**
 * Create a new client contact
 */
export function createClientContactRequest(
  data: ClientContactCreateData
): { method: 'PUT'; path: string; body: ClientContactCreateData } {
  return {
    method: 'PUT',
    path: 'entity/ClientContact',
    body: data,
  };
}

/**
 * Update an existing client contact
 */
export function updateClientContactRequest(
  id: number,
  data: ClientContactUpdateData
): { method: 'POST'; path: string; body: ClientContactUpdateData } {
  return {
    method: 'POST',
    path: `entity/ClientContact/${id}`,
    body: data,
  };
}

/**
 * Soft delete a client contact
 */
export function deleteClientContactRequest(
  id: number
): { method: 'POST'; path: string; body: { isDeleted: boolean } } {
  return {
    method: 'POST',
    path: `entity/ClientContact/${id}`,
    body: { isDeleted: true },
  };
}

/**
 * Get multiple client contacts by IDs
 */
export function getClientContactsByIdsRequest(
  ids: number[],
  fields: string = DEFAULT_CLIENT_CONTACT_FIELDS
): { method: 'GET'; path: string; query: Record<string, string> } {
  return {
    method: 'GET',
    path: `entity/ClientContact/${ids.join(',')}`,
    query: { fields },
  };
}

/**
 * Query client contacts modified since a timestamp
 */
export function getClientContactsModifiedSinceRequest(
  sinceTimestamp: number,
  fields: string = DEFAULT_CLIENT_CONTACT_FIELDS,
  count: number = 100,
  start: number = 0
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: 'search/ClientContact',
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
 * Map use60 contact to Bullhorn ClientContact format
 */
export function mapContactToClientContact(contact: {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  metadata?: Record<string, unknown>;
}): ClientContactCreateData {
  return {
    firstName: contact.first_name || '',
    lastName: contact.last_name || '',
    email: contact.email || undefined,
    phone: contact.phone || undefined,
    occupation: contact.job_title || undefined,
    externalID: contact.metadata?.use60_id as string | undefined,
  };
}

/**
 * Map Bullhorn ClientContact to use60 contact format
 */
export function mapClientContactToContact(clientContact: BullhornClientContact): {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  status: string;
  source: string;
  external_id: string;
  metadata: Record<string, unknown>;
} {
  return {
    first_name: clientContact.firstName || '',
    last_name: clientContact.lastName || '',
    email: clientContact.email || null,
    phone: clientContact.phone || clientContact.mobile || null,
    company: clientContact.clientCorporation?.name || null,
    job_title: clientContact.occupation || null,
    status: mapBullhornStatusToContact(clientContact.status),
    source: 'bullhorn',
    external_id: `bullhorn_client_contact_${clientContact.id}`,
    metadata: {
      bullhorn_id: clientContact.id,
      bullhorn_type: 'ClientContact',
      bullhorn_status: clientContact.status,
      bullhorn_client_corporation_id: clientContact.clientCorporation?.id,
      bullhorn_client_corporation_name: clientContact.clientCorporation?.name,
      bullhorn_owner: clientContact.owner,
      synced_at: new Date().toISOString(),
    },
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Map Bullhorn status to use60 contact status
 */
function mapBullhornStatusToContact(status?: string): string {
  const statusMap: Record<string, string> = {
    Active: 'active',
    Inactive: 'inactive',
    'Archive': 'inactive',
  };
  return statusMap[status || ''] || 'active';
}

/**
 * Build search query for finding client contacts
 */
export function buildClientContactSearchQuery(criteria: {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  clientCorporationId?: number;
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

  if (criteria.clientCorporationId) {
    parts.push(`clientCorporation.id:${criteria.clientCorporationId}`);
  }

  if (criteria.modifiedSince) {
    parts.push(`dateLastModified:[${criteria.modifiedSince} TO *]`);
  }

  return parts.length > 0 ? parts.join(' AND ') : '*';
}

/**
 * Calculate match score for client contact matching
 */
export function calculateClientContactMatchScore(
  clientContact: BullhornClientContact,
  contact: { email?: string; first_name?: string; last_name?: string; phone?: string; company?: string }
): number {
  let score = 0;
  const weights = { email: 50, firstName: 15, lastName: 15, phone: 10, company: 10 };

  // Email match (highest weight)
  if (contact.email) {
    const emails = [clientContact.email, clientContact.email2, clientContact.email3]
      .filter(Boolean)
      .map((e) => e?.toLowerCase());
    if (emails.includes(contact.email.toLowerCase())) {
      score += weights.email;
    }
  }

  // Name match
  if (contact.first_name && clientContact.firstName?.toLowerCase() === contact.first_name.toLowerCase()) {
    score += weights.firstName;
  }
  if (contact.last_name && clientContact.lastName?.toLowerCase() === contact.last_name.toLowerCase()) {
    score += weights.lastName;
  }

  // Phone match
  if (contact.phone) {
    const contactPhone = contact.phone.replace(/\D/g, '');
    const clientPhones = [clientContact.phone, clientContact.mobile]
      .filter(Boolean)
      .map((p) => p?.replace(/\D/g, ''));
    if (clientPhones.some((p) => p && (p.includes(contactPhone) || contactPhone.includes(p)))) {
      score += weights.phone;
    }
  }

  // Company match
  if (contact.company && clientContact.clientCorporation?.name) {
    if (clientContact.clientCorporation.name.toLowerCase().includes(contact.company.toLowerCase())) {
      score += weights.company;
    }
  }

  return score;
}
