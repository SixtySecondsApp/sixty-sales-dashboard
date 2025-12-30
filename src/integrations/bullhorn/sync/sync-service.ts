/**
 * Bullhorn Sync Service Orchestration
 *
 * Central orchestration service for managing all Bullhorn sync operations.
 * Coordinates between different entity sync services, handles queue processing,
 * and provides sync status monitoring.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BullhornCredentials } from '../types/bullhorn';
import {
  processBatches,
  buildDeltaSyncRequest,
  BULK_CONSTANTS,
} from '../api/bulk';

// =============================================================================
// Types
// =============================================================================

export type SyncEntityType =
  | 'candidate'
  | 'client_contact'
  | 'client_corporation'
  | 'job_order'
  | 'placement'
  | 'task'
  | 'note'
  | 'sendout';

export type SyncDirection = 'bullhorn_to_use60' | 'use60_to_bullhorn' | 'bidirectional';

export type SyncStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface SyncProgress {
  entityType: SyncEntityType;
  status: SyncStatus;
  total: number;
  processed: number;
  created: number;
  updated: number;
  failed: number;
  startedAt: string | null;
  completedAt: string | null;
  error?: string;
}

export interface SyncOptions {
  entityTypes?: SyncEntityType[];
  direction?: SyncDirection;
  fullSync?: boolean;
  sinceTimestamp?: number;
  batchSize?: number;
  onProgress?: (progress: SyncProgress) => void;
}

export interface SyncResult {
  success: boolean;
  entityResults: Record<SyncEntityType, SyncProgress>;
  totalProcessed: number;
  totalFailed: number;
  duration: number;
  errors: string[];
}

export interface SyncQueueItem {
  id: string;
  org_id: string;
  job_type: string;
  payload: Record<string, unknown>;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}

// =============================================================================
// Sync Service Class
// =============================================================================

export class BullhornSyncService {
  private supabase: SupabaseClient;
  private orgId: string;
  private credentials: BullhornCredentials;
  private abortController: AbortController | null = null;
  private currentProgress: Map<SyncEntityType, SyncProgress> = new Map();

  constructor(
    supabase: SupabaseClient,
    orgId: string,
    credentials: BullhornCredentials
  ) {
    this.supabase = supabase;
    this.orgId = orgId;
    this.credentials = credentials;
  }

  // ===========================================================================
  // Main Sync Operations
  // ===========================================================================

  /**
   * Run a full sync for all or specified entity types
   */
  async runSync(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    this.abortController = new AbortController();

    const entityTypes = options.entityTypes || this.getDefaultEntityOrder();
    const direction = options.direction || 'bidirectional';
    const errors: string[] = [];

    // Initialize progress for all entities
    for (const entityType of entityTypes) {
      this.initProgress(entityType);
    }

    try {
      // Process each entity type in order
      for (const entityType of entityTypes) {
        if (this.abortController.signal.aborted) {
          break;
        }

        await this.syncEntity(entityType, {
          ...options,
          direction,
        });
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown sync error');
    }

    // Calculate totals
    let totalProcessed = 0;
    let totalFailed = 0;
    const entityResults: Record<SyncEntityType, SyncProgress> = {} as Record<SyncEntityType, SyncProgress>;

    for (const entityType of entityTypes) {
      const progress = this.currentProgress.get(entityType);
      if (progress) {
        totalProcessed += progress.processed;
        totalFailed += progress.failed;
        entityResults[entityType] = progress;
      }
    }

    return {
      success: totalFailed === 0 && errors.length === 0,
      entityResults,
      totalProcessed,
      totalFailed,
      duration: Date.now() - startTime,
      errors,
    };
  }

  /**
   * Cancel ongoing sync
   */
  cancelSync(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Get current sync progress
   */
  getProgress(): Map<SyncEntityType, SyncProgress> {
    return new Map(this.currentProgress);
  }

  // ===========================================================================
  // Entity-Specific Sync
  // ===========================================================================

  private async syncEntity(
    entityType: SyncEntityType,
    options: SyncOptions
  ): Promise<void> {
    const progress = this.currentProgress.get(entityType);
    if (!progress) return;

    this.updateProgress(entityType, { status: 'running', startedAt: new Date().toISOString() });

    try {
      // Get last sync timestamp
      const sinceTimestamp = options.fullSync
        ? 0
        : options.sinceTimestamp || (await this.getLastSyncTimestamp(entityType));

      // Get entities to sync
      const entityIds = await this.fetchModifiedEntityIds(entityType, sinceTimestamp);

      this.updateProgress(entityType, { total: entityIds.length });

      if (entityIds.length === 0) {
        this.updateProgress(entityType, {
          status: 'completed',
          completedAt: new Date().toISOString(),
        });
        return;
      }

      // Queue sync jobs
      await this.queueSyncJobs(entityType, entityIds);

      // Update progress
      this.updateProgress(entityType, {
        status: 'completed',
        processed: entityIds.length,
        completedAt: new Date().toISOString(),
      });

      // Update last sync timestamp
      await this.updateLastSyncTimestamp(entityType);
    } catch (error) {
      this.updateProgress(entityType, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date().toISOString(),
      });
      throw error;
    }
  }

  // ===========================================================================
  // Queue Management
  // ===========================================================================

  /**
   * Queue sync jobs for entities
   */
  private async queueSyncJobs(
    entityType: SyncEntityType,
    entityIds: number[]
  ): Promise<void> {
    const jobType = this.getJobTypeForEntity(entityType);
    const priority = this.getPriorityForEntity(entityType);

    const queueItems = entityIds.map((entityId) => ({
      org_id: this.orgId,
      job_type: jobType,
      payload: { entityId },
      priority,
      status: 'pending' as const,
    }));

    // Insert in batches
    await processBatches(
      queueItems,
      async (batch) => {
        const { error } = await this.supabase
          .from('bullhorn_sync_queue')
          .insert(batch);

        if (error) {
          throw new Error(`Failed to queue sync jobs: ${error.message}`);
        }

        return batch;
      },
      { batchSize: BULK_CONSTANTS.MAX_BATCH_SIZE }
    );
  }

  /**
   * Process pending sync queue items
   */
  async processQueue(limit: number = 100): Promise<{
    processed: number;
    failed: number;
    errors: string[];
  }> {
    // Fetch pending items
    const { data: items, error } = await this.supabase
      .from('bullhorn_sync_queue')
      .select('*')
      .eq('org_id', this.orgId)
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error || !items) {
      return { processed: 0, failed: 0, errors: [error?.message || 'No items found'] };
    }

    let processed = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        await this.processQueueItem(item);
        processed++;
      } catch (err) {
        failed++;
        errors.push(`Item ${item.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return { processed, failed, errors };
  }

  /**
   * Process a single queue item
   */
  private async processQueueItem(item: SyncQueueItem): Promise<void> {
    // Mark as processing
    await this.supabase
      .from('bullhorn_sync_queue')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        attempts: item.attempts + 1,
      })
      .eq('id', item.id);

    try {
      // Process based on job type
      await this.executeJobType(item.job_type, item.payload);

      // Mark as completed
      await this.supabase
        .from('bullhorn_sync_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', item.id);
    } catch (error) {
      // Mark as failed
      await this.supabase
        .from('bullhorn_sync_queue')
        .update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', item.id);

      throw error;
    }
  }

  /**
   * Execute specific job type
   */
  private async executeJobType(
    jobType: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    // This would dispatch to specific sync handlers
    // Implementation depends on the entity type
    console.log(`Executing job type: ${jobType}`, payload);

    // In a real implementation, this would call the appropriate sync handler:
    // switch (jobType) {
    //   case 'sync_candidate':
    //     await candidateSyncHandler.sync(payload.entityId);
    //     break;
    //   case 'sync_client_contact':
    //     await clientContactSyncHandler.sync(payload.entityId);
    //     break;
    //   // ... etc
    // }
  }

  // ===========================================================================
  // Delta Sync Helpers
  // ===========================================================================

  /**
   * Fetch entity IDs modified since timestamp
   */
  private async fetchModifiedEntityIds(
    entityType: SyncEntityType,
    sinceTimestamp: number
  ): Promise<number[]> {
    const bullhornEntityType = this.getBullhornEntityType(entityType);
    const request = buildDeltaSyncRequest(bullhornEntityType, sinceTimestamp, 'id', 500);

    // This would use the Bullhorn API client to execute the request
    // For now, returning empty array as placeholder
    console.log('Fetching modified entities:', request);
    return [];
  }

  /**
   * Get last sync timestamp for entity type
   */
  private async getLastSyncTimestamp(entityType: SyncEntityType): Promise<number> {
    const { data } = await this.supabase
      .from('bullhorn_sync_state')
      .select('last_sync_at')
      .eq('org_id', this.orgId)
      .eq('entity_type', entityType)
      .maybeSingle();

    if (data?.last_sync_at) {
      return new Date(data.last_sync_at).getTime();
    }

    // Default to 30 days ago
    return Date.now() - 30 * 24 * 60 * 60 * 1000;
  }

  /**
   * Update last sync timestamp
   */
  private async updateLastSyncTimestamp(entityType: SyncEntityType): Promise<void> {
    const { error } = await this.supabase
      .from('bullhorn_sync_state')
      .upsert({
        org_id: this.orgId,
        entity_type: entityType,
        last_sync_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Failed to update sync timestamp:', error);
    }
  }

  // ===========================================================================
  // Progress Management
  // ===========================================================================

  private initProgress(entityType: SyncEntityType): void {
    this.currentProgress.set(entityType, {
      entityType,
      status: 'idle',
      total: 0,
      processed: 0,
      created: 0,
      updated: 0,
      failed: 0,
      startedAt: null,
      completedAt: null,
    });
  }

  private updateProgress(
    entityType: SyncEntityType,
    updates: Partial<SyncProgress>
  ): void {
    const current = this.currentProgress.get(entityType);
    if (current) {
      this.currentProgress.set(entityType, { ...current, ...updates });
    }
  }

  // ===========================================================================
  // Entity Type Mappings
  // ===========================================================================

  private getDefaultEntityOrder(): SyncEntityType[] {
    return [
      'client_corporation',
      'client_contact',
      'candidate',
      'job_order',
      'placement',
      'task',
      'sendout',
      'note',
    ];
  }

  private getJobTypeForEntity(entityType: SyncEntityType): string {
    const mapping: Record<SyncEntityType, string> = {
      candidate: 'sync_candidate',
      client_contact: 'sync_client_contact',
      client_corporation: 'sync_client_corporation',
      job_order: 'sync_job_order',
      placement: 'sync_placement',
      task: 'sync_task',
      note: 'sync_note',
      sendout: 'sync_sendout',
    };
    return mapping[entityType];
  }

  private getPriorityForEntity(entityType: SyncEntityType): number {
    // Higher priority for foundational entities
    const priorities: Record<SyncEntityType, number> = {
      client_corporation: 10,
      client_contact: 9,
      candidate: 8,
      job_order: 7,
      placement: 6,
      task: 5,
      sendout: 4,
      note: 3,
    };
    return priorities[entityType];
  }

  private getBullhornEntityType(entityType: SyncEntityType): string {
    const mapping: Record<SyncEntityType, string> = {
      candidate: 'Candidate',
      client_contact: 'ClientContact',
      client_corporation: 'ClientCorporation',
      job_order: 'JobOrder',
      placement: 'Placement',
      task: 'Task',
      note: 'Note',
      sendout: 'Sendout',
    };
    return mapping[entityType];
  }
}

// =============================================================================
// Sync Status Helper Functions
// =============================================================================

/**
 * Get sync status for an organization
 */
export async function getSyncStatus(
  supabase: SupabaseClient,
  orgId: string
): Promise<{
  lastSyncAt: string | null;
  entityStatuses: Record<string, { lastSyncAt: string | null; count: number }>;
  queueStatus: { pending: number; processing: number; failed: number };
}> {
  // Get sync state for all entities
  const { data: syncStates } = await supabase
    .from('bullhorn_sync_state')
    .select('entity_type, last_sync_at')
    .eq('org_id', orgId);

  // Get queue status counts
  const { data: queueCounts } = await supabase
    .from('bullhorn_sync_queue')
    .select('status')
    .eq('org_id', orgId)
    .in('status', ['pending', 'processing', 'failed']);

  // Get mapping counts
  const { data: mappingCounts } = await supabase
    .from('bullhorn_object_mappings')
    .select('bullhorn_entity_type')
    .eq('org_id', orgId);

  const entityStatuses: Record<string, { lastSyncAt: string | null; count: number }> = {};

  // Build entity statuses
  if (syncStates) {
    for (const state of syncStates) {
      const count = mappingCounts?.filter(
        (m) => m.bullhorn_entity_type.toLowerCase() === state.entity_type
      ).length || 0;

      entityStatuses[state.entity_type] = {
        lastSyncAt: state.last_sync_at,
        count,
      };
    }
  }

  // Calculate queue status
  const queueStatus = {
    pending: queueCounts?.filter((q) => q.status === 'pending').length || 0,
    processing: queueCounts?.filter((q) => q.status === 'processing').length || 0,
    failed: queueCounts?.filter((q) => q.status === 'failed').length || 0,
  };

  // Get most recent sync
  const lastSyncAt = syncStates?.reduce(
    (latest, state) => {
      if (!state.last_sync_at) return latest;
      if (!latest) return state.last_sync_at;
      return new Date(state.last_sync_at) > new Date(latest) ? state.last_sync_at : latest;
    },
    null as string | null
  );

  return {
    lastSyncAt,
    entityStatuses,
    queueStatus,
  };
}

/**
 * Clear failed sync queue items
 */
export async function clearFailedSyncJobs(
  supabase: SupabaseClient,
  orgId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('bullhorn_sync_queue')
    .delete()
    .eq('org_id', orgId)
    .eq('status', 'failed')
    .select('id');

  if (error) {
    throw new Error(`Failed to clear sync jobs: ${error.message}`);
  }

  return data?.length || 0;
}

/**
 * Retry failed sync jobs
 */
export async function retryFailedSyncJobs(
  supabase: SupabaseClient,
  orgId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('bullhorn_sync_queue')
    .update({ status: 'pending', error: null, attempts: 0 })
    .eq('org_id', orgId)
    .eq('status', 'failed')
    .select('id');

  if (error) {
    throw new Error(`Failed to retry sync jobs: ${error.message}`);
  }

  return data?.length || 0;
}
