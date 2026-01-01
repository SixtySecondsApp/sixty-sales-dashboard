-- Migration: Update Remaining Skills to Concise Execution Format
-- Updates 14 existing skills + adds 8 new skills
-- Date: 2026-01-01

-- =============================================================================
-- PART 1: UPDATE EXISTING SKILLS TO CONCISE FORMAT
-- =============================================================================

-- 1. ICP Matching (sales-ai)
UPDATE platform_skills
SET
  frontmatter = '{
    "name": "ICP Matching",
    "description": "Evaluate contact/company fit against ICP criteria. Returns match score with gap analysis.",
    "triggers": ["contact_viewed", "deal_created", "manual_analysis"],
    "requires_context": ["company_name", "icp_summary", "target_market"],
    "outputs": {
      "response_type": "lead",
      "data_schema": "ICPMatchData"
    },
    "actions": ["query_crm", "enrich_contact", "enrich_company"],
    "response_style": "concise"
  }'::jsonb,
  content_template = E'# ICP Matching

Evaluate ${contact_name|''this contact''} fit against ${company_name}''s ICP.

## Instructions

1. Gather data via execute_action(''query_crm'', {contact_id, include: [''company'', ''activities'']})
2. Optionally enrich: execute_action(''enrich_contact'', {email, name})

3. Score ICP fit across dimensions:
   - **Industry Alignment** (25%): Direct match = 25, Adjacent = 15, Tangential = 5
   - **Company Size** (25%): Ideal = 25, Acceptable = 15, Outlier = 5
   - **Budget Indicators** (25%): Strong signals = 25, Some signals = 15, Unknown = 10
   - **Use Case Fit** (25%): Perfect = 25, Adaptable = 15, Stretch = 5

4. Classify: Strong Fit (75+), Moderate Fit (50-74), Weak Fit (<50)

## Output Format (lead response)
```json
{
  "summary": "ICP score: X/100 - [Classification]",
  "data": {
    "score": 78,
    "classification": "Strong Fit",
    "dimensions": {
      "industry": {"score": 25, "notes": "Direct ${industry} match"},
      "size": {"score": 20, "notes": "Within target range"},
      "budget": {"score": 18, "notes": "Budget signals present"},
      "useCase": {"score": 15, "notes": "Primary use case fit"}
    },
    "gaps": ["Decision timeline unclear"],
    "strengths": ["Industry match", "Size fit"],
    "recommendation": "Prioritize for outreach",
    "confidence": 85
  },
  "actions": [
    {"label": "View Full Profile", "callback": "open_contact"},
    {"label": "Start Outreach", "callback": "create_task"}
  ]
}
```',
  updated_at = now()
WHERE skill_key = 'icp-matching';

-- 2. Objection Handling (sales-ai)
UPDATE platform_skills
SET
  frontmatter = '{
    "name": "Objection Handling",
    "description": "Generate response to sales objection with context-aware rebuttals. Returns structured response with talk tracks.",
    "triggers": ["objection_detected", "manual_request"],
    "requires_context": ["company_name", "products", "competitors"],
    "outputs": {
      "response_type": "sales_coach",
      "data_schema": "ObjectionResponseData"
    },
    "actions": ["query_crm", "search_emails"],
    "response_style": "concise"
  }'::jsonb,
  content_template = E'# Objection Handling

Handle "${objection|''this objection''}" for ${company_name} sales conversation.

## Instructions

1. Classify objection type:
   - **Price**: Budget, ROI, competitor pricing
   - **Timing**: Not now, other priorities, renewal cycle
   - **Authority**: Need to check with others, committee decision
   - **Need**: Don''t see the value, current solution works
   - **Trust**: Concerns about company, product, support

2. Search for context: execute_action(''search_emails'', {contact_id, query: "${objection}"})

3. Generate response using framework:
   - **Acknowledge**: Show understanding of concern
   - **Clarify**: Ask probing question if needed
   - **Address**: Provide specific rebuttal
   - **Advance**: Suggest next step

## Output Format (sales_coach response)
```json
{
  "summary": "[Objection Type] - Response ready",
  "data": {
    "objectionType": "price",
    "response": {
      "acknowledge": "I understand budget is a key consideration...",
      "clarify": "Can you help me understand what you are comparing us to?",
      "address": "When clients factor in [specific value], the ROI typically...",
      "advance": "Would it help to see a cost-benefit analysis?"
    },
    "talkTracks": [
      "Compared to [competitor], we offer...",
      "Clients in your space have seen X% improvement in..."
    ],
    "proofPoints": [
      {"type": "case_study", "reference": "Similar company saved $X"},
      {"type": "stat", "reference": "Average ROI of X%"}
    ],
    "followUpQuestions": ["What would success look like?", "What''s driving the timeline?"]
  },
  "actions": [
    {"label": "Copy Response", "callback": "copy_text"},
    {"label": "Send as Email", "callback": "open_email_composer"}
  ]
}
```',
  updated_at = now()
WHERE skill_key = 'objection-handling';

-- 3. Brand Voice (writing)
UPDATE platform_skills
SET
  frontmatter = '{
    "name": "Brand Voice",
    "description": "Ensure content matches brand tone and style guidelines. Returns style suggestions and rewrites.",
    "triggers": ["content_review", "email_draft", "manual_request"],
    "requires_context": ["company_name", "brand_tone"],
    "outputs": {
      "response_type": "email",
      "data_schema": "BrandVoiceData"
    },
    "actions": [],
    "response_style": "concise"
  }'::jsonb,
  content_template = E'# Brand Voice

Apply ${company_name} brand voice to content.

## Brand Guidelines

**Tone**: ${brand_tone|''Professional yet approachable''}
**Style**: ${brand_style|''Clear, concise, confident''}

## Instructions

1. Analyze provided content for:
   - Tone consistency
   - Language patterns
   - Formality level
   - Key message clarity

2. Identify deviations from brand guidelines

3. Provide specific rewrites that maintain meaning while matching brand

## Output Format (email response)
```json
{
  "summary": "Brand voice applied - X adjustments made",
  "data": {
    "original": "The provided text...",
    "revised": "The brand-aligned version...",
    "adjustments": [
      {"type": "tone", "original": "...", "revised": "...", "reason": "More conversational"},
      {"type": "clarity", "original": "...", "revised": "...", "reason": "Simpler language"}
    ],
    "brandScore": 85,
    "notes": "Overall good alignment, minor tweaks for consistency"
  },
  "actions": [
    {"label": "Use Revised Version", "callback": "copy_text"},
    {"label": "Edit Further", "callback": "open_editor"}
  ]
}
```',
  updated_at = now()
WHERE skill_key = 'brand-voice';

