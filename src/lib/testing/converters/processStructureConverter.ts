/**
 * Process Structure to ProcessMapWorkflow Converter
 *
 * Bridges the ProcessStructure (from Opus Phase 1 generation) to
 * ProcessMapWorkflow (test engine input format).
 */

import type {
  ProcessStructure,
  ProcessNode,
  ProcessConnection,
  ProcessMapWorkflow,
  WorkflowStepDefinition,
  WorkflowConnection,
  WorkflowTestConfig,
  WorkflowMockConfig,
  WorkflowStepTestConfig,
  JSONSchema,
  WorkflowStepType,
} from '@/lib/types/processMapTesting';

// ============================================================================
// Schema Templates by Integration
// ============================================================================

/**
 * Default schemas for common integrations
 */
const INTEGRATION_SCHEMAS: Record<string, { input: JSONSchema; output: JSONSchema }> = {
  hubspot: {
    input: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'HubSpot contact ID' },
        dealId: { type: 'string', description: 'HubSpot deal ID' },
        properties: { type: 'object', description: 'Contact/deal properties' },
      },
    },
    output: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Created/updated record ID' },
        properties: { type: 'object', description: 'Record properties' },
        success: { type: 'boolean' },
      },
    },
  },
  fathom: {
    input: {
      type: 'object',
      properties: {
        meetingId: { type: 'string', description: 'Fathom meeting ID' },
        recordingUrl: { type: 'string', description: 'Recording URL' },
      },
    },
    output: {
      type: 'object',
      properties: {
        transcript: { type: 'string', description: 'Meeting transcript' },
        summary: { type: 'string', description: 'AI-generated summary' },
        actionItems: { type: 'array', items: { type: 'object' } },
        duration: { type: 'number', description: 'Meeting duration in seconds' },
      },
    },
  },
  google: {
    input: {
      type: 'object',
      properties: {
        eventId: { type: 'string', description: 'Calendar event ID' },
        messageId: { type: 'string', description: 'Gmail message ID' },
        calendarId: { type: 'string', description: 'Calendar ID' },
      },
    },
    output: {
      type: 'object',
      properties: {
        events: { type: 'array', items: { type: 'object' } },
        messages: { type: 'array', items: { type: 'object' } },
        attendees: { type: 'array', items: { type: 'object' } },
      },
    },
  },
  slack: {
    input: {
      type: 'object',
      properties: {
        channelId: { type: 'string', description: 'Slack channel ID' },
        message: { type: 'string', description: 'Message content' },
        blocks: { type: 'array', description: 'Block Kit blocks' },
      },
    },
    output: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'Posted message ID' },
        timestamp: { type: 'string', description: 'Message timestamp' },
        success: { type: 'boolean' },
      },
    },
  },
  justcall: {
    input: {
      type: 'object',
      properties: {
        callId: { type: 'string', description: 'JustCall call ID' },
        phoneNumber: { type: 'string', description: 'Phone number' },
      },
    },
    output: {
      type: 'object',
      properties: {
        recording_url: { type: 'string', description: 'Call recording URL' },
        transcript: { type: 'string', description: 'Call transcript' },
        duration: { type: 'number', description: 'Call duration in seconds' },
        direction: { type: 'string', description: 'inbound or outbound' },
      },
    },
  },
  savvycal: {
    input: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', description: 'SavvyCal booking ID' },
        linkSlug: { type: 'string', description: 'Scheduling link slug' },
      },
    },
    output: {
      type: 'object',
      properties: {
        booking: { type: 'object', description: 'Booking details' },
        attendee: { type: 'object', description: 'Attendee information' },
        scheduledTime: { type: 'string', description: 'Scheduled time ISO' },
      },
    },
  },
  supabase: {
    input: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Table name' },
        data: { type: 'object', description: 'Row data' },
        filters: { type: 'object', description: 'Query filters' },
      },
    },
    output: {
      type: 'object',
      properties: {
        data: { type: 'array', description: 'Query results' },
        count: { type: 'number', description: 'Total count' },
        error: { type: 'null', description: 'Error or null' },
      },
    },
  },
};

/**
 * Default schemas by step type
 */
