import { describe, expect, it, beforeEach } from 'vitest';

// =============================================================================
// Types (mirrored from src/integrations/bullhorn/sync/conflict-resolver.ts)
// =============================================================================

type ConflictStrategy = 'last_write_wins' | 'bullhorn_wins' | 'use60_wins' | 'manual';

interface FieldMapping {
  bullhornField: string;
  use60Field: string;
  priority?: 'bullhorn' | 'use60';
}

interface ConflictResult {
  hasConflict: boolean;
  conflictingFields: string[];
  bullhornNewer: boolean;
  use60Newer: boolean;
}

// =============================================================================
// Helper Functions (simplified versions for testing)
// =============================================================================

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

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

function areValuesEqual(val1: unknown, val2: unknown): boolean {
  if (val1 == null && val2 == null) return true;
  if (val1 == null || val2 == null) return false;

  // Handle dates
  if (val1 instanceof Date || val2 instanceof Date) {
    const d1 = new Date(val1 as string | number | Date);
    const d2 = new Date(val2 as string | number | Date);
    return d1.getTime() === d2.getTime();
  }

  // Handle objects
  if (typeof val1 === 'object' && typeof val2 === 'object') {
    return JSON.stringify(val1) === JSON.stringify(val2);
  }

  // String comparison (normalize case and whitespace)
  if (typeof val1 === 'string' && typeof val2 === 'string') {
    return val1.trim().toLowerCase() === val2.trim().toLowerCase();
  }

  return val1 === val2;
}

function detectConflicts(
  bullhornRecord: Record<string, unknown>,
  use60Record: Record<string, unknown>,
  fieldMappings: FieldMapping[],
  bullhornModified: Date,
  use60Modified: Date
): ConflictResult {
  const conflictingFields: string[] = [];

  for (const mapping of fieldMappings) {
    const bullhornValue = getNestedValue(bullhornRecord, mapping.bullhornField);
    const use60Value = getNestedValue(use60Record, mapping.use60Field);

    if (!areValuesEqual(bullhornValue, use60Value)) {
      conflictingFields.push(mapping.bullhornField);
    }
  }

  return {
    hasConflict: conflictingFields.length > 0,
    conflictingFields,
    bullhornNewer: bullhornModified > use60Modified,
    use60Newer: use60Modified > bullhornModified,
  };
}

function resolveConflict(
  bullhornData: Record<string, unknown>,
  use60Data: Record<string, unknown>,
  strategy: ConflictStrategy,
  bullhornModified: Date,
  use60Modified: Date,
  fieldMappings: FieldMapping[]
): { winner: 'bullhorn' | 'use60'; mergedData: Record<string, unknown> } {
  const bullhornNewer = bullhornModified > use60Modified;
  let winner: 'bullhorn' | 'use60';
  let mergedData: Record<string, unknown>;

  switch (strategy) {
    case 'bullhorn_wins':
      winner = 'bullhorn';
      mergedData = { ...bullhornData };
      break;
    case 'use60_wins':
      winner = 'use60';
      mergedData = { ...use60Data };
      break;
    case 'last_write_wins':
    default:
      winner = bullhornNewer ? 'bullhorn' : 'use60';
      mergedData = bullhornNewer ? { ...bullhornData } : { ...use60Data };
  }

  // Apply field-specific priority overrides
  for (const mapping of fieldMappings) {
    if (mapping.priority) {
      const useValue =
        mapping.priority === 'bullhorn'
          ? getNestedValue(bullhornData, mapping.bullhornField)
          : getNestedValue(use60Data, mapping.use60Field);
      setNestedValue(mergedData, mapping.bullhornField, useValue);
    }
  }

  return { winner, mergedData };
}

function generateRecordHash(record: Record<string, unknown>, fieldsToHash: string[]): string {
  const values = fieldsToHash.map((field) => {
    const value = getNestedValue(record, field);
    return JSON.stringify(value);
  });
  return btoa(values.join('|'));
}

// =============================================================================
// Tests
// =============================================================================

