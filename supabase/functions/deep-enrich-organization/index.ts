/**
 * Deep Enrich Organization Edge Function
 *
 * Two-prompt pipeline using Gemini 3 Flash for speed:
 * 1. Data Collection Prompt - Scrape and extract raw company information
 * 2. Skill Generation Prompt - Contextualize data into structured skill configurations
 *
 * Prompts are loaded dynamically from the database via promptLoader,
 * with TypeScript defaults as fallback. Prompts can be customized via
 * the admin UI at /platform/ai/prompts
 *
 * Actions:
 * - start: Begin enrichment process for an organization (website-based)
 * - manual: Begin enrichment from Q&A answers (no website available)
 * - status: Check enrichment status
 * - retry: Retry failed enrichment
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadPrompt, interpolateVariables } from '../_shared/promptLoader.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============================================================================
// Types
// ============================================================================

interface EnrichmentData {
  company_name: string;
  tagline: string;
  description: string;
  industry: string;
  employee_count: string;
  products: Array<{ name: string; description: string; pricing_tier?: string }>;
  value_propositions: string[];
  competitors: Array<{ name: string; domain?: string }>;
  target_market: string;
  customer_types: string[];
  key_features: string[];
  content_samples: string[];
  pain_points_mentioned: string[];
  case_study_customers: string[];
  tech_stack: string[];
  key_people: Array<{ name: string; title: string }>;
}

/**
 * Manual enrichment data from Q&A flow
 * Used when user doesn't have a website to scrape
 */
interface ManualEnrichmentInput {
  company_name: string;
  company_description: string;
  industry: string;
  target_customers: string;
  main_products: string;
  competitors: string;
  team_size?: string;
  unique_value?: string;
}

interface SkillConfig {
  lead_qualification: {
    criteria: string[];
    disqualifiers: string[];
  };
  lead_enrichment: {
    questions: string[];
  };
  brand_voice: {
    tone: string;
    avoid: string[];
  };
  objection_handling: {
    objections: Array<{ trigger: string; response: string }>;
  };
  icp: {
    companyProfile: string;
    buyerPersona: string;
    buyingSignals: string[];
  };
}

// ============================================================================
// Helper: Extract error message from any error type
// ============================================================================

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null) {
    // Handle Supabase/Postgres errors which have message property
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.details === 'string') return obj.details;
    if (typeof obj.hint === 'string') return obj.hint;
    return JSON.stringify(error);
  }
  return String(error);
}

