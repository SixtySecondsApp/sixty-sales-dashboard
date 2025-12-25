/**
 * Integration Mocks
 *
 * Mock implementations for testing integration workflows
 * without making real API calls.
 */

export {
  HubSpotMock,
  createHubSpotMockConfigs,
  type MockHubSpotContact,
  type MockHubSpotDeal,
  type MockHubSpotTask,
  type MockHubSpotFormSubmission,
  type MockOAuthToken,
} from './HubSpotMock';

export {
  MockRegistry,
  createTestMockRegistry,
  type IntegrationMockInstance,
} from './MockRegistry';
