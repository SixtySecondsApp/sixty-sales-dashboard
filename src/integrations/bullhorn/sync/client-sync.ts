/**
 * Bullhorn Client Sync Service
 *
 * Handles bi-directional synchronization between use60 contacts and
 * Bullhorn ClientContact entities. Manages client contact matching,
 * company resolution, and data mapping.
 */

import { supabase } from '@/lib/supabase/clientV2';
import {
  mapClientContactToContact,
  mapContactToClientContact,
  buildClientContactSearchQuery,
  calculateClientContactMatchScore,
} from '../api/client-contacts';
import {
  mapClientCorporationToCompany,
  buildClientCorporationSearchQuery,
  calculateClientCorporationMatchScore,
} from '../api/client-corporations';
import type { BullhornClientContact, BullhornClientCorporation } from '../types/bullhorn';

// =============================================================================
// Types
// =============================================================================

export interface ClientSyncResult {
  success: boolean;
  contactId?: string;
  bullhornId?: number;
  action: 'created' | 'updated' | 'matched' | 'skipped' | 'error';
  error?: string;
}

export interface ClientContactMatchResult {
  matched: boolean;
  bullhornClientContactId?: number;
  matchScore: number;
  matchedFields: string[];
}

export interface CompanyMatchResult {
  matched: boolean;
  bullhornClientCorporationId?: number;
  matchScore: number;
  companyName?: string;
}

// =============================================================================
// Client Contact Sync Functions
// =============================================================================

/**
 * Sync a Bullhorn ClientContact to use60 contact
 */
