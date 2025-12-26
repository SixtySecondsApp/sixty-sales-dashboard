/**
 * Scenario Test Engine
 *
 * Extends ProcessMapTestEngine to execute specific test scenarios.
 * Follows the scenario's defined path and applies mock overrides.
 */

import type {
  ProcessMapWorkflow,
  ProcessMapTestRun,
  ProcessMapStepResult,
  ProcessMapMock,
  GeneratedTestScenario,
  ScenarioTestResult,
  ScenarioBatchResult,
  RunMode,
  TestRunConfig,
  TestEngineEvents,
  ScenarioMockOverride,
} from '@/lib/types/processMapTesting';

import { ProcessMapTestEngine } from './ProcessMapTestEngine';

// ============================================================================
// Types
// ============================================================================

export interface ScenarioTestEngineOptions {
  /** The workflow to test */
  workflow: ProcessMapWorkflow;
  /** Run mode */
  runMode: RunMode;
  /** Initial test data */
  testData?: Record<string, unknown>;
  /** Base mocks (scenario overrides will be applied on top) */
  baseMocks?: ProcessMapMock[];
  /** Event handlers */
  events?: Partial<TestEngineEvents>;
}

export interface ScenarioExecutionResult {
  /** The scenario that was executed */
  scenario: GeneratedTestScenario;
  /** Test run results */
  testRun: ProcessMapTestRun;
  /** Step results */
  stepResults: ProcessMapStepResult[];
  /** Whether actual result matched expected */
  matchedExpectation: boolean;
  /** If not matched, why */
  mismatchDetails?: string;
  /** Execution timestamp */
  executedAt: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert ScenarioMockOverride to ProcessMapMock
 */
function convertOverrideToMock(
  override: ScenarioMockOverride,
  workflowId: string,
  orgId: string
): ProcessMapMock {
  return {
    id: `override_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    workflowId,
    orgId,
    integration: override.integration,
    endpoint: null,
    mockType: override.mockType,
    responseData: null,
    errorResponse: override.errorResponse || null,
    delayMs: override.delayMs || 0,
    matchConditions: override.stepId ? { pathPattern: override.stepId } : null,
    priority: override.priority,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Merge base mocks with scenario overrides
 * Scenario overrides have higher priority
 */
function mergeMocks(
  baseMocks: ProcessMapMock[],
  overrides: ScenarioMockOverride[],
  workflowId: string,
  orgId: string
): ProcessMapMock[] {
  // Convert overrides to ProcessMapMock format
  const overrideMocks = overrides.map((override) =>
    convertOverrideToMock(override, workflowId, orgId)
  );

  // Combine with base mocks (override mocks come first for higher priority)
  return [...overrideMocks, ...baseMocks];
}

/**
 * Check if a test result matches the expected outcome
 */
function checkExpectation(
  scenario: GeneratedTestScenario,
  testRun: Omit<ProcessMapTestRun, 'id' | 'createdAt'>,
  stepResults: Omit<ProcessMapStepResult, 'id'>[]
): { matched: boolean; details?: string } {
  const actualResult = testRun.overallResult;

  // For pass expectations, check that the test passed
  if (scenario.expectedResult === 'pass') {
    if (actualResult === 'pass') {
      return { matched: true };
    }
    return {
      matched: false,
      details: `Expected pass but got ${actualResult}. ` +
        `${testRun.stepsFailed} step(s) failed: ${testRun.errorMessage || 'Unknown error'}`,
    };
  }

  // For fail expectations, check that the test failed
  if (scenario.expectedResult === 'fail') {
    if (actualResult !== 'pass') {
      // Check if failure occurred at expected step (if specified)
      if (scenario.expectedFailureStep) {
        const failedAtExpected = stepResults.some(
          (r) => r.stepId === scenario.expectedFailureStep && r.status === 'failed'
        );

        if (!failedAtExpected) {
          return {
            matched: false,
            details: `Test failed as expected, but not at step "${scenario.expectedFailureStep}". ` +
              `Failure occurred at: ${stepResults.find((r) => r.status === 'failed')?.stepName || 'unknown'}`,
          };
        }
      }

      return { matched: true };
    }

    return {
      matched: false,
      details: `Expected failure (${scenario.expectedFailureType || 'any type'}) ` +
        `at step "${scenario.expectedFailureStep || 'any'}" but test passed.`,
    };
  }

  return { matched: false, details: 'Unknown expected result' };
}

// ============================================================================
// Scenario Test Engine
// ============================================================================

/**
 * Engine for executing individual test scenarios
 */
export class ScenarioTestEngine {
  private workflow: ProcessMapWorkflow;
  private runMode: RunMode;
  private testData: Record<string, unknown>;
  private baseMocks: ProcessMapMock[];
  private events: Partial<TestEngineEvents>;

  constructor(options: ScenarioTestEngineOptions) {
    this.workflow = options.workflow;
    this.runMode = options.runMode;
    this.testData = options.testData || {};
    this.baseMocks = options.baseMocks || [];
    this.events = options.events || {};
  }

  /**
   * Execute a single scenario
   */
  async executeScenario(
    scenario: GeneratedTestScenario
  ): Promise<ScenarioExecutionResult> {
    const executedAt = new Date().toISOString();

    // Merge base mocks with scenario overrides
    const mocks = mergeMocks(
      this.baseMocks,
      scenario.mockOverrides,
      this.workflow.id,
      this.workflow.orgId
    );

    // Create test engine with scenario-specific configuration
    const engine = new ProcessMapTestEngine({
      workflow: this.workflow,
      runMode: this.runMode,
      testData: this.testData,
      mocks,
      config: {
        // For failure scenarios, continue on failure to see full execution
        continueOnFailure: scenario.expectedResult === 'fail',
        // Only execute steps in the scenario's path
        selectedSteps: scenario.path.stepIds,
        timeout: 300000,
      },
      events: this.events,
    });

    // Execute the test
    const { testRun, stepResults } = await engine.run();

    // Add IDs to results
    const fullTestRun: ProcessMapTestRun = {
      ...testRun,
      id: `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: executedAt,
    };

    const fullStepResults: ProcessMapStepResult[] = stepResults.map((r, i) => ({
      ...r,
      id: `step_${Date.now()}_${i}`,
    }));

    // Check if result matches expectation
    const { matched, details } = checkExpectation(scenario, testRun, stepResults);

    return {
      scenario,
      testRun: fullTestRun,
      stepResults: fullStepResults,
      matchedExpectation: matched,
      mismatchDetails: details,
      executedAt,
    };
  }

