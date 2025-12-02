/**
 * Workflow Engine Prompts
 *
 * Dynamic prompt templates used by the AI Provider service for
 * workflow-based AI interactions. Includes prompt enhancements
 * for chain-of-thought reasoning, CRM access, tools, MCP servers,
 * and output formatting.
 *
 * @file src/lib/services/aiProvider.ts
 * @model Multiple providers (OpenAI, Anthropic, OpenRouter, Gemini)
 * @temperature Configurable per node
 * @maxTokens Configurable per node
 */

import type { PromptTemplate, PromptVariable } from './index';

// ============================================================================
// Prompt Enhancement Templates
// ============================================================================

/**
 * Chain-of-thought enhancement added to system prompts
 */
export const CHAIN_OF_THOUGHT_ENHANCEMENT = `
Please think step-by-step through your reasoning before providing the final answer.`;

/**
 * CRM access enhancement for queries involving database operations
 */
export const CRM_ACCESS_ENHANCEMENT = `
You have direct access to the CRM database and can search for contacts, companies, and deals. When asked about CRM records, always use the available tools to search the actual database. Provide specific information and links when records are found.`;

/**
 * CRM detection keywords
 */
export const CRM_KEYWORDS = [
  'crm',
  'contact',
  'deal',
  'company',
  'record',
  'database',
  'search',
  'find',
  'lookup',
];

// ============================================================================
// Tool Integration Templates
// ============================================================================

/**
 * Tool instructions template for AI nodes with tool access
 */
export const TOOL_INSTRUCTIONS_TEMPLATE = `
You have access to the following tools:

\${toolDescriptions}

To use a tool, format your response as:
<tool>tool_name</tool>
<parameters>{"param1": "value1", "param2": "value2"}</parameters>
Then provide your analysis of the results.`;

/**
 * Variables for tool instructions
 */
export const TOOL_INSTRUCTIONS_VARIABLES: PromptVariable[] = [
  {
    name: 'toolDescriptions',
    description: 'Formatted descriptions of available tools',
    type: 'string',
    required: true,
    example:
      '- search_contacts: Search for contacts in the CRM\n  Parameters: { query: string }',
    source: 'tool_registry',
  },
];

// ============================================================================
// MCP Server Integration Templates
// ============================================================================

/**
 * MCP server instructions template
 */
export const MCP_INSTRUCTIONS_TEMPLATE = `
You have access to MCP (Model Context Protocol) servers:
\${serverList}

To use MCP, format requests as:
<mcp server="server_name" method="method_name">{"params": {...}}</mcp>
Available methods: tools/list, tools/call, resources/list, resources/get, prompts/list, prompts/get`;

/**
 * Variables for MCP instructions
 */
export const MCP_INSTRUCTIONS_VARIABLES: PromptVariable[] = [
  {
    name: 'serverList',
    description: 'List of available MCP servers and their capabilities',
    type: 'string',
    required: true,
    example: '- crm: Access to CRM data and operations\n- analytics: Access to analytics data',
    source: 'mcp_manager',
  },
];

// ============================================================================
// Output Format Templates
// ============================================================================

/**
 * JSON output format instruction
 */
export const JSON_OUTPUT_INSTRUCTION = `
You must respond with valid JSON only. Do not include any explanatory text outside the JSON structure.`;

/**
 * JSON schema instruction template
 */
export const JSON_SCHEMA_INSTRUCTION_TEMPLATE = `
The JSON must conform to this schema:
\${jsonSchema}`;

/**
 * Variables for JSON schema instruction
 */
export const JSON_SCHEMA_VARIABLES: PromptVariable[] = [
  {
    name: 'jsonSchema',
    description: 'JSON schema for response validation',
    type: 'string',
    required: true,
    example: '{ "type": "object", "properties": { "result": { "type": "string" } } }',
    source: 'node_config',
  },
];

// ============================================================================
// Few-Shot Learning Template
// ============================================================================

/**
 * Few-shot examples template
 */
export const FEW_SHOT_TEMPLATE = `\${examples}

Now process this:
\${userPrompt}`;

/**
 * Variables for few-shot template
 */
