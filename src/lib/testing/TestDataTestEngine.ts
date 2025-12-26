/**
 * TestDataTestEngine - Extended test engine for test_data mode
 *
 * Extends ProcessMapTestEngine to support:
 * - Real API calls via IntegrationExecutor
 * - Resource tracking with links to 3rd party apps
 * - AI prompt tracking with links to prompts page
 * - Automatic cleanup after test completion
 */

import {
  ProcessMapWorkflow,
  WorkflowStepDefinition,
  ProcessMapStepResult,
  ProcessMapMock,
  TestRunConfig,
  LogEntry,
  TestEngineEvents,
  TestDataTestRun,
  TestDataModeConfig,
  DEFAULT_TEST_DATA_MODE_CONFIG,
  CleanupResult,
  TrackedResource,
  TrackedAIPrompt,
} from '@/lib/types/processMapTesting';
import {
  ProcessMapTestEngine,
  TestEngineOptions,
  ExecutionContext,
  StepExecutionResult,
} from './ProcessMapTestEngine';
import { ResourceTracker, AIPromptTracker } from './tracking';
import { IntegrationExecutor, IntegrationContext, RawIntegrationOperation } from './integrations';
import { CleanupService, CleanupProgressCallback } from './cleanup';

// ============================================================================
// TestDataTestEngine Types
// ============================================================================

export interface TestDataEngineOptions extends Omit<TestEngineOptions, 'runMode'> {
  /** Test data mode configuration */
  testDataConfig?: Partial<TestDataModeConfig>;
  /** Integration context (portal IDs, workspace names, etc.) */
  integrationContext?: IntegrationContext;
  /** Events specific to test data mode */
  testDataEvents?: TestDataEngineEvents;
}

export interface TestDataEngineEvents extends Partial<TestEngineEvents> {
  /** Called when a resource is created */
  onResourceCreated?: (resource: TrackedResource) => void;
  /** Called when an AI prompt is executed */
  onAIPromptExecuted?: (prompt: TrackedAIPrompt) => void;
  /** Called when cleanup starts */
  onCleanupStart?: (totalResources: number) => void;
  /** Called for each resource cleanup */
  onCleanupProgress?: (
    resource: TrackedResource,
    index: number,
    total: number,
    success: boolean
  ) => void;
  /** Called when cleanup completes */
  onCleanupComplete?: (result: CleanupResult) => void;
}

export interface TestDataRunResult {
  /** Extended test run with tracking data */
  testRun: TestDataTestRun;
  /** Step results */
  stepResults: Omit<ProcessMapStepResult, 'id'>[];
  /** Tracked resources (convenience accessor) */
  trackedResources: TrackedResource[];
  /** Tracked AI prompts (convenience accessor) */
  trackedAIPrompts: TrackedAIPrompt[];
  /** Cleanup result if cleanup was performed */
  cleanupResult: CleanupResult | null;
}

// ============================================================================
// TestDataStepExecutor
// ============================================================================

/**
 * Step executor that uses IntegrationExecutor for real API calls
 */
class TestDataStepExecutor {
  private integrationExecutor: IntegrationExecutor;
  private aiPromptTracker: AIPromptTracker;
  private onResourceCreated?: (resource: TrackedResource) => void;
  private onAIPromptExecuted?: (prompt: TrackedAIPrompt) => void;

  constructor(
    integrationExecutor: IntegrationExecutor,
    aiPromptTracker: AIPromptTracker,
    events?: {
      onResourceCreated?: (resource: TrackedResource) => void;
      onAIPromptExecuted?: (prompt: TrackedAIPrompt) => void;
    }
  ) {
    this.integrationExecutor = integrationExecutor;
    this.aiPromptTracker = aiPromptTracker;
    this.onResourceCreated = events?.onResourceCreated;
    this.onAIPromptExecuted = events?.onAIPromptExecuted;
  }

  canExecute(): boolean {
    // In test_data mode, we can execute all steps
    return true;
  }

