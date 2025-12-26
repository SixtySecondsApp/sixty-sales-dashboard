/**
 * Process Map Test Engine
 *
 * Core execution engine for testing process map workflows.
 * Handles step execution, mock integration, and result tracking.
 */

import type {
  ProcessMapWorkflow,
  WorkflowStepDefinition,
  ProcessMapTestRun,
  ProcessMapStepResult,
  ProcessMapMock,
  RunMode,
  TestRunConfig,
  StepStatus,
  TestRunStatus,
  TestRunResult,
  ValidationResult,
  LogEntry,
  TestEngineEvents,
} from '@/lib/types/processMapTesting';

// ============================================================================
// Execution Context
// ============================================================================

/**
 * Execution context that maintains state across step executions
 */
export class ExecutionContext {
  readonly runId: string;
  readonly runMode: RunMode;
  readonly initialData: Record<string, unknown>;
  private _stepOutputs: Map<string, Record<string, unknown>>;
  private _logs: LogEntry[];

  constructor(
    runId: string,
    runMode: RunMode,
    initialData: Record<string, unknown>
  ) {
    this.runId = runId;
    this.runMode = runMode;
    this.initialData = initialData;
    this._stepOutputs = new Map();
    this._logs = [];
  }

  get stepOutputs(): Map<string, Record<string, unknown>> {
    return new Map(this._stepOutputs);
  }

  getStepOutput(stepId: string): Record<string, unknown> | undefined {
    return this._stepOutputs.get(stepId);
  }

  setStepOutput(stepId: string, output: Record<string, unknown>): void {
    this._stepOutputs.set(stepId, output);
  }

  /**
   * Resolve inputs from dependencies
   */
  resolveInputs(dependencies: string[]): Record<string, unknown> {
    const inputs: Record<string, unknown> = { ...this.initialData };

    for (const depId of dependencies) {
      const output = this._stepOutputs.get(depId);
      if (output) {
        Object.assign(inputs, output);
      }
    }

    return inputs;
  }

  addLog(level: LogEntry['level'], message: string, data?: Record<string, unknown>): void {
    this._logs.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    });
  }

  getLogs(): LogEntry[] {
    return [...this._logs];
  }
}

// ============================================================================
// Step Executor Interface
// ============================================================================

export interface StepExecutor {
  canExecute(step: WorkflowStepDefinition, runMode: RunMode): boolean;
  execute(
    step: WorkflowStepDefinition,
    context: ExecutionContext,
    mocks: ProcessMapMock[]
  ): Promise<StepExecutionResult>;
}

export interface StepExecutionResult {
  success: boolean;
  outputData: Record<string, unknown>;
  wasMocked: boolean;
  mockSource?: string;
  validationResults: ValidationResult[];
  error?: Error;
  logs: LogEntry[];
}

// ============================================================================
// Default Step Executor
// ============================================================================

/**
 * Default step executor that handles mock and schema validation modes
 */
export class DefaultStepExecutor implements StepExecutor {
  canExecute(step: WorkflowStepDefinition, runMode: RunMode): boolean {
    // Defensive: default to 'mock' if runMode is falsy
    const effectiveRunMode = runMode || 'mock';

    // Can execute any step in mock or schema_validation mode
    if (effectiveRunMode === 'mock' || effectiveRunMode === 'schema_validation') {
      return true;
    }

    // In production_readonly mode, can execute if step only reads
    if (effectiveRunMode === 'production_readonly') {
      const ops = step.testConfig?.operations || ['read'];
      return ops.every(op => op === 'read');
    }

    // Default to allowing execution for unknown modes (safer for mock/testing)
    console.warn(`[DefaultStepExecutor] Unknown runMode "${effectiveRunMode}", defaulting to allow execution`);
    return true;
  }

