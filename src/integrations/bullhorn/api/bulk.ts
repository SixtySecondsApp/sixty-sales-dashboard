/**
 * Bullhorn Bulk Operations API Module
 *
 * Provides bulk entity operations for efficient batch processing.
 * Supports chunked operations to stay within Bullhorn rate limits.
 */

// =============================================================================
// Constants
// =============================================================================

// Bullhorn allows up to 100 concurrent API calls per user session
const MAX_BATCH_SIZE = 50;
const MAX_IDS_PER_REQUEST = 100;
const RATE_LIMIT_DELAY_MS = 100;

// =============================================================================
// Types
// =============================================================================

export interface BulkOperationResult<T = unknown> {
  success: boolean;
  total: number;
  processed: number;
  failed: number;
  results: T[];
  errors: Array<{
    index: number;
    entityId?: number | string;
    error: string;
  }>;
  duration: number;
}

export interface BulkGetRequest {
  entityType: string;
  ids: number[];
  fields: string;
}

export interface BulkSearchRequest {
  entityType: string;
  query: string;
  fields: string;
  count: number;
  sort?: string;
}

export interface BulkCreateRequest<T> {
  entityType: string;
  records: T[];
}

export interface BulkUpdateRequest<T> {
  entityType: string;
  updates: Array<{
    id: number;
    data: Partial<T>;
  }>;
}

// =============================================================================
// Bulk Get Operations
// =============================================================================

/**
 * Generate bulk get requests for a list of entity IDs
 * Chunks IDs to respect API limits
 */
export function buildBulkGetRequests(
  entityType: string,
  ids: number[],
  fields: string
): Array<{ method: 'GET'; path: string; query: Record<string, string> }> {
  const requests: Array<{ method: 'GET'; path: string; query: Record<string, string> }> = [];

  // Chunk IDs into batches
  for (let i = 0; i < ids.length; i += MAX_IDS_PER_REQUEST) {
    const chunk = ids.slice(i, i + MAX_IDS_PER_REQUEST);
    requests.push({
      method: 'GET',
      path: `entity/${entityType}/${chunk.join(',')}`,
      query: { fields },
    });
  }

  return requests;
}

/**
 * Get multiple entities by IDs with pagination
 */
export function buildPaginatedGetRequest(
  entityType: string,
  ids: number[],
  fields: string,
  start: number = 0
): { method: 'GET'; path: string; query: Record<string, string> } {
  const chunk = ids.slice(start, start + MAX_IDS_PER_REQUEST);
  return {
    method: 'GET',
    path: `entity/${entityType}/${chunk.join(',')}`,
    query: { fields },
  };
}

// =============================================================================
// Bulk Search Operations
// =============================================================================

/**
 * Build paginated search requests for exhaustive search
 */
export function buildExhaustiveSearchRequests(
  entityType: string,
  query: string,
  fields: string,
  totalCount: number,
  sort: string = 'id'
): Array<{ method: 'GET'; path: string; query: Record<string, string | number> }> {
  const requests: Array<{ method: 'GET'; path: string; query: Record<string, string | number> }> =
    [];

  for (let start = 0; start < totalCount; start += MAX_BATCH_SIZE) {
    requests.push({
      method: 'GET',
      path: `search/${entityType}`,
      query: {
        query,
        fields,
        count: Math.min(MAX_BATCH_SIZE, totalCount - start),
        start,
        sort,
      },
    });
  }

  return requests;
}

/**
 * Build search count request to determine total results
 */
export function buildSearchCountRequest(
  entityType: string,
  query: string
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: `search/${entityType}`,
    query: {
      query,
      fields: 'id',
      count: 1,
      start: 0,
    },
  };
}

// =============================================================================
// Bulk Create Operations
// =============================================================================

/**
 * Build bulk create requests
 * Note: Bullhorn doesn't support true bulk create, so we generate individual requests
 */
export function buildBulkCreateRequests<T>(
  entityType: string,
  records: T[]
): Array<{ method: 'PUT'; path: string; body: T }> {
  return records.map((record) => ({
    method: 'PUT' as const,
    path: `entity/${entityType}`,
    body: record,
  }));
}

// =============================================================================
// Bulk Update Operations
// =============================================================================

/**
 * Build bulk update requests
 */
export function buildBulkUpdateRequests<T>(
  entityType: string,
  updates: Array<{ id: number; data: Partial<T> }>
): Array<{ method: 'POST'; path: string; body: Partial<T> }> {
  return updates.map((update) => ({
    method: 'POST' as const,
    path: `entity/${entityType}/${update.id}`,
    body: update.data,
  }));
}

// =============================================================================
// Bulk Delete Operations
// =============================================================================

/**
 * Build soft delete requests (update isDeleted = true)
 */
export function buildBulkSoftDeleteRequests(
  entityType: string,
  ids: number[]
): Array<{ method: 'POST'; path: string; body: { isDeleted: boolean } }> {
  return ids.map((id) => ({
    method: 'POST' as const,
    path: `entity/${entityType}/${id}`,
    body: { isDeleted: true },
  }));
}