  async execute(
    step: WorkflowStepDefinition,
    context: ExecutionContext,
    _mocks: ProcessMapMock[]
  ): Promise<StepExecutionResult> {
    const logs: LogEntry[] = [];

    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `[TestData] Starting step: ${step.name}`,
      data: { stepId: step.id, type: step.type, integration: step.integration },
    });

    // Resolve input data from dependencies
    const inputData = context.resolveInputs(step.dependencies);

    // If step has an integration, execute real API call
    if (step.integration) {
      const integration = step.integration.toLowerCase().replace(/-/g, '_');
      const operations = step.testConfig?.operations || ['read'];
      const operation = operations[0] || 'read';

      // Determine resource type from step type
      const resourceType = this.inferResourceType(step);

      logs.push({
        timestamp: new Date().toISOString(),
        level: 'debug',
        message: `[TestData] Executing ${operation} on ${integration}`,
        data: { resourceType },
      });

      try {
        const result = await this.integrationExecutor.execute(
          integration as Parameters<typeof this.integrationExecutor.execute>[0],
          operation as RawIntegrationOperation,
          resourceType,
          inputData,
          {
            stepId: step.id,
            stepName: step.name,
            runId: context.runId,
            orgId: '', // Will be set from context
          }
        );

        if (result.resource) {
          this.onResourceCreated?.(result.resource);

          logs.push({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: `[TestData] Resource created: ${result.resource.displayName}`,
            data: {
              resourceId: result.resource.id,
              externalId: result.resource.externalId,
              viewUrl: result.resource.viewUrl,
            },
          });
        }

        if (!result.success) {
          return {
            success: false,
            outputData: result.data || {},
            wasMocked: false,
            validationResults: [],
            error: new Error(result.error || 'Integration execution failed'),
            logs,
          };
        }

        return {
          success: true,
          outputData: result.data || {},
          wasMocked: false,
          validationResults: [],
          logs,
        };
      } catch (error) {
        logs.push({
          timestamp: new Date().toISOString(),
          level: 'error',
          message: `[TestData] Error executing integration`,
          data: { error: error instanceof Error ? error.message : 'Unknown error' },
        });

        return {
          success: false,
          outputData: {},
          wasMocked: false,
          validationResults: [],
          error: error instanceof Error ? error : new Error('Unknown error'),
          logs,
        };
      }
    }

    // Track AI prompt if this step uses AI
    if (this.stepUsesAI(step)) {
      const featureKey = this.inferAIFeatureKey(step);

      const prompt = this.aiPromptTracker.addPromptExecution({
        stepId: step.id,
        stepName: step.name,
        featureKey,
        // Token usage and cost would come from actual AI execution
      });

      this.onAIPromptExecuted?.(prompt);

      logs.push({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `[TestData] AI prompt tracked: ${featureKey}`,
        data: { promptId: prompt.id, viewUrl: prompt.promptViewUrl },
      });
    }

    // For non-integration steps, generate synthetic output
    const outputData = this.generateOutput(step, inputData);

    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `[TestData] Step completed`,
      data: { outputKeys: Object.keys(outputData) },
    });

    return {
      success: true,
      outputData,
      wasMocked: false,
      validationResults: [],
      logs,
    };
  }

  private inferResourceType(step: WorkflowStepDefinition): Parameters<typeof this.integrationExecutor.execute>[2] {
    const name = step.name.toLowerCase();

    if (name.includes('contact')) return 'contact';
    if (name.includes('deal')) return 'deal';
    if (name.includes('task')) return 'task';
    if (name.includes('activity')) return 'activity';
    if (name.includes('meeting')) return 'meeting';
    if (name.includes('calendar') || name.includes('event')) return 'calendar_event';
    if (name.includes('email')) return 'email';
    if (name.includes('message') || name.includes('slack')) return 'message';
    if (name.includes('call')) return 'call';
    if (name.includes('booking')) return 'booking';

    return 'record';
  }

  private stepUsesAI(step: WorkflowStepDefinition): boolean {
    const name = step.name.toLowerCase();
    const indicators = ['ai', 'analyze', 'extract', 'summarize', 'insight', 'sentiment', 'classify'];
    return indicators.some(ind => name.includes(ind));
  }

  private inferAIFeatureKey(step: WorkflowStepDefinition): string {
    const name = step.name.toLowerCase();

    if (name.includes('meeting') && name.includes('insight')) return 'meeting_insights';
    if (name.includes('email') && name.includes('analy')) return 'email_analysis';
    if (name.includes('sentiment')) return 'sentiment_analysis';
    if (name.includes('summarize') || name.includes('summary')) return 'content_summary';
    if (name.includes('extract')) return 'data_extraction';
    if (name.includes('classify')) return 'classification';

    return 'ai_processing';
  }

  private generateOutput(
    step: WorkflowStepDefinition,
    inputData: Record<string, unknown>
  ): Record<string, unknown> {
    switch (step.type) {
      case 'trigger':
        return {
          eventId: `evt_${Date.now()}`,
          eventType: step.name.toLowerCase().replace(/\s+/g, '_'),
          payload: inputData,
          timestamp: new Date().toISOString(),
        };
      case 'storage':
        return {
          recordId: `rec_${Date.now()}`,
          created: true,
          timestamp: new Date().toISOString(),
        };
      case 'transform':
        return {
          transformedData: inputData,
          transformedAt: new Date().toISOString(),
        };
      case 'condition':
        return {
          conditionMet: true,
          evaluatedAt: new Date().toISOString(),
        };
      case 'notification':
        return {
          sent: true,
          notificationId: `notif_${Date.now()}`,
          sentAt: new Date().toISOString(),
        };
      default:
        return {
          success: true,
          data: inputData,
          processedAt: new Date().toISOString(),
        };
    }
  }
}