  async execute(
    step: WorkflowStepDefinition,
    context: ExecutionContext,
    mocks: ProcessMapMock[]
  ): Promise<StepExecutionResult> {
    const logs: LogEntry[] = [];
    const validationResults: ValidationResult[] = [];
    let wasMocked = false;
    let mockSource: string | undefined;

    // Log step start
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Starting step: ${step.name}`,
      data: { stepId: step.id, type: step.type },
    });

    // Resolve input data from dependencies
    const inputData = context.resolveInputs(step.dependencies);

    // Validate input against schema
    const inputValidation = this.validateAgainstSchema(inputData, step.inputSchema);
    validationResults.push(...inputValidation);

    const hasInputErrors = inputValidation.some(v => !v.passed && v.severity === 'error');
    if (hasInputErrors && context.runMode === 'schema_validation') {
      return {
        success: false,
        outputData: {},
        wasMocked: false,
        validationResults,
        error: new Error('Input validation failed'),
        logs,
      };
    }

    // Check for applicable mock
    const mock = this.findMock(step, mocks);
    if (mock && context.runMode !== 'production_readonly') {
      wasMocked = true;
      mockSource = mock.integration;

      logs.push({
        timestamp: new Date().toISOString(),
        level: 'debug',
        message: `Using mock for ${mock.integration}`,
        data: { mockId: mock.id, mockType: mock.mockType },
      });

      // Simulate mock delay
      if (mock.delayMs > 0) {
        await this.delay(mock.delayMs);
      }

      // Handle different mock types
      if (mock.mockType === 'error' || mock.mockType === 'timeout' ||
          mock.mockType === 'rate_limit' || mock.mockType === 'auth_failure') {
        return {
          success: false,
          outputData: mock.errorResponse || {},
          wasMocked: true,
          mockSource,
          validationResults,
          error: new Error(`Mock ${mock.mockType}: ${mock.integration}`),
          logs,
        };
      }

      // Return mock response
      const outputData = mock.responseData || this.generateMockOutput(step);

      logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Step completed with mock`,
        data: { outputKeys: Object.keys(outputData) },
      });

      return {
        success: true,
        outputData,
        wasMocked: true,
        mockSource,
        validationResults,
        logs,
      };
    }

    // Generate synthetic output based on step type
    const outputData = this.generateSyntheticOutput(step, inputData);

    // Validate output against schema
    const outputValidation = this.validateAgainstSchema(outputData, step.outputSchema);
    validationResults.push(...outputValidation);

    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `Step completed`,
      data: { success: true },
    });

    return {
      success: true,
      outputData,
      wasMocked,
      mockSource,
      validationResults,
      logs,
    };
  }

  private findMock(step: WorkflowStepDefinition, mocks: ProcessMapMock[]): ProcessMapMock | undefined {
    if (!step.integration) return undefined;

    // Find active mocks for this integration, sorted by priority
    const applicableMocks = mocks
      .filter(m => m.isActive && m.integration === step.integration)
      .sort((a, b) => b.priority - a.priority);

    // Return highest priority mock that matches
    return applicableMocks[0];
  }

  private validateAgainstSchema(
    data: Record<string, unknown>,
    schema: { type: string; properties?: Record<string, unknown>; required?: string[] }
  ): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in data) || data[field] === undefined || data[field] === null) {
          results.push({
            rule: `required:${field}`,
            passed: false,
            message: `Required field "${field}" is missing`,
            severity: 'error',
          });
        } else {
          results.push({
            rule: `required:${field}`,
            passed: true,
            message: `Required field "${field}" is present`,
            severity: 'info',
          });
        }
      }
    }

    // Check property types if properties are defined
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in data) {
          const value = data[key];
          const expectedType = (propSchema as { type?: string }).type;

          if (expectedType) {
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            const typeMatches = actualType === expectedType ||
                               (expectedType === 'object' && value !== null && typeof value === 'object');

            results.push({
              rule: `type:${key}`,
              passed: typeMatches,
              message: typeMatches
                ? `Field "${key}" has correct type`
                : `Field "${key}" expected ${expectedType}, got ${actualType}`,
              severity: typeMatches ? 'info' : 'warning',
            });
          }
        }
      }
    }

    return results;
  }

  private generateMockOutput(step: WorkflowStepDefinition): Record<string, unknown> {
    return {
      success: true,
      mocked: true,
      stepId: step.id,
      timestamp: new Date().toISOString(),
    };
  }

  private generateSyntheticOutput(
    step: WorkflowStepDefinition,
    inputData: Record<string, unknown>
  ): Record<string, unknown> {
    switch (step.type) {
      case 'trigger':
        return {
          eventId: `evt_${Date.now()}`,
          eventType: step.name.toLowerCase().replace(/\s+/g, '_'),
          payload: inputData,
        };
      case 'storage':
        return {
          recordId: `rec_${Date.now()}`,
          created: true,
          updated: false,
        };
      case 'transform':
        return {
          transformedData: inputData,
          extractedItems: [],
        };
      case 'external_call':
        return {
          statusCode: 200,
          response: { success: true },
          success: true,
        };
      case 'notification':
        return {
          sent: true,
          notificationId: `notif_${Date.now()}`,
        };
      default:
        return {
          success: true,
          data: inputData,
        };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Test Engine
// ============================================================================

export interface TestEngineOptions {
  workflow: ProcessMapWorkflow;
  runMode: RunMode;
  testData?: Record<string, unknown>;
  config?: Partial<TestRunConfig>;
  mocks?: ProcessMapMock[];
  events?: Partial<TestEngineEvents>;
}

/**
 * Main test engine that orchestrates workflow test execution
 */
export class ProcessMapTestEngine {
  private workflow: ProcessMapWorkflow;
  private runMode: RunMode;
  private testData: Record<string, unknown>;
  private config: TestRunConfig;
  private mocks: ProcessMapMock[];
  private events: Partial<TestEngineEvents>;
  private executor: StepExecutor;

  constructor(options: TestEngineOptions) {
    this.workflow = options.workflow;
    this.runMode = options.runMode || 'mock'; // Default to 'mock' mode
    this.testData = options.testData || {};
    this.config = {
      timeout: options.config?.timeout ?? 300000, // 5 minutes default
      continueOnFailure: options.config?.continueOnFailure ?? false,
      selectedSteps: options.config?.selectedSteps ?? null,
      stepDelayMs: options.config?.stepDelayMs ?? 200, // Default 200ms delay between steps
    };
    this.mocks = options.mocks || [];
    this.events = options.events || {};
    this.executor = new DefaultStepExecutor();
  }

  /**
   * Run the test and return results
   */
  async run(): Promise<{
    testRun: Omit<ProcessMapTestRun, 'id' | 'createdAt'>;
    stepResults: Omit<ProcessMapStepResult, 'id'>[];
  }> {
    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startedAt = new Date().toISOString();
    const stepResults: Omit<ProcessMapStepResult, 'id'>[] = [];

    // Create execution context
    const context = new ExecutionContext(runId, this.runMode, this.testData);

    // Get execution order (topological sort)
    const executionOrder = this.getExecutionOrder();

    // Filter steps if specific ones are selected
    const stepsToExecute = this.config.selectedSteps
      ? executionOrder.filter(id => this.config.selectedSteps!.includes(id))
      : executionOrder;

    let overallStatus: TestRunStatus = 'running';
    let overallResult: TestRunResult | null = null;
    let errorMessage: string | null = null;
    let errorDetails: Record<string, unknown> | null = null;

    // Execute each step
    for (let i = 0; i < stepsToExecute.length; i++) {
      const stepId = stepsToExecute[i];
      const step = this.workflow.steps.find(s => s.id === stepId);

      if (!step) {
        context.addLog('error', `Step not found: ${stepId}`);
        continue;
      }

      // Emit step start event
      this.events.onStepStart?.(stepId, step.name);

      // Add delay between steps for visual feedback
      if (this.config.stepDelayMs && this.config.stepDelayMs > 0) {
        await this.delay(this.config.stepDelayMs);
      }

      const stepStartedAt = new Date().toISOString();

      // Check if executor can handle this step in current mode
      if (!this.executor.canExecute(step, this.runMode)) {
        const skippedResult: Omit<ProcessMapStepResult, 'id'> = {
          testRunId: runId,
          stepId,
          stepName: step.name,
          sequenceNumber: i + 1,
          startedAt: stepStartedAt,
          completedAt: new Date().toISOString(),
          durationMs: 0,
          status: 'skipped',
          inputData: null,
          outputData: null,
          expectedOutput: null,
          validationResults: [],
          errorMessage: `Step cannot be executed in ${this.runMode} mode`,
          errorDetails: null,
          errorStack: null,
          wasMocked: false,
          mockSource: null,
          logs: [],
        };

        stepResults.push(skippedResult);
        this.events.onStepComplete?.(skippedResult as ProcessMapStepResult);
        continue;
      }

      // Execute the step
      try {
        const result = await this.executeStepWithTimeout(step, context);
        const stepCompletedAt = new Date().toISOString();

        const stepResult: Omit<ProcessMapStepResult, 'id'> = {
          testRunId: runId,
          stepId,
          stepName: step.name,
          sequenceNumber: i + 1,
          startedAt: stepStartedAt,
          completedAt: stepCompletedAt,
          durationMs: new Date(stepCompletedAt).getTime() - new Date(stepStartedAt).getTime(),
          status: result.success ? 'passed' : 'failed',
          inputData: context.resolveInputs(step.dependencies),
          outputData: result.outputData,
          expectedOutput: null, // Could be populated from fixtures
          validationResults: result.validationResults,
          errorMessage: result.error?.message || null,
          errorDetails: result.error ? { name: result.error.name } : null,
          errorStack: result.error?.stack || null,
          wasMocked: result.wasMocked,
          mockSource: result.mockSource || null,
          logs: result.logs,
        };

        stepResults.push(stepResult);
        this.events.onStepComplete?.(stepResult as ProcessMapStepResult);

        // Update context with step output
        if (result.success) {
          context.setStepOutput(stepId, result.outputData);
        }

        // Log progress
        result.logs.forEach(log => this.events.onLog?.(log));

        // Handle failure
        if (!result.success && !this.config.continueOnFailure) {
          overallStatus = 'failed';
          errorMessage = result.error?.message || 'Step execution failed';
          break;
        }
      } catch (error) {
        const err = error as Error;
        this.events.onError?.(err);

        const stepResult: Omit<ProcessMapStepResult, 'id'> = {
          testRunId: runId,
          stepId,
          stepName: step.name,
          sequenceNumber: i + 1,
          startedAt: stepStartedAt,
          completedAt: new Date().toISOString(),
          durationMs: 0,
          status: 'failed',
          inputData: context.resolveInputs(step.dependencies),
          outputData: null,
          expectedOutput: null,
          validationResults: [],
          errorMessage: err.message,
          errorDetails: { name: err.name },
          errorStack: err.stack || null,
          wasMocked: false,
          mockSource: null,
          logs: [],
        };

        stepResults.push(stepResult);
        this.events.onStepComplete?.(stepResult as ProcessMapStepResult);

        if (!this.config.continueOnFailure) {
          overallStatus = 'failed';
          errorMessage = err.message;
          errorDetails = { name: err.name, stack: err.stack };
          break;
        }
      }
    }

    // Calculate final metrics
    const completedAt = new Date().toISOString();
    const stepsPassed = stepResults.filter(r => r.status === 'passed').length;
    const stepsFailed = stepResults.filter(r => r.status === 'failed').length;
    const stepsSkipped = stepResults.filter(r => r.status === 'skipped').length;

    // Determine overall result
    if (overallStatus !== 'failed') {
      if (stepsFailed === 0) {
        overallStatus = 'completed';
        overallResult = 'pass';
      } else if (stepsPassed > 0) {
        overallStatus = 'completed';
        overallResult = 'partial';
      } else {
        overallStatus = 'failed';
        overallResult = 'fail';
      }
    } else {
      overallResult = 'fail';
    }

    const testRun: Omit<ProcessMapTestRun, 'id' | 'createdAt'> = {
      workflowId: this.workflow.id,
      orgId: this.workflow.orgId,
      runMode: this.runMode,
      testData: this.testData,
      runConfig: this.config,
      status: overallStatus,
      startedAt,
      completedAt,
      overallResult,
      durationMs: new Date(completedAt).getTime() - new Date(startedAt).getTime(),
      stepsTotal: stepsToExecute.length,
      stepsPassed,
      stepsFailed,
      stepsSkipped,
      errorMessage,
      errorDetails,
      runBy: null, // Set by the calling code
    };

    return { testRun, stepResults };
  }

  /**
   * Execute a step with timeout handling
   */
  private async executeStepWithTimeout(
    step: WorkflowStepDefinition,
    context: ExecutionContext
  ): Promise<StepExecutionResult> {
    const stepTimeout = step.testConfig.timeout;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Step "${step.name}" timed out after ${stepTimeout}ms`));
      }, stepTimeout);

      this.executor
        .execute(step, context, this.mocks)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Get execution order using topological sort
   */
  private getExecutionOrder(): string[] {
    const steps = this.workflow.steps;
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (stepId: string) => {
      if (visited.has(stepId)) return;
      visited.add(stepId);

      const step = steps.find(s => s.id === stepId);
      if (!step) return;

      // Visit dependencies first
      for (const depId of step.dependencies) {
        visit(depId);
      }

      order.push(stepId);
    };

    // Visit all steps
    for (const step of steps) {
      visit(step.id);
    }

    return order;
  }

  /**
   * Helper method to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Types are exported inline where defined
// Classes (ExecutionContext, DefaultStepExecutor, ProcessMapTestEngine) are exported with their definitions
