/**
 * Bullhorn Candidate Sync Service
 *
 * Handles bi-directional synchronization between use60 contacts and Bullhorn Candidates.
 * Supports initial matching, incremental sync, and webhook-driven updates.
 */

import { supabase } from '@/lib/supabase/clientV2';
import type { BullhornCandidate } from '../types/bullhorn';
import {
  mapCandidateToContact,
  mapContactToCandidate,
  buildCandidateSearchQuery,
  calculateCandidateMatchScore,
} from '../api/candidates';

// =============================================================================
// Types
// =============================================================================

export interface CandidateSyncResult {
  success: boolean;
  action: 'created' | 'updated' | 'matched' | 'skipped' | 'error';
  use60ContactId?: string;
  bullhornCandidateId?: number;
  error?: string;
}

export interface BulkSyncResult {
  total: number;
  created: number;
  updated: number;
  matched: number;
  skipped: number;
  errors: number;
  details: CandidateSyncResult[];
}

export interface SyncOptions {
  direction: 'bullhorn_to_use60' | 'use60_to_bullhorn' | 'bidirectional';
  createMissing: boolean;
  updateExisting: boolean;
  conflictResolution: 'bullhorn_wins' | 'use60_wins' | 'newest_wins';
  dryRun: boolean;
}

const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  direction: 'bidirectional',
  createMissing: true,
  updateExisting: true,
  conflictResolution: 'newest_wins',
  dryRun: false,
};

// =============================================================================
// Candidate → Contact Sync (Bullhorn to use60)
// =============================================================================

/**
 * Sync a single Bullhorn Candidate to use60 contact
 */
