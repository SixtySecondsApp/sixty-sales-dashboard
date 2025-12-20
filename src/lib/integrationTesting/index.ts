/**
 * Integration Testing Module
 *
 * Provides a framework for testing integrations and monitoring their health
 */

export * from './types';
export * from './testRunner';
export { createFathomTests, fathomTestSuiteInfo, getFathomConnectionStatus } from './suites/fathomTests';
export { createHubSpotTests, hubspotTestSuiteInfo, getHubSpotConnectionStatus } from './suites/hubspotTests';
export { createSlackTests, slackTestSuiteInfo, getSlackConnectionStatus } from './suites/slackTests';