-- 4. Proposal Intro (writing)
UPDATE platform_skills
SET
  frontmatter = '{
    "name": "Proposal Introduction",
    "description": "Generate executive summary for sales proposal. Returns structured intro with value propositions.",
    "triggers": ["proposal_start", "deal_stage_change", "manual_request"],
    "requires_context": ["company_name", "products", "brand_tone"],
    "outputs": {
      "response_type": "email",
      "data_schema": "ProposalIntroData"
    },
    "actions": ["query_crm", "fetch_meetings"],
    "response_style": "concise"
  }'::jsonb,
  content_template = E'# Proposal Introduction

Generate executive summary for ${deal_name|''this proposal''}.

## Instructions

1. Gather deal context:
   - execute_action(''query_crm'', {deal_id, include: [''contacts'', ''activities'']})
   - execute_action(''fetch_meetings'', {deal_id, limit: 3})

2. Structure intro (250-400 words):
   - **Hook**: Reference specific conversation/need
   - **Understanding**: Demonstrate grasp of their challenges
   - **Solution Overview**: Brief value proposition
   - **Differentiators**: Why us vs alternatives
   - **Next Steps**: Clear call to action

3. Match brand tone: ${brand_tone|''Professional yet approachable''}

## Output Format (email response)
```json
{
  "summary": "Proposal intro for [Deal Name] ready",
  "data": {
    "title": "Proposal: [Solution] for [Company]",
    "executiveSummary": "Full intro text here...",
    "sections": {
      "hook": "During our conversation on [date]...",
      "understanding": "You mentioned challenges with...",
      "solution": "We propose [approach] that will...",
      "differentiators": "Unlike alternatives, we...",
      "nextSteps": "To move forward, we recommend..."
    },
    "valueProps": [
      "Reduce [pain] by X%",
      "Enable [outcome] within [timeframe]",
      "Integrate seamlessly with [existing tools]"
    ],
    "wordCount": 320
  },
  "actions": [
    {"label": "Copy to Proposal", "callback": "copy_text"},
    {"label": "Edit in Document", "callback": "open_editor"}
  ]
}
```',
  updated_at = now()
WHERE skill_key = 'proposal-intro';

-- 5. Meeting Recap (writing)
UPDATE platform_skills
SET
  frontmatter = '{
    "name": "Meeting Recap",
    "description": "Generate structured meeting summary with action items. Returns recap for internal or external use.",
    "triggers": ["meeting_ended", "transcript_available", "manual_request"],
    "requires_context": ["company_name", "brand_tone"],
    "outputs": {
      "response_type": "meeting_prep",
      "data_schema": "MeetingRecapData"
    },
    "actions": ["fetch_meetings", "create_task", "send_slack"],
    "response_style": "concise"
  }'::jsonb,
  content_template = E'# Meeting Recap

Summarize meeting with ${contact_name|''the contact''}.

## Instructions

1. Get meeting details: execute_action(''fetch_meetings'', {meeting_id})

2. Extract key elements:
   - **Attendees**: Who was present
   - **Topics Discussed**: Main conversation points
   - **Decisions Made**: Agreements reached
   - **Action Items**: Next steps with owners
   - **Open Questions**: Unresolved items

3. Format for audience:
   - **Internal**: Full detail with deal implications
   - **External**: Professional summary for follow-up

## Output Format (meeting_prep response)
```json
{
  "summary": "Meeting recap: [Topic] with [Contact]",
  "data": {
    "meetingDate": "2025-12-30",
    "duration": "45 min",
    "attendees": ["John Smith (Prospect)", "Jane Doe (Us)"],
    "topicsSummary": "Discussed implementation timeline and integration requirements...",
    "keyPoints": [
      "Budget approved for Q1",
      "Technical team needs API documentation",
      "Decision maker joining next call"
    ],
    "decisions": [
      "Proceed with pilot program",
      "Start date: Feb 1"
    ],
    "actionItems": [
      {"owner": "Us", "task": "Send API docs by Friday", "deadline": "2025-01-03"},
      {"owner": "Prospect", "task": "Confirm IT availability", "deadline": "2025-01-05"}
    ],
    "openQuestions": ["Integration with legacy system?"],
    "nextMeeting": "2025-01-10 at 2pm"
  },
  "actions": [
    {"label": "Create Tasks", "callback": "create_task"},
    {"label": "Share to Slack", "callback": "send_slack"},
    {"label": "Send Follow-up Email", "callback": "open_email_composer"}
  ]
}
```',
  updated_at = now()
WHERE skill_key = 'meeting-recap';

-- 6. LinkedIn Outreach (writing)
UPDATE platform_skills
SET
  frontmatter = '{
    "name": "LinkedIn Outreach",
    "description": "Generate personalized LinkedIn connection request or message. Returns message with personalization hooks.",
    "triggers": ["contact_created", "manual_outreach", "sequence_step"],
    "requires_context": ["company_name", "products", "brand_tone"],
    "outputs": {
      "response_type": "email",
      "data_schema": "LinkedInMessageData"
    },
    "actions": ["query_crm", "enrich_contact"],
    "response_style": "concise"
  }'::jsonb,
  content_template = E'# LinkedIn Outreach

Create LinkedIn message for ${contact_name|''this prospect''}.

## Instructions

1. Gather context:
   - execute_action(''query_crm'', {contact_id})
   - execute_action(''enrich_contact'', {email, name})

2. Choose message type:
   - **Connection Request**: 300 char max, focus on common ground
   - **InMail**: 2000 char max, value-led opening
   - **Follow-up**: Reference previous interaction

3. Personalization elements:
   - Recent company news
   - Shared connections
   - Role-specific challenges
   - Industry trends

## Output Format (email response)
```json
{
  "summary": "LinkedIn message for [Contact] ready",
  "data": {
    "messageType": "connection_request",
    "message": "Hi [Name], I noticed you''re leading [initiative] at [Company]...",
    "characterCount": 287,
    "personalizationHooks": [
      "Referenced recent funding announcement",
      "Mentioned shared connection: [Name]"
    ],
    "alternateVersions": [
      {"tone": "casual", "message": "..."},
      {"tone": "formal", "message": "..."}
    ],
    "bestPractices": [
      "Send Tuesday-Thursday 9am-11am",
      "Follow up after 3 days if no response"
    ]
  },
  "actions": [
    {"label": "Copy Message", "callback": "copy_text"},
    {"label": "Open LinkedIn", "callback": "open_url"}
  ]
}
```',
  updated_at = now()
WHERE skill_key = 'linkedin-outreach';

-- 7. Cold Email (writing)
UPDATE platform_skills
SET
  frontmatter = '{
    "name": "Cold Email",
    "description": "Generate personalized cold outreach email. Returns email with subject line variations.",
    "triggers": ["outreach_sequence", "manual_request"],
    "requires_context": ["company_name", "products", "brand_tone"],
    "outputs": {
      "response_type": "email",
      "data_schema": "ColdEmailData"
    },
    "actions": ["query_crm", "enrich_contact", "enrich_company"],
    "response_style": "concise"
  }'::jsonb,
  content_template = E'# Cold Email

Create cold email for ${contact_name|''this prospect''} at ${company_name_prospect|''their company''}.

