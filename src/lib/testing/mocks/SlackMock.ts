/**
 * Slack Integration Mock
 *
 * Provides realistic mock data and API responses for testing
 * Slack notification and bot integration workflows.
 */

import type { ProcessMapMock, MockType } from '@/lib/types/processMapTesting';

// ============================================================================
// Mock Data Types
// ============================================================================

export interface MockSlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_private: boolean;
  is_member: boolean;
  topic: { value: string; creator: string };
  purpose: { value: string; creator: string };
  num_members: number;
  created: number;
}

export interface MockSlackUser {
  id: string;
  name: string;
  real_name: string;
  email?: string;
  is_bot: boolean;
  is_admin: boolean;
  profile: {
    display_name: string;
    email?: string;
    image_48: string;
    image_192: string;
  };
}

export interface MockSlackMessage {
  ok: boolean;
  channel: string;
  ts: string;
  message: {
    type: string;
    subtype?: string;
    text: string;
    user?: string;
    bot_id?: string;
    ts: string;
    blocks?: SlackBlock[];
  };
}

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: Array<{ type: string; text?: { type: string; text: string }; action_id?: string }>;
  accessory?: unknown;
}

export interface MockSlackOAuthToken {
  ok: boolean;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: { name: string; id: string };
  authed_user: { id: string; scope: string; access_token: string };
}

// ============================================================================
// Sample Data
// ============================================================================

const CHANNEL_NAMES = [
  'general',
  'sales',
  'deals-won',
  'deals-lost',
  'customer-success',
  'product-updates',
  'team-standup',
  'random',
];

const USER_NAMES = [
  { name: 'john.smith', real_name: 'John Smith' },
  { name: 'sarah.johnson', real_name: 'Sarah Johnson' },
  { name: 'michael.chen', real_name: 'Michael Chen' },
  { name: 'emily.davis', real_name: 'Emily Davis' },
  { name: 'use60bot', real_name: 'use60 Bot', is_bot: true },
];

const NOTIFICATION_MESSAGES = [
  '🎉 *Deal Won!* Acme Corp - $50,000',
  '📞 New meeting scheduled with Enterprise Client',
  '⚠️ Deal at risk: Tech Startup Inc moving to competitor',
  '✅ Task completed: Send proposal to Client X',
  '📊 Weekly pipeline update: $250K in active deals',
];

