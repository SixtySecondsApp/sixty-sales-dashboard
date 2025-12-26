/**
 * JustCall Integration Mock
 *
 * Provides realistic mock data and API responses for testing
 * JustCall phone integration workflows.
 */

import type { ProcessMapMock, MockType } from '@/lib/types/processMapTesting';

// ============================================================================
// Mock Data Types
// ============================================================================

export interface MockJustCallCall {
  id: string;
  direction: 'inbound' | 'outbound';
  status: 'completed' | 'missed' | 'voicemail' | 'busy' | 'failed';
  from_number: string;
  to_number: string;
  duration: number; // seconds
  recording_url?: string;
  transcript?: string;
  agent_id: string;
  agent_name: string;
  contact_name?: string;
  contact_email?: string;
  notes?: string;
  tags: string[];
  call_rating?: number;
  started_at: string;
  ended_at: string;
  created_at: string;
}

export interface MockJustCallAgent {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  status: 'available' | 'busy' | 'offline' | 'on_call';
  team_id?: string;
  avatar_url?: string;
}

export interface MockJustCallContact {
  id: string;
  name: string;
  email?: string;
  phone: string;
  company?: string;
  notes?: string;
  tags: string[];
  created_at: string;
}

export interface MockJustCallTranscript {
  call_id: string;
  segments: Array<{
    speaker: 'agent' | 'customer';
    text: string;
    start_time: number;
    end_time: number;
    confidence: number;
  }>;
  full_text: string;
  language: string;
  summary?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  keywords: string[];
  processed_at: string;
}

export interface MockJustCallOAuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

// ============================================================================
// Sample Data
// ============================================================================

const AGENT_NAMES = [
  { name: 'John Smith', email: 'john.smith@company.com' },
  { name: 'Sarah Johnson', email: 'sarah.johnson@company.com' },
  { name: 'Michael Chen', email: 'michael.chen@company.com' },
  { name: 'Emily Davis', email: 'emily.davis@company.com' },
];

const CONTACT_COMPANIES = ['Acme Corp', 'TechStart Inc', 'Global Solutions', 'InnovateTech'];

const CALL_NOTES = [
  'Follow-up scheduled for next week',
  'Interested in enterprise plan',
  'Requested pricing information',
  'Technical questions addressed',
  'Demo scheduled',
  'Left voicemail, will try again tomorrow',
];

const TRANSCRIPT_SAMPLES = [
  { speaker: 'agent', text: 'Hi, this is John from use60. How are you today?' },
  { speaker: 'customer', text: "I'm doing well, thanks for calling back." },
  { speaker: 'agent', text: 'Great! I wanted to follow up on our proposal from last week.' },
  { speaker: 'customer', text: 'Yes, I had a chance to review it with my team.' },
  { speaker: 'agent', text: 'Wonderful! Do you have any questions I can help with?' },
  { speaker: 'customer', text: 'We were wondering about the implementation timeline.' },
  { speaker: 'agent', text: "Typically it takes about 2-3 weeks for full setup." },
  { speaker: 'customer', text: 'That sounds reasonable. What about training?' },
];

const CALL_TAGS = ['sales', 'support', 'follow-up', 'demo', 'closing', 'discovery', 'cold-call'];

// ============================================================================
// Helper Functions
// ============================================================================

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generatePhoneNumber(): string {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const prefix = Math.floor(Math.random() * 900) + 100;
  const line = Math.floor(Math.random() * 9000) + 1000;
  return `+1${areaCode}${prefix}${line}`;
}

// ============================================================================
// JustCall Mock Class
// ============================================================================

export class JustCallMock {
  private calls: Map<string, MockJustCallCall> = new Map();
  private agents: Map<string, MockJustCallAgent> = new Map();
  private contacts: Map<string, MockJustCallContact> = new Map();
  private transcripts: Map<string, MockJustCallTranscript> = new Map();

  constructor(options?: { preloadData?: boolean }) {
    if (options?.preloadData) {
      this.generateSampleData();
    }
  }

  // ============================================================================
  // Data Generators
  // ============================================================================

