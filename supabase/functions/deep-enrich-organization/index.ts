/**
 * Deep Enrich Organization Edge Function
 *
 * Two-prompt pipeline using Gemini 2.0 Flash for speed:
 * 1. Data Collection Prompt - Scrape and extract raw company information
 * 2. Skill Generation Prompt - Contextualize data into structured skill configurations
 *
 * Actions:
 * - start: Begin enrichment process for an organization
 * - status: Check enrichment status
 * - retry: Retry failed enrichment
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { action, organization_id, domain } = requestBody;

    let response;

    switch (action) {
      case 'start':
        response = await startEnrichment(supabase, user.id, organization_id, domain);
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
    const errorMessage = error instanceof Error ? error.message : String(error);
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[startEnrichment] Error:', errorMessage);
    return { success: false, error: errorMessage };
  }
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
    const enrichmentData = await extractCompanyData(scrapedContent, domain);

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
    const skills = await generateSkillConfigs(enrichmentData);

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
    const errorMessage = error instanceof Error ? error.message : String(error);
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
  const urls = [
    `https://${domain}`,
    `https://${domain}/about`,
    `https://${domain}/pricing`,
    `https://${domain}/products`,
    `https://${domain}/solutions`,
  ];

  const contents: string[] = [];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Use60Bot/1.0; +https://use60.com)',
        },
      });

      if (response.ok) {
        const html = await response.text();
        const text = stripHtml(html);
        if (text.length > 100) {
          contents.push(`--- ${url} ---\n${text.substring(0, 5000)}`);
        }
      }
    } catch (e) {
      console.log(`[scrapeWebsite] Failed to fetch ${url}`);
    }
  }

  if (contents.length === 0) {
    throw new Error(`Could not scrape any content from ${domain}`);
  }

  return contents.join('\n\n');
}

// ============================================================================
// Extract Company Data (Prompt 1)
// ============================================================================

async function extractCompanyData(rawContent: string, domain: string): Promise<EnrichmentData> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const prompt = `Extract structured company data from these web pages.

**Domain:** ${domain}

**Raw Content:**
${rawContent.substring(0, 15000)}

**Extract this information and return ONLY valid JSON:**
{
  "company_name": "The company name",
  "tagline": "Their main tagline or slogan",
  "description": "1-2 sentence description of what they do",
  "industry": "Their primary industry",
  "employee_count": "Estimated employee count range (e.g., '10-50', '100-500')",
  "products": [{"name": "Product name", "description": "Brief description", "pricing_tier": "free/starter/pro/enterprise"}],
  "value_propositions": ["Key value prop 1", "Key value prop 2"],
  "competitors": [{"name": "Competitor name", "domain": "competitor.com"}],
  "target_market": "Who they sell to",
  "customer_types": ["Customer type 1", "Customer type 2"],
  "key_features": ["Feature 1", "Feature 2"],
  "content_samples": ["Actual text samples from their content for brand voice analysis"],
  "pain_points_mentioned": ["Pain point they address"],
  "case_study_customers": ["Customer name from case studies"],
  "tech_stack": ["Technology they use or integrate with"],
  "key_people": [{"name": "Person name", "title": "Their title"}]
}

Return only valid JSON. Include everything you can find. Use null for fields you can't determine.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
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

async function generateSkillConfigs(enrichmentData: EnrichmentData): Promise<SkillConfig> {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const prompt = `Using this company data, generate personalized sales AI skill configurations.

**Company Data:**
${JSON.stringify(enrichmentData, null, 2)}

**Generate skill configurations with company-specific content. Return ONLY valid JSON:**

{
  "lead_qualification": {
    "criteria": [
      "Specific qualification criterion using their product names and target market",
      "Budget-related criterion",
      "Timeline criterion",
      "At least 4 criteria total"
    ],
    "disqualifiers": [
      "Specific disqualifier relevant to their business",
      "At least 3 disqualifiers"
    ]
  },
  "lead_enrichment": {
    "questions": [
      "Discovery question specific to their products",
      "Question about budget and decision process",
      "Question about pain points they address",
      "At least 3 questions"
    ]
  },
  "brand_voice": {
    "tone": "2-3 sentences describing their communication style based on their content samples",
    "avoid": ["Words or phrases to avoid", "Competitor terminology", "At least 5 items"]
  },
  "objection_handling": {
    "objections": [
      {
        "trigger": "Common objection like 'Too expensive'",
        "response": "Specific response referencing their value props and ROI"
      },
      {
        "trigger": "Why not [specific competitor]?",
        "response": "Response highlighting their differentiators"
      }
    ]
  },
  "icp": {
    "companyProfile": "Detailed description of ideal company based on their case studies and target market",
    "buyerPersona": "Detailed description of ideal buyer based on their content",
    "buyingSignals": ["Signal 1", "Signal 2", "At least 3 signals"]
  }
}

Be specific. Use actual product names, competitor names, and terms from their content.
Return only valid JSON.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
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
    const errorMessage = error instanceof Error ? error.message : String(error);
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
    const errorMessage = error instanceof Error ? error.message : String(error);
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
