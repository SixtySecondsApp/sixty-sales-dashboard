/**
 * Integration Mocks
 *
 * Mock implementations for testing integration workflows
 * without making real API calls.
 */

// HubSpot
export {
  HubSpotMock,
  createHubSpotMockConfigs,
  type MockHubSpotContact,
  type MockHubSpotDeal,
  type MockHubSpotTask,
  type MockHubSpotFormSubmission,
  type MockOAuthToken,
} from './HubSpotMock';

// Fathom
export {
  FathomMock,
  createFathomMockConfigs,
  type MockFathomMeeting,
  type MockFathomTranscript,
  type MockFathomSummary,
  type MockFathomActionItem,
} from './FathomMock';

// Google (Calendar + Gmail)
export {
  GoogleMock,
  createGoogleMockConfigs,
  type MockCalendarEvent,
  type MockGmailMessage,
  type MockGmailThread,
  type MockGoogleOAuthToken,
} from './GoogleMock';

// Slack
export {
  SlackMock,
  createSlackMockConfigs,
  type MockSlackChannel,
  type MockSlackUser,
  type MockSlackMessage,
  type MockSlackOAuthToken,
} from './SlackMock';

// JustCall
export {
  JustCallMock,
  createJustCallMockConfigs,
  type MockJustCallCall,
  type MockJustCallAgent,
  type MockJustCallContact,
  type MockJustCallTranscript,
  type MockJustCallOAuthToken,
} from './JustCallMock';

// SavvyCal
export {
  SavvyCalMock,
  createSavvyCalMockConfigs,
  type MockSavvyCalLink,
  type MockSavvyCalBooking,
  type MockSavvyCalAttendee,
  type MockSavvyCalHost,
  type MockSavvyCalAvailability,
  type MockSavvyCalOAuthToken,
} from './SavvyCalMock';

// Supabase
export {
  SupabaseMock,
  createSupabaseMockConfigs,
  type MockContact,
  type MockDeal,
  type MockMeeting,
  type MockTask,
  type MockSupabaseQueryResult,
} from './SupabaseMock';

// MeetingBaaS
export {
  MeetingBaaSMock,
  createMeetingBaaSMockConfigs,
  type MockMeetingBaaSCalendar,
  type MockBotDeployment,
  type MockRecording,
  type MockTranscript,
  type MockWebhookEvent,
  type BotStatus,
} from './MeetingBaaSMock';

// Registry
export {
  MockRegistry,
  createTestMockRegistry,
  createIntegrationMockRegistry,
  getAllMocksFromRegistry,
  type IntegrationMockInstance,
  type IntegrationMockType,
  type SupportedIntegration,
} from './MockRegistry';
