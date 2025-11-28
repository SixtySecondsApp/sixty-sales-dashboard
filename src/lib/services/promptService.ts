/**
 * Prompt Service
 *
 * Dynamic prompt management service that loads prompts from the database
 * with fallback to TypeScript defaults. Supports caching, versioning,
 * and user customization.
 *
 * Architecture:
 * 1. Check database for user/org overrides
 * 2. Check database for system prompts
 * 3. Fall back to TypeScript defaults in src/lib/prompts/
 *
 * @see /PROMPTS.md for documentation
 */

import { supabase } from '@/lib/supabase/clientV2';
import {
  PromptTemplate,
  ModelConfig,
  FEATURE_MODEL_DEFAULTS,
  interpolatePrompt,
  // Import all default templates
  suggestNextActionsTemplate,
  transcriptAnalysisTemplate,
  emailAnalysisTemplate,
  writingStyleTemplate,
  focusAreasTemplate,
  goalsTemplate,
  sowTemplate,
  htmlProposalTemplate,
  emailProposalTemplate,
  markdownProposalTemplate,
  workflowToolsTemplate,
  workflowMCPTemplate,
  workflowJsonTemplate,
  workflowFewShotTemplate,
} from '@/lib/prompts';

// ============================================================================
// Types
// ============================================================================

export interface DBPromptTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string | null;
  system_prompt: string | null;
  user_prompt: string | null;
  variables: PromptVariable[];
  model_provider: string | null;
  model: string | null;
  temperature: number;
  max_tokens: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface PromptVariable {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  example?: string;
  source?: string;
}

export interface LoadedPrompt {
  template: PromptTemplate;
  modelConfig: ModelConfig;
  source: 'database' | 'default';
  dbId?: string;
}

export interface PromptExecutionConfig {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  source: 'database' | 'default';
}

// ============================================================================
// Default Templates Registry
// ============================================================================

/**
 * Registry of all default TypeScript templates.
 * Maps feature keys to their template definitions.
 */
const DEFAULT_TEMPLATES: Record<string, PromptTemplate> = {
  // Activity & Meeting Analysis
  suggest_next_actions: suggestNextActionsTemplate,
  transcript_analysis: transcriptAnalysisTemplate,

  // Email Analysis
  email_analysis: emailAnalysisTemplate,
  writing_style: writingStyleTemplate,

  // Proposal Generation
  proposal_focus_areas: focusAreasTemplate,
  proposal_goals: goalsTemplate,
  proposal_sow: sowTemplate,
  proposal_html: htmlProposalTemplate,
  proposal_email: emailProposalTemplate,
  proposal_markdown: markdownProposalTemplate,

  // Workflow Engine
  workflow_tools: workflowToolsTemplate,
  workflow_mcp: workflowMCPTemplate,
  workflow_json: workflowJsonTemplate,
  workflow_few_shot: workflowFewShotTemplate,
};

// ============================================================================
// Cache Management
// ============================================================================

interface CacheEntry {
  prompt: LoadedPrompt;
  expiresAt: number;
}

const promptCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(featureKey: string, userId?: string): string {
  return userId ? `${featureKey}:${userId}` : `${featureKey}:system`;
}

function getFromCache(key: string): LoadedPrompt | null {
  const entry = promptCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.prompt;
  }
  if (entry) {
    promptCache.delete(key);
  }
  return null;
}

