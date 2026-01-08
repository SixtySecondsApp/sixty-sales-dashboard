-- Migration: Restructure Pilot Skills for Concise Execution
-- Converts verbose reference docs to concise agent-executable templates
-- Skills: lead-qualification, follow-up-email, deal-scoring
-- Date: 2026-01-01

-- =============================================================================
-- 1. Lead Qualification (sales-ai) - Concise Version
-- =============================================================================
UPDATE platform_skills
SET
  frontmatter = '{
    "name": "Lead Qualification",
    "description": "Score and qualify leads against ICP. Returns structured qualification tier with recommended actions.",
    "triggers": ["lead_created", "enrichment_completed", "manual_qualification"],
    "requires_context": ["company_name", "industry", "icp_summary", "target_market"],
    "outputs": {
      "response_type": "lead",
      "data_schema": "LeadResponseData"
    },
    "actions": ["query_crm", "create_task", "send_slack"],
    "response_style": "concise"
  }'::jsonb,
  content_template = E'# Lead Qualification

Qualify ${contact_name|''this lead''} against ${company_name|''your company''}''s ICP.

## Instructions

1. Gather context via execute_action(''query_crm'', {contact_id, include: [''company'', ''activities'']})
2. Score across 4 dimensions (100 pts total):
   - Industry Match (30 pts): Direct match = 30, Adjacent = 20, Tangential = 10
   - Product Fit (40 pts): Perfect = 40, Strong = 30, Moderate = 20, Partial = 10
   - Company Size (20 pts): Ideal range = 20, Close = 15, Workable = 10
   - Urgency Signals (10 pts): Active eval = 10, Budget approved = 7, Interested = 4

3. Classify tier:
   - **Qualified** (70+): Ready for sales engagement
   - **Nurture** (40-69): Add to nurture sequence
   - **Disqualified** (<40): Archive with reason

## Output Format (lead response)

Return concise assessment:
```json
{
  "summary": "Lead scored X/100 - [Tier]",
  "data": {
    "score": 75,
    "tier": "Qualified",
    "matchStrength": "strong",
    "keyFactors": ["Direct ${industry} match", "Budget confirmed", "Active evaluation"],
    "gaps": ["Decision maker not yet engaged"],
    "recommendedAction": "Schedule discovery call within 48 hours",
    "confidence": 85
  },
  "actions": [
    {"label": "Create Follow-up Task", "callback": "create_task"},
    {"label": "Alert Sales Rep", "callback": "send_slack"}
  ]
}
```

## ICP Context
- **Target Market**: ${target_market|''B2B companies''}
- **ICP Summary**: ${icp_summary|''Companies needing our solution''}',
  updated_at = now()
WHERE skill_key = 'lead-qualification';

-- =============================================================================
-- 2. Follow-up Email (writing) - Concise Version
-- =============================================================================
UPDATE platform_skills
SET
  frontmatter = '{
    "name": "Follow-up Email",
    "description": "Generate personalized follow-up email after meetings or interactions. Returns draft with subject, body, and CTA.",
    "triggers": ["meeting_ended", "demo_completed", "manual_request"],
    "requires_context": ["company_name", "brand_tone"],
    "outputs": {
      "response_type": "email",
      "data_schema": "EmailResponseData"
    },
    "actions": ["query_crm", "fetch_meetings", "search_emails"],
    "response_style": "concise"
  }'::jsonb,
  content_template = E'# Follow-up Email Generator

Create follow-up email for ${contact_name|''the contact''} after ${meeting_type|''our conversation''}.

## Instructions

1. Gather context:
   - execute_action(''fetch_meetings'', {contact_id, limit: 1}) for recent meeting details
   - execute_action(''search_emails'', {contact_id, limit: 3}) for conversation history

2. Structure email (keep under 150 words):
   - **Subject**: Specific, actionable, <50 chars
   - **Opening**: Reference specific discussion point (1-2 sentences)
   - **Value Recap**: 2-3 bullets of what matters to THEM
   - **Resources**: Any promised materials
   - **CTA**: Clear next step with specific times

3. Match brand tone: ${brand_tone|''Professional yet approachable''}

## Output Format (email response)

```json
{
  "summary": "Follow-up email draft for [Contact] re: [Topic]",
  "data": {
    "subject": "Resources from our ${company_name} demo",
    "body": "Hi [Name],\\n\\nGreat speaking about [specific topic]...\\n\\n[Value bullets]\\n\\n[CTA with times]\\n\\nBest,\\n[Sender]",
    "suggestedRecipients": ["contact@company.com"],
    "prefilledEmail": "full email content here"
  },
  "actions": [
    {"label": "Open in Composer", "callback": "open_email_composer"},
    {"label": "Copy to Clipboard", "callback": "copy_email"}
  ]
}
```