const STEP_TYPE_SCHEMAS: Record<WorkflowStepType, { input: JSONSchema; output: JSONSchema }> = {
  trigger: {
    input: {
      type: 'object',
      properties: {
        eventType: { type: 'string', description: 'Trigger event type' },
        payload: { type: 'object', description: 'Event payload' },
      },
    },
    output: {
      type: 'object',
      properties: {
        triggered: { type: 'boolean' },
        eventData: { type: 'object' },
      },
    },
  },
  action: {
    input: {
      type: 'object',
      properties: {
        actionType: { type: 'string' },
        parameters: { type: 'object' },
      },
    },
    output: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        result: { type: 'object' },
      },
    },
  },
  condition: {
    input: {
      type: 'object',
      properties: {
        value: { type: 'string', description: 'Value to evaluate' },
        condition: { type: 'string', description: 'Condition expression' },
      },
    },
    output: {
      type: 'object',
      properties: {
        result: { type: 'boolean', description: 'Condition result' },
        branch: { type: 'string', description: 'Selected branch' },
      },
    },
  },
  transform: {
    input: {
      type: 'object',
      properties: {
        sourceData: { type: 'object', description: 'Data to transform' },
        mapping: { type: 'object', description: 'Field mappings' },
      },
    },
    output: {
      type: 'object',
      properties: {
        transformedData: { type: 'object', description: 'Transformed data' },
      },
    },
  },
  external_call: {
    input: {
      type: 'object',
      properties: {
        endpoint: { type: 'string', description: 'API endpoint' },
        method: { type: 'string', description: 'HTTP method' },
        body: { type: 'object', description: 'Request body' },
      },
    },
    output: {
      type: 'object',
      properties: {
        status: { type: 'number', description: 'HTTP status code' },
        data: { type: 'object', description: 'Response data' },
        headers: { type: 'object', description: 'Response headers' },
      },
    },
  },
  storage: {
    input: {
      type: 'object',
      properties: {
        operation: { type: 'string', description: 'read, write, or delete' },
        table: { type: 'string', description: 'Table/collection name' },
        data: { type: 'object', description: 'Data to store' },
      },
    },
    output: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object', description: 'Stored/retrieved data' },
        affectedRows: { type: 'number' },
      },
    },
  },
  notification: {
    input: {
      type: 'object',
      properties: {
        channel: { type: 'string', description: 'Notification channel' },
        message: { type: 'string', description: 'Notification message' },
        recipients: { type: 'array', items: { type: 'string' } },
      },
    },
    output: {
      type: 'object',
      properties: {
        sent: { type: 'boolean' },
        messageId: { type: 'string' },
        deliveredTo: { type: 'number' },
      },
    },
  },
};

// ============================================================================
// Converter Functions
// ============================================================================

/**
 * Get schema for a step based on integration and step type
 */
function getSchemas(
  integration: string | undefined,
  stepType: WorkflowStepType
): { inputSchema: JSONSchema; outputSchema: JSONSchema } {
  // Prefer integration-specific schemas
  if (integration && INTEGRATION_SCHEMAS[integration.toLowerCase()]) {
    const schemas = INTEGRATION_SCHEMAS[integration.toLowerCase()];
    return { inputSchema: schemas.input, outputSchema: schemas.output };
  }

  // Fall back to step type schemas
  const schemas = STEP_TYPE_SCHEMAS[stepType];
  return { inputSchema: schemas.input, outputSchema: schemas.output };
}

/**
 * Build dependencies array from connections
 * A step depends on all steps that have connections pointing TO it
 */
function buildDependencies(
  nodeId: string,
  connections: ProcessConnection[]
): string[] {
  return connections
    .filter((conn) => conn.to === nodeId)
    .map((conn) => conn.from);
}

/**
 * Convert ProcessNodeTestConfig to WorkflowStepTestConfig
 */
function convertTestConfig(
  nodeTestConfig: ProcessNode['testConfig'],
  stepType: WorkflowStepType
): WorkflowStepTestConfig {
  // Defaults based on step type
  const defaults: WorkflowStepTestConfig = {
    mockable: true,
    timeout: 5000,
    retryCount: 1,
    requiresRealApi: false,
    operations: ['read'],
  };

  // Step type specific defaults
  if (stepType === 'external_call') {
    defaults.timeout = 10000;
    defaults.retryCount = 2;
  } else if (stepType === 'storage') {
    defaults.operations = ['read', 'write'];
  } else if (stepType === 'notification') {
    defaults.timeout = 3000;
    defaults.operations = ['write'];
  }

  // Merge with node-specific config
  if (nodeTestConfig) {
    return {
      ...defaults,
      mockable: nodeTestConfig.mockable ?? defaults.mockable,
      requiresRealApi: nodeTestConfig.requiresRealApi ?? defaults.requiresRealApi,
      operations: nodeTestConfig.operations ?? defaults.operations,
    };
  }

  return defaults;
}

/**
 * Convert a ProcessNode to WorkflowStepDefinition
 */
function convertNode(
  node: ProcessNode,
  connections: ProcessConnection[]
): WorkflowStepDefinition {
  const { inputSchema, outputSchema } = getSchemas(node.integration, node.stepType);

  return {
    id: node.id,
    name: node.label,
    type: node.stepType,
    integration: node.integration,
    description: node.description,
    inputSchema,
    outputSchema,
    dependencies: buildDependencies(node.id, connections),
    testConfig: convertTestConfig(node.testConfig, node.stepType),
  };
}