## Instructions

1. Enrich contact and company:
   - execute_action(''enrich_contact'', {email, name})
   - execute_action(''enrich_company'', {name, domain})

2. Structure email (under 125 words):
   - **Subject**: Specific, curiosity-driving, <50 chars
   - **Opening**: Personalized hook (no "I hope this finds you well")
   - **Problem**: One challenge they likely face
   - **Solution Hint**: How we help similar companies
   - **CTA**: Single, low-friction ask

3. Personalization: Reference specific insight about their role/company

## Output Format (email response)
```json
{
  "summary": "Cold email for [Contact] ready",
  "data": {
    "subject": "Quick question about [specific challenge]",
    "subjectAlternatives": [
      "[Mutual connection] suggested I reach out",
      "Idea for [Company]''s [specific area]"
    ],
    "body": "Hi [Name],\\n\\n[Personalized hook]...\\n\\n[Problem + Solution]...\\n\\n[CTA]\\n\\nBest,\\n[Sender]",
    "personalizationUsed": ["Recent company milestone", "Role-specific pain point"],
    "wordCount": 98,
    "prefilledEmail": "full email content here"
  },
  "actions": [
    {"label": "Open in Composer", "callback": "open_email_composer"},
    {"label": "Copy to Clipboard", "callback": "copy_text"},
    {"label": "Add to Sequence", "callback": "add_to_sequence"}
  ]
}
```',
  updated_at = now()
WHERE skill_key = 'cold-email';

-- 8. Lead Research (enrichment)
UPDATE platform_skills
SET
  frontmatter = '{
    "name": "Lead Research",
    "description": "Comprehensive research on a prospect before outreach. Returns structured dossier.",
    "triggers": ["pre_call_prep", "new_lead", "manual_request"],
    "requires_context": ["company_name"],
    "outputs": {
      "response_type": "lead",
      "data_schema": "LeadResearchData"
    },
    "actions": ["query_crm", "enrich_contact", "enrich_company", "search_emails"],
    "response_style": "concise"
  }'::jsonb,
  content_template = E'# Lead Research

Research ${contact_name|''this lead''} before outreach.

## Instructions

1. Gather all available data:
   - execute_action(''query_crm'', {contact_id, include: [''company'', ''activities'', ''deals'']})
   - execute_action(''enrich_contact'', {email, name, title})
   - execute_action(''enrich_company'', {name: company_name, domain})
   - execute_action(''search_emails'', {contact_email, limit: 5})

2. Compile research dossier:
   - **Person**: Role, background, tenure, LinkedIn insights
   - **Company**: Size, industry, recent news, tech stack
   - **Relationship**: Past interactions, shared connections
   - **Opportunities**: Pain points, buying signals
   - **Risks**: Potential objections, competitors in play

## Output Format (lead response)
```json
{
  "summary": "Research complete for [Name] at [Company]",
  "data": {
    "contact": {
      "name": "John Smith",
      "title": "VP of Sales",
      "tenure": "2 years",
      "background": "Previously at [Company]",
      "linkedIn": "https://linkedin.com/in/..."
    },
    "company": {
      "name": "Acme Corp",
      "industry": "SaaS",
      "size": "200-500 employees",
      "funding": "Series B",
      "recentNews": ["Announced expansion...", "Hired new CRO..."]
    },
    "relationship": {
      "pastInteractions": ["Demo 2024-06-15", "Email thread Aug 2024"],
      "sharedConnections": ["Jane Doe"]
    },
    "opportunities": [
      "Growing sales team - likely need tools",
      "Mentioned scaling challenges in interview"
    ],
    "risks": [
      "Using competitor X currently",
      "Budget cycle ends Q2"
    ],
    "talkingPoints": [
      "Reference their expansion plans",
      "Connect to similar company case study"
    ]
  },
  "actions": [
    {"label": "Start Outreach", "callback": "open_email_composer"},
    {"label": "Schedule Call", "callback": "create_task"}
  ]
}
```',
  updated_at = now()
WHERE skill_key = 'lead-research';

-- 9. Company Analysis (enrichment)
UPDATE platform_skills
SET
  frontmatter = '{
    "name": "Company Analysis",
    "description": "Deep-dive analysis of target company. Returns strategic insights for account planning.",
    "triggers": ["account_planning", "pre_demo", "manual_request"],
    "requires_context": ["company_name"],
    "outputs": {
      "response_type": "action_summary",
      "data_schema": "CompanyAnalysisData"
    },
    "actions": ["enrich_company", "query_crm"],
    "response_style": "concise"
  }'::jsonb,
  content_template = E'# Company Analysis

Analyze ${target_company|''this company''} for account strategy.

## Instructions

1. Enrich company data:
   - execute_action(''enrich_company'', {name, domain, website})

2. Research dimensions:
   - **Business Model**: How they make money
   - **Market Position**: Competitors, differentiation
   - **Tech Stack**: Current tools and integrations
   - **Org Structure**: Decision makers, buying committee
   - **Financial Health**: Growth stage, funding, revenue signals

3. Identify strategic opportunities

## Output Format (action_summary response)
```json
{
  "summary": "Company analysis: [Company Name]",
  "data": {
    "overview": {
      "name": "Acme Corp",
      "industry": "B2B SaaS",
      "founded": 2018,
      "headquarters": "San Francisco, CA",
      "employeeCount": "200-500"
    },
    "businessModel": {
      "type": "SaaS subscription",
      "customers": "Mid-market B2B",
      "avgDealSize": "Estimated $50-100K ARR"
    },
    "marketPosition": {
      "competitors": ["Competitor A", "Competitor B"],
      "differentiators": ["Feature X", "Integration Y"],
      "marketShare": "Top 5 in category"
    },
    "techStack": ["Salesforce", "Slack", "AWS"],
    "keyContacts": [
      {"name": "CEO Name", "title": "CEO", "relevance": "Final approver"},
      {"name": "VP Sales", "title": "VP Sales", "relevance": "Champion"}
    ],
    "opportunities": ["Growing team", "New market expansion"],
    "risks": ["Long sales cycle", "Incumbent vendor"]
  },
  "actions": [
    {"label": "Create Account Plan", "callback": "create_task"},
    {"label": "Map Org Chart", "callback": "open_editor"}
  ]
}
```',
  updated_at = now()
WHERE skill_key = 'company-analysis';

-- 10. Meeting Prep (enrichment)
UPDATE platform_skills
SET
  frontmatter = '{
    "name": "Meeting Prep",
    "description": "Prepare briefing before sales meeting. Returns structured prep document with talking points.",
    "triggers": ["meeting_reminder", "pre_call", "manual_request"],
    "requires_context": ["company_name", "products"],
    "outputs": {
      "response_type": "meeting_prep",
      "data_schema": "MeetingPrepData"
    },
    "actions": ["query_crm", "fetch_meetings", "search_emails", "enrich_contact"],
    "response_style": "concise"
  }'::jsonb,
  content_template = E'# Meeting Prep

