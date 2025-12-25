/**
 * Workflow Parser
 *
 * Parses PROCESS_DESCRIPTIONS text and Mermaid diagram code into
 * executable workflow definitions for testing.
 */

import type {
  WorkflowStepDefinition,
  WorkflowStepType,
  WorkflowConnection,
  ProcessMapWorkflow,
  WorkflowTestConfig,
  WorkflowMockConfig,
  JSONSchema,
} from '@/lib/types/processMapTesting';

// ============================================================================
// Constants
// ============================================================================

/** Default timeout per step in milliseconds */
const DEFAULT_STEP_TIMEOUT = 30000;

/** Default retry count for failed steps */
const DEFAULT_RETRY_COUNT = 2;

/** Integration name patterns */
const INTEGRATION_PATTERNS: Record<string, RegExp> = {
  hubspot: /hubspot|deal|contact|crm|pipeline/i,
  fathom: /fathom|transcript|recording|meeting|video/i,
  google: /google|gmail|calendar|drive|workspace/i,
  slack: /slack|channel|notification|bot/i,
  justcall: /justcall|call|phone/i,
  savvycal: /savvycal|booking|schedule/i,
};

/** Step type detection patterns */
const STEP_TYPE_PATTERNS: Record<WorkflowStepType, RegExp[]> = {
  trigger: [
    /webhook|event|fires?|trigger|receive|subscription/i,
    /^1\.\s/i, // First step is often a trigger
  ],
  action: [
    /create|update|delete|send|post|sync|store|save|write/i,
    /^(perform|execute|run)\s/i,
  ],
  condition: [
    /if|check|verify|validate|match|condition|decision|whether/i,
    /based on|depending/i,
  ],
  transform: [
    /extract|parse|convert|map|transform|generate|process|format/i,
    /ai analysis|claude|llm/i,
  ],
  external_call: [
    /api|fetch|call|request|oauth|endpoint/i,
    /edge function/i,
  ],
  storage: [
    /database|table|store|storage|queue|cache/i,
    /supabase|postgres/i,
  ],
  notification: [
    /notify|alert|email|message|reminder|digest/i,
    /send to|inform/i,
  ],
};

// ============================================================================
// Description Parser
// ============================================================================

interface ParsedStep {
  number: number;
  title: string;
  description: string;
  subSteps: string[];
}

/**
 * Parse a text description into structured steps
 */
export function parseDescription(description: string): ParsedStep[] {
  const steps: ParsedStep[] = [];
  const lines = description.split('\n');
  let currentStep: ParsedStep | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for numbered step (e.g., "1. OAuth Connection:")
    const stepMatch = trimmed.match(/^(\d+)\.\s*([^:]+):\s*(.*)?$/);
    if (stepMatch) {
      if (currentStep) {
        steps.push(currentStep);
      }
      currentStep = {
        number: parseInt(stepMatch[1], 10),
        title: stepMatch[2].trim(),
        description: stepMatch[3]?.trim() || '',
        subSteps: [],
      };
      continue;
    }

    // Check for sub-step (e.g., "   - Inbound: HubSpot webhooks...")
    const subStepMatch = trimmed.match(/^-\s*(.+)$/);
    if (subStepMatch && currentStep) {
      currentStep.subSteps.push(subStepMatch[1].trim());
      continue;
    }

    // Continue description on next line
    if (currentStep && !trimmed.startsWith('-')) {
      currentStep.description += ' ' + trimmed;
    }
  }

  // Don't forget the last step
  if (currentStep) {
    steps.push(currentStep);
  }

  return steps;
}

// ============================================================================
// Step Type Detection
// ============================================================================

/**
 * Detect the step type based on its title and description
 */
function detectStepType(
  title: string,
  description: string,
  stepNumber: number,
  totalSteps: number
): WorkflowStepType {
  const fullText = `${title} ${description}`.toLowerCase();

  // Check each type pattern
  for (const [type, patterns] of Object.entries(STEP_TYPE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(fullText)) {
        return type as WorkflowStepType;
      }
    }
  }

  // Default logic based on position
  if (stepNumber === 1) return 'trigger';
  if (stepNumber === totalSteps) return 'notification';
  if (fullText.includes('table') || fullText.includes('database')) return 'storage';

  return 'action';
}

/**
 * Detect which integration a step belongs to
 */
function detectIntegration(text: string): string | undefined {
  for (const [integration, pattern] of Object.entries(INTEGRATION_PATTERNS)) {
    if (pattern.test(text)) {
      return integration;
    }
  }
  return undefined;
}

// ============================================================================
// Schema Generation
// ============================================================================

/**
 * Generate a basic JSON schema based on step context
 */
