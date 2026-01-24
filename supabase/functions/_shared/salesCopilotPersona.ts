/**
 * Sales Copilot Persona Compiler
 * 
 * Compiles organization enrichment data into a specialized internal sales co-pilot persona
 * that helps reps be more successful. The persona is framed as a TEAM MEMBER, not a generic AI.
 * 
 * Used by:
 * - api-copilot (loads persona into system prompt)
 * - deep-enrich-organization (generates persona after enrichment)
 * 
 * @see docs/PRD_PROACTIVE_AI_TEAMMATE.md for full vision
 */

// ============================================================================
// Types
// ============================================================================

export interface EnrichmentContext {
  company_name?: string;
  tagline?: string;
  description?: string;
  industry?: string;
  employee_count?: string;
  products?: Array<{ name: string; description: string; pricing_tier?: string }>;
  value_propositions?: string[];
  competitors?: Array<{ name: string; domain?: string }>;
  target_market?: string;
  customer_types?: string[];
  key_features?: string[];
  pain_points?: string[];
  buying_signals?: string[];
  tech_stack?: string[];
}

export interface SkillContext {
  brand_voice?: {
    tone?: string;
    avoid?: string[];
  };
  icp?: {
    companyProfile?: string;
    buyerPersona?: string;
    buyingSignals?: string[];
  };
  objection_handling?: {
    objections?: Array<{ trigger: string; response: string }>;
  };
  copilot_personality?: {
    greeting?: string;
    personality?: string;
    focus_areas?: string[];
  };
}

export interface UserContext {
  user_id: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  bio?: string;
  working_hours_start?: string;
  working_hours_end?: string;
  timezone?: string;
}

export interface CompiledPersona {
  persona: string;
  version: string;
  compiledAt: string;
  dataHash: string;
  hasEnrichment: boolean;
  hasSkillContext: boolean;
}

// ============================================================================
// Persona Template
// ============================================================================

const PERSONA_TEMPLATE = `You are {rep_name}'s dedicated sales analyst at {company_name}. Think of yourself as their brilliant junior colleague who has superpowers — you've memorized everything about the company, you can research in seconds, and you draft emails in the perfect voice.

YOU ARE A TEAM MEMBER, NOT A GENERIC AI.
- Call them by name ({rep_first_name})
- Reference their specific deals and contacts
- Be proactive with suggestions
- Speak like a knowledgeable colleague, not a chatbot
- Never start responses with "I" — be conversational

YOUR SUPERPOWERS (Sequences):
- Meeting prep in 30 seconds
- Pipeline health check with actionable insights
- Follow-up emails in the company voice
- Deal rescue plans when things stall
- Research & competitive intel

{company_knowledge}

{writing_voice}

{objection_coaching}

HITL (always get confirmation for external actions):
- Preview emails → wait for 'Confirm' → then send
- Preview tasks → wait for 'Confirm' → then create
- Preview Slack posts → wait for 'Confirm' → then post
- NEVER send, create, or post without explicit confirmation

{user_preferences}`;

// ============================================================================
// Compile Persona
// ============================================================================

/**
 * Compiles a specialized sales copilot persona from organization enrichment data.
 * 
 * @param enrichment - Company enrichment data from organization_enrichment table
 * @param skills - Skill configurations from organization_skills table
 * @param user - User context (name, role, preferences)
 * @returns Compiled persona ready for injection into system prompt
 */