Prepare for meeting with ${contact_name|''the contact''}.

## Instructions

1. Gather comprehensive context:
   - execute_action(''query_crm'', {contact_id, include: [''company'', ''deals'', ''activities'']})
   - execute_action(''fetch_meetings'', {contact_id, limit: 3})
   - execute_action(''search_emails'', {contact_id, limit: 10})

2. Build prep document:
   - **Attendees**: Who''s joining, their roles
   - **Objective**: What we want to achieve
   - **History**: Past interactions summary
   - **Current Status**: Deal stage, recent activity
   - **Talking Points**: Key topics to cover
   - **Questions to Ask**: Discovery or advancement questions
   - **Objection Prep**: Likely pushback and responses
   - **Success Criteria**: How we''ll know meeting went well

## Output Format (meeting_prep response)
```json
{
  "summary": "Meeting prep: [Meeting Title] with [Contact]",
  "data": {
    "meeting": {
      "title": "Discovery Call",
      "dateTime": "2025-12-30 2:00 PM",
      "duration": "30 min"
    },
    "attendees": [
      {"name": "John Smith", "title": "VP Sales", "notes": "Decision maker"}
    ],
    "objective": "Understand current challenges and qualify budget/timeline",
    "history": {
      "lastMeeting": "2024-11-15 - Initial intro call",
      "emailsExchanged": 5,
      "keyPoints": ["Interested in feature X", "Budget review in Q1"]
    },
    "talkingPoints": [
      "Reference their recent expansion announcement",
      "Demo integration with their existing stack",
      "Discuss implementation timeline"
    ],
    "questionsToAsk": [
      "What''s driving the urgency for a solution?",
      "Who else needs to be involved in the decision?",
      "What does success look like in 6 months?"
    ],
    "objectionPrep": [
      {"objection": "Too expensive", "response": "Let''s look at ROI..."}
    ],
    "successCriteria": "Advance to demo with decision maker confirmed"
  },
  "actions": [
    {"label": "Copy Prep Notes", "callback": "copy_text"},
    {"label": "Open CRM Record", "callback": "open_contact"}
  ]
}
```',
  updated_at = now()
WHERE skill_key = 'meeting-prep';

-- 11. Competitor Intel (enrichment)
UPDATE platform_skills
SET
  frontmatter = '{
    "name": "Competitor Intel",
    "description": "Analyze competitor strengths/weaknesses for sales conversations. Returns battle card content.",
    "triggers": ["competitor_mentioned", "deal_competitive", "manual_request"],
    "requires_context": ["company_name", "products", "competitors"],
    "outputs": {
      "response_type": "sales_coach",
      "data_schema": "CompetitorIntelData"
    },
    "actions": ["query_crm"],
    "response_style": "concise"
  }'::jsonb,
  content_template = E'# Competitor Intel

Battle card for ${competitor_name|''this competitor''} vs ${company_name}.

## Instructions

1. Analyze competitor from available context:
   - Known competitors: ${competitors|join('', '')}
   - Our strengths: ${products}

2. Build comparison:
   - **Their Strengths**: What they do well
   - **Their Weaknesses**: Where they fall short
   - **Our Differentiators**: Why we win
   - **Common Objections**: Why prospects consider them
   - **Win Strategies**: How to beat them

## Output Format (sales_coach response)
```json
{
  "summary": "Battle card: [Company] vs [Competitor]",
  "data": {
    "competitor": {
      "name": "Competitor X",
      "positioning": "Enterprise-focused, feature-rich",
      "pricing": "Higher price point, annual contracts"
    },
    "comparison": {
      "theirStrengths": [
        "Larger brand recognition",
        "More integrations"
      ],
      "theirWeaknesses": [
        "Complex implementation",
        "Slow support response",
        "Expensive for SMB"
      ],
      "ourDifferentiators": [
        "Faster time to value",
        "Better customer support",
        "Flexible pricing"
      ]
    },
    "battleTactics": {
      "ifTheyMention": "Feature X",
      "weCounter": "Our approach to X actually provides...",
      "proofPoints": ["Case study: Company switched and saved..."]
    },
    "commonObjections": [
      {"objection": "They have more features", "response": "Quality over quantity..."},
      {"objection": "They are more established", "response": "We move faster..."}
    ],
    "winRate": "We win 65% of competitive deals against them"
  },
  "actions": [
    {"label": "Copy Battle Card", "callback": "copy_text"},
    {"label": "View Full Comparison", "callback": "open_document"}
  ]
}
```',
  updated_at = now()
WHERE skill_key = 'competitor-intel';

-- 12. New Lead Workflow (workflows)
UPDATE platform_skills
SET
  frontmatter = '{
    "name": "New Lead Workflow",
    "description": "Automated workflow when new lead is created. Qualifies, enriches, and routes appropriately.",
    "triggers": ["lead_created"],
    "requires_context": ["company_name", "icp_summary"],
    "outputs": {
      "response_type": "action_summary",
      "data_schema": "WorkflowResultData"
    },
    "actions": ["query_crm", "enrich_contact", "enrich_company", "create_task", "send_slack"],
    "response_style": "concise"
  }'::jsonb,
  content_template = E'# New Lead Workflow

Process new lead ${contact_name|''this lead''} through qualification workflow.

## Workflow Steps

1. **Enrich Lead Data**
   - execute_action(''enrich_contact'', {email, name})
   - execute_action(''enrich_company'', {domain: email_domain})

2. **Qualify Against ICP**
   - Score lead using ICP criteria
   - Classify: Qualified / Nurture / Disqualified

3. **Route Appropriately**
   - Qualified (70+): Create task for immediate follow-up
   - Nurture (40-69): Add to nurture sequence
   - Disqualified (<40): Archive with reason

4. **Notify Team** (if qualified):
   - execute_action(''send_slack'', {channel: "sales-leads", message: "..."})

## Output Format (action_summary response)
```json
{
  "summary": "New lead processed: [Name] - [Qualification Result]",
  "data": {
    "lead": {
      "name": "John Smith",
      "email": "john@company.com",
      "company": "Acme Corp"
    },
    "enrichment": {
      "contactEnriched": true,
      "companyEnriched": true,
      "confidence": 0.85
    },
    "qualification": {
      "score": 78,
      "tier": "Qualified",
      "keyFactors": ["Industry match", "Budget signals", "Right size"]
    },
    "actions_taken": [
      "Enriched contact with Gemini",
      "Created follow-up task for tomorrow",
      "Notified #sales-leads channel"
    ],
    "nextStep": "Follow-up call scheduled for tomorrow 10am"
  },
  "actions": [
    {"label": "View Lead", "callback": "open_contact"},
    {"label": "Start Outreach", "callback": "open_email_composer"}
  ]
}
```',
  updated_at = now()
WHERE skill_key = 'new-lead-workflow';

