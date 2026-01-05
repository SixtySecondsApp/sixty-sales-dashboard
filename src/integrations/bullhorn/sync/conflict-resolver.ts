/**
 * Bullhorn Sync Conflict Resolver
 *
 * Handles conflict detection and resolution for bi-directional sync.
 * Implements Last-Write-Wins (LWW) strategy with configurable override options.
 */

// =============================================================================
// Types
// =============================================================================

export type ConflictStrategy = 'last_write_wins' | 'bullhorn_wins' | 'use60_wins' | 'manual';

export type ConflictStatus = 'detected' | 'resolved' | 'pending_manual' | 'ignored';

export interface ConflictRecord {
  id: string;
  orgId: string;
  entityType: string;
  bullhornId: number;
  use60Id: string;
  bullhornData: Record<string, unknown>;
  use60Data: Record<string, unknown>;
  conflictingFields: string[];
  bullhornModifiedAt: Date;
  use60ModifiedAt: Date;
  status: ConflictStatus;
  resolution?: ConflictResolution;
  detectedAt: Date;
  resolvedAt?: Date;
}

export interface ConflictResolution {
  strategy: ConflictStrategy;
  winner: 'bullhorn' | 'use60';
  mergedData: Record<string, unknown>;
  resolvedBy: 'system' | 'user';
  resolvedAt: Date;
  notes?: string;
}

export interface FieldMapping {
  bullhornField: string;
  use60Field: string;
  priority?: 'bullhorn' | 'use60';
  transform?: (value: unknown, direction: 'to_bullhorn' | 'to_use60') => unknown;
}

export interface SyncState {
  bullhornId: number;
  use60Id: string;
  lastBullhornSync: Date;
  lastUse60Sync: Date;
  bullhornHash: string;
  use60Hash: string;
}

// =============================================================================
// Conflict Detector
// =============================================================================

/**
 * Detect conflicts between Bullhorn and use60 records
 */
export function detectConflicts(
  bullhornRecord: Record<string, unknown>,
  use60Record: Record<string, unknown>,
  fieldMappings: FieldMapping[],
  syncState?: SyncState
): {
  hasConflict: boolean;
  conflictingFields: string[];
  bullhornNewer: boolean;
  use60Newer: boolean;
} {
  const conflictingFields: string[] = [];

  // Get modification timestamps
  const bullhornModified = getModificationTime(bullhornRecord, 'dateLastModified');
  const use60Modified = getModificationTime(use60Record, 'updated_at');

  // Check each mapped field for differences
  for (const mapping of fieldMappings) {
    const bullhornValue = getNestedValue(bullhornRecord, mapping.bullhornField);
    const use60Value = getNestedValue(use60Record, mapping.use60Field);

    if (!areValuesEqual(bullhornValue, use60Value, mapping)) {
      conflictingFields.push(mapping.bullhornField);
    }
  }

  // Determine which is newer
  const bullhornNewer = bullhornModified > use60Modified;
  const use60Newer = use60Modified > bullhornModified;

  // Only a true conflict if both have been modified since last sync
  let hasConflict = conflictingFields.length > 0;

  if (syncState) {
    const bothModifiedSinceSync =
      bullhornModified > syncState.lastBullhornSync &&
      use60Modified > syncState.lastUse60Sync;
    hasConflict = hasConflict && bothModifiedSinceSync;
  }

  return {
    hasConflict,
    conflictingFields,
    bullhornNewer,
    use60Newer,
  };
}

// =============================================================================
// Conflict Resolution
// =============================================================================

/**
 * Resolve conflict using specified strategy
 */
export function resolveConflict(
  conflict: Omit<ConflictRecord, 'id' | 'status' | 'resolution' | 'resolvedAt'>,
  strategy: ConflictStrategy,
  fieldMappings: FieldMapping[]
): ConflictResolution {
  const now = new Date();

  switch (strategy) {
    case 'last_write_wins':
      return resolveLastWriteWins(conflict, fieldMappings, now);

    case 'bullhorn_wins':
      return {
        strategy,
        winner: 'bullhorn',
        mergedData: { ...conflict.bullhornData },
        resolvedBy: 'system',
        resolvedAt: now,
      };

    case 'use60_wins':
      return {
        strategy,
        winner: 'use60',
        mergedData: { ...conflict.use60Data },
        resolvedBy: 'system',
        resolvedAt: now,
      };

    case 'manual':
      // For manual, we don't auto-resolve
      throw new Error('Manual resolution required');

    default:
      return resolveLastWriteWins(conflict, fieldMappings, now);
  }
}

/**
 * Last-Write-Wins resolution strategy
 */