  generateCall(overrides?: Partial<MockJustCallCall>): MockJustCallCall {
    const now = new Date();
    const startedAt = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    const duration = Math.floor(Math.random() * 1800) + 60; // 1-30 min
    const endedAt = new Date(startedAt.getTime() + duration * 1000);

    const agent = randomElement(AGENT_NAMES);
    const direction = Math.random() > 0.5 ? 'outbound' : 'inbound';
    const status = randomElement(['completed', 'completed', 'completed', 'missed', 'voicemail']);

    const callId = generateId('call');
    const call: MockJustCallCall = {
      id: callId,
      direction: direction as 'inbound' | 'outbound',
      status: status as MockJustCallCall['status'],
      from_number: direction === 'outbound' ? generatePhoneNumber() : generatePhoneNumber(),
      to_number: direction === 'outbound' ? generatePhoneNumber() : generatePhoneNumber(),
      duration: status === 'completed' ? duration : 0,
      recording_url: status === 'completed' ? `https://justcall.io/recordings/${callId}.mp3` : undefined,
      agent_id: generateId('agent'),
      agent_name: agent.name,
      contact_name: Math.random() > 0.3 ? randomElement(['John Doe', 'Jane Smith', 'Bob Wilson', 'Alice Brown']) : undefined,
      contact_email: Math.random() > 0.5 ? 'contact@example.com' : undefined,
      notes: Math.random() > 0.4 ? randomElement(CALL_NOTES) : undefined,
      tags: [randomElement(CALL_TAGS), randomElement(CALL_TAGS)].filter((v, i, a) => a.indexOf(v) === i),
      call_rating: Math.random() > 0.6 ? Math.floor(Math.random() * 5) + 1 : undefined,
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      created_at: startedAt.toISOString(),
      ...overrides,
    };

    this.calls.set(call.id, call);
    return call;
  }

  generateAgent(overrides?: Partial<MockJustCallAgent>): MockJustCallAgent {
    const agentData = randomElement(AGENT_NAMES);
    const agent: MockJustCallAgent = {
      id: generateId('agent'),
      name: agentData.name,
      email: agentData.email,
      phone_number: generatePhoneNumber(),
      status: randomElement(['available', 'busy', 'offline']),
      ...overrides,
    };

    this.agents.set(agent.id, agent);
    return agent;
  }

  generateContact(overrides?: Partial<MockJustCallContact>): MockJustCallContact {
    const contact: MockJustCallContact = {
      id: generateId('contact'),
      name: randomElement(['John Doe', 'Jane Smith', 'Bob Wilson', 'Alice Brown', 'Charlie Davis']),
      email: `contact_${Math.random().toString(36).substr(2, 5)}@example.com`,
      phone: generatePhoneNumber(),
      company: randomElement(CONTACT_COMPANIES),
      tags: [randomElement(CALL_TAGS)],
      created_at: new Date().toISOString(),
      ...overrides,
    };

    this.contacts.set(contact.id, contact);
    return contact;
  }

  generateTranscript(callId: string): MockJustCallTranscript {
    const segments = TRANSCRIPT_SAMPLES.map((sample, index) => ({
      speaker: sample.speaker as 'agent' | 'customer',
      text: sample.text,
      start_time: index * 10,
      end_time: (index + 1) * 10,
      confidence: 0.85 + Math.random() * 0.15,
    }));

    const transcript: MockJustCallTranscript = {
      call_id: callId,
      segments,
      full_text: segments.map(s => `${s.speaker}: ${s.text}`).join('\n'),
      language: 'en',
      summary: 'Follow-up call discussing proposal and implementation timeline. Customer interested in proceeding.',
      sentiment: randomElement(['positive', 'neutral']),
      keywords: ['proposal', 'implementation', 'timeline', 'pricing', 'demo'],
      processed_at: new Date().toISOString(),
    };

    this.transcripts.set(callId, transcript);
    return transcript;
  }

  generateOAuthToken(): MockJustCallOAuthToken {
    return {
      access_token: `justcall_access_${generateId('token')}`,
      refresh_token: `justcall_refresh_${generateId('token')}`,
      expires_in: 3600,
      token_type: 'Bearer',
    };
  }

  private generateSampleData(): void {
    // Generate agents
    AGENT_NAMES.forEach(a => this.generateAgent({ name: a.name, email: a.email }));

    // Generate calls with transcripts
    for (let i = 0; i < 10; i++) {
      const call = this.generateCall();
      if (call.status === 'completed' && call.recording_url) {
        this.generateTranscript(call.id);
      }
    }

    // Generate contacts
    for (let i = 0; i < 5; i++) {
      this.generateContact();
    }
  }

  // ============================================================================
  // Mock API Responses
  // ============================================================================

