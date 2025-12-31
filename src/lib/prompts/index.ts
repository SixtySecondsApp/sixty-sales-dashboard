/**
 * AI Prompts Module
 *
 * Centralized prompt management for all AI functions in the application.
 * Each prompt file exports templates with configurable variables and model settings.
 *
 * @see /PROMPTS.md for full documentation
 */

// Re-export all prompt modules
export * from './suggestNextActions';
export * from './transcriptAnalysis';
export * from './emailAnalysis';
export * from './writingStyle';
export * from './proposalGeneration';
export * from './workflowEngine';
export * from './slackNotifications';
export * from './meetingPrompts';
export * from './searchPrompts';
export * from './processMapPrompts';
export * from './onboardingPrompts';

// ============================================================================
// Model Configuration
// ============================================================================

/**
 * Default AI models used across the application.
 * These can be overridden via:
 * 1. User settings (user_ai_feature_settings table)
 * 2. System config (system_config table)
 * 3. Environment variables
 */
export const DEFAULT_MODELS = {
  // Fast, cost-effective model for quick analysis
  HAIKU: 'claude-haiku-4-5-20251001',

  // Balanced model for most tasks
  SONNET: 'claude-3-5-sonnet-20241022',

  // Most capable model for complex tasks
  OPUS: 'claude-3-opus-20240229',

  // OpenRouter model IDs
  OPENROUTER_HAIKU: 'anthropic/claude-haiku-4.5',
  OPENROUTER_SONNET: 'anthropic/claude-3-5-sonnet-20241022',
} as const;

/**
 * Feature-specific model defaults.
 * Maps feature keys to their default model configuration.
 */
export const FEATURE_MODEL_DEFAULTS: Record<string, ModelConfig> = {
  // Meeting & Activity Analysis
  suggest_next_actions: {
    model: DEFAULT_MODELS.HAIKU,
    temperature: 0.7,
    maxTokens: 2048,
  },
  generate_actions: {
    model: DEFAULT_MODELS.HAIKU,
    temperature: 0.3,
    maxTokens: 2048,
  },
  action_item_analysis: {
    model: DEFAULT_MODELS.HAIKU,
    temperature: 0.3,
    maxTokens: 500,
  },
  transcript_analysis: {
    model: DEFAULT_MODELS.HAIKU,
    temperature: 0.5,
    maxTokens: 4096,
  },

  // Email Analysis
  email_analysis: {
    model: DEFAULT_MODELS.HAIKU,
    temperature: 0.3,
    maxTokens: 1024,
  },
  writing_style: {
    model: DEFAULT_MODELS.SONNET,
    temperature: 0.5,
    maxTokens: 2048,
  },

  // Proposal Generation
  proposal_focus_areas: {
    model: DEFAULT_MODELS.OPENROUTER_HAIKU,
    temperature: 0.5,
    maxTokens: 2048,
  },
  proposal_goals: {
    model: DEFAULT_MODELS.OPENROUTER_SONNET,
    temperature: 0.7,
    maxTokens: 4096,
  },
  proposal_sow: {
    model: DEFAULT_MODELS.OPENROUTER_SONNET,
    temperature: 0.7,
    maxTokens: 8192,
  },
  proposal_html: {
    model: DEFAULT_MODELS.OPENROUTER_SONNET,
    temperature: 0.7,
    maxTokens: 16384,
  },

  // Workflow Engine (defaults, usually overridden per-workflow)
  workflow_default: {
    model: DEFAULT_MODELS.HAIKU,
    temperature: 0.7,
    maxTokens: 2048,
  },

  // Slack Notifications
  slack_meeting_debrief: {
    model: DEFAULT_MODELS.HAIKU,
    temperature: 0.5,
    maxTokens: 2048,
  },
  slack_daily_digest: {
    model: DEFAULT_MODELS.HAIKU,
    temperature: 0.5,
    maxTokens: 1024,
  },
  slack_meeting_prep: {
    model: DEFAULT_MODELS.HAIKU,
    temperature: 0.5,
    maxTokens: 1024,
  },
  slack_task_suggestions: {
    model: DEFAULT_MODELS.HAIKU,
    temperature: 0.3,
    maxTokens: 1024,
  },

  // Meeting Intelligence
  condense_summary: {
    model: DEFAULT_MODELS.HAIKU,
    temperature: 0.3,
    maxTokens: 256,
  },
  meeting_qa: {
    model: DEFAULT_MODELS.HAIKU,
    temperature: 0.7,
    maxTokens: 2048,
  },
  content_topics: {
    model: DEFAULT_MODELS.HAIKU,
    temperature: 0.3,
    maxTokens: 4096,
  },

  // Search & Intelligence
  search_query_parse: {
    model: DEFAULT_MODELS.SONNET,
    temperature: 0.3,
    maxTokens: 500,
  },

  // Process Map Generation
  process_map_generation: {
    model: DEFAULT_MODELS.HAIKU,
    temperature: 0.3,
    maxTokens: 4096,
  },

  // Onboarding - Organization Enrichment (using Gemini 2.5 Flash)
  organization_data_collection: {
    model: 'gemini-3-flash-preview',
    temperature: 0.3,
    maxTokens: 4096,
  },
  organization_skill_generation: {
    model: 'gemini-3-flash-preview',
    temperature: 0.4,
    maxTokens: 6000,
  },
};