export function compileSalesCopilotPersona(
  enrichment: EnrichmentContext | null,
  skills: SkillContext | null,
  user: UserContext
): CompiledPersona {
  const repName = user.first_name && user.last_name 
    ? `${user.first_name} ${user.last_name}`
    : user.first_name || 'your';
  
  const repFirstName = user.first_name || 'there';
  const companyName = enrichment?.company_name || 'your company';
  
  // Build company knowledge section
  const companyKnowledge = buildCompanyKnowledgeSection(enrichment);
  
  // Build writing voice section
  const writingVoice = buildWritingVoiceSection(skills);
  
  // Build objection coaching section
  const objectionCoaching = buildObjectionCoachingSection(skills);
  
  // Build user preferences section
  const userPreferences = buildUserPreferencesSection(user);
  
  // Interpolate template
  let persona = PERSONA_TEMPLATE
    .replace(/{rep_name}/g, repName)
    .replace(/{rep_first_name}/g, repFirstName)
    .replace(/{company_name}/g, companyName)
    .replace(/{company_knowledge}/g, companyKnowledge)
    .replace(/{writing_voice}/g, writingVoice)
    .replace(/{objection_coaching}/g, objectionCoaching)
    .replace(/{user_preferences}/g, userPreferences);
  
  // Clean up empty sections
  persona = persona.replace(/\n{3,}/g, '\n\n').trim();
  
  // Generate data hash for cache invalidation
  const dataHash = generateDataHash(enrichment, skills, user);
  
  return {
    persona,
    version: '1.0.0',
    compiledAt: new Date().toISOString(),
    dataHash,
    hasEnrichment: !!enrichment?.company_name,
    hasSkillContext: !!skills?.brand_voice || !!skills?.icp,
  };
}

// ============================================================================
// Section Builders
// ============================================================================

function buildCompanyKnowledgeSection(enrichment: EnrichmentContext | null): string {
  if (!enrichment || !enrichment.company_name) {
    return `COMPANY KNOWLEDGE:
(No company enrichment data available. Ask the user about their company to provide better assistance.)`;
  }
  
  const parts: string[] = ['COMPANY KNOWLEDGE (you\'ve memorized this):'];
  
  // Products
  if (enrichment.products && enrichment.products.length > 0) {
    const productList = enrichment.products
      .slice(0, 5)
      .map(p => p.name + (p.description ? ` - ${p.description}` : ''))
      .join('\n  • ');
    parts.push(`- Products:\n  • ${productList}`);
  }
  
  // Competitors with positioning
  if (enrichment.competitors && enrichment.competitors.length > 0) {
    const competitorNames = enrichment.competitors.slice(0, 5).map(c => c.name).join(', ');
    parts.push(`- Competitors: ${competitorNames}`);
    
    // Add differentiators if we have value props
    if (enrichment.value_propositions && enrichment.value_propositions.length > 0) {
      const differentiators = enrichment.value_propositions.slice(0, 3).join('; ');
      parts.push(`- How we're different: ${differentiators}`);
    }
  }
  
  // Pain points
  if (enrichment.pain_points && enrichment.pain_points.length > 0) {
    const painPoints = enrichment.pain_points.slice(0, 5).join(', ');
    parts.push(`- Customer pain points we solve: ${painPoints}`);
  }
  
  // Target market / ICP
  if (enrichment.target_market) {
    parts.push(`- Target market: ${enrichment.target_market}`);
  }
  if (enrichment.customer_types && enrichment.customer_types.length > 0) {
    parts.push(`- Ideal customers: ${enrichment.customer_types.slice(0, 3).join(', ')}`);
  }
  
  // Buying signals
  if (enrichment.buying_signals && enrichment.buying_signals.length > 0) {
    const signals = enrichment.buying_signals.slice(0, 5).join(', ');
    parts.push(`- Buying signals to watch for: ${signals}`);
  }
  
  // Industry context
  if (enrichment.industry) {
    parts.push(`- Industry: ${enrichment.industry}`);
  }
  
  return parts.join('\n');
}

function buildWritingVoiceSection(skills: SkillContext | null): string {
  if (!skills?.brand_voice) {
    return '';
  }
  
  const parts: string[] = ['WRITING IN THE COMPANY VOICE:'];
  
  if (skills.brand_voice.tone) {
    parts.push(`- Tone: ${skills.brand_voice.tone}`);
  }
  
  if (skills.brand_voice.avoid && skills.brand_voice.avoid.length > 0) {
    parts.push(`- NEVER use these words/phrases: ${skills.brand_voice.avoid.join(', ')}`);
  }
  
  // Add ICP context for more targeted writing
  if (skills.icp?.buyerPersona) {
    parts.push(`- Remember the buyer persona: ${skills.icp.buyerPersona}`);
  }
  
  return parts.join('\n');
}