-- 13. Deal Won Workflow (workflows)
UPDATE platform_skills
SET
  frontmatter = '{
    "name": "Deal Won Workflow",
    "description": "Automated workflow when deal is marked won. Triggers celebration and handoff actions.",
    "triggers": ["deal_won"],
    "requires_context": ["company_name"],
    "outputs": {
      "response_type": "action_summary",
      "data_schema": "WorkflowResultData"
    },
    "actions": ["query_crm", "send_slack", "create_task"],
    "response_style": "concise"
  }'::jsonb,
  content_template = E'# Deal Won Workflow

Process closed-won deal ${deal_name|''this deal''}.

## Workflow Steps

1. **Gather Deal Details**
   - execute_action(''query_crm'', {deal_id, include: [''contacts'', ''value'', ''stage_history'']})

2. **Celebrate Win**
   - execute_action(''send_slack'', {channel: "wins", message: "..."})
   - Include deal value, customer name, sales cycle length

3. **Initiate Handoff**
   - Create task for CS/Implementation intro
   - Schedule kickoff call
   - Update CRM with close notes

4. **Capture Learnings**
   - Record why we won
   - Note key stakeholders and their roles

## Output Format (action_summary response)
```json
{
  "summary": "Deal won: [Company] - $[Value]",
  "data": {
    "deal": {
      "name": "Acme Corp - Enterprise",
      "value": 85000,
      "closeDate": "2025-12-30",
      "salesCycleLength": "45 days",
      "owner": "Jane Doe"
    },
    "celebration": {
      "slackPosted": true,
      "channel": "#wins",
      "message": "Just closed Acme Corp for $85K ARR! Key champion: VP Sales..."
    },
    "handoff": {
      "csOwner": "Mike Johnson",
      "kickoffScheduled": "2025-01-05",
      "tasksCreated": ["CS Intro Email", "Kickoff Prep", "Contract Filing"]
    },
    "winFactors": [
      "Strong champion relationship",
      "Quick POC success",
      "Executive alignment early"
    ]
  },
  "actions": [
    {"label": "View Deal", "callback": "open_deal"},
    {"label": "Send Thank You", "callback": "open_email_composer"}
  ]
}
```',
  updated_at = now()
WHERE skill_key = 'deal-won-workflow';

-- 14. Stale Deal Workflow (workflows)
UPDATE platform_skills
SET
  frontmatter = '{
    "name": "Stale Deal Workflow",
    "description": "Re-engagement workflow for deals with no activity. Diagnoses and suggests revival strategy.",
    "triggers": ["deal_stale", "no_activity_14d", "manual_request"],
    "requires_context": ["company_name"],
    "outputs": {
      "response_type": "deal_health",
      "data_schema": "StaleDealData"
    },
    "actions": ["query_crm", "fetch_meetings", "search_emails", "create_task", "send_slack"],
    "response_style": "concise"
  }'::jsonb,
  content_template = E'# Stale Deal Workflow

Diagnose and revive stale deal ${deal_name|''this deal''}.

## Instructions

1. **Assess Deal Status**
   - execute_action(''query_crm'', {deal_id, include: [''activities'', ''contacts'', ''stage_history'']})
   - execute_action(''fetch_meetings'', {deal_id, limit: 5})
   - execute_action(''search_emails'', {deal_id, limit: 10})

2. **Diagnose Stall Reason**
   - Champion went dark
   - Budget frozen
   - Priority shifted
   - Competitor engagement
   - Internal reorganization

3. **Recommend Revival Strategy**
   - Multi-thread approach
   - Value reinforcement
   - Executive outreach
   - New use case introduction

4. **Create Action Plan**
   - execute_action(''create_task'', {...})
   - Optionally alert manager

## Output Format (deal_health response)
```json
{
  "summary": "Stale deal analysis: [Deal Name] - [Days Inactive]",
  "data": {
    "deal": {
      "name": "Acme Corp - Enterprise",
      "value": 85000,
      "stage": "Proposal",
      "daysInactive": 21,
      "lastActivity": "2025-12-09"
    },
    "diagnosis": {
      "likelyCause": "Champion went dark",
      "riskLevel": "medium",
      "signals": [
        "No email response in 14 days",
        "Meeting rescheduled twice",
        "Budget review mentioned in last call"
      ]
    },
    "revivalStrategy": {
      "approach": "Multi-thread + Value Refresh",
      "actions": [
        "Reach out to secondary contact (CFO)",
        "Send new case study relevant to their challenge",
        "Offer extended trial or pilot"
      ],
      "talkTrack": "Following up on our proposal. I wanted to share a recent success story..."
    },
    "riskAssessment": {
      "winProbability": 35,
      "recommendation": "Invest effort if strategic account, otherwise deprioritize"
    }
  },
  "actions": [
    {"label": "Create Revival Tasks", "callback": "create_task"},
    {"label": "Alert Manager", "callback": "send_slack"},
    {"label": "Send Re-engagement Email", "callback": "open_email_composer"}
  ]
}
```',
  updated_at = now()
WHERE skill_key = 'stale-deal-workflow';

-- =============================================================================
-- PART 2: ADD NEW SKILLS
-- =============================================================================

-- 15. Ghosting Detection (sales-ai) - NEW
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'ghosting-detection',
  'sales-ai',
  '{
    "name": "Ghosting Detection",
    "description": "Detect when prospects go dark and recommend re-engagement tactics. Returns ghost score with revival strategy.",
    "triggers": ["no_response_7d", "email_bounce", "manual_check"],
    "requires_context": ["company_name"],
    "outputs": {
      "response_type": "deal_health",
      "data_schema": "GhostingDetectionData"
    },
    "actions": ["query_crm", "search_emails", "fetch_meetings", "create_task"],
    "response_style": "concise"
  }'::jsonb,
  E'# Ghosting Detection

Analyze engagement status for ${contact_name|''this contact''}.

## Instructions

1. Gather activity data:
   - execute_action(''search_emails'', {contact_id, limit: 20})
   - execute_action(''fetch_meetings'', {contact_id, limit: 5})
   - execute_action(''query_crm'', {contact_id, include: [''activities'']})

2. Calculate ghost score:
   - Days since last response: +10 per day (max 100)
   - Emails sent without reply: +15 per email
   - Meetings cancelled/no-show: +25 each
   - Call attempts unanswered: +10 each

3. Classify status:
   - **Active** (0-30): Normal engagement
   - **Cooling** (31-60): Engagement declining
   - **Ghosting** (61-85): Likely disengaged
   - **Gone Dark** (86+): No response, needs intervention

4. Recommend re-engagement based on status