// ============================================================================
// TestDataTestEngine
// ============================================================================

/**
 * Extended test engine for test_data mode
 *
 * Provides:
 * - Real API execution via IntegrationExecutor
 * - Resource tracking with external links
 * - AI prompt tracking
 * - Automatic cleanup after test completion
 */
export class TestDataTestEngine {
  private workflow: ProcessMapWorkflow;
  private testData: Record<string, unknown>;
  private config: TestRunConfig;
  private testDataConfig: TestDataModeConfig;
  private mocks: ProcessMapMock[];
  private events: Partial<TestEngineEvents>;
  private testDataEvents: TestDataEngineEvents;

  private resourceTracker: ResourceTracker;
  private aiPromptTracker: AIPromptTracker;
  private integrationExecutor: IntegrationExecutor;
  private cleanupService: CleanupService;
  private stepExecutor: TestDataStepExecutor;

  constructor(options: TestDataEngineOptions) {
    this.workflow = options.workflow;
    this.testData = options.testData || {};
    this.config = {
      timeout: options.config?.timeout ?? 300000,
      continueOnFailure: options.config?.continueOnFailure ?? false,
      selectedSteps: options.config?.selectedSteps ?? null,
      stepDelayMs: options.config?.stepDelayMs ?? 200,
    };
    this.testDataConfig = { ...DEFAULT_TEST_DATA_MODE_CONFIG, ...options.testDataConfig };
    this.mocks = options.mocks || [];
    this.events = options.events || {};
    this.testDataEvents = options.testDataEvents || {};

    // Initialize trackers
    this.resourceTracker = new ResourceTracker();
    this.aiPromptTracker = new AIPromptTracker();

    // Initialize executor with resource tracker
    this.integrationExecutor = new IntegrationExecutor(this.resourceTracker);
    if (options.integrationContext) {
      this.integrationExecutor.setIntegrationContext(options.integrationContext);
    }

    // Initialize cleanup service
    this.cleanupService = new CleanupService(this.resourceTracker, this.testDataConfig);
    if (options.integrationContext?.orgId) {
      this.cleanupService.setOrgId(options.integrationContext.orgId);
    }

    // Initialize step executor
    this.stepExecutor = new TestDataStepExecutor(
      this.integrationExecutor,
      this.aiPromptTracker,
      {
        onResourceCreated: this.testDataEvents.onResourceCreated,
        onAIPromptExecuted: this.testDataEvents.onAIPromptExecuted,
      }
    );
  }

