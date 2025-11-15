import { supabase } from '../supabase';

/**
 * Company Enrichment Service
 * Integrates with Perplexity AI and Apollo.io to enrich company data
 */

export interface CompanyEnrichmentData {
  // Basic info
  name: string;
  domain: string;
  website?: string;

  // Company details
  description?: string;
  industry?: string;
  size?: string; // 'startup', 'small', 'medium', 'large', 'enterprise'
  employee_count?: number;
  founded_year?: number;
  headquarters?: string;

  // Contact info
  phone?: string;
  address?: string;

  // Social/web presence
  linkedin_url?: string;
  twitter_url?: string;
  facebook_url?: string;

  // Business intelligence
  annual_revenue?: string;
  funding_raised?: string;
  technologies_used?: string[];
  competitors?: string[];

  // Metadata
  enrichment_source: 'perplexity' | 'apollo' | 'manual';
  enriched_at: string;
  confidence_score?: number;
}

/**
 * Enrich company using Perplexity AI
 * Uses Perplexity to gather comprehensive company information
 */
export async function enrichCompanyWithPerplexity(
  companyName: string,
  domain: string
): Promise<Partial<CompanyEnrichmentData>> {
  // Check if Perplexity API key is configured
  const perplexityApiKey = import.meta.env.VITE_PERPLEXITY_API_KEY;

  if (!perplexityApiKey) {
    return {};
  }

  try {
    // Construct prompt for Perplexity
    const prompt = `Provide detailed information about the company "${companyName}" (${domain}). Include:
    - Company description (2-3 sentences)
    - Industry/sector
    - Company size (startup/small/medium/large/enterprise)
    - Estimated employee count
    - Headquarters location
    - Founded year
    - LinkedIn URL
    - Key technologies they use
    - Main competitors
    - Annual revenue (if public)
    - Recent funding (if applicable)

    Format the response as JSON with these fields: description, industry, size, employee_count, founded_year, headquarters, linkedin_url, technologies_used (array), competitors (array), annual_revenue, funding_raised.`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${perplexityApiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are a business intelligence assistant that provides accurate, structured company information. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in Perplexity response');
    }

    // Parse JSON response
    const enrichmentData = JSON.parse(content);
    return {
      ...enrichmentData,
      enrichment_source: 'perplexity' as const,
      enriched_at: new Date().toISOString(),
      confidence_score: 0.85,
    };
  } catch (error) {
    return {};
  }
}

/**
 * Enrich company using Apollo.io
 * Note: Requires Apollo.io API key and credits
 */
export async function enrichCompanyWithApollo(
  domain: string
): Promise<Partial<CompanyEnrichmentData>> {
  const apolloApiKey = import.meta.env.VITE_APOLLO_API_KEY;

  if (!apolloApiKey) {
    return {};
  }

  try {
    // Apollo.io organization enrichment endpoint
    const response = await fetch('https://api.apollo.io/v1/organizations/enrich', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        api_key: apolloApiKey,
        domain: domain,
      }),
    });

    if (!response.ok) {
      throw new Error(`Apollo API error: ${response.statusText}`);
    }

    const data = await response.json();
    const org = data.organization;

    if (!org) {
      throw new Error('No organization data in Apollo response');
    }
    // Map Apollo data to our format
    return {
      name: org.name,
      domain: org.website_url || domain,
      website: org.website_url,
      description: org.short_description || org.description,
      industry: org.industry,
      employee_count: org.estimated_num_employees,
      founded_year: org.founded_year,
      headquarters: org.city && org.state ? `${org.city}, ${org.state}` : org.city,
      phone: org.phone,
      linkedin_url: org.linkedin_url,
      twitter_url: org.twitter_url,
      facebook_url: org.facebook_url,
      annual_revenue: org.estimated_annual_revenue,
      technologies_used: org.technologies || [],
      enrichment_source: 'apollo' as const,
      enriched_at: new Date().toISOString(),
      confidence_score: 0.9, // Apollo generally has high-quality data
    };
  } catch (error) {
    return {};
  }
}

/**
 * Main enrichment function that tries Perplexity first, then Apollo as backup
 */
export async function enrichCompany(
  companyId: string,
  companyName: string,
  domain: string
): Promise<boolean> {
  try {
    // Try Perplexity first
    let enrichmentData = await enrichCompanyWithPerplexity(companyName, domain);

    // If Perplexity didn't provide enough data, try Apollo as backup
    if (!enrichmentData.description || !enrichmentData.industry) {
      const apolloData = await enrichCompanyWithApollo(domain);
      enrichmentData = { ...enrichmentData, ...apolloData };
    }

    // If we still don't have data, return false
    if (Object.keys(enrichmentData).length === 0) {
      return false;
    }

    // Update company in database
    const { error } = await supabase
      .from('companies')
      .update({
        description: enrichmentData.description,
        industry: enrichmentData.industry,
        size: enrichmentData.size,
        website: enrichmentData.website || `https://${domain}`,
        phone: enrichmentData.phone,
        address: enrichmentData.address || enrichmentData.headquarters,
        linkedin_url: enrichmentData.linkedin_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId);

    if (error) {
      return false;
    }

    // Optionally store raw enrichment data in a separate table
    // (You could create a company_enrichment_history table for this)
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Batch enrich multiple companies
 * Processes companies one at a time to avoid rate limiting
 */
export async function batchEnrichCompanies(companyIds: string[]): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const companyId of companyIds) {
    try {
      // Fetch company details
      const { data: company, error } = await supabase
        .from('companies')
        .select('id, name, domain')
        .eq('id', companyId)
        .single();

      if (error || !company || !company.domain) {
        failed++;
        errors.push(`Company ${companyId}: ${error?.message || 'Missing domain'}`);
        continue;
      }

      const enriched = await enrichCompany(company.id, company.name, company.domain);

      if (enriched) {
        success++;
      } else {
        failed++;
        errors.push(`Company ${company.name}: Enrichment failed`);
      }

      // Add delay to avoid rate limiting (1 second between requests)
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      failed++;
      errors.push(`Company ${companyId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { success, failed, errors };
}

/**
 * Check if company needs enrichment
 * Returns true if company is missing key fields
 */
export function needsEnrichment(company: {
  description: string | null;
  industry: string | null;
  size: string | null;
}): boolean {
  return !company.description || !company.industry || !company.size;
}
