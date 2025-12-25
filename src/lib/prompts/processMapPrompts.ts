/**
 * Process Map Generation Prompts
 *
 * Prompts for AI-generated Mermaid diagrams visualizing integrations and workflows.
 * These prompts are used by the generate-process-map Edge Function.
 */

import type { PromptTemplate } from './index';

// ============================================================================
// Process Descriptions - Short, Easy to Understand
// ============================================================================

/**
 * Integration process descriptions - single line each
 */
export const INTEGRATION_DESCRIPTIONS: Record<string, string> = {
  hubspot: `Two-way sync of contacts, deals, and tasks with HubSpot CRM via OAuth and webhooks.`,
  google: `Sync Gmail, Calendar, and Tasks via OAuth. Match attendees to CRM contacts.`,
  fathom: `Import meeting recordings via OAuth. Generate thumbnails, transcripts, and AI summaries.`,
  slack: `Send deal alerts and meeting summaries to Slack channels via bot integration.`,
  justcall: `Sync call recordings via API. Fetch transcripts and run AI analysis.`,
  savvycal: `Sync bookings via webhook. Auto-create contacts and log activities.`,
};

/**
 * Workflow process descriptions - single line each
 */
export const WORKFLOW_DESCRIPTIONS: Record<string, string> = {
  meeting_intelligence: `AI analyzes transcripts to generate summaries, action items, and next step suggestions.`,
  task_extraction: `Auto-create tasks from meetings and calls using AI extraction and smart templates.`,
  vsl_analytics: `Track video engagement anonymously for A/B testing across landing page variants.`,
  sentry_bridge: `Convert Sentry error alerts into AI Dev Hub tasks automatically via MCP.`,
  api_optimization: `Reduce API calls 95% with smart polling, batching, and working hours awareness.`,
};

// ============================================================================
// Prompt Templates
// ============================================================================

/**
 * System prompt for generating Mermaid diagrams
 */
export const processMapSystemPrompt = `You are an expert at creating professional, visually stunning Mermaid flowchart diagrams for software processes.

Your task is to create a Mermaid diagram that visualizes the given process flow using our standardized design system.

## DESIGN SCHEMA (REQUIRED)

### 1. FLOW DIRECTION
- Use the specified flowchart direction (LR for horizontal, TB for vertical)

### 2. SUBGRAPHS (Required for organization)
Create 3-5 logical subgraphs with emoji headers. Examples:
- \`subgraph Setup ["🛠️ CONFIGURATION & AUTH"]\`
- \`subgraph Sync ["🔄 SYNC ENGINE"]\`
- \`subgraph Processing ["⚙️ DATA PROCESSING"]\`
- \`subgraph Automation ["⚡ AUTOMATION ENGINE"]\`

Inside each subgraph, add: \`direction TB\`

### 3. NODE SHAPES (Semantic meaning)
Use these shapes consistently - NO QUOTES inside shapes:
- \`((Text))\` - Start/End terminal nodes (circles)
- \`[Text]\` - Standard process steps (rectangles)
- \`[(Text)]\` - Database/Storage (cylinder)
- \`{Text}\` - Decision/Gateway diamonds
- \`[[Text]]\` - Subroutines/Edge Functions (double border)
- \`>Text]\` - Async/Webhook events (flag shape)

### 4. NODE LABELS - CRITICAL RULES
- Keep labels SHORT: 2-4 words MAXIMUM, single line only
- NEVER use \`<br/>\` inside special shapes
- NEVER use \`&\` - always use "and" instead
- NEVER use special characters: avoid # : ( ) < > in labels

### 5. CONNECTIONS
- \`-->\` Normal flow
- \`==>\` Important/Critical paths (use sparingly, 1-2 max)
- \`-.->\` Optional/Async flow
- Add edge labels: \`-- "Label" -->\` or \`-- Yes -->\`

### 6. REQUIRED STYLING BLOCK (Add at end)
\`\`\`
    classDef primary fill:#e0e7ff,stroke:#4f46e5,stroke-width:2px,color:#1e1b4b
    classDef storage fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e3a5f
    classDef logic fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f
    classDef io fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#064e3b
    classDef terminal fill:#e2e8f0,stroke:#475569,stroke-width:2px,color:#0f172a
    classDef async fill:#fce7f3,stroke:#db2777,stroke-width:2px,color:#831843

    class [START_END_NODES] terminal
    class [DATABASE_NODES] storage
    class [DECISION_NODES] logic
    class [WEBHOOK_ASYNC_NODES] async
    class [ALL_OTHER_NODES] primary

    linkStyle default stroke:#64748b,stroke-width:2px
\`\`\`

CRITICAL: Return ONLY the Mermaid code, no markdown code blocks, no explanation.`;

