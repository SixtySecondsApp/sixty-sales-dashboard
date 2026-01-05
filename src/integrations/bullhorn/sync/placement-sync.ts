/**
 * Bullhorn Placement Sync Service
 *
 * Handles synchronization of Bullhorn Placement entities to use60.
 * Placements trigger deal wins and activity tracking.
 */

import { supabase } from '@/lib/supabase/clientV2';
import {
  mapPlacementToDealWin,
  mapPlacementToActivity,
  isPlacementActive,
  isPlacementEndingSoon,
  PLACEMENT_STATUS,
} from '../api/placements';
import type { BullhornPlacement } from '../types/bullhorn';

// =============================================================================
// Types
// =============================================================================

export interface PlacementSyncResult {
  success: boolean;
  dealId?: string;
  activityId?: string;
  bullhornId?: number;
  action: 'created' | 'updated' | 'matched' | 'skipped' | 'error';
  error?: string;
}

// =============================================================================
// Placement Sync Functions
// =============================================================================

/**
 * Sync a Bullhorn Placement to use60
 * Creates/updates deal as won and creates activity record
 */
export async function syncPlacementToUse60(
  orgId: string,
  placement: BullhornPlacement,
  options: {
    updateDealStatus?: boolean;
    createActivity?: boolean;
  } = {}
): Promise<PlacementSyncResult> {
  const { updateDealStatus = true, createActivity = true } = options;

  try {
    // Check for existing mapping
    const { data: existingMapping } = await supabase
      .from('bullhorn_object_mappings')
      .select('use60_id, sync_metadata')
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'Placement')
      .eq('bullhorn_entity_id', placement.id)
      .maybeSingle();

    // Get linked job order mapping to find associated deal
    let dealId: string | undefined;
    if (placement.jobOrder?.id) {
      const { data: jobOrderMapping } = await supabase
        .from('bullhorn_object_mappings')
        .select('use60_id')
        .eq('org_id', orgId)
        .eq('bullhorn_entity_type', 'JobOrder')
        .eq('bullhorn_entity_id', placement.jobOrder.id)
        .maybeSingle();

      if (jobOrderMapping?.use60_id) {
        dealId = jobOrderMapping.use60_id;
      }
    }

    // Update deal status to won if linked
    if (updateDealStatus && dealId) {
      const dealWinData = mapPlacementToDealWin(placement);

      await supabase
        .from('deals')
        .update({
          status: dealWinData.status,
          stage: dealWinData.stage,
          value: dealWinData.value || undefined,
          close_date: dealWinData.close_date || undefined,
          metadata: dealWinData.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dealId);
    }

    // Create activity record
    let activityId: string | undefined;
    if (createActivity) {
      const activityData = mapPlacementToActivity(placement);

      // Check if activity already exists
      const { data: existingActivity } = await supabase
        .from('activities')
        .select('id')
        .eq('org_id', orgId)
        .eq('external_id', activityData.external_id)
        .maybeSingle();

      if (!existingActivity) {
        const { data: newActivity, error: activityError } = await supabase
          .from('activities')
          .insert({
            org_id: orgId,
            type: activityData.type,
            title: activityData.title,
            description: activityData.description,
            date: activityData.date,
            source: activityData.source,
            external_id: activityData.external_id,
            deal_id: dealId || null,
            metadata: activityData.metadata,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (!activityError && newActivity) {
          activityId = newActivity.id;
        }
      } else {
        activityId = existingActivity.id;
      }
    }

    // Create or update placement mapping
    const placementMappingData = {
      org_id: orgId,
      bullhorn_entity_type: 'Placement' as const,
      bullhorn_entity_id: placement.id,
      use60_table: dealId ? 'deals' : 'activities',
      use60_id: dealId || activityId || `placement_${placement.id}`,
      sync_direction: 'bullhorn_to_use60' as const,
      last_synced_at: new Date().toISOString(),
      bullhorn_last_modified: placement.dateLastModified,
      sync_metadata: {
        placement_status: placement.status,
        candidate_id: placement.candidate?.id,
        job_order_id: placement.jobOrder?.id,
        linked_deal_id: dealId,
        linked_activity_id: activityId,
      },
    };

    if (existingMapping) {
      await supabase
        .from('bullhorn_object_mappings')
        .update(placementMappingData)
        .eq('org_id', orgId)
        .eq('bullhorn_entity_id', placement.id);

      return {
        success: true,
        dealId,
        activityId,
        bullhornId: placement.id,
        action: 'updated',
      };
    } else {
      await supabase.from('bullhorn_object_mappings').insert(placementMappingData);

      return {
        success: true,
        dealId,
        activityId,
        bullhornId: placement.id,
        action: 'created',
      };
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('[placement-sync] syncPlacementToUse60 error:', error);
    return {
      success: false,
      bullhornId: placement.id,
      action: 'error',
      error,
    };
  }
}

/**
 * Batch sync multiple placements
 */
export async function batchSyncPlacementsToUse60(
  orgId: string,
  placements: BullhornPlacement[],
  options: {
    updateDealStatus?: boolean;
    createActivity?: boolean;
  } = {}
): Promise<PlacementSyncResult[]> {
  const results: PlacementSyncResult[] = [];

  for (const placement of placements) {
    const result = await syncPlacementToUse60(orgId, placement, options);
    results.push(result);
  }

  return results;
}

// =============================================================================
// Webhook Handlers
// =============================================================================

/**
 * Handle Placement created webhook event
 */
export async function handlePlacementCreated(
  orgId: string,
  placement: BullhornPlacement
): Promise<PlacementSyncResult> {
  return syncPlacementToUse60(orgId, placement, {
    updateDealStatus: true,
    createActivity: true,
  });
}

/**
 * Handle Placement updated webhook event
 */
export async function handlePlacementUpdated(
  orgId: string,
  placement: BullhornPlacement
): Promise<PlacementSyncResult> {
  return syncPlacementToUse60(orgId, placement, {
    updateDealStatus: true,
    createActivity: false, // Don't create duplicate activities
  });
}

/**
 * Handle Placement deleted webhook event
 */
export async function handlePlacementDeleted(
  orgId: string,
  placementId: number
): Promise<PlacementSyncResult> {
  try {
    // Get existing mapping
    const { data: mapping } = await supabase
      .from('bullhorn_object_mappings')
      .select('use60_id, sync_metadata')
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'Placement')
      .eq('bullhorn_entity_id', placementId)
      .maybeSingle();

    if (!mapping) {
      return {
        success: true,
        bullhornId: placementId,
        action: 'skipped',
      };
    }

    // Mark mapping as deleted
    await supabase
      .from('bullhorn_object_mappings')
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId)
      .eq('bullhorn_entity_id', placementId);

    // Update linked deal if exists
    const linkedDealId = (mapping.sync_metadata as { linked_deal_id?: string })?.linked_deal_id;
    if (linkedDealId) {
      await supabase
        .from('deals')
        .update({
          metadata: {
            bullhorn_placement_id: placementId,
            bullhorn_placement_deleted: true,
            bullhorn_placement_deleted_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', linkedDealId);
    }

    return {
      success: true,
      dealId: linkedDealId,
      bullhornId: placementId,
      action: 'skipped', // soft_deleted
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('[placement-sync] handlePlacementDeleted error:', error);
    return {
      success: false,
      bullhornId: placementId,
      action: 'error',
      error,
    };
  }
}

// =============================================================================
// Placement Status Updates
// =============================================================================

/**
 * Handle placement status change
 * Updates deal/contact status accordingly
 */
export async function handlePlacementStatusChange(
  orgId: string,
  placement: BullhornPlacement,
  previousStatus?: string
): Promise<{
  success: boolean;
  actions: string[];
  error?: string;
}> {
  const actions: string[] = [];

  try {
    // Get mapping
    const { data: mapping } = await supabase
      .from('bullhorn_object_mappings')
      .select('use60_id, sync_metadata')
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'Placement')
      .eq('bullhorn_entity_id', placement.id)
      .maybeSingle();

    if (!mapping) {
      return { success: true, actions: ['no_mapping'] };
    }

    const linkedDealId = (mapping.sync_metadata as { linked_deal_id?: string })?.linked_deal_id;
    const currentStatus = placement.status;

    // Handle status transitions
    if (currentStatus === PLACEMENT_STATUS.COMPLETED && linkedDealId) {
      // Placement completed - mark deal as closed/won
      await supabase
        .from('deals')
        .update({
          status: 'closed',
          stage: 'won',
          close_date: new Date().toISOString(),
          metadata: {
            bullhorn_placement_id: placement.id,
            bullhorn_placement_status: 'Completed',
            bullhorn_placement_completed_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', linkedDealId);
      actions.push('deal_marked_won');
    }

    if (currentStatus === PLACEMENT_STATUS.TERMINATED && linkedDealId) {
      // Placement terminated - update deal status
      await supabase
        .from('deals')
        .update({
          metadata: {
            bullhorn_placement_id: placement.id,
            bullhorn_placement_status: 'Terminated',
            bullhorn_placement_terminated_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', linkedDealId);
      actions.push('deal_updated_terminated');
    }

    // Create status change activity
    const { error: activityError } = await supabase.from('activities').insert({
      org_id: orgId,
      type: 'placement_status_change',
      title: `Placement Status: ${currentStatus}`,
      description: previousStatus
        ? `Status changed from ${previousStatus} to ${currentStatus}`
        : `Placement status is now ${currentStatus}`,
      date: new Date().toISOString(),
      source: 'bullhorn',
      external_id: `bullhorn_placement_status_${placement.id}_${Date.now()}`,
      deal_id: linkedDealId || null,
      metadata: {
        bullhorn_placement_id: placement.id,
        previous_status: previousStatus,
        new_status: currentStatus,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (!activityError) {
      actions.push('activity_created');
    }

    // Update mapping metadata
    await supabase
      .from('bullhorn_object_mappings')
      .update({
        sync_metadata: {
          ...((mapping.sync_metadata as object) || {}),
          placement_status: currentStatus,
          last_status_change: new Date().toISOString(),
          previous_status: previousStatus,
        },
        last_synced_at: new Date().toISOString(),
      })
      .eq('org_id', orgId)
      .eq('bullhorn_entity_id', placement.id);

    return { success: true, actions };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('[placement-sync] handlePlacementStatusChange error:', error);
    return { success: false, actions, error };
  }
}

// =============================================================================
// Placement Monitoring
// =============================================================================

/**
 * Get placements ending soon for an organization
 */
export async function getPlacementsEndingSoon(
  orgId: string,
  daysThreshold: number = 30
): Promise<{
  placements: Array<{
    bullhornId: number;
    dealId?: string;
    candidateId?: number;
    jobOrderId?: number;
    dateEnd: string;
    daysRemaining: number;
  }>;
  error?: string;
}> {
  try {
    const { data: mappings, error: mappingsError } = await supabase
      .from('bullhorn_object_mappings')
      .select('bullhorn_entity_id, sync_metadata, use60_id')
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'Placement')
      .eq('is_deleted', false);

    if (mappingsError) {
      throw mappingsError;
    }

    const now = Date.now();
    const thresholdDate = now + daysThreshold * 24 * 60 * 60 * 1000;

    const endingSoon: Array<{
      bullhornId: number;
      dealId?: string;
      candidateId?: number;
      jobOrderId?: number;
      dateEnd: string;
      daysRemaining: number;
    }> = [];

    for (const mapping of mappings || []) {
      const metadata = mapping.sync_metadata as {
        placement_date_end?: number;
        linked_deal_id?: string;
        candidate_id?: number;
        job_order_id?: number;
      };

      if (metadata?.placement_date_end) {
        const dateEnd = metadata.placement_date_end;
        if (dateEnd > now && dateEnd <= thresholdDate) {
          const daysRemaining = Math.ceil((dateEnd - now) / (24 * 60 * 60 * 1000));
          endingSoon.push({
            bullhornId: mapping.bullhorn_entity_id,
            dealId: metadata.linked_deal_id,
            candidateId: metadata.candidate_id,
            jobOrderId: metadata.job_order_id,
            dateEnd: new Date(dateEnd).toISOString(),
            daysRemaining,
          });
        }
      }
    }

    // Sort by days remaining (soonest first)
    endingSoon.sort((a, b) => a.daysRemaining - b.daysRemaining);

    return { placements: endingSoon };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('[placement-sync] getPlacementsEndingSoon error:', error);
    return { placements: [], error };
  }
}

// =============================================================================
// Metrics
// =============================================================================

/**
 * Get placement metrics for an organization
 */
export async function getPlacementMetrics(
  orgId: string
): Promise<{
  total: number;
  active: number;
  completed: number;
  endingSoon: number;
  thisMonth: number;
  thisQuarter: number;
}> {
  // Get all placement mappings
  const { data: mappings } = await supabase
    .from('bullhorn_object_mappings')
    .select('bullhorn_entity_id, sync_metadata')
    .eq('org_id', orgId)
    .eq('bullhorn_entity_type', 'Placement')
    .eq('is_deleted', false);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const quarterStart = new Date(
    now.getFullYear(),
    Math.floor(now.getMonth() / 3) * 3,
    1
  ).getTime();
  const thirtyDaysFromNow = now.getTime() + 30 * 24 * 60 * 60 * 1000;

  let active = 0;
  let completed = 0;
  let endingSoon = 0;
  let thisMonth = 0;
  let thisQuarter = 0;

  for (const mapping of mappings || []) {
    const metadata = mapping.sync_metadata as {
      placement_status?: string;
      placement_date_added?: number;
      placement_date_end?: number;
    };

    if (metadata) {
      if (metadata.placement_status === PLACEMENT_STATUS.ACTIVE) {
        active++;
        if (metadata.placement_date_end) {
          const endDate = metadata.placement_date_end;
          if (endDate > now.getTime() && endDate <= thirtyDaysFromNow) {
            endingSoon++;
          }
        }
      }

      if (metadata.placement_status === PLACEMENT_STATUS.COMPLETED) {
        completed++;
      }

      if (metadata.placement_date_added) {
        if (metadata.placement_date_added >= monthStart) {
          thisMonth++;
        }
        if (metadata.placement_date_added >= quarterStart) {
          thisQuarter++;
        }
      }
    }
  }

  return {
    total: mappings?.length || 0,
    active,
    completed,
    endingSoon,
    thisMonth,
    thisQuarter,
  };
}
