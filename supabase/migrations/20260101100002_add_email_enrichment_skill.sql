-- Migration: Add Email Enrichment Skill
-- First new skill with Gemini integration via execute_action
-- Date: 2026-01-01

-- =============================================================================
-- Email Enrichment Skill (enrichment category)
-- =============================================================================
INSERT INTO platform_skills (
  skill_key,
  category,
  frontmatter,
  content_template,
  created_at,
  updated_at
) VALUES (
  'email-enrichment',
  'enrichment',
  '{
    "name": "Email Enrichment",
    "description": "Parse email sender for domain, enrich contact and company via Gemini. Returns structured enrichment data for CRM updates.",
    "triggers": ["new_email_received", "contact_created", "manual_enrichment"],
    "requires_context": ["email", "sender_name"],
    "outputs": {
      "response_type": "action_summary",
      "data_schema": "EnrichmentResponseData"
    },
    "actions": ["enrich_contact", "enrich_company", "update_crm"],
    "response_style": "concise"
  }'::jsonb,
  E'# Email Enrichment

Enrich ${sender_name|''the sender''} from ${email_domain|''this email''} with professional context.

## Instructions

1. Parse email address to extract domain:
   - Email: ${sender_email}
   - Domain: Extract from after @ symbol
   - Name: ${sender_name} or infer from email

2. Enrich contact via Gemini:
   ```
   execute_action(''enrich_contact'', {
     email: "${sender_email}",
     name: "${sender_name}",
     title: "${sender_title|''''}",
     company_name: "${company_name|''''}"
   })
   ```

3. Enrich company if domain identified:
   ```
   execute_action(''enrich_company'', {
     name: "${company_name|inferred from domain}",
     domain: "${email_domain}",
     website: "https://${email_domain}"
   })
   ```

4. Combine enrichment data into structured response

## Output Format (action_summary)

```json
{
  "summary": "Enriched [Name] from [Company] - [Title]",
  "data": {
    "contact": {
      "name": "John Smith",
      "email": "john@acme.com",
      "title": "VP of Sales",
      "linkedin_url": "https://linkedin.com/in/johnsmith",
      "industry": "Technology",
      "summary": "Experienced sales leader...",
      "confidence": 0.85
    },
    "company": {
      "name": "Acme Corp",
      "domain": "acme.com",
      "industry": "Technology",
      "size": "medium",
      "description": "B2B software company...",
      "linkedin_url": "https://linkedin.com/company/acme",
      "confidence": 0.80
    },
    "enrichment_source": "gemini",
    "enriched_at": "2025-12-30T10:30:00Z"
  },
  "actions": [
    {"label": "Update Contact in CRM", "callback": "update_crm", "params": {"entity": "contact"}},
    {"label": "Update Company in CRM", "callback": "update_crm", "params": {"entity": "company"}},
    {"label": "View on LinkedIn", "callback": "open_url", "params": {"url": "[linkedin_url]"}}
  ]
}
```

## Enrichment Quality

- **High Confidence (>0.8)**: Direct match, multiple data points confirmed
- **Medium Confidence (0.5-0.8)**: Inferred data, some uncertainty
- **Low Confidence (<0.5)**: Limited data available, manual verification recommended

## Error Handling

If enrichment fails:
- Return partial data with confidence scores
- Note which enrichment source failed
- Suggest manual research alternatives',
  now(),
  now()
) ON CONFLICT (skill_key) DO UPDATE SET
  category = EXCLUDED.category,
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- Verify insertion
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM platform_skills WHERE skill_key = 'email-enrichment') THEN
    RAISE NOTICE 'Successfully added email-enrichment skill';
  ELSE
    RAISE EXCEPTION 'Failed to add email-enrichment skill';
  END IF;
END $$;