export const FEW_SHOT_VARIABLES: PromptVariable[] = [
  {
    name: 'examples',
    description: 'Formatted few-shot examples',
    type: 'string',
    required: true,
    example: 'Example:\nInput: What is 2+2?\nOutput: 4\n\nExample:\nInput: What is 3+3?\nOutput: 6',
    source: 'node_config',
  },
  {
    name: 'userPrompt',
    description: 'The actual user prompt to process',
    type: 'string',
    required: true,
    example: 'What is 5+5?',
    source: 'request',
  },
];

// ============================================================================
// Template Exports
// ============================================================================

export const workflowToolsTemplate: PromptTemplate = {
  id: 'workflow-tools',
  name: 'Workflow Tool Instructions',
  description: 'Instructions for AI nodes with tool access capabilities.',
  featureKey: 'workflow_tools',
  systemPrompt: TOOL_INSTRUCTIONS_TEMPLATE,
  userPrompt: '',
  variables: TOOL_INSTRUCTIONS_VARIABLES,
  responseFormat: 'text',
};

export const workflowMCPTemplate: PromptTemplate = {
  id: 'workflow-mcp',
  name: 'Workflow MCP Instructions',
  description: 'Instructions for AI nodes with MCP server access.',
  featureKey: 'workflow_mcp',
  systemPrompt: MCP_INSTRUCTIONS_TEMPLATE,
  userPrompt: '',
  variables: MCP_INSTRUCTIONS_VARIABLES,
  responseFormat: 'text',
};

export const workflowJsonTemplate: PromptTemplate = {
  id: 'workflow-json',
  name: 'Workflow JSON Output',
  description: 'Instructions for AI nodes that output JSON.',
  featureKey: 'workflow_json',
  systemPrompt: JSON_OUTPUT_INSTRUCTION + '\n\n' + JSON_SCHEMA_INSTRUCTION_TEMPLATE,
  userPrompt: '',
  variables: JSON_SCHEMA_VARIABLES,
  responseFormat: 'json',
};

export const workflowFewShotTemplate: PromptTemplate = {
  id: 'workflow-few-shot',
  name: 'Workflow Few-Shot Learning',
  description: 'Template for few-shot learning in workflow nodes.',
  featureKey: 'workflow_few_shot',
  systemPrompt: '',
  userPrompt: FEW_SHOT_TEMPLATE,
  variables: FEW_SHOT_VARIABLES,
  responseFormat: 'text',
};

// ============================================================================
// Types
// ============================================================================

export interface WorkflowNodeConfig {
  modelProvider: 'openai' | 'anthropic' | 'openrouter' | 'gemini';
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  chainOfThought?: boolean;
  enableTools?: boolean;
  selectedTools?: string[];
  autoExecuteTools?: boolean;
  enableMCP?: boolean;
  selectedMCPServers?: string[];
  outputFormat?: 'text' | 'json' | 'markdown' | 'structured';
  jsonSchema?: string;
  fewShotExamples?: Array<{ input: string; output: string }>;
  retryOnError?: boolean;
  maxRetries?: number;
  extractionRules?: Array<{
    field: string;
    type: string;
    path?: string;
    pattern?: string;
    required?: boolean;
  }>;
}