## Output Format (deal_health response)
```json
{
  "summary": "Ghost status: [Contact] - [Classification]",
  "data": {
    "contact": {
      "name": "John Smith",
      "company": "Acme Corp",
      "lastResponse": "2025-12-10",
      "daysSilent": 20
    },
    "ghostScore": 72,
    "classification": "Ghosting",
    "signals": [
      "No email response in 20 days",
      "Last meeting cancelled without reschedule",
      "2 voicemails unreturned"
    ],
    "reengagementStrategy": {
      "approach": "Breakup Email + Alternative Contact",
      "tactics": [
        "Send breakup email (creates urgency)",
        "Reach out to colleague/champion",
        "Try different channel (LinkedIn, phone)",
        "Share relevant content without ask"
      ],
      "templates": {
        "breakup": "Hi [Name], I''ve tried reaching you a few times. I''ll assume timing isn''t right and close out my notes. If priorities change...",
        "alternateContact": "Hi [Name], I''ve been working with [Ghost] on [project]. Wanted to check if you have visibility into..."
      }
    },
    "riskFactors": [
      "Was responsive before - something changed",
      "Deal value: $85K at risk"
    ]
  },
  "actions": [
    {"label": "Send Breakup Email", "callback": "open_email_composer"},
    {"label": "Create Follow-up Task", "callback": "create_task"},
    {"label": "Find Alt Contact", "callback": "search_contacts"}
  ]
}
```'
) ON CONFLICT (skill_key) DO UPDATE SET
  category = EXCLUDED.category,
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- 16. Follow-up Sequence (workflows) - NEW
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'follow-up-sequence',
  'workflows',
  '{
    "name": "Follow-up Sequence",
    "description": "Create multi-touch follow-up plan with timing and templates. Returns structured sequence.",
    "triggers": ["meeting_ended", "proposal_sent", "manual_request"],
    "requires_context": ["company_name", "brand_tone"],
    "outputs": {
      "response_type": "action_summary",
      "data_schema": "SequenceData"
    },
    "actions": ["query_crm", "fetch_meetings", "create_task"],
    "response_style": "concise"
  }'::jsonb,
  E'# Follow-up Sequence

Create follow-up plan for ${contact_name|''this contact''} after ${trigger_event|''our interaction''}.

## Instructions

1. Gather context:
   - execute_action(''query_crm'', {contact_id, include: [''deals'', ''activities'']})
   - execute_action(''fetch_meetings'', {contact_id, limit: 1})

2. Design sequence based on trigger:
   - **Post-Meeting**: 1-3-7 day cadence
   - **Post-Proposal**: 2-5-10 day cadence
   - **Post-Demo**: 1-4-7 day cadence
   - **Revival**: 3-7-14 day cadence

3. Create task for each touchpoint:
   - execute_action(''create_task'', {...})

## Output Format (action_summary response)
```json
{
  "summary": "Follow-up sequence: [X] touches over [Y] days",
  "data": {
    "sequence": {
      "name": "Post-Demo Follow-up",
      "totalTouches": 4,
      "duration": "10 days"
    },
    "touches": [
      {
        "day": 1,
        "type": "email",
        "subject": "Resources from our demo",
        "template": "Hi [Name], Great speaking today...",
        "purpose": "Recap + deliver promised materials"
      },
      {
        "day": 3,
        "type": "email",
        "subject": "Quick question about [specific topic]",
        "template": "Hi [Name], I''ve been thinking about...",
        "purpose": "Add value, check for questions"
      },
      {
        "day": 7,
        "type": "call",
        "script": "Checking in on your evaluation...",
        "purpose": "Qualify next steps"
      },
      {
        "day": 10,
        "type": "email",
        "subject": "Next steps for [Company]",
        "template": "Hi [Name], Wanted to touch base...",
        "purpose": "Advance or close loop"
      }
    ],
    "tasksCreated": ["Day 1 follow-up", "Day 3 check-in", "Day 7 call", "Day 10 close loop"]
  },
  "actions": [
    {"label": "Start Sequence", "callback": "create_task"},
    {"label": "Customize Templates", "callback": "open_editor"}
  ]
}
```'
) ON CONFLICT (skill_key) DO UPDATE SET
  category = EXCLUDED.category,
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- 17. Slack Deal Alert (workflows) - NEW
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'slack-deal-alert',
  'workflows',
  '{
    "name": "Slack Deal Alert",
    "description": "Send formatted deal update to Slack channel. Returns Block Kit formatted message.",
    "triggers": ["deal_stage_change", "deal_won", "deal_lost", "manual_request"],
    "requires_context": ["company_name"],
    "outputs": {
      "response_type": "action_summary",
      "data_schema": "SlackAlertData"
    },
    "actions": ["query_crm", "send_slack"],
    "response_style": "concise"
  }'::jsonb,
  E'# Slack Deal Alert

Send deal update for ${deal_name|''this deal''} to Slack.

## Instructions

1. Get deal details:
   - execute_action(''query_crm'', {deal_id, include: [''contacts'', ''stage_history'', ''value'']})

2. Format for Slack Block Kit:
   - Use sections for key info
   - Include relevant emoji
   - Add action buttons if applicable

3. Send to appropriate channel:
   - execute_action(''send_slack'', {channel, message, blocks})

## Output Format (action_summary response)
```json
{
  "summary": "Deal alert sent to #[channel]",
  "data": {
    "deal": {
      "name": "Acme Corp - Enterprise",
      "value": 85000,
      "stage": "Proposal",
      "owner": "Jane Doe"
    },
    "alertType": "stage_change",
    "slackMessage": {
      "channel": "deals-updates",
      "blocks": [
        {
          "type": "header",
          "text": {"type": "plain_text", "text": "Deal Update: Acme Corp"}
        },
        {
          "type": "section",
          "fields": [
            {"type": "mrkdwn", "text": "*Value:* $85,000"},
            {"type": "mrkdwn", "text": "*Stage:* Proposal"},
            {"type": "mrkdwn", "text": "*Owner:* Jane Doe"},
            {"type": "mrkdwn", "text": "*Next Step:* Send proposal by EOD"}
          ]
        },
        {
          "type": "actions",
          "elements": [
            {"type": "button", "text": {"type": "plain_text", "text": "View Deal"}, "url": "..."}
          ]
        }
      ]
    },
    "sent": true
  },
  "actions": [
    {"label": "View in Slack", "callback": "open_url"},
    {"label": "Send Another", "callback": "send_slack"}
  ]
}
```'
) ON CONFLICT (skill_key) DO UPDATE SET
  category = EXCLUDED.category,
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- 18. Sales Coaching Insight (sales-ai) - NEW
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'sales-coaching-insight',
  'sales-ai',
  '{
    "name": "Sales Coaching Insight",
    "description": "Analyze sales activities and provide coaching feedback. Returns personalized improvement suggestions.",
    "triggers": ["weekly_review", "deal_lost", "manual_request"],
    "requires_context": ["company_name"],
    "outputs": {
      "response_type": "sales_coach",
      "data_schema": "CoachingInsightData"
    },
    "actions": ["query_crm", "fetch_meetings", "search_emails"],
    "response_style": "concise"
  }'::jsonb,
  E'# Sales Coaching Insight

Provide coaching feedback for ${rep_name|''this rep''}.

## Instructions