function setCache(key: string, prompt: LoadedPrompt): void {
  promptCache.set(key, {
    prompt,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function clearPromptCache(featureKey?: string, userId?: string): void {
  if (featureKey && userId) {
    promptCache.delete(getCacheKey(featureKey, userId));
  } else if (featureKey) {
    // Clear all entries for this feature
    for (const key of promptCache.keys()) {
      if (key.startsWith(`${featureKey}:`)) {
        promptCache.delete(key);
      }
    }
  } else {
    promptCache.clear();
  }
}

// ============================================================================
// Core Service Functions
// ============================================================================

/**
 * Load a prompt template by feature key.
 * Checks database first (user override, then system), falls back to TypeScript default.
 */
export async function loadPrompt(
  featureKey: string,
  userId?: string,
  skipCache = false
): Promise<LoadedPrompt> {
  const cacheKey = getCacheKey(featureKey, userId);

  // Check cache first
  if (!skipCache) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return cached;
    }
  }

  // Try to load from database
  const dbPrompt = await loadPromptFromDB(featureKey, userId);
  if (dbPrompt) {
    setCache(cacheKey, dbPrompt);
    return dbPrompt;
  }

  // Fall back to default template
  const defaultTemplate = DEFAULT_TEMPLATES[featureKey];
  if (!defaultTemplate) {
    throw new Error(`Unknown prompt feature key: ${featureKey}`);
  }

  const result: LoadedPrompt = {
    template: defaultTemplate,
    modelConfig: FEATURE_MODEL_DEFAULTS[featureKey] || FEATURE_MODEL_DEFAULTS.workflow_default,
    source: 'default',
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Load prompt from database.
 * Checks for user-specific override first, then system prompts.
 */
async function loadPromptFromDB(
  featureKey: string,
  userId?: string
): Promise<LoadedPrompt | null> {
  try {
    // First, try to find user-specific override
    if (userId) {
      const { data: userPrompt } = await supabase
        .from('ai_prompt_templates')
        .select('*')
        .eq('user_id', userId)
        .eq('category', featureKey)
        .single();

      if (userPrompt) {
        return convertDBPromptToLoaded(userPrompt);
      }
    }

    // Then, try to find a public system prompt
    const { data: systemPrompt } = await supabase
      .from('ai_prompt_templates')
      .select('*')
      .eq('category', featureKey)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (systemPrompt) {
      return convertDBPromptToLoaded(systemPrompt);
    }

    return null;
  } catch (error) {
    // Log error but don't throw - we'll fall back to defaults
    console.warn(`Failed to load prompt from DB for ${featureKey}:`, error);
    return null;
  }
}

/**
 * Convert database prompt record to LoadedPrompt format.
 */
function convertDBPromptToLoaded(dbPrompt: DBPromptTemplate): LoadedPrompt {
  const template: PromptTemplate = {
    id: dbPrompt.id,
    name: dbPrompt.name,
    description: dbPrompt.description || '',
    featureKey: dbPrompt.category || '',
    systemPrompt: dbPrompt.system_prompt || '',
    userPrompt: dbPrompt.user_prompt || '',
    variables: dbPrompt.variables || [],
    responseFormat: 'text', // Default, could be stored in DB
  };

  const modelConfig: ModelConfig = {
    model: dbPrompt.model || FEATURE_MODEL_DEFAULTS.workflow_default.model,
    temperature: dbPrompt.temperature || 0.7,
    maxTokens: dbPrompt.max_tokens || 2048,
  };

  return {
    template,
    modelConfig,
    source: 'database',
    dbId: dbPrompt.id,
  };
}

/**
 * Build a complete prompt configuration ready for API call.
 * Loads the template, interpolates variables, and returns execution config.
 */
export async function buildPromptForExecution(
  featureKey: string,
  variables: Record<string, any>,
  options: {
    userId?: string;
    modelOverride?: Partial<ModelConfig>;
    skipCache?: boolean;
  } = {}
): Promise<PromptExecutionConfig> {
  const { userId, modelOverride, skipCache } = options;

  const loaded = await loadPrompt(featureKey, userId, skipCache);

  const finalConfig = {
    ...loaded.modelConfig,
    ...modelOverride,
  };

  return {
    systemPrompt: interpolatePrompt(loaded.template.systemPrompt, variables),
    userPrompt: interpolatePrompt(loaded.template.userPrompt, variables),
    model: finalConfig.model,
    temperature: finalConfig.temperature,
    maxTokens: finalConfig.maxTokens,
    source: loaded.source,
  };
}

// ============================================================================
// CRUD Operations for User Prompts
// ============================================================================

/**
 * Save a custom prompt for a user.
 */
export async function saveUserPrompt(
  userId: string,
  featureKey: string,
  promptData: {
    name: string;
    description?: string;
    systemPrompt: string;
    userPrompt: string;
    variables?: PromptVariable[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<DBPromptTemplate> {
  const { data, error } = await supabase
    .from('ai_prompt_templates')
    .upsert(
      {
        user_id: userId,
        category: featureKey,
        name: promptData.name,
        description: promptData.description,
        system_prompt: promptData.systemPrompt,
        user_prompt: promptData.userPrompt,
        variables: promptData.variables || [],
        model: promptData.model,
        temperature: promptData.temperature,
        max_tokens: promptData.maxTokens,
        is_public: false,
      },
      {
        onConflict: 'user_id,category',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save prompt: ${error.message}`);
  }

  // Clear cache for this feature/user
  clearPromptCache(featureKey, userId);

  return data;
}

/**
 * Get all custom prompts for a user.
 */
export async function getUserPrompts(userId: string): Promise<DBPromptTemplate[]> {
  const { data, error } = await supabase
    .from('ai_prompt_templates')
    .select('*')
    .eq('user_id', userId)
    .order('category', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch user prompts: ${error.message}`);
  }

  return data || [];
}

/**
 * Delete a user's custom prompt (revert to default).
 */
export async function deleteUserPrompt(userId: string, featureKey: string): Promise<void> {
  const { error } = await supabase
    .from('ai_prompt_templates')
    .delete()
    .eq('user_id', userId)
    .eq('category', featureKey);

  if (error) {
    throw new Error(`Failed to delete prompt: ${error.message}`);
  }

  // Clear cache
  clearPromptCache(featureKey, userId);
}

/**
 * Reset a prompt to default (same as delete).
 */
export async function resetPromptToDefault(
  userId: string,
  featureKey: string
): Promise<void> {
  return deleteUserPrompt(userId, featureKey);
}

// ============================================================================
// Admin Functions
// ============================================================================

/**
 * Get all available prompt templates (defaults + user customizations).
 */
export async function getAllPromptTemplates(userId?: string): Promise<
  Array<{
    featureKey: string;
    name: string;
    description: string;
    hasCustomization: boolean;
    source: 'default' | 'database';
  }>
> {
  // Get all default templates
  const defaults = Object.entries(DEFAULT_TEMPLATES).map(([key, template]) => ({
    featureKey: key,
    name: template.name,
    description: template.description,
    hasCustomization: false,
    source: 'default' as const,
  }));

  // If no user, return defaults only
  if (!userId) {
    return defaults;
  }

  // Get user customizations
  const userPrompts = await getUserPrompts(userId);
  const userCustomizations = new Set(userPrompts.map((p) => p.category));

  // Mark which ones have customizations
  return defaults.map((d) => ({
    ...d,
    hasCustomization: userCustomizations.has(d.featureKey),
  }));
}

/**
 * Get the default template for a feature (ignores database).
 */
export function getDefaultTemplate(featureKey: string): PromptTemplate | null {
  return DEFAULT_TEMPLATES[featureKey] || null;
}

/**
 * List all available feature keys.
 */
export function listFeatureKeys(): string[] {
  return Object.keys(DEFAULT_TEMPLATES);
}

// ============================================================================
// Export for Edge Functions
// ============================================================================

/**
 * Create a prompt loader for edge functions.
 * This returns a simplified interface suitable for edge function use.
 */
export function createEdgeFunctionPromptLoader(supabaseClient: any) {
  return {
    async load(
      featureKey: string,
      variables: Record<string, any>,
      userId?: string
    ): Promise<PromptExecutionConfig> {
      // In edge functions, we query directly
      let dbPrompt = null;

      try {
        // Try user-specific first
        if (userId) {
          const { data } = await supabaseClient
            .from('ai_prompt_templates')
            .select('*')
            .eq('user_id', userId)
            .eq('category', featureKey)
            .single();
          dbPrompt = data;
        }

        // Then try system prompt
        if (!dbPrompt) {
          const { data } = await supabaseClient
            .from('ai_prompt_templates')
            .select('*')
            .eq('category', featureKey)
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          dbPrompt = data;
        }
      } catch {
        // Continue to default
      }

      if (dbPrompt) {
        return {
          systemPrompt: interpolatePrompt(dbPrompt.system_prompt || '', variables),
          userPrompt: interpolatePrompt(dbPrompt.user_prompt || '', variables),
          model: dbPrompt.model || FEATURE_MODEL_DEFAULTS[featureKey]?.model || 'claude-haiku-4-5-20251001',
          temperature: dbPrompt.temperature || 0.7,
          maxTokens: dbPrompt.max_tokens || 2048,
          source: 'database',
        };
      }

      // Fall back to default
      const template = DEFAULT_TEMPLATES[featureKey];
      const config = FEATURE_MODEL_DEFAULTS[featureKey] || FEATURE_MODEL_DEFAULTS.workflow_default;

      if (!template) {
        throw new Error(`Unknown prompt feature key: ${featureKey}`);
      }

      return {
        systemPrompt: interpolatePrompt(template.systemPrompt, variables),
        userPrompt: interpolatePrompt(template.userPrompt, variables),
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        source: 'default',
      };
    },
  };
}
