/**
 * Batch Scenario Runner
 *
 * Executes multiple test scenarios with parallel execution,
 * progress tracking, and database persistence.
 *
 * Features:
 * - Configurable concurrency (parallel execution limit)
 * - Real-time progress events for UI updates
 * - Automatic persistence of results to database
 * - Filter support (run by type, status, etc.)
 */

import type {
  ProcessMapWorkflow,
  ProcessMapMock,
  GeneratedTestScenario,
  ScenarioBatchResult,
  RunMode,
  ScenarioType,
} from '@/lib/types/processMapTesting';

import { ScenarioTestEngine, type ScenarioExecutionResult } from '../ScenarioTestEngine';
import {
  saveScenarioRun,
  updateScenarioLastRun,
} from '@/lib/services/testScenarioService';

// ============================================================================
// Types
// ============================================================================

export interface BatchRunnerOptions {
  /** The workflow to test */
  workflow: ProcessMapWorkflow;
  /** Run mode */
  runMode: RunMode;
  /** Base mocks to apply */
  baseMocks?: ProcessMapMock[];
  /** Maximum concurrent scenario executions (default: 3) */
  concurrency?: number;
  /** Stop all executions on first failure */
  stopOnFailure?: boolean;
  /** Persist results to database */
  persistResults?: boolean;
  /** Test run ID for grouping results */
  testRunId?: string;
}

export interface BatchProgress {
  /** Total scenarios to run */
  total: number;
  /** Completed scenario count */
  completed: number;
  /** Passed scenario count */
  passed: number;
  /** Failed scenario count */
  failed: number;
  /** Error scenario count */
  errors: number;
  /** Currently running scenario count */
  running: number;
  /** Pending scenario count */
  pending: number;
  /** Overall progress percentage (0-100) */
  progressPercent: number;
  /** Currently running scenario IDs */
  runningScenarioIds: string[];
  /** Estimated time remaining in ms (rough estimate) */
  estimatedRemainingMs: number | null;
}

export interface BatchRunnerEvents {
  /** Called when batch execution starts */
  onStart?: (total: number) => void;
  /** Called when progress changes */
  onProgress?: (progress: BatchProgress) => void;
  /** Called when a scenario starts */
  onScenarioStart?: (scenario: GeneratedTestScenario) => void;
  /** Called when a scenario completes */
  onScenarioComplete?: (result: ScenarioExecutionResult, progress: BatchProgress) => void;
  /** Called when batch execution completes */
  onComplete?: (result: ScenarioBatchResult) => void;
  /** Called on error */
  onError?: (error: Error, scenario?: GeneratedTestScenario) => void;
}

export interface BatchFilterOptions {
  /** Filter by scenario type */
  types?: ScenarioType[];
  /** Filter by scenario IDs */
  scenarioIds?: string[];
  /** Only run scenarios that have never been run */
  onlyNeverRun?: boolean;
  /** Only run scenarios that failed last time */
  onlyFailedLast?: boolean;
  /** Filter by integration */
  integrations?: string[];
  /** Filter by tags */
  tags?: string[];
}

// ============================================================================
// Batch Scenario Runner
// ============================================================================

export class BatchScenarioRunner {
  private options: Required<Omit<BatchRunnerOptions, 'testRunId'>> & { testRunId?: string };
  private events: BatchRunnerEvents;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;

  constructor(options: BatchRunnerOptions, events?: BatchRunnerEvents) {
    this.options = {
      workflow: options.workflow,
      runMode: options.runMode,
      baseMocks: options.baseMocks || [],
      concurrency: options.concurrency || 3,
      stopOnFailure: options.stopOnFailure || false,
      persistResults: options.persistResults ?? true,
      testRunId: options.testRunId,
    };
    this.events = events || {};
  }

  /**
   * Filter scenarios based on filter options
   */
  filterScenarios(
    scenarios: GeneratedTestScenario[],
    filters?: BatchFilterOptions
  ): GeneratedTestScenario[] {
    if (!filters) return scenarios;

    let filtered = [...scenarios];

    // Filter by type
    if (filters.types && filters.types.length > 0) {
      filtered = filtered.filter((s) => filters.types!.includes(s.scenarioType));
    }

    // Filter by scenario IDs
    if (filters.scenarioIds && filters.scenarioIds.length > 0) {
      filtered = filtered.filter((s) => filters.scenarioIds!.includes(s.id));
    }

    // Filter by never run
    if (filters.onlyNeverRun) {
      filtered = filtered.filter((s) => !s.lastRunResult);
    }

    // Filter by failed last
    if (filters.onlyFailedLast) {
      filtered = filtered.filter(
        (s) => s.lastRunResult?.result === 'fail' || s.lastRunResult?.result === 'error'
      );
    }

    // Filter by integration (check mock overrides)
    if (filters.integrations && filters.integrations.length > 0) {
      filtered = filtered.filter((s) =>
        s.mockOverrides.some((m) => filters.integrations!.includes(m.integration))
      );
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter((s) =>
        s.tags.some((t) => filters.tags!.includes(t))
      );
    }

    return filtered;
  }

