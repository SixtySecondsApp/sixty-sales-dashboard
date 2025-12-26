/**
 * Google Integration Mock (Calendar + Gmail)
 *
 * Provides realistic mock data and API responses for testing
 * Google Calendar and Gmail integration workflows.
 */

import type { ProcessMapMock, MockType } from '@/lib/types/processMapTesting';

// ============================================================================
// Mock Data Types
// ============================================================================

export interface MockCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees: MockEventAttendee[];
  organizer: { email: string; displayName?: string };
  status: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink: string;
  conferenceData?: {
    conferenceId: string;
    conferenceSolution: { name: string; iconUri: string };
    entryPoints: Array<{ entryPointType: string; uri: string }>;
  };
  created: string;
  updated: string;
}

export interface MockEventAttendee {
  email: string;
  displayName?: string;
  responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  organizer?: boolean;
  self?: boolean;
}

export interface MockGmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    mimeType: string;
    body?: { data?: string; size: number };
    parts?: Array<{ mimeType: string; body: { data?: string; size: number } }>;
  };
  sizeEstimate: number;
  historyId: string;
  internalDate: string;
}

export interface MockGmailThread {
  id: string;
  historyId: string;
  messages: MockGmailMessage[];
}

export interface MockGoogleOAuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// ============================================================================
// Sample Data
// ============================================================================

const EVENT_TITLES = [
  'Team Standup',
  'Client Call - Acme Corp',
  'Product Demo',
  'Sprint Planning',
  'Customer Success Review',
  '1:1 with Manager',
  'Sales Pipeline Review',
  'Technical Deep Dive',
];

const ATTENDEES = [
  { email: 'john.smith@company.com', displayName: 'John Smith' },
  { email: 'sarah.johnson@client.com', displayName: 'Sarah Johnson' },
  { email: 'michael.chen@company.com', displayName: 'Michael Chen' },
  { email: 'emily.davis@prospect.com', displayName: 'Emily Davis' },
  { email: 'james.wilson@company.com', displayName: 'James Wilson' },
];

const EMAIL_SUBJECTS = [
  'Re: Proposal Review',
  'Meeting Follow-up',
  'Contract Terms Discussion',
  'Q1 Goals Update',
  'Action Items from Yesterday',
  'Quick Question about Timeline',
  'Introduction - New Account Manager',
  'Thank you for your time',
];