function resolveLastWriteWins(
  conflict: Omit<ConflictRecord, 'id' | 'status' | 'resolution' | 'resolvedAt'>,
  fieldMappings: FieldMapping[],
  resolvedAt: Date
): ConflictResolution {
  const bullhornNewer = conflict.bullhornModifiedAt > conflict.use60ModifiedAt;
  const winner = bullhornNewer ? 'bullhorn' : 'use60';

  // Start with the winner's data
  const mergedData: Record<string, unknown> = bullhornNewer
    ? { ...conflict.bullhornData }
    : { ...conflict.use60Data };

  // Apply field-specific priority overrides
  for (const mapping of fieldMappings) {
    if (mapping.priority) {
      const useValue =
        mapping.priority === 'bullhorn'
          ? getNestedValue(conflict.bullhornData, mapping.bullhornField)
          : getNestedValue(conflict.use60Data, mapping.use60Field);

      setNestedValue(mergedData, mapping.bullhornField, useValue);
    }
  }

  return {
    strategy: 'last_write_wins',
    winner,
    mergedData,
    resolvedBy: 'system',
    resolvedAt,
  };
}

/**
 * Merge conflicts with field-level selection
 */
export function mergeConflicts(
  conflict: Omit<ConflictRecord, 'id' | 'status' | 'resolution' | 'resolvedAt'>,
  fieldSelections: Record<string, 'bullhorn' | 'use60'>
): ConflictResolution {
  const mergedData: Record<string, unknown> = {};

  // Apply user's field selections
  for (const [field, source] of Object.entries(fieldSelections)) {
    const value =
      source === 'bullhorn'
        ? getNestedValue(conflict.bullhornData, field)
        : getNestedValue(conflict.use60Data, field);

    setNestedValue(mergedData, field, value);
  }

  // Determine primary winner based on majority
  const bullhornCount = Object.values(fieldSelections).filter((s) => s === 'bullhorn').length;
  const use60Count = Object.values(fieldSelections).filter((s) => s === 'use60').length;
  const winner = bullhornCount > use60Count ? 'bullhorn' : 'use60';

  return {
    strategy: 'manual',
    winner,
    mergedData,
    resolvedBy: 'user',
    resolvedAt: new Date(),
  };
}

// =============================================================================
// Hash Generation for Change Detection
// =============================================================================

/**
 * Generate hash of record for change detection
 */
export function generateRecordHash(
  record: Record<string, unknown>,
  fieldsToHash: string[]
): string {
  const values = fieldsToHash.map((field) => {
    const value = getNestedValue(record, field);
    return JSON.stringify(value);
  });

  // Simple hash using string comparison
  // In production, use crypto.subtle.digest for proper hashing
  return btoa(values.join('|'));
}

/**
 * Check if record has changed since last sync
 */
export function hasRecordChanged(
  record: Record<string, unknown>,
  fieldsToCheck: string[],
  previousHash: string
): boolean {
  const currentHash = generateRecordHash(record, fieldsToCheck);
  return currentHash !== previousHash;
}

// =============================================================================
// Field Mappings for Common Entities
// =============================================================================

export const CANDIDATE_FIELD_MAPPINGS: FieldMapping[] = [
  { bullhornField: 'firstName', use60Field: 'first_name' },
  { bullhornField: 'lastName', use60Field: 'last_name' },
  { bullhornField: 'email', use60Field: 'email' },
  { bullhornField: 'phone', use60Field: 'phone' },
  { bullhornField: 'mobile', use60Field: 'mobile_phone' },
  { bullhornField: 'address.city', use60Field: 'city' },
  { bullhornField: 'address.state', use60Field: 'state' },
  { bullhornField: 'status', use60Field: 'status', priority: 'bullhorn' },
  { bullhornField: 'owner.id', use60Field: 'owner_id', priority: 'use60' },
];

export const CLIENT_CONTACT_FIELD_MAPPINGS: FieldMapping[] = [
  { bullhornField: 'firstName', use60Field: 'first_name' },
  { bullhornField: 'lastName', use60Field: 'last_name' },
  { bullhornField: 'email', use60Field: 'email' },
  { bullhornField: 'phone', use60Field: 'phone' },
  { bullhornField: 'title', use60Field: 'title' },
  { bullhornField: 'clientCorporation.id', use60Field: 'company_id', priority: 'bullhorn' },
];

export const JOB_ORDER_FIELD_MAPPINGS: FieldMapping[] = [
  { bullhornField: 'title', use60Field: 'name' },
  { bullhornField: 'description', use60Field: 'description' },
  { bullhornField: 'status', use60Field: 'stage', priority: 'bullhorn' },
  { bullhornField: 'numOpenings', use60Field: 'positions_open' },
  { bullhornField: 'clientCorporation.id', use60Field: 'company_id' },
  { bullhornField: 'dateEnd', use60Field: 'close_date' },
];

