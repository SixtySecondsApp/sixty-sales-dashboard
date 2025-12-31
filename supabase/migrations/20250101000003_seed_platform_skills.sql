-- Migration: Seed Platform Skills
-- Phase 3: Platform Skills Seeding
-- Creates 17 agent-executable skill documents across 4 categories
-- Date: 2025-01-01

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
    "requires_context": ["company_name", "industry", "products", "competitors", "target_market", "icp_summary"]
  }'::jsonb,
  E'# Lead Qualification

Skill for qualifying leads against ${company_name|''Your Company''}''s ideal customer profile.

## Company Context

You are qualifying leads for **${company_name}**, a company in the **${industry}** industry.

**Our Products:** ${products|join('', '')|''Our main product''}

**Target Market:** ${target_market|''B2B companies''}

**ICP Summary:** ${icp_summary|''Companies that need our solution''}

## Qualification Criteria

### Must-Have Signals
- Company operates in ${industry} or adjacent markets
- Has clear need for ${main_product|''our solution''} or similar solutions
- Shows buying intent signals (active evaluation, budget discussions, timeline pressure)
- Decision-maker or influencer engaged in conversations

### Disqualification Signals
- Already deeply embedded with ${primary_competitor|''a direct competitor''}
- Company size below minimum threshold for our solution
- No budget authority identified after multiple conversations
- Geographic or regulatory restrictions that prevent partnership
- Fundamental misalignment with our product capabilities

## Scoring Model

| Factor | Weight | How to Assess |
|--------|--------|---------------|
| Industry Match | 30% | Compare to ${industry} and adjacent verticals |
| Product Fit | 40% | Evaluate against ${products[0]|''our product''} capabilities |
| Company Size | 20% | Check against ideal employee/revenue range |
| Urgency Signals | 10% | Look for timeline pressure, budget cycles, trigger events |

## Scoring Rubric

### Industry Match (30 points max)
- **30 pts**: Direct ${industry} match
- **20 pts**: Adjacent industry with clear need
- **10 pts**: Tangential relationship
- **0 pts**: No industry relevance

### Product Fit (40 points max)
- **40 pts**: Perfect fit for ${main_product|''our solution''}
- **30 pts**: Strong fit with minor gaps
- **20 pts**: Moderate fit, customization needed
- **10 pts**: Partial fit only
- **0 pts**: No meaningful fit

### Company Size (20 points max)
- **20 pts**: Ideal size range
- **15 pts**: Slightly above/below ideal
- **10 pts**: Workable but not optimal
- **0 pts**: Outside viable range

### Urgency Signals (10 points max)
- **10 pts**: Active evaluation with timeline
- **7 pts**: Budget approved, exploring options
- **4 pts**: Interested but no urgency
- **0 pts**: No buying signals

## Score Interpretation & Actions

**Score >= 70: QUALIFIED**
- Mark lead as "Qualified"
- Trigger immediate follow-up sequence
- Notify assigned sales rep via Slack
- Create high-priority CRM task
- Suggested next action: Schedule discovery call within 24-48 hours

**Score 40-69: NURTURE**
- Mark lead as "Nurture"
- Add to educational nurture campaign
- Set reminder for re-evaluation in 30 days
- Suggested next action: Send relevant case study or content

**Score < 40: DISQUALIFIED**
- Mark lead as "Disqualified"
- Log specific reason for disqualification
- Remove from active pipeline
- Suggested next action: Archive with detailed notes for future reference'
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- 2. ICP Matching
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'icp-matching',
  'sales-ai',
  '{
    "name": "ICP Matching",
    "description": "Match prospects against ideal customer profile. Use when prioritizing accounts, segmenting leads, or validating target market fit.",
    "triggers": ["account_created", "enrichment_completed", "batch_scoring"],
    "requires_context": ["company_name", "industry", "target_market", "products", "employee_count", "icp_summary"]
  }'::jsonb,
  E'# ICP Matching

Evaluate how well a prospect matches ${company_name|''Your Company''}''s ideal customer profile.

## Ideal Customer Profile

**Target Industry:** ${industry}
**Target Market:** ${target_market|''Mid-market B2B companies''}
**Our Solution:** ${main_product|''Our product''}
**ICP Summary:** ${icp_summary|''Companies with specific needs we solve''}

## ICP Criteria

### Company Characteristics

1. **Industry Alignment**
   - Primary: ${industry}
   - Adjacent: Related technology, service, and partner sectors
   - Weight: 25%

2. **Company Size**
   - Employee count: ${employee_count|''50-500''} employees range
   - Revenue: Aligned with our pricing tier
   - Weight: 20%

3. **Technology Stack**
   - Uses compatible tools and platforms
   - Has integration requirements we can meet
   - Modern infrastructure indicating technical maturity
   - Weight: 15%

4. **Geographic Fit**
   - Operating in markets we serve
   - Time zone compatibility for support
   - Regulatory environment we can navigate
   - Weight: 10%

### Buying Signals

- Active evaluation of ${main_product|''similar solutions''}
- Budget approved or planning cycle active
- Decision maker identified and engaged
- Timeline defined (ideally within 6 months)
- Pain points articulated that align with our value proposition

### Pain Points We Solve

${pain_points|join(''\\n- '')|''- Inefficient manual processes\\n- Lack of visibility into key metrics\\n- Difficulty scaling operations\\n- Poor customer experience''}

## Scoring Matrix

| Criterion | Weight | Perfect Match (100%) | Partial Match (50%) | No Match (0%) |
|-----------|--------|---------------------|---------------------|---------------|
| Industry | 25% | Direct ${industry} | Adjacent sector | Unrelated |
| Size | 20% | Within ideal range | Close to range | Far outside |
| Pain Points | 25% | Multiple matches | Some alignment | No overlap |
| Technology | 15% | Full compatibility | Partial fit | Incompatible |
| Budget/Timeline | 15% | Ready to buy | Future potential | No budget |

## Account Tier Classification

### Tier A (Score 80-100)
- Perfect ICP match
- High deal potential
- Strategic priority
- Assign to senior AE
- White-glove treatment

### Tier B (Score 60-79)
- Strong ICP match
- Good deal potential
- Standard pursuit
- Assign to available AE
- Full sales process

### Tier C (Score 40-59)
- Moderate ICP match
- Lower deal potential
- Opportunistic pursuit
- Lighter touch approach
- May nurture for future

### Below Tier C (Score < 40)
- Poor ICP match
- Not a current fit
- Do not actively pursue
- May add to long-term nurture

## Output Format

When evaluating a prospect, provide:

1. **Overall ICP Score:** [0-100]
2. **Account Tier:** [A/B/C/Below C]
3. **Matching Factors:**
   - [Factor 1]: [Score] - [Explanation]
   - [Factor 2]: [Score] - [Explanation]
4. **Gaps or Concerns:**
   - [Gap 1]: [Impact on deal]
   - [Gap 2]: [Mitigation strategy]
5. **Recommended Action:** [Specific next step]'
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- 3. Objection Handling
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'objection-handling',
  'sales-ai',
  '{
    "name": "Objection Handling",
    "description": "Provide contextual responses to common sales objections. Use during sales calls, email responses, or proposal discussions.",
    "triggers": ["objection_detected", "sales_call", "email_response"],
    "requires_context": ["company_name", "products", "competitors", "value_propositions", "pricing_model"]
  }'::jsonb,
  E'# Objection Handling

Contextual objection responses for ${company_name|''Your Company''} sales conversations.

## Company Context

**Company:** ${company_name}
**Products:** ${products|join('', '')|''Our solutions''}
**Value Props:** ${value_propositions|join('', '')|''Key benefits''}
**Competitors:** ${competitors|join('', '')|''Industry alternatives''}
**Pricing Model:** ${pricing_model|''Subscription-based pricing''}

## Objection Response Framework

### The LAER Method
1. **Listen** - Let them fully express the concern
2. **Acknowledge** - Show you understand their perspective
3. **Explore** - Ask clarifying questions
4. **Respond** - Address with evidence and value

---

## Common Objections & Responses

### PRICE OBJECTION
**"It''s too expensive" / "We don''t have the budget"**

**Response Framework:**
1. Acknowledge budget is always a consideration
2. Reframe from cost to value/ROI
3. Quantify the cost of NOT solving the problem
4. Offer flexible options if available

**Sample Response:**
"I completely understand - budget is always an important factor. Many of our customers initially felt the same way. What they discovered was that ${main_product|''our solution''} typically delivers [X]% ROI within [timeframe] by [specific benefit].

When you factor in [cost of current pain point], the investment often pays for itself within [period].

Would it be helpful if we looked at the specific value for your situation? We also have [flexible payment options] that might work better for your budget cycle."

**Follow-up Questions:**
- "What would the cost be if you don''t solve [problem] this year?"
- "How are you measuring ROI for investments like this?"
- "What budget range would make this a yes?"

---

### COMPETITOR OBJECTION
**"We''re already using ${primary_competitor|''a competitor''}" / "We''re evaluating ${primary_competitor|''alternatives''}"**

**Response Framework:**
1. Acknowledge they''re doing proper due diligence
2. Ask about their experience/what''s working/not working
3. Highlight key differentiators relevant to their needs
4. Offer comparison resources or proof points

**Sample Response:**
"It''s smart that you''re evaluating options thoroughly - this is an important decision. I''m curious, what''s been your experience with ${primary_competitor|''them''} so far? What''s working well, and where do you see room for improvement?

Where we really differentiate is ${value_propositions[0]|''our unique approach''}. For example, [specific capability they likely care about].

Would it be valuable to see a side-by-side comparison of how we stack up for your specific use case?"

**Key Differentiators to Emphasize:**
${value_propositions|join(''\\n- '')|''- Our unique advantage\\n- Better customer experience\\n- Superior technology''}

---

### TIMING OBJECTION
**"Not the right time" / "We have other priorities" / "Let''s revisit next quarter"**

**Response Framework:**
1. Understand the underlying concern
2. Quantify the cost of delay
3. Offer a lower-commitment next step
4. Set a specific future touchpoint

**Sample Response:**
"I appreciate you being upfront about timing. Can I ask what''s driving that? Is it [resource constraints / competing initiatives / budget cycle]?

The reason I ask is that [quantify impact of waiting]. Each [month/quarter] without [solution benefit], you''re likely [losing/missing] [specific impact].

What if we [lower-commitment option like a pilot, phased approach, or just keeping you updated]? That way, when timing is right, you''ll have all the information you need to move quickly."

---

### AUTHORITY OBJECTION
**"I need to check with my team" / "I''m not the decision maker"**

**Response Framework:**
1. Validate their process
2. Offer to help build the internal case
3. Provide stakeholder-specific materials
4. Ask to meet additional stakeholders

**Sample Response:**
"Absolutely - important decisions like this should involve the right people. I''d love to help you build the case internally.

A few questions: Who else would be involved in this decision? What matters most to them? What questions do you think they''ll have?

I can put together [specific materials] tailored for [their concerns]. Would it make sense for me to join a brief call with your team to answer questions directly?"

---

### SKEPTICISM OBJECTION
**"How do I know this will work?" / "We''ve tried similar things before"**

**Response Framework:**
1. Acknowledge past experiences matter
2. Ask what went wrong before
3. Differentiate your approach
4. Offer proof points and risk mitigation

**Sample Response:**
"That''s a fair concern - past experiences definitely inform future decisions. Can you tell me more about what you tried before and what didn''t work?

[Listen and respond specifically to their concerns]

What makes ${company_name} different is [specific differentiator]. We''ve helped companies like [reference customer] overcome similar challenges and achieve [specific result].

To give you confidence, we offer [guarantee/pilot/proof of concept/references]. Would any of those help you feel more comfortable moving forward?"

---

## Universal Follow-Up Questions

Use these after addressing any objection:

- "What would need to be true for this to make sense for you?"
- "If we could solve [their specific concern], would this be worth exploring further?"
- "On a scale of 1-10, where are you now on moving forward? What would get you to a 10?"
- "Who else should be part of this conversation?"
- "What''s the downside of doing nothing?"