const EMAIL_SNIPPETS = [
  'Thank you for taking the time to discuss our proposal. I wanted to follow up on...',
  'Per our conversation, I am attaching the revised contract terms...',
  'Just wanted to confirm our meeting for next week...',
  'Here are the action items we discussed during our call...',
  'I have a quick question regarding the implementation timeline...',
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

// ============================================================================
// Google Mock Class
// ============================================================================

export class GoogleMock {
  private calendarEvents: Map<string, MockCalendarEvent> = new Map();
  private gmailMessages: Map<string, MockGmailMessage> = new Map();
  private gmailThreads: Map<string, MockGmailThread> = new Map();

  constructor(options?: { preloadData?: boolean }) {
    if (options?.preloadData) {
      this.generateSampleData();
    }
  }

  // ============================================================================
  // Calendar Data Generators
  // ============================================================================

  generateCalendarEvent(overrides?: Partial<MockCalendarEvent>): MockCalendarEvent {
    const now = new Date();
    const startOffset = Math.floor(Math.random() * 7 * 24 * 60) - 3 * 24 * 60; // -3 to +4 days
    const startTime = new Date(now.getTime() + startOffset * 60 * 1000);
    const duration = [30, 45, 60, 90][Math.floor(Math.random() * 4)];
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    const attendeeCount = Math.floor(Math.random() * 3) + 2;
    const selectedAttendees = [...ATTENDEES]
      .sort(() => Math.random() - 0.5)
      .slice(0, attendeeCount)
      .map((a, i) => ({
        ...a,
        responseStatus: randomElement(['accepted', 'tentative', 'needsAction']) as MockEventAttendee['responseStatus'],
        organizer: i === 0,
      }));

    const eventId = generateId('evt');
    const event: MockCalendarEvent = {
      id: eventId,
      summary: randomElement(EVENT_TITLES),
      description: 'Auto-generated calendar event for testing',
      location: Math.random() > 0.5 ? 'Conference Room A' : undefined,
      start: { dateTime: startTime.toISOString(), timeZone: 'America/New_York' },
      end: { dateTime: endTime.toISOString(), timeZone: 'America/New_York' },
      attendees: selectedAttendees,
      organizer: selectedAttendees[0],
      status: 'confirmed',
      htmlLink: `https://calendar.google.com/event?eid=${eventId}`,
      conferenceData: Math.random() > 0.3 ? {
        conferenceId: generateId('meet'),
        conferenceSolution: { name: 'Google Meet', iconUri: 'https://meet.google.com/icon.png' },
        entryPoints: [{ entryPointType: 'video', uri: `https://meet.google.com/${generateId('m')}` }],
      } : undefined,
      created: new Date(startTime.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated: now.toISOString(),
      ...overrides,
    };

    this.calendarEvents.set(event.id, event);
    return event;
  }

  // ============================================================================
  // Gmail Data Generators
  // ============================================================================

  generateGmailMessage(overrides?: Partial<MockGmailMessage>): MockGmailMessage {
    const messageId = generateId('msg');
    const threadId = overrides?.threadId || generateId('thread');
    const internalDate = Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000);

    const fromAttendee = randomElement(ATTENDEES);
    const toAttendee = ATTENDEES.find(a => a.email !== fromAttendee.email) || ATTENDEES[0];

    const message: MockGmailMessage = {
      id: messageId,
      threadId,
      labelIds: ['INBOX', Math.random() > 0.5 ? 'IMPORTANT' : 'CATEGORY_PERSONAL'],
      snippet: randomElement(EMAIL_SNIPPETS),
      payload: {
        headers: [
          { name: 'From', value: `${fromAttendee.displayName} <${fromAttendee.email}>` },
          { name: 'To', value: `${toAttendee.displayName} <${toAttendee.email}>` },
          { name: 'Subject', value: randomElement(EMAIL_SUBJECTS) },
          { name: 'Date', value: new Date(internalDate).toUTCString() },
          { name: 'Message-ID', value: `<${messageId}@mail.gmail.com>` },
        ],
        mimeType: 'text/html',
        body: { size: Math.floor(Math.random() * 5000) + 500 },
      },
      sizeEstimate: Math.floor(Math.random() * 10000) + 1000,
      historyId: generateId('hist'),
      internalDate: internalDate.toString(),
      ...overrides,
    };

    this.gmailMessages.set(message.id, message);
    return message;
  }

  generateGmailThread(messageCount: number = 3): MockGmailThread {
    const threadId = generateId('thread');
    const messages: MockGmailMessage[] = [];

    for (let i = 0; i < messageCount; i++) {
      messages.push(this.generateGmailMessage({ threadId }));
    }

    const thread: MockGmailThread = {
      id: threadId,
      historyId: generateId('hist'),
      messages,
    };

    this.gmailThreads.set(thread.id, thread);
    return thread;
  }

  generateOAuthToken(): MockGoogleOAuthToken {
    return {
      access_token: `google_access_${generateId('token')}`,
      refresh_token: `google_refresh_${generateId('token')}`,
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly',
    };
  }

  private generateSampleData(): void {
    // Generate calendar events
    for (let i = 0; i < 10; i++) {
      this.generateCalendarEvent();
    }
    // Generate email threads
    for (let i = 0; i < 5; i++) {
      this.generateGmailThread(Math.floor(Math.random() * 3) + 1);
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
    if (normalizedEndpoint.includes('oauth2/token')) {
      return {
        status: 200,
        data: this.generateOAuthToken(),
        headers: { 'content-type': 'application/json' },
      };
    }

    // Calendar Events
    if (normalizedEndpoint.includes('calendar') && normalizedEndpoint.includes('events')) {
      if (method === 'GET') {
        const eventId = this.extractId(endpoint);
        if (eventId && this.calendarEvents.has(eventId)) {
          return { status: 200, data: this.calendarEvents.get(eventId), headers: {} };
        }
        // List events
        const events = Array.from(this.calendarEvents.values());
        return {
          status: 200,
          data: {
            kind: 'calendar#events',
            items: events,
            nextPageToken: events.length >= 10 ? 'next_page_token' : undefined,
          },
          headers: {},
        };
      }
      if (method === 'POST') {
        const event = this.generateCalendarEvent(body as Partial<MockCalendarEvent>);
        return { status: 201, data: event, headers: {} };
      }
    }

    // Gmail Messages
    if (normalizedEndpoint.includes('gmail') && normalizedEndpoint.includes('messages')) {
      if (method === 'GET') {
        const messageId = this.extractId(endpoint);
        if (messageId && this.gmailMessages.has(messageId)) {
          return { status: 200, data: this.gmailMessages.get(messageId), headers: {} };
        }
        // List messages
        const messages = Array.from(this.gmailMessages.values());
        return {
          status: 200,
          data: {
            messages: messages.map(m => ({ id: m.id, threadId: m.threadId })),
            resultSizeEstimate: messages.length,
          },
          headers: {},
        };
      }
    }

    // Gmail Threads
    if (normalizedEndpoint.includes('gmail') && normalizedEndpoint.includes('threads')) {
      const threadId = this.extractId(endpoint);
      if (threadId && this.gmailThreads.has(threadId)) {
        return { status: 200, data: this.gmailThreads.get(threadId), headers: {} };
      }
      const threads = Array.from(this.gmailThreads.values());
      return {
        status: 200,
        data: {
          threads: threads.map(t => ({ id: t.id, historyId: t.historyId, snippet: t.messages[0]?.snippet })),
          resultSizeEstimate: threads.length,
        },
        headers: {},
      };
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

  getCalendarEvents(): MockCalendarEvent[] {
    return Array.from(this.calendarEvents.values());
  }

  getGmailMessages(): MockGmailMessage[] {
    return Array.from(this.gmailMessages.values());
  }

  getGmailThreads(): MockGmailThread[] {
    return Array.from(this.gmailThreads.values());
  }

  reset(): void {
    this.calendarEvents.clear();
    this.gmailMessages.clear();
    this.gmailThreads.clear();
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
}

// ============================================================================
// Pre-configured Mock Configs
// ============================================================================

export function createGoogleMockConfigs(workflowId: string, orgId: string): ProcessMapMock[] {
  const baseConfig = {
    workflowId,
    orgId,
    integration: 'google',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return [
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'oauth2/token',
      mockType: 'success' as MockType,
      responseData: {
        access_token: 'google_mock_access_12345',
        refresh_token: 'google_mock_refresh_67890',
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
      endpoint: 'calendar/events',
      mockType: 'success' as MockType,
      responseData: {
        kind: 'calendar#events',
        items: [
          { id: 'evt_001', summary: 'Team Standup', status: 'confirmed' },
          { id: 'evt_002', summary: 'Client Call', status: 'confirmed' },
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
      endpoint: 'gmail/messages',
      mockType: 'success' as MockType,
      responseData: {
        messages: [
          { id: 'msg_001', threadId: 'thread_001' },
          { id: 'msg_002', threadId: 'thread_002' },
        ],
        resultSizeEstimate: 2,
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
      mockType: 'auth_failure' as MockType,
      responseData: null,
      errorResponse: {
        error: 'invalid_grant',
        error_description: 'Token has been revoked or expired',
      },
      delayMs: 0,
      matchConditions: { bodyContains: { trigger_auth_failure: true } },
      priority: 100,
    },
  ];
}
