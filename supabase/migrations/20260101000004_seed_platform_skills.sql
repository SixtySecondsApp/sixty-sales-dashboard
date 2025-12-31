-- Migration: Seed Platform Skills
-- Phase 3: Platform Skills Seeding
-- Creates 17 agent-executable skill documents across 4 categories
-- Date: 2026-01-01

-- =============================================================================
-- Category 1: Sales AI Skills (5 skills)
-- =============================================================================

-- 1. Lead Qualification
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'lead-qualification',
  'sales-ai',
  '{
    "name": "Lead Qualification",
    "description": "Qualify leads based on company ICP, budget signals, and buying intent. Use when evaluating new leads, scoring prospects, or prioritizing outreach.",
    "triggers": ["lead_created", "enrichment_completed", "manual_qualification"],
    "requires_context": ["company_name", "industry", "products", "competitors", "target_market"],
    "outputs": ["qualification_score", "qualification_status", "next_action"]
  }'::jsonb,
  E'# Lead Qualification

Skill for qualifying leads against ${company_name|''Your Company''}''s ideal customer profile.

## Company Context

You are qualifying leads for **${company_name}**, a company in the **${industry}** industry.

**Our Products:** ${products|join('', '')|''Our main product''}

**Target Market:** ${target_market|''B2B companies''}

## Qualification Criteria

### Must-Have Signals
- Company operates in ${industry} or adjacent markets
- Has need for ${main_product|''our solution''} or similar solutions
- Shows buying intent signals

### Disqualification Signals
- Already using ${primary_competitor|''a direct competitor''} extensively
- Company size below minimum threshold
- No budget authority identified
- Geographic restrictions apply

## Scoring Model

| Factor | Weight | Assessment Method |
|--------|--------|-------------------|
| Industry Match | 30% | Compare to ${industry} and related verticals |
| Product Fit | 40% | Evaluate need for ${products[0].name|''our product''} |
| Company Size | 20% | Check against ideal employee range |
| Urgency Signals | 10% | Look for buying signals and timeline indicators |

## Score Interpretation

**Score >= 70: Qualified**
- Mark lead as "Qualified"
- Trigger immediate follow-up sequence
- Notify assigned sales rep
- Suggested next action: Schedule discovery call

**Score 40-69: Nurture**
- Mark lead as "Nurture"
- Add to nurture campaign
- Set reminder for re-evaluation in 30 days
- Suggested next action: Send educational content

**Score < 40: Disqualified**
- Mark lead as "Disqualified"
- Log specific reason for disqualification
- Remove from active pipeline
- Suggested next action: Archive with notes'
);

-- 2. ICP Matching
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'icp-matching',
  'sales-ai',
  '{
    "name": "ICP Matching",
    "description": "Match prospects against ideal customer profile. Use when prioritizing accounts, segmenting leads, or validating target market fit.",
    "triggers": ["account_created", "enrichment_completed", "batch_scoring"],
    "requires_context": ["company_name", "industry", "target_market", "products"],
    "outputs": ["icp_score", "matching_factors", "gaps"]
  }'::jsonb,
  E'# ICP Matching

Evaluate how well a prospect matches ${company_name|''Your Company''}''s ideal customer profile.

## Ideal Customer Profile

**Target Industry:** ${industry}
**Target Market:** ${target_market|''Mid-market B2B companies''}
**Our Solution:** ${main_product|''Our product''}

## ICP Criteria

### Company Characteristics
1. **Industry Alignment**
   - Primary: ${industry}
   - Adjacent: Related technology and service sectors

2. **Company Size**
   - Employee count: ${employee_count|''50-500''} employees range
   - Revenue: Aligned with pricing tier

3. **Technology Stack**
   - Uses compatible tools: ${tech_stack|join('', '')|''Modern tech stack''}
   - Has integration requirements we can meet

### Buying Signals
- Active evaluation of ${main_product|''similar solutions''}
- Budget approved or planning cycle active
- Decision maker identified and engaged
- Timeline defined (ideally within 6 months)

### Pain Points We Solve
${pain_points|join(''\\n- '')|''Common industry challenges''}

## Scoring Matrix

| Criterion | Weight | Perfect Match | Partial Match | No Match |
|-----------|--------|---------------|---------------|----------|
| Industry | 25% | 100% | 50% | 0% |
| Size | 20% | 100% | 60% | 20% |
| Pain Points | 25% | 100% | 50% | 10% |
| Technology | 15% | 100% | 70% | 30% |
| Budget/Timeline | 15% | 100% | 40% | 0% |

## Output

Provide:
1. Overall ICP score (0-100)
2. List of matching factors
3. Gaps or concerns
4. Recommended account tier (A/B/C)'
);

-- 3. Objection Handling
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'objection-handling',
  'sales-ai',
  '{
    "name": "Objection Handling",
    "description": "Provide contextual responses to common sales objections. Use during sales calls, email responses, or proposal discussions.",
    "triggers": ["objection_detected", "sales_call", "email_response"],
    "requires_context": ["company_name", "products", "competitors", "value_propositions"],
    "outputs": ["response_text", "follow_up_questions", "supporting_materials"]
  }'::jsonb,
  E'# Objection Handling

Contextual objection responses for ${company_name|''Your Company''} sales conversations.

## Company Context

**Company:** ${company_name}
**Products:** ${products|join('', '')|''Our solutions''}
**Value Props:** ${value_propositions|join('', '')|''Key benefits''}
**Competitors:** ${competitors|join('', '')|''Industry alternatives''}

## Common Objections & Responses

### Price Objection
**"It''s too expensive"**