## Red Flags to Recognize

- Repeated rescheduling without explanation
- Unwilling to introduce other stakeholders
- Can''t articulate the problem they''re solving
- No timeline or urgency
- Asking for extensive free work before committing'
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- 4. Deal Scoring
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'deal-scoring',
  'sales-ai',
  '{
    "name": "Deal Scoring",
    "description": "Score deals based on likelihood to close and deal quality. Use for pipeline reviews, forecasting, and prioritization.",
    "triggers": ["deal_updated", "weekly_review", "forecast_request"],
    "requires_context": ["company_name", "products", "competitors"]
  }'::jsonb,
  E'# Deal Scoring

Evaluate deal health and win probability for ${company_name|''Your Company''} pipeline.

## Scoring Dimensions

### 1. QUALIFICATION STRENGTH (25%)

Score each item (Yes = 5 pts, Partial = 3 pts, No = 0 pts):

- [ ] **Budget confirmed** - Specific amount or range discussed
- [ ] **Authority identified** - Decision maker engaged in process
- [ ] **Need articulated** - Clear pain point tied to our solution
- [ ] **Timeline defined** - Specific target date or trigger event
- [ ] **ICP match validated** - Fits ideal customer profile

**Section Score:** ___ / 25 pts

### 2. ENGAGEMENT LEVEL (25%)

Score each item (Yes = 5 pts, Partial = 3 pts, No = 0 pts):

- [ ] **Multi-threaded** - 3+ stakeholders engaged
- [ ] **Responsive** - Replies within 48 hours typically
- [ ] **Recent activity** - Meeting/call in last 14 days
- [ ] **Asking questions** - Proactively seeking information
- [ ] **Sharing info** - Providing internal context, requirements

**Section Score:** ___ / 25 pts

### 3. COMPETITIVE POSITION (20%)

Score each item (Yes = 4 pts, Partial = 2 pts, No = 0 pts):

- [ ] **Preferred option** - We are their top choice
- [ ] **Differentiators land** - Key value props resonate
- [ ] **No major threats** - Competitors not deeply embedded
- [ ] **Past relationship** - Previous positive interactions
- [ ] **References available** - Customers in their industry

**Section Score:** ___ / 20 pts

### 4. PROCESS PROGRESS (20%)

Score each completed stage (4 pts each):

- [ ] **Discovery completed** - Needs fully understood
- [ ] **Solution presented** - Demo or proposal reviewed
- [ ] **Proposal delivered** - Formal offer made
- [ ] **Negotiation started** - Terms being discussed
- [ ] **Verbal commitment** - Agreed pending paperwork

**Section Score:** ___ / 20 pts

### 5. TIMING & URGENCY (10%)

Score each item (Yes = 2.5 pts, Partial = 1 pt, No = 0 pts):

- [ ] **Compelling event** - Clear deadline or trigger
- [ ] **Budget cycle aligns** - Funds available now
- [ ] **No blockers** - No dependencies preventing close
- [ ] **Champion pushing** - Internal advocate is active

**Section Score:** ___ / 10 pts

---

## TOTAL DEAL SCORE: ___ / 100

---

## Risk Factors to Flag

### HIGH RISK (Immediate attention required)
- No contact in 14+ days
- Key stakeholder left company
- Budget cut or frozen
- Competitor deeply embedded in evaluation
- Legal/procurement blocking with no resolution path

### MEDIUM RISK (Monitor closely)
- Decision timeline slipping
- New stakeholders introduced late
- Scope creep in requirements
- Pricing pushback without negotiation progress
- Champion going silent

### LOW RISK (Normal sales motion)
- Minor scheduling delays
- Standard procurement process
- Reasonable negotiation requests

---

## Score Interpretation

| Score Range | Win Probability | Forecast Category | Action |
|-------------|-----------------|-------------------|--------|
| **80-100** | 70%+ | Commit | Active close plan, executive alignment |
| **60-79** | 40-69% | Best Case | Drive urgency, address gaps |
| **40-59** | 20-39% | Pipeline | Qualify harder, consider deprioritizing |
| **< 40** | < 20% | At Risk | Reassess viability, consider closing out |

---

## Deal Health Indicators

### GREEN (Healthy)
- Score 70+
- Trending up over time
- Multiple engaged stakeholders
- Clear next steps defined
- Competitive position strong

### YELLOW (Needs Attention)
- Score 50-69
- Stagnant or slowly declining
- Single point of contact
- Vague next steps
- Competitive pressure

### RED (At Risk)
- Score < 50
- Declining trend
- Going dark / unresponsive
- No clear path forward
- Strong competitive threat

---

## Weekly Review Questions

1. What changed in this deal since last week?
2. What''s the single biggest risk?
3. What would move the score up by 10 points?
4. Is this deal worth the investment of time?
5. What help do you need to close this?'
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- 5. Brand Voice
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'brand-voice',
  'sales-ai',
  '{
    "name": "Brand Voice",
    "description": "Guidelines for maintaining consistent brand voice in all communications. Use when writing emails, proposals, or any customer-facing content.",
    "triggers": ["content_generation", "email_writing", "proposal_creation"],
    "requires_context": ["company_name", "tagline", "value_propositions", "industry", "brand_tone", "words_to_avoid", "key_phrases"]
  }'::jsonb,
  E'# Brand Voice Guide

Communication guidelines for ${company_name|''Your Company''}.

## Brand Identity

**Company:** ${company_name}
**Tagline:** ${tagline|''Your tagline here''}
**Industry:** ${industry}

## Voice Characteristics

### Tone Profile: ${brand_tone|''Professional yet approachable''}

Our voice is:

1. **Expert but accessible**
   - We know our stuff, but we don''t talk down to people
   - Complex ideas explained simply
   - Confidence without arrogance

2. **Helpful and consultative**
   - We''re partners, not vendors
   - Focus on solving problems, not just selling
   - Genuine interest in customer success

3. **Clear and direct**
   - Get to the point quickly
   - No jargon unless necessary (and always explain it)
   - Actionable and specific

4. **Warm but professional**
   - Human and personable
   - Appropriate for business context
   - Builds trust and rapport

## Vocabulary Guidelines

### Key Phrases to Use
${key_phrases|join(''\\n- '')|''- Transform your workflow\\n- Drive meaningful results\\n- Trusted by leading teams\\n- Purpose-built for [industry]\\n- Data-driven insights''}

### Words to Avoid
${words_to_avoid|join('', '')|''cheap, basic, simple, just, only, honestly, actually, obviously, synergy, leverage (as verb), circle back, touch base''}

### Preferred Alternatives

| Instead of... | Use... |
|---------------|--------|
| Cheap | Affordable, cost-effective |
| Simple | Straightforward, intuitive |
| Obviously | Clearly, as you know |
| Synergy | Collaboration, partnership |
| Leverage | Use, apply, build on |
| ASAP | By [specific date/time] |
| Touching base | Following up, checking in |

## Writing Guidelines

### Email Communication

1. **Subject lines**: Specific, actionable, under 50 characters
2. **Opening**: Lead with value or relevance, not pleasantries
3. **Body**: Short paragraphs (2-3 sentences max)
4. **Bullets**: Use for 3+ items
5. **Closing**: Clear next step with specific ask
6. **Sign-off**: Match formality to relationship stage

**Good Example:**
> Subject: Resources from our ${company_name} demo
>
> Hi Sarah,
>
> Great speaking with you about [specific topic]. Your point about [something they said] really resonated.
>
> As promised, here''s the case study showing how [similar company] achieved [result].
>
> Would Thursday at 2pm work for a follow-up to discuss next steps?
>
> Best,
> [Name]

### Proposal Language

1. Lead with business outcomes, not features
2. Quantify value whenever possible
3. Use the customer''s own language
4. Address potential concerns proactively
5. Make next steps crystal clear

### Social Media

1. More conversational than email
2. Shorter sentences
3. Can use emojis sparingly if brand-appropriate
4. Engage genuinely, don''t just broadcast

## Value Proposition Messaging

When communicating our value, emphasize:

${value_propositions|join(''\\n\\n'')| ''**Efficiency**: Reduce manual work by up to 40%\\n\\n**Visibility**: Real-time insights into what matters\\n\\n**Growth**: Scale operations without scaling headcount''}

## Messaging by Audience

### Executive (C-Suite)
- Focus: Strategic impact, ROI, competitive advantage
- Tone: Confident, concise, outcome-focused
- Avoid: Technical details, feature lists

### Manager (Director/VP)
- Focus: Team efficiency, measurable results, ease of adoption
- Tone: Practical, solution-oriented
- Avoid: Overly salesy language

### End User (Individual Contributor)
- Focus: Day-to-day benefits, ease of use, time savings
- Tone: Friendly, helpful, empathetic
- Avoid: Business jargon, corporate speak

## Common Messaging Scenarios

### Introducing ${company_name}
"${company_name} helps ${target_market|''companies''} [primary benefit]. We''re ${value_propositions[0]|''known for our unique approach''} that [key differentiator]."

### Explaining Our Difference
"Unlike [alternatives], ${company_name} [unique capability]. This means you can [customer benefit] without [common pain point]."

### Handling "What do you do?"
"We help ${target_market|''businesses''} [core problem we solve]. Our ${main_product|''solution''} [key benefit], so teams can [desired outcome]."

## Quality Checklist

Before sending any communication:

- [ ] Would a customer understand this on first read?
- [ ] Is every sentence earning its place?
- [ ] Does it sound like ${company_name}, not generic?
- [ ] Is there a clear next step?
- [ ] Would I want to receive this message?'
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

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
    "requires_context": ["company_name", "products", "value_propositions"]
  }'::jsonb,
  E'# Follow-up Email Generator

Create personalized follow-up emails for ${company_name|''Your Company''}.

## Context

**From:** ${company_name}
**Products:** ${products|join('', '')|''Our solutions''}
**Value Props:** ${value_propositions|join('', '')|''Key benefits''}

## Follow-up Email Framework

### Key Principles
1. Send within 2-4 hours of the meeting
2. Reference specific things discussed
3. Provide promised value (resources, answers)
4. Propose clear next step
5. Keep it scannable

---

## Subject Line Formulas

Choose based on context:

- **Standard:** "[Company] + ${company_name} - Next Steps"
- **Resource-focused:** "Resources from our conversation"
- **Action-oriented:** "Following up: [Specific action item]"
- **Value-forward:** "[Resource/Case Study] for [Their Challenge]"

---

## Email Structure

### 1. Opening (1-2 sentences)
Reference the specific conversation. Show you were listening.

**Templates:**
- "Thanks for taking the time to discuss [specific topic] today."
- "Great connecting about [their challenge/goal]."
- "I enjoyed learning about [something specific about their situation]."

### 2. Value Recap (2-4 bullets)
Summarize what matters to THEM, not what you presented.

**Include:**
- Main challenge they mentioned
- How ${main_product|''our solution''} addresses it
- Specific outcome they''re looking for
- Key insight or ah-ha moment from the call

### 3. Promised Resources
Deliver on anything you committed to:

- Case study from similar company
- Product documentation
- ROI calculator or analysis
- Answers to questions raised
- Recording or meeting notes

### 4. Clear Next Step
Propose a specific action with options:

**Templates:**
- "As discussed, let''s schedule [next meeting type]. Would [Day] at [Time] or [Day] at [Time] work?"
- "The next step would be [action]. I''ll [your action] and [their action] by [date]."
- "Would it make sense to [specific ask]? I can [offer to make it easy]."

### 5. Professional Close
Match formality to relationship:

- New relationship: "Best regards,"
- Established: "Best," or "Thanks,"
- Warm: "Looking forward to it,"

---

## Templates by Meeting Type

### Post-Discovery Call

Subject: Great connecting - ${company_name} + [Their Company]

Hi [Name],

