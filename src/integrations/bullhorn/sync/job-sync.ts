/**
 * Bullhorn Job Order Sync Service
 *
 * Handles bi-directional synchronization between use60 deals and
 * Bullhorn JobOrder entities. Manages job matching, status mapping,
 * and pipeline synchronization.
 */

import { supabase } from '@/lib/supabase/clientV2';
import {
  mapJobOrderToDeal,
  mapDealToJobOrder,
  buildJobOrderSearchQuery,
  calculateJobOrderMatchScore,
} from '../api/job-orders';
import type { BullhornJobOrder } from '../types/bullhorn';

// =============================================================================
// Types
// =============================================================================

export interface JobSyncResult {
  success: boolean;
  dealId?: string;
  bullhornId?: number;
  action: 'created' | 'updated' | 'matched' | 'skipped' | 'error';
  error?: string;
}

export interface JobOrderMatchResult {
  matched: boolean;
  bullhornJobOrderId?: number;
  matchScore: number;
  matchedFields: string[];
}

// =============================================================================
// Job Order Sync Functions
// =============================================================================

/**
 * Sync a Bullhorn JobOrder to use60 deal
 */
export async function syncJobOrderToDeal(
  orgId: string,
  jobOrder: BullhornJobOrder,
  options: {
    createIfNotExists?: boolean;
    updateIfExists?: boolean;
    forceUpdate?: boolean;
  } = {}
): Promise<JobSyncResult> {
  const { createIfNotExists = true, updateIfExists = true, forceUpdate = false } = options;

  try {
    // Check for existing mapping
    const { data: existingMapping } = await supabase
      .from('bullhorn_object_mappings')
      .select('use60_id, use60_last_modified, bullhorn_last_modified')
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'JobOrder')
      .eq('bullhorn_entity_id', jobOrder.id)
      .maybeSingle();

    if (existingMapping?.use60_id) {
      // Check for conflict
      if (!forceUpdate && updateIfExists) {
        const use60LastMod = existingMapping.use60_last_modified
          ? new Date(existingMapping.use60_last_modified).getTime()
          : 0;
        const bullhornLastMod = jobOrder.dateLastModified || 0;

        if (use60LastMod > bullhornLastMod) {
          return {
            success: true,
            dealId: existingMapping.use60_id,
            bullhornId: jobOrder.id,
            action: 'skipped',
          };
        }
      }

      // Update existing deal
      const dealData = mapJobOrderToDeal(jobOrder);
      const { error: updateError } = await supabase
        .from('deals')
        .update({
          name: dealData.name,
          description: dealData.description,
          value: dealData.value,
          stage: dealData.stage,
          expected_close_date: dealData.expected_close_date,
          status: dealData.status,
          metadata: dealData.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingMapping.use60_id);

      if (updateError) {
        throw new Error(`Failed to update deal: ${updateError.message}`);
      }

      // Update mapping timestamp
      await supabase
        .from('bullhorn_object_mappings')
        .update({
          last_synced_at: new Date().toISOString(),
          bullhorn_last_modified: jobOrder.dateLastModified,
        })
        .eq('org_id', orgId)
        .eq('bullhorn_entity_id', jobOrder.id);

      return {
        success: true,
        dealId: existingMapping.use60_id,
        bullhornId: jobOrder.id,
        action: 'updated',
      };
    }

    // Try to match with existing deal by name/title
    if (jobOrder.title) {
      const { data: existingDeals } = await supabase
        .from('deals')
        .select('id, name, value')
        .eq('org_id', orgId)
        .ilike('name', `%${jobOrder.title}%`)
        .limit(5);

      if (existingDeals && existingDeals.length > 0) {
        // Find best match
        let bestMatch: (typeof existingDeals)[0] | null = null;
        let bestScore = 0;

        for (const deal of existingDeals) {
          const score = calculateJobOrderMatchScore(jobOrder, deal);
          if (score > bestScore && score >= 50) {
            bestScore = score;
            bestMatch = deal;
          }
        }

        if (bestMatch) {
          // Create mapping for matched deal
          await supabase.from('bullhorn_object_mappings').insert({
            org_id: orgId,
            bullhorn_entity_type: 'JobOrder',
            bullhorn_entity_id: jobOrder.id,
            use60_table: 'deals',
            use60_id: bestMatch.id,
            sync_direction: 'bullhorn_to_use60',
            last_synced_at: new Date().toISOString(),
            bullhorn_last_modified: jobOrder.dateLastModified,
          });

          // Update deal metadata
          const dealData = mapJobOrderToDeal(jobOrder);
          await supabase
            .from('deals')
            .update({
              external_id: dealData.external_id,
              metadata: dealData.metadata,
              updated_at: new Date().toISOString(),
            })
            .eq('id', bestMatch.id);

          return {
            success: true,
            dealId: bestMatch.id,
            bullhornId: jobOrder.id,
            action: 'matched',
          };
        }
      }
    }

    // Create new deal if allowed
    if (!createIfNotExists) {
      return {
        success: true,
        bullhornId: jobOrder.id,
        action: 'skipped',
      };
    }

    const dealData = mapJobOrderToDeal(jobOrder);

    // Resolve client corporation to company ID
    let companyId: string | null = null;
    if (jobOrder.clientCorporation?.id) {
      const { data: corpMapping } = await supabase
        .from('bullhorn_object_mappings')
        .select('use60_id')
        .eq('org_id', orgId)
        .eq('bullhorn_entity_type', 'ClientCorporation')
        .eq('bullhorn_entity_id', jobOrder.clientCorporation.id)
        .maybeSingle();

      companyId = corpMapping?.use60_id || null;
    }

    // Resolve client contact to contact ID
    let contactId: string | null = null;
    if (jobOrder.clientContact?.id) {
      const { data: contactMapping } = await supabase
        .from('bullhorn_object_mappings')
        .select('use60_id')
        .eq('org_id', orgId)
        .eq('bullhorn_entity_type', 'ClientContact')
        .eq('bullhorn_entity_id', jobOrder.clientContact.id)
        .maybeSingle();

      contactId = contactMapping?.use60_id || null;
    }

    const { data: newDeal, error: insertError } = await supabase
      .from('deals')
      .insert({
        org_id: orgId,
        name: dealData.name,
        description: dealData.description,
        value: dealData.value,
        stage: dealData.stage,
        expected_close_date: dealData.expected_close_date,
        status: dealData.status,
        source: dealData.source,
        external_id: dealData.external_id,
        company_id: companyId,
        contact_id: contactId,
        metadata: dealData.metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      throw new Error(`Failed to create deal: ${insertError.message}`);
    }

    // Create mapping
    await supabase.from('bullhorn_object_mappings').insert({
      org_id: orgId,
      bullhorn_entity_type: 'JobOrder',
      bullhorn_entity_id: jobOrder.id,
      use60_table: 'deals',
      use60_id: newDeal.id,
      sync_direction: 'bullhorn_to_use60',
      last_synced_at: new Date().toISOString(),
      bullhorn_last_modified: jobOrder.dateLastModified,
    });

    return {
      success: true,
      dealId: newDeal.id,
      bullhornId: jobOrder.id,
      action: 'created',
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('[job-sync] syncJobOrderToDeal error:', error);
    return {
      success: false,
      bullhornId: jobOrder.id,
      action: 'error',
      error,
    };
  }
}

/**
 * Batch sync multiple job orders
 */
export async function batchSyncJobOrdersToDeals(
  orgId: string,
  jobOrders: BullhornJobOrder[],
  options: {
    createIfNotExists?: boolean;
    updateIfExists?: boolean;
  } = {}
): Promise<JobSyncResult[]> {
  const results: JobSyncResult[] = [];

  for (const jobOrder of jobOrders) {
    const result = await syncJobOrderToDeal(orgId, jobOrder, options);
    results.push(result);
  }

  return results;
}

// =============================================================================
// Deal to JobOrder Sync (Reverse)
// =============================================================================

/**
 * Sync a use60 deal to Bullhorn JobOrder
 * Returns the data to be sent to Bullhorn (actual API call handled by queue processor)
 */
export function prepareDealForBullhornSync(deal: {
  id: string;
  name: string;
  description?: string | null;
  value?: number | null;
  stage?: string | null;
  expected_close_date?: string | null;
  company_id?: string | null;
  contact_id?: string | null;
  metadata?: Record<string, unknown> | null;
}): {
  jobOrderData: ReturnType<typeof mapDealToJobOrder>;
  externalId: string;
} {
  const jobOrderData = mapDealToJobOrder({
    name: deal.name,
    description: deal.description || undefined,
    value: deal.value || undefined,
    stage: deal.stage || undefined,
    expected_close_date: deal.expected_close_date || undefined,
    metadata: { deal_id: deal.id, ...(deal.metadata || {}) },
  });

  return {
    jobOrderData,
    externalId: `use60_deal_${deal.id}`,
  };
}

// =============================================================================
// Webhook Handlers
// =============================================================================

/**
 * Handle JobOrder created webhook event
 */
export async function handleJobOrderCreated(
  orgId: string,
  jobOrder: BullhornJobOrder
): Promise<JobSyncResult> {
  return syncJobOrderToDeal(orgId, jobOrder, {
    createIfNotExists: true,
    updateIfExists: false,
  });
}

/**
 * Handle JobOrder updated webhook event
 */
export async function handleJobOrderUpdated(
  orgId: string,
  jobOrder: BullhornJobOrder
): Promise<JobSyncResult> {
  return syncJobOrderToDeal(orgId, jobOrder, {
    createIfNotExists: true,
    updateIfExists: true,
  });
}

/**
 * Handle JobOrder deleted/closed webhook event
 */
export async function handleJobOrderDeleted(
  orgId: string,
  jobOrderId: number
): Promise<JobSyncResult> {
  try {
    // Get existing mapping
    const { data: mapping } = await supabase
      .from('bullhorn_object_mappings')
      .select('use60_id')
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'JobOrder')
      .eq('bullhorn_entity_id', jobOrderId)
      .maybeSingle();

    if (!mapping) {
      return {
        success: true,
        bullhornId: jobOrderId,
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
      .eq('bullhorn_entity_id', jobOrderId);

    // Update deal metadata and status
    await supabase
      .from('deals')
      .update({
        status: 'closed',
        metadata: {
          bullhorn_id: jobOrderId,
          bullhorn_type: 'JobOrder',
          bullhorn_deleted: true,
          bullhorn_deleted_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', mapping.use60_id);

    return {
      success: true,
      dealId: mapping.use60_id,
      bullhornId: jobOrderId,
      action: 'updated',
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('[job-sync] handleJobOrderDeleted error:', error);
    return {
      success: false,
      bullhornId: jobOrderId,
      action: 'error',
      error,
    };
  }
}

// =============================================================================
// Status Sync
// =============================================================================

/**
 * Sync job order status changes to deal stage
 */
export async function syncJobOrderStatusToDealStage(
  orgId: string,
  jobOrderId: number,
  newStatus: string,
  isOpen: boolean
): Promise<JobSyncResult> {
  try {
    const { data: mapping } = await supabase
      .from('bullhorn_object_mappings')
      .select('use60_id')
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'JobOrder')
      .eq('bullhorn_entity_id', jobOrderId)
      .maybeSingle();

    if (!mapping?.use60_id) {
      return {
        success: true,
        bullhornId: jobOrderId,
        action: 'skipped',
      };
    }

    // Map status to stage
    const stage = mapJobOrderStatusToDealStage(newStatus, isOpen);

    await supabase
      .from('deals')
      .update({
        stage,
        status: isOpen ? 'active' : 'closed',
        metadata: {
          bullhorn_status: newStatus,
          bullhorn_is_open: isOpen,
          status_synced_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', mapping.use60_id);

    return {
      success: true,
      dealId: mapping.use60_id,
      bullhornId: jobOrderId,
      action: 'updated',
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('[job-sync] syncJobOrderStatusToDealStage error:', error);
    return {
      success: false,
      bullhornId: jobOrderId,
      action: 'error',
      error,
    };
  }
}

/**
 * Map Bullhorn JobOrder status to deal stage
 */
function mapJobOrderStatusToDealStage(status: string, isOpen: boolean): string {
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
  return statusMap[status] || 'qualified';
}

// =============================================================================
// Initial Sync
// =============================================================================

/**
 * Perform initial matching of existing deals with Bullhorn JobOrders
 */
export async function performInitialJobOrderMatch(
  orgId: string,
  deals: Array<{
    id: string;
    name: string;
    value?: number | null;
    company_id?: string | null;
  }>,
  bullhornJobOrders: BullhornJobOrder[]
): Promise<{
  matched: number;
  unmatched: number;
  results: Array<{ dealId: string; bullhornId?: number; matched: boolean; score: number }>;
}> {
  const results: Array<{ dealId: string; bullhornId?: number; matched: boolean; score: number }> =
    [];
  let matched = 0;
  let unmatched = 0;

  for (const deal of deals) {
    let bestMatch: BullhornJobOrder | null = null;
    let bestScore = 0;

    for (const jobOrder of bullhornJobOrders) {
      const score = calculateJobOrderMatchScore(jobOrder, deal);
      if (score > bestScore && score >= 50) {
        bestScore = score;
        bestMatch = jobOrder;
      }
    }

    if (bestMatch) {
      // Create mapping
      await supabase.from('bullhorn_object_mappings').insert({
        org_id: orgId,
        bullhorn_entity_type: 'JobOrder',
        bullhorn_entity_id: bestMatch.id,
        use60_table: 'deals',
        use60_id: deal.id,
        sync_direction: 'bidirectional',
        last_synced_at: new Date().toISOString(),
      });

      results.push({
        dealId: deal.id,
        bullhornId: bestMatch.id,
        matched: true,
        score: bestScore,
      });
      matched++;
    } else {
      results.push({
        dealId: deal.id,
        matched: false,
        score: bestScore,
      });
      unmatched++;
    }
  }

  return { matched, unmatched, results };
}

// =============================================================================
// Pipeline Metrics
// =============================================================================

/**
 * Get aggregated pipeline metrics from synced job orders
 */
export async function getSyncedJobOrderMetrics(orgId: string): Promise<{
  totalJobOrders: number;
  openJobOrders: number;
  totalOpenings: number;
  byStatus: Record<string, number>;
}> {
  const { data: mappings } = await supabase
    .from('bullhorn_object_mappings')
    .select('sync_metadata')
    .eq('org_id', orgId)
    .eq('bullhorn_entity_type', 'JobOrder')
    .eq('is_deleted', false);

  if (!mappings || mappings.length === 0) {
    return {
      totalJobOrders: 0,
      openJobOrders: 0,
      totalOpenings: 0,
      byStatus: {},
    };
  }

  const byStatus: Record<string, number> = {};
  let openJobOrders = 0;
  let totalOpenings = 0;

  for (const mapping of mappings) {
    const meta = mapping.sync_metadata as Record<string, unknown> | null;
    if (!meta) continue;

    const status = (meta.bullhorn_status as string) || 'Unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;

    if (meta.bullhorn_is_open) {
      openJobOrders++;
      totalOpenings += (meta.bullhorn_num_openings as number) || 1;
    }
  }

  return {
    totalJobOrders: mappings.length,
    openJobOrders,
    totalOpenings,
    byStatus,
  };
}
