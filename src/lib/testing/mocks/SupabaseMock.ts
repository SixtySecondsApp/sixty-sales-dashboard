/**
 * Supabase Integration Mock
 *
 * Provides realistic mock data and API responses for testing
 * Supabase database operations in workflows.
 */

import type { ProcessMapMock, MockType } from '@/lib/types/processMapTesting';

// ============================================================================
// Mock Data Types
// ============================================================================

export interface MockSupabaseQueryResult<T = Record<string, unknown>> {
  data: T[] | T | null;
  error: MockSupabaseError | null;
  count: number | null;
  status: number;
  statusText: string;
}

export interface MockSupabaseError {
  message: string;
  details: string;
  hint: string;
  code: string;
}

export interface MockSupabaseTable {
  name: string;
  rows: Map<string, Record<string, unknown>>;
  schema: Record<string, 'string' | 'number' | 'boolean' | 'json' | 'timestamp'>;
}

// Common table types for the use60 application
export interface MockContact {
  id: string;
  user_id: string;
  org_id: string;
  full_name: string;
  email: string;
  phone?: string;
  company_id?: string;
  job_title?: string;
  created_at: string;
  updated_at: string;
}

export interface MockDeal {
  id: string;
  user_id: string;
  org_id: string;
  name: string;
  value: number;
  stage: string;
  probability: number;
  close_date?: string;
  contact_id?: string;
  company_id?: string;
  created_at: string;
  updated_at: string;
}

export interface MockMeeting {
  id: string;
  owner_user_id: string;
  org_id: string;
  title: string;
  start_time: string;
  end_time: string;
  meeting_type: string;
  status: string;
  external_id?: string;
  created_at: string;
  updated_at: string;
}

