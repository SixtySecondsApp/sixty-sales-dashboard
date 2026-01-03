/**
 * Skills Runtime for Proactive Notifications
 * 
 * Cron-safe runtime for executing AI skills in edge functions.
 * Loads skill templates, builds context, and calls Claude API to produce structured JSON.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadPrompt, interpolateVariables } from './promptLoader.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

// Skills that require web search capabilities (routed to Gemini)
const WEB_SEARCH_SKILLS = [
  'lead-research',
  'company-analysis',
  'competitor-intel',
  'market-research',
  'industry-trends',
];

export interface SkillContext {
  [key: string]: any;
}

export interface SkillExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  model?: string;
  tokensUsed?: number;
  sources?: Array<{ title?: string; uri?: string }>;
}

/**
 * Execute a skill using Gemini 3 Flash with Google Search grounding
 *
 * Used for research skills that benefit from real-time web search:
 * - lead-research: Company research with current news and stakeholders
 * - company-analysis: Business analysis with market data
 * - competitor-intel: Competitive intelligence with recent developments
 *
 * @param supabase - Supabase client (service role)
 * @param skillKey - Skill key
 * @param context - Context variables for interpolation
 * @param enableWebSearch - Whether to enable Google Search grounding (default: true)
 * @returns Structured JSON output with web sources
 */
export async function runSkillWithGemini(
  supabase: SupabaseClient,
  skillKey: string,
  context: SkillContext,
  enableWebSearch: boolean = true
): Promise<SkillExecutionResult> {
  if (!GEMINI_API_KEY) {
    console.warn('[skillsRuntime] GEMINI_API_KEY not set, falling back to Claude');
    return {
      success: false,
      error: 'Gemini API key not configured',
    };
  }

  try {
    // Load prompt configuration
    const promptConfig = await loadPrompt(supabase, skillKey);

    if (!promptConfig) {
      return {
        success: false,
        error: `Prompt not found: ${skillKey}`,
        output: getFallbackOutput(skillKey, context),
      };
    }

    // Interpolate variables in user prompt
    const userPrompt = interpolateVariables(promptConfig.userPrompt, context);
    const systemPrompt = interpolateVariables(promptConfig.systemPrompt, context);

    // Build Gemini request body
    // Note: responseMimeType: 'application/json' is NOT compatible with Google Search grounding
    // So we omit it when using web search and parse JSON from text response instead
    const generationConfig: Record<string, unknown> = {
      temperature: promptConfig.temperature || 0.7,
      maxOutputTokens: promptConfig.maxTokens || 4096,
    };

    // Only add JSON mime type if NOT using web search (they're incompatible)
    if (!enableWebSearch) {
      generationConfig.responseMimeType = 'application/json';
    }

    const requestBody: Record<string, unknown> = {
      contents: [{
        parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
      }],
      generationConfig,
    };

    // Enable Google Search grounding for web search capability
    if (enableWebSearch) {
      requestBody.tools = [{ googleSearch: {} }];
    }

    console.log(`[skillsRuntime] Calling Gemini for ${skillKey} with web search: ${enableWebSearch}`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // Debug logging for Gemini response
    console.log(`[skillsRuntime] Gemini response status: ${response.status}`);
    console.log(`[skillsRuntime] Gemini candidates count: ${data.candidates?.length || 0}`);
    if (data.candidates?.[0]?.finishReason) {
      console.log(`[skillsRuntime] Gemini finish reason: ${data.candidates[0].finishReason}`);
    }
    if (data.error) {
      console.error(`[skillsRuntime] Gemini API error in response:`, JSON.stringify(data.error));
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log(`[skillsRuntime] Gemini response text length: ${text.length} chars`);

    // Extract grounding sources from web search results
    const groundingMetadata = data.candidates?.[0]?.groundingMetadata;
    const sources: Array<{ title?: string; uri?: string }> = [];

    if (groundingMetadata?.groundingChunks) {
      for (const chunk of groundingMetadata.groundingChunks) {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title,
            uri: chunk.web.uri,
          });
        }
      }
    }

    // Parse JSON output
    let output;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
                       text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      output = JSON.parse(jsonStr);

      // Attach sources to output if available
      if (sources.length > 0) {
        output.sources = sources;
      }
    } catch (parseError) {
      console.warn('[skillsRuntime] Failed to parse Gemini JSON, returning raw text');
      output = { raw: text, sources };
    }

    console.log(`[skillsRuntime] Gemini skill ${skillKey} completed with ${sources.length} sources`);

    return {
      success: true,
      output,
      model: 'gemini-2.0-flash',
      sources,
      tokensUsed: data.usageMetadata?.totalTokenCount,
    };
  } catch (error) {
    console.error(`[skillsRuntime] Gemini error for ${skillKey}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Gemini error',
      output: getFallbackOutput(skillKey, context),
    };
  }
}

/**
 * Execute a skill for proactive notifications
 * 
 * @param supabase - Supabase client (service role)
 * @param skillKey - Skill key (prompt feature key or skill_id)
 * @param context - Context variables for interpolation
 * @param orgId - Organization ID (for loading org-specific skills)
 * @param userId - User ID (optional, for user-specific prompts)
 * @returns Structured JSON output
 */
export async function runSkill(
  supabase: SupabaseClient,
  skillKey: string,
  context: SkillContext,
  orgId?: string,
  userId?: string
): Promise<SkillExecutionResult> {
  // Route web search skills to Gemini with Google Search grounding
  if (WEB_SEARCH_SKILLS.includes(skillKey)) {
    console.log(`[skillsRuntime] Routing ${skillKey} to Gemini with web search`);
    const geminiResult = await runSkillWithGemini(supabase, skillKey, context, true);

    // If Gemini succeeds, return its result
    if (geminiResult.success) {
      return geminiResult;
    }

    // If Gemini fails (e.g., no API key), fall back to Claude
    console.warn(`[skillsRuntime] Gemini failed for ${skillKey}, falling back to Claude`);
  }

  if (!ANTHROPIC_API_KEY) {
    console.warn('[skillsRuntime] ANTHROPIC_API_KEY not set, returning fallback');
    return {
      success: false,
      error: 'AI API key not configured',
      output: getFallbackOutput(skillKey, context),
    };
  }

  try {
    // Try to load prompt from database (org/user-specific or platform default)
    let promptConfig;
    try {
      promptConfig = await loadPrompt(supabase, skillKey, userId || undefined);
    } catch (error) {
      console.warn(`[skillsRuntime] Failed to load prompt for ${skillKey}, using default`);
      // Will use default from promptLoader if available
      promptConfig = await loadPrompt(supabase, skillKey, userId || undefined);
    }

    if (!promptConfig) {
      return {
        success: false,
        error: `Prompt not found: ${skillKey}`,
        output: getFallbackOutput(skillKey, context),
      };
    }

    // Interpolate variables in prompts
    const systemPrompt = interpolateVariables(promptConfig.systemPrompt, context);
    const userPrompt = interpolateVariables(promptConfig.userPrompt, context);

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: promptConfig.model || DEFAULT_MODEL,
        max_tokens: promptConfig.maxTokens || 2048,
        temperature: promptConfig.temperature || 0.7,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userPrompt,
        }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Claude API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    // Parse JSON output
    let output;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                       content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      output = JSON.parse(jsonStr);
    } catch (parseError) {
      // If JSON parsing fails, return raw text
      console.warn('[skillsRuntime] Failed to parse JSON, returning raw text');
      output = { raw: content };
    }

    return {
      success: true,
      output,
      model: promptConfig.model || DEFAULT_MODEL,
      tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
    };
  } catch (error) {
    console.error(`[skillsRuntime] Error executing skill ${skillKey}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      output: getFallbackOutput(skillKey, context),
    };
  }
}

