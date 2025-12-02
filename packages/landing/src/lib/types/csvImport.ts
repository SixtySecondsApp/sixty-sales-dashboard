/**
 * TypeScript types for the generic CSV lead import feature
 */

// ============================================================================
// WIZARD STATE TYPES
// ============================================================================

export type CSVImportStep = 1 | 2 | 3 | 4;

export interface CSVImportState {
  step: CSVImportStep;
  file: File | null;
  fileName: string | null;
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  mappings: Record<string, string>; // CSV column name -> lead field name
  autoDetectedMappings: Record<string, string>; // Track which were auto-detected
  validation: ValidationResult;
  importOptions: ImportOptions;
  importProgress: ImportProgress | null;
  importResult: ImportResult | null;
}

export interface ImportOptions {
  skipDuplicates: boolean;
  updateExisting: boolean;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  totalRows: number;
  validRows: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidationIssue {
  type: 'error' | 'warning';
  code: ValidationCode;
  message: string;
  rowNumbers: number[];
  count: number;
  sampleValues?: string[];
}

export type ValidationCode =
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_EMAIL_FORMAT'
  | 'DUPLICATE_EMAIL'
  | 'INVALID_DATE_FORMAT'
  | 'ROW_COLUMN_MISMATCH'
  | 'MISSING_EMAIL_MAPPING'
  | 'EMPTY_FILE'
  | 'NO_DATA_ROWS';

// ============================================================================
// IMPORT PROGRESS & RESULT TYPES
// ============================================================================

export type ImportStage = 'validating' | 'uploading' | 'processing' | 'complete' | 'error';

export interface ImportProgress {
  stage: ImportStage;
  progress: number; // 0-100
  currentRow: number;
  totalRows: number;
  stats: ImportStats;
  message?: string;
}

export interface ImportStats {
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

export interface ImportResult {
  success: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
  leadIds: string[];
}

export interface ImportError {
  row: number;
  column?: string;
  message: string;
  value?: string;
}

// ============================================================================
// FIELD MAPPING TYPES
// ============================================================================

export interface LeadFieldGroup {
  label: string;
  fields: LeadField[];
}

export interface LeadField {
  value: string;
  label: string;
  hint?: string;
  isAction?: boolean; // For special actions like "skip" or "store in metadata"
}

export interface ColumnMapping {
  csvColumn: string;
  leadField: string | null;
  sampleValues: string[];
  isAutoDetected: boolean;
}

// ============================================================================
// MAPPING TEMPLATE TYPES
// ============================================================================

export interface MappingTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  column_mappings: Record<string, string>;
  source_hint: string | null;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MappingTemplateInsert {
  name: string;
  description?: string | null;
  column_mappings: Record<string, string>;
  source_hint?: string | null;
}

export interface MappingTemplateUpdate {
  name?: string;
  description?: string | null;
  column_mappings?: Record<string, string>;
  source_hint?: string | null;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface ImportLeadsRequest {
  rows: Record<string, string>[];
  mappings: Record<string, string>;
  options: ImportOptions;
}

export interface ImportLeadsResponse {
  success: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
  leadIds: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Lead field groups for the mapping dropdown UI
 */
export const LEAD_FIELD_GROUPS: LeadFieldGroup[] = [
  {
    label: 'Contact Information',
    fields: [
      { value: 'contact_email', label: 'Email', hint: 'Primary identifier for deduplication' },
      { value: 'contact_name', label: 'Full Name' },
      { value: 'contact_first_name', label: 'First Name' },
      { value: 'contact_last_name', label: 'Last Name' },
      { value: 'contact_phone', label: 'Phone' },
      { value: 'contact_timezone', label: 'Timezone' },
    ],
  },
  {
    label: 'Company',
    fields: [
      { value: 'domain', label: 'Company Domain / Website' },
    ],
  },
  {
    label: 'Meeting Details',
    fields: [
      { value: 'meeting_title', label: 'Meeting Title' },
      { value: 'meeting_description', label: 'Meeting Description' },
      { value: 'meeting_start', label: 'Meeting Start Date/Time' },
      { value: 'meeting_end', label: 'Meeting End Date/Time' },
      { value: 'meeting_url', label: 'Meeting URL' },
    ],
  },
  {
    label: 'Source & Attribution',
    fields: [
      { value: 'utm_source', label: 'Source (UTM)' },
      { value: 'utm_medium', label: 'Medium (UTM)' },
      { value: 'utm_campaign', label: 'Campaign (UTM)' },
      { value: 'utm_term', label: 'Term (UTM)' },
      { value: 'utm_content', label: 'Content (UTM)' },
      { value: 'source_channel', label: 'Source Channel' },
      { value: 'external_source', label: 'External System Name' },
      { value: 'external_id', label: 'External ID' },
    ],
  },
  {
    label: 'Other',
    fields: [
      { value: 'scheduler_name', label: 'Scheduler Name' },
      { value: 'scheduler_email', label: 'Scheduler Email' },
      { value: 'tags', label: 'Tags (comma-separated)' },
    ],
  },
  {
    label: 'Actions',
    fields: [
      { value: '__skip__', label: '-- Skip this column --', isAction: true },
      { value: '__metadata__', label: '-- Store in metadata --', isAction: true },
    ],
  },
];

/**
 * Auto-detection patterns for CSV column names
 * Keys are lead field names, values are arrays of possible CSV column names (lowercase)
 */
export const AUTO_DETECT_PATTERNS: Record<string, string[]> = {
  contact_email: [
    'email', 'e-mail', 'mail', 'emailaddress', 'email_address', 'contact_email',
    'contactemail', 'work_email', 'primary_email', 'email address',
  ],
  contact_first_name: [
    'first', 'firstname', 'first_name', 'fname', 'given', 'givenname',
    'given_name', 'forename', 'first name',
  ],
  contact_last_name: [
    'last', 'lastname', 'last_name', 'lname', 'surname', 'family',
    'familyname', 'family_name', 'last name',
  ],
  contact_name: [
    'name', 'fullname', 'full_name', 'contact', 'contactname', 'contact_name',
    'person', 'lead_name', 'full name', 'contact name',
  ],
  contact_phone: [
    'phone', 'tel', 'telephone', 'mobile', 'cell', 'contact_phone',
    'phone_number', 'phonenumber', 'work_phone', 'direct', 'phone number',
  ],
  domain: [
    'domain', 'company_domain', 'website', 'company_website', 'web', 'url', 'site',
  ],
  meeting_title: [
    'title', 'subject', 'meeting_title', 'event_title', 'summary',
    'meeting_subject', 'event_name', 'meeting_name', 'meeting title',
  ],
  meeting_start: [
    'date', 'start', 'meeting_date', 'start_date', 'scheduled', 'start_at',
    'begins', 'meeting_time', 'event_date', 'start date', 'meeting date',
  ],
  meeting_end: [
    'end', 'end_date', 'end_at', 'ends', 'finish', 'meeting_end', 'end date',
  ],
  utm_source: [
    'source', 'utm_source', 'lead_source', 'channel', 'origin', 'referrer',
    'how_found', 'lead source',
  ],
  utm_campaign: [
    'campaign', 'utm_campaign', 'campaign_name', 'marketing_campaign',
  ],
  utm_medium: [
    'medium', 'utm_medium', 'marketing_medium',
  ],
  external_id: [
    'id', 'external_id', 'lead_id', 'record_id', 'ref', 'reference',
  ],
  scheduler_name: [
    'scheduler', 'booked_by', 'scheduled_by', 'rep', 'sales_rep', 'owner',
  ],
  tags: [
    'tags', 'labels', 'categories', 'keywords',
  ],
};

/**
 * Get flat list of all lead field values for validation
 */
export function getAllLeadFieldValues(): string[] {
  return LEAD_FIELD_GROUPS.flatMap(group => group.fields.map(field => field.value));
}

/**
 * Get field label by value
 */
export function getFieldLabel(fieldValue: string): string {
  for (const group of LEAD_FIELD_GROUPS) {
    const field = group.fields.find(f => f.value === fieldValue);
    if (field) return field.label;
  }
  return fieldValue;
}