export async function syncClientContactToContact(
  orgId: string,
  clientContact: BullhornClientContact,
  options: {
    createIfNotExists?: boolean;
    updateIfExists?: boolean;
    forceUpdate?: boolean;
  } = {}
): Promise<ClientSyncResult> {
  const { createIfNotExists = true, updateIfExists = true, forceUpdate = false } = options;

  try {
    // Check for existing mapping
    const { data: existingMapping } = await supabase
      .from('bullhorn_object_mappings')
      .select('use60_id, use60_last_modified, bullhorn_last_modified')
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'ClientContact')
      .eq('bullhorn_entity_id', clientContact.id)
      .maybeSingle();

    if (existingMapping?.use60_id) {
      // Check for conflict (use60 was modified more recently)
      if (!forceUpdate && updateIfExists) {
        const use60LastMod = existingMapping.use60_last_modified
          ? new Date(existingMapping.use60_last_modified).getTime()
          : 0;
        const bullhornLastMod = clientContact.dateLastModified || 0;

        if (use60LastMod > bullhornLastMod) {
          return {
            success: true,
            contactId: existingMapping.use60_id,
            bullhornId: clientContact.id,
            action: 'skipped',
          };
        }
      }

      // Update existing contact
      const contactData = mapClientContactToContact(clientContact);
      const { error: updateError } = await supabase
        .from('contacts')
        .update({
          first_name: contactData.first_name,
          last_name: contactData.last_name,
          email: contactData.email,
          phone: contactData.phone,
          company: contactData.company,
          job_title: contactData.job_title,
          metadata: contactData.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingMapping.use60_id);

      if (updateError) {
        throw new Error(`Failed to update contact: ${updateError.message}`);
      }

      // Update mapping timestamp
      await supabase
        .from('bullhorn_object_mappings')
        .update({
          last_synced_at: new Date().toISOString(),
          bullhorn_last_modified: clientContact.dateLastModified,
        })
        .eq('org_id', orgId)
        .eq('bullhorn_entity_id', clientContact.id);

      return {
        success: true,
        contactId: existingMapping.use60_id,
        bullhornId: clientContact.id,
        action: 'updated',
      };
    }

    // Try to match with existing contact by email
    if (clientContact.email) {
      const { data: existingContacts } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, company')
        .eq('org_id', orgId)
        .eq('email', clientContact.email)
        .limit(1);

      if (existingContacts && existingContacts.length > 0) {
        // Create mapping for matched contact
        await supabase.from('bullhorn_object_mappings').insert({
          org_id: orgId,
          bullhorn_entity_type: 'ClientContact',
          bullhorn_entity_id: clientContact.id,
          use60_table: 'contacts',
          use60_id: existingContacts[0].id,
          sync_direction: 'bullhorn_to_use60',
          last_synced_at: new Date().toISOString(),
          bullhorn_last_modified: clientContact.dateLastModified,
        });

        // Update contact metadata
        const contactData = mapClientContactToContact(clientContact);
        await supabase
          .from('contacts')
          .update({
            external_id: contactData.external_id,
            metadata: contactData.metadata,
            company: contactData.company,
            job_title: contactData.job_title,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingContacts[0].id);

        return {
          success: true,
          contactId: existingContacts[0].id,
          bullhornId: clientContact.id,
          action: 'matched',
        };
      }
    }

    // Create new contact if allowed
    if (!createIfNotExists) {
      return {
        success: true,
        bullhornId: clientContact.id,
        action: 'skipped',
      };
    }

    const contactData = mapClientContactToContact(clientContact);
    const { data: newContact, error: insertError } = await supabase
      .from('contacts')
      .insert({
        org_id: orgId,
        ...contactData,
        contact_type: 'client',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to create contact: ${insertError.message}`);
    }

    // Create mapping
    await supabase.from('bullhorn_object_mappings').insert({
      org_id: orgId,
      bullhorn_entity_type: 'ClientContact',
      bullhorn_entity_id: clientContact.id,
      use60_table: 'contacts',
      use60_id: newContact.id,
      sync_direction: 'bullhorn_to_use60',
      last_synced_at: new Date().toISOString(),
      bullhorn_last_modified: clientContact.dateLastModified,
    });

    return {
      success: true,
      contactId: newContact.id,
      bullhornId: clientContact.id,
      action: 'created',
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('[client-sync] syncClientContactToContact error:', error);
    return {
      success: false,
      bullhornId: clientContact.id,
      action: 'error',
      error,
    };
  }
}

/**
 * Batch sync multiple client contacts
 */
export async function batchSyncClientContactsToContacts(
  orgId: string,
  clientContacts: BullhornClientContact[],
  options: {
    createIfNotExists?: boolean;
    updateIfExists?: boolean;
  } = {}
): Promise<ClientSyncResult[]> {
  const results: ClientSyncResult[] = [];

  for (const clientContact of clientContacts) {
    const result = await syncClientContactToContact(orgId, clientContact, options);
    results.push(result);
  }

  return results;
}

// =============================================================================
// Company Sync Functions
// =============================================================================

/**
 * Sync a Bullhorn ClientCorporation to use60 company/account
 */
export async function syncClientCorporationToCompany(
  orgId: string,
  corporation: BullhornClientCorporation
): Promise<{
  success: boolean;
  companyId?: string;
  bullhornId?: number;
  action: string;
  error?: string;
}> {
  try {
    // Check for existing mapping
    const { data: existingMapping } = await supabase
      .from('bullhorn_object_mappings')
      .select('use60_id')
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'ClientCorporation')
      .eq('bullhorn_entity_id', corporation.id)
      .maybeSingle();

    if (existingMapping?.use60_id) {
      // Update existing company record
      const companyData = mapClientCorporationToCompany(corporation);

      // Note: use60 might not have a dedicated companies table
      // This would update the company info in a deals or contacts table
      // For now, just update the mapping
      await supabase
        .from('bullhorn_object_mappings')
        .update({
          last_synced_at: new Date().toISOString(),
          bullhorn_last_modified: corporation.dateLastModified,
        })
        .eq('org_id', orgId)
        .eq('bullhorn_entity_id', corporation.id);

      return {
        success: true,
        companyId: existingMapping.use60_id,
        bullhornId: corporation.id,
        action: 'updated',
      };
    }

    // Create new mapping (company data stored in metadata)
    const companyData = mapClientCorporationToCompany(corporation);

    // Store as a mapping with metadata
    const { data: newMapping, error: insertError } = await supabase
      .from('bullhorn_object_mappings')
      .insert({
        org_id: orgId,
        bullhorn_entity_type: 'ClientCorporation',
        bullhorn_entity_id: corporation.id,
        use60_table: 'companies',
        use60_id: `company_${corporation.id}`,
        sync_direction: 'bullhorn_to_use60',
        last_synced_at: new Date().toISOString(),
        bullhorn_last_modified: corporation.dateLastModified,
        sync_metadata: companyData,
      })
      .select('use60_id')
      .single();

    if (insertError) {
      throw new Error(`Failed to create company mapping: ${insertError.message}`);
    }

    return {
      success: true,
      companyId: newMapping.use60_id,
      bullhornId: corporation.id,
      action: 'created',
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('[client-sync] syncClientCorporationToCompany error:', error);
    return {
      success: false,
      bullhornId: corporation.id,
      action: 'error',
      error,
    };
  }
}

// =============================================================================
// Matching Functions
// =============================================================================

/**
 * Find best matching Bullhorn ClientContact for a use60 contact
 */
export async function findMatchingClientContact(
  orgId: string,
  contact: {
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    company?: string;
  },
  bullhornClientContacts: BullhornClientContact[]
): Promise<ClientContactMatchResult> {
  let bestMatch: BullhornClientContact | null = null;
  let bestScore = 0;
  const matchedFields: string[] = [];

  for (const clientContact of bullhornClientContacts) {
    const score = calculateClientContactMatchScore(clientContact, contact);

    if (score > bestScore && score >= 50) {
      // Minimum threshold of 50
      bestScore = score;
      bestMatch = clientContact;

      // Track matched fields
      matchedFields.length = 0;
      if (
        contact.email &&
        [clientContact.email, clientContact.email2, clientContact.email3]
          .filter(Boolean)
          .map((e) => e?.toLowerCase())
          .includes(contact.email.toLowerCase())
      ) {
        matchedFields.push('email');
      }
      if (
        contact.first_name &&
        clientContact.firstName?.toLowerCase() === contact.first_name.toLowerCase()
      ) {
        matchedFields.push('firstName');
      }
      if (
        contact.last_name &&
        clientContact.lastName?.toLowerCase() === contact.last_name.toLowerCase()
      ) {
        matchedFields.push('lastName');
      }
    }
  }

  return {
    matched: bestMatch !== null,
    bullhornClientContactId: bestMatch?.id,
    matchScore: bestScore,
    matchedFields,
  };
}

/**
 * Find best matching Bullhorn ClientCorporation for a company name
 */
export async function findMatchingClientCorporation(
  companyName: string,
  bullhornCorporations: BullhornClientCorporation[]
): Promise<CompanyMatchResult> {
  let bestMatch: BullhornClientCorporation | null = null;
  let bestScore = 0;

  for (const corporation of bullhornCorporations) {
    const score = calculateClientCorporationMatchScore(corporation, { name: companyName });

    if (score > bestScore && score >= 60) {
      // Minimum threshold of 60
      bestScore = score;
      bestMatch = corporation;
    }
  }

  return {
    matched: bestMatch !== null,
    bullhornClientCorporationId: bestMatch?.id,
    matchScore: bestScore,
    companyName: bestMatch?.name,
  };
}

// =============================================================================
// Webhook Handlers
// =============================================================================

/**
 * Handle ClientContact created webhook event
 */
export async function handleClientContactCreated(
  orgId: string,
  clientContact: BullhornClientContact
): Promise<ClientSyncResult> {
  return syncClientContactToContact(orgId, clientContact, {
    createIfNotExists: true,
    updateIfExists: false,
  });
}

/**
 * Handle ClientContact updated webhook event
 */
export async function handleClientContactUpdated(
  orgId: string,
  clientContact: BullhornClientContact
): Promise<ClientSyncResult> {
  return syncClientContactToContact(orgId, clientContact, {
    createIfNotExists: true,
    updateIfExists: true,
  });
}

/**
 * Handle ClientContact deleted webhook event
 */
export async function handleClientContactDeleted(
  orgId: string,
  clientContactId: number
): Promise<ClientSyncResult> {
  try {
    // Get existing mapping
    const { data: mapping } = await supabase
      .from('bullhorn_object_mappings')
      .select('use60_id')
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'ClientContact')
      .eq('bullhorn_entity_id', clientContactId)
      .maybeSingle();

    if (!mapping) {
      return {
        success: true,
        bullhornId: clientContactId,
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
      .eq('bullhorn_entity_id', clientContactId);

    // Update contact metadata
    await supabase
      .from('contacts')
      .update({
        metadata: {
          bullhorn_id: clientContactId,
          bullhorn_type: 'ClientContact',
          bullhorn_deleted: true,
          bullhorn_deleted_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', mapping.use60_id);

    return {
      success: true,
      contactId: mapping.use60_id,
      bullhornId: clientContactId,
      action: 'skipped', // soft_deleted
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('[client-sync] handleClientContactDeleted error:', error);
    return {
      success: false,
      bullhornId: clientContactId,
      action: 'error',
      error,
    };
  }
}

// =============================================================================
// Initial Sync
// =============================================================================

/**
 * Perform initial matching of existing contacts with Bullhorn ClientContacts
 */
export async function performInitialClientContactMatch(
  orgId: string,
  contacts: Array<{
    id: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    company?: string;
  }>,
  bullhornClientContacts: BullhornClientContact[]
): Promise<{
  matched: number;
  unmatched: number;
  results: Array<{ contactId: string; bullhornId?: number; matched: boolean; score: number }>;
}> {
  const results: Array<{ contactId: string; bullhornId?: number; matched: boolean; score: number }> =
    [];
  let matched = 0;
  let unmatched = 0;

  for (const contact of contacts) {
    const matchResult = await findMatchingClientContact(orgId, contact, bullhornClientContacts);

    if (matchResult.matched && matchResult.bullhornClientContactId) {
      // Create mapping
      await supabase.from('bullhorn_object_mappings').insert({
        org_id: orgId,
        bullhorn_entity_type: 'ClientContact',
        bullhorn_entity_id: matchResult.bullhornClientContactId,
        use60_table: 'contacts',
        use60_id: contact.id,
        sync_direction: 'bidirectional',
        last_synced_at: new Date().toISOString(),
      });

      results.push({
        contactId: contact.id,
        bullhornId: matchResult.bullhornClientContactId,
        matched: true,
        score: matchResult.matchScore,
      });
      matched++;
    } else {
      results.push({
        contactId: contact.id,
        matched: false,
        score: matchResult.matchScore,
      });
      unmatched++;
    }
  }

  return { matched, unmatched, results };
}