Thanks for the insightful conversation today about [specific challenge they shared]. Your point about [something memorable they said] really resonated.

Based on what you shared, here''s what stood out:
- [Challenge 1] is costing you [impact]
- [Challenge 2] is preventing [goal]
- You''re looking for [desired outcome] by [timeline]

I think ${main_product|''our solution''} can help specifically with [tailored benefit].

As a next step, I''d love to show you exactly how. Would [Day] at [Time] work for a demo focused on [their priority]?

Best,
[Your name]

---

### Post-Demo

Subject: [Their Company] demo follow-up + resources

Hi [Name],

Thanks for engaging so actively in today''s demo. Great questions from you and [other attendee names].

Recap of what we covered:
- [Feature 1] and how it solves [their challenge]
- [Feature 2] that addresses [their requirement]
- [Integration/workflow] that connects with [their system]

As promised, here are the resources:
- [Case study]: How [similar company] achieved [result]
- [Documentation]: Setup guide for [feature they liked]
- [Pricing]: Summary of [package discussed]

Questions from the call I''m following up on:
- [Question 1]: [Answer or "I''ll have this by X"]
- [Question 2]: [Answer or "I''ll have this by X"]

For next steps, I''d recommend [specific recommendation]. Should I set up time with [additional stakeholders] to [next action]?

Best,
[Your name]

---

### Post-Proposal Review

Subject: [Their Company] proposal - next steps

Hi [Name],

Thanks for reviewing the proposal with me today. I''m glad we could address your questions about [topics covered].

To summarize where we landed:
- [Agreement point 1]
- [Agreement point 2]
- [Open item to resolve]

Outstanding items:
- [ ] [Their action]: [Description] - by [date]
- [ ] [Your action]: [Description] - by [date]

Once [condition], we can [next step toward close].

What questions came up after we hung up? Happy to jump on a quick call if helpful.

Best,
[Your name]

---

## Tone Adjustments

### More Formal (Enterprise)
- Use full sentences
- "I look forward to" instead of "Looking forward to"
- Reference company initiatives and strategic goals
- More detailed recaps

### More Casual (SMB/Startup)
- Shorter sentences
- "Excited to" and "Can''t wait to"
- Focus on quick wins and ease
- Bullet-heavy

---

## Common Mistakes to Avoid

- Generic opening ("Hope this email finds you well")
- Too long (aim for < 200 words)
- No specific next step
- Forgetting promised attachments
- Copying everyone on first follow-up
- Being pushy about timeline'
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- 7. Proposal Intro
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'proposal-intro',
  'writing',
  '{
    "name": "Proposal Introduction",
    "description": "Generate compelling proposal introductions tailored to the prospect. Use when creating formal proposals or business cases.",
    "triggers": ["proposal_requested", "rfp_response", "manual_request"],
    "requires_context": ["company_name", "products", "value_propositions", "target_market"]
  }'::jsonb,
  E'# Proposal Introduction Generator

Create compelling proposal introductions for ${company_name|''Your Company''}.

## Context

**From:** ${company_name}
**Products:** ${products|join('', '')|''Our solutions''}
**Value Props:** ${value_propositions|join('', '')|''Key benefits''}
**Target Market:** ${target_market|''B2B companies''}

## Proposal Structure Overview

### Executive Summary Components

1. **Opening Hook** - Their challenge in their words
2. **Solution Overview** - How we address it
3. **Key Benefits** - Quantified where possible
4. **Why ${company_name}** - Differentiation
5. **Path Forward** - Clear next steps

---

## Executive Summary Template

---

### Executive Summary

**The Opportunity**

[Prospect Company] is seeking to [their stated goal - use their exact language if possible]. In today''s [industry context - market trend, challenge, or opportunity], achieving this objective requires [solution category] that can [key capability].

Based on our discussions with [stakeholder names], we understand that [Prospect Company] is specifically focused on:
- [Priority 1 - from discovery]
- [Priority 2 - from discovery]
- [Priority 3 - from discovery]

**Our Solution**

${company_name} provides ${main_product|''a comprehensive solution''} that enables ${target_market|''organizations''} to [primary outcome].

For [Prospect Company], our approach will:

**1. [Benefit Area 1]**
[Specific capability] that [ties to their priority], enabling your team to [outcome].

**2. [Benefit Area 2]**
[Specific capability] that [ties to their priority], resulting in [quantified benefit if available].

**3. [Benefit Area 3]**
[Specific capability] that [ties to their priority], ensuring [risk mitigation or efficiency gain].

**Expected Outcomes**

Based on results with similar ${target_market|''organizations''}, we anticipate:
${value_propositions|join(''\\n- '')|''- 30% increase in efficiency\\n- 50% reduction in manual processes\\n- 25% improvement in accuracy''}

**Why ${company_name}**

${company_name} is uniquely positioned to deliver these results because:

1. **[Differentiator 1]**: Unlike [alternative approach], we [unique capability].
2. **[Differentiator 2]**: Our [technology/approach/expertise] ensures [benefit].
3. **[Differentiator 3]**: With [proof point], we bring [credibility factor].

**Proposed Investment**

The total investment for this engagement is **$[amount]**, which includes:
- [Scope item 1]
- [Scope item 2]
- [Scope item 3]
- [Support/training included]

**Timeline**

We propose a [X]-phase implementation over [duration]:
- **Phase 1** ([duration]): [Scope]
- **Phase 2** ([duration]): [Scope]
- **Go-Live**: [Target date]

**Next Steps**

To proceed, we recommend:
1. [Immediate action - e.g., contract review]
2. [Short-term - e.g., kickoff scheduling]
3. [Timeline to decision]

We look forward to partnering with [Prospect Company] on this initiative.

---

## Opening Paragraph Variations

### Problem-First Opening
"[Prospect Company] faces a critical challenge: [their problem in one sentence]. Every [day/week/month], this results in [quantified impact]. This proposal outlines how ${company_name} will partner with your team to [solve problem and achieve goal]."

### Vision-First Opening
"[Prospect Company]''s vision to [their strategic goal] represents an exciting opportunity to [transformation]. This proposal details how ${company_name}''s ${main_product|''solution''} will accelerate this journey, delivering [key outcomes] within [timeframe]."

### Competitive Urgency Opening
"The [industry] landscape is shifting rapidly. Organizations that [adopt X / solve Y] are [outperforming others by Z]. This proposal presents ${company_name}''s recommended approach to position [Prospect Company] as a leader in this transformation."

### Relationship-Based Opening
"Over the past [time period], we''ve had the privilege of learning about [Prospect Company]''s unique challenges and aspirations. This proposal represents our best thinking on how to [achieve their goals] while [addressing their concerns]."

---

## Section Tips

### Opening Hook
- Use their words from discovery
- Cite specific data points
- Make it about them, not us
- Create urgency without fear

### Solution Section
- Lead with outcomes, not features
- Match their priorities in order
- Use their terminology
- Reference their specific situation

### Benefits Section
- Quantify wherever possible
- Use benchmarks from similar customers
- Address their specific KPIs
- Show timeline to value

### Why Us Section
- 3 differentiators maximum
- Proof points for each
- Relevant to their evaluation criteria
- Humble confidence, not arrogance

---

## Common Mistakes to Avoid

- Starting with company history
- Generic "about us" language
- Feature lists instead of benefits
- Jargon they won''t understand
- Missing their specific needs
- Vague or missing next steps
- Too long (aim for 1-2 pages max)'
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- 8. Meeting Recap
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'meeting-recap',
  'writing',
  '{
    "name": "Meeting Recap",
    "description": "Generate structured meeting recaps with action items and next steps. Use after any customer or internal meeting.",
    "triggers": ["meeting_ended", "transcript_available", "manual_request"],
    "requires_context": ["company_name"]
  }'::jsonb,
  E'# Meeting Recap Generator

Create structured meeting recaps for ${company_name|''Your Company''} meetings.

## Recap Best Practices

1. **Send within 24 hours** (ideally same day)
2. **Be concise** - Bullets over paragraphs
3. **Capture decisions** - Not just discussion
4. **Assign ownership** - Names on action items
5. **Set deadlines** - Specific dates, not "soon"

---

## Recap Structure

### Header Information
```
Meeting: [Meeting Title/Purpose]
Date: [Date] | Time: [Start] - [End] ([Duration])
Attendees: [Names and companies/roles]
```

### Summary (2-3 sentences)
What was the purpose and primary outcome?

### Key Discussion Points (3-5 bullets)
What were the main topics? Not a transcript - just highlights.

### Decisions Made
What was agreed upon? These are commitments.

### Action Items (Table format)
| Action | Owner | Due Date |
|--------|-------|----------|

### Next Steps
What happens now? When do we meet again?

### Open Questions
What remains unresolved?

---

## Full Template

---

Subject: Meeting Recap: [Meeting Title] - [Date]

Hi all,

Thanks for a productive meeting today. Here''s a summary of what we covered.

---

**Meeting: [Title]**
**Date:** [Day, Date] at [Time] ([Duration])
**Attendees:**
- [Name] - [Role/Company]
- [Name] - [Role/Company]
- [Name] - [Role/Company]

---

**Summary**

[2-3 sentence summary of what was discussed and the primary outcome or conclusion reached.]

---

**Key Discussion Points**

1. **[Topic 1]:** [Brief summary of what was discussed and any conclusions]

2. **[Topic 2]:** [Brief summary]

3. **[Topic 3]:** [Brief summary]

---

**Decisions Made**

- [Decision 1 - stated clearly]
- [Decision 2 - stated clearly]

---

**Action Items**

| Action | Owner | Due Date |
|--------|-------|----------|
| [Specific task description] | [Name] | [Day, Date] |
| [Specific task description] | [Name] | [Day, Date] |
| [Specific task description] | [Name] | [Day, Date] |

---

**Next Steps**

- Our next meeting is scheduled for **[Day, Date] at [Time]** to [purpose]
- Before then, [what needs to happen]
- [Any other logistics or follow-ups]

---

**Open Questions**

- [Question that needs to be resolved]
- [Question requiring follow-up]

---

Please reply if I''ve missed anything or if you have questions.

Best,
[Your Name]

---

## Template Variations

### Quick Recap (< 30 min meetings)
Subject: Quick recap: [Topic]

Hi [Name],

Quick summary from our chat:

**Discussed:**
- [Point 1]
- [Point 2]

**Next:**
- [ ] I''ll [action] by [date]
- [ ] You''ll [action] by [date]

Talk soon,
[Name]

---

### Internal Team Meeting
Subject: Team sync - [Date]

Hey team,

Recap from today:

**Updates:**
- [Person]: [Update summary]
- [Person]: [Update summary]

**Decisions:**
- [Decision made]

**Action items:**
- @[Name]: [Task] - Due [Date]
- @[Name]: [Task] - Due [Date]

**Blockers:**
- [Any blockers raised]

Next sync: [Day] at [Time]

---

### Sales Call Recap (Internal)
Subject: Call recap: [Prospect Company] - [Date]

**Account:** [Prospect Company]
**Attendees:** [Names]
**Stage:** [Current pipeline stage]

**Key Insights:**
- [What we learned]
- [Pain points identified]
- [Budget/timeline signals]

**Competition:** [Any mentions]

**Next Steps:**
- [Action with date]

**Risk/Opportunity:**
- [Assessment]

---

## Action Item Best Practices

### Good Action Items
- [x] "Send proposal draft to [Name]" - [Owner] - March 15
- [x] "Schedule technical review with IT team" - [Owner] - March 17
- [x] "Provide security documentation" - [Owner] - March 20

### Bad Action Items
- "Follow up on this"
- "We need to discuss"
- "Someone should look into"
- "Will circle back"

### Action Item Formula
**[Verb] + [Specific deliverable] + [Owner name] + [Due date]**

---

## Tips for Different Meeting Types

