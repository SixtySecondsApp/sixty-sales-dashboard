/**
 * Coverage Analyzer
 *
 * Calculates test coverage metrics for process map workflows.
 * Tracks path coverage, branch coverage, and failure mode coverage.
 */

import type {
  ProcessStructure,
  ProcessNode,
  GeneratedTestScenario,
  ScenarioTestResult,
  TestCoverage,
  UncoveredPath,
  FailureModeCoverage,
  MockType,
  ScenarioPath,
} from '@/lib/types/processMapTesting';

import { discoverPaths, type PathDiscoveryResult } from '../generators/PathDiscovery';
import { FAILURE_MODES } from '../generators/ScenarioGenerator';

// ============================================================================
// Types
// ============================================================================

export interface CoverageAnalysisInput {
  /** The process structure being analyzed */
  processStructure: ProcessStructure;
  /** Generated scenarios */
  scenarios: GeneratedTestScenario[];
  /** Test results (if any tests have been run) */
  testResults?: ScenarioTestResult[];
}

export interface CoverageBreakdown {
  /** Coverage by scenario type */
  byType: {
    happyPath: number;
    branchPaths: number;
    failureModes: number;
  };
  /** Coverage by integration */
  byIntegration: Record<string, {
    pathsCovered: number;
    failureModesCovered: number;
    totalFailureModes: number;
  }>;
  /** Step-level coverage */
  byStep: Record<string, {
    covered: boolean;
    scenarioCount: number;
    executionCount: number;
  }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a set of path hashes from scenarios
 */
function getScenarioPathHashes(scenarios: GeneratedTestScenario[]): Set<string> {
  return new Set(scenarios.map((s) => s.path.pathHash));
}

/**
 * Get all unique branch conditions exercised by scenarios
 */
function getExercisedBranches(scenarios: GeneratedTestScenario[]): Set<string> {
  const branches = new Set<string>();

  for (const scenario of scenarios) {
    for (const decision of scenario.path.decisions) {
      // Use nodeId + condition as unique identifier
      branches.add(`${decision.nodeId}:${decision.condition}`);
    }
  }

  return branches;
}

/**
 * Get all possible branch conditions from path discovery
 */
function getAllPossibleBranches(pathDiscovery: PathDiscoveryResult): Set<string> {
  const branches = new Set<string>();

  for (const path of pathDiscovery.paths) {
    for (const decision of path.decisions) {
      branches.add(`${decision.nodeId}:${decision.condition}`);
    }
  }

  return branches;
}

/**
 * Get failure modes covered per integration
 */
function getFailureModeCoverage(
  scenarios: GeneratedTestScenario[]
): FailureModeCoverage {
  const coverage: FailureModeCoverage = {};

  for (const scenario of scenarios) {
    if (scenario.scenarioType === 'failure_mode' && scenario.expectedFailureType) {
      for (const override of scenario.mockOverrides) {
        const integration = override.integration.toLowerCase();
        if (!coverage[integration]) {
          coverage[integration] = [];
        }
        if (!coverage[integration].includes(scenario.expectedFailureType)) {
          coverage[integration].push(scenario.expectedFailureType);
        }
      }
    }
  }

  return coverage;
}

/**
 * Get integrations with full failure mode coverage
 */
function getFullCoverageIntegrations(
  coverage: FailureModeCoverage,
  requiredModes: MockType[] = FAILURE_MODES
): string[] {
  const full: string[] = [];

  for (const [integration, modes] of Object.entries(coverage)) {
    const hasAll = requiredModes.every((mode) => modes.includes(mode));
    if (hasAll) {
      full.push(integration);
    }
  }

  return full;
}

/**
 * Get integrations with partial failure mode coverage
 */
function getPartialCoverageIntegrations(
  coverage: FailureModeCoverage,
  fullCoverage: string[],
  allIntegrations: string[]
): string[] {
  return allIntegrations.filter(
    (integration) =>
      !fullCoverage.includes(integration) &&
      coverage[integration]?.length > 0
  );
}

/**
 * Find uncovered paths
 */
function findUncoveredPaths(
  allPaths: ScenarioPath[],
  coveredHashes: Set<string>,
  nodes: ProcessNode[]
): UncoveredPath[] {
  const uncovered: UncoveredPath[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (const path of allPaths) {
    if (!coveredHashes.has(path.pathHash)) {
      const firstNode = nodeMap.get(path.stepIds[0]);
      const lastNode = nodeMap.get(path.stepIds[path.stepIds.length - 1]);

      uncovered.push({
        path,
        reason: `No scenario covers the path from "${firstNode?.label || path.stepIds[0]}" ` +
          `to "${lastNode?.label || path.stepIds[path.stepIds.length - 1]}"`,
        suggestedScenario: {
          name: `Suggested: Path covering ${path.totalSteps} steps`,
          scenarioType: path.decisions.length > 0 ? 'branch_path' : 'happy_path',
          path,
        },
      });
    }
  }

  return uncovered;
}

/**
 * Calculate overall coverage score
 */
function calculateOverallScore(
  pathCoverage: number,
  branchCoverage: number,
  failureModeCoverage: number
): number {
  // Weighted average: paths 40%, branches 30%, failure modes 30%
  const weighted =
    pathCoverage * 0.4 +
    branchCoverage * 0.3 +
    failureModeCoverage * 0.3;

  return Math.round(weighted);
}

// ============================================================================
// Main Analyzer
// ============================================================================

/**
 * Analyze test coverage for a process structure
 *
 * @param input - Coverage analysis input
 * @returns TestCoverage with comprehensive metrics
 */
export function analyzeCoverage(input: CoverageAnalysisInput): TestCoverage {
  const { processStructure, scenarios, testResults } = input;
  const now = new Date().toISOString();

  // Discover all possible paths
  const pathDiscovery = discoverPaths(processStructure);

  // Get covered path hashes from scenarios
  const coveredPathHashes = getScenarioPathHashes(scenarios);

  // Calculate path coverage
  const totalPaths = pathDiscovery.paths.length;
  const coveredPaths = pathDiscovery.paths.filter(
    (p) => coveredPathHashes.has(p.pathHash)
  ).length;
  const pathCoveragePercent = totalPaths > 0
    ? Math.round((coveredPaths / totalPaths) * 100)
    : 0;

  // Calculate branch coverage
  const allBranches = getAllPossibleBranches(pathDiscovery);
  const exercisedBranches = getExercisedBranches(scenarios);
  const totalBranches = allBranches.size;
  const coveredBranches = exercisedBranches.size;
  const branchCoveragePercent = totalBranches > 0
    ? Math.round((coveredBranches / totalBranches) * 100)
    : 100; // If no branches, consider it 100% covered

  // Calculate failure mode coverage
  const failureModeCoverage = getFailureModeCoverage(scenarios);

  // Get all integrations
  const allIntegrations = Array.from(
    new Set(processStructure.nodes.map((n) => n.integration).filter(Boolean) as string[])
  ).map((i) => i.toLowerCase());

  // Calculate failure mode coverage percentage
  const totalPossibleFailureModes = allIntegrations.length * FAILURE_MODES.length;
  const coveredFailureModes = Object.values(failureModeCoverage).reduce(
    (sum, modes) => sum + modes.length,
    0
  );
  const failureModeCoveragePercent = totalPossibleFailureModes > 0
    ? Math.round((coveredFailureModes / totalPossibleFailureModes) * 100)
    : 100;

  // Get integration coverage status
  const integrationsWithFullCoverage = getFullCoverageIntegrations(failureModeCoverage);
  const integrationsWithPartialCoverage = getPartialCoverageIntegrations(
    failureModeCoverage,
    integrationsWithFullCoverage,
    allIntegrations
  );

  // Find uncovered paths
  const uncoveredPaths = findUncoveredPaths(
    pathDiscovery.paths,
    coveredPathHashes,
    processStructure.nodes
  );

  // Calculate overall score
  const overallScore = calculateOverallScore(
    pathCoveragePercent,
    branchCoveragePercent,
    failureModeCoveragePercent
  );

  return {
    totalPaths,
    coveredPaths,
    pathCoveragePercent,
    totalBranches,
    coveredBranches,
    branchCoveragePercent,
    failureModeCoverage,
    integrationsWithFullCoverage,
    integrationsWithPartialCoverage,
    uncoveredPaths,
    overallScore,
    calculatedAt: now,
  };
}

/**
 * Get a detailed coverage breakdown
 */
export function getCoverageBreakdown(
  processStructure: ProcessStructure,
  scenarios: GeneratedTestScenario[],
  testResults?: ScenarioTestResult[]
): CoverageBreakdown {
  // Count by type
  const happyPathCount = scenarios.filter((s) => s.scenarioType === 'happy_path').length;
  const branchPathCount = scenarios.filter((s) => s.scenarioType === 'branch_path').length;
  const failureModeCount = scenarios.filter((s) => s.scenarioType === 'failure_mode').length;

  // Group by integration
  const byIntegration: CoverageBreakdown['byIntegration'] = {};
  const allIntegrations = Array.from(
    new Set(processStructure.nodes.map((n) => n.integration).filter(Boolean) as string[])
  );

  for (const integration of allIntegrations) {
    const integrationLower = integration.toLowerCase();
    const pathsWithIntegration = scenarios.filter(
      (s) =>
        (s.scenarioType === 'happy_path' || s.scenarioType === 'branch_path') &&
        s.path.stepIds.some((stepId) => {
          const node = processStructure.nodes.find((n) => n.id === stepId);
          return node?.integration?.toLowerCase() === integrationLower;
        })
    );

    const failureModes = scenarios.filter(
      (s) =>
        s.scenarioType === 'failure_mode' &&
        s.mockOverrides.some((o) => o.integration.toLowerCase() === integrationLower)
    );

    byIntegration[integrationLower] = {
      pathsCovered: pathsWithIntegration.length,
      failureModesCovered: failureModes.length,
      totalFailureModes: FAILURE_MODES.length,
    };
  }

  // Step-level coverage
  const byStep: CoverageBreakdown['byStep'] = {};

  for (const node of processStructure.nodes) {
    const scenariosWithStep = scenarios.filter((s) =>
      s.path.stepIds.includes(node.id)
    );

    const executionsOfStep = testResults?.filter((r) =>
      r.stepResults.some((sr) => sr.stepId === node.id)
    ).length || 0;

    byStep[node.id] = {
      covered: scenariosWithStep.length > 0,
      scenarioCount: scenariosWithStep.length,
      executionCount: executionsOfStep,
    };
  }

  return {
    byType: {
      happyPath: happyPathCount,
      branchPaths: branchPathCount,
      failureModes: failureModeCount,
    },
    byIntegration,
    byStep,
  };
}

/**
 * Get missing failure mode scenarios
 */
export function getMissingFailureModes(
  processStructure: ProcessStructure,
  scenarios: GeneratedTestScenario[]
): Array<{ integration: string; missingModes: MockType[] }> {
  const coverage = getFailureModeCoverage(scenarios);
  const allIntegrations = Array.from(
    new Set(processStructure.nodes.map((n) => n.integration).filter(Boolean) as string[])
  ).map((i) => i.toLowerCase());

  const missing: Array<{ integration: string; missingModes: MockType[] }> = [];

  for (const integration of allIntegrations) {
    const coveredModes = coverage[integration] || [];
    const missingModes = FAILURE_MODES.filter((mode) => !coveredModes.includes(mode));

    if (missingModes.length > 0) {
      missing.push({ integration, missingModes });
    }
  }

  return missing;
}

/**
 * Quick coverage check - returns true if coverage meets threshold
 */
export function meetsMinimumCoverage(
  coverage: TestCoverage,
  thresholds: {
    pathCoverage?: number;
    branchCoverage?: number;
    overallScore?: number;
  } = {}
): boolean {
  const {
    pathCoverage = 80,
    branchCoverage = 70,
    overallScore = 75,
  } = thresholds;

  return (
    coverage.pathCoveragePercent >= pathCoverage &&
    coverage.branchCoveragePercent >= branchCoverage &&
    coverage.overallScore >= overallScore
  );
}