/**
 * Convert ProcessConnection to WorkflowConnection
 */
function convertConnection(conn: ProcessConnection): WorkflowConnection {
  // Map style to condition string
  let condition: string | undefined;
  if (conn.style === 'optional') {
    condition = 'optional';
  } else if (conn.style === 'critical') {
    condition = 'required';
  }

  return {
    fromStepId: conn.from,
    toStepId: conn.to,
    condition: conn.label || condition,
    label: conn.label,
  };
}

/**
 * Create default test configuration
 */
function createDefaultTestConfig(): WorkflowTestConfig {
  return {
    defaultRunMode: 'mock',
    timeout: 30000,
    retryCount: 1,
    continueOnFailure: true,
  };
}

/**
 * Create mock configuration based on integrations used in the workflow
 */
function createMockConfig(nodes: ProcessNode[]): WorkflowMockConfig {
  // Collect unique integrations
  const integrations = new Set<string>();
  for (const node of nodes) {
    if (node.integration) {
      integrations.add(node.integration.toLowerCase());
    }
  }

  // Create config for each integration
  const integrationConfigs: Record<string, { enabled: boolean; defaultDelay: number; responses: Record<string, unknown> }> = {};

  for (const integration of integrations) {
    integrationConfigs[integration] = {
      enabled: true,
      defaultDelay: 100, // 100ms default delay
      responses: {}, // Will be populated by MockRegistry
    };
  }

  return { integrations: integrationConfigs };
}

// ============================================================================
// Main Converter
// ============================================================================

export interface ConvertOptions {
  /** Process map ID (from database) */
  processMapId: string;
  /** Organization ID */
  orgId: string;
  /** Override default test config */
  testConfigOverrides?: Partial<WorkflowTestConfig>;
}

/**
 * Convert a ProcessStructure to a ProcessMapWorkflow
 *
 * @param processStructure - The source structure from Opus generation
 * @param options - Conversion options
 * @returns A ProcessMapWorkflow ready for the test engine
 */
export function convertProcessStructureToWorkflow(
  processStructure: ProcessStructure,
  options: ConvertOptions
): ProcessMapWorkflow {
  const { processMapId, orgId, testConfigOverrides } = options;
  const now = new Date().toISOString();

  // Convert nodes to steps (sorted by execution order)
  const sortedNodes = [...processStructure.nodes].sort(
    (a, b) => a.executionOrder - b.executionOrder
  );

  const steps: WorkflowStepDefinition[] = sortedNodes.map((node) =>
    convertNode(node, processStructure.connections)
  );

  // Convert connections
  const connections: WorkflowConnection[] = processStructure.connections.map(
    convertConnection
  );

  // Create test and mock configurations
  const testConfig: WorkflowTestConfig = {
    ...createDefaultTestConfig(),
    ...testConfigOverrides,
  };
  const mockConfig = createMockConfig(processStructure.nodes);

  // Generate workflow ID from process map ID
  const workflowId = `workflow_${processMapId}`;

  return {
    id: workflowId,
    processMapId,
    orgId,
    steps,
    connections,
    testConfig,
    mockConfig,
    version: 1,
    isActive: true,
    parsedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Extract integration list from a ProcessStructure
 * Useful for pre-loading mocks
 */
export function extractIntegrations(processStructure: ProcessStructure): string[] {
  const integrations = new Set<string>();
  for (const node of processStructure.nodes) {
    if (node.integration) {
      integrations.add(node.integration.toLowerCase());
    }
  }
  return Array.from(integrations);
}

/**
 * Get execution order as a flat array of step IDs
 * Based on topological sort from dependencies
 */
export function getExecutionOrder(processStructure: ProcessStructure): string[] {
  return [...processStructure.nodes]
    .sort((a, b) => a.executionOrder - b.executionOrder)
    .map((node) => node.id);
}

/**
 * Validate a ProcessStructure has required fields
 */
export function validateProcessStructure(
  structure: unknown
): structure is ProcessStructure {
  if (!structure || typeof structure !== 'object') return false;

  const ps = structure as Partial<ProcessStructure>;

  if (ps.schemaVersion !== '1.0') return false;
  if (!ps.metadata || typeof ps.metadata !== 'object') return false;
  if (!Array.isArray(ps.nodes) || ps.nodes.length === 0) return false;
  if (!Array.isArray(ps.connections)) return false;
  if (!Array.isArray(ps.subgraphs)) return false;

  // Validate each node has required fields
  for (const node of ps.nodes) {
    if (!node.id || !node.label || !node.stepType) {
      return false;
    }
  }

  return true;
}
