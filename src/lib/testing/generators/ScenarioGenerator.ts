/**
 * Scenario Generator
 *
 * Generates test scenarios from ProcessStructure analysis:
 * 1. Path scenarios: One per unique route through the diagram
 * 2. Failure scenarios: For each integration × failure mode
 */

import type {
  ProcessStructure,
  ProcessNode,
  GeneratedTestScenario,
  ScenarioPath,
  ScenarioMockOverride,
  ScenarioType,
  MockType,
} from '@/lib/types/processMapTesting';

import {
  discoverPaths,
  getHappyPath,
  getPathIntegrations,
  type PathDiscoveryResult,
} from './PathDiscovery';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Failure modes to generate scenarios for
 * Each integration will get a test for each of these modes
 */
const FAILURE_MODES: MockType[] = ['error', 'timeout', 'rate_limit', 'auth_failure'];

/**
 * Human-readable descriptions for failure modes
 */
const FAILURE_MODE_DESCRIPTIONS: Record<MockType, string> = {
  success: 'Normal successful response',
  error: 'API returns an error response',
  timeout: 'Request times out',
  rate_limit: 'Rate limit exceeded',
  auth_failure: 'Authentication/authorization failed',
  custom: 'Custom mock response',
};

// ============================================================================
// Types
// ============================================================================

export interface ScenarioGeneratorOptions {
  /** Maximum number of path scenarios to generate */
  maxPathScenarios?: number;
  /** Whether to generate failure mode scenarios */
  includeFailureModes?: boolean;
  /** Specific failure modes to test (default: all) */
  failureModes?: MockType[];
  /** Tags to add to all generated scenarios */
  additionalTags?: string[];
}

export interface ScenarioGeneratorResult {
  /** All generated scenarios */
  scenarios: GeneratedTestScenario[];
  /** Path scenarios specifically */
  pathScenarios: GeneratedTestScenario[];
  /** Failure mode scenarios specifically */
  failureScenarios: GeneratedTestScenario[];
  /** Path discovery information */
  pathDiscovery: PathDiscoveryResult;
  /** Unique integrations found */
  integrations: string[];
  /** Generation timestamp */
  generatedAt: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique ID for a scenario
 */
function generateScenarioId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a human-readable name for a path scenario
 */
function createPathScenarioName(
  path: ScenarioPath,
  index: number,
  isHappyPath: boolean
): string {
  if (isHappyPath) {
    return 'Happy Path - Main Flow';
  }

  if (path.decisions.length === 0) {
    return `Path ${index + 1} - Linear Flow`;
  }

  // Create name based on decisions taken
  const decisionSummary = path.decisions
    .slice(0, 2) // Limit to first 2 decisions
    .map((d) => d.condition)
    .join(' → ');

  return `Branch Path ${index + 1} - ${decisionSummary}`;
}

/**
 * Create description for a path scenario
 */
function createPathScenarioDescription(
  path: ScenarioPath,
  isHappyPath: boolean,
  nodes: ProcessNode[]
): string {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  if (isHappyPath) {
    return `Tests the main success flow through all ${path.totalSteps} steps. ` +
      `This represents the expected normal execution path.`;
  }

  if (path.decisions.length === 0) {
    return `Tests a linear execution path through ${path.totalSteps} steps with no decision branches.`;
  }

  const firstNode = nodeMap.get(path.stepIds[0]);
  const lastNode = nodeMap.get(path.stepIds[path.stepIds.length - 1]);

  return `Tests an alternative path from "${firstNode?.label || path.stepIds[0]}" ` +
    `to "${lastNode?.label || path.stepIds[path.stepIds.length - 1]}" ` +
    `with ${path.decisions.length} decision point(s).`;
}

/**
 * Create a human-readable name for a failure scenario
 */
function createFailureScenarioName(
  integration: string,
  failureMode: MockType,
  stepNode: ProcessNode | undefined
): string {
  const integrationName = integration.charAt(0).toUpperCase() + integration.slice(1);
  const modeName = failureMode.replace('_', ' ');

  if (stepNode) {
    return `${integrationName} ${modeName} at "${stepNode.label}"`;
  }

  return `${integrationName} ${modeName}`;
}

/**
 * Create description for a failure scenario
 */
function createFailureScenarioDescription(
  integration: string,
  failureMode: MockType,
  stepNode: ProcessNode | undefined
): string {
  const modeDescription = FAILURE_MODE_DESCRIPTIONS[failureMode];

  if (stepNode) {
    return `Tests error handling when ${integration} ${modeDescription.toLowerCase()} ` +
      `at step "${stepNode.label}".`;
  }

  return `Tests error handling when ${integration} ${modeDescription.toLowerCase()}.`;
}

/**
 * Get the first step using a specific integration in a path
 */
function getFirstIntegrationStep(
  integration: string,
  path: ScenarioPath,
  nodes: ProcessNode[]
): ProcessNode | undefined {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (const stepId of path.stepIds) {
    const node = nodeMap.get(stepId);
    if (node?.integration?.toLowerCase() === integration.toLowerCase()) {
      return node;
    }
  }

  return undefined;
}

// ============================================================================
// Scenario Generators
// ============================================================================

/**
 * Generate path-based scenarios from discovered paths
 */
function generatePathScenarios(
  workflowId: string,
  orgId: string,
  paths: ScenarioPath[],
  happyPath: ScenarioPath | null,
  nodes: ProcessNode[],
  additionalTags: string[] = []
): GeneratedTestScenario[] {
  const scenarios: GeneratedTestScenario[] = [];
  const now = new Date().toISOString();

  // Track the happy path hash to mark it
  const happyPathHash = happyPath?.pathHash;

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    const isHappyPath = path.pathHash === happyPathHash;
    const scenarioType: ScenarioType = isHappyPath ? 'happy_path' : 'branch_path';

    // Determine priority (happy path is highest priority)
    const priority = isHappyPath ? 1 : 10 + i;

    // Build tags
    const tags: string[] = [
      scenarioType,
      `steps:${path.totalSteps}`,
      ...additionalTags,
    ];

    if (path.decisions.length > 0) {
      tags.push(`decisions:${path.decisions.length}`);
    }

    const integrations = getPathIntegrations(path, nodes);
    tags.push(...integrations.map((i) => `integration:${i}`));

    scenarios.push({
      id: generateScenarioId('path'),
      workflowId,
      orgId,
      name: createPathScenarioName(path, i, isHappyPath),
      description: createPathScenarioDescription(path, isHappyPath, nodes),
      scenarioType,
      path,
      mockOverrides: [], // No overrides for path scenarios - use default mocks
      expectedResult: 'pass',
      priority,
      tags,
      generatedAt: now,
    });
  }

