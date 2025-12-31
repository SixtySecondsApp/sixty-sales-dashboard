-- Migration: Seed Copilot skills for new categories
-- Purpose: Provide baseline skills for Copilot execution layer
-- Date: 2025-12-31

-- -----------------------------------------------------------------------------
-- data-access: get-contact-context
-- -----------------------------------------------------------------------------
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'get-contact-context',
  'data-access',
  '{
    "name": "Get Contact Context",
    "description": "Retrieve full context for a contact before any interaction. Combines CRM data, meeting history, email threads, and related deals/tasks.",
    "triggers": ["call_prep", "email_compose", "deal_review"],
    "actions": ["get_contact", "get_deal", "get_meetings", "search_emails"],
    "requires_context": ["company_name"]
  }'::jsonb,
  E'# Get Contact Context\n\nRetrieve comprehensive context for a contact prior to drafting outreach, preparing for meetings, or updating CRM records.\n\n## When to Use\n- Preparing for a call\n- Drafting an email\n- Reviewing a deal that includes this contact\n\n## Required Inputs\nYou should have at least one of:\n- Contact email\n- Contact name + company\n- Contact ID\n\n## Data Sources (in priority order)\n\n### 1) CRM Record\nUse **execute_action**:\n- `get_contact` with identifiers to retrieve:\n  - name, title, email, phone\n  - company / account\n  - associated deals and stage/value\n  - recent activities and tasks\n\n### 2) Meeting Intelligence\nUse **execute_action**:\n- `get_meetings` to retrieve the last 3–5 meetings involving this contact.\n- Capture:\n  - meeting date + title\n  - summary\n  - open action items\n  - notable sentiment / risks\n\n### 3) Email Threads\nUse **execute_action**:\n- `search_emails` scoped to this contact.\n- Capture:\n  - last 5 relevant emails\n  - open questions / unresolved asks\n  - tone, urgency, and response patterns\n\n## Output Format\nReturn structured JSON:\n\n```json\n{\n  \"contact\": { },\n  \"company\": { },\n  \"deal\": { },\n  \"meetings\": [ ],\n  \"emails\": [ ],\n  \"tasks\": [ ],\n  \"notes\": { }\n}\n```\n\n## Notes\n- Always prefer real data returned by tools.\n- If data is missing, state what you could not find and proceed with what you have.\n'
)
ON CONFLICT (skill_key) DO UPDATE SET
  category = EXCLUDED.category,
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- -----------------------------------------------------------------------------
-- output-format: slack-briefing-format
-- -----------------------------------------------------------------------------
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'slack-briefing-format',
  'output-format',
  '{
    "name": "Slack Briefing Format",
    "description": "Format call prep briefings for Slack delivery using Block Kit. Keeps content scannable and action-oriented.",
    "triggers": ["call_prep", "deal_review"],
    "output_channel": "slack",
    "requires_context": ["company_name"]
  }'::jsonb,
  E'# Slack Briefing Format\n\nFormat call preparation briefings for Slack using Block Kit.\n\n## Rules\n- Keep it concise.\n- Use no more than 5 talking points.\n- Always include next actions.\n\n## Block Kit Structure\n\n### Header\n```json\n{\n  \"type\": \"header\",\n  \"text\": { \"type\": \"plain_text\", \"text\": \"Call Prep: {contact_name} @ {company_name}\" }\n}\n```\n\n### Context fields\n```json\n{\n  \"type\": \"section\",\n  \"fields\": [\n    { \"type\": \"mrkdwn\", \"text\": \"*Role:* {contact_title}\" },\n    { \"type\": \"mrkdwn\", \"text\": \"*Deal:* {deal_name} ({deal_stage})\" },\n    { \"type\": \"mrkdwn\", \"text\": \"*Value:* {deal_value}\" },\n    { \"type\": \"mrkdwn\", \"text\": \"*Last Contact:* {last_contact_date}\" }\n  ]\n}\n```\n\n### Talking Points\n```json\n{\n  \"type\": \"section\",\n  \"text\": { \"type\": \"mrkdwn\", \"text\": \"*Talking points*\\n• {point_1}\\n• {point_2}\\n• {point_3}\" }\n}\n```\n\n### Open Items\n```json\n{\n  \"type\": \"section\",\n  \"text\": { \"type\": \"mrkdwn\", \"text\": \"*Open items*\\n• {open_item_1}\\n• {open_item_2}\" }\n}\n```\n\n### Actions\n```json\n{\n  \"type\": \"actions\",\n  \"elements\": [\n    { \"type\": \"button\", \"text\": { \"type\": \"plain_text\", \"text\": \"View CRM\" }, \"url\": \"{crm_url}\" },\n    { \"type\": \"button\", \"text\": { \"type\": \"plain_text\", \"text\": \"Schedule follow-up\" }, \"url\": \"{schedule_url}\" }\n  ]\n}\n```\n\n## Brand Voice\nApply ${brand_tone|''a clear and professional tone''}. Avoid: ${words_to_avoid|join('', '')|''no restricted words provided''}\n'
)
ON CONFLICT (skill_key) DO UPDATE SET
  category = EXCLUDED.category,
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