  /**
   * Execute multiple scenarios in sequence
   */
  async executeBatch(
    scenarios: GeneratedTestScenario[],
    options?: {
      /** Stop on first failure */
      stopOnFailure?: boolean;
      /** Callback after each scenario completes */
      onScenarioComplete?: (result: ScenarioExecutionResult, index: number) => void;
    }
  ): Promise<ScenarioBatchResult> {
    const startTime = Date.now();
    const executedAt = new Date().toISOString();
    const results: ScenarioTestResult[] = [];

    let passed = 0;
    let failed = 0;
    let errors = 0;

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];

      try {
        const result = await this.executeScenario(scenario);

        results.push({
          scenarioId: scenario.id,
          testRun: result.testRun,
          stepResults: result.stepResults,
          matchedExpectation: result.matchedExpectation,
          mismatchDetails: result.mismatchDetails,
          executedAt: result.executedAt,
        });

        if (result.matchedExpectation) {
          passed++;
        } else {
          failed++;
        }

        options?.onScenarioComplete?.(result, i);

        if (!result.matchedExpectation && options?.stopOnFailure) {
          break;
        }
      } catch (error) {
        errors++;
        const err = error as Error;

        // Create error result
        results.push({
          scenarioId: scenario.id,
          testRun: {
            id: `error_${Date.now()}`,
            workflowId: this.workflow.id,
            orgId: this.workflow.orgId,
            runMode: this.runMode,
            testData: this.testData,
            runConfig: {
              timeout: 300000,
              continueOnFailure: false,
              selectedSteps: scenario.path.stepIds,
            },
            status: 'failed',
            startedAt: executedAt,
            completedAt: new Date().toISOString(),
            overallResult: 'error',
            durationMs: 0,
            stepsTotal: scenario.path.totalSteps,
            stepsPassed: 0,
            stepsFailed: 0,
            stepsSkipped: scenario.path.totalSteps,
            errorMessage: err.message,
            errorDetails: { name: err.name, stack: err.stack },
            runBy: null,
            createdAt: executedAt,
          },
          stepResults: [],
          matchedExpectation: false,
          mismatchDetails: `Execution error: ${err.message}`,
          executedAt,
        });

        if (options?.stopOnFailure) {
          break;
        }
      }
    }

    return {
      totalScenarios: scenarios.length,
      passed,
      failed,
      errors,
      results,
      totalDurationMs: Date.now() - startTime,
      executedAt,
    };
  }
}

/**
 * Execute a single scenario with minimal setup
 * Convenience function for quick scenario execution
 */
export async function executeScenario(
  scenario: GeneratedTestScenario,
  workflow: ProcessMapWorkflow,
  options?: {
    runMode?: RunMode;
    testData?: Record<string, unknown>;
    mocks?: ProcessMapMock[];
  }
): Promise<ScenarioExecutionResult> {
  const engine = new ScenarioTestEngine({
    workflow,
    runMode: options?.runMode || 'mock',
    testData: options?.testData,
    baseMocks: options?.mocks,
  });

  return engine.executeScenario(scenario);
}

/**
 * Execute all scenarios for a workflow
 */
export async function executeAllScenarios(
  scenarios: GeneratedTestScenario[],
  workflow: ProcessMapWorkflow,
  options?: {
    runMode?: RunMode;
    testData?: Record<string, unknown>;
    mocks?: ProcessMapMock[];
    onProgress?: (completed: number, total: number, result: ScenarioExecutionResult) => void;
  }
): Promise<ScenarioBatchResult> {
  const engine = new ScenarioTestEngine({
    workflow,
    runMode: options?.runMode || 'mock',
    testData: options?.testData,
    baseMocks: options?.mocks,
  });

  return engine.executeBatch(scenarios, {
    onScenarioComplete: (result, index) => {
      options?.onProgress?.(index + 1, scenarios.length, result);
    },
  });
}