**Discovery calls:** Focus on what you learned, less on what you said
**Demos:** Highlight features they engaged with, questions raised
**Proposal reviews:** Document objections and how addressed
**Internal:** Emphasize decisions and blockers
**Kickoffs:** Capture expectations and success criteria'
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- 9. LinkedIn Outreach
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'linkedin-outreach',
  'writing',
  '{
    "name": "LinkedIn Outreach",
    "description": "Generate personalized LinkedIn connection requests and messages. Use for prospecting, networking, and relationship building.",
    "triggers": ["prospect_identified", "event_follow_up", "manual_request"],
    "requires_context": ["company_name", "products", "industry", "value_propositions", "target_market"]
  }'::jsonb,
  E'# LinkedIn Outreach Generator

Create personalized LinkedIn messages for ${company_name|''Your Company''} outreach.

## Context

**Company:** ${company_name}
**Industry:** ${industry}
**Products:** ${products|join('', '')|''Our solutions''}
**Target Market:** ${target_market|''B2B companies''}
**Value Props:** ${value_propositions|join('', '')|''Key benefits''}

---

## Connection Request Templates (300 char limit)

### Template 1: Mutual Interest
"Hi [Name], I noticed we both [shared interest/connection/group]. Always great to connect with fellow ${industry} professionals. Would love to have you in my network. - [Your name] at ${company_name}"

### Template 2: Content Engagement
"Hi [Name] - Really enjoyed your recent post about [topic]. Your perspective on [specific point] was spot on. Would love to connect and follow more of your insights. - [Your name]"

### Template 3: Industry Peer
"Hi [Name], We''re both in the ${industry} space and I''ve been following [their company]''s work on [something specific]. Would love to connect and exchange ideas. - [Your name]"

### Template 4: Referral-Based
"Hi [Name], [Mutual connection] suggested we connect - they mentioned you''re doing great work in [area]. Would love to add you to my network. - [Your name]"

### Template 5: Thoughtful Observation
"Hi [Name], I came across your profile while researching [topic]. Your experience at [company] + [background] is impressive. Would value connecting. - [Your name]"

---

## Post-Connection Follow-up Messages

### Template 1: Value-First (Recommended)
"Thanks for connecting, [Name]!

I noticed you''re leading [area] at [Company] - that''s no small task in today''s market.

At ${company_name}, we help ${target_market|''teams like yours''} with [relevant challenge]. Recently helped [similar company type] achieve [specific result].

Is [challenge area] something your team is focused on? Either way, happy to share a resource on [topic] that might be useful.

Best,
[Your name]"

### Template 2: Curiosity-Led
"Thanks for connecting, [Name].

I''ve been following [their company]''s growth in [area] - impressive trajectory.

Curious: what''s the biggest challenge you''re facing when it comes to [relevant area]? I ask because we work with a lot of [their role/industry] and I''m always learning what''s top of mind.

No pitch - just genuinely curious.

[Your name]"

### Template 3: Content Share
"Thanks for the connection, [Name]!

Given your focus on [area], thought you might find this interesting: [brief description of content/insight].

[Link or key insight]

What''s your take on [related question]?

[Your name]"

---

## InMail Templates (2000 char limit)

### Template 1: Problem-Solution
"Hi [Name],

I came across [their company] while researching ${industry} leaders in [specific area]. [Specific observation about their company or role].

Many [their role]s I speak with are dealing with [common challenge], which often leads to [consequence].

At ${company_name}, we help ${target_market|''teams''} solve this by ${main_product|''our approach''}, typically resulting in [specific outcome].

[Similar company] recently achieved [result] within [timeframe] - happy to share how if relevant.

Would you be open to a brief 15-minute call to explore if this could help [their company]? I''m flexible on timing.

Best,
[Your name]
${company_name}

P.S. [Optional: personal note, shared connection, or content]"

### Template 2: Trigger-Based
"Hi [Name],

Congrats on [recent news/trigger event - funding, new role, expansion, etc.]. Exciting times at [their company]!

This kind of growth often creates new challenges around [relevant area]. We''ve helped several companies navigate similar transitions, including [reference company] who [specific result].

Given what''s ahead for [their company], would it be worth a quick conversation about [specific topic]? No pressure - just thinking there might be relevant insights to share.

[Your name]"

### Template 3: Referral InMail
"Hi [Name],

[Mutual connection] suggested I reach out - they mentioned you''re the right person to talk to about [area] at [their company].

I lead [your role] at ${company_name}, where we help ${target_market|''companies''} with [challenge]. [Mutual connection] thought there might be some synergy given [reason].

Would you be open to a quick call to explore? I promise to keep it focused and valuable for your time.

Best,
[Your name]"

---

## Best Practices

### DO:
- **Personalize every message** - Reference something specific
- **Lead with value** - What''s in it for them?
- **Keep it short** - Respect their time
- **Have one clear ask** - Don''t overwhelm
- **Be professional** - But human and warm
- **Follow up once** - Then move on
- **Track what works** - Iterate on winners

### DON''T:
- Send generic templates without customization
- Pitch immediately upon connection
- Write long paragraphs
- Use multiple CTAs
- Be overly casual or salesy
- Follow up more than 2x without response
- Lie about mutual connections or shared interests

---

## Response Handling

### If they respond positively:
"Great to hear, [Name]! Let me suggest a few times: [options]. Which works best for you?"

### If they''re busy/not now:
"Totally understand - timing is everything. Would it be okay to check back in [timeframe]? Or feel free to reach out when things settle down."

### If they''re not interested:
"Appreciate you letting me know, [Name]. If anything changes or I can ever be a resource, don''t hesitate to reach out. Wishing you all the best with [their initiative]."

### If no response (after 1 week):
"Hi [Name] - just bumping this to the top of your inbox. If [topic] isn''t a priority right now, no worries at all. Either way, glad to be connected!"

---

## Metrics to Track

- Connection acceptance rate (benchmark: 30-40%)
- Response rate to follow-up (benchmark: 15-25%)
- Meetings booked per 100 connections
- Best-performing templates by persona'
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- 10. Cold Email
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'cold-email',
  'writing',
  '{
    "name": "Cold Email",
    "description": "Generate personalized cold outreach emails for prospecting. Use for initial contact with new prospects.",
    "triggers": ["prospect_added", "campaign_launch", "manual_request"],
    "requires_context": ["company_name", "products", "value_propositions", "target_market", "competitors"]
  }'::jsonb,
  E'# Cold Email Generator

Create effective cold outreach emails for ${company_name|''Your Company''}.

## Context

**Company:** ${company_name}
**Products:** ${products|join('', '')|''Our solutions''}
**Target Market:** ${target_market|''B2B companies''}
**Value Props:** ${value_propositions|join('', '')|''Key benefits''}
**Competitors:** ${competitors|join('', '')|''Industry alternatives''}

---

## Cold Email Framework

### The AIDA Structure
1. **Attention** - Hook in subject line + opening
2. **Interest** - Relevant problem or opportunity
3. **Desire** - Solution + social proof
4. **Action** - Clear, low-friction CTA

### Email Anatomy
- **Subject:** 3-7 words, specific, curiosity-inducing
- **Opening:** 1 sentence, personalized hook
- **Body:** 2-3 sentences, problem + solution
- **Proof:** 1 sentence, credibility builder
- **CTA:** 1 sentence, one specific ask
- **Total:** Under 150 words ideally, never over 200

---

## Subject Line Formulas

**Question format:**
- "Quick question about [their priority]"
- "[Specific challenge] at [their company]?"

**Personalized:**
- "[Their company] + [observation]"
- "Saw your [post/talk/article] on [topic]"

**Peer reference:**
- "How [similar company] solved [problem]"
- "[Mutual connection] suggested I reach out"

**Value-forward:**
- "[Specific outcome] for [their role]s"
- "[Number]% [improvement] for ${target_market|''teams''}"

---

## Email Template Library

### Template 1: Observation + Value
Subject: [Observation about their company]

Hi [Name],

I noticed [specific observation about their company - recent news, job posting, content they published]. [One sentence connecting observation to relevance].

${target_market|''Companies''} often struggle with [specific problem], which typically leads to [consequence they care about].

${company_name} helps ${target_market|''teams''} [primary benefit]. [Similar company] was able to [specific result] within [timeframe].

Worth a 15-minute call to see if this could help [their company]?

Best,
[Your name]

---

### Template 2: Problem-Agitate-Solve
Subject: [Their pain point] at [Company]?

Hi [Name],

[Their role]s at ${target_market|''companies like yours''} often tell me that [common challenge] is [impactful problem].

What makes it worse is [agitation - consequence of not solving]. Most [alternative approaches] don''t address [root cause].

${company_name} takes a different approach with ${main_product|''our solution''}: [key differentiator]. This is how [reference customer] achieved [result].

Open to exploring if this could work for [their company]?

[Your name]

---

### Template 3: Trigger-Based
Subject: Congrats on [trigger event]

Hi [Name],

Just saw the news about [trigger - funding, new role, expansion, product launch]. Exciting times at [their company]!

Growth like this usually creates challenges around [relevant problem area]. That''s exactly where we help.

${company_name} works with ${target_market|''companies''} to [core value prop]. Companies in similar situations have seen [specific result].

Would it make sense to chat about how we could support [their company]''s growth?

[Your name]

---

### Template 4: Direct Value Prop
Subject: [Specific outcome] for [their company]

Hi [Name],

What if [their company] could [primary benefit] in [timeframe]?

That''s what ${company_name} delivered for [reference customer], who was dealing with [similar challenge].

We help ${target_market|''teams''} ${value_propositions[0]|''achieve better outcomes''} by [brief how].

Worth a quick call to see if there''s a fit?

[Your name]

---

### Template 5: Question-Led
Subject: Quick question, [Name]

Hi [Name],

How is [their company] currently handling [specific challenge]?

I ask because most ${target_market|''companies''} I talk to are struggling with [problem], and it''s costing them [consequence].

${company_name} has helped [X] companies solve this, including [reference]. Happy to share how - no pitch, just ideas.

Would you be open to a 15-minute chat?

[Your name]

---

## Follow-Up Sequence

### Email 2 (Day 3-4): Bump + New Value
Subject: Re: [Original subject]

Hi [Name],

Wanted to bump this up in case it got buried.

Also, thought you might find this [case study/resource/insight] interesting - it''s about how [similar company] [achieved result].

[Link or brief description]

Worth a conversation?

[Your name]

---

### Email 3 (Day 7): New Angle
Subject: Different approach for [their company]?

Hi [Name],

Trying one more time with a different angle.

[New relevant insight, trigger, or observation about their industry/company]

This is exactly the kind of challenge ${company_name} helps ${target_market|''teams''} solve. Would love to share how.

Is [specific day/time] an option for a quick call?

[Your name]

---

### Email 4 (Day 14): Break-Up
Subject: Should I close your file?

Hi [Name],

I haven''t heard back, so I''m guessing the timing isn''t right.

No worries at all - I''ll close out my notes on [their company].

If things change, feel free to reach out. I''m always happy to chat about [topic].

Best of luck with everything.

[Your name]

---

## Personalization Checklist

Before sending, verify:

- [ ] Name spelled correctly
- [ ] Company name accurate
- [ ] Role/title current
- [ ] Observation is specific and accurate
- [ ] Reference customer is relevant
- [ ] No template artifacts ([brackets], placeholders)
- [ ] Sent from correct email address
- [ ] Links work

---

## What Makes Cold Email Work

### DO:
- Research before writing
- Lead with THEM, not you
- Keep it short and scannable
- One CTA, low friction
- Sound human, not template-y
- Test subject lines
- Track and iterate

### DON''T:
- Attach files in first email
- Ask for 30+ minutes
- Include calendar links in first touch
- Use "I hope this email finds you well"
- Write paragraphs
- Send from no-reply
- Be pushy or fake-urgent'
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

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
    "requires_context": ["company_name", "industry", "products"]
  }'::jsonb,
  E'# Lead Research Framework

Comprehensive research guide for ${company_name|''Your Company''} sales team.

## Research Objectives