Response Framework:
1. Acknowledge the concern
2. Quantify the value/ROI
3. Compare to cost of not solving the problem
4. Offer flexible options

Sample Response:
"I understand budget is a consideration. Many of our customers initially felt the same way. What they found was that ${main_product|''our solution''} typically delivers [X]% ROI within [timeframe]. Would it help if we looked at the specific value for your situation?"

### Competitor Objection
**"We''re looking at ${primary_competitor|''alternatives''}"**

Response Framework:
1. Acknowledge they''re doing due diligence
2. Highlight key differentiators
3. Offer comparison resources
4. Focus on their specific needs

Sample Response:
"Great that you''re evaluating options thoroughly. While ${primary_competitor|''they''} do [acknowledgment], where we really stand out is ${value_propositions[0]|''our unique value''}. What matters most to you in this decision?"

### Timing Objection
**"Not the right time"**

Response Framework:
1. Understand the underlying concern
2. Quantify cost of delay
3. Offer lower-commitment next step
4. Set future touchpoint

### Authority Objection
**"I need to check with my team"**

Response Framework:
1. Validate their process
2. Offer to help build internal case
3. Provide materials for stakeholders
4. Schedule follow-up

## Follow-Up Questions

After addressing any objection, use these probing questions:
- "What would need to be true for this to make sense for you?"
- "If we could solve [specific concern], would this be worth exploring further?"
- "Who else should be part of this conversation?"'
);

-- 4. Deal Scoring
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'deal-scoring',
  'sales-ai',
  '{
    "name": "Deal Scoring",
    "description": "Score deals based on likelihood to close and deal quality. Use for pipeline reviews, forecasting, and prioritization.",
    "triggers": ["deal_updated", "weekly_review", "forecast_request"],
    "requires_context": ["company_name", "products"],
    "outputs": ["deal_score", "win_probability", "risk_factors", "recommended_actions"]
  }'::jsonb,
  E'# Deal Scoring

Evaluate deal health and win probability for ${company_name|''Your Company''} pipeline.

## Scoring Dimensions

### 1. Qualification Strength (25%)
- [ ] Confirmed budget exists
- [ ] Decision maker identified and engaged
- [ ] Timeline defined and realistic
- [ ] Pain point clearly articulated
- [ ] ICP match validated

### 2. Engagement Level (25%)
- [ ] Multiple stakeholders involved
- [ ] Responded to last outreach within 48hrs
- [ ] Attended demo/meeting in last 14 days
- [ ] Actively asking questions
- [ ] Sharing internal information

### 3. Competitive Position (20%)
- [ ] We are the primary option
- [ ] Differentiators resonate with buyer
- [ ] No major competitor threats identified
- [ ] Previous positive interactions with ${company_name}
- [ ] Reference customers in their industry

### 4. Process Progress (20%)
- [ ] Discovery completed
- [ ] Solution presented
- [ ] Proposal delivered
- [ ] Negotiation started
- [ ] Verbal commitment received

### 5. Timing & Urgency (10%)
- [ ] Clear event or deadline driving decision
- [ ] Budget cycle aligns
- [ ] No blocking dependencies
- [ ] Champion actively pushing internally

## Risk Factors to Flag

**High Risk:**
- No contact in 14+ days
- Key stakeholder left company
- Budget cut or frozen
- Competitor deep in evaluation

**Medium Risk:**
- Decision timeline slipping
- New stakeholders introduced late
- Scope creep in requirements
- Pricing pushback without negotiation

## Score Interpretation

| Score Range | Win Probability | Forecast Category |
|-------------|-----------------|-------------------|
| 80-100 | 70%+ | Commit |
| 60-79 | 40-69% | Best Case |
| 40-59 | 20-39% | Pipeline |
| <40 | <20% | At Risk |'
);

-- 5. Brand Voice
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'brand-voice',
  'sales-ai',
  '{
    "name": "Brand Voice",
    "description": "Guidelines for maintaining consistent brand voice in all communications. Use when writing emails, proposals, or any customer-facing content.",
    "triggers": ["content_generation", "email_writing", "proposal_creation"],
    "requires_context": ["company_name", "tagline", "value_propositions", "industry"],
    "outputs": ["tone_guidelines", "vocabulary", "examples"]
  }'::jsonb,
  E'# Brand Voice Guide

Communication guidelines for ${company_name|''Your Company''}.

## Brand Identity

**Company:** ${company_name}
**Tagline:** ${tagline|''Your tagline here''}
**Industry:** ${industry}

## Voice Characteristics

### Tone
- **Professional yet approachable** - Expert without being condescending
- **Confident but not arrogant** - We know our value, we don''t need to oversell
- **Helpful and consultative** - We''re partners, not just vendors
- **Clear and direct** - No jargon or fluff

### Key Phrases to Use
${key_phrases|join(''\\n- '')|''- Industry-leading solution\\n- Transform your workflow\\n- Trusted by teams''}

### Words to Avoid
${words_to_avoid|join('', '')|''cheap, basic, simple, just, only''}

## Writing Guidelines

### Email Communication
1. Start with value, not pleasantries
2. Keep paragraphs to 2-3 sentences max
3. Use bullet points for multiple items
4. End with clear next step
5. Sign off professionally but warmly

### Proposal Language
1. Lead with business outcomes
2. Quantify value where possible
3. Use customer''s own language
4. Address concerns proactively
5. Make next steps crystal clear

## Value Proposition Messaging

When communicating value, emphasize:
${value_propositions|join(''\\n1. '')|''1. Increased efficiency\\n2. Better outcomes\\n3. Reduced costs''}

## Example Phrases