## Email Templates by Type

**Post-Discovery**: Thanks for sharing [challenge]. Based on our discussion: [3 bullets]. Next step: [specific CTA].

**Post-Demo**: Great questions from your team. Recap: [features discussed]. Attached: [resources]. Let''s schedule [next meeting type].

**Post-Proposal**: Thanks for reviewing. To summarize: [agreement points]. Outstanding: [open items]. Next: [action needed].',
  updated_at = now()
WHERE skill_key = 'follow-up-email';

-- =============================================================================
-- 3. Deal Scoring (sales-ai) - Concise Version
-- =============================================================================
UPDATE platform_skills
SET
  frontmatter = '{
    "name": "Deal Scoring",
    "description": "Score deal health and win probability. Returns structured assessment with risk flags and recommended actions.",
    "triggers": ["deal_updated", "weekly_review", "forecast_request"],
    "requires_context": ["company_name"],
    "outputs": {
      "response_type": "deal_health",
      "data_schema": "DealHealthResponseData"
    },
    "actions": ["query_crm", "fetch_meetings", "search_emails", "create_task"],
    "response_style": "concise"
  }'::jsonb,
  content_template = E'# Deal Scoring

Evaluate deal health for ${deal_name|''this opportunity''} (${company_name} pipeline).

## Instructions

1. Gather deal context:
   - execute_action(''query_crm'', {deal_id, include: [''contacts'', ''activities'', ''stage_history'']})
   - execute_action(''fetch_meetings'', {deal_id, limit: 5})
   - execute_action(''search_emails'', {deal_id, limit: 10})

2. Score across 5 dimensions (100 pts total):
   - **Qualification** (25 pts): BANT confirmed
   - **Engagement** (25 pts): Multi-threaded, responsive, recent activity
   - **Competitive Position** (20 pts): Preferred vendor, differentiators land
   - **Process Progress** (20 pts): Stage advancement, milestones hit
   - **Timing/Urgency** (10 pts): Compelling event, budget cycle

3. Flag risks:
   - 🔴 HIGH: No contact 14+ days, champion left, budget frozen
   - 🟡 MEDIUM: Timeline slipping, new stakeholders, pricing pushback
   - 🟢 LOW: Normal sales motion, minor delays

4. Classify health:
   - **Commit** (80+): 70%+ win prob, active close plan
   - **Best Case** (60-79): 40-69% prob, drive urgency
   - **Pipeline** (40-59): 20-39% prob, qualify harder
   - **At Risk** (<40): <20% prob, reassess viability

## Output Format (deal_health response)

```json
{
  "summary": "Deal scored X/100 - [Health Status]",
  "data": {
    "dealId": "deal-123",
    "dealName": "Acme Corp - Enterprise",
    "score": 72,
    "healthStatus": "yellow",
    "winProbability": 55,
    "forecastCategory": "Best Case",
    "dimensions": {
      "qualification": {"score": 20, "max": 25, "notes": "Budget confirmed, decision maker engaged"},
      "engagement": {"score": 18, "max": 25, "notes": "Responsive but single-threaded"},
      "competitive": {"score": 14, "max": 20, "notes": "Preferred option, no major threats"},
      "progress": {"score": 12, "max": 20, "notes": "Demo done, proposal pending"},
      "timing": {"score": 8, "max": 10, "notes": "Q1 deadline, budget available"}
    },
    "risks": [
      {"level": "medium", "description": "Only one stakeholder engaged - need to multi-thread"}
    ],
    "recommendations": [
      "Request intro to other stakeholders",
      "Send proposal by EOW",
      "Schedule exec alignment call"
    ],
    "lastActivity": "2025-12-28",
    "daysInStage": 12
  },
  "actions": [
    {"label": "Create Action Items", "callback": "create_task"},
    {"label": "Alert Manager", "callback": "send_slack"}
  ]
}
```

## Quick Scoring Guide
- Each dimension: Score 0-max based on evidence
- No data = 0 points (don''t assume)
- Partial evidence = 50% of max
- Strong evidence = 100% of max',
  updated_at = now()
WHERE skill_key = 'deal-scoring';

-- =============================================================================
-- Verify updates
-- =============================================================================
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM platform_skills
  WHERE skill_key IN ('lead-qualification', 'follow-up-email', 'deal-scoring')
    AND frontmatter ? 'outputs'
    AND frontmatter ? 'actions';

  IF updated_count < 3 THEN
    RAISE NOTICE 'Warning: Only % of 3 skills updated with new frontmatter', updated_count;
  ELSE
    RAISE NOTICE 'Successfully updated % pilot skills with outputs and actions', updated_count;
  END IF;
END $$;