// ============================================================================
// Main Handler
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Invalid authentication token');
    }

    const requestBody = await req.json();
    const { action, organization_id, domain, manual_data } = requestBody;

    let response;

    switch (action) {
      case 'start':
        response = await startEnrichment(supabase, user.id, organization_id, domain);
        break;

      case 'manual':
        response = await startManualEnrichment(supabase, user.id, organization_id, manual_data);
        break;

      case 'status':
        response = await getEnrichmentStatus(supabase, organization_id);
        break;

      case 'retry':
        response = await retryEnrichment(supabase, user.id, organization_id);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    console.error('[deep-enrich-organization] Error:', errorMessage);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// ============================================================================
// Start Enrichment Process
// ============================================================================

async function startEnrichment(
  supabase: any,
  userId: string,
  organizationId: string,
  domain: string
): Promise<{ success: boolean; enrichment_id?: string; error?: string }> {
  try {
    // Check if enrichment already exists
    const { data: existing } = await supabase
      .from('organization_enrichment')
      .select('id, status')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (existing && existing.status === 'completed') {
      return { success: true, enrichment_id: existing.id };
    }

    // Create or update enrichment record
    const { data: enrichment, error: insertError } = await supabase
      .from('organization_enrichment')
      .upsert({
        organization_id: organizationId,
        domain: domain,
        status: 'scraping',
        error_message: null,
      }, { onConflict: 'organization_id' })
      .select('id')
      .single();

    if (insertError) throw insertError;

    // Run the enrichment pipeline asynchronously
    runEnrichmentPipeline(supabase, enrichment.id, organizationId, domain).catch(console.error);

    return { success: true, enrichment_id: enrichment.id };

  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    console.error('[startEnrichment] Error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// Start Manual Enrichment (Q&A Flow)
// ============================================================================

async function startManualEnrichment(
  supabase: any,
  userId: string,
  organizationId: string,
  manualData: ManualEnrichmentInput
): Promise<{ success: boolean; enrichment_id?: string; error?: string }> {
  try {
    if (!manualData || !manualData.company_name) {
      throw new Error('Manual data with company name is required');
    }

    // Check if enrichment already exists
    const { data: existing } = await supabase
      .from('organization_enrichment')
      .select('id, status')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (existing && existing.status === 'completed') {
      return { success: true, enrichment_id: existing.id };
    }

    // Create or update enrichment record with manual data
    const { data: enrichment, error: insertError } = await supabase
      .from('organization_enrichment')
      .upsert({
        organization_id: organizationId,
        domain: null, // No domain for manual enrichment
        status: 'analyzing', // Skip scraping step
        enrichment_source: 'manual',
        error_message: null,
        // Store manual data as raw input
        company_name: manualData.company_name,
        description: manualData.company_description,
        industry: manualData.industry,
        target_market: manualData.target_customers,
      }, { onConflict: 'organization_id' })
      .select('id')
      .single();

    if (insertError) throw insertError;

    // Run the manual enrichment pipeline asynchronously
    runManualEnrichmentPipeline(supabase, enrichment.id, organizationId, manualData).catch(console.error);

    return { success: true, enrichment_id: enrichment.id };

  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    console.error('[startManualEnrichment] Error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// Manual Enrichment Pipeline (async)
// ============================================================================

async function runManualEnrichmentPipeline(
  supabase: any,
  enrichmentId: string,
  organizationId: string,
  manualData: ManualEnrichmentInput
): Promise<void> {
  try {
    console.log(`[ManualPipeline] Starting for ${manualData.company_name}`);

    // Convert manual data to enrichment data format
    // This allows us to use the same skill generation logic
    const enrichmentData: EnrichmentData = {
      company_name: manualData.company_name,
      tagline: '', // Not collected in Q&A
      description: manualData.company_description,
      industry: manualData.industry,
      employee_count: manualData.team_size || 'Unknown',
      products: parseProductsFromText(manualData.main_products),
      value_propositions: manualData.unique_value ? [manualData.unique_value] : [],
      competitors: parseCompetitorsFromText(manualData.competitors),
      target_market: manualData.target_customers,
      customer_types: [], // Not directly collected
      key_features: [], // Not directly collected
      content_samples: [], // No website content
      pain_points_mentioned: [], // Not directly collected
      case_study_customers: [], // Not directly collected
      tech_stack: [], // Not collected in Q&A
      key_people: [], // Not collected in Q&A
    };

    // Update enrichment record with structured data
    await supabase
      .from('organization_enrichment')
      .update({
        company_name: enrichmentData.company_name,
        description: enrichmentData.description,
        industry: enrichmentData.industry,
        employee_count: enrichmentData.employee_count,
        products: enrichmentData.products,
        value_propositions: enrichmentData.value_propositions,
        competitors: enrichmentData.competitors,
        target_market: enrichmentData.target_market,
        sources_used: ['manual_input'],
      })
      .eq('id', enrichmentId);

    // Generate skill configurations (same as website flow)
    console.log(`[ManualPipeline] Generating skill configurations`);
    const skills = await generateSkillConfigsFromManualData(supabase, enrichmentData);

    // Save generated skills
    await supabase
      .from('organization_enrichment')
      .update({
        generated_skills: skills,
        status: 'completed',
        confidence_score: 0.70, // Lower confidence for manual input
      })
      .eq('id', enrichmentId);

    // Also save skills to organization_skills table
    await saveGeneratedSkills(supabase, organizationId, skills);

    console.log(`[ManualPipeline] Enrichment complete for ${manualData.company_name}`);

  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    console.error('[runManualEnrichmentPipeline] Error:', errorMessage);

    await supabase
      .from('organization_enrichment')
      .update({
        status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', enrichmentId);
  }
}

/**
 * Parse comma-separated products into structured format
 */
function parseProductsFromText(text: string): Array<{ name: string; description: string }> {
  if (!text) return [];
  return text.split(',').map(p => ({
    name: p.trim(),
    description: '',
  })).filter(p => p.name.length > 0);
}

/**
 * Parse comma-separated competitors into structured format
 */
function parseCompetitorsFromText(text: string): Array<{ name: string }> {
  if (!text) return [];
  return text.split(',').map(c => ({
    name: c.trim(),
  })).filter(c => c.name.length > 0);
}

/**
 * Generate skill configs from manual Q&A data
 * Uses similar logic to website-based generation but with adapted prompting
 */
async function generateSkillConfigsFromManualData(
  supabase: any,
  enrichmentData: EnrichmentData
): Promise<SkillConfig> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Load prompt from database (with fallback to TypeScript defaults)
  const promptConfig = await loadPrompt(supabase, 'organization_skill_generation');

  // Interpolate variables into the prompt templates
  // For manual data, we use company name as domain placeholder
  const variables = {
    domain: enrichmentData.company_name.toLowerCase().replace(/\s+/g, '-'),
    companyIntelligence: JSON.stringify(enrichmentData, null, 2),
  };

  const systemPrompt = interpolateVariables(promptConfig.systemPrompt, variables);
  const userPrompt = interpolateVariables(promptConfig.userPrompt, variables);

  // Add context that this is manual input
  const fullPrompt = `${systemPrompt}

Note: This company data was collected via a Q&A questionnaire, not from website scraping.
The data may be less comprehensive, so generate reasonable defaults where information is missing.
Focus on creating useful, actionable skill configurations based on the provided information.

${userPrompt}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${promptConfig.model}:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: promptConfig.temperature,
          maxOutputTokens: promptConfig.maxTokens,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = await response.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse skill config as JSON');
  }

  return JSON.parse(jsonMatch[0]) as SkillConfig;
}

// ============================================================================
// Enrichment Pipeline (async)
// ============================================================================

async function runEnrichmentPipeline(
  supabase: any,
  enrichmentId: string,
  organizationId: string,
  domain: string
): Promise<void> {
  try {
    // Step 1: Scrape website content
    console.log(`[Pipeline] Starting scrape for ${domain}`);
    const scrapedContent = await scrapeWebsite(domain);

    // Update status
    await supabase
      .from('organization_enrichment')
      .update({ status: 'analyzing', raw_scraped_data: scrapedContent })
      .eq('id', enrichmentId);

    // Step 2: Extract structured data (Prompt 1)
    console.log(`[Pipeline] Extracting structured data`);
    const enrichmentData = await extractCompanyData(supabase, scrapedContent, domain);

    // Update with enrichment data
    await supabase
      .from('organization_enrichment')
      .update({
        company_name: enrichmentData.company_name,
        tagline: enrichmentData.tagline,
        description: enrichmentData.description,
        industry: enrichmentData.industry,
        employee_count: enrichmentData.employee_count,
        products: enrichmentData.products,
        value_propositions: enrichmentData.value_propositions,
        competitors: enrichmentData.competitors,
        target_market: enrichmentData.target_market,
        tech_stack: enrichmentData.tech_stack,
        key_people: enrichmentData.key_people,
        pain_points: enrichmentData.pain_points_mentioned,
        sources_used: ['website'],
      })
      .eq('id', enrichmentId);

    // Step 3: Generate skill configurations (Prompt 2)
    console.log(`[Pipeline] Generating skill configurations`);
    const skills = await generateSkillConfigs(supabase, enrichmentData, domain);

    // Save generated skills
    await supabase
      .from('organization_enrichment')
      .update({
        generated_skills: skills,
        status: 'completed',
        confidence_score: 0.85,
      })
      .eq('id', enrichmentId);

    // Also save skills to organization_skills table
    await saveGeneratedSkills(supabase, organizationId, skills);

    console.log(`[Pipeline] Enrichment complete for ${domain}`);

  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    console.error('[runEnrichmentPipeline] Error:', errorMessage);

    await supabase
      .from('organization_enrichment')
      .update({
        status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', enrichmentId);
  }
}

// ============================================================================
// Scrape Website
// ============================================================================

async function scrapeWebsite(domain: string): Promise<string> {
  // Core pages that most B2B sites have
  const coreUrls = [
    `https://${domain}`,
    `https://${domain}/about`,
    `https://${domain}/about-us`,
    `https://${domain}/pricing`,
    `https://${domain}/products`,
    `https://${domain}/solutions`,
    `https://${domain}/features`,
    `https://${domain}/customers`,
    `https://${domain}/case-studies`,
    `https://${domain}/use-cases`,
    `https://${domain}/enterprise`,
    `https://${domain}/platform`,
  ];

  // Common product-specific pages to try
  const productUrls = [
    `https://${domain}/payments`,
    `https://${domain}/billing`,
    `https://${domain}/invoicing`,
    `https://${domain}/analytics`,
    `https://${domain}/integrations`,
    `https://${domain}/api`,
    `https://${domain}/developers`,
    `https://${domain}/connect`,
    `https://${domain}/checkout`,
  ];

  const contents: string[] = [];
  const fetchedUrls = new Set<string>();
  const MAX_PAGES = 12; // Limit to prevent too many requests
  const CHARS_PER_PAGE = 8000; // Increased from 5000

  // Helper to fetch a URL
  async function fetchPage(url: string): Promise<boolean> {
    if (fetchedUrls.has(url) || contents.length >= MAX_PAGES) return false;
    fetchedUrls.add(url);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Use60Bot/1.0; +https://use60.com)',
        },
        redirect: 'follow',
      });

      if (response.ok) {
        const html = await response.text();
        const text = stripHtml(html);
        if (text.length > 200) {
          contents.push(`--- ${url} ---\n${text.substring(0, CHARS_PER_PAGE)}`);
          return true;
        }
      }
    } catch (e) {
      // Silently skip failed fetches
    }
    return false;
  }

  // Fetch core pages first (in parallel batches)
  const coreBatch1 = coreUrls.slice(0, 4);
  const coreBatch2 = coreUrls.slice(4, 8);
  const coreBatch3 = coreUrls.slice(8);

  await Promise.all(coreBatch1.map(fetchPage));
  await Promise.all(coreBatch2.map(fetchPage));
  await Promise.all(coreBatch3.map(fetchPage));

  // If we have room, try product-specific pages
  if (contents.length < MAX_PAGES) {
    await Promise.all(productUrls.slice(0, MAX_PAGES - contents.length).map(fetchPage));
  }

  if (contents.length === 0) {
    throw new Error(`Could not scrape any content from ${domain}`);
  }

  console.log(`[scrapeWebsite] Scraped ${contents.length} pages from ${domain}`);
  return contents.join('\n\n');
}

// ============================================================================
// Extract Company Data (Prompt 1)
// ============================================================================

async function extractCompanyData(
  supabase: any,
  rawContent: string,
  domain: string
): Promise<EnrichmentData> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Load prompt from database (with fallback to TypeScript defaults)
  const promptConfig = await loadPrompt(supabase, 'organization_data_collection');

  // Interpolate variables into the prompt templates
  // Increased from 15000 to 50000 to capture more product details
  const variables = {
    domain,
    websiteContent: rawContent.substring(0, 50000),
  };

  const systemPrompt = interpolateVariables(promptConfig.systemPrompt, variables);
  const userPrompt = interpolateVariables(promptConfig.userPrompt, variables);

  // Combine system and user prompts for Gemini (which doesn't have system prompts)
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${promptConfig.model}:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: promptConfig.temperature,
          maxOutputTokens: promptConfig.maxTokens,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = await response.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Parse JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response as JSON');
  }

  return JSON.parse(jsonMatch[0]) as EnrichmentData;
}

// ============================================================================
// Generate Skill Configurations (Prompt 2)
// ============================================================================

async function generateSkillConfigs(
  supabase: any,
  enrichmentData: EnrichmentData,
  domain: string
): Promise<SkillConfig> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Load prompt from database (with fallback to TypeScript defaults)
  const promptConfig = await loadPrompt(supabase, 'organization_skill_generation');

  // Interpolate variables into the prompt templates
  const variables = {
    domain,
    companyIntelligence: JSON.stringify(enrichmentData, null, 2),
  };

  const systemPrompt = interpolateVariables(promptConfig.systemPrompt, variables);
  const userPrompt = interpolateVariables(promptConfig.userPrompt, variables);

  // Combine system and user prompts for Gemini (which doesn't have system prompts)
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${promptConfig.model}:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: promptConfig.temperature,
          maxOutputTokens: promptConfig.maxTokens,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${error}`);
  }

  const data = await response.json();
  const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse skill config as JSON');
  }

  return JSON.parse(jsonMatch[0]) as SkillConfig;
}

// ============================================================================
// Save Generated Skills
// ============================================================================

async function saveGeneratedSkills(
  supabase: any,
  organizationId: string,
  skills: SkillConfig
): Promise<void> {
  const skillMappings = [
    { id: 'lead_qualification', name: 'Qualification', config: skills.lead_qualification },
    { id: 'lead_enrichment', name: 'Enrichment', config: skills.lead_enrichment },
    { id: 'brand_voice', name: 'Brand Voice', config: skills.brand_voice },
    { id: 'objection_handling', name: 'Objections', config: skills.objection_handling },
    { id: 'icp', name: 'ICP', config: skills.icp },
  ];

  for (const skill of skillMappings) {
    await supabase
      .from('organization_skills')
      .upsert({
        organization_id: organizationId,
        skill_id: skill.id,
        skill_name: skill.name,
        config: skill.config,
        ai_generated: true,
        user_modified: false,
        is_active: true,
      }, { onConflict: 'organization_id,skill_id' });
  }
}

// ============================================================================
// Get Enrichment Status
// ============================================================================

async function getEnrichmentStatus(
  supabase: any,
  organizationId: string
): Promise<{
  success: boolean;
  status?: string;
  enrichment?: any;
  skills?: any;
  error?: string;
}> {
  try {
    const { data: enrichment, error } = await supabase
      .from('organization_enrichment')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) throw error;

    if (!enrichment) {
      return { success: true, status: 'not_started' };
    }

    // If completed, also fetch skills
    let skills = null;
    if (enrichment.status === 'completed') {
      const { data: skillsData } = await supabase
        .from('organization_skills')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      skills = skillsData;
    }

    return {
      success: true,
      status: enrichment.status,
      enrichment,
      skills,
    };

  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// Retry Failed Enrichment
// ============================================================================

async function retryEnrichment(
  supabase: any,
  userId: string,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: enrichment } = await supabase
      .from('organization_enrichment')
      .select('id, domain')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!enrichment) {
      return { success: false, error: 'No enrichment record found' };
    }

    // Reset status and retry
    await supabase
      .from('organization_enrichment')
      .update({ status: 'scraping', error_message: null })
      .eq('id', enrichment.id);

    // Re-run pipeline
    runEnrichmentPipeline(supabase, enrichment.id, organizationId, enrichment.domain).catch(console.error);

    return { success: true };

  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    return { success: false, error: errorMessage };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