export async function syncCandidateToContact(
  candidate: BullhornCandidate,
  orgId: string,
  options: Partial<SyncOptions> = {}
): Promise<CandidateSyncResult> {
  const opts = { ...DEFAULT_SYNC_OPTIONS, ...options };

  try {
    // Check for existing mapping
    const { data: mapping } = await supabase
      .from('bullhorn_object_mappings')
      .select('use60_id')
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'Candidate')
      .eq('bullhorn_entity_id', candidate.id)
      .maybeSingle();

    if (mapping?.use60_id) {
      // Update existing contact
      if (!opts.updateExisting) {
        return { success: true, action: 'skipped', bullhornCandidateId: candidate.id };
      }

      const contactData = mapCandidateToContact(candidate);

      if (!opts.dryRun) {
        const { error } = await supabase
          .from('contacts')
          .update({
            ...contactData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', mapping.use60_id);

        if (error) throw error;

        // Update mapping timestamp
        await supabase
          .from('bullhorn_object_mappings')
          .update({
            last_synced_at: new Date().toISOString(),
            bullhorn_last_modified: candidate.dateLastModified,
          })
          .eq('org_id', orgId)
          .eq('bullhorn_entity_id', candidate.id);
      }

      return {
        success: true,
        action: 'updated',
        use60ContactId: mapping.use60_id,
        bullhornCandidateId: candidate.id,
      };
    }

    // Try to match by email
    if (candidate.email) {
      const { data: existingContacts } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone')
        .eq('org_id', orgId)
        .eq('email', candidate.email)
        .limit(5);

      if (existingContacts && existingContacts.length > 0) {
        // Find best match
        const bestMatch = existingContacts
          .map((c) => ({
            contact: c,
            score: calculateCandidateMatchScore(candidate, {
              email: c.email || undefined,
              first_name: c.first_name || undefined,
              last_name: c.last_name || undefined,
              phone: c.phone || undefined,
            }),
          }))
          .sort((a, b) => b.score - a.score)[0];

        if (bestMatch && bestMatch.score >= 50) {
          // Create mapping for matched contact
          if (!opts.dryRun) {
            await supabase.from('bullhorn_object_mappings').insert({
              org_id: orgId,
              bullhorn_entity_type: 'Candidate',
              bullhorn_entity_id: candidate.id,
              use60_table: 'contacts',
              use60_id: bestMatch.contact.id,
              sync_direction: 'bullhorn_to_use60',
              match_confidence: bestMatch.score,
              last_synced_at: new Date().toISOString(),
            });

            // Update contact with Bullhorn metadata
            const contactData = mapCandidateToContact(candidate);
            await supabase
              .from('contacts')
              .update({
                metadata: contactData.metadata,
                external_id: contactData.external_id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', bestMatch.contact.id);
          }

          return {
            success: true,
            action: 'matched',
            use60ContactId: bestMatch.contact.id,
            bullhornCandidateId: candidate.id,
          };
        }
      }
    }

    // Create new contact
    if (!opts.createMissing) {
      return { success: true, action: 'skipped', bullhornCandidateId: candidate.id };
    }

    const contactData = mapCandidateToContact(candidate);

    if (!opts.dryRun) {
      const { data: newContact, error: insertError } = await supabase
        .from('contacts')
        .insert({
          ...contactData,
          org_id: orgId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Create mapping
      await supabase.from('bullhorn_object_mappings').insert({
        org_id: orgId,
        bullhorn_entity_type: 'Candidate',
        bullhorn_entity_id: candidate.id,
        use60_table: 'contacts',
        use60_id: newContact.id,
        sync_direction: 'bullhorn_to_use60',
        last_synced_at: new Date().toISOString(),
      });

      return {
        success: true,
        action: 'created',
        use60ContactId: newContact.id,
        bullhornCandidateId: candidate.id,
      };
    }

    return { success: true, action: 'created', bullhornCandidateId: candidate.id };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('[candidate-sync] syncCandidateToContact error:', error);
    return { success: false, action: 'error', error, bullhornCandidateId: candidate.id };
  }
}

/**
 * Batch sync multiple candidates
 */
export async function batchSyncCandidatesToContacts(
  candidates: BullhornCandidate[],
  orgId: string,
  options: Partial<SyncOptions> = {}
): Promise<BulkSyncResult> {
  const results: CandidateSyncResult[] = [];

  for (const candidate of candidates) {
    const result = await syncCandidateToContact(candidate, orgId, options);
    results.push(result);
  }

  return {
    total: candidates.length,
    created: results.filter((r) => r.action === 'created').length,
    updated: results.filter((r) => r.action === 'updated').length,
    matched: results.filter((r) => r.action === 'matched').length,
    skipped: results.filter((r) => r.action === 'skipped').length,
    errors: results.filter((r) => r.action === 'error').length,
    details: results,
  };
}

// =============================================================================
// Contact → Candidate Sync (use60 to Bullhorn)
// =============================================================================

/**
 * Prepare contact data for Bullhorn Candidate creation/update
 * This returns the data needed to make the API call
 */
export function prepareContactForBullhorn(contact: {
  id: string;
  org_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}): {
  candidateData: ReturnType<typeof mapContactToCandidate>;
  externalId: string;
} {
  const candidateData = mapContactToCandidate(contact);
  candidateData.externalID = `use60_contact_${contact.id}`;

  return {
    candidateData,
    externalId: candidateData.externalID,
  };
}

/**
 * Store the mapping after successful Bullhorn sync
 */
export async function storeCandidateMapping(
  orgId: string,
  contactId: string,
  bullhornCandidateId: number,
  direction: 'bullhorn_to_use60' | 'use60_to_bullhorn' | 'bidirectional'
): Promise<void> {
  await supabase.from('bullhorn_object_mappings').upsert({
    org_id: orgId,
    bullhorn_entity_type: 'Candidate',
    bullhorn_entity_id: bullhornCandidateId,
    use60_table: 'contacts',
    use60_id: contactId,
    sync_direction: direction,
    last_synced_at: new Date().toISOString(),
  });
}

// =============================================================================
// Initial Sync (on connect)
// =============================================================================

/**
 * Match existing use60 contacts with Bullhorn candidates on initial connect
 */
export async function performInitialCandidateMatch(
  orgId: string,
  candidates: BullhornCandidate[]
): Promise<BulkSyncResult> {
  // Get all contacts for this org that don't have Bullhorn mapping
  const { data: existingMappings } = await supabase
    .from('bullhorn_object_mappings')
    .select('use60_id')
    .eq('org_id', orgId)
    .eq('bullhorn_entity_type', 'Candidate');

  const mappedContactIds = new Set(existingMappings?.map((m) => m.use60_id) || []);

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone')
    .eq('org_id', orgId);

  const unmappedContacts = contacts?.filter((c) => !mappedContactIds.has(c.id)) || [];

  const results: CandidateSyncResult[] = [];

  for (const candidate of candidates) {
    // Try to match with existing contact
    const matchedContact = unmappedContacts.find((c) => {
      const score = calculateCandidateMatchScore(candidate, {
        email: c.email || undefined,
        first_name: c.first_name || undefined,
        last_name: c.last_name || undefined,
        phone: c.phone || undefined,
      });
      return score >= 50;
    });

    if (matchedContact) {
      // Create mapping
      await supabase.from('bullhorn_object_mappings').insert({
        org_id: orgId,
        bullhorn_entity_type: 'Candidate',
        bullhorn_entity_id: candidate.id,
        use60_table: 'contacts',
        use60_id: matchedContact.id,
        sync_direction: 'bidirectional',
        match_confidence: calculateCandidateMatchScore(candidate, {
          email: matchedContact.email || undefined,
          first_name: matchedContact.first_name || undefined,
          last_name: matchedContact.last_name || undefined,
          phone: matchedContact.phone || undefined,
        }),
        last_synced_at: new Date().toISOString(),
      });

      // Update contact with Bullhorn metadata
      const contactData = mapCandidateToContact(candidate);
      await supabase
        .from('contacts')
        .update({
          metadata: contactData.metadata,
          external_id: contactData.external_id,
        })
        .eq('id', matchedContact.id);

      results.push({
        success: true,
        action: 'matched',
        use60ContactId: matchedContact.id,
        bullhornCandidateId: candidate.id,
      });

      // Remove from unmapped list
      const idx = unmappedContacts.indexOf(matchedContact);
      if (idx > -1) unmappedContacts.splice(idx, 1);
    } else {
      // Create new contact
      const result = await syncCandidateToContact(candidate, orgId, {
        createMissing: true,
        updateExisting: false,
      });
      results.push(result);
    }
  }

  return {
    total: candidates.length,
    created: results.filter((r) => r.action === 'created').length,
    updated: 0,
    matched: results.filter((r) => r.action === 'matched').length,
    skipped: results.filter((r) => r.action === 'skipped').length,
    errors: results.filter((r) => r.action === 'error').length,
    details: results,
  };
}

// =============================================================================
// Webhook Handlers
// =============================================================================

/**
 * Handle Candidate.created webhook event
 */
export async function handleCandidateCreated(
  orgId: string,
  candidateId: number,
  candidate: BullhornCandidate
): Promise<CandidateSyncResult> {
  return syncCandidateToContact(candidate, orgId, {
    createMissing: true,
    updateExisting: false,
  });
}

/**
 * Handle Candidate.updated webhook event
 */
export async function handleCandidateUpdated(
  orgId: string,
  candidateId: number,
  candidate: BullhornCandidate,
  updatedProperties?: string[]
): Promise<CandidateSyncResult> {
  // Check if we should update based on conflict resolution
  const { data: mapping } = await supabase
    .from('bullhorn_object_mappings')
    .select('use60_id, use60_last_modified, bullhorn_last_modified')
    .eq('org_id', orgId)
    .eq('bullhorn_entity_type', 'Candidate')
    .eq('bullhorn_entity_id', candidateId)
    .maybeSingle();

  if (!mapping) {
    // No mapping exists, create new contact
    return syncCandidateToContact(candidate, orgId, { createMissing: true });
  }

  // Check for conflict (use60 was also modified)
  const use60LastMod = mapping.use60_last_modified
    ? new Date(mapping.use60_last_modified).getTime()
    : 0;
  const bullhornLastMod = candidate.dateLastModified || 0;

  // If use60 was modified more recently, skip update
  if (use60LastMod > bullhornLastMod) {
    console.log(
      `[candidate-sync] Skipping update for candidate ${candidateId} - use60 has newer data`
    );
    return { success: true, action: 'skipped', bullhornCandidateId: candidateId };
  }

  return syncCandidateToContact(candidate, orgId, {
    updateExisting: true,
    createMissing: false,
  });
}

/**
 * Handle Candidate.deleted webhook event
 */
export async function handleCandidateDeleted(
  orgId: string,
  candidateId: number
): Promise<{ success: boolean; action: string }> {
  // Just mark the mapping as deleted, don't delete the contact
  const { error } = await supabase
    .from('bullhorn_object_mappings')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    })
    .eq('org_id', orgId)
    .eq('bullhorn_entity_type', 'Candidate')
    .eq('bullhorn_entity_id', candidateId);

  if (error) {
    console.error('[candidate-sync] handleCandidateDeleted error:', error);
    return { success: false, action: 'error' };
  }

  return { success: true, action: 'deleted_mapping' };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get mapping for a contact
 */
export async function getCandidateMappingByContactId(
  orgId: string,
  contactId: string
): Promise<{ bullhorn_entity_id: number } | null> {
  const { data } = await supabase
    .from('bullhorn_object_mappings')
    .select('bullhorn_entity_id')
    .eq('org_id', orgId)
    .eq('use60_table', 'contacts')
    .eq('use60_id', contactId)
    .eq('bullhorn_entity_type', 'Candidate')
    .maybeSingle();

  return data;
}

/**
 * Get mapping for a Bullhorn candidate
 */
export async function getContactMappingByCandidateId(
  orgId: string,
  candidateId: number
): Promise<{ use60_id: string } | null> {
  const { data } = await supabase
    .from('bullhorn_object_mappings')
    .select('use60_id')
    .eq('org_id', orgId)
    .eq('bullhorn_entity_type', 'Candidate')
    .eq('bullhorn_entity_id', candidateId)
    .maybeSingle();

  return data;
}

/**
 * Check if a contact needs to be synced to Bullhorn
 */
export async function shouldSyncContactToBullhorn(
  orgId: string,
  contactId: string,
  contactUpdatedAt: string
): Promise<boolean> {
  const { data: mapping } = await supabase
    .from('bullhorn_object_mappings')
    .select('last_synced_at')
    .eq('org_id', orgId)
    .eq('use60_id', contactId)
    .eq('use60_table', 'contacts')
    .maybeSingle();

  if (!mapping) return true; // No mapping, needs sync

  const lastSynced = mapping.last_synced_at
    ? new Date(mapping.last_synced_at).getTime()
    : 0;
  const contactMod = new Date(contactUpdatedAt).getTime();

  return contactMod > lastSynced;
}
