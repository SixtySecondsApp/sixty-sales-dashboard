/**
 * Prompt Loader for Edge Functions
 *
 * Loads AI prompts dynamically from the database with fallback to defaults.
 * Includes caching for performance optimization.
 *
 * Usage:
 * ```typescript
 * import { loadPrompt, interpolateVariables } from '../_shared/promptLoader.ts';
 *
 * const prompt = await loadPrompt(supabase, 'email_analysis', userId);
 * const finalPrompt = interpolateVariables(prompt.userPrompt, { subject, body });
 * ```
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// ============================================================================
// Types
// ============================================================================

export interface PromptConfig {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  source: 'database' | 'default';
}

export interface DBPrompt {
  id: string;
  system_prompt: string | null;
  user_prompt: string | null;
  model: string | null;
  temperature: number | null;
  max_tokens: number | null;
}

// ============================================================================
// Default Prompts (Fallback when database is empty)
// ============================================================================

const DEFAULT_PROMPTS: Record<string, PromptConfig> = {
  email_analysis: {
    systemPrompt: `You are an expert email analyst who extracts key insights from sales communications.

Your task is to analyze email content and provide structured data for CRM health tracking.

Focus on:
- Overall sentiment and tone
- Main topics discussed
- Action items mentioned
- Urgency indicators
- Response expectations`,
    userPrompt: `Analyze this sales email for CRM health tracking.

SUBJECT: \${subject}

BODY:
\${body}

Provide a JSON response with:
1. sentiment_score: Number from -1 (very negative) to 1 (very positive)
2. key_topics: Array of 2-5 main topics discussed
3. action_items: Array of any action items mentioned
4. urgency: "low", "medium", or "high"
5. response_required: Boolean indicating if sender expects a response

RESPOND ONLY WITH VALID JSON.`,
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.3,
    maxTokens: 1024,
    source: 'default',
  },

  suggest_next_actions: {
    systemPrompt: `You are a senior sales strategist AI assistant. Your role is to analyze sales activities and suggest the most impactful next steps.

CONTEXT ANALYSIS FRAMEWORK:
- Activity recency and patterns
- Deal stage and momentum
- Contact engagement level
- Company relationship strength`,
    userPrompt: `Based on this sales context, suggest 2-4 prioritized next actions.

ACTIVITY CONTEXT:
\${activityContext}

RECENT ACTIVITIES:
\${recentActivities}

EXISTING TASKS:
\${existingTasks}

Return a JSON array with suggestions including action_type, title, reasoning, urgency, recommended_deadline, and confidence_score.`,
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.7,
    maxTokens: 2048,
    source: 'default',
  },

  writing_style: {
    systemPrompt: `You are an expert linguistic analyst who extracts writing style patterns from email communications.

Focus on HOW they write, not WHAT they write about:
- Tone and formality level
- Sentence structure and length patterns
- Vocabulary complexity and common phrases
- Greeting and sign-off patterns`,
    userPrompt: `Analyze these \${emailCount} sent emails and extract the writer's unique voice and communication style.

EMAILS TO ANALYZE:
\${emailSamples}

Return a JSON object with name, tone_description, tone metrics, structure, vocabulary, greetings_signoffs, example_excerpts, and analysis_confidence.`,
    model: 'claude-3-5-sonnet-20241022',
    temperature: 0.5,
    maxTokens: 2048,
    source: 'default',
  },

  transcript_analysis: {
    systemPrompt: `You are an expert meeting analyst. Analyze meeting transcripts to extract actionable insights for sales teams.`,
    userPrompt: `Analyze this meeting transcript and provide structured insights.

MEETING: \${meetingTitle}
DATE: \${meetingDate}

TRANSCRIPT:
\${transcript}

Return JSON with summary, key_topics, action_items, sentiment, follow_ups, and risks.`,
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.5,
    maxTokens: 4096,
    source: 'default',
  },

  proposal_focus_areas: {
    systemPrompt: `You are an expert at analyzing sales meeting transcripts to identify key focus areas for proposals.`,
    userPrompt: `Analyze this transcript and identify 3-5 key focus areas for the proposal.

MEETING WITH: \${contactName} at \${companyName}

TRANSCRIPT:
\${transcript}

Return JSON array with area, description, evidence, and priority for each focus area.`,
    model: 'anthropic/claude-haiku-4.5',
    temperature: 0.5,
    maxTokens: 2048,
    source: 'default',
  },

  proposal_goals: {
    systemPrompt: `You are a strategic proposal consultant. Create compelling goals that resonate with the prospect's needs.`,
    userPrompt: `Create 3-5 strategic goals for the proposal.

PROSPECT: \${contactName} at \${companyName}

FOCUS AREAS:
\${focusAreas}

Return JSON array with goal, rationale, metrics, and timeline for each.`,
    model: 'anthropic/claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 4096,
    source: 'default',
  },

  proposal_sow: {
    systemPrompt: `You are an expert proposal writer creating professional Statements of Work.`,
    userPrompt: `Create a professional Statement of Work for \${companyName}.

GOALS:
\${goals}

FOCUS AREAS:
\${focusAreas}

Create a detailed SOW in markdown format.`,
    model: 'anthropic/claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 8192,
    source: 'default',
  },

  condense_summary: {
    systemPrompt: `You are a concise summarizer. Create brief, impactful summaries.`,
    userPrompt: `Condense this meeting summary into two one-liners (max 15 words each).

MEETING: \${meetingTitle}

SUMMARY:
\${summary}

Return JSON with meeting_about and next_steps.`,
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.3,
    maxTokens: 256,
    source: 'default',
  },

  action_item_analysis: {
    systemPrompt: `You are an expert at categorizing action items and determining ideal deadlines.`,
    userPrompt: `Analyze this action item from the meeting.

MEETING: \${meetingTitle}
SUMMARY: \${meetingSummary}
ACTION ITEM: \${actionItem}
CURRENT DATE: \${today}

Return JSON with task_type, ideal_deadline (YYYY-MM-DD), confidence_score, and reasoning.`,
    model: 'claude-haiku-4-20250514',
    temperature: 0.3,
    maxTokens: 500,
    source: 'default',
  },

  meeting_qa: {
    systemPrompt: `You are a helpful assistant that answers questions about meeting transcripts. Be specific and reference the transcript when possible.`,
    userPrompt: `Answer this question about the meeting.

MEETING: \${meetingTitle}
DATE: \${meetingDate}

TRANSCRIPT:
\${transcript}

QUESTION: \${question}`,
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.7,
    maxTokens: 2048,
    source: 'default',
  },

  content_topics: {
    systemPrompt: `You are a content strategist identifying marketable topics from meeting discussions.`,
    userPrompt: `Extract 5-10 marketable discussion topics from this transcript.

MEETING: \${meetingTitle}
DATE: \${meetingDate}

TRANSCRIPT:
\${transcript}

Return JSON array with title, description, timestamp_seconds, and fathom_url for each topic.`,
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.3,
    maxTokens: 4096,
    source: 'default',
  },

  generate_actions: {
    systemPrompt: `You are a sales action generator. Create specific, actionable follow-up tasks.`,
    userPrompt: `Generate \${maxActions} additional action items from this meeting.

MEETING: \${meetingTitle}
COMPANY: \${companyName}
CONTACT: \${contactName}

ALREADY TRACKED:
\${existingTasksContext}

TRANSCRIPT:
\${transcript}

Return JSON array with task_type, title, description, priority, estimated_days_to_complete, and timestamp_seconds.`,
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.3,
    maxTokens: 2048,
    source: 'default',
  },

  search_query_parse: {
    systemPrompt: `You parse search queries to extract semantic intent and structured filters.`,
    userPrompt: `Parse this search query into semantic and structured components.

TODAY: \${today}
QUERY: "\${query}"

Return JSON with semantic_query and structured_filters (date_range, company_name, contact_name, sentiment, has_action_items).`,
    model: 'claude-sonnet-4-20250514',
    temperature: 0.3,
    maxTokens: 500,
    source: 'default',
  },

  // ============================================================================
  // Onboarding - Organization Enrichment
  // ============================================================================

  organization_data_collection: {
    systemPrompt: `You are an expert business intelligence analyst. Your task is to extract structured company information from website content.

CRITICAL REQUIREMENTS:
1. Extract EXACT product names as written on the website (e.g., "Stripe Payments", "Stripe Billing", "Stripe Connect" - NOT "payment processing", "billing system", "marketplace payments")
2. Use VERBATIM quotes from their marketing copy for taglines and value propositions
3. Extract ACTUAL customer names if visible (e.g., "Amazon, Shopify, Zoom" - NOT "major tech companies")
4. Be specific about pricing tiers and feature names as they appear on the site
5. Only include information you can directly observe in the provided content`,
    userPrompt: `Analyze the following website content for \${domain} and extract structured company data.

**Raw Website Content:**
\${websiteContent}

**Extract this information in JSON format:**
{
  "company": {
    "name": "Official company name",
    "tagline": "Main value proposition or tagline",
    "description": "2-3 sentence company description",
    "founded_year": null,
    "headquarters": "City, Country if mentioned",
    "employee_count": "Range like '10-50' or '100-500' if mentioned"
  },
  "classification": {
    "industry": "Primary industry",
    "sub_industry": "Specific niche",
    "business_model": "B2B, B2C, B2B2C, etc.",
    "company_stage": "startup, scaleup, enterprise, etc."
  },
  "offering": {
    "products": [
      {"name": "Product name", "description": "Brief description", "pricing_tier": "free/starter/pro/enterprise if mentioned"}
    ],
    "services": ["List of services offered"],
    "key_features": ["Top 5-10 features mentioned"],
    "integrations": ["Any integrations mentioned"]
  },
  "market": {
    "target_industries": ["Industries they serve"],
    "target_company_sizes": ["SMB, Mid-market, Enterprise, etc."],
    "target_roles": ["Job titles they target"],
    "use_cases": ["Primary use cases mentioned"],
    "customer_logos": ["Any customer names/logos visible"],
    "case_study_customers": ["Customers mentioned in case studies"]
  },
  "positioning": {
    "competitors": ["Any competitors mentioned or implied"],
    "differentiators": ["What makes them unique"],
    "pain_points_addressed": ["Problems they solve"]
  },
  "voice": {
    "tone": ["professional", "casual", "technical", "friendly", etc.],
    "key_phrases": ["Distinctive phrases they use repeatedly"],
    "content_samples": ["2-3 representative sentences from their copy"]
  },
  "salesContext": {
    "pricing_model": "subscription, usage-based, one-time, etc.",
    "sales_motion": "self-serve, sales-led, product-led, etc.",
    "buying_signals": ["Signals that indicate purchase readiness"],
    "common_objections": ["Likely objections based on offering"]
  }
}

**Important:**
- Only include fields where you found actual evidence
- Use null for fields with no information
- Be specific - use actual product names, customer names, and terms from their content
- Extract actual quotes for content_samples and key_phrases

Return ONLY valid JSON, no markdown formatting.`,
    model: 'gemini-3-flash-preview',
    temperature: 0.3,
    maxTokens: 4096,
    source: 'default',
  },

  organization_skill_generation: {
    systemPrompt: `You are an expert sales AI trainer. Your task is to generate personalized skill configurations for a sales AI assistant based on company intelligence.

CRITICAL: Use SPECIFIC product names and terminology from the company intelligence:
- BAD: "Are you interested in our payment solution?"
- GOOD: "Are you looking at Stripe Payments for online transactions, or Stripe Terminal for in-person?"

- BAD: "Our platform helps with billing"
- GOOD: "Stripe Billing automates recurring revenue with usage-based pricing, invoicing, and revenue recovery"

- BAD: "We compete with other payment providers"
- GOOD: "Unlike PayPal or Square, Stripe Connect handles complex marketplace payouts to thousands of sellers"

Every discovery question, objection response, and example message MUST reference ACTUAL product names from the provided intelligence.`,
    userPrompt: `Using the following company intelligence for \${domain}, generate personalized sales AI skill configurations.

**Company Intelligence:**
\${companyIntelligence}

**Generate configurations for these 6 skills:**

1. **lead_qualification** - Discovery questions and scoring criteria specific to their products
2. **lead_enrichment** - What information to gather about prospects in their market
3. **brand_voice** - How the AI should communicate to match their brand
4. **objection_handling** - Responses to common objections in their space
5. **icp** - Ideal Customer Profile criteria for their target market
6. **handoff_rules** - When and how to escalate to human sales reps

**Output Format:**
{
  "lead_qualification": {
    "discovery_questions": [
      "Specific question using their product/service names...",
      "Question about pain points they solve...",
      "Budget/timeline qualification question..."
    ],
    "qualification_criteria": [
      {"criterion": "Has budget over $X", "weight": "high"},
      {"criterion": "In target industry", "weight": "medium"}
    ],
    "disqualifiers": ["Red flags that indicate not a fit"]
  },
  "lead_enrichment": {
    "priority_fields": [
      {"field": "company_size", "why": "They target mid-market"},
      {"field": "tech_stack", "why": "Important for integration fit"}
    ],
    "discovery_questions": [
      "What does your current workflow look like?",
      "Question specific to their use cases..."
    ],
    "enrichment_sources": ["linkedin", "crunchbase", "company_website"]
  },
  "brand_voice": {
    "tone": ["professional", "innovative", etc. from their content],
    "personality_traits": ["helpful", "expert", "friendly"],
    "key_phrases_to_use": ["Phrases from their actual content"],
    "phrases_to_avoid": ["Competitor terminology", "Industry jargon they don't use"],
    "example_messages": [
      "Hi {name}, I noticed you're looking at [product]. Companies like [customer] use it to...",
      "Great question! Our [feature] helps teams..."
    ]
  },
  "objection_handling": {
    "objections": [
      {
        "trigger_phrases": ["too expensive", "budget concerns"],
        "objection_type": "price",
        "response": "Specific response mentioning their value props and ROI...",
        "follow_up": "What's your current spend on [problem they solve]?"
      },
      {
        "trigger_phrases": ["why not [competitor]"],
        "objection_type": "competition",
        "response": "Response highlighting their specific differentiators...",
        "follow_up": "What's most important to you in a solution?"
      }
    ]
  },
  "icp": {
    "company_profile": {
      "industries": ["From their target market"],
      "company_sizes": ["From their customer base"],
      "geographies": ["Regions they serve"],
      "technologies": ["Tech stack indicators"]
    },
    "buyer_persona": {
      "titles": ["Job titles they target"],
      "responsibilities": ["What these people care about"],
      "pain_points": ["From their marketing"],
      "goals": ["What success looks like for them"]
    },
    "buying_signals": [
      "Specific signals indicating purchase readiness...",
      "Events or triggers that indicate need..."
    ],
    "negative_signals": ["Signals indicating not a fit"]
  },
  "handoff_rules": {
    "escalation_triggers": [
      {"trigger": "Mentions enterprise deal over $50k", "priority": "high", "reason": "Large deal needs sales involvement"},
      {"trigger": "Asks for custom pricing", "priority": "medium", "reason": "Needs human negotiation"},
      {"trigger": "Technical integration questions", "priority": "medium", "reason": "Needs SE support"}
    ],
    "handoff_message_template": "I'd love to connect you with our team who can help with [specific need]. They'll reach out within [timeframe].",
    "information_to_capture": ["Budget range", "Timeline", "Decision maker status", "Specific requirements"]
  }
}

**Requirements:**
- Use SPECIFIC information from the company intelligence
- Include actual product names, customer names, competitor names
- Make discovery questions relevant to their specific offerings
- Objection responses should reference their actual differentiators
- All content should feel customized to this specific company

Return ONLY valid JSON, no markdown formatting.`,
    model: 'gemini-3-flash-preview',
    temperature: 0.4,
    maxTokens: 6000,
    source: 'default',
  },
};

// ============================================================================
// Cache Management
// ============================================================================

interface CacheEntry {
  config: PromptConfig;
  expiresAt: number;
}

const promptCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(featureKey: string, userId?: string): string {
  return userId ? `${featureKey}:${userId}` : `${featureKey}:system`;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Load a prompt configuration by feature key.
 * Checks database first (user override, then system), falls back to defaults.
 */