1. Analyze recent activity:
   - execute_action(''query_crm'', {user_id, include: [''deals'', ''activities'']})
   - execute_action(''fetch_meetings'', {user_id, limit: 10})
   - execute_action(''search_emails'', {user_id, limit: 20})

2. Evaluate across dimensions:
   - **Activity Volume**: Calls, emails, meetings
   - **Deal Progression**: Stage advancement rate
   - **Conversion Rates**: Lead→Opportunity→Close
   - **Communication Quality**: Response times, follow-up
   - **Deal Hygiene**: CRM updates, notes

3. Generate coaching recommendations

## Output Format (sales_coach response)
```json
{
  "summary": "Coaching insights for [Rep] - [Focus Area]",
  "data": {
    "rep": {
      "name": "Jane Doe",
      "role": "Account Executive",
      "period": "Last 30 days"
    },
    "performance": {
      "activityScore": 78,
      "dealVelocity": 65,
      "conversionRate": 22,
      "overallScore": 72
    },
    "strengths": [
      "Excellent meeting-to-proposal conversion (85%)",
      "Strong discovery call structure",
      "Good multi-threading on enterprise deals"
    ],
    "improvementAreas": [
      {
        "area": "Follow-up Timing",
        "observation": "Average 3.2 days between touches",
        "recommendation": "Aim for 1-2 day follow-up on active deals",
        "impact": "Could improve close rate by 15%"
      },
      {
        "area": "Deal Qualification",
        "observation": "25% of deals stall at proposal",
        "recommendation": "Strengthen BANT qualification earlier",
        "impact": "Better pipeline quality"
      }
    ],
    "actionItems": [
      "Review and improve follow-up templates",
      "Add qualification checkpoint before proposal",
      "Schedule deal review for stuck opportunities"
    ],
    "metrics": {
      "callsThisPeriod": 45,
      "emailsSent": 120,
      "meetingsHeld": 18,
      "dealsAdvanced": 8,
      "dealsWon": 2,
      "dealsLost": 1
    }
  },
  "actions": [
    {"label": "Schedule 1:1", "callback": "create_task"},
    {"label": "View Full Analytics", "callback": "open_dashboard"}
  ]
}
```'
) ON CONFLICT (skill_key) DO UPDATE SET
  category = EXCLUDED.category,
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- 19. Deal Stall Analysis (sales-ai) - NEW
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'deal-stall-analysis',
  'sales-ai',
  '{
    "name": "Deal Stall Analysis",
    "description": "Identify why deals are stalling at specific stages. Returns root cause analysis with remediation.",
    "triggers": ["deal_stuck_14d", "stage_timeout", "manual_request"],
    "requires_context": ["company_name"],
    "outputs": {
      "response_type": "deal_health",
      "data_schema": "DealStallData"
    },
    "actions": ["query_crm", "fetch_meetings", "search_emails", "create_task"],
    "response_style": "concise"
  }'::jsonb,
  E'# Deal Stall Analysis

Analyze why ${deal_name|''this deal''} is stalling.

## Instructions

1. Gather comprehensive deal data:
   - execute_action(''query_crm'', {deal_id, include: [''stage_history'', ''activities'', ''contacts'']})
   - execute_action(''fetch_meetings'', {deal_id, limit: 5})
   - execute_action(''search_emails'', {deal_id, limit: 15})

2. Analyze stall factors:
   - **Stage Duration**: How long at current stage vs average
   - **Activity Gap**: Days since last meaningful activity
   - **Engagement Pattern**: Response rates, meeting attendance
   - **Stakeholder Coverage**: Who we''ve engaged, who''s missing
   - **Competitive Signals**: Mentions of alternatives

3. Identify root cause and recommend actions

## Output Format (deal_health response)
```json
{
  "summary": "Stall analysis: [Deal] - [Root Cause Category]",
  "data": {
    "deal": {
      "name": "Acme Corp - Enterprise",
      "value": 85000,
      "currentStage": "Negotiation",
      "daysInStage": 28,
      "avgDaysForStage": 12
    },
    "stallIndicators": {
      "severity": "high",
      "score": 75,
      "signals": [
        "2.3x longer than average in stage",
        "Champion response rate dropped 60%",
        "CFO mentioned in emails but not engaged"
      ]
    },
    "rootCauseAnalysis": {
      "primaryCause": "Missing economic buyer engagement",
      "secondaryCauses": [
        "Budget approval timing unclear",
        "Competitor comparison in progress"
      ],
      "evidence": [
        "CFO copied but never responded directly",
        "Champion said need budget approval",
        "Prospect asked for competitor comparison matrix"
      ]
    },
    "remediation": {
      "immediate": [
        "Request intro call with CFO",
        "Prepare business case with ROI"
      ],
      "shortTerm": [
        "Create competitive comparison doc",
        "Identify internal champion in finance"
      ],
      "riskMitigation": [
        "Set clear decision timeline",
        "Offer pilot to reduce perceived risk"
      ]
    },
    "projectedOutcome": {
      "withAction": "60% close probability in 30 days",
      "withoutAction": "35% close probability, likely to slip"
    }
  },
  "actions": [
    {"label": "Create Recovery Tasks", "callback": "create_task"},
    {"label": "Draft CFO Outreach", "callback": "open_email_composer"},
    {"label": "Alert Manager", "callback": "send_slack"}
  ]
}
```'
) ON CONFLICT (skill_key) DO UPDATE SET
  category = EXCLUDED.category,
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- 20. Proposal Generator (writing) - NEW
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'proposal-generator',
  'writing',
  '{
    "name": "Proposal Generator",
    "description": "Generate full proposal sections from deal context. Returns structured proposal content.",
    "triggers": ["deal_stage_proposal", "manual_request"],
    "requires_context": ["company_name", "products", "brand_tone"],
    "outputs": {
      "response_type": "email",
      "data_schema": "ProposalData"
    },
    "actions": ["query_crm", "fetch_meetings", "search_emails"],
    "response_style": "concise"
  }'::jsonb,
  E'# Proposal Generator

Generate proposal for ${deal_name|''this deal''}.

## Instructions

1. Gather deal context:
   - execute_action(''query_crm'', {deal_id, include: [''contacts'', ''activities'', ''notes'']})
   - execute_action(''fetch_meetings'', {deal_id, limit: 5})
   - execute_action(''search_emails'', {deal_id, limit: 10})

2. Generate proposal sections:
   - **Executive Summary**: 1 page overview
   - **Understanding**: Their challenges, our approach
   - **Solution**: What we''re proposing
   - **Benefits**: Specific outcomes
   - **Investment**: Pricing, terms
   - **Implementation**: Timeline, process
   - **Next Steps**: Clear call to action

