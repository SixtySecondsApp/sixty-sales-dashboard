/**
 * Bullhorn Custom Fields API Module
 *
 * Provides operations for managing custom field mappings between
 * use60 and Bullhorn entities. Handles field discovery, mapping configuration,
 * and value transformation.
 */

// =============================================================================
// Types
// =============================================================================

export interface BullhornFieldMeta {
  name: string;
  label: string;
  type: 'String' | 'Integer' | 'Double' | 'Boolean' | 'Date' | 'Timestamp' | 'ToMany' | 'ToOne';
  dataType: string;
  maxLength?: number;
  required?: boolean;
  readOnly?: boolean;
  multiValue?: boolean;
  options?: Array<{ value: string; label: string }>;
  associatedEntity?: string;
}

export interface BullhornEntityMeta {
  entity: string;
  label: string;
  fields: Record<string, BullhornFieldMeta>;
}

export interface FieldMapping {
  use60Field: string;
  bullhornField: string;
  bullhornEntityType: 'Candidate' | 'ClientContact' | 'JobOrder' | 'Note' | 'Task';
  transformType: 'direct' | 'lookup' | 'concat' | 'custom';
  transformConfig?: Record<string, unknown>;
  direction: 'bullhorn_to_use60' | 'use60_to_bullhorn' | 'bidirectional';
  enabled: boolean;
}

export interface CustomFieldConfig {
  orgId: string;
  mappings: FieldMapping[];
  lastUpdated: string;
}

// =============================================================================
// Constants - Default Custom Field Mappings
// =============================================================================

/**
 * Default field mappings for Candidate entity
 * These map Bullhorn custom fields to use60 contact fields
 */
export const DEFAULT_CANDIDATE_FIELD_MAPPINGS: FieldMapping[] = [
  // Standard fields
  {
    use60Field: 'first_name',
    bullhornField: 'firstName',
    bullhornEntityType: 'Candidate',
    transformType: 'direct',
    direction: 'bidirectional',
    enabled: true,
  },
  {
    use60Field: 'last_name',
    bullhornField: 'lastName',
    bullhornEntityType: 'Candidate',
    transformType: 'direct',
    direction: 'bidirectional',
    enabled: true,
  },
  {
    use60Field: 'email',
    bullhornField: 'email',
    bullhornEntityType: 'Candidate',
    transformType: 'direct',
    direction: 'bidirectional',
    enabled: true,
  },
  {
    use60Field: 'phone',
    bullhornField: 'phone',
    bullhornEntityType: 'Candidate',
    transformType: 'direct',
    direction: 'bidirectional',
    enabled: true,
  },
  // Custom fields for meeting intelligence
  {
    use60Field: 'metadata.availability',
    bullhornField: 'customText1',
    bullhornEntityType: 'Candidate',
    transformType: 'direct',
    direction: 'use60_to_bullhorn',
    enabled: true,
  },
  {
    use60Field: 'metadata.notice_period',
    bullhornField: 'customText2',
    bullhornEntityType: 'Candidate',
    transformType: 'direct',
    direction: 'use60_to_bullhorn',
    enabled: true,
  },
  {
    use60Field: 'metadata.interest_level',
    bullhornField: 'customText3',
    bullhornEntityType: 'Candidate',
    transformType: 'direct',
    direction: 'use60_to_bullhorn',
    enabled: true,
  },
  {
    use60Field: 'metadata.expected_salary',
    bullhornField: 'salary',
    bullhornEntityType: 'Candidate',
    transformType: 'direct',
    direction: 'use60_to_bullhorn',
    enabled: true,
  },
];

/**
 * Default field mappings for ClientContact entity
 */
