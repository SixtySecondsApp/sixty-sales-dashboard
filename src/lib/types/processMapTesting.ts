/**
 * Process Map Workflow Testing Types
 *
 * Type definitions for the process map testing system that allows
 * testing and validation of integration workflows.
 */

// ============================================================================
// JSON Schema Types
// ============================================================================

export interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  description?: string;
  example?: unknown;
}

// ============================================================================
// Workflow Step Definition
// ============================================================================

export type WorkflowStepType =
  | 'trigger'
  | 'action'
  | 'condition'
  | 'transform'
  | 'external_call'
  | 'storage'
  | 'notification';

export interface WorkflowStepTestConfig {
  /** Whether this step can be mocked */
  mockable: boolean;
  /** Timeout in milliseconds */
  timeout: number;
  /** Number of retries on failure */
  retryCount: number;
  /** Sample data for testing */
  sampleData?: Record<string, unknown>;
  /** Whether this step requires real API calls in production-readonly mode */
  requiresRealApi?: boolean;
  /** Operations this step performs (for determining read-only safety) */
  operations?: ('read' | 'write' | 'delete')[];
}

export interface WorkflowStepDefinition {
  /** Unique identifier for the step */
  id: string;
  /** Human-readable name */
  name: string;
  /** Step type classification */
  type: WorkflowStepType;
  /** Integration this step belongs to (e.g., 'hubspot', 'fathom') */
  integration?: string;
  /** Description of what this step does */
  description?: string;
  /** Expected input schema */
  inputSchema: JSONSchema;
  /** Expected output schema */
  outputSchema: JSONSchema;
  /** IDs of steps this step depends on */
  dependencies: string[];
  /** Test configuration for this step */
  testConfig: WorkflowStepTestConfig;
}

// ============================================================================
// Workflow Connections
// ============================================================================

export interface WorkflowConnection {
  /** Source step ID */
  fromStepId: string;
  /** Target step ID */
  toStepId: string;
  /** Condition for this connection (e.g., 'success', 'failure', expression) */
  condition?: string;
  /** Display label for the connection */
  label?: string;
}

// ============================================================================
// Workflow Configuration
// ============================================================================

export type RunMode = 'schema_validation' | 'mock' | 'production_readonly' | 'test_data';

export interface WorkflowTestConfig {
  /** Default run mode */
  defaultRunMode: RunMode;
  /** Global timeout in milliseconds */
  timeout: number;
  /** Number of retries for failed steps */
  retryCount: number;
  /** Whether to continue testing after a step fails */
  continueOnFailure: boolean;
}

export interface WorkflowMockConfig {
  /** Mock configurations per integration */
  integrations: Record<string, IntegrationMockConfig>;
}

export interface IntegrationMockConfig {
  /** Whether mocking is enabled for this integration */
  enabled: boolean;
  /** Default response delay in milliseconds */
  defaultDelay: number;
  /** Default responses by endpoint */
  responses: Record<string, unknown>;
}

// ============================================================================
// Process Map Workflow
// ============================================================================