/**
 * Build hard delete requests
 */
export function buildBulkHardDeleteRequests(
  entityType: string,
  ids: number[]
): Array<{ method: 'DELETE'; path: string }> {
  return ids.map((id) => ({
    method: 'DELETE' as const,
    path: `entity/${entityType}/${id}`,
  }));
}

// =============================================================================
// Request Execution Helpers
// =============================================================================

/**
 * Chunk an array into smaller arrays of specified size
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Create rate-limited execution plan
 */
export function createExecutionPlan<T>(
  items: T[],
  batchSize: number = MAX_BATCH_SIZE,
  delayMs: number = RATE_LIMIT_DELAY_MS
): {
  batches: T[][];
  totalBatches: number;
  estimatedDurationMs: number;
} {
  const batches = chunkArray(items, batchSize);
  return {
    batches,
    totalBatches: batches.length,
    estimatedDurationMs: batches.length * delayMs,
  };
}

/**
 * Delay execution for rate limiting
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Batch Processing Utilities
// =============================================================================

/**
 * Process items in batches with rate limiting
 */
export async function processBatches<T, R>(
  items: T[],
  processor: (batch: T[], batchIndex: number) => Promise<R[]>,
  options: {
    batchSize?: number;
    delayMs?: number;
    onProgress?: (processed: number, total: number) => void;
    onBatchComplete?: (batchIndex: number, results: R[]) => void;
  } = {}
): Promise<BulkOperationResult<R>> {
  const startTime = Date.now();
  const batchSize = options.batchSize || MAX_BATCH_SIZE;
  const delayMs = options.delayMs || RATE_LIMIT_DELAY_MS;

  const batches = chunkArray(items, batchSize);
  const allResults: R[] = [];
  const errors: Array<{ index: number; error: string }> = [];
  let processed = 0;

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];

    try {
      const results = await processor(batch, batchIndex);
      allResults.push(...results);
      processed += batch.length;

      if (options.onBatchComplete) {
        options.onBatchComplete(batchIndex, results);
      }

      if (options.onProgress) {
        options.onProgress(processed, items.length);
      }
    } catch (error) {
      // Record error for each item in failed batch
      batch.forEach((_, i) => {
        errors.push({
          index: batchIndex * batchSize + i,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    }

    // Rate limiting delay between batches
    if (batchIndex < batches.length - 1) {
      await delay(delayMs);
    }
  }

  return {
    success: errors.length === 0,
    total: items.length,
    processed,
    failed: errors.length,
    results: allResults,
    errors,
    duration: Date.now() - startTime,
  };
}

/**
 * Execute requests in parallel with concurrency limit
 */
export async function executeParallel<T, R>(
  items: T[],
  executor: (item: T) => Promise<R>,
  concurrency: number = 10
): Promise<BulkOperationResult<R>> {
  const startTime = Date.now();
  const results: R[] = [];
  const errors: Array<{ index: number; error: string }> = [];
  let processed = 0;

  // Create batches for parallel execution
  const batches = chunkArray(items, concurrency);

  for (const batch of batches) {
    const batchPromises = batch.map(async (item, localIndex) => {
      const globalIndex = processed + localIndex;
      try {
        const result = await executor(item);
        return { success: true, index: globalIndex, result };
      } catch (error) {
        return {
          success: false,
          index: globalIndex,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    for (const result of batchResults) {
      if (result.success && 'result' in result) {
        results.push(result.result as R);
      } else if (!result.success && 'error' in result) {
        errors.push({ index: result.index, error: result.error as string });
      }
    }

    processed += batch.length;
    await delay(RATE_LIMIT_DELAY_MS);
  }

  return {
    success: errors.length === 0,
    total: items.length,
    processed,
    failed: errors.length,
    results,
    errors,
    duration: Date.now() - startTime,
  };
}

// =============================================================================
// Sync Queue Operations
// =============================================================================

/**
 * Build sync queue items for bulk entities
 */
export function buildSyncQueueItems(
  orgId: string,
  jobType: string,
  entityIds: number[],
  priority: number = 5
): Array<{
  org_id: string;
  job_type: string;
  payload: { entityId: number };
  priority: number;
  status: 'pending';
}> {
  return entityIds.map((entityId) => ({
    org_id: orgId,
    job_type: jobType,
    payload: { entityId },
    priority,
    status: 'pending' as const,
  }));
}

/**
 * Create differential sync request - find entities modified since timestamp
 */
export function buildDeltaSyncRequest(
  entityType: string,
  sinceTimestamp: number,
  fields: string,
  count: number = 500
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: `search/${entityType}`,
    query: {
      query: `dateLastModified:[${sinceTimestamp} TO *]`,
      fields,
      count,
      start: 0,
      sort: 'dateLastModified',
    },
  };
}

// =============================================================================
// Export Constants
// =============================================================================

export const BULK_CONSTANTS = {
  MAX_BATCH_SIZE,
  MAX_IDS_PER_REQUEST,
  RATE_LIMIT_DELAY_MS,
} as const;
