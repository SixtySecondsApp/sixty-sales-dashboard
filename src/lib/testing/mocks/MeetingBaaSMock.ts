/**
 * MeetingBaaS Integration Mock
 *
 * Provides realistic mock data and API responses for testing
 * MeetingBaaS integration workflows including calendar connection,
 * bot deployment, webhook events, and recording management.
 */

import type { ProcessMapMock, MockType } from '@/lib/types/processMapTesting';

// ============================================================================
// Mock Data Types
// ============================================================================

export interface MockMeetingBaaSCalendar {
  id: string;
  user_id: string;
  org_id: string | null;
  meetingbaas_calendar_id: string;
  raw_calendar_id: string;
  platform: 'google' | 'microsoft';
  email: string | null;
  name: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface MockBotDeployment {
  id: string;
  bot_id: string;
  meeting_url: string;
  meeting_id: string;
  calendar_event_id: string | null;
  status: BotStatus;
  join_at: string | null;
  joined_at: string | null;
  left_at: string | null;
  recording_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export type BotStatus =
  | 'scheduled'
  | 'joining_call'
  | 'in_waiting_room'
  | 'in_call_not_recording'
  | 'in_call_recording'
  | 'call_ended'
  | 'recording_done'
  | 'error';

export interface MockRecording {
  id: string;
  bot_id: string;
  meeting_id: string;
  status: RecordingStatus;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  video_url: string | null;
  audio_url: string | null;
  transcript_id: string | null;
  created_at: string;
  updated_at: string;
}

export type RecordingStatus = 'processing' | 'ready' | 'failed';

export interface MockTranscript {
  id: string;
  recording_id: string;
  status: TranscriptStatus;
  content: string | null;
  word_count: number | null;
  speaker_labels: MockSpeakerLabel[];
  created_at: string;
  updated_at: string;
}

export type TranscriptStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface MockSpeakerLabel {
  speaker_id: string;
  name: string | null;
  is_host: boolean;
}

export interface MockWebhookEvent {
  id: string;
  event_type: WebhookEventType;
  bot_id: string;
  meeting_id: string;
  payload: Record<string, unknown>;
  processed: boolean;
  received_at: string;
}

export type WebhookEventType =
  | 'bot.status_change'
  | 'bot.completed'
  | 'recording.ready'
  | 'transcript.ready';

export interface MockCalendarConnectResponse {
  success: boolean;
  message?: string;
  error?: string;
  calendar?: {
    id: string;
    platform: string;
    raw_calendar_id: string;
    email?: string;
  };
}

export interface MockBotDeployResponse {
  success: boolean;
  bot_id: string;
  message?: string;
  error?: string;
}

// ============================================================================
// Sample Data
// ============================================================================

const MEETING_TITLES = [
  'Team Standup',
  'Client Discovery Call',
  'Product Demo',
  'Sprint Planning',
  'Sales Pipeline Review',
  '1:1 with Manager',
  'Customer Success Check-in',
  'Technical Deep Dive',
  'Quarterly Business Review',
  'Project Kickoff',
];

const MEETING_PLATFORMS = ['Google Meet', 'Zoom', 'Microsoft Teams'] as const;

const SAMPLE_ATTENDEES = [
  { name: 'John Smith', email: 'john.smith@company.com' },
  { name: 'Sarah Johnson', email: 'sarah.johnson@client.com' },
  { name: 'Michael Chen', email: 'michael.chen@company.com' },
  { name: 'Emily Davis', email: 'emily.davis@prospect.com' },
  { name: 'James Wilson', email: 'james.wilson@company.com' },
];

const SAMPLE_TRANSCRIPT_SEGMENTS = [
  "Thank you all for joining today's meeting. Let's start with the agenda.",
  "I wanted to discuss the timeline for the upcoming project launch.",
  "Based on our analysis, we recommend moving forward with option B.",
  "Can you walk us through the technical requirements?",
  "The key metrics we're tracking show positive momentum.",
  "Let me share my screen to show you the latest updates.",
  "I think we should schedule a follow-up to dive deeper into this.",
  "Great point. Let me add that to the action items.",
];

// ============================================================================
// Helper Functions
// ============================================================================

function randomElement<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateMeetingUrl(platform: typeof MEETING_PLATFORMS[number]): string {
  const id = generateId('mtg');
  switch (platform) {
    case 'Google Meet':
      return `https://meet.google.com/${id.slice(0, 12)}`;
    case 'Zoom':
      return `https://zoom.us/j/${Math.floor(Math.random() * 9999999999)}`;
    case 'Microsoft Teams':
      return `https://teams.microsoft.com/l/meetup-join/${id}`;
    default:
      return `https://meet.google.com/${id.slice(0, 12)}`;
  }
}

// ============================================================================
// MeetingBaaS Mock Class
// ============================================================================

export class MeetingBaaSMock {
  private calendars: Map<string, MockMeetingBaaSCalendar> = new Map();
  private botDeployments: Map<string, MockBotDeployment> = new Map();
  private recordings: Map<string, MockRecording> = new Map();
  private transcripts: Map<string, MockTranscript> = new Map();
  private webhookEvents: Map<string, MockWebhookEvent> = new Map();

  constructor(options?: { preloadData?: boolean; userId?: string; orgId?: string }) {
    if (options?.preloadData) {
      this.generateSampleData(options.userId, options.orgId);
    }
  }

  // ============================================================================
  // Calendar Data Generators
  // ============================================================================

  generateCalendar(overrides?: Partial<MockMeetingBaaSCalendar>): MockMeetingBaaSCalendar {
    const calendarId = generateId('cal');
    const calendar: MockMeetingBaaSCalendar = {
      id: calendarId,
      user_id: overrides?.user_id || generateId('user'),
      org_id: overrides?.org_id || null,
      meetingbaas_calendar_id: `mbcal_${generateId('mb')}`,
      raw_calendar_id: 'primary',
      platform: 'google',
      email: randomElement(SAMPLE_ATTENDEES).email,
      name: 'Primary Calendar',
      is_active: true,
      last_sync_at: new Date().toISOString(),
      sync_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };

    this.calendars.set(calendar.id, calendar);
    return calendar;
  }

  // ============================================================================
  // Bot Deployment Generators
  // ============================================================================

  generateBotDeployment(overrides?: Partial<MockBotDeployment>): MockBotDeployment {
    const botId = generateId('bot');
    const meetingId = generateId('meeting');
    const platform = randomElement(MEETING_PLATFORMS);

    const deployment: MockBotDeployment = {
      id: generateId('deploy'),
      bot_id: botId,
      meeting_url: generateMeetingUrl(platform),
      meeting_id: meetingId,
      calendar_event_id: overrides?.calendar_event_id || null,
      status: 'scheduled',
      join_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min from now
      joined_at: null,
      left_at: null,
      recording_id: null,
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };

    this.botDeployments.set(deployment.id, deployment);
    return deployment;
  }

  // ============================================================================
  // Recording Generators
  // ============================================================================

  generateRecording(overrides?: Partial<MockRecording>): MockRecording {
    const recordingId = generateId('rec');
    const recording: MockRecording = {
      id: recordingId,
      bot_id: overrides?.bot_id || generateId('bot'),
      meeting_id: overrides?.meeting_id || generateId('meeting'),
      status: 'processing',
      duration_seconds: Math.floor(Math.random() * 3600) + 600, // 10-70 min
      file_size_bytes: Math.floor(Math.random() * 500000000) + 10000000, // 10-500 MB
      video_url: null,
      audio_url: null,
      transcript_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };

    this.recordings.set(recording.id, recording);
    return recording;
  }

  // ============================================================================
  // Transcript Generators
  // ============================================================================

  generateTranscript(overrides?: Partial<MockTranscript>): MockTranscript {
    const transcriptId = generateId('trans');
    const attendeeCount = Math.floor(Math.random() * 3) + 2;
    const selectedAttendees = [...SAMPLE_ATTENDEES]
      .sort(() => Math.random() - 0.5)
      .slice(0, attendeeCount);

    const speakerLabels: MockSpeakerLabel[] = selectedAttendees.map((a, i) => ({
      speaker_id: `speaker_${i}`,
      name: a.name,
      is_host: i === 0,
    }));

    // Generate mock transcript content
    const segmentCount = Math.floor(Math.random() * 10) + 5;
    const content = Array.from({ length: segmentCount })
      .map(() => {
        const speaker = randomElement(speakerLabels);
        const text = randomElement(SAMPLE_TRANSCRIPT_SEGMENTS);
        return `[${speaker.name}]: ${text}`;
      })
      .join('\n\n');

    const transcript: MockTranscript = {
      id: transcriptId,
      recording_id: overrides?.recording_id || generateId('rec'),
      status: 'ready',
      content,
      word_count: content.split(/\s+/).length,
      speaker_labels: speakerLabels,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };

    this.transcripts.set(transcript.id, transcript);
    return transcript;
  }

  // ============================================================================
  // Webhook Event Generators
  // ============================================================================

  generateWebhookEvent(
    eventType: WebhookEventType,
    botId: string,
    meetingId: string,
    payload?: Record<string, unknown>
  ): MockWebhookEvent {
    const event: MockWebhookEvent = {
      id: generateId('evt'),
      event_type: eventType,
      bot_id: botId,
      meeting_id: meetingId,
      payload: payload || this.getDefaultPayloadForEvent(eventType, botId, meetingId),
      processed: false,
      received_at: new Date().toISOString(),
    };

    this.webhookEvents.set(event.id, event);
    return event;
  }

  private getDefaultPayloadForEvent(
    eventType: WebhookEventType,
    botId: string,
    meetingId: string
  ): Record<string, unknown> {
    switch (eventType) {
      case 'bot.status_change':
        return {
          bot_id: botId,
          meeting_id: meetingId,
          status: 'in_call_recording',
          previous_status: 'joining_call',
          timestamp: new Date().toISOString(),
        };
      case 'bot.completed':
        return {
          bot_id: botId,
          meeting_id: meetingId,
          duration_seconds: Math.floor(Math.random() * 3600) + 600,
          recording_available: true,
          timestamp: new Date().toISOString(),
        };
      case 'recording.ready':
        return {
          bot_id: botId,
          meeting_id: meetingId,
          recording_id: generateId('rec'),
          video_url: `https://storage.meetingbaas.com/recordings/${generateId('vid')}.mp4`,
          audio_url: `https://storage.meetingbaas.com/recordings/${generateId('aud')}.mp3`,
          duration_seconds: Math.floor(Math.random() * 3600) + 600,
          timestamp: new Date().toISOString(),
        };
      case 'transcript.ready':
        return {
          bot_id: botId,
          meeting_id: meetingId,
          transcript_id: generateId('trans'),
          word_count: Math.floor(Math.random() * 5000) + 1000,
          timestamp: new Date().toISOString(),
        };
      default:
        return { bot_id: botId, meeting_id: meetingId };
    }
  }

  // ============================================================================
  // Generate Complete Flow (for testing full E2E)
  // ============================================================================

  generateCompleteTestFlow(userId: string, orgId: string): {
    calendar: MockMeetingBaaSCalendar;
    deployment: MockBotDeployment;
    webhookEvents: MockWebhookEvent[];
    recording: MockRecording;
    transcript: MockTranscript;
  } {
    // 1. Create calendar connection
    const calendar = this.generateCalendar({ user_id: userId, org_id: orgId });

    // 2. Create bot deployment
    const deployment = this.generateBotDeployment({
      calendar_event_id: `evt_${generateId('cal')}`,
    });

    // 3. Generate webhook events in sequence
    const webhookEvents: MockWebhookEvent[] = [];

    // Bot joining
    webhookEvents.push(
      this.generateWebhookEvent('bot.status_change', deployment.bot_id, deployment.meeting_id, {
        bot_id: deployment.bot_id,
        meeting_id: deployment.meeting_id,
        status: 'joining_call',
        previous_status: 'scheduled',
        timestamp: new Date().toISOString(),
      })
    );

    // Bot recording
    webhookEvents.push(
      this.generateWebhookEvent('bot.status_change', deployment.bot_id, deployment.meeting_id, {
        bot_id: deployment.bot_id,
        meeting_id: deployment.meeting_id,
        status: 'in_call_recording',
        previous_status: 'joining_call',
        timestamp: new Date().toISOString(),
      })
    );

    // Bot completed
    webhookEvents.push(
      this.generateWebhookEvent('bot.completed', deployment.bot_id, deployment.meeting_id)
    );

    // 4. Create recording
    const recording = this.generateRecording({
      bot_id: deployment.bot_id,
      meeting_id: deployment.meeting_id,
      status: 'ready',
      video_url: `https://storage.meetingbaas.com/recordings/${deployment.bot_id}.mp4`,
      audio_url: `https://storage.meetingbaas.com/recordings/${deployment.bot_id}.mp3`,
    });

    // Recording ready webhook
    webhookEvents.push(
      this.generateWebhookEvent('recording.ready', deployment.bot_id, deployment.meeting_id, {
        bot_id: deployment.bot_id,
        meeting_id: deployment.meeting_id,
        recording_id: recording.id,
        video_url: recording.video_url,
        audio_url: recording.audio_url,
        duration_seconds: recording.duration_seconds,
        timestamp: new Date().toISOString(),
      })
    );

    // Update deployment status
    deployment.status = 'recording_done';
    deployment.recording_id = recording.id;
    deployment.left_at = new Date().toISOString();
    this.botDeployments.set(deployment.id, deployment);

    // 5. Create transcript
    const transcript = this.generateTranscript({
      recording_id: recording.id,
    });

    // Update recording with transcript reference
    recording.transcript_id = transcript.id;
    this.recordings.set(recording.id, recording);

    // Transcript ready webhook
    webhookEvents.push(
      this.generateWebhookEvent('transcript.ready', deployment.bot_id, deployment.meeting_id, {
        bot_id: deployment.bot_id,
        meeting_id: deployment.meeting_id,
        transcript_id: transcript.id,
        word_count: transcript.word_count,
        timestamp: new Date().toISOString(),
      })
    );

    return {
      calendar,
      deployment,
      webhookEvents,
      recording,
      transcript,
    };
  }

  private generateSampleData(userId?: string, orgId?: string): void {
    // Generate a few calendars
    for (let i = 0; i < 2; i++) {
      this.generateCalendar({ user_id: userId, org_id: orgId });
    }

    // Generate some bot deployments with recordings
    for (let i = 0; i < 5; i++) {
      const deployment = this.generateBotDeployment({
        status: randomElement(['scheduled', 'in_call_recording', 'recording_done']),
      });

      if (deployment.status === 'recording_done') {
        const recording = this.generateRecording({
          bot_id: deployment.bot_id,
          meeting_id: deployment.meeting_id,
          status: 'ready',
        });
        deployment.recording_id = recording.id;
        this.botDeployments.set(deployment.id, deployment);

        // Add transcript for some recordings
        if (Math.random() > 0.3) {
          const transcript = this.generateTranscript({
            recording_id: recording.id,
          });
          recording.transcript_id = transcript.id;
          this.recordings.set(recording.id, recording);
        }
      }
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

    // Calendar connection
    if (normalizedEndpoint.includes('connect-calendar')) {
      const calendar = this.generateCalendar(body as Partial<MockMeetingBaaSCalendar>);
      return {
        status: 200,
        data: {
          success: true,
          message: 'Calendar connected successfully',
          calendar: {
            id: calendar.id,
            platform: calendar.platform,
            raw_calendar_id: calendar.raw_calendar_id,
            email: calendar.email,
          },
        } as MockCalendarConnectResponse,
        headers: { 'content-type': 'application/json' },
      };
    }

    // Bot deployment
    if (normalizedEndpoint.includes('deploy-bot')) {
      const deployment = this.generateBotDeployment(body as Partial<MockBotDeployment>);
      return {
        status: 200,
        data: {
          success: true,
          bot_id: deployment.bot_id,
          message: 'Bot scheduled successfully',
        } as MockBotDeployResponse,
        headers: { 'content-type': 'application/json' },
      };
    }

    // Get recording
    if (normalizedEndpoint.includes('recording')) {
      const recordingId = this.extractId(endpoint);
      if (recordingId && this.recordings.has(recordingId)) {
        return {
          status: 200,
          data: this.recordings.get(recordingId),
          headers: { 'content-type': 'application/json' },
        };
      }
      // List recordings
      return {
        status: 200,
        data: Array.from(this.recordings.values()),
        headers: { 'content-type': 'application/json' },
      };
    }

    // Get transcript
    if (normalizedEndpoint.includes('transcript')) {
      const transcriptId = this.extractId(endpoint);
      if (transcriptId && this.transcripts.has(transcriptId)) {
        return {
          status: 200,
          data: this.transcripts.get(transcriptId),
          headers: { 'content-type': 'application/json' },
        };
      }
    }

    // Webhook simulation
    if (normalizedEndpoint.includes('webhook')) {
      const eventType = body?.event_type as WebhookEventType;
      const botId = body?.bot_id as string;
      const meetingId = body?.meeting_id as string;

      if (eventType && botId && meetingId) {
        const event = this.generateWebhookEvent(
          eventType,
          botId,
          meetingId,
          body?.payload as Record<string, unknown>
        );
        return {
          status: 200,
          data: { success: true, event_id: event.id },
          headers: { 'content-type': 'application/json' },
        };
      }
    }

    return {
      status: 200,
      data: { success: true, mocked: true },
      headers: { 'content-type': 'application/json' },
    };
  }

  // ============================================================================
  // Accessors
  // ============================================================================

  getCalendars(): MockMeetingBaaSCalendar[] {
    return Array.from(this.calendars.values());
  }

  getBotDeployments(): MockBotDeployment[] {
    return Array.from(this.botDeployments.values());
  }

  getRecordings(): MockRecording[] {
    return Array.from(this.recordings.values());
  }

  getTranscripts(): MockTranscript[] {
    return Array.from(this.transcripts.values());
  }

  getWebhookEvents(): MockWebhookEvent[] {
    return Array.from(this.webhookEvents.values());
  }

  reset(): void {
    this.calendars.clear();
    this.botDeployments.clear();
    this.recordings.clear();
    this.transcripts.clear();
    this.webhookEvents.clear();
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractId(endpoint: string): string | undefined {
    const match = endpoint.match(/\/([a-z0-9_-]+)$/i);
    return match?.[1];
  }
}

// ============================================================================
// Pre-configured Mock Configs
// ============================================================================

export function createMeetingBaaSMockConfigs(
  workflowId: string,
  orgId: string
): ProcessMapMock[] {
  const baseConfig = {
    workflowId,
    orgId,
    integration: 'meetingbaas',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return [
    // Calendar connect success
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'connect-calendar',
      mockType: 'success' as MockType,
      responseData: {
        success: true,
        message: 'Calendar connected successfully',
        calendar: {
          id: 'mock_cal_001',
          platform: 'google',
          raw_calendar_id: 'primary',
          email: 'test@example.com',
        },
      },
      errorResponse: null,
      delayMs: 150,
      matchConditions: null,
      priority: 10,
    },
    // Bot deployment success
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'deploy-bot',
      mockType: 'success' as MockType,
      responseData: {
        success: true,
        bot_id: 'mock_bot_001',
        message: 'Bot scheduled successfully',
      },
      errorResponse: null,
      delayMs: 100,
      matchConditions: null,
      priority: 10,
    },
    // Webhook: bot.status_change
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'webhook',
      mockType: 'success' as MockType,
      responseData: {
        success: true,
        processed: true,
      },
      errorResponse: null,
      delayMs: 50,
      matchConditions: { bodyContains: { event_type: 'bot.status_change' } },
      priority: 5,
    },
    // Webhook: bot.completed
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'webhook',
      mockType: 'success' as MockType,
      responseData: {
        success: true,
        processed: true,
      },
      errorResponse: null,
      delayMs: 50,
      matchConditions: { bodyContains: { event_type: 'bot.completed' } },
      priority: 5,
    },
    // Webhook: recording.ready
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'webhook',
      mockType: 'success' as MockType,
      responseData: {
        success: true,
        processed: true,
        recording_id: 'mock_rec_001',
      },
      errorResponse: null,
      delayMs: 100,
      matchConditions: { bodyContains: { event_type: 'recording.ready' } },
      priority: 5,
    },
    // Get recording
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: 'recording',
      mockType: 'success' as MockType,
      responseData: {
        id: 'mock_rec_001',
        bot_id: 'mock_bot_001',
        meeting_id: 'mock_meeting_001',
        status: 'ready',
        duration_seconds: 2400,
        video_url: 'https://storage.meetingbaas.com/mock/video.mp4',
        audio_url: 'https://storage.meetingbaas.com/mock/audio.mp3',
      },
      errorResponse: null,
      delayMs: 100,
      matchConditions: null,
      priority: 5,
    },
    // Auth failure mock
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: null,
      mockType: 'auth_failure' as MockType,
      responseData: null,
      errorResponse: {
        error: 'unauthorized',
        error_description: 'Invalid or expired token',
      },
      delayMs: 0,
      matchConditions: { bodyContains: { trigger_auth_failure: true } },
      priority: 100,
    },
    // Rate limit mock
    {
      id: generateId('mock'),
      ...baseConfig,
      endpoint: null,
      mockType: 'rate_limit' as MockType,
      responseData: null,
      errorResponse: {
        error: 'rate_limited',
        error_description: 'Too many requests. Please try again later.',
        retry_after: 60,
      },
      delayMs: 0,
      matchConditions: { bodyContains: { trigger_rate_limit: true } },
      priority: 100,
    },
  ];
}
