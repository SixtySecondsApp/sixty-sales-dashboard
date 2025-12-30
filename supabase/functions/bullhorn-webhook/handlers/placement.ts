/**
 * Bullhorn Placement Webhook Handler
 *
 * Handles placement events from Bullhorn webhooks.
 * Placements represent successful hires and are synced as closed-won deals.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { BullhornWebhookPayload } from '../types.ts';

// =============================================================================
// Types
// =============================================================================

interface PlacementHandlerResult {
  success: boolean;
  action: 'created' | 'updated' | 'deleted' | 'skipped';
  dealId?: string;
  activityId?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Handler Functions
// =============================================================================

/**
 * Handle placement created event
 */
export async function handlePlacementCreated(
  supabase: SupabaseClient,
  payload: BullhornWebhookPayload,
  orgId: string
): Promise<PlacementHandlerResult> {
  const placementId = payload.entityId;
  const placementData = payload.data;

  if (!placementData) {
    return {
      success: false,
      action: 'skipped',
      error: 'No placement data in payload',
    };
  }

  try {
    // Check if mapping already exists
    const { data: existingMapping } = await supabase
      .from('bullhorn_object_mappings')
      .select('id, use60_id')
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'Placement')
      .eq('bullhorn_id', placementId)
      .maybeSingle();

    if (existingMapping) {
      return {
        success: true,
        action: 'skipped',
        dealId: existingMapping.use60_id,
        metadata: { reason: 'Mapping already exists' },
      };
    }

    // Try to find linked deal via job order
    let dealId: string | undefined;
    if (placementData.jobOrder?.id) {
      const { data: jobOrderMapping } = await supabase
        .from('bullhorn_object_mappings')
        .select('use60_id')
        .eq('org_id', orgId)
        .eq('bullhorn_entity_type', 'JobOrder')
        .eq('bullhorn_id', placementData.jobOrder.id)
        .maybeSingle();

      if (jobOrderMapping) {
        dealId = jobOrderMapping.use60_id;
      }
    }

    // Calculate placement value
    const placementValue = calculatePlacementValue(placementData);

    // If we have a linked deal, update it to won status
    if (dealId) {
      const { error: updateError } = await supabase
        .from('deals')
        .update({
          stage: 'won',
          status: 'won',
          value: placementValue || undefined,
          close_date: placementData.dateAdded
            ? new Date(placementData.dateAdded).toISOString()
            : new Date().toISOString(),
          metadata: {
            bullhorn_placement_id: placementId,
            bullhorn_placement_status: placementData.status,
            bullhorn_employment_type: placementData.employmentType,
            bullhorn_candidate_id: placementData.candidate?.id,
            placement_synced_at: new Date().toISOString(),
          },
        })
        .eq('id', dealId);

      if (updateError) {
        console.error('Failed to update deal with placement:', updateError);
      }
    } else {
      // Create a new deal for the placement
      const { data: newDeal, error: createError } = await supabase
        .from('deals')
        .insert({
          org_id: orgId,
          name: `Placement: ${placementData.candidate?.firstName || ''} ${placementData.candidate?.lastName || ''} - ${placementData.jobOrder?.title || 'Unknown Position'}`,
          stage: 'won',
          status: 'won',
          value: placementValue,
          close_date: placementData.dateAdded
            ? new Date(placementData.dateAdded).toISOString()
            : new Date().toISOString(),
          source: 'bullhorn',
          metadata: {
            bullhorn_placement_id: placementId,
            bullhorn_placement_status: placementData.status,
            bullhorn_employment_type: placementData.employmentType,
            bullhorn_candidate_id: placementData.candidate?.id,
            bullhorn_job_order_id: placementData.jobOrder?.id,
            bullhorn_client_corporation_id: placementData.clientCorporation?.id,
            placement_synced_at: new Date().toISOString(),
          },
        })
        .select('id')
        .single();

      if (createError) {
        return {
          success: false,
          action: 'created',
          error: `Failed to create deal: ${createError.message}`,
        };
      }

      dealId = newDeal.id;
    }

    // Create activity record for the placement
    const { data: activity, error: activityError } = await supabase
      .from('activities')
      .insert({
        org_id: orgId,
        deal_id: dealId,
        type: 'placement',
        title: `Placement Created: ${placementData.status || 'New'}`,
        description: buildPlacementDescription(placementData),
        date: placementData.dateAdded
          ? new Date(placementData.dateAdded).toISOString()
          : new Date().toISOString(),
        value: placementValue,
        source: 'bullhorn',
        metadata: {
          bullhorn_placement_id: placementId,
          bullhorn_employment_type: placementData.employmentType,
          bullhorn_start_date: placementData.dateBegin,
          bullhorn_end_date: placementData.dateEnd,
        },
      })
      .select('id')
      .single();

    if (activityError) {
      console.error('Failed to create placement activity:', activityError);
    }

    // Create mapping
    const { error: mappingError } = await supabase
      .from('bullhorn_object_mappings')
      .insert({
        org_id: orgId,
        bullhorn_entity_type: 'Placement',
        bullhorn_id: placementId,
        use60_entity_type: 'deal',
        use60_id: dealId,
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        metadata: {
          placement_status: placementData.status,
          employment_type: placementData.employmentType,
          value: placementValue,
        },
      });

    if (mappingError) {
      console.error('Failed to create placement mapping:', mappingError);
    }

    return {
      success: true,
      action: 'created',
      dealId,
      activityId: activity?.id,
      metadata: {
        placementStatus: placementData.status,
        employmentType: placementData.employmentType,
        value: placementValue,
      },
    };
  } catch (error) {
    return {
      success: false,
      action: 'created',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle placement updated event
 */
export async function handlePlacementUpdated(
  supabase: SupabaseClient,
  payload: BullhornWebhookPayload,
  orgId: string
): Promise<PlacementHandlerResult> {
  const placementId = payload.entityId;
  const placementData = payload.data;

  if (!placementData) {
    return {
      success: false,
      action: 'skipped',
      error: 'No placement data in payload',
    };
  }

  try {
    // Find existing mapping
    const { data: mapping } = await supabase
      .from('bullhorn_object_mappings')
      .select('use60_id, metadata')
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'Placement')
      .eq('bullhorn_id', placementId)
      .maybeSingle();

    if (!mapping) {
      // No mapping exists, create it
      return handlePlacementCreated(supabase, payload, orgId);
    }

    const dealId = mapping.use60_id;
    const previousStatus = mapping.metadata?.placement_status;
    const newStatus = placementData.status;

    // Calculate new value
    const placementValue = calculatePlacementValue(placementData);

    // Determine deal status based on placement status
    const dealStatus = mapPlacementStatusToDealStatus(newStatus);

    // Update the deal
    const { error: updateError } = await supabase
      .from('deals')
      .update({
        stage: dealStatus.stage,
        status: dealStatus.status,
        value: placementValue || undefined,
        metadata: {
          bullhorn_placement_id: placementId,
          bullhorn_placement_status: newStatus,
          bullhorn_employment_type: placementData.employmentType,
          bullhorn_previous_status: previousStatus,
          placement_updated_at: new Date().toISOString(),
        },
      })
      .eq('id', dealId);

    if (updateError) {
      return {
        success: false,
        action: 'updated',
        dealId,
        error: `Failed to update deal: ${updateError.message}`,
      };
    }

    // Create activity if status changed
    if (previousStatus && previousStatus !== newStatus) {
      await supabase.from('activities').insert({
        org_id: orgId,
        deal_id: dealId,
        type: 'status_change',
        title: `Placement Status: ${previousStatus} → ${newStatus}`,
        description: `Placement status changed from "${previousStatus}" to "${newStatus}"`,
        date: new Date().toISOString(),
        source: 'bullhorn',
        metadata: {
          bullhorn_placement_id: placementId,
          previous_status: previousStatus,
          new_status: newStatus,
        },
      });
    }

    // Update mapping
    await supabase
      .from('bullhorn_object_mappings')
      .update({
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        metadata: {
          placement_status: newStatus,
          employment_type: placementData.employmentType,
          value: placementValue,
          previous_status: previousStatus,
        },
      })
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'Placement')
      .eq('bullhorn_id', placementId);

    return {
      success: true,
      action: 'updated',
      dealId,
      metadata: {
        previousStatus,
        newStatus,
        value: placementValue,
      },
    };
  } catch (error) {
    return {
      success: false,
      action: 'updated',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle placement deleted event
 */
export async function handlePlacementDeleted(
  supabase: SupabaseClient,
  payload: BullhornWebhookPayload,
  orgId: string
): Promise<PlacementHandlerResult> {
  const placementId = payload.entityId;

  try {
    // Find existing mapping
    const { data: mapping } = await supabase
      .from('bullhorn_object_mappings')
      .select('use60_id')
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'Placement')
      .eq('bullhorn_id', placementId)
      .maybeSingle();

    if (!mapping) {
      return {
        success: true,
        action: 'skipped',
        metadata: { reason: 'No mapping found for placement' },
      };
    }

    const dealId = mapping.use60_id;

    // Don't delete the deal, but mark it as cancelled/lost
    const { error: updateError } = await supabase
      .from('deals')
      .update({
        status: 'lost',
        stage: 'closed',
        metadata: {
          bullhorn_placement_deleted: true,
          bullhorn_placement_deleted_at: new Date().toISOString(),
        },
      })
      .eq('id', dealId);

    if (updateError) {
      console.error('Failed to update deal on placement deletion:', updateError);
    }

    // Create activity for deletion
    await supabase.from('activities').insert({
      org_id: orgId,
      deal_id: dealId,
      type: 'status_change',
      title: 'Placement Deleted in Bullhorn',
      description: 'The linked Bullhorn placement was deleted. Deal has been marked as closed.',
      date: new Date().toISOString(),
      source: 'bullhorn',
      metadata: {
        bullhorn_placement_id: placementId,
        action: 'deleted',
      },
    });

    // Update mapping status
    await supabase
      .from('bullhorn_object_mappings')
      .update({
        sync_status: 'deleted',
        last_synced_at: new Date().toISOString(),
        metadata: {
          deleted_at: new Date().toISOString(),
        },
      })
      .eq('org_id', orgId)
      .eq('bullhorn_entity_type', 'Placement')
      .eq('bullhorn_id', placementId);

    return {
      success: true,
      action: 'deleted',
      dealId,
      metadata: { placementId },
    };
  } catch (error) {
    return {
      success: false,
      action: 'deleted',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate total placement value
 */
function calculatePlacementValue(placement: Record<string, unknown>): number | null {
  // Direct fee
  if (typeof placement.fee === 'number' && placement.fee > 0) {
    return placement.fee;
  }

  // Salary-based placement
  if (typeof placement.salary === 'number' && placement.salary > 0) {
    return placement.salary;
  }

  // Contract placement - estimate from rates and duration
  if (
    typeof placement.payRate === 'number' &&
    placement.payRate > 0 &&
    placement.dateBegin &&
    placement.dateEnd
  ) {
    const startDate = new Date(placement.dateBegin as number);
    const endDate = new Date(placement.dateEnd as number);
    const weeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const hoursPerWeek =
      ((placement.hoursPerDay as number) || 8) * ((placement.daysPerWeek as number) || 5);
    return (placement.payRate as number) * hoursPerWeek * weeks;
  }

  return null;
}

/**
 * Build placement description
 */
function buildPlacementDescription(placement: Record<string, unknown>): string {
  const parts: string[] = [];

  if (placement.employmentType) {
    parts.push(`Type: ${placement.employmentType}`);
  }

  if (placement.dateBegin) {
    parts.push(`Start: ${new Date(placement.dateBegin as number).toLocaleDateString()}`);
  }

  if (placement.dateEnd) {
    parts.push(`End: ${new Date(placement.dateEnd as number).toLocaleDateString()}`);
  }

  if (placement.payRate) {
    parts.push(`Pay Rate: $${placement.payRate}/hr`);
  }

  if (placement.clientBillRate) {
    parts.push(`Bill Rate: $${placement.clientBillRate}/hr`);
  }

  if (placement.salary) {
    parts.push(`Salary: $${(placement.salary as number).toLocaleString()}`);
  }

  if (placement.fee) {
    parts.push(`Fee: $${(placement.fee as number).toLocaleString()}`);
  }

  return parts.length > 0 ? parts.join(' | ') : 'Placement created';
}

/**
 * Map placement status to deal status
 */
function mapPlacementStatusToDealStatus(status?: string): { stage: string; status: string } {
  const statusMap: Record<string, { stage: string; status: string }> = {
    Submitted: { stage: 'proposal', status: 'open' },
    Approved: { stage: 'won', status: 'won' },
    Active: { stage: 'won', status: 'won' },
    Completed: { stage: 'closed', status: 'won' },
    Terminated: { stage: 'closed', status: 'lost' },
  };

  return statusMap[status || ''] || { stage: 'won', status: 'won' };
}