/**
 * User prompt template for process map generation
 */
export const processMapUserPrompt = `Create a Mermaid flowchart diagram for the following \${processType} process:

Process Name: \${processName}
Flow Direction: \${flowDirection}

Process Description:
\${description}

Remember: Return ONLY valid Mermaid code, starting with 'flowchart'.`;

// ============================================================================
// Template Exports
// ============================================================================

export const processMapGenerationTemplate: PromptTemplate = {
  id: 'process_map_generation',
  name: 'Process Map Generation',
  description: 'Generate Mermaid diagrams for integration and workflow processes',
  featureKey: 'process_map_generation',
  systemPrompt: processMapSystemPrompt,
  userPrompt: processMapUserPrompt,
  variables: [
    {
      name: 'processType',
      description: 'Type of process (integration or workflow)',
      type: 'string',
      required: true,
      example: 'integration',
    },
    {
      name: 'processName',
      description: 'Name of the specific process',
      type: 'string',
      required: true,
      example: 'hubspot',
    },
    {
      name: 'flowDirection',
      description: 'Mermaid flow direction (LR or TB)',
      type: 'string',
      required: true,
      example: 'LR',
    },
    {
      name: 'description',
      description: 'Short description of the process flow',
      type: 'string',
      required: true,
      example: 'HubSpot Integration: Two-way sync of contacts, deals, and tasks.',
    },
  ],
  responseFormat: 'text',
};

/**
 * Get process description by type and name
 */
export function getProcessDescription(
  processType: 'integration' | 'workflow',
  processName: string
): string | null {
  if (processType === 'integration') {
    return INTEGRATION_DESCRIPTIONS[processName] || null;
  }
  return WORKFLOW_DESCRIPTIONS[processName] || null;
}

/**
 * Get all process descriptions for a type
 */
export function getAllProcessDescriptions(
  processType: 'integration' | 'workflow'
): Record<string, string> {
  return processType === 'integration' ? INTEGRATION_DESCRIPTIONS : WORKFLOW_DESCRIPTIONS;
}

// ============================================================================
// Two-Phase Generation Prompts
// ============================================================================

/**
 * Phase 1: Opus Structure Generation Prompt
 * Generates a structured JSON representation of the process.
 * This is the "source of truth" for both Mermaid views and testing.
 */
export const opusStructureSystemPrompt = `You are an expert at analyzing software integration processes and creating structured workflow representations.

Your task is to analyze a process description and output a structured JSON representation that captures the complete workflow with all its steps, connections, and organization.

## OUTPUT FORMAT

Return ONLY valid JSON matching this exact structure (no markdown, no explanation):

{
  "schemaVersion": "1.0",
  "metadata": {
    "processType": "<integration|workflow>",
    "processName": "<name>",
    "title": "<Human Readable Title>",
    "description": "<Brief one-line description>",
    "generatedAt": "<ISO timestamp>",
    "modelUsed": "claude-opus-4-5-20251001"
  },
  "subgraphs": [
    {
      "id": "<PascalCaseId>",
      "label": "<Emoji> <UPPERCASE TITLE>",
      "nodeIds": ["<node1>", "<node2>"],
      "order": 0
    }
  ],
  "nodes": [
    {
      "id": "<PascalCaseId>",
      "label": "<2-4 word label>",
      "shape": "<terminal|process|storage|decision|subroutine|async>",
      "subgraphId": "<matching subgraph id>",
      "executionOrder": 1,
      "stepType": "<trigger|action|condition|transform|external_call|storage|notification>",
      "integration": "<optional integration name>",
      "description": "<description for testing>",
      "testConfig": {
        "mockable": true,
        "requiresRealApi": false,
        "operations": ["read"]
      }
    }
  ],
  "connections": [
    {
      "from": "<nodeId>",
      "to": "<nodeId>",
      "style": "<normal|critical|optional>",
      "label": "<optional edge label>"
    }
  ],
  "styling": {
    "nodeClasses": {
      "terminal": ["<nodeIds for start/end>"],
      "storage": ["<nodeIds for database ops>"],
      "logic": ["<nodeIds for decisions>"],
      "async": ["<nodeIds for webhooks/events>"],
      "primary": ["<nodeIds for everything else>"]
    }
  }
}

## GUIDELINES

### Subgraphs (3-5 recommended)
Create logical groupings with emoji headers:
- 🛠️ CONFIGURATION & AUTH - Setup, OAuth, credentials
- 🔄 SYNC ENGINE - Data synchronization steps
- ⚙️ DATA PROCESSING - Transformation, extraction
- ⚡ AUTOMATION ENGINE - Automated actions
- 🔔 NOTIFICATIONS - Alerts, notifications
- 🧠 AI INTELLIGENCE - AI analysis steps
- 💾 DATA STORAGE - Database operations

### Node IDs
- Use PascalCase: OAuthGrant, ContactSync, ValidateToken
- Keep unique and descriptive
- No spaces or special characters

### Node Labels
- MAXIMUM 4 words
- No special characters (no &, #, :, <, >)
- Use "and" instead of "&"
- Simple, clear descriptions

### Shape Selection
- terminal: Start/End points only
- storage: Database, cache, queue operations
- decision: If/else, validation checks
- subroutine: Edge functions, API calls
- async: Webhooks, events, async operations
- process: Everything else

### Step Types (for testing)
- trigger: Entry points (webhooks, scheduled tasks)
- external_call: API calls to external services
- transform: Data transformation, AI processing
- storage: Database read/write
- condition: Branching logic
- action: General actions
- notification: Alerts, messages

### Execution Order
- Start nodes = 1
- Follow dependencies for subsequent numbering
- Parallel steps can share the same order number

### Test Configuration
- mockable: true for most steps
- requiresRealApi: true if step needs live external data
- operations: ["read"], ["write"], ["delete"], or combinations

CRITICAL: Return ONLY the JSON object. No markdown code blocks, no explanation text.`;

