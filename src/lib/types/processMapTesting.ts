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

export type RunMode = 'schema_validation' | 'mock' | 'production_readonly';

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