**Opening a cold email:**
- "I noticed [specific observation about their company]..."
- "Teams like yours at [similar company] have been able to..."

**Describing our solution:**
- "${main_product|''Our solution''} helps ${target_market|''companies''} achieve..."
- "What sets us apart is ${value_propositions[0]|''our unique approach''}..."

**Closing a conversation:**
- "Based on what you''ve shared, I''d recommend..."
- "Would it make sense to explore this further with a..."'
);

-- =============================================================================
-- Category 2: Writing Skills (5 skills)
-- =============================================================================

-- 6. Follow-up Email
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'follow-up-email',
  'writing',
  '{
    "name": "Follow-up Email",
    "description": "Generate personalized follow-up emails after meetings or interactions. Use after calls, demos, or any customer touchpoint.",
    "triggers": ["meeting_ended", "demo_completed", "manual_request"],
    "requires_context": ["company_name", "products", "value_propositions"],
    "outputs": ["email_subject", "email_body"]
  }'::jsonb,
  E'# Follow-up Email Generator

Create personalized follow-up emails for ${company_name|''Your Company''}.

## Context

**From:** ${company_name}
**Products:** ${products|join('', '')|''Our solutions''}
**Value Props:** ${value_propositions|join('', '')|''Key benefits''}

## Email Structure

### Subject Line
Keep it specific and reference the conversation:
- "[Company Name] + ${company_name} - Next Steps"
- "Following up: [Specific topic discussed]"
- "Resources from our call"

### Opening (1-2 sentences)
Reference the specific conversation and express appreciation:
- "Great speaking with you about [topic] today."
- "Thanks for taking the time to explore [specific area]."

### Value Recap (2-3 bullets)
Summarize the key points discussed:
- Main pain point they mentioned
- How ${main_product|''our solution''} addresses it
- Specific outcome they''re looking for

### Next Steps (Clear CTA)
Propose a specific next action:
- Schedule follow-up meeting
- Send additional resources
- Connect with other stakeholders

### Resources (Optional)
Include relevant materials:
- Case study from similar company
- Product documentation
- ROI calculator

## Template

Subject: [Conversation Reference] - Next Steps from ${company_name}

Hi [Name],

Thanks for the great conversation today about [specific topic]. I enjoyed learning about [something specific about their situation].

Based on what you shared about [their challenge], I think ${main_product|''our solution''} could help you:
- [Specific benefit 1 tied to their need]
- [Specific benefit 2]
- [Specific benefit 3]

As a next step, [proposed action with specific date/time options].

I''m also attaching [relevant resource] that shows how [similar company] achieved [specific result].

Looking forward to continuing the conversation.

Best,
[Your name]'
);

-- 7. Proposal Intro
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'proposal-intro',
  'writing',
  '{
    "name": "Proposal Introduction",
    "description": "Generate compelling proposal introductions tailored to the prospect. Use when creating formal proposals or business cases.",
    "triggers": ["proposal_requested", "rfp_response", "manual_request"],
    "requires_context": ["company_name", "products", "value_propositions", "target_market"],
    "outputs": ["intro_section", "executive_summary"]
  }'::jsonb,
  E'# Proposal Introduction Generator

Create compelling proposal introductions for ${company_name|''Your Company''}.

## Context

**From:** ${company_name}
**Products:** ${products|join('', '')|''Our solutions''}
**Value Props:** ${value_propositions|join('', '')|''Key benefits''}
**Target Market:** ${target_market|''B2B companies''}

## Executive Summary Structure

### Opening Hook
Start with their business challenge:
"[Prospect Company] is seeking to [their goal]. With [industry trend or challenge], achieving this requires [solution category]."

### Solution Overview
Present ${company_name} as the answer:
"${company_name} provides ${main_product|''a comprehensive solution''} that enables ${target_market|''organizations''} to [primary benefit]."

### Key Benefits
Quantify where possible:
${value_propositions|join(''\\n- '')|''- Increased efficiency\\n- Better outcomes\\n- Reduced costs''}

### Why Us
Differentiation statement:
"What sets ${company_name} apart is [key differentiator]. Unlike alternatives, we [unique capability]."

### Next Steps
Clear path forward:
"This proposal outlines [scope] and provides a clear path to [desired outcome] within [timeframe]."

## Template

---

**Executive Summary**

[Prospect Company] has identified the need to [their stated goal]. In today''s [industry context], achieving this objective requires a solution that [key requirements].

After thorough analysis of your requirements and extensive discussions with [stakeholder names], we believe ${company_name}''s ${main_product|''solution''} is uniquely positioned to help [Prospect Company] achieve [specific outcome].

**Proposed Solution**

${company_name} will provide [solution scope] that enables your team to:
• [Benefit 1 with metric]
• [Benefit 2 with metric]
• [Benefit 3 with metric]

**Investment**

The total investment for this engagement is [amount], which includes [scope summary].

**Timeline**

We propose a [X]-phase implementation over [duration], with go-live targeted for [date].

---'
);

-- 8. Meeting Recap
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'meeting-recap',
  'writing',
  '{
    "name": "Meeting Recap",
    "description": "Generate structured meeting recaps with action items and next steps. Use after any customer or internal meeting.",
    "triggers": ["meeting_ended", "transcript_available", "manual_request"],
    "requires_context": ["company_name"],
    "outputs": ["recap_summary", "action_items", "next_steps"]
  }'::jsonb,
  E'# Meeting Recap Generator

Create structured meeting recaps for ${company_name|''Your Company''} meetings.

## Recap Structure

### Meeting Header
- Date: [Date]
- Attendees: [Names and roles]
- Purpose: [Meeting objective]