// ============================================================================
// Helper Functions
// ============================================================================

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateSlackTs(): string {
  const now = Date.now() / 1000;
  return `${Math.floor(now)}.${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
}

// ============================================================================
// Slack Mock Class
// ============================================================================

export class SlackMock {
  private channels: Map<string, MockSlackChannel> = new Map();
  private users: Map<string, MockSlackUser> = new Map();
  private messages: MockSlackMessage[] = [];

  constructor(options?: { preloadData?: boolean }) {
    if (options?.preloadData) {
      this.generateSampleData();
    }
  }

  // ============================================================================
  // Data Generators
  // ============================================================================

  generateChannel(overrides?: Partial<MockSlackChannel>): MockSlackChannel {
    const channelId = generateId('C');
    const name = randomElement(CHANNEL_NAMES);

    const channel: MockSlackChannel = {
      id: channelId,
      name,
      is_channel: true,
      is_private: name.includes('deals') || Math.random() > 0.7,
      is_member: true,
      topic: { value: `Discussion for ${name}`, creator: 'U001' },
      purpose: { value: `Channel for ${name} related topics`, creator: 'U001' },
      num_members: Math.floor(Math.random() * 50) + 5,
      created: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 365 * 24 * 60 * 60),
      ...overrides,
    };

    this.channels.set(channel.id, channel);
    return channel;
  }

  generateUser(overrides?: Partial<MockSlackUser>): MockSlackUser {
    const userId = generateId('U');
    const userData = randomElement(USER_NAMES);

    const user: MockSlackUser = {
      id: userId,
      name: userData.name,
      real_name: userData.real_name,
      email: `${userData.name}@company.com`,
      is_bot: (userData as { is_bot?: boolean }).is_bot || false,
      is_admin: Math.random() > 0.8,
      profile: {
        display_name: userData.real_name,
        email: `${userData.name}@company.com`,
        image_48: `https://api.slack.com/img/avatars/avatar_48.png`,
        image_192: `https://api.slack.com/img/avatars/avatar_192.png`,
      },
      ...overrides,
    };

    this.users.set(user.id, user);
    return user;
  }

  generateMessage(channelId: string, text?: string): MockSlackMessage {
    const ts = generateSlackTs();
    const message: MockSlackMessage = {
      ok: true,
      channel: channelId,
      ts,
      message: {
        type: 'message',
        text: text || randomElement(NOTIFICATION_MESSAGES),
        bot_id: 'B_use60bot',
        ts,
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: text || randomElement(NOTIFICATION_MESSAGES) },
          },
        ],
      },
    };

    this.messages.push(message);
    return message;
  }

  generateOAuthToken(): MockSlackOAuthToken {
    return {
      ok: true,
      access_token: `xoxb-${generateId('token')}`,
      token_type: 'bot',
      scope: 'chat:write,channels:read,users:read',
      bot_user_id: 'U_use60bot',
      app_id: 'A_use60app',
      team: { name: 'Test Workspace', id: 'T_workspace' },
      authed_user: { id: 'U_authed', scope: 'identify', access_token: `xoxp-${generateId('user')}` },
    };
  }

  private generateSampleData(): void {
    // Generate channels
    CHANNEL_NAMES.forEach(name => {
      this.generateChannel({ name });
    });

    // Generate users
    USER_NAMES.forEach(userData => {
      this.generateUser({ name: userData.name, real_name: userData.real_name });
    });
  }

  // ============================================================================
  // Mock API Responses
  // ============================================================================

  async mockApiCall(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    body?: Record<string, unknown>
  ): Promise<{
    status: number;
    data: unknown;
    headers: Record<string, string>;
  }> {
    await this.delay(50 + Math.random() * 100);

    const normalizedEndpoint = endpoint.toLowerCase();

    // OAuth
    if (normalizedEndpoint.includes('oauth.v2.access')) {
      return {
        status: 200,
        data: this.generateOAuthToken(),
        headers: { 'content-type': 'application/json' },
      };
    }

    // Post Message
    if (normalizedEndpoint.includes('chat.postmessage')) {
      const channelId = body?.channel as string || 'C_general';
      const text = body?.text as string || 'Test message';
      const message = this.generateMessage(channelId, text);
      return { status: 200, data: message, headers: {} };
    }

    // Update Message
    if (normalizedEndpoint.includes('chat.update')) {
      return {
        status: 200,
        data: {
          ok: true,
          channel: body?.channel,
          ts: body?.ts,
          text: body?.text,
        },
        headers: {},
      };
    }

    // List Channels
    if (normalizedEndpoint.includes('conversations.list')) {
      return {
        status: 200,
        data: {
          ok: true,
          channels: Array.from(this.channels.values()),
          response_metadata: { next_cursor: '' },
        },
        headers: {},
      };
    }

    // Get Channel Info
    if (normalizedEndpoint.includes('conversations.info')) {
      const channelId = body?.channel as string;
      const channel = this.channels.get(channelId);
      if (channel) {
        return { status: 200, data: { ok: true, channel }, headers: {} };
      }
      return { status: 200, data: { ok: false, error: 'channel_not_found' }, headers: {} };
    }

    // List Users
    if (normalizedEndpoint.includes('users.list')) {
      return {
        status: 200,
        data: {
          ok: true,
          members: Array.from(this.users.values()),
          response_metadata: { next_cursor: '' },
        },
        headers: {},
      };
    }

    // Get User Info
    if (normalizedEndpoint.includes('users.info')) {
      const userId = body?.user as string;
      const user = this.users.get(userId);
      if (user) {
        return { status: 200, data: { ok: true, user }, headers: {} };
      }
      return { status: 200, data: { ok: false, error: 'user_not_found' }, headers: {} };
    }

    // Files Upload
    if (normalizedEndpoint.includes('files.upload')) {
      return {
        status: 200,
        data: {
          ok: true,
          file: {
            id: generateId('F'),
            name: body?.filename || 'file.txt',
            mimetype: 'text/plain',
            size: 1024,
          },
        },
        headers: {},
      };
    }

    return {
      status: 200,
      data: { ok: true, mocked: true },
      headers: {},
    };
  }

  // ============================================================================
  // Accessors
  // ============================================================================

  getChannels(): MockSlackChannel[] {
    return Array.from(this.channels.values());
  }

  getUsers(): MockSlackUser[] {
    return Array.from(this.users.values());
  }

  getMessages(): MockSlackMessage[] {
    return [...this.messages];
  }

  reset(): void {
    this.channels.clear();
    this.users.clear();
    this.messages = [];
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

export function createSlackMockConfigs(workflowId: string, orgId: string): ProcessMapMock[] {
  const baseConfig = {
    workflowId,
    orgId,
    integration: 'slack',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return [
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'oauth.v2.access',
      mockType: 'success' as MockType,
      responseData: {
        ok: true,
        access_token: 'xoxb-mock-token-12345',
        bot_user_id: 'U_mockbot',
        team: { name: 'Mock Workspace', id: 'T_mock' },
      },
      errorResponse: null,
      delayMs: 100,
      matchConditions: null,
      priority: 10,
    },
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'chat.postMessage',
      mockType: 'success' as MockType,
      responseData: {
        ok: true,
        channel: 'C_general',
        ts: '1234567890.123456',
        message: { text: 'Test message posted successfully' },
      },
      errorResponse: null,
      delayMs: 100,
      matchConditions: null,
      priority: 5,
    },
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'conversations.list',
      mockType: 'success' as MockType,
      responseData: {
        ok: true,
        channels: [
          { id: 'C001', name: 'general', is_member: true },
          { id: 'C002', name: 'sales', is_member: true },
          { id: 'C003', name: 'deals-won', is_member: true },
        ],
      },
      errorResponse: null,
      delayMs: 150,
      matchConditions: null,
      priority: 5,
    },
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: null,
      mockType: 'rate_limit' as MockType,
      responseData: null,
      errorResponse: {
        ok: false,
        error: 'ratelimited',
        retry_after: 30,
      },
      delayMs: 0,
      matchConditions: { bodyContains: { trigger_rate_limit: true } },
      priority: 100,
    },
  ];
}