export const DEFAULT_CLIENT_CONTACT_FIELD_MAPPINGS: FieldMapping[] = [
  {
    use60Field: 'first_name',
    bullhornField: 'firstName',
    bullhornEntityType: 'ClientContact',
    transformType: 'direct',
    direction: 'bidirectional',
    enabled: true,
  },
  {
    use60Field: 'last_name',
    bullhornField: 'lastName',
    bullhornEntityType: 'ClientContact',
    transformType: 'direct',
    direction: 'bidirectional',
    enabled: true,
  },
  {
    use60Field: 'email',
    bullhornField: 'email',
    bullhornEntityType: 'ClientContact',
    transformType: 'direct',
    direction: 'bidirectional',
    enabled: true,
  },
  {
    use60Field: 'phone',
    bullhornField: 'phone',
    bullhornEntityType: 'ClientContact',
    transformType: 'direct',
    direction: 'bidirectional',
    enabled: true,
  },
  {
    use60Field: 'company',
    bullhornField: 'clientCorporation.name',
    bullhornEntityType: 'ClientContact',
    transformType: 'lookup',
    direction: 'bullhorn_to_use60',
    enabled: true,
  },
];

/**
 * Default field mappings for JobOrder entity
 */
export const DEFAULT_JOB_ORDER_FIELD_MAPPINGS: FieldMapping[] = [
  {
    use60Field: 'name',
    bullhornField: 'title',
    bullhornEntityType: 'JobOrder',
    transformType: 'direct',
    direction: 'bidirectional',
    enabled: true,
  },
  {
    use60Field: 'description',
    bullhornField: 'publicDescription',
    bullhornEntityType: 'JobOrder',
    transformType: 'direct',
    direction: 'bullhorn_to_use60',
    enabled: true,
  },
  {
    use60Field: 'metadata.budget',
    bullhornField: 'salary',
    bullhornEntityType: 'JobOrder',
    transformType: 'direct',
    direction: 'bidirectional',
    enabled: true,
  },
  {
    use60Field: 'metadata.start_date',
    bullhornField: 'startDate',
    bullhornEntityType: 'JobOrder',
    transformType: 'direct',
    direction: 'bidirectional',
    enabled: true,
  },
];

// =============================================================================
// API Request Builders
// =============================================================================

/**
 * Get entity metadata including field definitions
 */
export function getEntityMetaRequest(
  entityType: 'Candidate' | 'ClientContact' | 'JobOrder' | 'Note' | 'Task'
): { method: 'GET'; path: string; query: Record<string, string> } {
  return {
    method: 'GET',
    path: `meta/${entityType}`,
    query: { fields: '*' },
  };
}

/**
 * Get available options for a specific field
 */
export function getFieldOptionsRequest(
  entityType: string,
  fieldName: string
): { method: 'GET'; path: string; query: Record<string, string | number> } {
  return {
    method: 'GET',
    path: `options/${entityType}`,
    query: {
      filter: fieldName,
      count: 500,
    },
  };
}

// =============================================================================
// Field Transformation Functions
// =============================================================================

/**
 * Transform a value from use60 format to Bullhorn format
 */
export function transformTooBullhorn(
  value: unknown,
  mapping: FieldMapping,
  fieldMeta?: BullhornFieldMeta
): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  switch (mapping.transformType) {
    case 'direct':
      return transformDirectToBullhorn(value, fieldMeta);
    case 'lookup':
      return transformLookupToBullhorn(value, mapping);
    case 'concat':
      return transformConcatToBullhorn(value, mapping);
    case 'custom':
      return transformCustomToBullhorn(value, mapping);
    default:
      return value;
  }
}

/**
 * Transform a value from Bullhorn format to use60 format
 */
export function transformFromBullhorn(
  value: unknown,
  mapping: FieldMapping,
  fieldMeta?: BullhornFieldMeta
): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  switch (mapping.transformType) {
    case 'direct':
      return transformDirectFromBullhorn(value, fieldMeta);
    case 'lookup':
      return transformLookupFromBullhorn(value, mapping);
    case 'concat':
      return transformConcatFromBullhorn(value, mapping);
    case 'custom':
      return transformCustomFromBullhorn(value, mapping);
    default:
      return value;
  }
}