### Key Discussion Points
Summarize 3-5 main topics discussed:
1. [Topic 1]: Brief summary of what was discussed
2. [Topic 2]: Brief summary
3. [Topic 3]: Brief summary

### Decisions Made
Document any decisions reached:
- [Decision 1]
- [Decision 2]

### Action Items
List with owners and due dates:
| Action | Owner | Due Date |
|--------|-------|----------|
| [Action 1] | [Name] | [Date] |
| [Action 2] | [Name] | [Date] |

### Next Steps
- Next meeting: [Date/Time]
- Preparation needed: [Items]

### Open Questions
- [Question 1]
- [Question 2]

## Template

---

**Meeting Recap: [Meeting Title]**
Date: [Date] | Duration: [X minutes]

**Attendees:**
- [Name] - [Role/Company]
- [Name] - [Role/Company]

**Summary:**
[2-3 sentence summary of the meeting purpose and outcomes]

**Key Points Discussed:**
1. **[Topic]:** [Summary]
2. **[Topic]:** [Summary]
3. **[Topic]:** [Summary]

**Decisions:**
✓ [Decision made]

**Action Items:**
□ [Action] - [Owner] - Due: [Date]
□ [Action] - [Owner] - Due: [Date]

**Next Steps:**
Our next meeting is scheduled for [date] to [purpose]. Before then, [preparation needed].

Please reply if I''ve missed anything or if you have questions.

---'
);

-- 9. LinkedIn Outreach
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'linkedin-outreach',
  'writing',
  '{
    "name": "LinkedIn Outreach",
    "description": "Generate personalized LinkedIn connection requests and messages. Use for prospecting, networking, and relationship building.",
    "triggers": ["prospect_identified", "event_follow_up", "manual_request"],
    "requires_context": ["company_name", "products", "industry", "value_propositions"],
    "outputs": ["connection_request", "follow_up_message", "inmail"]
  }'::jsonb,
  E'# LinkedIn Outreach Generator

Create personalized LinkedIn messages for ${company_name|''Your Company''} outreach.

## Context

**Company:** ${company_name}
**Industry:** ${industry}
**Products:** ${products|join('', '')|''Our solutions''}
**Value Props:** ${value_propositions|join('', '')|''Key benefits''}

## Connection Request (300 char limit)

### Template 1: Shared Interest
"Hi [Name], I noticed we both [shared connection/interest]. I''d love to connect and share insights on [topic]. - [Your name] at ${company_name}"

### Template 2: Content Engagement
"Hi [Name], Really enjoyed your post on [topic]. Your perspective on [specific point] resonated. Would love to connect. - [Your name]"

### Template 3: Industry Peer
"Hi [Name], As fellow professionals in ${industry}, I thought it would be valuable to connect. Always looking to learn from others in the space. - [Your name]"

## Follow-Up After Connection

### Template: Value-First Message
"Thanks for connecting, [Name]!

I noticed [something specific about their company/role]. At ${company_name}, we''ve been helping ${target_market|''companies''} with [relevant challenge].

Curious - is [specific challenge] something your team is thinking about?

Either way, happy to share [resource] that might be useful.

Best,
[Your name]"

## InMail Templates (2000 char limit)

### Template: Problem-Solution
"Hi [Name],

I came across [their company] while researching ${industry} leaders in [specific area].

I noticed [observation about their company or role]. Many [their role]s I speak with are dealing with [common challenge].

At ${company_name}, we help ${target_market|''teams''} solve this by [brief solution description], resulting in [specific outcome].

Would you be open to a brief conversation to see if this might be relevant for [their company]?

Best,
[Your name]
${company_name}"

## Best Practices

1. **Personalize every message** - Reference something specific
2. **Lead with value** - What''s in it for them?
3. **Keep it short** - Respect their time
4. **Clear ask** - One simple next step
5. **Professional tone** - Friendly but not casual'
);

-- 10. Cold Email
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'cold-email',
  'writing',
  '{
    "name": "Cold Email",
    "description": "Generate personalized cold outreach emails for prospecting. Use for initial contact with new prospects.",
    "triggers": ["prospect_added", "campaign_launch", "manual_request"],
    "requires_context": ["company_name", "products", "value_propositions", "target_market", "competitors"],
    "outputs": ["email_subject", "email_body", "follow_up_sequence"]
  }'::jsonb,
  E'# Cold Email Generator

Create effective cold outreach emails for ${company_name|''Your Company''}.

## Context

**Company:** ${company_name}
**Products:** ${products|join('', '')|''Our solutions''}
**Target Market:** ${target_market|''B2B companies''}
**Value Props:** ${value_propositions|join('', '')|''Key benefits''}
**Competitors:** ${competitors|join('', '')|''Industry alternatives''}

## Subject Line Formulas

1. **Question format:** "Quick question about [their priority]"
2. **Personalized:** "[Their company] + [specific observation]"
3. **Peer reference:** "How [similar company] solved [problem]"
4. **Direct value:** "[Specific outcome] for [their role]"

## Email Structure

### Opening (1 sentence)
Hook with relevance:
- "I noticed [specific observation about their company]..."
- "Congratulations on [recent news/achievement]..."
- "[Mutual connection] suggested I reach out..."

### Problem Statement (1-2 sentences)
Articulate their challenge:
"Many ${target_market|''companies''} struggle with [specific problem], which leads to [consequence]."

### Solution Tease (1-2 sentences)
Introduce how you help:
"At ${company_name}, we help [target] achieve [outcome] through ${main_product|''our solution''}."

### Social Proof (1 sentence)
Build credibility:
"[Similar company] saw [specific result] within [timeframe]."

