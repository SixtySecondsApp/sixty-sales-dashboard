/**
 * HubSpot Integration Mock
 *
 * Provides realistic mock data and API responses for testing
 * HubSpot integration workflows without making real API calls.
 */

import type { ProcessMapMock, MockType } from '@/lib/types/processMapTesting';

// ============================================================================
// Mock Data Types
// ============================================================================

export interface MockHubSpotContact {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  createdAt: string;
  updatedAt: string;
  properties: Record<string, string | number | boolean>;
}

export interface MockHubSpotDeal {
  id: string;
  name: string;
  amount: number;
  stage: string;
  pipeline: string;
  closeDate?: string;
  associatedContacts: string[];
  createdAt: string;
  updatedAt: string;
  properties: Record<string, string | number | boolean>;
}

export interface MockHubSpotTask {
  id: string;
  subject: string;
  body?: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string;
  associatedContacts: string[];
  associatedDeals: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MockHubSpotFormSubmission {
  id: string;
  formId: string;
  submittedAt: string;
  values: Record<string, string>;
  pageUrl?: string;
}

export interface MockOAuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

// ============================================================================
// Sample Data Generation
// ============================================================================

const FIRST_NAMES = ['John', 'Sarah', 'Michael', 'Emily', 'David', 'Lisa', 'James', 'Emma'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
const COMPANIES = ['Acme Corp', 'TechStart Inc', 'Global Solutions', 'InnovateTech', 'DataDrive LLC'];
const JOB_TITLES = ['CEO', 'CTO', 'VP Sales', 'Marketing Director', 'Product Manager', 'Engineer'];
const DEAL_NAMES = ['Enterprise License', 'Pilot Program', 'Platform Upgrade', 'Consulting Project'];
const DEAL_STAGES = ['appointmentscheduled', 'qualifiedtobuy', 'presentationscheduled', 'decisionmakerboughtin', 'contractsent', 'closedwon', 'closedlost'];
const TASK_SUBJECTS = ['Follow up call', 'Send proposal', 'Schedule demo', 'Contract review', 'Onboarding kickoff'];

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// HubSpot Mock Class
// ============================================================================

export class HubSpotMock {
  private contacts: Map<string, MockHubSpotContact> = new Map();
  private deals: Map<string, MockHubSpotDeal> = new Map();
  private tasks: Map<string, MockHubSpotTask> = new Map();
  private formSubmissions: MockHubSpotFormSubmission[] = [];

  constructor(options?: { preloadData?: boolean }) {
    if (options?.preloadData) {
      this.generateSampleData();
    }
  }

  // ============================================================================
  // Data Generators
  // ============================================================================

  /**
   * Generate a mock contact
   */
  generateContact(overrides?: Partial<MockHubSpotContact>): MockHubSpotContact {
    const now = new Date().toISOString();
    const firstName = randomElement(FIRST_NAMES);
    const lastName = randomElement(LAST_NAMES);
    const company = randomElement(COMPANIES);

    const contact: MockHubSpotContact = {
      id: generateId('contact'),
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${company.toLowerCase().replace(/\s+/g, '')}.com`,
      firstName,
      lastName,
      phone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      company,
      jobTitle: randomElement(JOB_TITLES),
      createdAt: now,
      updatedAt: now,
      properties: {
        lifecyclestage: 'lead',
        lead_source: 'website',
      },
      ...overrides,
    };

    this.contacts.set(contact.id, contact);
    return contact;
  }

  /**
   * Generate a mock deal
   */
  generateDeal(overrides?: Partial<MockHubSpotDeal>): MockHubSpotDeal {
    const now = new Date().toISOString();
    const closeDate = new Date();
    closeDate.setDate(closeDate.getDate() + Math.floor(Math.random() * 60) + 30);

    const deal: MockHubSpotDeal = {
      id: generateId('deal'),
      name: `${randomElement(COMPANIES)} - ${randomElement(DEAL_NAMES)}`,
      amount: Math.floor(Math.random() * 100000) + 5000,
      stage: randomElement(DEAL_STAGES),
      pipeline: 'default',
      closeDate: closeDate.toISOString(),
      associatedContacts: [],
      createdAt: now,
      updatedAt: now,
      properties: {
        deal_currency_code: 'USD',
      },
      ...overrides,
    };

    this.deals.set(deal.id, deal);
    return deal;
  }

  /**
   * Generate a mock task
   */
  generateTask(overrides?: Partial<MockHubSpotTask>): MockHubSpotTask {
    const now = new Date().toISOString();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 14) + 1);

    const task: MockHubSpotTask = {
      id: generateId('task'),
      subject: randomElement(TASK_SUBJECTS),
      body: 'Auto-generated task for testing',
      status: 'NOT_STARTED',
      priority: randomElement(['LOW', 'MEDIUM', 'HIGH']),
      dueDate: dueDate.toISOString(),
      associatedContacts: [],
      associatedDeals: [],
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };

    this.tasks.set(task.id, task);
    return task;
  }

  /**
   * Generate a mock form submission
   */
  generateFormSubmission(formId: string, values: Record<string, string>): MockHubSpotFormSubmission {
    const submission: MockHubSpotFormSubmission = {
      id: generateId('submission'),
      formId,
      submittedAt: new Date().toISOString(),
      values,
      pageUrl: 'https://example.com/landing-page',
    };

    this.formSubmissions.push(submission);
    return submission;
  }

  /**
   * Generate an OAuth token response
   */
  generateOAuthToken(): MockOAuthToken {
    return {
      access_token: `mock_access_${generateId('token')}`,
      refresh_token: `mock_refresh_${generateId('token')}`,
      expires_in: 3600,
      token_type: 'bearer',
    };
  }

  /**
   * Pre-populate with sample data
   */
  private generateSampleData(): void {
    // Generate 5 contacts
    const contacts = Array.from({ length: 5 }, () => this.generateContact());

    // Generate 3 deals with associated contacts
    Array.from({ length: 3 }, () => {
      const deal = this.generateDeal({
        associatedContacts: [randomElement(contacts).id],
      });

      // Create a task for each deal
      this.generateTask({
        associatedDeals: [deal.id],
        associatedContacts: deal.associatedContacts,
      });
    });
  }

  // ============================================================================
  // Mock API Responses
  // ============================================================================

  /**
   * Simulate HubSpot API call and return mock response
   */
  async mockApiCall(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<{
    status: number;
    data: unknown;
    headers: Record<string, string>;
  }> {
    // Simulate network delay
    await this.delay(50 + Math.random() * 100);

    // Parse endpoint
    const normalizedEndpoint = endpoint.toLowerCase();

    // OAuth endpoints
    if (normalizedEndpoint.includes('oauth/token')) {
      return {
        status: 200,
        data: this.generateOAuthToken(),
        headers: { 'content-type': 'application/json' },
      };
    }

    // Contacts endpoints
    if (normalizedEndpoint.includes('/contacts')) {
      if (method === 'GET') {
        const contactId = this.extractId(endpoint);
        if (contactId) {
          const contact = this.contacts.get(contactId);
          if (contact) {
            return { status: 200, data: contact, headers: {} };
          }
          return { status: 404, data: { message: 'Contact not found' }, headers: {} };
        }
        // List contacts
        return {
          status: 200,
          data: { results: Array.from(this.contacts.values()) },
          headers: {},
        };
      }
      if (method === 'POST') {
        const contact = this.generateContact(body as Partial<MockHubSpotContact>);
        return { status: 201, data: contact, headers: {} };
      }
    }

    // Deals endpoints
    if (normalizedEndpoint.includes('/deals')) {
      if (method === 'GET') {
        const dealId = this.extractId(endpoint);
        if (dealId) {
          const deal = this.deals.get(dealId);
          if (deal) {
            return { status: 200, data: deal, headers: {} };
          }
          return { status: 404, data: { message: 'Deal not found' }, headers: {} };
        }
        // List deals
        return {
          status: 200,
          data: { results: Array.from(this.deals.values()) },
          headers: {},
        };
      }
      if (method === 'POST') {
        const deal = this.generateDeal(body as Partial<MockHubSpotDeal>);
        return { status: 201, data: deal, headers: {} };
      }
    }

    // Tasks endpoints
    if (normalizedEndpoint.includes('/tasks') || normalizedEndpoint.includes('/engagements')) {
      if (method === 'GET') {
        return {
          status: 200,
          data: { results: Array.from(this.tasks.values()) },
          headers: {},
        };
      }
      if (method === 'POST') {
        const task = this.generateTask(body as Partial<MockHubSpotTask>);
        return { status: 201, data: task, headers: {} };
      }
    }

    // Default response
    return {
      status: 200,
      data: { success: true, mocked: true },
      headers: {},
    };
  }

  /**
   * Get all stored contacts
   */
  getContacts(): MockHubSpotContact[] {
    return Array.from(this.contacts.values());
  }

  /**
   * Get all stored deals
   */
  getDeals(): MockHubSpotDeal[] {
    return Array.from(this.deals.values());
  }

  /**
   * Get all stored tasks
   */
  getTasks(): MockHubSpotTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Clear all mock data
   */
  reset(): void {
    this.contacts.clear();
    this.deals.clear();
    this.tasks.clear();
    this.formSubmissions = [];
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private extractId(endpoint: string): string | undefined {
    const match = endpoint.match(/\/(\d+|[a-z0-9_-]+)$/i);
    return match?.[1];
  }
}

// ============================================================================
// Pre-configured Mock Configs
// ============================================================================

/**
 * Create ProcessMapMock configurations for HubSpot testing
 */
export function createHubSpotMockConfigs(workflowId: string, orgId: string): ProcessMapMock[] {
  const baseConfig = {
    workflowId,
    orgId,
    integration: 'hubspot',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return [
    // OAuth success mock
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'oauth/token',
      mockType: 'success' as MockType,
      responseData: {
        access_token: 'mock_access_token_12345',
        refresh_token: 'mock_refresh_token_67890',
        expires_in: 3600,
        token_type: 'bearer',
      },
      errorResponse: null,
      delayMs: 100,
      matchConditions: null,
      priority: 10,
    },

    // Contact sync success mock
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'contacts',
      mockType: 'success' as MockType,
      responseData: {
        results: [
          { id: '1001', email: 'test@example.com', firstName: 'Test', lastName: 'User' },
          { id: '1002', email: 'demo@example.com', firstName: 'Demo', lastName: 'User' },
        ],
        paging: { next: null },
      },
      errorResponse: null,
      delayMs: 150,
      matchConditions: null,
      priority: 5,
    },

    // Deal sync success mock
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'deals',
      mockType: 'success' as MockType,
      responseData: {
        results: [
          { id: '2001', name: 'Test Deal', amount: 50000, stage: 'qualifiedtobuy' },
          { id: '2002', name: 'Demo Deal', amount: 25000, stage: 'presentationscheduled' },
        ],
        paging: { next: null },
      },
      errorResponse: null,
      delayMs: 150,
      matchConditions: null,
      priority: 5,
    },

    // Rate limit error mock (for testing error handling)
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: null, // Applies to all endpoints
      mockType: 'rate_limit' as MockType,
      responseData: null,
      errorResponse: {
        status: 429,
        message: 'Rate limit exceeded. Please retry after 10 seconds.',
        retryAfter: 10,
      },
      delayMs: 0,
      matchConditions: { bodyContains: { trigger_rate_limit: true } },
      priority: 100, // Highest priority when conditions match
    },

    // Auth failure mock (for testing auth error handling)
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: null,
      mockType: 'auth_failure' as MockType,
      responseData: null,
      errorResponse: {
        status: 401,
        message: 'Invalid access token',
        errorType: 'UNAUTHORIZED',
      },
      delayMs: 0,
      matchConditions: { bodyContains: { trigger_auth_failure: true } },
      priority: 100,
    },
  ];
}

// ============================================================================
// Exports
// ============================================================================

export type {
  MockHubSpotContact,
  MockHubSpotDeal,
  MockHubSpotTask,
  MockHubSpotFormSubmission,
  MockOAuthToken,
};