// =============================================================================
// Direct Transformation
// =============================================================================

function transformDirectToBullhorn(value: unknown, fieldMeta?: BullhornFieldMeta): unknown {
  if (!fieldMeta) return value;

  switch (fieldMeta.type) {
    case 'Integer':
      return typeof value === 'number' ? Math.round(value) : parseInt(String(value), 10) || null;
    case 'Double':
      return typeof value === 'number' ? value : parseFloat(String(value)) || null;
    case 'Boolean':
      return Boolean(value);
    case 'Date':
    case 'Timestamp':
      if (value instanceof Date) {
        return value.getTime();
      }
      if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return isNaN(parsed) ? null : parsed;
      }
      return value;
    case 'String':
      const strValue = String(value);
      if (fieldMeta.maxLength && strValue.length > fieldMeta.maxLength) {
        return strValue.substring(0, fieldMeta.maxLength);
      }
      return strValue;
    default:
      return value;
  }
}

function transformDirectFromBullhorn(value: unknown, fieldMeta?: BullhornFieldMeta): unknown {
  if (!fieldMeta) return value;

  switch (fieldMeta.type) {
    case 'Date':
    case 'Timestamp':
      if (typeof value === 'number') {
        return new Date(value).toISOString();
      }
      return value;
    default:
      return value;
  }
}

// =============================================================================
// Lookup Transformation
// =============================================================================

function transformLookupToBullhorn(value: unknown, mapping: FieldMapping): unknown {
  const config = mapping.transformConfig as { lookupTable?: Record<string, unknown> } | undefined;
  if (config?.lookupTable && typeof value === 'string') {
    return config.lookupTable[value] ?? value;
  }
  return value;
}

function transformLookupFromBullhorn(value: unknown, mapping: FieldMapping): unknown {
  const config = mapping.transformConfig as { reverseLookupTable?: Record<string, unknown> } | undefined;
  if (config?.reverseLookupTable && typeof value === 'string') {
    return config.reverseLookupTable[value] ?? value;
  }
  return value;
}

// =============================================================================
// Concat Transformation
// =============================================================================

function transformConcatToBullhorn(value: unknown, mapping: FieldMapping): unknown {
  const config = mapping.transformConfig as { separator?: string; fields?: string[] } | undefined;
  if (Array.isArray(value)) {
    return value.join(config?.separator || ', ');
  }
  return value;
}

function transformConcatFromBullhorn(value: unknown, mapping: FieldMapping): unknown {
  const config = mapping.transformConfig as { separator?: string } | undefined;
  if (typeof value === 'string' && config?.separator) {
    return value.split(config.separator).map((s) => s.trim());
  }
  return value;
}

// =============================================================================
// Custom Transformation
// =============================================================================

function transformCustomToBullhorn(value: unknown, mapping: FieldMapping): unknown {
  const config = mapping.transformConfig as { customFunction?: string } | undefined;

  // Handle common custom transformations
  switch (config?.customFunction) {
    case 'statusMap':
      return mapStatusToBullhorn(value as string);
    case 'priorityMap':
      return mapPriorityToBullhorn(value as string);
    case 'interestLevel':
      return mapInterestLevelToBullhorn(value as string);
    default:
      return value;
  }
}

function transformCustomFromBullhorn(value: unknown, mapping: FieldMapping): unknown {
  const config = mapping.transformConfig as { customFunction?: string } | undefined;

  switch (config?.customFunction) {
    case 'statusMap':
      return mapStatusFromBullhorn(value as string);
    case 'priorityMap':
      return mapPriorityFromBullhorn(value as number);
    case 'interestLevel':
      return mapInterestLevelFromBullhorn(value as string);
    default:
      return value;
  }
}

// =============================================================================
// Status Mapping
// =============================================================================

const STATUS_TO_BULLHORN: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  lead: 'New Lead',
  qualified: 'Qualified',
  placed: 'Placed',
};