Gather intelligence to:
1. Validate ICP fit before investing time
2. Identify key stakeholders and decision process
3. Uncover pain points and trigger events
4. Prepare personalized, relevant outreach

---

## Research Checklist

### Company Information
- [ ] **Company overview** - What do they do, in plain terms?
- [ ] **Industry and market** - Where do they compete?
- [ ] **Size** - Employees, revenue, locations
- [ ] **Growth trajectory** - Growing, stable, declining?
- [ ] **Recent news** - Last 90 days of announcements
- [ ] **Funding history** - Investors, rounds, runway (if applicable)
- [ ] **Technology stack** - What tools do they use?
- [ ] **Key products/services** - What do they sell?

### Stakeholder Mapping
- [ ] **Decision maker(s)** - Who signs off on purchases like ours?
- [ ] **Key influencers** - Who advises the decision maker?
- [ ] **End users/champions** - Who would use our solution daily?
- [ ] **Potential blockers** - Who might resist (IT, procurement, etc.)?
- [ ] **Org structure** - How is the team organized?

### Pain Point Discovery
- [ ] **Current solutions** - What are they using today?
- [ ] **Competitor relationships** - Do they use ${competitors|join('' or '')|''a competitor''}?
- [ ] **Known challenges** - From job postings, reviews, news
- [ ] **Industry-specific pains** - Common ${industry} problems
- [ ] **Efficiency gaps** - Where are they losing time/money?

### Trigger Events
- [ ] **New leadership** - New executive in relevant role?
- [ ] **Funding** - Recent investment round?
- [ ] **Expansion** - New offices, markets, products?
- [ ] **Hiring signals** - Job postings indicating initiative?
- [ ] **Regulatory changes** - New compliance requirements?
- [ ] **Competitive pressure** - Market shifts affecting them?

---

## Research Sources

### Primary Sources (Start here)
1. **Company website** - About, Careers, Blog, Leadership
2. **LinkedIn** - Company page + key people
3. **Press releases** - Official announcements
4. **Investor presentations** - If public company

### Secondary Sources (Dig deeper)
1. **Industry publications** - Trade news and analysis
2. **G2/Capterra reviews** - What their customers say
3. **Job postings** - Signals priorities and gaps
4. **Glassdoor** - Internal culture and challenges
5. **SEC filings** - If public (10-K, 10-Q, 8-K)
6. **Crunchbase** - Funding and company data

### Social Signals
1. **Twitter/X** - Company and executive accounts
2. **LinkedIn activity** - What are they posting/commenting?
3. **Podcast appearances** - Executive interviews
4. **Conference talks** - Speaking engagements

---

## Research Output Template

Complete this for each prospect:

```
## Company Overview

**Company:** [Name]
**Website:** [URL]
**Industry:** [Industry/Vertical]
**Size:** [Employees] employees | [Revenue if known]
**Location:** [HQ] + [Other offices]
**Founded:** [Year]

## Key Stakeholders

| Name | Title | LinkedIn | Notes |
|------|-------|----------|-------|
| [Name] | [Title] | [URL] | [Relevant info] |
| [Name] | [Title] | [URL] | [Relevant info] |
| [Name] | [Title] | [URL] | [Relevant info] |

## Business Context

**What they do:** [Plain English summary]
**How they make money:** [Business model]
**Recent developments:** [Last 90 days]

## Pain Points Identified

1. **[Pain point]**
   - Evidence: [Where you found this]
   - Severity: [High/Medium/Low]
   - Link to ${company_name}: [How we help]

2. **[Pain point]**
   - Evidence: [Where you found this]
   - Severity: [High/Medium/Low]
   - Link to ${company_name}: [How we help]

## Trigger Events

- **[Event]** - [Date] - [Why it matters]
- **[Event]** - [Date] - [Why it matters]

## Competitive Landscape

- **Current solutions:** [What they use today]
- **Competitors mentioned:** [Any ${competitors|join('', '')|''competitor''} references]
- **Our advantage:** [Why we''re better for them]

## Talking Points

1. **Opening hook:** [Personalized observation]
2. **Relevant reference:** [Similar customer success]
3. **Value connection:** [How ${main_product|''our solution''} helps]

## ICP Fit Score: [X/10]

**Recommendation:** [Pursue / Nurture / Pass]

## Next Steps

- [ ] [Specific action with date]
```

---

## Research Time Investment

| Lead Priority | Time Investment | Depth |
|---------------|-----------------|-------|
| Hot/Inbound | 30-45 minutes | Full research |
| Target Account | 20-30 minutes | Comprehensive |
| Campaign Lead | 10-15 minutes | Quick scan |
| List Enrichment | 5 minutes | Basic validation |

---

## Red Flags to Note

- Company in financial distress
- Recent layoffs or downsizing
- Active RFP with competitor
- No apparent budget or authority
- Bad reviews or reputation issues
- Regulatory problems
- Acquisition rumors (could be good or bad)'
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- 12. Company Analysis
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'company-analysis',
  'enrichment',
  '{
    "name": "Company Analysis",
    "description": "Deep analysis of target companies for enterprise deals. Use when pursuing strategic accounts or preparing proposals.",
    "triggers": ["strategic_account", "enterprise_deal", "manual_request"],
    "requires_context": ["company_name", "industry", "products", "competitors", "value_propositions"]
  }'::jsonb,
  E'# Company Analysis Framework

Strategic account analysis for ${company_name|''Your Company''} enterprise pursuits.

## When to Use This Framework

- Enterprise deals ($100K+)
- Strategic or named accounts
- Complex multi-stakeholder sales
- Competitive bake-offs
- Proposal development

---

## Analysis Dimensions

### 1. Business Overview

**Industry Position**
- Market leader, challenger, or niche player?
- Market share and competitive standing
- Growth rate vs. industry average

**Business Model**
- How do they make money?
- Primary revenue streams
- Customer segments served

**Growth Stage**
- Startup: <5 years, seeking product-market fit
- Growth: Scaling rapidly, hiring aggressively
- Mature: Established, optimizing operations
- Declining: Cost-cutting, defensive posture

**Geographic Footprint**
- Headquarters location
- Regional vs. national vs. global
- Key markets and expansion plans

### 2. Financial Health

**Revenue & Funding**
- Annual revenue (or funding stage)
- Growth trajectory
- Path to profitability

**Investment Priorities**
- Where are they spending?
- Technology investments
- Hiring patterns

**Budget Indicators**
- Fiscal year timing
- Budget cycle stages
- Procurement patterns

### 3. Strategic Priorities

**Stated Initiatives**
(From earnings calls, press releases, leadership interviews)
- [ ] Initiative 1: [Description]
- [ ] Initiative 2: [Description]
- [ ] Initiative 3: [Description]

**Technology Direction**
- Digital transformation status
- Modernization efforts
- Innovation appetite

**Market Strategy**
- Expansion plans
- New products/services
- M&A activity

### 4. Organizational Intelligence

**Decision-Making Culture**
- Centralized vs. distributed
- Speed of decisions
- Risk tolerance

**Procurement Process**
- Formal RFP required?
- Committee or individual?
- Typical timeline

**Budget Cycles**
- Fiscal year end
- Planning periods
- Approval thresholds

---

## Opportunity Assessment

### Fit Score Matrix

Rate 1-5 for each (5 = perfect fit):

| Dimension | Score | Notes |
|-----------|-------|-------|
| Industry alignment with ${industry} | [X/5] | [Notes] |
| Need for ${main_product|''our solution''} | [X/5] | [Notes] |
| Budget availability | [X/5] | [Notes] |
| Timeline urgency | [X/5] | [Notes] |
| Competitive position | [X/5] | [Notes] |

**Total Fit Score: [X/25]**

### Opportunity Sizing

| Metric | Value |
|--------|-------|
| Initial deal potential | $[Range] |
| Full account potential | $[Range] |
| Estimated close timeline | [X months] |
| Complexity level | [Low/Medium/High] |

### Key Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk 1] | [H/M/L] | [H/M/L] | [Strategy] |
| [Risk 2] | [H/M/L] | [H/M/L] | [Strategy] |
| [Risk 3] | [H/M/L] | [H/M/L] | [Strategy] |

---

## Engagement Strategy

### Entry Point Analysis

**Recommended Persona:** [Title/Role]
- Why: [Reasoning]
- LinkedIn: [URL]
- Trigger: [What would catch their attention]

**Value Proposition for This Account:**
[Customized message linking their priorities to ${company_name} capabilities]

**Outreach Approach:**
- Channel: [Email/LinkedIn/Phone/Event/Referral]
- Timing: [Best time considering their context]
- Hook: [Specific angle based on research]

### Stakeholder Map

| Name | Title | Role | Influence | Stance | Strategy |
|------|-------|------|-----------|--------|----------|
| [Name] | [Title] | Economic Buyer | High | Unknown | [Approach] |
| [Name] | [Title] | Technical Eval | Medium | Supportive | [Approach] |
| [Name] | [Title] | End User | Low | Champion | [Approach] |
| [Name] | [Title] | Procurement | Medium | Neutral | [Approach] |

**Champion Development:**
- Current champion: [Name or "None identified"]
- Champion-building strategy: [Plan]

### Competitive Positioning

**Known Competitors in Account:**
${competitors|join(''\\n- '')|''- Competitor A\\n- Competitor B''}

**Our Primary Advantage:** [Key differentiator for this account]
**Their Likely Attack:** [Where they''ll challenge us]
**Neutralization:** [How we counter]

**Trap Questions to Set:**
- "How important is [our strength area] to your evaluation?"
- "What''s been your experience with [competitor weakness area]?"

---

## Account Plan

### 30-60-90 Day Plan

**Days 1-30: Establish**
- [ ] Initial outreach to [target persona]
- [ ] Discovery meeting secured
- [ ] Stakeholder map validated
- [ ] Use case confirmed

**Days 31-60: Expand**
- [ ] Demo/proof of value completed
- [ ] Multi-thread to [additional stakeholders]
- [ ] Proposal development started
- [ ] Competitive position solidified

**Days 61-90: Close**
- [ ] Proposal delivered
- [ ] Negotiation completed
- [ ] Legal/procurement resolved
- [ ] Contract signed

### Success Metrics

| Milestone | Target Date | Status |
|-----------|-------------|--------|
| First meeting | [Date] | [Status] |
| Discovery complete | [Date] | [Status] |
| Proposal delivered | [Date] | [Status] |
| Verbal commitment | [Date] | [Status] |
| Closed-won | [Date] | [Status] |

---

## Research Sources Used

- [ ] Company website
- [ ] LinkedIn (Company + individuals)
- [ ] Press releases
- [ ] SEC filings / Investor materials
- [ ] Industry publications
- [ ] G2/Capterra reviews
- [ ] Glassdoor
- [ ] Social media
- [ ] Mutual connections
- [ ] Previous interactions in CRM'
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- 13. Meeting Prep
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'meeting-prep',
  'enrichment',
  '{
    "name": "Meeting Prep",
    "description": "Prepare comprehensive briefings for upcoming meetings. Use before sales calls, demos, or customer meetings.",
    "triggers": ["meeting_scheduled", "pre_call_reminder", "manual_request"],
    "requires_context": ["company_name", "products", "value_propositions", "competitors"]
  }'::jsonb,
  E'# Meeting Prep Guide

Prepare for customer meetings representing ${company_name|''Your Company''}.

## Pre-Meeting Checklist

### T-24 Hours: Research
- [ ] Review account in CRM (history, notes, deal stage)
- [ ] Check recent interactions and emails
- [ ] Research attendees on LinkedIn
- [ ] Scan company news (last 90 days)
- [ ] Identify relevant case studies
- [ ] Review previous meeting notes

### T-4 Hours: Logistics
- [ ] Calendar invite confirmed and accepted by all
- [ ] Meeting link tested (if video)
- [ ] Dial-in info ready (if phone)
- [ ] Demo environment prepared and working
- [ ] Materials and presentation loaded
- [ ] Backup plan if tech fails