## Output Format (email response)
```json
{
  "summary": "Proposal generated for [Deal Name]",
  "data": {
    "proposal": {
      "title": "Proposal: [Solution] for [Company]",
      "date": "2025-12-30",
      "validUntil": "2026-01-30"
    },
    "sections": {
      "executiveSummary": "Full executive summary text...",
      "understanding": "Based on our conversations, you''re facing...",
      "solution": "We propose implementing [solution] that will...",
      "benefits": [
        "Reduce [metric] by X%",
        "Enable [capability] within [timeframe]",
        "Save [hours/dollars] annually"
      ],
      "investment": {
        "base": "$X/month",
        "implementation": "$Y one-time",
        "total": "$Z first year"
      },
      "implementation": {
        "timeline": "4-6 weeks",
        "phases": ["Discovery", "Configuration", "Training", "Go-Live"]
      },
      "nextSteps": [
        "Review proposal",
        "Address questions",
        "Sign agreement",
        "Kick off implementation"
      ]
    },
    "wordCount": 1850
  },
  "actions": [
    {"label": "Export to Document", "callback": "export_doc"},
    {"label": "Send to Prospect", "callback": "open_email_composer"},
    {"label": "Edit Sections", "callback": "open_editor"}
  ]
}
```'
) ON CONFLICT (skill_key) DO UPDATE SET
  category = EXCLUDED.category,
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- 21. Outreach Sequence (workflows) - NEW
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'outreach-sequence',
  'workflows',
  '{
    "name": "Outreach Sequence",
    "description": "Create personalized multi-channel outreach campaign. Returns structured sequence with templates.",
    "triggers": ["new_target_list", "prospecting_campaign", "manual_request"],
    "requires_context": ["company_name", "products", "brand_tone"],
    "outputs": {
      "response_type": "action_summary",
      "data_schema": "OutreachSequenceData"
    },
    "actions": ["enrich_contact", "enrich_company", "create_task"],
    "response_style": "concise"
  }'::jsonb,
  E'# Outreach Sequence

Create outreach campaign for ${target_persona|''this prospect type''}.

## Instructions

1. Enrich prospect data:
   - execute_action(''enrich_contact'', {email, name})
   - execute_action(''enrich_company'', {name, domain})

2. Design multi-channel sequence:
   - **Channel Mix**: Email, LinkedIn, Phone, Video
   - **Cadence**: 10-15 touches over 3-4 weeks
   - **Personalization**: Role-specific, industry-specific

3. Create templates for each touch

## Output Format (action_summary response)
```json
{
  "summary": "Outreach sequence: [X] touches across [Y] channels",
  "data": {
    "sequence": {
      "name": "VP Sales Outreach",
      "targetPersona": "VP of Sales at mid-market SaaS",
      "totalTouches": 12,
      "duration": "21 days",
      "channels": ["email", "linkedin", "phone"]
    },
    "touches": [
      {"day": 1, "channel": "email", "type": "cold_intro", "template": "..."},
      {"day": 2, "channel": "linkedin", "type": "connection", "template": "..."},
      {"day": 4, "channel": "email", "type": "value_add", "template": "..."},
      {"day": 5, "channel": "phone", "type": "call_1", "script": "..."},
      {"day": 7, "channel": "email", "type": "social_proof", "template": "..."},
      {"day": 9, "channel": "linkedin", "type": "content_share", "template": "..."},
      {"day": 11, "channel": "phone", "type": "call_2", "script": "..."},
      {"day": 14, "channel": "email", "type": "case_study", "template": "..."},
      {"day": 17, "channel": "email", "type": "meeting_ask", "template": "..."},
      {"day": 19, "channel": "linkedin", "type": "message", "template": "..."},
      {"day": 21, "channel": "email", "type": "breakup", "template": "..."}
    ],
    "personalizationFields": [
      "{{company_news}}",
      "{{shared_connection}}",
      "{{industry_stat}}",
      "{{competitor_mention}}"
    ],
    "expectedMetrics": {
      "openRate": "35-45%",
      "replyRate": "8-12%",
      "meetingRate": "3-5%"
    }
  },
  "actions": [
    {"label": "Create Tasks", "callback": "create_task"},
    {"label": "Export to Outreach Tool", "callback": "export_sequence"},
    {"label": "Customize Templates", "callback": "open_editor"}
  ]
}
```'
) ON CONFLICT (skill_key) DO UPDATE SET
  category = EXCLUDED.category,
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- 22. Meeting Prep Briefing (sales-ai) - NEW
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'meeting-prep-briefing',
  'sales-ai',
  '{
    "name": "Meeting Prep Briefing",
    "description": "Quick executive briefing before a meeting. Returns concise prep in 60-second read format.",
    "triggers": ["meeting_15m_reminder", "pre_call", "manual_request"],
    "requires_context": ["company_name"],
    "outputs": {
      "response_type": "meeting_prep",
      "data_schema": "QuickBriefingData"
    },
    "actions": ["query_crm", "fetch_meetings", "search_emails"],
    "response_style": "concise"
  }'::jsonb,
  E'# Meeting Prep Briefing

60-second briefing for meeting with ${contact_name}.

## Instructions

1. Quick data pull:
   - execute_action(''query_crm'', {contact_id, include: [''company'', ''deals'']})
   - execute_action(''fetch_meetings'', {contact_id, limit: 1})

2. Format as scannable briefing:
   - Who: Name, title, company
   - Context: Last interaction, deal status
   - Goal: Meeting objective
   - Ask: Key question to answer
   - Watch: Potential objections

## Output Format (meeting_prep response)
```json
{
  "summary": "Quick brief: [Meeting] with [Contact]",
  "data": {
    "who": {
      "name": "John Smith",
      "title": "VP of Sales",
      "company": "Acme Corp",
      "personality": "Direct, data-driven"
    },
    "context": {
      "lastMeeting": "Dec 15 - Demo",
      "keyTakeaways": ["Liked feature X", "Concerned about integration"],
      "dealStage": "Proposal",
      "dealValue": 85000
    },
    "goal": "Get verbal agreement on proposal terms",
    "keyQuestions": [
      "Any feedback on the proposal?",
      "What''s the approval process from here?"
    ],
    "watchFor": [
      "May push for discount - hold firm on value",
      "CFO approval needed - offer to present to CFO"
    ],
    "openingLine": "Good to speak again! Last time you mentioned wanting to see...",
    "readTime": "45 seconds"
  },
  "actions": [
    {"label": "Join Meeting", "callback": "open_meeting"},
    {"label": "View Full Prep", "callback": "open_detailed_prep"}
  ]
}
```'
) ON CONFLICT (skill_key) DO UPDATE SET
  category = EXCLUDED.category,
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- =============================================================================
-- Verify updates
-- =============================================================================
DO $$
DECLARE
  skill_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO skill_count
  FROM platform_skills
  WHERE frontmatter ? 'outputs'
    AND frontmatter ? 'actions'
    AND frontmatter->>'response_style' = 'concise';

  RAISE NOTICE 'Skills with new format: %', skill_count;

  IF skill_count < 20 THEN
    RAISE WARNING 'Expected at least 20 skills with new format, found %', skill_count;
  ELSE
    RAISE NOTICE 'Successfully updated/created skills with concise execution format';
  END IF;
END $$;