const STATUS_FROM_BULLHORN: Record<string, string> = {
  Active: 'active',
  Inactive: 'inactive',
  'New Lead': 'lead',
  Qualified: 'qualified',
  Submitted: 'qualified',
  Placed: 'placed',
  Available: 'active',
  'On Assignment': 'active',
};

function mapStatusToBullhorn(status: string): string {
  return STATUS_TO_BULLHORN[status] || 'Active';
}

function mapStatusFromBullhorn(status: string): string {
  return STATUS_FROM_BULLHORN[status] || 'active';
}

// =============================================================================
// Priority Mapping
// =============================================================================

function mapPriorityToBullhorn(priority: string): number {
  switch (priority) {
    case 'urgent':
      return 1;
    case 'high':
      return 2;
    case 'medium':
      return 3;
    case 'low':
      return 4;
    default:
      return 3;
  }
}

function mapPriorityFromBullhorn(priority: number): string {
  switch (priority) {
    case 1:
      return 'urgent';
    case 2:
      return 'high';
    case 3:
      return 'medium';
    case 4:
    case 5:
      return 'low';
    default:
      return 'medium';
  }
}

// =============================================================================
// Interest Level Mapping
// =============================================================================

function mapInterestLevelToBullhorn(level: string): string {
  switch (level?.toLowerCase()) {
    case 'hot':
      return 'Hot';
    case 'warm':
      return 'Warm';
    case 'cold':
      return 'Cold';
    default:
      return 'Unknown';
  }
}

function mapInterestLevelFromBullhorn(level: string): string {
  switch (level?.toLowerCase()) {
    case 'hot':
      return 'hot';
    case 'warm':
      return 'warm';
    case 'cold':
      return 'cold';
    default:
      return 'unknown';
  }
}

// =============================================================================
// Field Mapping Utilities
// =============================================================================

/**
 * Get value from nested object path
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Set value in nested object path
 */
export function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const target = keys.reduce<Record<string, unknown>>((current, key) => {
    if (!(key in current)) {
      current[key] = {};
    }
    return current[key] as Record<string, unknown>;
  }, obj);
  target[lastKey] = value;
  return obj;
}

/**
 * Apply field mappings to transform an object
 */
export function applyMappings<T extends Record<string, unknown>>(
  source: T,
  mappings: FieldMapping[],
  direction: 'to_bullhorn' | 'from_bullhorn',
  fieldMetas?: Record<string, BullhornFieldMeta>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const mapping of mappings) {
    if (!mapping.enabled) continue;

    // Check direction compatibility
    if (direction === 'to_bullhorn' && mapping.direction === 'bullhorn_to_use60') continue;
    if (direction === 'from_bullhorn' && mapping.direction === 'use60_to_bullhorn') continue;

    const sourceField = direction === 'to_bullhorn' ? mapping.use60Field : mapping.bullhornField;
    const targetField = direction === 'to_bullhorn' ? mapping.bullhornField : mapping.use60Field;

    const sourceValue = getNestedValue(source, sourceField);
    if (sourceValue === undefined) continue;

    const fieldMeta = fieldMetas?.[mapping.bullhornField];
    const transformedValue =
      direction === 'to_bullhorn'
        ? transformTooBullhorn(sourceValue, mapping, fieldMeta)
        : transformFromBullhorn(sourceValue, mapping, fieldMeta);

    setNestedValue(result, targetField, transformedValue);
  }

  return result;
}

// =============================================================================
// Default Mappings by Entity Type
// =============================================================================

export function getDefaultMappings(
  entityType: 'Candidate' | 'ClientContact' | 'JobOrder'
): FieldMapping[] {
  switch (entityType) {
    case 'Candidate':
      return DEFAULT_CANDIDATE_FIELD_MAPPINGS;
    case 'ClientContact':
      return DEFAULT_CLIENT_CONTACT_FIELD_MAPPINGS;
    case 'JobOrder':
      return DEFAULT_JOB_ORDER_FIELD_MAPPINGS;
    default:
      return [];
  }
}