export interface MockTask {
  id: string;
  user_id: string;
  org_id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Sample Data
// ============================================================================

const CONTACT_NAMES = [
  { full_name: 'John Smith', email: 'john.smith@acme.com', job_title: 'CEO' },
  { full_name: 'Sarah Johnson', email: 'sarah.j@techstart.io', job_title: 'VP Sales' },
  { full_name: 'Michael Chen', email: 'mchen@global.com', job_title: 'CTO' },
  { full_name: 'Emily Davis', email: 'emily.d@innovate.co', job_title: 'Product Manager' },
];

const DEAL_NAMES = [
  'Enterprise License Deal',
  'Pilot Program',
  'Platform Upgrade',
  'Consulting Engagement',
  'Annual Renewal',
];

const DEAL_STAGES = [
  'qualification',
  'discovery',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
];

const MEETING_TITLES = [
  'Discovery Call',
  'Product Demo',
  'Contract Review',
  'Quarterly Review',
  'Kickoff Meeting',
];

const TASK_TITLES = [
  'Send follow-up email',
  'Prepare proposal',
  'Schedule demo',
  'Update CRM',
  'Review contract',
];

// ============================================================================
// Helper Functions
// ============================================================================

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateId(prefix: string = 'rec'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ============================================================================
// Supabase Mock Class
// ============================================================================

export class SupabaseMock {
  private tables: Map<string, MockSupabaseTable> = new Map();
  private defaultOrgId: string = 'org_test_123';
  private defaultUserId: string = 'user_test_456';

  constructor(options?: { preloadData?: boolean; orgId?: string; userId?: string }) {
    if (options?.orgId) this.defaultOrgId = options.orgId;
    if (options?.userId) this.defaultUserId = options.userId;

    this.initializeTables();
    if (options?.preloadData) {
      this.generateSampleData();
    }
  }

  private initializeTables(): void {
    // Initialize common tables with schemas
    this.tables.set('contacts', {
      name: 'contacts',
      rows: new Map(),
      schema: {
        id: 'string',
        user_id: 'string',
        org_id: 'string',
        full_name: 'string',
        email: 'string',
        phone: 'string',
        company_id: 'string',
        job_title: 'string',
        created_at: 'timestamp',
        updated_at: 'timestamp',
      },
    });

    this.tables.set('deals', {
      name: 'deals',
      rows: new Map(),
      schema: {
        id: 'string',
        user_id: 'string',
        org_id: 'string',
        name: 'string',
        value: 'number',
        stage: 'string',
        probability: 'number',
        close_date: 'timestamp',
        contact_id: 'string',
        company_id: 'string',
        created_at: 'timestamp',
        updated_at: 'timestamp',
      },
    });

    this.tables.set('meetings', {
      name: 'meetings',
      rows: new Map(),
      schema: {
        id: 'string',
        owner_user_id: 'string',
        org_id: 'string',
        title: 'string',
        start_time: 'timestamp',
        end_time: 'timestamp',
        meeting_type: 'string',
        status: 'string',
        external_id: 'string',
        created_at: 'timestamp',
        updated_at: 'timestamp',
      },
    });

    this.tables.set('tasks', {
      name: 'tasks',
      rows: new Map(),
      schema: {
        id: 'string',
        user_id: 'string',
        org_id: 'string',
        title: 'string',
        description: 'string',
        status: 'string',
        priority: 'string',
        due_date: 'timestamp',
        completed_at: 'timestamp',
        created_at: 'timestamp',
        updated_at: 'timestamp',
      },
    });
  }

  // ============================================================================
  // Data Generators
  // ============================================================================

  generateContact(overrides?: Partial<MockContact>): MockContact {
    const now = new Date().toISOString();
    const contactData = randomElement(CONTACT_NAMES);

    const contact: MockContact = {
      id: generateUUID(),
      user_id: this.defaultUserId,
      org_id: this.defaultOrgId,
      full_name: contactData.full_name,
      email: contactData.email,
      phone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      job_title: contactData.job_title,
      created_at: now,
      updated_at: now,
      ...overrides,
    };

    const table = this.tables.get('contacts');
    if (table) {
      table.rows.set(contact.id, contact);
    }
    return contact;
  }

  generateDeal(overrides?: Partial<MockDeal>): MockDeal {
    const now = new Date().toISOString();
    const closeDate = new Date();
    closeDate.setDate(closeDate.getDate() + Math.floor(Math.random() * 90) + 30);

    const deal: MockDeal = {
      id: generateUUID(),
      user_id: this.defaultUserId,
      org_id: this.defaultOrgId,
      name: randomElement(DEAL_NAMES),
      value: Math.floor(Math.random() * 200000) + 10000,
      stage: randomElement(DEAL_STAGES),
      probability: Math.floor(Math.random() * 100),
      close_date: closeDate.toISOString(),
      created_at: now,
      updated_at: now,
      ...overrides,
    };

    const table = this.tables.get('deals');
    if (table) {
      table.rows.set(deal.id, deal);
    }
    return deal;
  }

  generateMeeting(overrides?: Partial<MockMeeting>): MockMeeting {
    const now = new Date();
    const startTime = new Date(now.getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour

    const meeting: MockMeeting = {
      id: generateUUID(),
      owner_user_id: this.defaultUserId,
      org_id: this.defaultOrgId,
      title: randomElement(MEETING_TITLES),
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      meeting_type: 'external',
      status: 'scheduled',
      external_id: generateId('fathom'),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      ...overrides,
    };

    const table = this.tables.get('meetings');
    if (table) {
      table.rows.set(meeting.id, meeting);
    }
    return meeting;
  }

  generateTask(overrides?: Partial<MockTask>): MockTask {
    const now = new Date();
    const dueDate = new Date(now.getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000);

    const task: MockTask = {
      id: generateUUID(),
      user_id: this.defaultUserId,
      org_id: this.defaultOrgId,
      title: randomElement(TASK_TITLES),
      description: 'Auto-generated task for testing',
      status: 'pending',
      priority: randomElement(['low', 'medium', 'high']),
      due_date: dueDate.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      ...overrides,
    };

    const table = this.tables.get('tasks');
    if (table) {
      table.rows.set(task.id, task);
    }
    return task;
  }

  private generateSampleData(): void {
    // Generate contacts
    for (let i = 0; i < 5; i++) {
      const contact = this.generateContact();
      // Create a deal for some contacts
      if (i < 3) {
        this.generateDeal({ contact_id: contact.id });
      }
    }

    // Generate meetings
    for (let i = 0; i < 5; i++) {
      this.generateMeeting();
    }

    // Generate tasks
    for (let i = 0; i < 5; i++) {
      this.generateTask();
    }
  }

  // ============================================================================
  // Mock Query Operations
  // ============================================================================

  async select<T = Record<string, unknown>>(
    tableName: string,
    options?: {
      columns?: string[];
      filters?: Record<string, unknown>;
      limit?: number;
      single?: boolean;
    }
  ): Promise<MockSupabaseQueryResult<T>> {
    await this.delay(50 + Math.random() * 50);

    const table = this.tables.get(tableName);
    if (!table) {
      return {
        data: null,
        error: { message: `Table '${tableName}' does not exist`, details: '', hint: '', code: 'PGRST204' },
        count: null,
        status: 404,
        statusText: 'Not Found',
      };
    }

    let rows = Array.from(table.rows.values());

    // Apply filters
    if (options?.filters) {
      rows = rows.filter(row => {
        return Object.entries(options.filters!).every(([key, value]) => {
          return row[key] === value;
        });
      });
    }

    // Apply limit
    if (options?.limit) {
      rows = rows.slice(0, options.limit);
    }

    // Return single or array
    if (options?.single) {
      if (rows.length === 0) {
        return {
          data: null,
          error: { message: 'Row not found', details: '', hint: '', code: 'PGRST116' },
          count: 0,
          status: 406,
          statusText: 'Not Acceptable',
        };
      }
      return {
        data: rows[0] as T,
        error: null,
        count: 1,
        status: 200,
        statusText: 'OK',
      };
    }

    return {
      data: rows as T[],
      error: null,
      count: rows.length,
      status: 200,
      statusText: 'OK',
    };
  }

  async insert<T = Record<string, unknown>>(
    tableName: string,
    data: Record<string, unknown> | Record<string, unknown>[]
  ): Promise<MockSupabaseQueryResult<T>> {
    await this.delay(50 + Math.random() * 50);

    const table = this.tables.get(tableName);
    if (!table) {
      return {
        data: null,
        error: { message: `Table '${tableName}' does not exist`, details: '', hint: '', code: 'PGRST204' },
        count: null,
        status: 404,
        statusText: 'Not Found',
      };
    }

    const rows = Array.isArray(data) ? data : [data];
    const insertedRows: Record<string, unknown>[] = [];

    for (const row of rows) {
      const id = row.id as string || generateUUID();
      const now = new Date().toISOString();
      const insertedRow = {
        ...row,
        id,
        created_at: row.created_at || now,
        updated_at: now,
      };
      table.rows.set(id, insertedRow);
      insertedRows.push(insertedRow);
    }

    return {
      data: (insertedRows.length === 1 ? insertedRows[0] : insertedRows) as T,
      error: null,
      count: insertedRows.length,
      status: 201,
      statusText: 'Created',
    };
  }

  async update<T = Record<string, unknown>>(
    tableName: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<MockSupabaseQueryResult<T>> {
    await this.delay(50 + Math.random() * 50);

    const table = this.tables.get(tableName);
    if (!table) {
      return {
        data: null,
        error: { message: `Table '${tableName}' does not exist`, details: '', hint: '', code: 'PGRST204' },
        count: null,
        status: 404,
        statusText: 'Not Found',
      };
    }

    const existingRow = table.rows.get(id);
    if (!existingRow) {
      return {
        data: null,
        error: { message: 'Row not found', details: '', hint: '', code: 'PGRST116' },
        count: 0,
        status: 404,
        statusText: 'Not Found',
      };
    }

    const updatedRow = {
      ...existingRow,
      ...data,
      id,
      updated_at: new Date().toISOString(),
    };
    table.rows.set(id, updatedRow);

    return {
      data: updatedRow as T,
      error: null,
      count: 1,
      status: 200,
      statusText: 'OK',
    };
  }

  async delete(tableName: string, id: string): Promise<MockSupabaseQueryResult<null>> {
    await this.delay(50 + Math.random() * 50);

    const table = this.tables.get(tableName);
    if (!table) {
      return {
        data: null,
        error: { message: `Table '${tableName}' does not exist`, details: '', hint: '', code: 'PGRST204' },
        count: null,
        status: 404,
        statusText: 'Not Found',
      };
    }

    const existed = table.rows.delete(id);

    return {
      data: null,
      error: existed ? null : { message: 'Row not found', details: '', hint: '', code: 'PGRST116' },
      count: existed ? 1 : 0,
      status: existed ? 200 : 404,
      statusText: existed ? 'OK' : 'Not Found',
    };
  }

  // ============================================================================
  // Mock API Call (for compatibility with other mocks)
  // ============================================================================

  async mockApiCall(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<{
    status: number;
    data: unknown;
    headers: Record<string, string>;
  }> {
    // Parse table name from endpoint (e.g., "/rest/v1/contacts")
    const tableMatch = endpoint.match(/\/rest\/v1\/(\w+)/);
    const tableName = tableMatch?.[1] || 'unknown';

    switch (method) {
      case 'GET': {
        const result = await this.select(tableName);
        return { status: result.status, data: result.data, headers: {} };
      }
      case 'POST': {
        const result = await this.insert(tableName, body || {});
        return { status: result.status, data: result.data, headers: {} };
      }
      case 'PUT':
      case 'PATCH': {
        const id = body?.id as string || '';
        const result = await this.update(tableName, id, body || {});
        return { status: result.status, data: result.data, headers: {} };
      }
      case 'DELETE': {
        const id = body?.id as string || '';
        const result = await this.delete(tableName, id);
        return { status: result.status, data: result.data, headers: {} };
      }
      default:
        return { status: 400, data: { error: 'Invalid method' }, headers: {} };
    }
  }

  // ============================================================================
  // Accessors
  // ============================================================================

  getTable(tableName: string): MockSupabaseTable | undefined {
    return this.tables.get(tableName);
  }

  getRows<T = Record<string, unknown>>(tableName: string): T[] {
    const table = this.tables.get(tableName);
    return table ? Array.from(table.rows.values()) as T[] : [];
  }

  reset(): void {
    for (const table of this.tables.values()) {
      table.rows.clear();
    }
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Pre-configured Mock Configs
// ============================================================================

export function createSupabaseMockConfigs(workflowId: string, orgId: string): ProcessMapMock[] {
  const baseConfig = {
    workflowId,
    orgId,
    integration: 'supabase',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return [
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'contacts',
      mockType: 'success' as MockType,
      responseData: {
        data: [
          { id: 'c001', full_name: 'John Smith', email: 'john@example.com' },
          { id: 'c002', full_name: 'Jane Doe', email: 'jane@example.com' },
        ],
        count: 2,
      },
      errorResponse: null,
      delayMs: 100,
      matchConditions: null,
      priority: 5,
    },
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'deals',
      mockType: 'success' as MockType,
      responseData: {
        data: [
          { id: 'd001', name: 'Enterprise Deal', value: 50000, stage: 'proposal' },
          { id: 'd002', name: 'Pilot Program', value: 10000, stage: 'negotiation' },
        ],
        count: 2,
      },
      errorResponse: null,
      delayMs: 100,
      matchConditions: null,
      priority: 5,
    },
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'meetings',
      mockType: 'success' as MockType,
      responseData: {
        data: [
          { id: 'm001', title: 'Discovery Call', status: 'scheduled' },
        ],
        count: 1,
      },
      errorResponse: null,
      delayMs: 100,
      matchConditions: null,
      priority: 5,
    },
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: null,
      mockType: 'error' as MockType,
      responseData: null,
      errorResponse: {
        message: 'Database connection failed',
        code: 'PGRST000',
        details: 'Connection pool exhausted',
        hint: 'Try again later',
      },
      delayMs: 0,
      matchConditions: { bodyContains: { trigger_db_error: true } },
      priority: 100,
    },
  ];
}