/**
 * Phase 1: Opus User Prompt Template
 */
export function getOpusStructureUserPrompt(
  processType: string,
  processName: string,
  description: string
): string {
  const timestamp = new Date().toISOString();
  return `Analyze this ${processType} process and generate a structured JSON representation:

Process: ${processName.replace(/_/g, ' ').toUpperCase()}

Description:
${description}

Current timestamp for generatedAt: ${timestamp}

Generate the complete process structure JSON following the schema exactly.`;
}

/**
 * Phase 2: Haiku Mermaid Render Prompt
 * Converts the structured JSON into Mermaid code.
 * Pure transformation - no creative decisions.
 */
export const haikuRenderSystemPrompt = `You are a Mermaid diagram renderer. Your task is to convert a structured process JSON into valid Mermaid flowchart code.

## INPUT
You will receive:
1. A JSON structure containing nodes, connections, and subgraphs
2. A direction: "horizontal" (LR) or "vertical" (TB)

## OUTPUT
Return ONLY valid Mermaid code starting with "flowchart <direction>".

## SHAPE MAPPING
Convert shape types to Mermaid syntax:
- terminal: ((Label))
- process: [Label]
- storage: [(Label)]
- decision: {Label}
- subroutine: [[Label]]
- async: >Label]

## CONNECTION MAPPING
Convert connection styles:
- normal: -->
- critical: ==>
- optional: -.->
- With label: -- "Label" -->

## REQUIRED STRUCTURE
1. flowchart <LR or TB>
2. Subgraph blocks in order (with direction TB inside each)
3. Node definitions within their subgraphs
4. All connections after subgraph blocks close
5. Styling definitions at end

## REQUIRED STYLING (always include at end)
    classDef primary fill:#e0e7ff,stroke:#4f46e5,stroke-width:2px,color:#1e1b4b
    classDef storage fill:#dbeafe,stroke:#3b82f6,stroke-width:2px,color:#1e3a5f
    classDef logic fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f
    classDef io fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#064e3b
    classDef terminal fill:#e2e8f0,stroke:#475569,stroke-width:2px,color:#0f172a
    classDef async fill:#fce7f3,stroke:#db2777,stroke-width:2px,color:#831843

    class <terminal_nodes> terminal
    class <storage_nodes> storage
    class <logic_nodes> logic
    class <async_nodes> async
    class <primary_nodes> primary

    linkStyle default stroke:#64748b,stroke-width:2px

## RULES
- NO quotes inside shape brackets
- NO special characters in labels
- NO <br/> tags
- Every node MUST have a class assigned from styling.nodeClasses
- Use subgraph order from JSON
- Use "and" instead of "&"

CRITICAL: Return ONLY the Mermaid code. No markdown, no explanation.`;

/**
 * Phase 2: Haiku User Prompt Template
 */
export function getHaikuRenderUserPrompt(
  processStructure: unknown,
  direction: 'horizontal' | 'vertical'
): string {
  const mermaidDirection = direction === 'horizontal' ? 'LR' : 'TB';
  return `Convert this process structure to Mermaid code with ${mermaidDirection} (${direction === 'horizontal' ? 'left-to-right' : 'top-to-bottom'}) direction:

${JSON.stringify(processStructure, null, 2)}

Generate the Mermaid flowchart code starting with "flowchart ${mermaidDirection}".`;
}