### CTA (1 sentence)
Clear, low-friction ask:
"Would you be open to a 15-minute call to see if this could help [their company]?"

## Template

Subject: [Personalized subject line]

Hi [Name],

I noticed [specific observation about their company/role]. [Optional: Compliment or acknowledgment]

[Their role]s at ${target_market|''companies like yours''} often tell me that [common challenge] is [impact of problem].

${company_name} helps ${target_market|''teams''} [primary benefit]. For example, [similar company] was able to [specific result] within [timeframe].

Worth a quick conversation to see if this could help [their company]?

Best,
[Your name]

P.S. [Optional: Additional hook or resource]

## Follow-Up Sequence

**Email 2 (Day 3):** Brief value-add, reference email 1
**Email 3 (Day 7):** New angle or case study
**Email 4 (Day 14):** Break-up email'
);

-- =============================================================================
-- Category 3: Enrichment Skills (4 skills)
-- =============================================================================

-- 11. Lead Research
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'lead-research',
  'enrichment',
  '{
    "name": "Lead Research",
    "description": "Conduct comprehensive research on leads and prospects. Use when preparing for outreach or qualifying new leads.",
    "triggers": ["lead_created", "pre_call_prep", "manual_request"],
    "requires_context": ["company_name", "industry", "products"],
    "outputs": ["company_profile", "key_contacts", "talking_points", "research_notes"]
  }'::jsonb,
  E'# Lead Research Framework

Comprehensive research guide for ${company_name|''Your Company''} sales team.

## Research Objectives

Gather intelligence to:
1. Validate ICP fit
2. Identify key stakeholders
3. Find pain points and triggers
4. Prepare personalized outreach

## Research Checklist

### Company Information
- [ ] Company size and growth trajectory
- [ ] Industry and market position
- [ ] Recent news and announcements
- [ ] Funding history (if applicable)
- [ ] Technology stack
- [ ] Key products/services

### Stakeholder Mapping
- [ ] Decision maker(s)
- [ ] Key influencers
- [ ] End users/champions
- [ ] Potential blockers

### Pain Point Discovery
- [ ] Current solutions in use
- [ ] Competitor relationships
- [ ] Known challenges (from job postings, reviews, news)
- [ ] Industry-specific pain points for ${industry}

### Trigger Events
- [ ] New leadership
- [ ] Funding announcement
- [ ] Office expansion/new markets
- [ ] Product launches
- [ ] Regulatory changes

## Research Sources

### Primary Sources
- Company website (About, Careers, Blog)
- LinkedIn (Company + Key people)
- Press releases and news

### Secondary Sources
- Industry publications
- G2/Capterra reviews
- Job postings
- SEC filings (if public)
- Social media activity

## Output Template

**Company:** [Name]
**Industry:** [Industry]
**Size:** [Employees] | [Revenue if known]

**Key Stakeholders:**
- [Name] - [Title] - [LinkedIn]
- [Name] - [Title] - [LinkedIn]

**Pain Points Identified:**
1. [Pain point with evidence]
2. [Pain point with evidence]

**Trigger Events:**
- [Event] - [Date] - [Relevance to ${company_name}]

**Talking Points:**
- [Personalized opener based on research]
- [Relevant case study/reference]
- [Connection to ${main_product|''our solution''}]

**Competitors in Use:**
- [Competitor] - [Evidence]

**Notes:**
[Additional observations]'
);

-- 12. Company Analysis
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'company-analysis',
  'enrichment',
  '{
    "name": "Company Analysis",
    "description": "Deep analysis of target companies for enterprise deals. Use when pursuing strategic accounts or preparing proposals.",
    "triggers": ["strategic_account", "enterprise_deal", "manual_request"],
    "requires_context": ["company_name", "industry", "products", "competitors"],
    "outputs": ["company_profile", "opportunity_assessment", "engagement_strategy"]
  }'::jsonb,
  E'# Company Analysis Framework

Strategic account analysis for ${company_name|''Your Company''} enterprise pursuits.

## Analysis Dimensions

### Business Overview
- **Industry Position:** Market leader, challenger, or niche player?
- **Business Model:** How do they make money?
- **Growth Stage:** Startup, growth, mature, or declining?
- **Geographic Presence:** Local, regional, national, or global?

### Financial Health
- **Revenue/Funding:** Size and trajectory
- **Profitability:** Investing or profitable?
- **Recent Investments:** Technology, people, expansion

### Strategic Priorities
- **Stated Initiatives:** From earnings calls, press releases, leadership interviews
- **Technology Direction:** Digital transformation, modernization, innovation
- **Market Expansion:** New products, markets, or segments

### Organizational Structure
- **Decision Making:** Centralized or distributed?
- **Procurement Process:** Formal RFP, committee, or individual?
- **Budget Cycles:** Fiscal year, planning periods

## Opportunity Assessment

### Fit Score
Rate 1-5 for each dimension:
- Industry alignment with ${industry}: [X/5]
- Need for ${main_product|''our solution''}: [X/5]
- Budget availability: [X/5]
- Timeline urgency: [X/5]
- Competitive position: [X/5]

### Opportunity Size
- **Initial Deal:** [Range]
- **Full Potential:** [Range]
- **Timeline:** [Months to close]

### Key Risks
1. [Risk] - [Mitigation strategy]
2. [Risk] - [Mitigation strategy]

## Engagement Strategy

### Entry Point
- **Target Persona:** [Title/Role]
- **Value Proposition:** [Specific to their priorities]
- **Outreach Method:** [Channel and approach]