export interface PromptEnhancement {
  type: 'chain_of_thought' | 'crm_access' | 'tools' | 'mcp' | 'json_output' | 'json_schema';
  content: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect if a prompt is CRM-related
 */
export function isCRMQuery(systemPrompt: string, userPrompt: string): boolean {
  const combined = (systemPrompt + ' ' + userPrompt).toLowerCase();
  return CRM_KEYWORDS.some((keyword) => combined.includes(keyword));
}

/**
 * Build enhanced system prompt with all applicable enhancements
 */
export function buildEnhancedSystemPrompt(
  baseSystemPrompt: string,
  config: WorkflowNodeConfig,
  toolDescriptions?: string,
  mcpServerList?: string
): string {
  let enhanced = baseSystemPrompt;

  // Add chain-of-thought if enabled
  if (config.chainOfThought) {
    enhanced += CHAIN_OF_THOUGHT_ENHANCEMENT;
  }

  // Auto-enhance for CRM queries
  if (
    isCRMQuery(config.systemPrompt, config.userPrompt) &&
    !baseSystemPrompt.includes('CRM access')
  ) {
    enhanced += '\n\n' + CRM_ACCESS_ENHANCEMENT;
  }

  // Add tool instructions if enabled
  if (config.enableTools && config.selectedTools && config.selectedTools.length > 0) {
    if (toolDescriptions) {
      enhanced += '\n\n' + TOOL_INSTRUCTIONS_TEMPLATE.replace('${toolDescriptions}', toolDescriptions);
    }
  }

  // Add MCP server instructions if enabled
  if (config.enableMCP && config.selectedMCPServers && config.selectedMCPServers.length > 0) {
    if (mcpServerList) {
      enhanced += '\n\n' + MCP_INSTRUCTIONS_TEMPLATE.replace('${serverList}', mcpServerList);
    }
  }

  // Add JSON output instructions if applicable
  if (config.outputFormat === 'json') {
    enhanced += '\n\n' + JSON_OUTPUT_INSTRUCTION;
    if (config.jsonSchema) {
      enhanced +=
        '\n\n' + JSON_SCHEMA_INSTRUCTION_TEMPLATE.replace('${jsonSchema}', config.jsonSchema);
    }
  }

  return enhanced;
}

/**
 * Build enhanced user prompt with few-shot examples
 */
export function buildEnhancedUserPrompt(
  baseUserPrompt: string,
  config: WorkflowNodeConfig
): string {
  if (!config.fewShotExamples || config.fewShotExamples.length === 0) {
    return baseUserPrompt;
  }

  const examples = config.fewShotExamples
    .map((ex) => `Example:\nInput: ${ex.input}\nOutput: ${ex.output}`)
    .join('\n\n');

  return FEW_SHOT_TEMPLATE
    .replace('${examples}', examples)
    .replace('${userPrompt}', baseUserPrompt);
}

/**
 * Format tool definitions for inclusion in prompts
 */
export function formatToolDescriptions(
  tools: Array<{ name: string; description: string; parameters?: Record<string, any> }>
): string {
  return tools
    .map((tool) => {
      let desc = `- ${tool.name}: ${tool.description}`;
      if (tool.parameters) {
        desc += `\n  Parameters: ${JSON.stringify(tool.parameters)}`;
      }
      return desc;
    })
    .join('\n\n');
}

/**
 * Format MCP server list for inclusion in prompts
 */
export function formatMCPServerList(servers: string[]): string {
  return servers.map((server) => `- ${server}: Access to ${server} data and operations`).join('\n');
}

/**
 * Parse tool call from AI response
 */
export function parseToolCallFromResponse(content: string): {
  toolName: string | null;
  parameters: Record<string, any> | null;
} {
  const toolMatch = content.match(/<tool>([^<]+)<\/tool>/);
  const paramsMatch = content.match(/<parameters>([^<]+)<\/parameters>/);

  if (!toolMatch) {
    return { toolName: null, parameters: null };
  }

  let parameters: Record<string, any> | null = null;
  if (paramsMatch) {
    try {
      parameters = JSON.parse(paramsMatch[1]);
    } catch (e) {
      parameters = null;
    }
  }

  return {
    toolName: toolMatch[1].trim(),
    parameters,
  };
}

/**
 * Parse MCP request from AI response
 */
export function parseMCPRequestFromResponse(content: string): {
  serverName: string | null;
  method: string | null;
  params: Record<string, any> | null;
} {
  const mcpMatch = content.match(/<mcp\s+server="([^"]+)"\s+method="([^"]+)">([^<]*)<\/mcp>/);

  if (!mcpMatch) {
    return { serverName: null, method: null, params: null };
  }

  let params: Record<string, any> | null = null;
  if (mcpMatch[3]) {
    try {
      params = JSON.parse(mcpMatch[3]);
    } catch (e) {
      params = null;
    }
  }

  return {
    serverName: mcpMatch[1],
    method: mcpMatch[2],
    params,
  };
}

/**
 * Validate extraction rules against response data
 */
export function validateExtraction(
  data: any,
  rules: WorkflowNodeConfig['extractionRules']
): { success: boolean; errors: string[] } {
  if (!rules || rules.length === 0) {
    return { success: true, errors: [] };
  }

  const errors: string[] = [];

  for (const rule of rules) {
    if (rule.required) {
      let value: any = data;

      // Navigate to nested path if specified
      if (rule.path) {
        const pathParts = rule.path.split('.');
        for (const part of pathParts) {
          if (value === undefined || value === null) break;
          value = value[part];
        }
      } else {
        value = data[rule.field];
      }

      if (value === undefined || value === null) {
        errors.push(`Required field "${rule.field}" is missing`);
      }
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}
