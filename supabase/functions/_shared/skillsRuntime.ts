/**
 * Skills Runtime for Proactive Notifications
 * 
 * Cron-safe runtime for executing AI skills in edge functions.
 * Loads skill templates, builds context, and calls Claude API to produce structured JSON.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadPrompt, interpolateVariables } from './promptLoader.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

export interface SkillContext {
  [key: string]: any;
}

export interface SkillExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  model?: string;
  tokensUsed?: number;
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