  return scenarios;
}

/**
 * Generate failure mode scenarios for each integration
 */
function generateFailureScenarios(
  workflowId: string,
  orgId: string,
  happyPath: ScenarioPath,
  integrations: string[],
  nodes: ProcessNode[],
  failureModes: MockType[] = FAILURE_MODES,
  additionalTags: string[] = []
): GeneratedTestScenario[] {
  const scenarios: GeneratedTestScenario[] = [];
  const now = new Date().toISOString();

  let priorityCounter = 100; // Start after path scenarios

  for (const integration of integrations) {
    // Find the first step that uses this integration
    const stepNode = getFirstIntegrationStep(integration, happyPath, nodes);

    for (const failureMode of failureModes) {
      // Create mock override
      const mockOverride: ScenarioMockOverride = {
        integration,
        stepId: stepNode?.id,
        mockType: failureMode,
        priority: 1000, // High priority to override default mocks
      };

      // Add error response for error types
      if (failureMode === 'error') {
        mockOverride.errorResponse = {
          error: true,
          message: `Simulated ${integration} API error`,
          code: 'MOCK_ERROR',
        };
      } else if (failureMode === 'auth_failure') {
        mockOverride.errorResponse = {
          error: true,
          message: `Authentication failed for ${integration}`,
          code: 'UNAUTHORIZED',
        };
      } else if (failureMode === 'rate_limit') {
        mockOverride.errorResponse = {
          error: true,
          message: `Rate limit exceeded for ${integration}`,
          code: 'RATE_LIMITED',
          retryAfter: 60,
        };
      } else if (failureMode === 'timeout') {
        mockOverride.delayMs = 30001; // Exceed typical timeout
      }

      // Build tags
      const tags: string[] = [
        'failure_mode',
        `integration:${integration}`,
        `failure:${failureMode}`,
        ...additionalTags,
      ];

      scenarios.push({
        id: generateScenarioId('failure'),
        workflowId,
        orgId,
        name: createFailureScenarioName(integration, failureMode, stepNode),
        description: createFailureScenarioDescription(integration, failureMode, stepNode),
        scenarioType: 'failure_mode',
        path: happyPath, // Use happy path as base
        mockOverrides: [mockOverride],
        expectedResult: 'fail',
        expectedFailureStep: stepNode?.id,
        expectedFailureType: failureMode,
        priority: priorityCounter++,
        tags,
        generatedAt: now,
      });
    }
  }

  return scenarios;
}

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generate all test scenarios from a ProcessStructure
 *
 * @param processStructure - The process structure to analyze
 * @param workflowId - ID of the workflow/process map
 * @param orgId - Organization ID
 * @param options - Generation options
 * @returns ScenarioGeneratorResult with all generated scenarios
 */