export interface ProcessMapWorkflow {
  id: string;
  /** Reference to the source process_maps table record */
  processMapId: string;
  orgId: string;
  /** Parsed workflow steps */
  steps: WorkflowStepDefinition[];
  /** Connections between steps */
  connections: WorkflowConnection[];
  /** Test configuration */
  testConfig: WorkflowTestConfig;
  /** Mock configuration */
  mockConfig: WorkflowMockConfig;
  /** Version number */
  version: number;
  /** Whether this workflow is active */
  isActive: boolean;
  /** When the workflow was parsed */
  parsedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Test Run Types
// ============================================================================

export type TestRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TestRunResult = 'pass' | 'fail' | 'partial' | 'error';

export interface TestRunConfig {
  /** Timeout for the entire run */
  timeout: number;
  /** Continue testing after failures */
  continueOnFailure: boolean;
  /** Specific steps to test (null = all) */
  selectedSteps: string[] | null;
  /** Delay between steps for visual feedback (ms, default: 200) */
  stepDelayMs?: number;
}

export interface ProcessMapTestRun {
  id: string;
  workflowId: string;
  orgId: string;
  /** Run mode for this test */
  runMode: RunMode;
  /** Initial test data provided */
  testData: Record<string, unknown>;
  /** Run configuration */
  runConfig: TestRunConfig;
  /** Current status */
  status: TestRunStatus;
  /** When the run started */
  startedAt: string | null;
  /** When the run completed */
  completedAt: string | null;
  /** Overall result */
  overallResult: TestRunResult | null;
  /** Duration in milliseconds */
  durationMs: number | null;
  /** Total number of steps */
  stepsTotal: number;
  /** Steps that passed */
  stepsPassed: number;
  /** Steps that failed */
  stepsFailed: number;
  /** Steps that were skipped */
  stepsSkipped: number;
  /** Error message if the run failed */
  errorMessage: string | null;
  /** Detailed error information */
  errorDetails: Record<string, unknown> | null;
  /** User who initiated the run */
  runBy: string | null;
  createdAt: string;
}

// ============================================================================
// Step Result Types
// ============================================================================

export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'warning';

export interface ValidationResult {
  /** Rule that was checked */
  rule: string;
  /** Whether the rule passed */
  passed: boolean;
  /** Description of the result */
  message: string;
  /** Severity if failed */
  severity: 'error' | 'warning' | 'info';
}

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

export interface ProcessMapStepResult {
  id: string;
  testRunId: string;
  stepId: string;
  stepName: string;
  /** Order in which this step was executed */
  sequenceNumber: number;
  /** When step execution started */
  startedAt: string | null;
  /** When step execution completed */
  completedAt: string | null;
  /** Duration in milliseconds */
  durationMs: number | null;
  /** Step status */
  status: StepStatus;
  /** Data passed into the step */
  inputData: Record<string, unknown> | null;
  /** Data produced by the step */
  outputData: Record<string, unknown> | null;
  /** Expected output (for validation) */
  expectedOutput: Record<string, unknown> | null;
  /** Validation check results */
  validationResults: ValidationResult[];
  /** Error message if step failed */
  errorMessage: string | null;
  /** Detailed error information */
  errorDetails: Record<string, unknown> | null;
  /** Error stack trace */
  errorStack: string | null;
  /** Whether the step used a mock */
  wasMocked: boolean;
  /** Source of the mock used */
  mockSource: string | null;
  /** Logs captured during execution */
  logs: LogEntry[];
}

// ============================================================================
// Fixture Types
// ============================================================================

export type FixtureType =
  | 'trigger_data'
  | 'step_input'
  | 'step_output'
  | 'full_scenario'
  | 'integration_response';

export interface ProcessMapFixture {
  id: string;
  workflowId: string | null;
  orgId: string;
  name: string;
  description: string | null;
  fixtureType: FixtureType;
  data: Record<string, unknown>;
  targetStepId: string | null;
  targetIntegration: string | null;
  isDefault: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Mock Configuration Types
// ============================================================================

export type MockType = 'success' | 'error' | 'timeout' | 'rate_limit' | 'auth_failure' | 'custom';

export interface MatchConditions {
  method?: string;
  pathPattern?: string;
  bodyContains?: Record<string, unknown>;
}

export interface ProcessMapMock {
  id: string;
  workflowId: string | null;
  orgId: string;
  integration: string;
  endpoint: string | null;
  mockType: MockType;
  responseData: Record<string, unknown> | null;
  errorResponse: Record<string, unknown> | null;
  delayMs: number;
  matchConditions: MatchConditions | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Test Engine Types
// ============================================================================

export interface TestEngineOptions {
  workflow: ProcessMapWorkflow;
  runMode: RunMode;
  testData?: Record<string, unknown>;
  config?: Partial<TestRunConfig>;
  mocks?: ProcessMapMock[];
}

export interface TestEngineEvents {
  onStepStart: (stepId: string, stepName: string) => void;
  onStepComplete: (result: ProcessMapStepResult) => void;
  onRunComplete: (run: ProcessMapTestRun) => void;
  onLog: (entry: LogEntry) => void;
  onError: (error: Error) => void;
}

export interface ExecutionContext {
  /** Current run ID */
  runId: string;
  /** Run mode */
  runMode: RunMode;
  /** Initial test data */
  initialData: Record<string, unknown>;
  /** Outputs from completed steps */
  stepOutputs: Map<string, Record<string, unknown>>;
  /** Get output from a specific step */
  getStepOutput: (stepId: string) => Record<string, unknown> | undefined;
  /** Set output for a step */
  setStepOutput: (stepId: string, output: Record<string, unknown>) => void;
  /** Resolve inputs from dependencies */
  resolveInputs: (dependencies: string[]) => Record<string, unknown>;
}

// ============================================================================
// UI Component Props Types
// ============================================================================

export interface WorkflowTestPanelProps {
  processMapId: string;
  processMapTitle: string;
  mermaidCode: string;
  onClose: () => void;
}

export interface TestStepProgressProps {
  steps: WorkflowStepDefinition[];
  results: ProcessMapStepResult[];
  currentStepId?: string;
  isRunning: boolean;
}

export interface MermaidHighlightProps {
  highlightedStepId?: string;
  stepStatuses: Map<string, StepStatus>;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ParseProcessMapRequest {
  processMapId: string;
}

export interface ParseProcessMapResponse {
  workflow: ProcessMapWorkflow;
  message: string;
}

export interface RunTestRequest {
  workflowId: string;
  runMode: RunMode;
  testData?: Record<string, unknown>;
  config?: Partial<TestRunConfig>;
}

export interface RunTestResponse {
  testRun: ProcessMapTestRun;
  stepResults: ProcessMapStepResult[];
  message: string;
}

export interface ListTestRunsRequest {
  workflowId: string;
  limit?: number;
  offset?: number;
}

export interface ListTestRunsResponse {
  testRuns: ProcessMapTestRun[];
  total: number;
}

// ============================================================================
// Process Structure Types (Two-Phase Generation)
// ============================================================================

/**
 * ProcessStructure - The "source of truth" for process map content.
 * Generated by Claude Opus in Phase 1, consumed by Haiku for Mermaid rendering
 * and by the testing system for step definitions.
 */
export interface ProcessStructure {
  /** Schema version for forward compatibility */
  schemaVersion: '1.0';
  /** Process metadata */
  metadata: ProcessStructureMetadata;
  /** Subgraphs/sections that organize nodes */
  subgraphs: ProcessSubgraph[];
  /** All nodes in the process (ordered by execution flow) */
  nodes: ProcessNode[];
  /** Connections between nodes */
  connections: ProcessConnection[];
  /** Styling metadata for consistent rendering */
  styling: ProcessStyling;
}

export interface ProcessStructureMetadata {
  processType: 'integration' | 'workflow';
  processName: string;
  title: string;
  description: string;
  generatedAt: string;
  modelUsed: string;
}

export interface ProcessSubgraph {
  /** Unique ID for the subgraph (PascalCase, e.g., "Setup", "Processing") */
  id: string;
  /** Display label with emoji (e.g., "🛠️ CONFIGURATION & AUTH") */
  label: string;
  /** Node IDs that belong to this subgraph */
  nodeIds: string[];
  /** Order within the diagram (0-indexed) */
  order: number;
}

export interface ProcessNode {
  /** Unique ID (PascalCase, e.g., "OAuthGrant", "ContactSync") */
  id: string;
  /** Human-readable label (2-4 words max) */
  label: string;
  /** Node shape type - determines Mermaid syntax */
  shape: ProcessNodeShape;
  /** Which subgraph this node belongs to */
  subgraphId: string;
  /** Execution order (1-indexed) */
  executionOrder: number;
  /** Step type for testing system */
  stepType: WorkflowStepType;
  /** Integration this step belongs to (optional) */
  integration?: string;
  /** Description for testing/documentation */
  description?: string;
  /** Test configuration hints */
  testConfig?: ProcessNodeTestConfig;
}

export type ProcessNodeShape =
  | 'terminal'    // ((Label)) - Start/End nodes
  | 'process'     // [Label] - Standard process steps
  | 'storage'     // [(Label)] - Database/Storage
  | 'decision'    // {Label} - Decision/Gateway
  | 'subroutine'  // [[Label]] - Edge Functions
  | 'async';      // >Label] - Webhooks/Async

export interface ProcessNodeTestConfig {
  /** Whether this step can be mocked */
  mockable: boolean;
  /** Whether this step requires real API calls */
  requiresRealApi?: boolean;
  /** Operations this step performs */
  operations?: ('read' | 'write' | 'delete')[];
}

export interface ProcessConnection {
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Connection style */
  style: 'normal' | 'critical' | 'optional';
  /** Edge label (optional, e.g., "Yes", "No", "Success") */
  label?: string;
}

export interface ProcessStyling {
  /** Node IDs grouped by styling class */
  nodeClasses: {
    terminal: string[];
    storage: string[];
    logic: string[];
    async: string[];
    primary: string[];
  };
}

// ============================================================================
// Process Map Record (Updated with process_structure)
// ============================================================================

export interface ProcessMapRecord {
  id: string;
  org_id: string;
  process_type: 'integration' | 'workflow';
  process_name: string;
  title: string;
  description: string | null;
  /** Structured JSON - source of truth for content */
  process_structure: ProcessStructure | null;
  /** Legacy Mermaid code (fallback) */
  mermaid_code: string | null;
  /** Horizontal (LR) Mermaid code for card thumbnails */
  mermaid_code_horizontal: string | null;
  /** Vertical (TB) Mermaid code for modal/detail view */
  mermaid_code_vertical: string | null;
  /** Generation status */
  generation_status: 'pending' | 'structure_ready' | 'partial' | 'complete';
  generated_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Auto-Generated Test Scenario Types
// ============================================================================

/**
 * Scenario Type Classification
 * - happy_path: Main success flow through the diagram
 * - branch_path: Alternative route through decision points
 * - failure_mode: Integration failure simulation (timeout, auth, rate limit, etc.)
 */
export type ScenarioType = 'happy_path' | 'branch_path' | 'failure_mode';

/**
 * Result expectation for scenario execution
 */
export type ExpectedScenarioResult = 'pass' | 'fail';

/**
 * Mock override for a specific scenario
 * Allows forcing specific mock behavior for testing failure modes
 */
export interface ScenarioMockOverride {
  /** Integration to override (e.g., 'hubspot', 'fathom') */
  integration: string;
  /** Optional specific step to apply override to */
  stepId?: string;
  /** Type of mock response to return */
  mockType: MockType;
  /** Priority for this override (higher = takes precedence) */
  priority: number;
  /** Custom error response data */
  errorResponse?: Record<string, unknown>;
  /** Simulated delay in ms */
  delayMs?: number;
}

/**
 * Decision point encountered along a path
 * Tracks the condition evaluated and which branch was taken
 */
export interface DecisionPoint {
  /** Node ID of the decision node */
  nodeId: string;
  /** Condition label (e.g., "Yes", "No", "Success", "Error") */
  condition: string;
  /** The node ID this decision leads to */
  nextNodeId: string;
}

/**
 * Path through the workflow diagram
 * Represents a unique route from entry to exit
 */
export interface ScenarioPath {
  /** Ordered list of step IDs in execution sequence */
  stepIds: string[];
  /** Decision points along this path */
  decisions: DecisionPoint[];
  /** Total number of steps in this path */
  totalSteps: number;
  /** Hash of step IDs for deduplication */
  pathHash: string;
}

/**
 * Generated Test Scenario
 * Auto-created from ProcessStructure analysis
 */
export interface GeneratedTestScenario {
  /** Unique scenario ID */
  id: string;
  /** Reference to workflow/process map */
  workflowId: string;
  /** Organization ID */
  orgId: string;
  /** Human-readable scenario name */
  name: string;
  /** Description of what this scenario tests */
  description: string;
  /** Classification of scenario type */
  scenarioType: ScenarioType;
  /** The path this scenario follows */
  path: ScenarioPath;
  /** Mock overrides to apply for this scenario */
  mockOverrides: ScenarioMockOverride[];
  /** Expected result (pass for happy/branch paths, fail for failure modes) */
  expectedResult: ExpectedScenarioResult;
  /** If expectedResult is 'fail', which step should fail */
  expectedFailureStep?: string;
  /** If expectedResult is 'fail', what type of failure */
  expectedFailureType?: MockType;
  /** Priority for test execution order (lower = higher priority) */
  priority: number;
  /** Tags for filtering/grouping scenarios */
  tags: string[];
  /** When this scenario was generated */
  generatedAt: string;
  /** Last run result and timestamp */
  lastRunResult?: {
    result: TestRunResult;
    runAt: string;
    durationMs: number;
  };
}

/**
 * Uncovered path information
 * Helps identify gaps in test coverage
 */
export interface UncoveredPath {
  /** The path that isn't covered */
  path: ScenarioPath;
  /** Why this path isn't covered */
  reason: string;
  /** Suggested scenario to cover this path */
  suggestedScenario?: Partial<GeneratedTestScenario>;
}

/**
 * Failure mode coverage tracking
 * Shows which failure modes have been tested per integration
 */
export type FailureModeCoverage = Record<string, MockType[]>;

/**
 * Comprehensive Test Coverage Metrics
 * Provides visibility into what's tested vs. what's not
 */
export interface TestCoverage {
  /** Total unique paths through the diagram */
  totalPaths: number;
  /** Paths that have been tested */
  coveredPaths: number;
  /** Path coverage percentage (0-100) */
  pathCoveragePercent: number;
  /** Total decision branches */
  totalBranches: number;
  /** Branches that have been exercised */
  coveredBranches: number;
  /** Branch coverage percentage (0-100) */
  branchCoveragePercent: number;
  /** Failure modes tested per integration */
  failureModeCoverage: FailureModeCoverage;
  /** Integrations with full failure mode coverage */
  integrationsWithFullCoverage: string[];
  /** Integrations missing some failure mode tests */
  integrationsWithPartialCoverage: string[];
  /** Paths that haven't been tested */
  uncoveredPaths: UncoveredPath[];
  /** Overall coverage score (0-100) */
  overallScore: number;
  /** When coverage was last calculated */
  calculatedAt: string;
}

/**
 * Scenario execution result
 * Extended from ProcessMapTestRun with scenario-specific data
 */
export interface ScenarioTestResult {
  /** The scenario that was executed */
  scenarioId: string;
  /** Test run data */
  testRun: ProcessMapTestRun;
  /** Step results */
  stepResults: ProcessMapStepResult[];
  /** Whether the actual result matched expected */
  matchedExpectation: boolean;
  /** If not matched, details about the mismatch */
  mismatchDetails?: string;
  /** Execution timestamp */
  executedAt: string;
}

/**
 * Batch scenario run result
 * Results from running multiple scenarios at once
 */
export interface ScenarioBatchResult {
  /** Total scenarios executed */
  totalScenarios: number;
  /** Scenarios that matched expectations */
  passed: number;
  /** Scenarios that didn't match expectations */
  failed: number;
  /** Scenarios that couldn't be executed */
  errors: number;
  /** Individual scenario results */
  results: ScenarioTestResult[];
  /** Total execution time in ms */
  totalDurationMs: number;
  /** When batch was executed */
  executedAt: string;
}

// ============================================================================
// Test Data Mode Types
// ============================================================================

/**
 * Integrations that support test data mode
 * Each integration has different capabilities for create/read/update/delete
 */
export type TestableIntegration =
  | 'hubspot'
  | 'fathom'
  | 'google_calendar'
  | 'google_email'
  | 'slack'
  | 'justcall'
  | 'savvycal'
  | 'meetingbaas'
  | 'supabase';

/**
 * Types of resources that can be created during test data mode
 */
export type ResourceType =
  | 'contact'
  | 'deal'
  | 'task'
  | 'activity'
  | 'meeting'
  | 'calendar_event'
  | 'email'
  | 'message'
  | 'call'
  | 'booking'
  | 'record';

/**
 * Cleanup status for a tracked resource
 */
export type CleanupStatus = 'pending' | 'success' | 'failed' | 'skipped' | 'not_supported';

/**
 * Tracked resource created during test data mode
 * Used for displaying links to 3rd party apps and for cleanup
 */
export interface TrackedResource {
  /** Unique ID for tracking */
  id: string;
  /** Integration that created this resource */
  integration: TestableIntegration;
  /** Type of resource created */
  resourceType: ResourceType;
  /** Human-readable name/description */
  displayName: string;
  /** External ID in the 3rd party system (e.g., HubSpot contact ID) */
  externalId: string | null;
  /** URL to view this resource in the 3rd party app */
  viewUrl: string | null;
  /** Step ID that created this resource */
  createdByStepId: string;
  /** Step name that created this resource */
  createdByStepName: string;
  /** When the resource was created */
  createdAt: string;
  /** Cleanup status */
  cleanupStatus: CleanupStatus;
  /** Error message if cleanup failed */
  cleanupError: string | null;
  /** When cleanup was attempted */
  cleanupAttemptedAt: string | null;
  /** Raw data returned from creation (for debugging) */
  rawData?: Record<string, unknown>;
}

/**
 * Tracked AI prompt used during test execution
 * Links to the AI prompts page for reference
 */
export interface TrackedAIPrompt {
  /** Unique ID for tracking */
  id: string;
  /** Step ID that used this prompt */
  stepId: string;
  /** Step name for display */
  stepName: string;
  /** Feature key for the AI prompt (e.g., 'meeting_insights', 'email_analysis') */
  featureKey: string;
  /** Template ID if using a saved template */
  templateId: string | null;
  /** URL to view/edit this prompt in the AI prompts settings page */
  promptViewUrl: string;
  /** Token usage for this prompt execution */
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  /** Cost in cents for this execution */
  costCents?: number;
  /** Model used (e.g., 'gpt-4', 'claude-3-opus') */
  modelUsed?: string;
  /** When the prompt was executed */
  executedAt: string;
  /** Duration of the AI call in ms */
  durationMs?: number;
}

/**
 * Result of cleanup operation
 */
export interface CleanupResult {
  /** Whether cleanup was successful overall */
  success: boolean;
  /** Total resources to clean up */
  totalResources: number;
  /** Successfully cleaned up resources */
  successCount: number;
  /** Failed cleanup attempts */
  failedCount: number;
  /** Skipped resources (e.g., read-only integrations) */
  skippedCount: number;
  /** Resources that failed cleanup with details */
  failedResources: Array<{
    resource: TrackedResource;
    error: string;
  }>;
  /** Manual cleanup instructions for resources that couldn't be auto-cleaned */
  manualCleanupInstructions: string[];
  /** Total cleanup duration in ms */
  durationMs: number;
  /** When cleanup started */
  startedAt: string;
  /** When cleanup completed */
  completedAt: string;
}

/**
 * Extended test run for test_data mode
 * Includes resource tracking and cleanup information
 */
export interface TestDataTestRun extends ProcessMapTestRun {
  /** Resources created during this test run */
  trackedResources: TrackedResource[];
  /** AI prompts used during this test run */
  trackedAIPrompts: TrackedAIPrompt[];
  /** Cleanup result (populated after cleanup completes) */
  cleanupResult: CleanupResult | null;
  /** Whether cleanup has been initiated */
  cleanupInitiated: boolean;
  /** Whether cleanup is in progress */
  cleanupInProgress: boolean;
}

/**
 * Integration capability definition
 * Defines what operations each integration supports
 */
export interface IntegrationCapability {
  /** Integration identifier */
  integration: TestableIntegration;
  /** Human-readable display name */
  displayName: string;
  /** Whether this integration supports creation of test data */
  supportsCreate: boolean;
  /** Whether this integration supports reading data */
  supportsRead: boolean;
  /** Whether this integration supports updating data */
  supportsUpdate: boolean;
  /** Whether this integration supports deleting data (cleanup) */
  supportsDelete: boolean;
  /** Resource types this integration can create */
  resourceTypes: ResourceType[];
  /** Pattern for generating view URLs (with {id} placeholder) */
  viewUrlPattern: string | null;
  /** Edge function to call for delete operations */
  deleteEndpoint: string | null;
  /** Notes about this integration's capabilities */
  notes?: string;
}

/**
 * Configuration for test data mode execution
 */
export interface TestDataModeConfig {
  /** Whether to automatically clean up after test completion */
  autoCleanup: boolean;
  /** Delay in ms before starting cleanup (allows viewing results) */
  cleanupDelayMs: number;
  /** Whether to continue cleanup after individual failures */
  continueCleanupOnFailure: boolean;
  /** Whether to show real-time resource tracking */
  showResourceTracking: boolean;
  /** Whether to track AI prompt usage */
  trackAIPrompts: boolean;
}

/**
 * Default test data mode configuration
 */
export const DEFAULT_TEST_DATA_MODE_CONFIG: TestDataModeConfig = {
  autoCleanup: true,
  cleanupDelayMs: 3000,
  continueCleanupOnFailure: true,
  showResourceTracking: true,
  trackAIPrompts: true,
};