### T-1 Hour: Final Prep
- [ ] Meeting agenda reviewed
- [ ] Talking points memorized
- [ ] Questions prepared
- [ ] Objection responses ready
- [ ] Quiet, professional environment secured
- [ ] Water nearby, phone silenced

---

## Meeting Briefing Template

### Meeting Context

| Field | Value |
|-------|-------|
| Date/Time | [Day, Date] at [Time] [Timezone] |
| Duration | [X] minutes |
| Type | [Discovery / Demo / Proposal / Negotiation / QBR] |
| Location | [Video link / Phone / Address] |
| Calendar link | [Link] |

### Attendees

**From [Their Company]:**
| Name | Title | Role | Key Info |
|------|-------|------|----------|
| [Name] | [Title] | [Buyer/User/Eval] | [Notes from research] |
| [Name] | [Title] | [Buyer/User/Eval] | [Notes from research] |

**From ${company_name}:**
| Name | Role in Meeting |
|------|-----------------|
| [Name] | [Lead / Demo / Support] |
| [Name] | [Technical / Executive] |

### Account Summary

**Company:** [Name]
**Industry:** [Industry]
**Size:** [Employees] | [Revenue if known]
**Current Stage:** [Pipeline stage]
**Deal Value:** $[Amount]
**Close Date:** [Target date]

**Account History:**
- [Key interaction 1 - date]
- [Key interaction 2 - date]
- [Key interaction 3 - date]

---

### Meeting Objectives

**Primary Goal:**
[What must we accomplish for this to be a successful meeting?]

**Secondary Goals:**
1. [Goal 2]
2. [Goal 3]

**Information to Gather:**
- [Question about their situation]
- [Qualification point to confirm]
- [Next steps to secure]

---

### Talking Points

Based on their needs and ${company_name} capabilities:

**1. [Their Priority #1]**
- Our capability: ${value_propositions[0]|''Key value prop''}
- Proof point: [Reference customer or data]
- Key message: [One sentence]

**2. [Their Priority #2]**
- Our capability: [Relevant feature/benefit]
- Proof point: [Reference customer or data]
- Key message: [One sentence]

**3. [Differentiation Point]**
- Why ${company_name}: [Key differentiator]
- vs. Alternatives: [Competitive advantage]
- Key message: [One sentence]

---

### Questions to Ask

**Discovery Questions:**
- [Question about their current situation]
- [Question about impact of problem]
- [Question about desired outcome]

**Qualification Questions:**
- "What''s driving the timeline for this decision?"
- "Who else needs to be involved in evaluating this?"
- "How does budget typically work for investments like this?"

**Next Steps Questions:**
- "Based on what we''ve discussed, what would be a logical next step?"
- "What would you need to see to feel confident moving forward?"
- "Who else should we include in our next conversation?"

---

### Competitive Intel

**If ${competitors|join('' or '')|''competitors''} come up:**

| Question/Objection | Response |
|-------------------|----------|
| "We''re also looking at [competitor]" | [Prepared response] |
| "What makes you different from [competitor]?" | [Key differentiators] |
| "[Competitor] is cheaper" | [Value response] |

**Reference customer to mention:**
[Company similar to theirs that chose ${company_name}]

---

### Potential Objections

| Objection | Response |
|-----------|----------|
| "[Anticipated objection 1]" | [Prepared response] |
| "[Anticipated objection 2]" | [Prepared response] |
| "We need to think about it" | [Clarifying question to understand real concern] |

---

### Desired Outcomes

By the end of this meeting, we want:

- [ ] [Specific commitment or next step]
- [ ] [Information confirmed]
- [ ] [Stakeholder engaged]
- [ ] [Agreed timeline established]

**Proposed Next Step:**
[Exactly what you will ask for at the end]

---

## Meeting Types: Specific Prep

### Discovery Call
- Focus: Listen more than talk (70/30 rule)
- Prep: Good questions, not a pitch deck
- Goal: Understand their world, qualify the opportunity

### Demo
- Focus: Their use cases, not all features
- Prep: Tailored demo script, sample data relevant to them
- Goal: Show value for THEIR situation

### Proposal Review
- Focus: Address concerns, don''t just present
- Prep: Know every line of the proposal, anticipate questions
- Goal: Get verbal commitment or clear path to close

### Negotiation
- Focus: Value, not just price
- Prep: Know your walk-away, have trade-offs ready
- Goal: Reach mutually agreeable terms

---

## Post-Meeting Actions

- [ ] Send recap email within 4 hours
- [ ] Update CRM with notes and next steps
- [ ] Complete any promised follow-ups
- [ ] Prepare for next meeting
- [ ] Debrief with team if needed'
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- 14. Competitor Intel
INSERT INTO platform_skills (skill_key, category, frontmatter, content_template)
VALUES (
  'competitor-intel',
  'enrichment',
  '{
    "name": "Competitor Intelligence",
    "description": "Analyze competitor positioning and develop counter-strategies. Use for competitive deals or market analysis.",
    "triggers": ["competitor_mentioned", "competitive_deal", "manual_request"],
    "requires_context": ["company_name", "products", "competitors", "value_propositions"]
  }'::jsonb,
  E'# Competitor Intelligence

Competitive analysis and battlecards for ${company_name|''Your Company''}.

## Known Competitors
${competitors|join(''\\n- '')|''- Competitor A\\n- Competitor B\\n- Competitor C''}

---

## Competitive Analysis Framework

### For Each Competitor, Document:

---

## [COMPETITOR NAME] Battlecard

### Company Overview

| Field | Value |
|-------|-------|
| **Company** | [Name] |
| **Founded** | [Year] |
| **Headquarters** | [Location] |
| **Size** | [Employees] |
| **Funding/Revenue** | [Amount] |
| **Target Market** | [Who they sell to] |
| **Pricing Model** | [How they charge] |

### Their Positioning
[One paragraph: How they describe themselves and their value proposition]

### Their Strengths (Where they win)
1. **[Strength 1]:** [Explanation]
2. **[Strength 2]:** [Explanation]
3. **[Strength 3]:** [Explanation]

### Their Weaknesses (Where we win)
1. **[Weakness 1]:** Links to ${company_name}''s ${value_propositions[0]|''advantage''}
2. **[Weakness 2]:** [How we''re better]
3. **[Weakness 3]:** [How we''re better]

### Common Objections (What their customers complain about)
- "[Complaint 1]" - Source: [G2/Glassdoor/Customer]
- "[Complaint 2]" - Source: [G2/Glassdoor/Customer]
- "[Complaint 3]" - Source: [G2/Glassdoor/Customer]

---

## Head-to-Head Comparison

| Dimension | ${company_name} | [Competitor] |
|-----------|-----------------|--------------|
| [Dimension 1] | [Our approach] | [Their approach] |
| [Dimension 2] | [Our approach] | [Their approach] |
| [Dimension 3] | [Our approach] | [Their approach] |
| [Dimension 4] | [Our approach] | [Their approach] |
| [Dimension 5] | [Our approach] | [Their approach] |
| **Pricing** | [Our model] | [Their model] |
| **Best For** | [Our ideal customer] | [Their ideal customer] |

---

## Win Themes (Memorize These)

### Theme 1: [Title]
**When prospect mentions:** [Trigger phrase or need]
**Emphasize:** [${company_name} advantage]
**Proof point:** [Reference customer or data]

**Talk track:**
"What I hear from customers who evaluated both is that while [Competitor] does [acknowledgment], where ${company_name} really stands out is [advantage]. For example, [reference customer] found that [specific result]."

### Theme 2: [Title]
**When prospect mentions:** [Trigger phrase or need]
**Emphasize:** [${company_name} advantage]
**Proof point:** [Reference customer or data]

### Theme 3: [Title]
**When prospect mentions:** [Trigger phrase or need]
**Emphasize:** [${company_name} advantage]
**Proof point:** [Reference customer or data]

---

## Landmine Questions (Set These Early)

Questions to plant that expose competitor weaknesses:

1. **"How important is [area where we excel] to your evaluation?"**
   - If important, we''re positioned well
   - Forces them to consider our strength

2. **"What''s been your experience with [area where they struggle]?"**
   - If they''ve had issues, we can address
   - If not yet, plants a seed of concern

3. **"What happens when [scenario where we handle better]?"**
   - Highlights use case we win
   - Gets them thinking about our differentiator

4. **"Have you talked to customers who''ve used [competitor] for [specific use case]?"**
   - May surface negative references
   - Encourages due diligence that favors us

---

## Trap Handling (Respond to These)

### If they say: "[Competitor] is cheaper"
**Response:**
"I appreciate you sharing that. Price is certainly a factor. The question I''d encourage you to think about is: what''s the cost of [problem we solve better]? Our customers typically find that [ROI statement]. Would it be helpful to look at the total cost comparison including [hidden costs they may have]?"

### If they say: "[Competitor] has [feature we lack]"
**Response:**
"You''re right, they do offer that. Can I ask - how critical is [that feature] vs. [our strength]? Most customers we work with prioritize [our advantage] because [reason]. That said, here''s how our customers handle [that use case]..."

### If they say: "We''re already using [Competitor]"
**Response:**
"That makes sense - they''re a known player. What''s been your experience so far? What''s working well and where do you see room for improvement? I ask because many of our best customers came from [Competitor] after finding that [common complaint]..."

---

## Reference Customers

Companies that chose ${company_name} over [Competitor]:

| Company | Industry | Why They Chose Us | Quotable Result |
|---------|----------|-------------------|-----------------|
| [Company 1] | [Industry] | [Key factor] | "[Quote or result]" |
| [Company 2] | [Industry] | [Key factor] | "[Quote or result]" |
| [Company 3] | [Industry] | [Key factor] | "[Quote or result]" |

---

## Competitive Do''s and Don''ts

### DO:
- Acknowledge competitor strengths (builds credibility)
- Focus on customer needs, not bashing competitors
- Use questions to expose weaknesses naturally
- Let customers discover issues themselves
- Provide proof points for every claim

### DON''T:
- Trash talk competitors (looks desperate)
- Lie or exaggerate their weaknesses
- Ignore their genuine strengths
- Get defensive when they''re mentioned
- Assume the customer hasn''t done research

---

## Intelligence Sources

Stay updated via:
- G2/Capterra new reviews
- LinkedIn company updates
- Their blog and press releases
- Industry analyst reports
- Customer feedback and win/loss data
- Competitive intelligence tools
- Trade publications
- Job postings (signals strategy)

---

## Quick Reference Card

**${company_name} vs ${competitors[0]|''Main Competitor''}:**

| We Win When: | They Win When: |
|--------------|----------------|
| [Scenario 1] | [Scenario 1] |
| [Scenario 2] | [Scenario 2] |
| [Scenario 3] | [Scenario 3] |

**3 Things to Always Mention:**
1. [Key differentiator]
2. [Key differentiator]
3. [Key differentiator]

**3 Questions to Always Ask:**
1. [Landmine question]
2. [Landmine question]
3. [Landmine question]'
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

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
    "executes_skills": ["lead-qualification", "lead-research", "cold-email"]
  }'::jsonb,
  E'# New Lead Workflow

Automated workflow for new leads entering ${company_name|''Your Company''}''s pipeline.

## Workflow Overview

```
Lead Created
    |
    v
Step 1: Data Validation (Immediate)
    |
    v
Step 2: Enrichment (Within 5 min)
    |
    v
Step 3: Qualification Scoring (Within 15 min)
    |
    v
Step 4: Assignment & Routing (Within 30 min)
    |
    v
Step 5: Initial Outreach (Within 4 hrs for hot leads)
```

---

## Step 1: Data Validation
**Timing:** Immediate (automated)
**Owner:** System

### Actions:
1. **Validate email format** - Check for valid structure
2. **Check for duplicates** - Match against existing contacts
3. **Normalize company name** - Standardize formatting
4. **Verify required fields** - Name, email, company at minimum

### Validation Rules:
```
IF email_invalid OR missing_required_fields:
  -> Flag for manual review
  -> Notify data quality team
  -> STOP workflow

IF duplicate_found:
  -> Merge with existing record
  -> Update activity history
  -> Route to existing owner

IF valid:
  -> CONTINUE to Step 2
```

---

## Step 2: Enrichment
**Timing:** Within 5 minutes
**Owner:** System (enrichment tool)

### Execute Skill: `lead-research`

### Data to Capture:
- Company size (employees, revenue)
- Industry classification
- Technology stack
- Company description
- Social profiles
- Recent news/funding
- Key contacts

### Enrichment Sources:
1. Internal database
2. Third-party enrichment APIs
3. LinkedIn data
4. Company website scraping

### Output:
- Enriched lead record
- Confidence score for data
- Missing data flags

---

## Step 3: Qualification Scoring
**Timing:** Within 15 minutes (after enrichment)
**Owner:** System + AI

### Execute Skill: `lead-qualification`

### Scoring Criteria:
| Factor | Weight | Data Source |
|--------|--------|-------------|
| ICP fit | 40% | Enrichment data |
| Engagement | 20% | Form data, behavior |
| Intent signals | 25% | Content consumed |
| Timing | 15% | Form responses |

### Routing Logic:
| Score | Category | SLA | Action |
|-------|----------|-----|--------|
| 70+ | Hot | 4 hours | Immediate assignment, priority outreach |
| 40-69 | Warm | 24 hours | Standard assignment, personalized outreach |
| <40 | Cold | 48 hours | Nurture assignment, sequence enrollment |

---

## Step 4: Assignment & Routing
**Timing:** Within 30 minutes for hot leads
**Owner:** System (with manager override option)

### Assignment Rules:

**Round-Robin Logic:**
1. Filter by territory/segment
2. Check capacity limits
3. Rotate among eligible reps
4. Balance by lead quality

**Special Routing:**
- Named accounts -> Account owner
- Previous relationship -> Same rep
- Enterprise leads -> Senior AE
- Specific product interest -> Product specialist

### Notifications:

**Slack Alert:**
```
New Lead Assigned
Company: [Company Name]
Lead Score: [Score] | Category: [Hot/Warm/Cold]
Contact: [Name] - [Title]
Source: [Lead Source]
[View in CRM] [One-click call]
```

**Email Notification:**
- Lead summary
- Key enrichment data
- Recommended talking points
- CRM task created

---

## Step 5: Initial Outreach
**Timing:** Within 4 hours (hot), 24 hours (warm), 48 hours (cold)
**Owner:** Assigned Sales Rep

### Execute Skill: `cold-email`

### Outreach Sequence:

**Hot Leads (Score 70+):**
1. Personalized email within 4 hours
2. LinkedIn connection request
3. Phone call attempt (same day)
4. Follow-up email if no response (Day 2)

**Warm Leads (Score 40-69):**
1. Personalized email within 24 hours
2. LinkedIn connection request (Day 2)
3. Follow-up email (Day 4)
4. Phone call (Day 7)

**Cold Leads (Score <40):**
1. Nurture sequence enrollment
2. Educational content drip
3. Re-scoring after engagement
4. Re-route to sales if score improves

---

## Automation Rules (Pseudo-code)

```yaml
workflow: new_lead_processing
version: 1.0

trigger:
  event: lead.created
  source: [form, import, api, manual]

step_1_validation:
  actions:
    - validate_email_format
    - check_duplicates
    - normalize_company
    - verify_required_fields
  on_failure:
    - flag_for_review
    - notify: data_quality_team
    - stop_workflow

step_2_enrichment:
  timing: immediate
  actions:
    - call: enrichment_api
    - update: lead_record
    - calculate: data_confidence
  skill: lead-research

step_3_qualification:
  timing: after_enrichment
  actions:
    - calculate: lead_score
    - determine: lead_category
    - update: qualification_fields
  skill: lead-qualification

step_4_assignment:
  timing: after_qualification
  actions:
    - determine: territory
    - select: rep_round_robin
    - assign: lead_owner
    - create: crm_task
    - notify: slack_channel
    - send: assignment_email

step_5_outreach:
  timing:
    hot: 4_hours
    warm: 24_hours
    cold: 48_hours
  actions:
    - generate: personalized_email
    - queue: email_send
    - schedule: follow_up
    - log: activity
  skill: cold-email
```

---

## SLA Targets & Metrics

### Response Time SLAs:
| Lead Type | Contact Attempt | First Email |
|-----------|-----------------|-------------|
| Hot (70+) | Within 4 hours | Within 2 hours |
| Warm (40-69) | Within 24 hours | Within 24 hours |
| Cold (<40) | Within 48 hours | Within 48 hours |

### Metrics to Track:
- **Lead response time** - Time from creation to first contact
- **Enrichment success rate** - % of leads fully enriched
- **Qualification accuracy** - Predicted vs. actual outcomes
- **Conversion rate by source** - Which sources produce best leads
- **Pipeline velocity** - Time through each stage

---

## Exception Handling

### Common Exceptions:
| Exception | Action |
|-----------|--------|
| Enrichment fails | Flag for manual research |
| No available rep | Escalate to manager |
| Duplicate detected late | Merge records, notify owner |
| Bounce on first email | Update email, try LinkedIn |
| Invalid company | Route to SDR for verification |

---

## Integration Points

### Systems Connected:
- CRM (lead record)
- Enrichment tool (data)
- Email platform (outreach)
- Slack (notifications)
- Calendar (scheduling)
- LinkedIn (social selling)

### Webhook Events:
- `lead.created`
- `lead.updated`
- `lead.qualified`
- `lead.assigned`
- `email.sent`
- `email.opened`
- `email.replied`'
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

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
    "executes_skills": ["meeting-recap", "follow-up-email"]
  }'::jsonb,
  E'# Deal Won Workflow