function buildObjectionCoachingSection(skills: SkillContext | null): string {
  if (!skills?.objection_handling?.objections || skills.objection_handling.objections.length === 0) {
    return '';
  }
  
  const parts: string[] = ['OBJECTION COACHING (when the rep asks for help with objections):'];
  
  for (const obj of skills.objection_handling.objections.slice(0, 5)) {
    parts.push(`- "${obj.trigger}" → ${obj.response}`);
  }
  
  return parts.join('\n');
}

function buildUserPreferencesSection(user: UserContext): string {
  const parts: string[] = [];
  
  // Working hours awareness
  if (user.working_hours_start && user.working_hours_end) {
    parts.push(`USER PREFERENCES:`);
    parts.push(`- Working hours: ${user.working_hours_start} - ${user.working_hours_end}${user.timezone ? ` (${user.timezone})` : ''}`);
    parts.push(`- If outside working hours, suggest scheduling actions for the next work day`);
  }
  
  // Role context
  if (user.role) {
    parts.push(`- Role: ${user.role}`);
  }
  
  return parts.join('\n');
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Generate a hash of the input data for cache invalidation.
 * When the hash changes, the persona should be regenerated.
 */
function generateDataHash(
  enrichment: EnrichmentContext | null,
  skills: SkillContext | null,
  user: UserContext
): string {
  const data = {
    e: enrichment ? {
      name: enrichment.company_name,
      products: enrichment.products?.length,
      competitors: enrichment.competitors?.length,
      painPoints: enrichment.pain_points?.length,
    } : null,
    s: skills ? {
      hasBrandVoice: !!skills.brand_voice,
      hasIcp: !!skills.icp,
      hasObjections: !!skills.objection_handling?.objections?.length,
    } : null,
    u: {
      id: user.user_id,
      name: user.first_name,
    },
  };
  
  // Simple hash function - in production you might use a proper hash
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Load enrichment context from organization_enrichment table
 */
export async function loadEnrichmentContext(
  supabase: any,
  organizationId: string
): Promise<EnrichmentContext | null> {
  const { data, error } = await supabase
    .from('organization_enrichment')
    .select(`
      company_name,
      tagline,
      description,
      industry,
      employee_count,
      products,
      value_propositions,
      competitors,
      target_market,
      pain_points,
      buying_signals,
      tech_stack
    `)
    .eq('organization_id', organizationId)
    .eq('status', 'completed')
    .maybeSingle();
  
  if (error || !data) {
    return null;
  }
  
  return {
    company_name: data.company_name,
    tagline: data.tagline,
    description: data.description,
    industry: data.industry,
    employee_count: data.employee_count,
    products: data.products,
    value_propositions: data.value_propositions,
    competitors: data.competitors,
    target_market: data.target_market,
    pain_points: data.pain_points,
    buying_signals: data.buying_signals,
    tech_stack: data.tech_stack,
  };
}

/**
 * Load skill context from organization_skills table
 */
export async function loadSkillContext(
  supabase: any,
  organizationId: string
): Promise<SkillContext | null> {
  const { data, error } = await supabase
    .from('organization_skills')
    .select('skill_id, config')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .in('skill_id', ['brand_voice', 'icp', 'objection_handling', 'copilot_personality']);
  
  if (error || !data || data.length === 0) {
    return null;
  }
  
  const context: SkillContext = {};
  
  for (const skill of data) {
    switch (skill.skill_id) {
      case 'brand_voice':
        context.brand_voice = skill.config;
        break;
      case 'icp':
        context.icp = skill.config;
        break;
      case 'objection_handling':
        context.objection_handling = skill.config;
        break;
      case 'copilot_personality':
        context.copilot_personality = skill.config;
        break;
    }
  }
  
  return context;
}

/**
 * Load user context from profiles table
 */
export async function loadUserContext(
  supabase: any,
  userId: string
): Promise<UserContext> {
  const { data, error } = await supabase
    .from('profiles')
    .select('first_name, last_name, role, bio, working_hours_start, working_hours_end, timezone')
    .eq('id', userId)
    .maybeSingle();
  
  const context: UserContext = {
    user_id: userId,
  };
  
  if (data) {
    context.first_name = data.first_name;
    context.last_name = data.last_name;
    context.role = data.role;
    context.bio = data.bio;
    context.working_hours_start = data.working_hours_start;
    context.working_hours_end = data.working_hours_end;
    context.timezone = data.timezone;
  }
  
  return context;
}

/**
 * Save compiled persona to organization_context for caching
 */
export async function saveCompiledPersona(
  supabase: any,
  organizationId: string,
  userId: string,
  compiledPersona: CompiledPersona
): Promise<void> {
  try {
    await supabase.rpc('upsert_organization_context', {
      p_org_id: organizationId,
      p_key: `agent_persona_${userId}`,
      p_value: JSON.stringify(compiledPersona),
      p_source: 'persona_compiler',
      p_confidence: 1.0,
    });
    
    console.log(`[salesCopilotPersona] Saved persona for user ${userId} in org ${organizationId}`);
  } catch (error) {
    console.error('[salesCopilotPersona] Failed to save persona:', error);
  }
}

/**
 * Load cached persona from organization_context
 */
export async function loadCachedPersona(
  supabase: any,
  organizationId: string,
  userId: string
): Promise<CompiledPersona | null> {
  try {
    const { data, error } = await supabase
      .from('organization_context')
      .select('value, updated_at')
      .eq('organization_id', organizationId)
      .eq('key', `agent_persona_${userId}`)
      .maybeSingle();
    
    if (error || !data) {
      return null;
    }
    
    const persona = JSON.parse(data.value) as CompiledPersona;
    
    // Check if persona is stale (older than 24 hours)
    const compiledAt = new Date(persona.compiledAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - compiledAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
      console.log('[salesCopilotPersona] Cached persona is stale (>24h), will recompile');
      return null;
    }
    
    return persona;
  } catch (error) {
    console.error('[salesCopilotPersona] Failed to load cached persona:', error);
    return null;
  }
}

/**
 * Get or compile persona with caching
 * This is the main entry point for api-copilot
 */
export async function getOrCompilePersona(
  supabase: any,
  organizationId: string,
  userId: string
): Promise<CompiledPersona> {
  // Try to load cached persona
  const cached = await loadCachedPersona(supabase, organizationId, userId);
  
  if (cached) {
    console.log('[salesCopilotPersona] Using cached persona');
    return cached;
  }
  
  // Load fresh data and compile
  console.log('[salesCopilotPersona] Compiling fresh persona');
  
  const [enrichment, skills, user] = await Promise.all([
    loadEnrichmentContext(supabase, organizationId),
    loadSkillContext(supabase, organizationId),
    loadUserContext(supabase, userId),
  ]);
  
  const compiled = compileSalesCopilotPersona(enrichment, skills, user);
  
  // Cache the compiled persona
  await saveCompiledPersona(supabase, organizationId, userId, compiled);
  
  return compiled;
}

/**
 * Invalidate cached persona (call when enrichment or skills change)
 */
export async function invalidatePersonaCache(
  supabase: any,
  organizationId: string,
  userId?: string
): Promise<void> {
  try {
    if (userId) {
      // Invalidate specific user's persona
      await supabase
        .from('organization_context')
        .delete()
        .eq('organization_id', organizationId)
        .eq('key', `agent_persona_${userId}`);
    } else {
      // Invalidate all user personas for the org
      await supabase
        .from('organization_context')
        .delete()
        .eq('organization_id', organizationId)
        .like('key', 'agent_persona_%');
    }
    
    console.log('[salesCopilotPersona] Invalidated persona cache');
  } catch (error) {
    console.error('[salesCopilotPersona] Failed to invalidate cache:', error);
  }
}