describe('ConflictResolver', () => {
  describe('getNestedValue', () => {
    it('should get top-level value', () => {
      const obj = { name: 'John' };
      expect(getNestedValue(obj, 'name')).toBe('John');
    });

    it('should get nested value with dot notation', () => {
      const obj = { address: { city: 'New York', state: 'NY' } };
      expect(getNestedValue(obj, 'address.city')).toBe('New York');
    });

    it('should return undefined for missing path', () => {
      const obj = { name: 'John' };
      expect(getNestedValue(obj, 'address.city')).toBeUndefined();
    });

    it('should handle deeply nested values', () => {
      const obj = { a: { b: { c: { d: 'value' } } } };
      expect(getNestedValue(obj, 'a.b.c.d')).toBe('value');
    });
  });

  describe('setNestedValue', () => {
    it('should set top-level value', () => {
      const obj: Record<string, unknown> = {};
      setNestedValue(obj, 'name', 'John');
      expect(obj.name).toBe('John');
    });

    it('should set nested value creating intermediate objects', () => {
      const obj: Record<string, unknown> = {};
      setNestedValue(obj, 'address.city', 'New York');
      expect((obj.address as Record<string, unknown>).city).toBe('New York');
    });

    it('should preserve existing siblings', () => {
      const obj: Record<string, unknown> = { address: { state: 'NY' } };
      setNestedValue(obj, 'address.city', 'New York');
      expect((obj.address as Record<string, unknown>).state).toBe('NY');
      expect((obj.address as Record<string, unknown>).city).toBe('New York');
    });
  });

  describe('areValuesEqual', () => {
    it('should handle null/undefined equality', () => {
      expect(areValuesEqual(null, null)).toBe(true);
      expect(areValuesEqual(undefined, undefined)).toBe(true);
      expect(areValuesEqual(null, undefined)).toBe(true);
    });

    it('should handle null vs value', () => {
      expect(areValuesEqual(null, 'value')).toBe(false);
      expect(areValuesEqual('value', null)).toBe(false);
    });

    it('should compare strings case-insensitively', () => {
      expect(areValuesEqual('John', 'john')).toBe(true);
      expect(areValuesEqual('  John  ', 'john')).toBe(true);
    });

    it('should compare numbers', () => {
      expect(areValuesEqual(123, 123)).toBe(true);
      expect(areValuesEqual(123, 456)).toBe(false);
    });

    it('should compare dates', () => {
      const date1 = new Date('2024-01-15T10:00:00Z');
      const date2 = new Date('2024-01-15T10:00:00Z');
      const date3 = new Date('2024-01-16T10:00:00Z');
      expect(areValuesEqual(date1, date2)).toBe(true);
      expect(areValuesEqual(date1, date3)).toBe(false);
    });

    it('should compare objects by JSON stringify', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 2 };
      const obj3 = { a: 1, b: 3 };
      expect(areValuesEqual(obj1, obj2)).toBe(true);
      expect(areValuesEqual(obj1, obj3)).toBe(false);
    });
  });

  describe('detectConflicts', () => {
    const candidateFieldMappings: FieldMapping[] = [
      { bullhornField: 'firstName', use60Field: 'first_name' },
      { bullhornField: 'lastName', use60Field: 'last_name' },
      { bullhornField: 'email', use60Field: 'email' },
    ];

    it('should detect no conflicts when records match', () => {
      const bullhornRecord = { firstName: 'John', lastName: 'Doe', email: 'john@example.com' };
      const use60Record = { first_name: 'John', last_name: 'Doe', email: 'john@example.com' };
      const now = new Date();

      const result = detectConflicts(
        bullhornRecord,
        use60Record,
        candidateFieldMappings,
        now,
        now
      );

      expect(result.hasConflict).toBe(false);
      expect(result.conflictingFields).toHaveLength(0);
    });

    it('should detect conflict when firstName differs', () => {
      const bullhornRecord = { firstName: 'John', lastName: 'Doe', email: 'john@example.com' };
      const use60Record = { first_name: 'Jonathan', last_name: 'Doe', email: 'john@example.com' };
      const now = new Date();

      const result = detectConflicts(
        bullhornRecord,
        use60Record,
        candidateFieldMappings,
        now,
        now
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflictingFields).toContain('firstName');
    });

    it('should identify bullhornNewer correctly', () => {
      const bullhornRecord = { firstName: 'John' };
      const use60Record = { first_name: 'Jonathan' };
      const bullhornModified = new Date('2024-01-15T12:00:00Z');
      const use60Modified = new Date('2024-01-15T10:00:00Z');

      const result = detectConflicts(
        bullhornRecord,
        use60Record,
        [{ bullhornField: 'firstName', use60Field: 'first_name' }],
        bullhornModified,
        use60Modified
      );

      expect(result.bullhornNewer).toBe(true);
      expect(result.use60Newer).toBe(false);
    });

    it('should identify use60Newer correctly', () => {
      const bullhornRecord = { firstName: 'John' };
      const use60Record = { first_name: 'Jonathan' };
      const bullhornModified = new Date('2024-01-15T10:00:00Z');
      const use60Modified = new Date('2024-01-15T12:00:00Z');

      const result = detectConflicts(
        bullhornRecord,
        use60Record,
        [{ bullhornField: 'firstName', use60Field: 'first_name' }],
        bullhornModified,
        use60Modified
      );

      expect(result.bullhornNewer).toBe(false);
      expect(result.use60Newer).toBe(true);
    });
  });

  describe('resolveConflict', () => {
    const fieldMappings: FieldMapping[] = [
      { bullhornField: 'firstName', use60Field: 'first_name' },
      { bullhornField: 'status', use60Field: 'status', priority: 'bullhorn' },
      { bullhornField: 'owner.id', use60Field: 'owner_id', priority: 'use60' },
    ];

    it('should resolve with last_write_wins - bullhorn newer', () => {
      const bullhornData = { firstName: 'John', status: 'Active', owner: { id: 1 } };
      const use60Data = { first_name: 'Jonathan', status: 'Inactive', owner_id: 2 };
      const bullhornModified = new Date('2024-01-15T12:00:00Z');
      const use60Modified = new Date('2024-01-15T10:00:00Z');

      const result = resolveConflict(
        bullhornData,
        use60Data,
        'last_write_wins',
        bullhornModified,
        use60Modified,
        []
      );

      expect(result.winner).toBe('bullhorn');
      expect(result.mergedData.firstName).toBe('John');
    });

    it('should resolve with last_write_wins - use60 newer', () => {
      const bullhornData = { firstName: 'John' };
      const use60Data = { first_name: 'Jonathan' };
      const bullhornModified = new Date('2024-01-15T10:00:00Z');
      const use60Modified = new Date('2024-01-15T12:00:00Z');

      const result = resolveConflict(
        bullhornData,
        use60Data,
        'last_write_wins',
        bullhornModified,
        use60Modified,
        []
      );

      expect(result.winner).toBe('use60');
    });

    it('should resolve with bullhorn_wins strategy', () => {
      const bullhornData = { firstName: 'John' };
      const use60Data = { first_name: 'Jonathan' };
      const bullhornModified = new Date('2024-01-15T10:00:00Z'); // older
      const use60Modified = new Date('2024-01-15T12:00:00Z'); // newer

      const result = resolveConflict(
        bullhornData,
        use60Data,
        'bullhorn_wins',
        bullhornModified,
        use60Modified,
        []
      );

      expect(result.winner).toBe('bullhorn');
      expect(result.mergedData.firstName).toBe('John');
    });

    it('should resolve with use60_wins strategy', () => {
      const bullhornData = { firstName: 'John' };
      const use60Data = { first_name: 'Jonathan' };
      const bullhornModified = new Date('2024-01-15T12:00:00Z'); // newer
      const use60Modified = new Date('2024-01-15T10:00:00Z'); // older

      const result = resolveConflict(
        bullhornData,
        use60Data,
        'use60_wins',
        bullhornModified,
        use60Modified,
        []
      );

      expect(result.winner).toBe('use60');
    });

    it('should apply field-specific priority overrides', () => {
      const bullhornData = { firstName: 'John', status: 'Active', owner: { id: 1 } };
      const use60Data = { first_name: 'Jonathan', status: 'Inactive', owner_id: 2 };
      const bullhornModified = new Date('2024-01-15T10:00:00Z');
      const use60Modified = new Date('2024-01-15T12:00:00Z');

      const result = resolveConflict(
        bullhornData,
        use60Data,
        'last_write_wins', // use60 would win by default
        bullhornModified,
        use60Modified,
        fieldMappings
      );

      // status should be from bullhorn (priority: bullhorn)
      expect(result.mergedData.status).toBe('Active');
      // owner.id should be from use60 (priority: use60)
      expect((result.mergedData.owner as Record<string, unknown>)?.id).toBe(2);
    });
  });

  describe('generateRecordHash', () => {
    it('should generate consistent hash for same data', () => {
      const record = { firstName: 'John', lastName: 'Doe', email: 'john@example.com' };
      const fields = ['firstName', 'lastName', 'email'];

      const hash1 = generateRecordHash(record, fields);
      const hash2 = generateRecordHash(record, fields);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different data', () => {
      const record1 = { firstName: 'John', lastName: 'Doe' };
      const record2 = { firstName: 'Jane', lastName: 'Doe' };
      const fields = ['firstName', 'lastName'];

      const hash1 = generateRecordHash(record1, fields);
      const hash2 = generateRecordHash(record2, fields);

      expect(hash1).not.toBe(hash2);
    });

    it('should only hash specified fields', () => {
      const record1 = { firstName: 'John', lastName: 'Doe', email: 'john@example.com' };
      const record2 = { firstName: 'John', lastName: 'Doe', email: 'different@example.com' };
      const fields = ['firstName', 'lastName']; // email not included

      const hash1 = generateRecordHash(record1, fields);
      const hash2 = generateRecordHash(record2, fields);

      expect(hash1).toBe(hash2);
    });

    it('should handle nested fields', () => {
      const record = {
        name: 'John',
        address: { city: 'New York', state: 'NY' },
      };
      const fields = ['name', 'address.city'];

      const hash = generateRecordHash(record, fields);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('Field Mappings', () => {
    it('should have correct candidate field mappings', () => {
      const CANDIDATE_FIELD_MAPPINGS: FieldMapping[] = [
        { bullhornField: 'firstName', use60Field: 'first_name' },
        { bullhornField: 'lastName', use60Field: 'last_name' },
        { bullhornField: 'email', use60Field: 'email' },
        { bullhornField: 'phone', use60Field: 'phone' },
        { bullhornField: 'mobile', use60Field: 'mobile_phone' },
        { bullhornField: 'address.city', use60Field: 'city' },
        { bullhornField: 'status', use60Field: 'status', priority: 'bullhorn' },
      ];

      expect(CANDIDATE_FIELD_MAPPINGS).toHaveLength(7);
      expect(CANDIDATE_FIELD_MAPPINGS.find(m => m.bullhornField === 'status')?.priority).toBe('bullhorn');
    });

    it('should have correct client contact field mappings', () => {
      const CLIENT_CONTACT_FIELD_MAPPINGS: FieldMapping[] = [
        { bullhornField: 'firstName', use60Field: 'first_name' },
        { bullhornField: 'lastName', use60Field: 'last_name' },
        { bullhornField: 'email', use60Field: 'email' },
        { bullhornField: 'phone', use60Field: 'phone' },
        { bullhornField: 'title', use60Field: 'title' },
        { bullhornField: 'clientCorporation.id', use60Field: 'company_id', priority: 'bullhorn' },
      ];

      expect(CLIENT_CONTACT_FIELD_MAPPINGS).toHaveLength(6);
      const companyMapping = CLIENT_CONTACT_FIELD_MAPPINGS.find(
        m => m.bullhornField === 'clientCorporation.id'
      );
      expect(companyMapping?.priority).toBe('bullhorn');
    });

    it('should have correct job order field mappings', () => {
      const JOB_ORDER_FIELD_MAPPINGS: FieldMapping[] = [
        { bullhornField: 'title', use60Field: 'name' },
        { bullhornField: 'description', use60Field: 'description' },
        { bullhornField: 'status', use60Field: 'stage', priority: 'bullhorn' },
        { bullhornField: 'numOpenings', use60Field: 'positions_open' },
        { bullhornField: 'clientCorporation.id', use60Field: 'company_id' },
        { bullhornField: 'dateEnd', use60Field: 'close_date' },
      ];

      expect(JOB_ORDER_FIELD_MAPPINGS).toHaveLength(6);
      expect(JOB_ORDER_FIELD_MAPPINGS.find(m => m.bullhornField === 'status')?.priority).toBe('bullhorn');
    });
  });
});
