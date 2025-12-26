/**
 * Test Generators
 *
 * Path discovery and scenario generation for process map testing.
 */

export {
  discoverPaths,
  getHappyPath,
  getBranchPaths,
  getPathIntegrations,
  type PathDiscoveryResult,
} from './PathDiscovery';

export {
  generateScenarios,
  generateHappyPathScenario,
  generateIntegrationFailureScenarios,
  FAILURE_MODES,
  FAILURE_MODE_DESCRIPTIONS,
  type ScenarioGeneratorOptions,
  type ScenarioGeneratorResult,
} from './ScenarioGenerator';