  /**
   * Run all scenarios with parallel execution
   */
  async runAll(
    scenarios: GeneratedTestScenario[],
    filters?: BatchFilterOptions
  ): Promise<ScenarioBatchResult> {
    if (this.isRunning) {
      throw new Error('Batch runner is already running');
    }

    this.isRunning = true;
    this.shouldStop = false;

    const startTime = Date.now();
    const executedAt = new Date().toISOString();

    // Apply filters
    const filteredScenarios = this.filterScenarios(scenarios, filters);

    // Initialize progress tracking
    const progress: BatchProgress = {
      total: filteredScenarios.length,
      completed: 0,
      passed: 0,
      failed: 0,
      errors: 0,
      running: 0,
      pending: filteredScenarios.length,
      progressPercent: 0,
      runningScenarioIds: [],
      estimatedRemainingMs: null,
    };

    // Create test engine
    const engine = new ScenarioTestEngine({
      workflow: this.options.workflow,
      runMode: this.options.runMode,
      baseMocks: this.options.baseMocks,
    });

    // Track results
    const results: ScenarioBatchResult['results'] = [];
    const durations: number[] = [];

    // Notify start
    this.events.onStart?.(filteredScenarios.length);
    this.events.onProgress?.(progress);

    // Create a queue of scenarios to run
    const queue = [...filteredScenarios];
    const runningPromises: Map<string, Promise<void>> = new Map();

    const updateProgress = () => {
      progress.progressPercent = Math.round((progress.completed / progress.total) * 100);
      progress.pending = progress.total - progress.completed - progress.running;

      // Estimate remaining time based on average duration
      if (durations.length > 0 && progress.pending > 0) {
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        progress.estimatedRemainingMs = Math.round(avgDuration * progress.pending);
      }

      this.events.onProgress?.(progress);
    };

    const runScenario = async (scenario: GeneratedTestScenario): Promise<void> => {
      if (this.shouldStop) return;

      progress.running++;
      progress.runningScenarioIds.push(scenario.id);
      updateProgress();

      this.events.onScenarioStart?.(scenario);

      const scenarioStartTime = Date.now();

      try {
        const result = await engine.executeScenario(scenario);
        const duration = Date.now() - scenarioStartTime;
        durations.push(duration);

        // Update counts
        if (result.matchedExpectation) {
          progress.passed++;
        } else {
          progress.failed++;
        }

        // Add to results
        results.push({
          scenarioId: scenario.id,
          testRun: result.testRun,
          stepResults: result.stepResults,
          matchedExpectation: result.matchedExpectation,
          mismatchDetails: result.mismatchDetails,
          executedAt: result.executedAt,
        });

        // Persist to database if enabled
        if (this.options.persistResults) {
          try {
            // Save scenario run
            await saveScenarioRun({
              scenarioId: scenario.id,
              testRunId: result.testRun.id,
              result: result.testRun.overallResult || 'error',
              matchedExpectation: result.matchedExpectation,
              mismatchDetails: result.mismatchDetails,
              durationMs: result.testRun.durationMs || 0,
              stepsExecuted: result.stepResults.length,
              stepsPassed: result.stepResults.filter((r) => r.status === 'passed').length,
              stepsFailed: result.stepResults.filter((r) => r.status === 'failed').length,
              errorMessage: result.testRun.errorMessage,
              failureStepId: result.stepResults.find((r) => r.status === 'failed')?.stepId,
              failureType: result.stepResults.find((r) => r.status === 'failed') ? 'error' : undefined,
            });

            // Update scenario's last run result
            await updateScenarioLastRun(scenario.id, {
              result: result.matchedExpectation ? 'pass' : 'fail',
              runAt: result.executedAt,
              durationMs: result.testRun.durationMs || 0,
              testRunId: result.testRun.id,
            });
          } catch (persistError) {
            console.error('[BatchScenarioRunner] Failed to persist result:', persistError);
            // Don't fail the batch for persistence errors
          }
        }

        // Notify completion
        progress.completed++;
        progress.running--;
        progress.runningScenarioIds = progress.runningScenarioIds.filter((id) => id !== scenario.id);
        updateProgress();

        this.events.onScenarioComplete?.(result, progress);

        // Check stop condition
        if (!result.matchedExpectation && this.options.stopOnFailure) {
          this.shouldStop = true;
        }
      } catch (error) {
        const err = error as Error;
        progress.errors++;
        progress.completed++;
        progress.running--;
        progress.runningScenarioIds = progress.runningScenarioIds.filter((id) => id !== scenario.id);
        updateProgress();

        // Add error result
        results.push({
          scenarioId: scenario.id,
          testRun: {
            id: `error_${Date.now()}`,
            workflowId: this.options.workflow.id,
            orgId: this.options.workflow.orgId,
            runMode: this.options.runMode,
            testData: {},
            runConfig: {
              timeout: 300000,
              continueOnFailure: false,
              selectedSteps: scenario.path.stepIds,
            },
            status: 'failed',
            startedAt: executedAt,
            completedAt: new Date().toISOString(),
            overallResult: 'error',
            durationMs: Date.now() - scenarioStartTime,
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

        this.events.onError?.(err, scenario);

        if (this.options.stopOnFailure) {
          this.shouldStop = true;
        }
      }
    };

    // Process queue with concurrency limit
    while (queue.length > 0 || runningPromises.size > 0) {
      // Fill up to concurrency limit
      while (
        queue.length > 0 &&
        runningPromises.size < this.options.concurrency &&
        !this.shouldStop
      ) {
        const scenario = queue.shift()!;
        const promise = runScenario(scenario).finally(() => {
          runningPromises.delete(scenario.id);
        });
        runningPromises.set(scenario.id, promise);
      }

      // Wait for at least one to complete
      if (runningPromises.size > 0) {
        await Promise.race(runningPromises.values());
      }

      // If we should stop, wait for running ones to finish
      if (this.shouldStop && queue.length > 0) {
        queue.length = 0; // Clear remaining queue
      }
    }

    this.isRunning = false;

    const batchResult: ScenarioBatchResult = {
      totalScenarios: filteredScenarios.length,
      passed: progress.passed,
      failed: progress.failed,
      errors: progress.errors,
      results,
      totalDurationMs: Date.now() - startTime,
      executedAt,
    };

    this.events.onComplete?.(batchResult);

    return batchResult;
  }

  /**
   * Run scenarios by type
   */
  async runByType(
    scenarios: GeneratedTestScenario[],
    type: ScenarioType
  ): Promise<ScenarioBatchResult> {
    return this.runAll(scenarios, { types: [type] });
  }

  /**
   * Run only happy path scenarios
   */
  async runHappyPaths(scenarios: GeneratedTestScenario[]): Promise<ScenarioBatchResult> {
    return this.runByType(scenarios, 'happy_path');
  }

  /**
   * Run only failure mode scenarios
   */
  async runFailureModes(scenarios: GeneratedTestScenario[]): Promise<ScenarioBatchResult> {
    return this.runByType(scenarios, 'failure_mode');
  }

  /**
   * Run only previously failed scenarios
   */
  async runFailedScenarios(scenarios: GeneratedTestScenario[]): Promise<ScenarioBatchResult> {
    return this.runAll(scenarios, { onlyFailedLast: true });
  }

  /**
   * Stop the current batch execution
   */
  stop(): void {
    this.shouldStop = true;
  }

  /**
   * Check if batch is currently running
   */
  get running(): boolean {
    return this.isRunning;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Run all scenarios with default options
 */
export async function runAllScenarios(
  scenarios: GeneratedTestScenario[],
  workflow: ProcessMapWorkflow,
  options?: {
    runMode?: RunMode;
    mocks?: ProcessMapMock[];
    concurrency?: number;
    onProgress?: (progress: BatchProgress) => void;
  }
): Promise<ScenarioBatchResult> {
  const runner = new BatchScenarioRunner(
    {
      workflow,
      runMode: options?.runMode || 'mock',
      baseMocks: options?.mocks,
      concurrency: options?.concurrency,
    },
    {
      onProgress: options?.onProgress,
    }
  );

  return runner.runAll(scenarios);
}

/**
 * Run scenarios with filters
 */
export async function runFilteredScenarios(
  scenarios: GeneratedTestScenario[],
  workflow: ProcessMapWorkflow,
  filters: BatchFilterOptions,
  options?: {
    runMode?: RunMode;
    mocks?: ProcessMapMock[];
    concurrency?: number;
    onProgress?: (progress: BatchProgress) => void;
  }
): Promise<ScenarioBatchResult> {
  const runner = new BatchScenarioRunner(
    {
      workflow,
      runMode: options?.runMode || 'mock',
      baseMocks: options?.mocks,
      concurrency: options?.concurrency,
    },
    {
      onProgress: options?.onProgress,
    }
  );

  return runner.runAll(scenarios, filters);
}
