/**
 * Fathom Integration Mock
 *
 * Provides realistic mock data and API responses for testing
 * Fathom meeting recording integration workflows.
 */

import type { ProcessMapMock, MockType } from '@/lib/types/processMapTesting';

// ============================================================================
// Mock Data Types
// ============================================================================

export interface MockFathomMeeting {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number; // seconds
  attendees: MockFathomAttendee[];
  recordingUrl?: string;
  thumbnailUrl?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'processing' | 'ready';
  createdAt: string;
  updatedAt: string;
}

export interface MockFathomAttendee {
  email: string;
  name: string;
  role: 'host' | 'participant';
  joinedAt?: string;
  leftAt?: string;
}

export interface MockFathomTranscript {
  meetingId: string;
  segments: MockTranscriptSegment[];
  fullText: string;
  language: string;
  confidence: number;
  processedAt: string;
}

export interface MockTranscriptSegment {
  id: string;
  speaker: string;
  speakerEmail?: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface MockFathomSummary {
  meetingId: string;
  overallSummary: string;
  keyPoints: string[];
  actionItems: MockActionItem[];
  decisions: string[];
  nextSteps: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  topics: string[];
  generatedAt: string;
}

export interface MockActionItem {
  id: string;
  description: string;
  assignee?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
}

export interface MockFathomOAuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// ============================================================================
// Sample Data
// ============================================================================

const MEETING_TITLES = [
  'Q1 Sales Review',
  'Product Demo - Enterprise',
  'Discovery Call with Acme Corp',
  'Weekly Team Standup',
  'Customer Success Check-in',
  'Technical Deep Dive',
  'Contract Negotiation',
  'Onboarding Kickoff',
];

const ATTENDEE_NAMES = [
  { name: 'Sarah Johnson', email: 'sarah.johnson@company.com' },
  { name: 'Michael Chen', email: 'michael.chen@client.com' },
  { name: 'Emily Davis', email: 'emily.davis@company.com' },
  { name: 'James Wilson', email: 'james.wilson@prospect.com' },
  { name: 'Lisa Anderson', email: 'lisa.anderson@company.com' },
];

const TRANSCRIPT_SAMPLES = [
  "Thanks for joining today's call. Let's start by reviewing our objectives.",
  "I've been looking at your solution and I'm impressed with the analytics capabilities.",
  "We're targeting a go-live date of next quarter if everything aligns.",
  "The pricing looks competitive. Can you walk me through the enterprise tier?",
  "Our team has some concerns about the integration timeline.",
  "Let me share my screen to show you the dashboard.",
  "We'll need sign-off from our IT security team before moving forward.",
  "I'll send over the proposal by end of week.",
];

const ACTION_ITEM_TEMPLATES = [
  'Send follow-up email with pricing details',
  'Schedule technical deep dive with engineering team',
  'Share case study and references',
  'Prepare custom demo for stakeholders',
  'Send contract draft for legal review',
  'Coordinate security questionnaire responses',
  'Set up trial environment',
  'Schedule executive sponsor call',
];

const SUMMARY_TEMPLATES = [
  'Productive discussion about implementation timeline and technical requirements. Client expressed strong interest in our enterprise features.',
  'Initial discovery call to understand pain points and current workflow. Good alignment on core use cases.',
  'Deep dive into product capabilities. Client team asked detailed questions about integrations and scalability.',
  'Weekly sync to review project progress. All milestones on track for Q1 launch.',
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
// Fathom Mock Class
// ============================================================================

export class FathomMock {
  private meetings: Map<string, MockFathomMeeting> = new Map();
  private transcripts: Map<string, MockFathomTranscript> = new Map();
  private summaries: Map<string, MockFathomSummary> = new Map();

  constructor(options?: { preloadData?: boolean }) {
    if (options?.preloadData) {
      this.generateSampleData();
    }
  }

  // ============================================================================
  // Data Generators
  // ============================================================================

  generateMeeting(overrides?: Partial<MockFathomMeeting>): MockFathomMeeting {
    const now = new Date();
    const startTime = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    const duration = Math.floor(Math.random() * 3600) + 900; // 15-75 min
    const endTime = new Date(startTime.getTime() + duration * 1000);

    const attendeeCount = Math.floor(Math.random() * 3) + 2;
    const selectedAttendees = [...ATTENDEE_NAMES]
      .sort(() => Math.random() - 0.5)
      .slice(0, attendeeCount);

    const meeting: MockFathomMeeting = {
      id: generateId('meeting'),
      title: randomElement(MEETING_TITLES),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration,
      attendees: selectedAttendees.map((a, i) => ({
        ...a,
        role: i === 0 ? 'host' : 'participant',
        joinedAt: startTime.toISOString(),
        leftAt: endTime.toISOString(),
      })),
      recordingUrl: `https://fathom.video/recordings/${generateId('rec')}`,
      thumbnailUrl: `https://fathom.video/thumbnails/${generateId('thumb')}.jpg`,
      status: 'ready',
      createdAt: startTime.toISOString(),
      updatedAt: now.toISOString(),
      ...overrides,
    };

    this.meetings.set(meeting.id, meeting);
    return meeting;
  }

  generateTranscript(meetingId: string): MockFathomTranscript {
    const meeting = this.meetings.get(meetingId);
    const attendees = meeting?.attendees || ATTENDEE_NAMES.slice(0, 3);

    const segmentCount = Math.floor(Math.random() * 15) + 10;
    const segments: MockTranscriptSegment[] = [];
    let currentTime = 0;

    for (let i = 0; i < segmentCount; i++) {
      const speaker = randomElement(attendees);
      const segmentDuration = Math.floor(Math.random() * 30) + 5;

      segments.push({
        id: generateId('seg'),
        speaker: speaker.name,
        speakerEmail: speaker.email,
        text: randomElement(TRANSCRIPT_SAMPLES),
        startTime: currentTime,
        endTime: currentTime + segmentDuration,
        confidence: 0.85 + Math.random() * 0.15,
      });

      currentTime += segmentDuration + Math.floor(Math.random() * 5);
    }

    const transcript: MockFathomTranscript = {
      meetingId,
      segments,
      fullText: segments.map(s => `${s.speaker}: ${s.text}`).join('\n\n'),
      language: 'en',
      confidence: 0.92,
      processedAt: new Date().toISOString(),
    };

    this.transcripts.set(meetingId, transcript);
    return transcript;
  }

  generateSummary(meetingId: string): MockFathomSummary {
    const actionItemCount = Math.floor(Math.random() * 4) + 2;
    const actionItems: MockActionItem[] = [];

    for (let i = 0; i < actionItemCount; i++) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 14) + 1);

      actionItems.push({
        id: generateId('action'),
        description: randomElement(ACTION_ITEM_TEMPLATES),
        assignee: randomElement(ATTENDEE_NAMES).email,
        dueDate: dueDate.toISOString(),
        priority: randomElement(['low', 'medium', 'high']),
        status: 'pending',
      });
    }