// ============================================================================
// Types
// ============================================================================

export interface ModelConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface PromptTemplate {
  /** Unique identifier for this prompt */
  id: string;

  /** Human-readable name */
  name: string;

  /** Description of what this prompt does */
  description: string;

  /** Feature key for model resolution */
  featureKey: string;

  /** The system prompt template */
  systemPrompt: string;

  /** The user prompt template */
  userPrompt: string;

  /** Variables used in the templates */
  variables: PromptVariable[];

  /** Expected response format */
  responseFormat: 'json' | 'text' | 'markdown' | 'html';

  /** JSON schema for response validation (if responseFormat is 'json') */
  responseSchema?: string;
}

export interface PromptVariable {
  /** Variable name (used in template as ${name}) */
  name: string;

  /** Description of the variable */
  description: string;

  /** Data type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';

  /** Whether this variable is required */
  required: boolean;

  /** Example value */
  example?: string;

  /** Source of the data (table name or 'request') */
  source?: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Interpolate variables into a prompt template.
 * Replaces ${variableName} with actual values.
 */
export function interpolatePrompt(
  template: string,
  variables: Record<string, any>
): string {
  return template.replace(/\$\{(\w+)\}/g, (match, varName) => {
    const value = variables[varName];
    if (value === undefined || value === null) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  });
}

/**
 * Get the model configuration for a feature.
 * Checks user settings first, then system config, then defaults.
 */
export function getModelForFeature(featureKey: string): ModelConfig {
  // In a real implementation, this would check:
  // 1. User settings from user_ai_feature_settings table
  // 2. System config from system_config table
  // 3. Fall back to FEATURE_MODEL_DEFAULTS

  return FEATURE_MODEL_DEFAULTS[featureKey] || FEATURE_MODEL_DEFAULTS.workflow_default;
}

/**
 * Build a complete prompt configuration ready for API call.
 */
export function buildPromptConfig(
  template: PromptTemplate,
  variables: Record<string, any>,
  modelOverride?: Partial<ModelConfig>
): {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
} {
  const modelConfig = {
    ...getModelForFeature(template.featureKey),
    ...modelOverride,
  };

  return {
    systemPrompt: interpolatePrompt(template.systemPrompt, variables),
    userPrompt: interpolatePrompt(template.userPrompt, variables),
    model: modelConfig.model,
    temperature: modelConfig.temperature,
    maxTokens: modelConfig.maxTokens,
  };
}