Post-close actions for ${company_name|''Your Company''} closed-won deals.

## Workflow Overview

```
Deal Marked "Closed Won"
    |
    v
Step 1: Celebration & Notification (Immediate)
    |
    v
Step 2: Documentation (Within 24 hrs)
    |
    v
Step 3: Handoff Preparation (Within 48 hrs)
    |
    v
Step 4: Customer Success Introduction (Within 72 hrs)
    |
    v
Step 5: Post-Close Follow-up (30/60/90 days)
```

---

## Step 1: Celebration & Notification
**Timing:** Immediate (automated)
**Owner:** System + Sales Manager

### Internal Notifications:

**Slack #wins Channel:**
```
:trophy: DEAL CLOSED!

Company: [Company Name]
Value: $[Amount] | [Contract Type]
Term: [Duration]
AE: [Name]
SE: [Name if applicable]

Key Factors:
- [Win reason 1]
- [Win reason 2]

:fire: [Celebratory message based on deal size]
```

**Email to Leadership:**
- Deal summary
- Customer profile
- Win factors
- Competitive intel
- Expansion potential

**Dashboard Update:**
- Leaderboard refresh
- Quota progress update
- Team goal tracking

### External Acknowledgment:
- Thank you email to champion (from AE)
- Welcome email from CEO/Leadership (for enterprise)

---

## Step 2: Documentation
**Timing:** Within 24 hours
**Owner:** Account Executive

### Required Documentation:

**Win/Loss Notes:**
- [ ] Why did they choose ${company_name}?
- [ ] Who was the competition?
- [ ] What were the key decision factors?
- [ ] What objections did we overcome?
- [ ] What can we replicate in future deals?

**CRM Updates:**
- [ ] Close date confirmed
- [ ] Final contract value
- [ ] Contract terms documented
- [ ] All contacts tagged correctly
- [ ] Renewal date set

**Stakeholder Documentation:**
| Name | Title | Role | Relationship | Notes |
|------|-------|------|--------------|-------|
| [Name] | [Title] | Champion | Strong | [Key info] |
| [Name] | [Title] | Buyer | Positive | [Key info] |
| [Name] | [Title] | User | TBD | [Key info] |

### Win Analysis Template:
```
## Win Analysis: [Company Name]

**Deal Overview:**
- Value: $[Amount]
- Sales Cycle: [Days]
- Competition: [Who we beat]

**Why We Won:**
1. [Primary factor]
2. [Secondary factor]
3. [Third factor]

**Key Moments:**
- [Turning point in the deal]
- [Critical meeting/demo]
- [Champion activation moment]

**Replicable Tactics:**
- [What worked that we should do again]

**Luck Factors:**
- [Things that helped that we can''t control]
```

---

## Step 3: Handoff Preparation
**Timing:** Within 48 hours
**Owner:** Account Executive

### Handoff Document Template:

```
## Customer Handoff: [Company Name]

### Company Overview
- **Industry:** [Industry]
- **Size:** [Employees] | [Revenue]
- **Use Case:** [Primary reason they bought]
- **Contract Value:** $[Amount] | [Term]
- **Start Date:** [Date]

### Key Contacts
| Name | Title | Email | Phone | Notes |
|------|-------|-------|-------|-------|
| [Name] | [Champion] | | | Primary contact |
| [Name] | [Executive Sponsor] | | | Signs off on renewals |
| [Name] | [Day-to-day user] | | | Main user |

### Success Criteria
What does success look like for this customer?
1. [KPI 1] - [Target]
2. [KPI 2] - [Target]
3. [KPI 3] - [Target]

### Implementation Requirements
- **Technical:** [Any technical requirements]
- **Integration:** [Systems to connect]
- **Data:** [Data migration needs]
- **Training:** [Who needs training]

### Risks & Concerns
- [Risk 1] - [Mitigation plan]
- [Risk 2] - [Mitigation plan]

### Promises Made
- [Any commitments from sales process]
- [Special terms or conditions]
- [Timeline commitments]

### Expansion Opportunities
- [Upsell opportunity 1]
- [Upsell opportunity 2]
- [Timeline for expansion conversation]
```

### Internal Handoff Meeting:
- Sales + Customer Success kickoff call
- Review handoff document together
- Align on success criteria and timeline
- Discuss any concerns or special situations
- Agree on communication plan

---

## Step 4: Customer Success Introduction
**Timing:** Within 72 hours
**Owner:** Account Executive + Customer Success Manager

### Introduction Email Template:

Subject: Welcome to ${company_name} - Introducing Your Success Team

Hi [Customer Name],

I wanted to personally introduce you to [CS Manager Name], who will be your dedicated Customer Success Manager at ${company_name}.

[CS Name] has helped many ${target_market|''companies''} like [Customer Company] achieve [relevant outcomes]. They have deep expertise in [relevant area] and will be your go-to resource for everything from implementation to ongoing optimization.

[CS Name] will be reaching out shortly to schedule your kickoff call and get things rolling.

It''s been a genuine pleasure working with you on this, and I''m confident you''re going to see great results. I''ll stay connected and check in periodically, but you''re in excellent hands.

Welcome to the ${company_name} family!

Best,
[AE Name]

CC: [CS Manager Name]

---

### CS Kickoff Meeting Agenda:
1. **Introductions** (5 min)
2. **Recap goals and success criteria** (10 min)
3. **Review implementation plan** (15 min)
4. **Establish communication cadence** (5 min)
5. **Identify quick wins** (10 min)
6. **Q&A** (10 min)
7. **Next steps** (5 min)

---

## Step 5: Post-Close Follow-up
**Timing:** 30/60/90 days
**Owner:** Account Executive + Customer Success Manager

### 30-Day Check-in (AE):

**Purpose:** Confirm satisfaction, gather initial feedback

**Email Template:**
Hi [Name],

It''s been about a month since you joined ${company_name}, and I wanted to check in personally.

How are things going? Is the team getting value from ${main_product|''our solution''}? Any early feedback or concerns I should know about?

Also, [CS Name] mentioned [positive observation from CS]. Great to hear!

Let me know if there''s anything I can help with.

Best,
[AE Name]

---

### 60-Day Review (CS + AE):