    const summary: MockFathomSummary = {
      meetingId,
      overallSummary: randomElement(SUMMARY_TEMPLATES),
      keyPoints: [
        'Discussed implementation timeline and resource requirements',
        'Reviewed technical architecture and integration approach',
        'Aligned on success metrics and KPIs',
        'Identified key stakeholders for next steps',
      ].slice(0, Math.floor(Math.random() * 2) + 2),
      actionItems,
      decisions: [
        'Proceed with pilot program',
        'Schedule technical review next week',
      ].slice(0, Math.floor(Math.random() * 2) + 1),
      nextSteps: [
        'Send proposal by Friday',
        'Set up trial environment',
        'Coordinate with IT for security review',
      ].slice(0, Math.floor(Math.random() * 2) + 1),
      sentiment: randomElement(['positive', 'neutral', 'mixed']),
      topics: ['pricing', 'implementation', 'integration', 'timeline', 'security']
        .sort(() => Math.random() - 0.5)
        .slice(0, 3),
      generatedAt: new Date().toISOString(),
    };

    this.summaries.set(meetingId, summary);
    return summary;
  }

  generateOAuthToken(): MockFathomOAuthToken {
    return {
      access_token: `fathom_access_${generateId('token')}`,
      refresh_token: `fathom_refresh_${generateId('token')}`,
      expires_in: 7200,
      token_type: 'Bearer',
      scope: 'meetings:read recordings:read transcripts:read',
    };
  }

  private generateSampleData(): void {
    // Generate 5 meetings with transcripts and summaries
    for (let i = 0; i < 5; i++) {
      const meeting = this.generateMeeting();
      this.generateTranscript(meeting.id);
      this.generateSummary(meeting.id);
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
    // Simulate network delay
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

    // Meetings list
    if (normalizedEndpoint.includes('/meetings') && method === 'GET') {
      const meetingId = this.extractId(endpoint);
      if (meetingId) {
        const meeting = this.meetings.get(meetingId);
        if (meeting) {
          return { status: 200, data: meeting, headers: {} };
        }
        return { status: 404, data: { error: 'Meeting not found' }, headers: {} };
      }
      return {
        status: 200,
        data: { meetings: Array.from(this.meetings.values()), total: this.meetings.size },
        headers: {},
      };
    }

    // Transcript
    if (normalizedEndpoint.includes('/transcript')) {
      const meetingId = this.extractMeetingId(endpoint);
      if (meetingId) {
        let transcript = this.transcripts.get(meetingId);
        if (!transcript) {
          transcript = this.generateTranscript(meetingId);
        }
        return { status: 200, data: transcript, headers: {} };
      }
      return { status: 400, data: { error: 'Meeting ID required' }, headers: {} };
    }

    // Summary / AI Analysis
    if (normalizedEndpoint.includes('/summary') || normalizedEndpoint.includes('/analysis')) {
      const meetingId = this.extractMeetingId(endpoint);
      if (meetingId) {
        let summary = this.summaries.get(meetingId);
        if (!summary) {
          summary = this.generateSummary(meetingId);
        }
        return { status: 200, data: summary, headers: {} };
      }
      return { status: 400, data: { error: 'Meeting ID required' }, headers: {} };
    }

    // Recording
    if (normalizedEndpoint.includes('/recording')) {
      const meetingId = this.extractMeetingId(endpoint);
      const meeting = meetingId ? this.meetings.get(meetingId) : null;
      if (meeting?.recordingUrl) {
        return {
          status: 200,
          data: {
            url: meeting.recordingUrl,
            duration: meeting.duration,
            size: Math.floor(meeting.duration * 50000), // ~50KB per second
            format: 'mp4',
          },
          headers: {},
        };
      }
      return { status: 404, data: { error: 'Recording not found' }, headers: {} };
    }

    // Webhook registration
    if (normalizedEndpoint.includes('/webhooks') && method === 'POST') {
      return {
        status: 201,
        data: {
          id: generateId('webhook'),
          url: body?.url,
          events: body?.events || ['meeting.completed'],
          active: true,
          createdAt: new Date().toISOString(),
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

  getMeetings(): MockFathomMeeting[] {
    return Array.from(this.meetings.values());
  }

  getMeeting(id: string): MockFathomMeeting | undefined {
    return this.meetings.get(id);
  }

  getTranscript(meetingId: string): MockFathomTranscript | undefined {
    return this.transcripts.get(meetingId);
  }

  getSummary(meetingId: string): MockFathomSummary | undefined {
    return this.summaries.get(meetingId);
  }

  reset(): void {
    this.meetings.clear();
    this.transcripts.clear();
    this.summaries.clear();
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

  private extractMeetingId(endpoint: string): string | undefined {
    const match = endpoint.match(/meetings\/([a-z0-9_-]+)/i);
    return match?.[1];
  }
}

// ============================================================================
// Pre-configured Mock Configs
// ============================================================================

export function createFathomMockConfigs(workflowId: string, orgId: string): ProcessMapMock[] {
  const baseConfig = {
    workflowId,
    orgId,
    integration: 'fathom',
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
        access_token: 'fathom_mock_token_12345',
        refresh_token: 'fathom_refresh_67890',
        expires_in: 7200,
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
      endpoint: 'meetings',
      mockType: 'success' as MockType,
      responseData: {
        meetings: [
          { id: 'mtg_001', title: 'Q1 Review', duration: 2700, status: 'ready' },
          { id: 'mtg_002', title: 'Product Demo', duration: 1800, status: 'ready' },
        ],
        total: 2,
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
        meetingId: 'mtg_001',
        fullText: 'Sample transcript content for testing...',
        segments: [],
        language: 'en',
        confidence: 0.95,
      },
      errorResponse: null,
      delayMs: 200,
      matchConditions: null,
      priority: 5,
    },
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'summary',
      mockType: 'success' as MockType,
      responseData: {
        overallSummary: 'Productive meeting discussing Q1 goals and timelines.',
        keyPoints: ['Revenue targets discussed', 'New product launch planned'],
        actionItems: [
          { description: 'Send proposal', assignee: 'john@example.com' },
        ],
      },
      errorResponse: null,
      delayMs: 250,
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
        status: 429,
        message: 'Rate limit exceeded',
        retryAfter: 60,
      },
      delayMs: 0,
      matchConditions: { bodyContains: { trigger_rate_limit: true } },
      priority: 100,
    },
  ];
}