/**
 * Get fallback output when AI is unavailable
 */
function getFallbackOutput(skillKey: string, context: SkillContext): any {
  // Provide deterministic fallbacks for common skills
  if (skillKey.includes('morning') || skillKey.includes('brief')) {
    return {
      insights: ['Review your calendar for today', 'Check overdue tasks', 'Follow up on pending deals'],
      priorities: ['Complete overdue tasks', 'Prepare for upcoming meetings'],
    };
  }

  if (skillKey.includes('meeting') || skillKey.includes('prep')) {
    return {
      talkingPoints: [
        'Review previous discussions',
        'Understand current priorities',
        'Identify next steps',
      ],
    };
  }

  if (skillKey.includes('followup') || skillKey.includes('email')) {
    return {
      draft: 'Thank you for your time. I wanted to follow up on our conversation...',
    };
  }

  return {
    message: 'AI processing unavailable. Please review manually.',
  };
}

/**
 * Execute multiple skills in parallel
 */
export async function runSkills(
  supabase: SupabaseClient,
  skills: Array<{ key: string; context: SkillContext }>,
  orgId?: string,
  userId?: string
): Promise<Record<string, SkillExecutionResult>> {
  const results: Record<string, SkillExecutionResult> = {};

  await Promise.all(
    skills.map(async ({ key, context }) => {
      results[key] = await runSkill(supabase, key, context, orgId, userId);
    })
  );

  return results;
}