### Stakeholder Map
| Name | Title | Role in Decision | Influence | Stance |
|------|-------|------------------|-----------|--------|
| [Name] | [Title] | [Buyer/User/Influencer] | [H/M/L] | [Champion/Neutral/Blocker] |

### Competitive Positioning
Against ${competitors|join('', '')|''competitors''}:
- Our advantage: [Differentiator]
- Their advantage: [Competitor strength]
- Neutralization strategy: [Approach]

### Account Plan
1. **Phase 1:** [Initial engagement - Timeline]
2. **Phase 2:** [Expansion - Timeline]
3. **Phase 3:** [Close - Timeline]'
);

-- 13. Meeting Prep
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'meeting-prep',
  'enrichment',
  '{
    "name": "Meeting Prep",
    "description": "Prepare comprehensive briefings for upcoming meetings. Use before sales calls, demos, or customer meetings.",
    "triggers": ["meeting_scheduled", "pre_call_reminder", "manual_request"],
    "requires_context": ["company_name", "products", "value_propositions", "competitors"],
    "outputs": ["briefing_doc", "talking_points", "questions_to_ask", "competitive_intel"]
  }'::jsonb,
  E'# Meeting Prep Guide

Prepare for customer meetings representing ${company_name|''Your Company''}.

## Pre-Meeting Checklist

### Research Complete
- [ ] Reviewed account in CRM
- [ ] Checked recent interactions
- [ ] Researched attendees on LinkedIn
- [ ] Reviewed company news (last 90 days)
- [ ] Identified relevant case studies

### Meeting Logistics
- [ ] Calendar invite confirmed
- [ ] Video/call link tested
- [ ] Screen share ready
- [ ] Demo environment prepared
- [ ] Materials/presentation loaded

### Preparation Documents
- [ ] Meeting agenda (shared in advance)
- [ ] Relevant case studies
- [ ] Pricing/proposal if applicable
- [ ] Technical documentation

## Briefing Template

### Meeting Context
- **Date/Time:** [Date] at [Time]
- **Duration:** [Minutes]
- **Type:** [Discovery/Demo/Proposal/etc.]
- **Location:** [Video/Phone/In-person]

### Attendees
| Name | Title | Role | Notes |
|------|-------|------|-------|
| [Name] | [Title] | [Their role] | [Key info] |

### Account Summary
- **Company:** [Name]
- **Industry:** [Industry]
- **Size:** [Employees/Revenue]
- **Current Stage:** [Pipeline stage]
- **Deal Value:** [Amount]

### Meeting Objectives
1. [Primary objective]
2. [Secondary objective]
3. [Information to gather]

### Key Talking Points
Based on their needs and ${company_name} capabilities:
1. [Point tied to ${value_propositions[0]|''our value''}]
2. [Point tied to their specific pain point]
3. [Competitive differentiation if relevant]

### Questions to Ask
- [Discovery question about their challenge]
- [Qualification question about timeline/budget]
- [Next steps question]

### Competitive Intel
If ${competitors|join('' or '')|''competitors''} come up:
- Key differentiator: [Point]
- Common objection: [Response]
- Reference customer: [Similar company that chose us]

### Potential Objections
- [Anticipated objection]: [Response]
- [Anticipated objection]: [Response]

### Desired Outcomes
- [ ] [Specific next step to propose]
- [ ] [Information to confirm]
- [ ] [Commitment to secure]'
);

-- 14. Competitor Intel
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'competitor-intel',
  'enrichment',
  '{
    "name": "Competitor Intelligence",
    "description": "Analyze competitor positioning and develop counter-strategies. Use for competitive deals or market analysis.",
    "triggers": ["competitor_mentioned", "competitive_deal", "manual_request"],
    "requires_context": ["company_name", "products", "competitors", "value_propositions"],
    "outputs": ["competitor_profile", "battlecard", "win_themes", "objection_handlers"]
  }'::jsonb,
  E'# Competitor Intelligence

Competitive analysis and battlecards for ${company_name|''Your Company''}.

## Known Competitors
${competitors|join(''\\n- '')|''- Competitor A\\n- Competitor B\\n- Competitor C''}

## Competitive Analysis Framework

### For Each Competitor

#### Overview
- **Company:** [Competitor Name]
- **Positioning:** [Their market position]
- **Target Market:** [Who they sell to]
- **Pricing Model:** [How they charge]

#### Strengths (Where they win)
1. [Strength 1]
2. [Strength 2]
3. [Strength 3]

#### Weaknesses (Where we win)
1. [Weakness 1 - Link to ${company_name} strength]
2. [Weakness 2 - Link to ${company_name} strength]
3. [Weakness 3 - Link to ${company_name} strength]

#### Common Objections from Their Customers
- "[Objection]" - How to respond
- "[Objection]" - How to respond

## Battlecard Template

### Quick Facts
- Founded: [Year]
- Headquarters: [Location]
- Size: [Employees]
- Funding: [Amount if applicable]

### Positioning vs ${company_name}

| Dimension | ${company_name} | Competitor |
|-----------|-----------------|------------|
| [Dimension 1] | ${value_propositions[0]|''Our strength''} | [Their approach] |
| [Dimension 2] | [Our approach] | [Their approach] |
| [Dimension 3] | [Our approach] | [Their approach] |

### Win Themes (Use These)
1. [Theme] - "When prospect mentions [trigger], emphasize [${company_name} advantage]"
2. [Theme] - "When prospect mentions [trigger], emphasize [advantage]"

### Landmines (Set These)
Questions to plant that expose competitor weaknesses:
1. "How important is [area where we excel] to your evaluation?"
2. "What''s your experience been with [area where they struggle]?"