export async function loadPrompt(
  supabase: SupabaseClient,
  featureKey: string,
  userId?: string,
  skipCache = false
): Promise<PromptConfig> {
  const cacheKey = getCacheKey(featureKey, userId);

  // Check cache first
  if (!skipCache) {
    const cached = promptCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.config;
    }
  }

  // Try database
  const dbConfig = await loadFromDatabase(supabase, featureKey, userId);
  if (dbConfig) {
    promptCache.set(cacheKey, {
      config: dbConfig,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return dbConfig;
  }

  // Fall back to defaults
  const defaultConfig = DEFAULT_PROMPTS[featureKey];
  if (!defaultConfig) {
    throw new Error(`Unknown prompt feature key: ${featureKey}`);
  }

  promptCache.set(cacheKey, {
    config: defaultConfig,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return defaultConfig;
}

/**
 * Load prompt from database.
 */
async function loadFromDatabase(
  supabase: SupabaseClient,
  featureKey: string,
  userId?: string
): Promise<PromptConfig | null> {
  try {
    // Try user-specific override first
    if (userId) {
      const { data: userPrompt } = await supabase
        .from('ai_prompt_templates')
        .select('system_prompt, user_prompt, model, temperature, max_tokens')
        .eq('user_id', userId)
        .eq('category', featureKey)
        .single();

      if (userPrompt && (userPrompt.system_prompt || userPrompt.user_prompt)) {
        return convertToConfig(userPrompt, featureKey);
      }
    }

    // Try system prompt
    const { data: systemPrompt } = await supabase
      .from('ai_prompt_templates')
      .select('system_prompt, user_prompt, model, temperature, max_tokens')
      .eq('category', featureKey)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (systemPrompt && (systemPrompt.system_prompt || systemPrompt.user_prompt)) {
      return convertToConfig(systemPrompt, featureKey);
    }

    return null;
  } catch (error) {
    // Silently fall back to defaults
    console.warn(`[promptLoader] Failed to load from DB for ${featureKey}:`, error);
    return null;
  }
}

/**
 * Convert database record to PromptConfig.
 */
function convertToConfig(dbPrompt: DBPrompt, featureKey: string): PromptConfig {
  const defaults = DEFAULT_PROMPTS[featureKey] || {
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.7,
    maxTokens: 2048,
  };

  return {
    systemPrompt: dbPrompt.system_prompt || defaults.systemPrompt || '',
    userPrompt: dbPrompt.user_prompt || defaults.userPrompt || '',
    model: dbPrompt.model || defaults.model,
    temperature: dbPrompt.temperature ?? defaults.temperature,
    maxTokens: dbPrompt.max_tokens ?? defaults.maxTokens,
    source: 'database',
  };
}

/**
 * Interpolate variables into a prompt template.
 * Replaces ${variableName} and \${variableName} patterns.
 */
export function interpolateVariables(
  template: string,
  variables: Record<string, any>
): string {
  // Handle both escaped (\${}) and unescaped (${}) patterns
  return template.replace(/\\?\$\{(\w+)\}/g, (match, varName) => {
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
 * Build complete prompt for API call.
 */
export async function buildPromptForAPI(
  supabase: SupabaseClient,
  featureKey: string,
  variables: Record<string, any>,
  options: {
    userId?: string;
    modelOverride?: string;
    temperatureOverride?: number;
    maxTokensOverride?: number;
  } = {}
): Promise<{
  systemPrompt: string;
  userPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
}> {
  const config = await loadPrompt(supabase, featureKey, options.userId);

  return {
    systemPrompt: interpolateVariables(config.systemPrompt, variables),
    userPrompt: interpolateVariables(config.userPrompt, variables),
    model: options.modelOverride || config.model,
    temperature: options.temperatureOverride ?? config.temperature,
    maxTokens: options.maxTokensOverride ?? config.maxTokens,
  };
}

/**
 * Clear prompt cache (useful after updates).
 */
export function clearCache(featureKey?: string): void {
  if (featureKey) {
    for (const key of promptCache.keys()) {
      if (key.startsWith(`${featureKey}:`)) {
        promptCache.delete(key);
      }
    }
  } else {
    promptCache.clear();
  }
}

/**
 * List all available feature keys.
 */
export function listFeatureKeys(): string[] {
  return Object.keys(DEFAULT_PROMPTS);
}

/**
 * Get default prompt (ignores database).
 */
export function getDefaultPrompt(featureKey: string): PromptConfig | null {
  return DEFAULT_PROMPTS[featureKey] || null;
}