export function generateScenarios(
  processStructure: ProcessStructure,
  workflowId: string,
  orgId: string,
  options: ScenarioGeneratorOptions = {}
): ScenarioGeneratorResult {
  const {
    maxPathScenarios = 50,
    includeFailureModes = true,
    failureModes = FAILURE_MODES,
    additionalTags = [],
  } = options;

  const now = new Date().toISOString();

  // Discover all paths
  const pathDiscovery = discoverPaths(processStructure, { maxPaths: maxPathScenarios });

  // Get the happy path
  const happyPath = getHappyPath(processStructure);

  // Collect all unique integrations
  const integrations = new Set<string>();
  for (const node of processStructure.nodes) {
    if (node.integration) {
      integrations.add(node.integration.toLowerCase());
    }
  }
  const integrationList = Array.from(integrations);

  // Generate path scenarios
  const pathScenarios = generatePathScenarios(
    workflowId,
    orgId,
    pathDiscovery.paths,
    happyPath,
    processStructure.nodes,
    additionalTags
  );

  // Generate failure scenarios (only if we have a happy path and integrations)
  let failureScenarios: GeneratedTestScenario[] = [];
  if (includeFailureModes && happyPath && integrationList.length > 0) {
    failureScenarios = generateFailureScenarios(
      workflowId,
      orgId,
      happyPath,
      integrationList,
      processStructure.nodes,
      failureModes,
      additionalTags
    );
  }

  // Combine all scenarios
  const allScenarios = [...pathScenarios, ...failureScenarios];

  // Sort by priority
  allScenarios.sort((a, b) => a.priority - b.priority);

  return {
    scenarios: allScenarios,
    pathScenarios,
    failureScenarios,
    pathDiscovery,
    integrations: integrationList,
    generatedAt: now,
  };
}

/**
 * Generate only the happy path scenario (quick generation)
 */
export function generateHappyPathScenario(
  processStructure: ProcessStructure,
  workflowId: string,
  orgId: string
): GeneratedTestScenario | null {
  const happyPath = getHappyPath(processStructure);

  if (!happyPath) {
    return null;
  }

  const now = new Date().toISOString();
  const integrations = getPathIntegrations(happyPath, processStructure.nodes);

  return {
    id: generateScenarioId('happy'),
    workflowId,
    orgId,
    name: 'Happy Path - Main Flow',
    description: `Tests the main success flow through all ${happyPath.totalSteps} steps.`,
    scenarioType: 'happy_path',
    path: happyPath,
    mockOverrides: [],
    expectedResult: 'pass',
    priority: 1,
    tags: ['happy_path', `steps:${happyPath.totalSteps}`, ...integrations.map((i) => `integration:${i}`)],
    generatedAt: now,
  };
}

/**
 * Generate failure scenarios for a specific integration
 */
export function generateIntegrationFailureScenarios(
  processStructure: ProcessStructure,
  workflowId: string,
  orgId: string,
  integration: string,
  failureModes: MockType[] = FAILURE_MODES
): GeneratedTestScenario[] {
  const happyPath = getHappyPath(processStructure);

  if (!happyPath) {
    return [];
  }

  return generateFailureScenarios(
    workflowId,
    orgId,
    happyPath,
    [integration],
    processStructure.nodes,
    failureModes
  );
}

// ============================================================================
// Exports
// ============================================================================

export { FAILURE_MODES, FAILURE_MODE_DESCRIPTIONS };