  /**
   * Run the test with resource tracking and cleanup
   */
  async run(): Promise<TestDataRunResult> {
    const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startedAt = new Date().toISOString();
    const stepResults: Omit<ProcessMapStepResult, 'id'>[] = [];

    // Create execution context
    const context = new ExecutionContext(runId, 'test_data', this.testData);

    // Get execution order
    const executionOrder = this.getExecutionOrder();

    // Filter steps if specific ones are selected
    const stepsToExecute = this.config.selectedSteps
      ? executionOrder.filter(id => this.config.selectedSteps!.includes(id))
      : executionOrder;

    let overallStatus: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' = 'running';
    let overallResult: 'pass' | 'fail' | 'partial' | 'error' | null = null;
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

      try {
        const result = await this.stepExecutor.execute(step, context, this.mocks);
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
          expectedOutput: null,
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

        if (result.success) {
          context.setStepOutput(stepId, result.outputData);
        }

        result.logs.forEach(log => this.events.onLog?.(log));

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

    // Calculate metrics
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

    // Build test run result
    const testRun: TestDataTestRun = {
      id: runId,
      workflowId: this.workflow.id,
      orgId: this.workflow.orgId,
      runMode: 'test_data',
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
      runBy: null,
      createdAt: startedAt,
      // Test data mode specific fields
      trackedResources: this.resourceTracker.getAllResources(),
      trackedAIPrompts: this.aiPromptTracker.getAllPrompts(),
      cleanupResult: null,
      cleanupInitiated: false,
      cleanupInProgress: false,
    };

    // Perform cleanup if auto-cleanup is enabled
    if (this.testDataConfig.autoCleanup) {
      await this.performCleanup(testRun);
    }

    return {
      testRun,
      stepResults,
      trackedResources: testRun.trackedResources,
      trackedAIPrompts: testRun.trackedAIPrompts,
      cleanupResult: testRun.cleanupResult,
    };
  }

  /**
   * Perform cleanup of tracked resources
   */
  async performCleanup(testRun: TestDataTestRun): Promise<CleanupResult> {
    testRun.cleanupInitiated = true;
    testRun.cleanupInProgress = true;

    // Set up progress callback
    this.cleanupService.setProgressCallback({
      onStart: (total) => {
        this.testDataEvents.onCleanupStart?.(total);
      },
      onResourceStart: (resource, index, total) => {
        this.testDataEvents.onCleanupProgress?.(resource, index, total, false);
      },
      onResourceComplete: (resource, success) => {
        const resources = this.resourceTracker.getAllResources();
        const index = resources.findIndex(r => r.id === resource.id);
        this.testDataEvents.onCleanupProgress?.(resource, index, resources.length, success);
      },
      onComplete: (result) => {
        this.testDataEvents.onCleanupComplete?.(result);
      },
    });

    // Wait for configured delay before cleanup
    if (this.testDataConfig.cleanupDelayMs > 0) {
      await this.delay(this.testDataConfig.cleanupDelayMs);
    }

    // Perform cleanup
    const result = await this.cleanupService.cleanupAll();

    testRun.cleanupResult = result;
    testRun.cleanupInProgress = false;

    return result;
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

      for (const depId of step.dependencies) {
        visit(depId);
      }

      order.push(stepId);
    };

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

  /**
   * Get resource tracker for external access
   */
  getResourceTracker(): ResourceTracker {
    return this.resourceTracker;
  }

  /**
   * Get AI prompt tracker for external access
   */
  getAIPromptTracker(): AIPromptTracker {
    return this.aiPromptTracker;
  }

  /**
   * Get cleanup service for manual cleanup
   */
  getCleanupService(): CleanupService {
    return this.cleanupService;
  }
}
