/**
 * Process Map Testing System
 *
 * Complete testing framework for process map workflows.
 */

// Core engine
export {
  ProcessMapTestEngine,
  ExecutionContext,
  DefaultStepExecutor,
  type StepExecutor,
  type StepExecutionResult,
  type TestEngineOptions,
} from './ProcessMapTestEngine';

// Scenario engine
export {
  ScenarioTestEngine,
  executeScenario,
  executeAllScenarios,
  type ScenarioTestEngineOptions,
  type ScenarioExecutionResult,
} from './ScenarioTestEngine';

// Generators
export {
  discoverPaths,
  getHappyPath,
  getBranchPaths,
  getPathIntegrations,
  generateScenarios,
  generateHappyPathScenario,
  generateIntegrationFailureScenarios,
  FAILURE_MODES,
  FAILURE_MODE_DESCRIPTIONS,
  type PathDiscoveryResult,
  type ScenarioGeneratorOptions,
  type ScenarioGeneratorResult,
} from './generators';

// Analyzers
export {
  analyzeCoverage,
  getCoverageBreakdown,
  getMissingFailureModes,
  meetsMinimumCoverage,
  type CoverageAnalysisInput,
  type CoverageBreakdown,
} from './analyzers';

// Parsers
export {
  parseDescription,
  parseMermaidCode,
  parseWorkflow,
  type ParsedStep,
  type MermaidNode,
  type MermaidEdge,
} from './parsers';

// Mocks
export {
  HubSpotMock,
  MockRegistry,
  createHubSpotMockConfigs,
  createTestMockRegistry,
} from './mocks';