export const TASK_FIELD_MAPPINGS: FieldMapping[] = [
  { bullhornField: 'subject', use60Field: 'title' },
  { bullhornField: 'description', use60Field: 'description' },
  { bullhornField: 'isCompleted', use60Field: 'completed' },
  { bullhornField: 'dateEnd', use60Field: 'due_date' },
  { bullhornField: 'priority', use60Field: 'priority' },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get modification time from record
 */
function getModificationTime(record: Record<string, unknown>, field: string): Date {
  const value = getNestedValue(record, field);
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (typeof value === 'string') return new Date(value);
  return new Date(0);
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Set nested value in object using dot notation
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  const lastKey = keys.pop();
  if (!lastKey) return;

  let current = obj;
  for (const key of keys) {
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[lastKey] = value;
}

/**
 * Compare values for equality, handling type differences
 */
function areValuesEqual(
  bullhornValue: unknown,
  use60Value: unknown,
  _mapping: FieldMapping
): boolean {
  // Handle null/undefined
  if (bullhornValue == null && use60Value == null) return true;
  if (bullhornValue == null || use60Value == null) return false;

  // Handle dates
  if (bullhornValue instanceof Date || use60Value instanceof Date) {
    const bDate = new Date(bullhornValue as string | number | Date);
    const uDate = new Date(use60Value as string | number | Date);
    return bDate.getTime() === uDate.getTime();
  }

  // Handle timestamps (Bullhorn uses milliseconds)
  if (typeof bullhornValue === 'number' && typeof use60Value === 'string') {
    const bDate = new Date(bullhornValue);
    const uDate = new Date(use60Value);
    return Math.abs(bDate.getTime() - uDate.getTime()) < 1000; // Within 1 second
  }

  // Handle objects
  if (typeof bullhornValue === 'object' && typeof use60Value === 'object') {
    return JSON.stringify(bullhornValue) === JSON.stringify(use60Value);
  }

  // String comparison (normalize case and whitespace)
  if (typeof bullhornValue === 'string' && typeof use60Value === 'string') {
    return bullhornValue.trim().toLowerCase() === use60Value.trim().toLowerCase();
  }

  // Direct comparison
  return bullhornValue === use60Value;
}

// =============================================================================
// Conflict Queue Management
// =============================================================================

export interface ConflictQueueItem {
  conflict: ConflictRecord;
  attempts: number;
  lastAttemptAt: Date | null;
  nextRetryAt: Date | null;
}

/**
 * Create conflict queue for manual resolution
 */
export function createConflictQueue(): {
  add: (conflict: ConflictRecord) => void;
  getNext: () => ConflictRecord | null;
  resolve: (id: string, resolution: ConflictResolution) => void;
  getPending: () => ConflictRecord[];
} {
  const queue: Map<string, ConflictQueueItem> = new Map();

  return {
    add: (conflict: ConflictRecord) => {
      queue.set(conflict.id, {
        conflict: { ...conflict, status: 'pending_manual' },
        attempts: 0,
        lastAttemptAt: null,
        nextRetryAt: null,
      });
    },

    getNext: () => {
      for (const [, item] of queue) {
        if (item.conflict.status === 'pending_manual') {
          return item.conflict;
        }
      }
      return null;
    },

    resolve: (id: string, resolution: ConflictResolution) => {
      const item = queue.get(id);
      if (item) {
        item.conflict.status = 'resolved';
        item.conflict.resolution = resolution;
        item.conflict.resolvedAt = resolution.resolvedAt;
      }
    },

    getPending: () => {
      return Array.from(queue.values())
        .filter((item) => item.conflict.status === 'pending_manual')
        .map((item) => item.conflict);
    },
  };
}

// =============================================================================
// Sync Tracking
// =============================================================================

/**
 * Track sync state for an entity pair
 */
export function createSyncTracker(initialState?: SyncState): {
  getState: () => SyncState | undefined;
  recordBullhornSync: (record: Record<string, unknown>, fields: string[]) => void;
  recordUse60Sync: (record: Record<string, unknown>, fields: string[]) => void;
  hasChanged: (source: 'bullhorn' | 'use60', record: Record<string, unknown>, fields: string[]) => boolean;
} {
  let state = initialState;

  return {
    getState: () => state,

    recordBullhornSync: (record: Record<string, unknown>, fields: string[]) => {
      if (state) {
        state.lastBullhornSync = new Date();
        state.bullhornHash = generateRecordHash(record, fields);
      }
    },

    recordUse60Sync: (record: Record<string, unknown>, fields: string[]) => {
      if (state) {
        state.lastUse60Sync = new Date();
        state.use60Hash = generateRecordHash(record, fields);
      }
    },

    hasChanged: (
      source: 'bullhorn' | 'use60',
      record: Record<string, unknown>,
      fields: string[]
    ): boolean => {
      if (!state) return true;
      const previousHash = source === 'bullhorn' ? state.bullhornHash : state.use60Hash;
      return hasRecordChanged(record, fields, previousHash);
    },
  };
}
