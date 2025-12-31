/**
 * Onboarding Prompts
 *
 * AI prompts for the organization enrichment and skill generation
 * during the V2 onboarding flow.
 *
 * Two-prompt pipeline using Gemini 2.0 Flash:
 * 1. Data Collection - Scrape and extract company information
 * 2. Skill Generation - Generate personalized AI skill configurations
 */

import type { PromptTemplate } from './index';

// ============================================================================
// Organization Data Collection Prompt
// ============================================================================

export const organizationDataCollectionTemplate: PromptTemplate = {
  id: 'organization_data_collection',
  name: 'Organization Data Collection',
  description: 'Extract structured company data from website content for onboarding enrichment',
  featureKey: 'organization_data_collection',
  systemPrompt: `You are an expert business intelligence analyst. Your task is to extract structured company information from website content and other sources. Be thorough and specific. Only include information you can directly observe or reasonably infer from the provided content.`,
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
    "tone": ["professional", "casual", "technical", "friendly", "etc."],
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
  variables: [
    {
      name: 'domain',
      description: 'The domain being analyzed (e.g., acme.com)',
      type: 'string',
      required: true,
      example: 'acme.com',
    },
    {
      name: 'websiteContent',
      description: 'Raw scraped content from the website',
      type: 'string',
      required: true,
      example: 'Homepage content, about page, pricing page...',
    },
  ],
  responseFormat: 'json',
};

// ============================================================================
// Organization Skill Generation Prompt
// ============================================================================

export const organizationSkillGenerationTemplate: PromptTemplate = {
  id: 'organization_skill_generation',
  name: 'Organization Skill Generation',
  description: 'Generate personalized AI skill configurations from company intelligence',
  featureKey: 'organization_skill_generation',
  systemPrompt: `You are an expert sales AI trainer. Your task is to generate personalized skill configurations for a sales AI assistant based on company intelligence. Create specific, actionable configurations that use real information about the company.`,
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
    "tone": ["professional", "innovative", "etc. from their content"],
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
  variables: [
    {
      name: 'domain',
      description: 'The domain being analyzed',
      type: 'string',
      required: true,
      example: 'acme.com',
    },
    {
      name: 'companyIntelligence',
      description: 'Structured company data from the data collection prompt',
      type: 'object',
      required: true,
      example: '{ company: {...}, offering: {...}, ... }',
    },
  ],
  responseFormat: 'json',
};