function generateInputSchema(step: ParsedStep, integration?: string): JSONSchema {
  const schema: JSONSchema = {
    type: 'object',
    properties: {},
    required: [],
    description: `Input data for ${step.title}`,
  };

  // Add common properties based on step type and integration
  if (integration === 'hubspot') {
    schema.properties = {
      contactId: { type: 'string', description: 'HubSpot contact ID' },
      dealId: { type: 'string', description: 'HubSpot deal ID' },
      accessToken: { type: 'string', description: 'OAuth access token' },
    };
  } else if (integration === 'fathom') {
    schema.properties = {
      meetingId: { type: 'string', description: 'Fathom meeting ID' },
      recordingUrl: { type: 'string', description: 'Recording URL' },
      transcript: { type: 'string', description: 'Meeting transcript' },
    };
  } else if (integration === 'google') {
    schema.properties = {
      userId: { type: 'string', description: 'User ID' },
      calendarId: { type: 'string', description: 'Google Calendar ID' },
      accessToken: { type: 'string', description: 'OAuth access token' },
    };
  }

  // Add generic properties based on description
  const desc = step.description.toLowerCase();
  if (desc.includes('id')) {
    schema.properties!.id = { type: 'string', description: 'Record ID' };
  }
  if (desc.includes('email')) {
    schema.properties!.email = { type: 'string', description: 'Email address' };
  }

  return schema;
}

/**
 * Generate output schema based on step context
 */
function generateOutputSchema(step: ParsedStep, stepType: WorkflowStepType): JSONSchema {
  const schema: JSONSchema = {
    type: 'object',
    properties: {},
    description: `Output data from ${step.title}`,
  };

  switch (stepType) {
    case 'trigger':
      schema.properties = {
        eventId: { type: 'string' },
        eventType: { type: 'string' },
        payload: { type: 'object' },
      };
      break;
    case 'storage':
      schema.properties = {
        recordId: { type: 'string' },
        created: { type: 'boolean' },
        updated: { type: 'boolean' },
      };
      break;
    case 'transform':
      schema.properties = {
        transformedData: { type: 'object' },
        extractedItems: { type: 'array', items: { type: 'object' } },
      };
      break;
    case 'external_call':
      schema.properties = {
        statusCode: { type: 'number' },
        response: { type: 'object' },
        success: { type: 'boolean' },
      };
      break;
    default:
      schema.properties = {
        success: { type: 'boolean' },
        data: { type: 'object' },
      };
  }

  return schema;
}

// ============================================================================
// Mermaid Parser
// ============================================================================

interface MermaidNode {
  id: string;
  label: string;
  type: 'start' | 'end' | 'process' | 'decision' | 'data' | 'default';
  section?: string;
}

interface MermaidEdge {
  from: string;
  to: string;
  label?: string;
}

/**
 * Parse Mermaid diagram code to extract nodes and edges
 */
export function parseMermaidCode(code: string): { nodes: MermaidNode[]; edges: MermaidEdge[] } {
  const nodes: MermaidNode[] = [];
  const edges: MermaidEdge[] = [];
  const seenNodeIds = new Set<string>();
  let currentSection: string | undefined;

  const lines = code.split('\n');

  // Node patterns (same as MermaidRenderer)
  const nodePatterns = [
    { regex: /(\w+)\(\(([^)]+)\)\)/, type: 'start' as const },
    { regex: /(\w+)\[\[([^\]]+)\]\]/, type: 'end' as const },
    { regex: /(\w+)\{([^}]+)\}/, type: 'decision' as const },
    { regex: /(\w+)\[\(([^)]+)\)\]/, type: 'data' as const },
    { regex: /(\w+)\[([^\]]+)\]/, type: 'process' as const },
    { regex: /(\w+)>([^\]]+)\]/, type: 'process' as const }, // Async flag
  ];

  // Edge patterns
  const edgePatterns = [
    /(\w+)\s*-->\s*\|([^|]+)\|\s*(\w+)/, // A --> |label| B
    /(\w+)\s*==>\s*\|([^|]+)\|\s*(\w+)/, // A ==> |label| B
    /(\w+)\s*-\.->?\s*\|([^|]+)\|\s*(\w+)/, // A -.-> |label| B
    /(\w+)\s*-->\s*(\w+)/, // A --> B
    /(\w+)\s*==>\s*(\w+)/, // A ==> B
    /(\w+)\s*-\.->?\s*(\w+)/, // A -.-> B
  ];

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for subgraph
    const subgraphMatch = trimmed.match(/subgraph\s+(\w+)\s*\["?([^"\]]+)"?\]/);
    if (subgraphMatch) {
      currentSection = subgraphMatch[2].replace(/^[^\w]*/, '').trim();
      continue;
    }

    if (trimmed === 'end') {
      currentSection = undefined;
      continue;
    }

    // Try to match edges first
    let isEdge = false;
    for (const pattern of edgePatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        isEdge = true;
        const from = match[1];
        const label = match.length === 4 ? match[2] : undefined;
        const to = match.length === 4 ? match[3] : match[2];

        edges.push({ from, to, label });
        break;
      }
    }

    if (isEdge) continue;

    // Try to match node definitions
    for (const { regex, type } of nodePatterns) {
      const match = trimmed.match(regex);
      if (match) {
        const id = match[1];
        if (seenNodeIds.has(id)) continue;

        const label = match[2].replace(/"/g, '').replace(/<br\s*\/?>/gi, ' ').trim();
        if (!label || label === id) continue;

        seenNodeIds.add(id);
        nodes.push({ id, label, type, section: currentSection });
        break;
      }
    }
  }

  return { nodes, edges };
}