### Trap Handling (Avoid These)
If they try to corner us on [their strength]:
- Acknowledge, don''t deny
- Redirect to [our strength]
- Ask "How critical is [their strength area] vs [our strength area]?"

### Reference Customers
Companies that chose ${company_name} over this competitor:
- [Company] - [Why they chose us]
- [Company] - [Why they chose us]

### Resources
- [Link to case study]
- [Link to comparison sheet]
- [Link to ROI calculator]'
);

-- =============================================================================
-- Category 4: Workflow Skills (3 skills)
-- =============================================================================

-- 15. New Lead Workflow
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'new-lead-workflow',
  'workflows',
  '{
    "name": "New Lead Workflow",
    "description": "Automated workflow for processing new leads. Defines the sequence of actions from lead creation to first contact.",
    "triggers": ["lead_created"],
    "requires_context": ["company_name", "products"],
    "outputs": ["workflow_steps", "automation_rules", "notifications"],
    "executes_skills": ["lead-qualification", "lead-research", "cold-email"]
  }'::jsonb,
  E'# New Lead Workflow

Automated workflow for new leads entering ${company_name|''Your Company''}''s pipeline.

## Workflow Overview

```
Lead Created
    ↓
Step 1: Data Validation
    ↓
Step 2: Enrichment
    ↓
Step 3: Qualification
    ↓
Step 4: Assignment
    ↓
Step 5: Initial Outreach
```

## Step 1: Data Validation (Immediate)

**Trigger:** Lead created in CRM

**Actions:**
1. Validate email format
2. Check for duplicates
3. Normalize company name
4. Verify required fields present

**If Invalid:**
- Flag for manual review
- Notify data quality team

## Step 2: Enrichment (Within 5 minutes)

**Execute Skill:** `lead-research`

**Actions:**
1. Enrich company data
2. Append contact information
3. Identify company technographics
4. Pull social profiles

**Data to Capture:**
- Company size and industry
- Technology stack
- Key stakeholders
- Recent news/funding

## Step 3: Qualification (Within 15 minutes)

**Execute Skill:** `lead-qualification`

**Scoring Criteria:**
- ICP fit score
- Engagement level
- Budget indicators
- Timeline signals

**Routing Logic:**
| Score | Action |
|-------|--------|
| 70+ | Hot lead → Immediate assignment |
| 40-69 | Warm lead → Standard assignment |
| <40 | Cold lead → Nurture campaign |

## Step 4: Assignment (Within 30 minutes for hot leads)

**Assignment Rules:**
1. Round-robin within territory
2. Consider existing relationships
3. Balance workload
4. Account for specialization

**Notification:**
- Slack alert to assigned rep
- Email with lead summary
- CRM task created

## Step 5: Initial Outreach (Within 4 hours for hot leads)

**Execute Skill:** `cold-email`

**Actions:**
1. Generate personalized email
2. Queue for sending (respect sending windows)
3. Set follow-up reminder
4. Log activity in CRM

**SLA Targets:**
- Hot leads: Contact within 4 hours
- Warm leads: Contact within 24 hours
- Cold leads: Add to nurture sequence

## Automation Rules

```yaml
rule: new_lead_processing
trigger: lead.created
conditions:
  - email_valid: true
  - not_duplicate: true
actions:
  - enrich_lead
  - score_lead
  - assign_lead
  - notify_owner
  - queue_outreach
```

## Metrics to Track

- Lead response time
- Qualification accuracy
- Conversion rate by source
- Pipeline velocity'
);

-- 16. Deal Won Workflow
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'deal-won-workflow',
  'workflows',
  '{
    "name": "Deal Won Workflow",
    "description": "Post-close workflow for won deals. Handles handoff, notifications, and follow-up actions.",
    "triggers": ["deal_won", "stage_closed_won"],
    "requires_context": ["company_name"],
    "outputs": ["workflow_steps", "notifications", "handoff_checklist"],
    "executes_skills": ["meeting-recap"]
  }'::jsonb,
  E'# Deal Won Workflow

Post-close actions for ${company_name|''Your Company''} closed-won deals.

## Workflow Overview

```
Deal Marked Won
    ↓
Step 1: Celebration & Notification
    ↓
Step 2: Documentation
    ↓
Step 3: Handoff Preparation
    ↓
Step 4: Customer Success Introduction
    ↓
Step 5: Post-Close Follow-up
```

## Step 1: Celebration & Notification (Immediate)

**Actions:**
1. **Internal Notification**
   - Slack #wins channel announcement
   - Email to leadership
   - Update dashboard/leaderboard

2. **Acknowledgment Message Template:**
   "🎉 DEAL WON: [Company Name]
   Value: $[Amount] | [Contract Type]
   AE: [Name]
   Key Factors: [Win reasons]"

## Step 2: Documentation (Within 24 hours)

**Required Documentation:**
- [ ] Win/loss notes completed
- [ ] Key stakeholders documented
- [ ] Technical requirements captured
- [ ] Contract terms confirmed
- [ ] Timeline agreed upon

**Win Analysis:**
1. Why did they choose ${company_name}?
2. Who was the competition?
3. What were the key decision factors?
4. What can we replicate?

## Step 3: Handoff Preparation (Within 48 hours)

**Handoff Document:**
| Section | Content |
|---------|---------|
| Company Overview | [Summary] |
| Key Contacts | [Names, roles, preferences] |
| Use Case | [Primary objectives] |
| Technical Details | [Requirements, integrations] |
| Success Metrics | [KPIs they want to achieve] |
| Risks/Concerns | [Anything to watch] |