**Purpose:** Formal business review, identify expansion

**Discussion Points:**
- Progress against success criteria
- User adoption metrics
- Any blockers or challenges
- Expansion opportunities
- Early reference potential

---

### 90-Day Referral Request:

**Purpose:** Request referral if appropriate

**Email Template:**
Hi [Name],

It''s been great seeing [Company]''s progress with ${main_product|''our solution''} over the past few months. [Specific positive result if known].

I have a quick ask: Would you be open to [specific referral request - intro, testimonial, case study]?

Totally understand if the timing isn''t right, but I thought I''d ask given how well things have been going.

Either way, thanks for being a great customer!

Best,
[AE Name]

---

## Metrics to Track

### Handoff Quality:
- Handoff document completeness score
- Time from close to CS kickoff
- AE-CS alignment rating

### Customer Health:
- Time to first value
- 30-day satisfaction score
- 90-day health score
- Expansion pipeline generated

### Long-term:
- Renewal rate
- Expansion rate
- Reference customer conversion
- NPS score

---

## Automation Rules

```yaml
workflow: deal_won_processing
trigger: deal.closed_won

step_1_celebrate:
  timing: immediate
  actions:
    - post: slack_wins_channel
    - send: leadership_email
    - update: leaderboard
    - send: thank_you_email

step_2_document:
  timing: within_24_hours
  actions:
    - create: handoff_document_task
    - require: win_analysis_completion
    - update: crm_record

step_3_handoff:
  timing: within_48_hours
  actions:
    - schedule: ae_cs_meeting
    - share: handoff_document
    - create: implementation_tasks

step_4_introduce:
  timing: within_72_hours
  actions:
    - send: introduction_email
    - schedule: kickoff_call
    - create: onboarding_project

step_5_followup:
  timing: 30_60_90_days
  actions:
    - send: checkin_email_30
    - schedule: business_review_60
    - send: referral_request_90
```'
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

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
    "executes_skills": ["follow-up-email", "deal-scoring"]
  }'::jsonb,
  E'# Stale Deal Workflow

Re-engagement workflow for dormant ${company_name|''Your Company''} opportunities.

## Stale Deal Definition

A deal is flagged as "stale" when ANY of these conditions are met:

| Condition | Threshold |
|-----------|-----------|
| No customer contact | 14+ days |
| No activity logged in CRM | 14+ days |
| Close date passed | Without update |
| Deal age vs. stage average | Exceeds by 50%+ |
| No email opens/replies | Last 3 emails |

---

## Workflow Overview

```
Stale Deal Detected
    |
    v
Step 1: Automated Assessment (Immediate)
    |
    v
Step 2: Internal Review (Within 24 hrs)
    |
    v
Step 3: Re-engagement Sequence (Days 1-14)
    |
    v
Step 4: Escalation (If needed)
    |
    v
Step 5: Resolution (Close or Continue)
```

---

## Step 1: Automated Assessment
**Timing:** Immediate upon detection
**Owner:** System

### Execute Skill: `deal-scoring`

### Assessment Checklist:
- [ ] Days since last meaningful contact
- [ ] Email engagement (opens, clicks, replies)
- [ ] Champion status (still at company? Engaged?)
- [ ] Competitive activity detected
- [ ] Organizational changes (layoffs, reorgs, new leadership)
- [ ] Original timeline vs. current date

### Initial Categorization:

| Category | Criteria | Urgency | Default Action |
|----------|----------|---------|----------------|
| **Temporarily Stalled** | Clear reason exists, expected to resume | Low | Monitor + nurture |
| **Needs Attention** | No clear reason, was actively engaged | Medium | Re-engage immediately |
| **At Risk** | Multiple red flags, going dark | High | Escalate to manager |
| **Likely Dead** | No response to multiple attempts | Critical | Prepare to close |

---

## Step 2: Internal Review
**Timing:** Within 24 hours of detection
**Owner:** Sales Manager + Account Executive

### Manager Review Questions:

1. **Root Cause Analysis:**
   - What caused this deal to stall?
   - Did we miss signals earlier?
   - Is this a pattern for this rep?

2. **Viability Assessment:**
   - Is this still a real opportunity?
   - Has the original pain/need changed?
   - Are we still talking to the right people?

3. **Action Planning:**
   - What would realistically move this forward?
   - Who else should be involved?
   - What resources do we need?

4. **Decision:**
   - Revive with new strategy
   - Continue monitoring
   - Close out as lost

### Review Meeting Template:

```
## Stale Deal Review: [Company Name]

**Deal Overview:**
- Stage: [Current stage]
- Value: $[Amount]
- Age: [Days in pipeline]
- Last Contact: [Date]
- Original Close Date: [Date]

**What Happened:**
[AE explains the situation]

**Current Assessment:**
- Champion Status: [Active/Silent/Gone]
- Competition: [Known/Unknown]
- Budget: [Confirmed/Unclear]
- Timeline: [Exists/Slipped/Unknown]

**Proposed Action:**
[Specific plan to revive or decision to close]

**Support Needed:**
[Any help from leadership, SE, etc.]
```

---

## Step 3: Re-engagement Sequence
**Timing:** Days 1-14
**Owner:** Account Executive

### Execute Skills: `follow-up-email`, `deal-scoring`

---

### Attempt 1: Value-Add Email (Day 1)
**Approach:** Give before asking

**Subject:** [Resource/Case Study] for [Their Challenge]

Hi [Name],

I came across this [case study/article/resource] and thought of [their company].

It shows how [similar company] tackled [relevant challenge] - thought it might be useful given our earlier conversations about [their specific situation].

[Link or attachment]

No need to respond unless it sparks any thoughts.

Hope things are going well.

[Your name]

---

### Attempt 2: Status Check (Day 4)
**Approach:** Direct but understanding

**Subject:** Quick check-in on [Project Name]

Hi [Name],

I realize it''s been a little while since we connected. Wanted to check in and see where things stand with [the project/initiative we discussed].

A few possibilities:
- **Timing changed:** Totally understand - should I follow up at a specific time?
- **Priorities shifted:** Makes sense - has the underlying need changed?
- **Found another solution:** No hard feelings - I''d just appreciate knowing

Would love a quick update when you have a moment.

[Your name]

---

### Attempt 3: New Angle (Day 8)
**Approach:** Fresh perspective

**Subject:** Different approach for [Their Company]?

Hi [Name],

I''ve been thinking about our earlier conversations, and I wonder if we were approaching this the wrong way.

[New insight, observation, or approach relevant to their situation]

This is how [reference customer] ended up solving a similar challenge - different from what we originally discussed, but might be worth exploring.

Would you be open to a quick call to see if this angle makes more sense?

[Your name]

---

### Attempt 4: Break-Up Email (Day 14)
**Approach:** Permission to close

**Subject:** Should I close your file?

Hi [Name],

I haven''t heard back in a while, so I wanted to check - should I assume [project/initiative] is no longer a priority?

If so, no problem at all. I''ll close out my notes and won''t keep bothering you.

If timing has just been off and this is still on your radar, just let me know and I''ll keep things open.

Either way, I appreciate the time we spent together and wish you all the best.

[Your name]

---

## Step 4: Escalation
**Timing:** When standard re-engagement fails
**Owner:** Sales Manager / Sales Leadership

### Escalation Triggers:
- Strategic account with no response after Day 14
- Deal value > $[threshold]
- Competitive threat confirmed
- Champion left company
- Customer org restructuring

### Escalation Actions:

**1. Manager Outreach:**
"Hi [Name], [AE Name] mentioned you''ve been heads-down lately. I wanted to reach out personally to see if there''s anything I can help with regarding [project]. Happy to jump on a quick call if useful."

**2. Executive Outreach:**
Senior leader reaching out for strategic accounts.

**3. Partner Leverage:**
If mutual partner exists, ask for warm re-introduction.

**4. Different Contact:**
Reach out to different stakeholder who was involved.

**5. Customer Success:**
If existing relationship, have CS check in casually.

---

## Step 5: Resolution
**Timing:** After Day 14 or sooner if clear signal
**Owner:** Account Executive + Manager

### Outcome Paths:

| Outcome | Action | Follow-up |
|---------|--------|-----------|
| **Revived** | Update deal stage, restart motion | Resume normal cadence |
| **Delayed** | Set specific future date | Add to nurture, calendar reminder |
| **Lost to Competitor** | Mark lost, document details | Win/loss analysis |
| **Lost - No Decision** | Mark lost - no decision | Add to re-engagement (90 days) |
| **Lost - Bad Fit** | Mark lost - not qualified | Remove from future targeting |
| **No Response** | Mark lost - went dark | Add to re-engagement (90 days) |

### Close-Out Documentation:
When closing a stale deal, document:
- Primary reason for loss/stall
- Lessons learned
- Re-engagement eligibility (Yes/No/When)
- Key contacts for future

---

## Automation Rules

```yaml
workflow: stale_deal_processing
trigger:
  - no_activity_14_days
  - close_date_passed
  - deal_age_exceeds_threshold

step_1_assessment:
  timing: immediate
  actions:
    - calculate: deal_score
    - categorize: stale_type
    - create: manager_task
  skill: deal-scoring

step_2_review:
  timing: within_24_hours
  actions:
    - notify: manager
    - schedule: review_meeting
    - document: review_outcome

step_3_reengage:
  timing: days_1_to_14
  actions:
    - day_1: send_value_add_email
    - day_4: send_status_check
    - day_8: send_new_angle
    - day_14: send_breakup_email
  skill: follow-up-email

step_4_escalation:
  trigger: no_response_after_day_14
  conditions:
    - deal_value > threshold
    - strategic_account = true
  actions:
    - notify: leadership
    - schedule: escalation_call
    - execute: escalation_sequence

step_5_resolution:
  timing: after_day_14_or_clear_signal
  actions:
    - update: deal_status
    - create: close_documentation
    - schedule: re_engagement_if_applicable
```

---

## Metrics to Track

### Process Metrics:
- **Stale rate:** % of pipeline going stale
- **Detection time:** How quickly we identify stale deals
- **Review completion:** % of stale deals reviewed by manager

### Outcome Metrics:
- **Revival rate:** % of stale deals brought back to life
- **Time to resolution:** Average days to close or revive
- **Win rate of revived deals:** How often revived deals close

### Learning Metrics:
- **Common stall reasons:** What causes deals to stall
- **Effective re-engagement tactics:** What works to revive
- **Predictive signals:** Early indicators of future stalling'
) ON CONFLICT (skill_key) DO UPDATE SET
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- =============================================================================
-- Completion Message
-- =============================================================================

DO $$
DECLARE
  skill_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO skill_count FROM platform_skills;

  RAISE NOTICE '';
  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'Platform Skills Seeding Complete!';
  RAISE NOTICE '=======================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Total skills in database: %', skill_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Skills by Category:';
  RAISE NOTICE '  - Sales AI (5): lead-qualification, icp-matching,';
  RAISE NOTICE '                  objection-handling, deal-scoring, brand-voice';
  RAISE NOTICE '';
  RAISE NOTICE '  - Writing (5):  follow-up-email, proposal-intro,';
  RAISE NOTICE '                  meeting-recap, linkedin-outreach, cold-email';
  RAISE NOTICE '';
  RAISE NOTICE '  - Enrichment (4): lead-research, company-analysis,';
  RAISE NOTICE '                    meeting-prep, competitor-intel';
  RAISE NOTICE '';
  RAISE NOTICE '  - Workflows (3): new-lead-workflow, deal-won-workflow,';
  RAISE NOTICE '                   stale-deal-workflow';
  RAISE NOTICE '';
  RAISE NOTICE 'All skills include:';
  RAISE NOTICE '  - Frontmatter JSONB with name, description, triggers, requires_context';
  RAISE NOTICE '  - Content template with ${variable} placeholders';
  RAISE NOTICE '  - Realistic, actionable content for sales teams';
  RAISE NOTICE '=======================================================';
END $$;