  async mockApiCall(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: Record<string, unknown>
  ): Promise<{
    status: number;
    data: unknown;
    headers: Record<string, string>;
  }> {
    await this.delay(50 + Math.random() * 100);

    const normalizedEndpoint = endpoint.toLowerCase();

    // OAuth
    if (normalizedEndpoint.includes('oauth/token')) {
      return {
        status: 200,
        data: this.generateOAuthToken(),
        headers: { 'content-type': 'application/json' },
      };
    }

    // List Calls
    if (normalizedEndpoint.includes('/calls') && method === 'GET') {
      const callId = this.extractId(endpoint);
      if (callId && this.calls.has(callId)) {
        return { status: 200, data: { data: this.calls.get(callId) }, headers: {} };
      }
      return {
        status: 200,
        data: {
          data: Array.from(this.calls.values()),
          pagination: { total: this.calls.size, page: 1, per_page: 50 },
        },
        headers: {},
      };
    }

    // Get Transcript
    if (normalizedEndpoint.includes('/transcript')) {
      const callId = this.extractCallId(endpoint);
      if (callId) {
        let transcript = this.transcripts.get(callId);
        if (!transcript) {
          transcript = this.generateTranscript(callId);
        }
        return { status: 200, data: { data: transcript }, headers: {} };
      }
      return { status: 400, data: { error: 'Call ID required' }, headers: {} };
    }

    // Get Recording
    if (normalizedEndpoint.includes('/recording')) {
      const callId = this.extractCallId(endpoint);
      const call = callId ? this.calls.get(callId) : null;
      if (call?.recording_url) {
        return {
          status: 200,
          data: {
            url: call.recording_url,
            duration: call.duration,
            expires_at: new Date(Date.now() + 3600000).toISOString(),
          },
          headers: {},
        };
      }
      return { status: 404, data: { error: 'Recording not found' }, headers: {} };
    }

    // List Agents
    if (normalizedEndpoint.includes('/agents')) {
      return {
        status: 200,
        data: { data: Array.from(this.agents.values()) },
        headers: {},
      };
    }

    // List Contacts
    if (normalizedEndpoint.includes('/contacts')) {
      return {
        status: 200,
        data: { data: Array.from(this.contacts.values()) },
        headers: {},
      };
    }

    // Make Call
    if (normalizedEndpoint.includes('/calls') && method === 'POST') {
      const call = this.generateCall({
        direction: 'outbound',
        status: 'completed',
        to_number: body?.to as string,
      });
      return { status: 201, data: { data: call }, headers: {} };
    }

    return {
      status: 200,
      data: { success: true, mocked: true },
      headers: {},
    };
  }

  // ============================================================================
  // Accessors
  // ============================================================================

  getCalls(): MockJustCallCall[] {
    return Array.from(this.calls.values());
  }

  getAgents(): MockJustCallAgent[] {
    return Array.from(this.agents.values());
  }

  getContacts(): MockJustCallContact[] {
    return Array.from(this.contacts.values());
  }

  getTranscript(callId: string): MockJustCallTranscript | undefined {
    return this.transcripts.get(callId);
  }

  reset(): void {
    this.calls.clear();
    this.agents.clear();
    this.contacts.clear();
    this.transcripts.clear();
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private extractId(endpoint: string): string | undefined {
    const match = endpoint.match(/\/([a-z0-9_-]+)$/i);
    return match?.[1];
  }

  private extractCallId(endpoint: string): string | undefined {
    const match = endpoint.match(/calls\/([a-z0-9_-]+)/i);
    return match?.[1];
  }
}

// ============================================================================
// Pre-configured Mock Configs
// ============================================================================

export function createJustCallMockConfigs(workflowId: string, orgId: string): ProcessMapMock[] {
  const baseConfig = {
    workflowId,
    orgId,
    integration: 'justcall',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return [
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'oauth/token',
      mockType: 'success' as MockType,
      responseData: {
        access_token: 'justcall_mock_token_12345',
        refresh_token: 'justcall_refresh_67890',
        expires_in: 3600,
        token_type: 'Bearer',
      },
      errorResponse: null,
      delayMs: 100,
      matchConditions: null,
      priority: 10,
    },
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'calls',
      mockType: 'success' as MockType,
      responseData: {
        data: [
          { id: 'call_001', direction: 'outbound', status: 'completed', duration: 300 },
          { id: 'call_002', direction: 'inbound', status: 'completed', duration: 450 },
        ],
        pagination: { total: 2, page: 1 },
      },
      errorResponse: null,
      delayMs: 150,
      matchConditions: null,
      priority: 5,
    },
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'transcript',
      mockType: 'success' as MockType,
      responseData: {
        data: {
          call_id: 'call_001',
          full_text: 'Agent: Hi, how can I help?\nCustomer: I have a question about pricing.',
          sentiment: 'positive',
        },
      },
      errorResponse: null,
      delayMs: 200,
      matchConditions: null,
      priority: 5,
    },
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: null,
      mockType: 'auth_failure' as MockType,
      responseData: null,
      errorResponse: {
        error: 'invalid_token',
        message: 'The access token is invalid or expired',
      },
      delayMs: 0,
      matchConditions: { bodyContains: { trigger_auth_failure: true } },
      priority: 100,
    },
  ];
}