**Internal Meeting:**
- Sales + CS kickoff call
- Review handoff document
- Align on success criteria
- Set implementation timeline

## Step 4: Customer Success Introduction (Within 72 hours)

**Introduction Email Template:**
"Hi [Customer],

I wanted to personally introduce you to [CS Name], who will be your dedicated Customer Success Manager at ${company_name}.

[CS Name] has helped many ${target_market|''companies''} like yours achieve [relevant outcomes]. They''ll be reaching out shortly to schedule your kickoff call.

It''s been a pleasure working with you on this, and I''m confident you''re going to see great results.

Best,
[AE Name]"

**CS Kickoff Meeting:**
- Review success criteria
- Set implementation timeline
- Establish communication cadence
- Identify quick wins

## Step 5: Post-Close Follow-up (Ongoing)

**30-Day Check-in:**
- AE reaches out to confirm satisfaction
- Gather initial feedback
- Identify expansion opportunities
- Request referral if appropriate

**Referral Request (60-90 days):**
"Hi [Customer],

Now that you''ve had some time with ${main_product|''our solution''}, I''d love to hear how things are going.

If you''re seeing value, would you be open to [specific referral ask]?"

## Metrics to Track

- Time to first value
- Handoff completeness score
- Customer satisfaction at 30 days
- Expansion pipeline generated'
);

-- 17. Stale Deal Workflow
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'stale-deal-workflow',
  'workflows',
  '{
    "name": "Stale Deal Workflow",
    "description": "Re-engagement workflow for stale or at-risk deals. Defines actions to revive dormant opportunities.",
    "triggers": ["deal_stale", "no_activity_14_days", "at_risk_flag"],
    "requires_context": ["company_name", "products", "value_propositions"],
    "outputs": ["workflow_steps", "reengagement_sequence", "escalation_rules"],
    "executes_skills": ["follow-up-email", "deal-scoring"]
  }'::jsonb,
  E'# Stale Deal Workflow

Re-engagement workflow for dormant ${company_name|''Your Company''} opportunities.

## Stale Deal Definition

A deal is considered "stale" when:
- No customer contact in 14+ days
- No activity logged in CRM for 14+ days
- Close date has passed without update
- Deal age exceeds stage average by 50%+

## Workflow Overview

```
Stale Deal Detected
    ↓
Step 1: Assessment
    ↓
Step 2: Internal Review
    ↓
Step 3: Re-engagement Attempt
    ↓
Step 4: Escalation (if needed)
    ↓
Step 5: Resolution
```

## Step 1: Assessment (Automatic)

**Execute Skill:** `deal-scoring`

**Check:**
1. Last meaningful contact
2. Engagement trajectory
3. Champion status
4. Competitive activity
5. Organizational changes

**Initial Categorization:**
| Category | Criteria | Action |
|----------|----------|--------|
| Temporarily Stalled | Clear reason, expected to resume | Wait + nurture |
| Needs Attention | No clear reason, was active | Re-engage immediately |
| At Risk | Multiple red flags | Escalate to manager |
| Dead | No response to multiple attempts | Close or archive |

## Step 2: Internal Review (Within 24 hours of detection)

**Manager Review:**
- Review deal history
- Assess realistic probability
- Determine appropriate action
- Assign next steps

**Questions to Answer:**
1. What caused the stall?
2. Is this still a viable opportunity?
3. What would move it forward?
4. Who else should be involved?

## Step 3: Re-engagement Attempt

**Execute Skill:** `follow-up-email`

### Attempt 1: Value-Add (Day 1)
Subject: "[Resource] for [Their Challenge]"
- Share relevant case study or content
- Don''t ask for anything
- Reference previous conversation

### Attempt 2: Status Check (Day 4)
Subject: "Quick check-in on [Project Name]"
- Acknowledge time has passed
- Ask about any changes
- Offer flexibility on approach

### Attempt 3: Alternative Angle (Day 8)
Subject: "Different approach for [Their Company]"
- Introduce new idea or angle
- Mention relevant news or trend
- Suggest modified approach

### Attempt 4: Break-Up (Day 14)
Subject: "Should I close your file?"
- Direct but not pushy
- Make it easy to respond
- Offer to reconnect later

## Step 4: Escalation

**Escalation Triggers:**
- Strategic account with no response
- Large deal value at risk
- Competitive threat detected
- Customer org change

**Escalation Actions:**
1. Manager involvement
2. Executive outreach
3. Customer success engagement
4. Partner/referral leverage

## Step 5: Resolution

**Outcomes:**
| Status | Action | Follow-up |
|--------|--------|-----------|
| Revived | Update stage, continue pursuit | Resume normal cadence |
| Delayed | Set future date, nurture | Add to nurture sequence |
| Lost | Mark lost, document reason | Win/loss analysis |
| No Response | Archive | Add to re-engagement list (90 days) |

## Metrics to Track

- Stale deal revival rate
- Time to resolution
- Win rate of revived deals
- Lost deal reasons'
);

-- =============================================================================
-- Update migration complete message
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Successfully seeded 17 platform skills across 4 categories:';
  RAISE NOTICE '  - Sales AI: 5 skills (lead-qualification, icp-matching, objection-handling, deal-scoring, brand-voice)';
  RAISE NOTICE '  - Writing: 5 skills (follow-up-email, proposal-intro, meeting-recap, linkedin-outreach, cold-email)';
  RAISE NOTICE '  - Enrichment: 4 skills (lead-research, company-analysis, meeting-prep, competitor-intel)';
  RAISE NOTICE '  - Workflows: 3 skills (new-lead-workflow, deal-won-workflow, stale-deal-workflow)';
END $$;