// ============================================================================
// Main Parser Function
// ============================================================================

/**
 * Generate a step ID from a title
 */
function generateStepId(title: string, index: number): string {
  const cleaned = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return `step_${index}_${cleaned.substring(0, 30)}`;
}

/**
 * Parse PROCESS_DESCRIPTIONS and Mermaid code into a ProcessMapWorkflow
 */
export function parseWorkflow(
  processType: 'integration' | 'workflow',
  processName: string,
  processDescription: string,
  mermaidCode: string,
  processMapId: string,
  orgId: string
): Omit<ProcessMapWorkflow, 'id' | 'createdAt' | 'updatedAt' | 'parsedAt'> {
  // Parse the description into steps
  const parsedSteps = parseDescription(processDescription);

  // Parse the Mermaid diagram
  const { nodes, edges } = parseMermaidCode(mermaidCode);

  // Build a map of node IDs to their Mermaid info
  const nodeMap = new Map(nodes.map((n) => [n.id.toLowerCase(), n]));

  // Convert parsed steps to workflow step definitions
  const steps: WorkflowStepDefinition[] = parsedSteps.map((step, index) => {
    const fullText = `${step.title} ${step.description}`;
    const stepType = detectStepType(step.title, step.description, step.number, parsedSteps.length);
    const integration = processType === 'integration' ? processName : detectIntegration(fullText);

    // Try to find matching Mermaid node
    const stepId = generateStepId(step.title, step.number);

    // Determine if this step can be mocked
    const canMock = stepType !== 'storage'; // Storage operations read from real DB

    // Determine if step requires real API in production-readonly mode
    const requiresRealApi = stepType === 'external_call' &&
      (step.description.toLowerCase().includes('fetch') ||
       step.description.toLowerCase().includes('get'));

    return {
      id: stepId,
      name: step.title,
      type: stepType,
      integration,
      description: step.description,
      inputSchema: generateInputSchema(step, integration),
      outputSchema: generateOutputSchema(step, stepType),
      dependencies: index > 0 ? [generateStepId(parsedSteps[index - 1].title, parsedSteps[index - 1].number)] : [],
      testConfig: {
        mockable: canMock,
        timeout: DEFAULT_STEP_TIMEOUT,
        retryCount: DEFAULT_RETRY_COUNT,
        sampleData: undefined,
        requiresRealApi,
        operations: determineOperations(step.description),
      },
    };
  });

  // Build connections from parsed steps (sequential by default)
  const connections: WorkflowConnection[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    connections.push({
      fromStepId: steps[i].id,
      toStepId: steps[i + 1].id,
      condition: 'success',
    });
  }

  // Add connections from Mermaid edges if they provide additional info
  for (const edge of edges) {
    // Check if this edge adds a condition we don't have
    if (edge.label && !connections.some(c =>
      c.fromStepId.includes(edge.from.toLowerCase()) &&
      c.condition === edge.label
    )) {
      const fromStep = steps.find(s => s.id.includes(edge.from.toLowerCase()));
      const toStep = steps.find(s => s.id.includes(edge.to.toLowerCase()));
      if (fromStep && toStep) {
        connections.push({
          fromStepId: fromStep.id,
          toStepId: toStep.id,
          condition: edge.label,
          label: edge.label,
        });
      }
    }
  }

  // Build test and mock configuration
  const testConfig: WorkflowTestConfig = {
    defaultRunMode: 'mock',
    timeout: DEFAULT_STEP_TIMEOUT * steps.length,
    retryCount: DEFAULT_RETRY_COUNT,
    continueOnFailure: false,
  };

  const mockConfig: WorkflowMockConfig = {
    integrations: {},
  };

  // Add mock config for detected integration
  const primaryIntegration = processType === 'integration' ? processName : undefined;
  if (primaryIntegration) {
    mockConfig.integrations[primaryIntegration] = {
      enabled: true,
      defaultDelay: 100,
      responses: {},
    };
  }

  return {
    processMapId,
    orgId,
    steps,
    connections,
    testConfig,
    mockConfig,
    version: 1,
    isActive: true,
  };
}

/**
 * Determine what operations a step performs based on its description
 */
function determineOperations(description: string): ('read' | 'write' | 'delete')[] {
  const ops: ('read' | 'write' | 'delete')[] = [];
  const lower = description.toLowerCase();

  if (lower.includes('fetch') || lower.includes('get') || lower.includes('read') ||
      lower.includes('query') || lower.includes('select') || lower.includes('list')) {
    ops.push('read');
  }

  if (lower.includes('create') || lower.includes('insert') || lower.includes('save') ||
      lower.includes('update') || lower.includes('write') || lower.includes('store') ||
      lower.includes('sync')) {
    ops.push('write');
  }

  if (lower.includes('delete') || lower.includes('remove') || lower.includes('clear')) {
    ops.push('delete');
  }

  return ops.length > 0 ? ops : ['read'];
}

// ============================================================================
// Exports
// ============================================================================

export type { ParsedStep, MermaidNode, MermaidEdge };
