-- Migration: Skill Composition Architecture
-- Enables skills to invoke other skills via invoke_skill action
-- Adds slack-blocks helper skill and updates skills to use composition
-- Date: 2026-01-01

-- =============================================================================
-- 1. Add new skill category for helper/output-format skills
-- =============================================================================

-- Update category check constraint if needed (output-format is already in types.ts)

-- =============================================================================
-- 2. Create slack-blocks helper skill
-- =============================================================================
INSERT INTO platform_skills (
  skill_key,
  category,
  frontmatter,
  content_template,
  created_at,
  updated_at
) VALUES (
  'slack-blocks',
  'output-format',
  '{
    "name": "Slack Block Kit Formatter",
    "description": "Format any content into Slack Block Kit JSON. Used by other skills to create rich Slack messages.",
    "triggers": ["skill_invocation"],
    "requires_context": ["message_type"],
    "outputs": {
      "response_type": "slack_blocks",
      "data_schema": "SlackBlocksResponseData"
    },
    "actions": [],
    "response_style": "structured_json",
    "is_helper": true
  }'::jsonb,
  E'# Slack Block Kit Formatter

Format content for Slack using Block Kit components.

## Input Context

- **message_type**: Type of message to format (required)
  - `deal_alert` - Deal status changes, at-risk notifications
  - `lead_alert` - New lead, qualification results
  - `meeting_summary` - Post-meeting recap
  - `task_reminder` - Task due/overdue
  - `win_celebration` - Deal won announcement
  - `pipeline_digest` - Weekly pipeline summary
  - `custom` - Freeform content

## Message Templates

### deal_alert
Input structure:
- deal_name, alert_type (at_risk|stalled|won|lost|stage_change)
- current_stage, details, score, recommended_action, deal_url

### lead_alert
Input structure:
- contact_name, company, score, tier, source
- key_factors[], recommended_action, contact_url

### meeting_summary
Input structure:
- meeting_title, attendees[], duration_minutes
- key_points[], action_items[], next_steps, meeting_url

### pipeline_digest
Input structure:
- period, total_pipeline_value, deals_at_risk
- deals_won, deals_lost, top_priorities[]

## Block Kit Components

### Header
```json
{
  "type": "header",
  "text": { "type": "plain_text", "text": "🚨 Title Here", "emoji": true }
}
```

### Section with Fields
```json
{
  "type": "section",
  "fields": [
    { "type": "mrkdwn", "text": "*Label:*\\nValue" },
    { "type": "mrkdwn", "text": "*Label:*\\nValue" }
  ]
}
```

### Context (metadata)
```json
{
  "type": "context",
  "elements": [{ "type": "mrkdwn", "text": "Secondary info" }]
}
```

### Actions (buttons)
```json
{
  "type": "actions",
  "elements": [
    {
      "type": "button",
      "text": { "type": "plain_text", "text": "View" },
      "url": "https://...",
      "action_id": "view_item"
    }
  ]
}
```

### Divider
```json
{ "type": "divider" }
```

## Emoji Guide
| Type | Emoji |
|------|-------|
| at_risk | 🚨 |
| stalled | ⏸️ |
| won | 🎉 |
| lost | 😔 |
| new_lead | 🆕 |
| qualified | ✅ |
| meeting | 📅 |
| task | ✔️ |
| pipeline | 📊 |

## Output Format

Return ONLY valid JSON:
```json
{
  "blocks": [ /* Block Kit blocks */ ],
  "text": "Fallback text for notifications"
}
```

## Validation Rules
- Max 50 blocks per message
- Max 3000 chars per text field
- Max 10 fields per section
- Max 25 elements per actions block
- Always include fallback text',
  now(),
  now()
) ON CONFLICT (skill_key) DO UPDATE SET
  category = EXCLUDED.category,
  frontmatter = EXCLUDED.frontmatter,
  content_template = EXCLUDED.content_template,
  updated_at = now();

-- =============================================================================
-- 3. Fix brand-voice - add actions (was empty!)
-- =============================================================================
UPDATE platform_skills
SET
  frontmatter = jsonb_set(
    frontmatter,
    '{actions}',
    '["analyze_tone", "suggest_adjustments", "invoke_skill"]'::jsonb
  ),
  content_template = E'# Brand Voice Analyzer

Analyze and enforce brand voice consistency for ${company_name}.

## Instructions

1. Analyze the content provided for tone, style, and voice characteristics
2. Compare against brand guidelines:
   - **Tone**: ${brand_tone|''Professional yet approachable''}
   - **Style**: ${brand_style|''Clear, concise, action-oriented''}
   - **Vocabulary**: ${brand_vocabulary|''Industry-appropriate, jargon-minimal''}

3. Identify deviations from brand guidelines

## Output Format (structured)

```json
{
  "summary": "Analysis of brand voice compliance",
  "data": {
    "overall_score": 85,
    "tone_match": {
      "score": 90,
      "current": "Professional",
      "target": "Professional yet approachable",
      "adjustments": ["Add warmer opening", "Use first-person pronouns"]
    },
    "style_match": {
      "score": 80,
      "issues": ["Sentences too long", "Passive voice detected"],
      "suggestions": ["Break into shorter sentences", "Use active voice"]
    },
    "vocabulary_flags": [
      {"word": "utilize", "suggestion": "use"},
      {"word": "leverage", "suggestion": "use/apply"}
    ],
    "rewritten_sample": "Optional: first paragraph rewritten in brand voice"
  },
  "actions": [
    {"label": "Apply Suggestions", "callback": "invoke_skill", "params": {"skill_key": "email-formatter"}},
    {"label": "View Guidelines", "callback": "open_url", "params": {"url": "/settings/brand"}}
  ]
}
```

## Brand Voice Dimensions

1. **Formality** (1-5): 1=Casual, 5=Formal
2. **Warmth** (1-5): 1=Distant, 5=Personal
3. **Confidence** (1-5): 1=Tentative, 5=Authoritative
4. **Complexity** (1-5): 1=Simple, 5=Technical

Target profile for ${company_name}:
- Formality: ${formality_target|3}
- Warmth: ${warmth_target|4}
- Confidence: ${confidence_target|4}
- Complexity: ${complexity_target|2}',
  updated_at = now()
WHERE skill_key = 'brand-voice';

-- =============================================================================
-- 4. Update slack-deal-alert to use invoke_skill for formatting
-- =============================================================================
UPDATE platform_skills
SET
  frontmatter = jsonb_set(
    frontmatter,
    '{actions}',
    '["get_deal", "invoke_skill", "send_notification"]'::jsonb
  ),
  content_template = E'# Slack Deal Alert

Send formatted deal alerts to Slack using Block Kit.

## Instructions

1. Gather deal context:
   ```
   execute_action(''get_deal'', { id: ''${deal_id}'' })
   ```

2. Format message using slack-blocks helper:
   ```
   execute_action(''invoke_skill'', {
     skill_key: ''slack-blocks'',
     context: {
       message_type: ''deal_alert'',
       deal_name: ''${deal_name}'',
       alert_type: ''${alert_type}'',
       current_stage: ''${stage}'',
       details: ''${alert_details}'',
       score: ${score|0},
       recommended_action: ''${recommended_action}'',
       deal_url: ''https://app.use60.com/deals/${deal_id}''
     }
   })
   ```

3. Send formatted notification:
   ```
   execute_action(''send_notification'', {
     channel: ''slack'',
     blocks: [blocks from slack-blocks skill],
     message: [fallback text from slack-blocks skill]
   })
   ```

## Alert Types

| Type | Trigger | Emoji |
|------|---------|-------|
| at_risk | Score < 50 or no activity 14+ days | 🚨 |
| stalled | No stage movement 21+ days | ⏸️ |
| won | Deal closed won | 🎉 |
| lost | Deal closed lost | 😔 |
| stage_change | Deal moved to new stage | 📈 |

## Output Format

```json
{
  "summary": "Sent ${alert_type} alert for ${deal_name} to Slack",
  "data": {
    "notification_sent": true,
    "channel": "slack",
    "alert_type": "${alert_type}",
    "deal_id": "${deal_id}"
  }
}
```',
  updated_at = now()
WHERE skill_key = 'slack-deal-alert';

-- =============================================================================
-- 5. Update new-lead-workflow to use skill composition
-- =============================================================================
UPDATE platform_skills
SET
  frontmatter = jsonb_set(
    frontmatter,
    '{actions}',
    '["invoke_skill", "update_crm", "send_notification", "create_task"]'::jsonb
  ),
  content_template = E'# New Lead Workflow

Automated workflow for new lead processing using skill composition.

## Workflow Steps

### Step 1: Enrich Lead Data
```
execute_action(''invoke_skill'', {
  skill_key: ''lead-research'',
  context: {
    contact_id: ''${contact_id}'',
    email: ''${email}''
  }
})
```

### Step 2: Analyze Company
```
execute_action(''invoke_skill'', {
  skill_key: ''company-analysis'',
  context: {
    company_name: ''${company_name}'',
    domain: ''${domain}''
  }
})
```

### Step 3: Score Against ICP
```
execute_action(''invoke_skill'', {
  skill_key: ''lead-qualification'',
  context: {
    contact_data: [from step 1],
    company_data: [from step 2],
    icp_summary: ''${icp_summary}''
  }
})
```

### Step 4: Branch by Score

**If score >= 70 (Qualified):**

a. Generate intro email:
```
execute_action(''invoke_skill'', {
  skill_key: ''follow-up-email'',
  context: {
    contact_id: ''${contact_id}'',
    email_type: ''intro_qualified'',
    research_data: [from step 1]
  }
})
```

b. Alert sales team:
```
execute_action(''invoke_skill'', {
  skill_key: ''slack-blocks'',
  context: {
    message_type: ''lead_alert'',
    contact_name: ''${contact_name}'',
    company: ''${company_name}'',
    score: [from step 3],
    tier: ''Qualified'',
    key_factors: [from step 3]
  }
})
```
→ `send_notification` with blocks

c. Create follow-up task:
```
execute_action(''create_task'', {
  title: ''Follow up with ${contact_name}'',
  due_date: ''[2 business days]'',
  contact_id: ''${contact_id}''
})
```

**If score 40-69 (Nurture):**
```
execute_action(''invoke_skill'', {
  skill_key: ''follow-up-sequence'',
  context: {
    contact_id: ''${contact_id}'',
    sequence_type: ''nurture'',
    cadence: ''weekly''
  }
})
```

**If score < 40 (Disqualified):**
```
execute_action(''update_crm'', {
  entity: ''contact'',
  id: ''${contact_id}'',
  updates: {
    status: ''disqualified'',
    disqualification_reason: [from step 3]
  }
})
```

## Output Format

```json
{
  "summary": "Processed new lead: ${contact_name} (${tier})",
  "data": {
    "contact_id": "${contact_id}",
    "score": [calculated],
    "tier": "Qualified|Nurture|Disqualified",
    "actions_taken": [
      "Enriched lead data",
      "Scored against ICP",
      "Sent Slack alert",
      "Created follow-up task"
    ]
  }
}
```',
  updated_at = now()
WHERE skill_key = 'new-lead-workflow';

-- =============================================================================
-- 6. Add create_task action to skills missing it
-- =============================================================================

-- Skills that should have create_task but don't
UPDATE platform_skills
SET frontmatter = jsonb_set(
  frontmatter,
  '{actions}',
  (frontmatter->'actions')::jsonb || '["create_task"]'::jsonb
)
WHERE skill_key IN (
  'deal-scoring',
  'lead-qualification',
  'objection-handling',
  'ghosting-detection',
  'deal-stall-analysis',
  'meeting-prep-briefing',
  'icp-matching',
  'competitor-intel',
  'lead-research',
  'company-analysis'
)
AND NOT (frontmatter->'actions')::jsonb ? 'create_task';

-- =============================================================================
-- 7. Add send_notification (for Slack) to alert-worthy skills
-- =============================================================================

UPDATE platform_skills
SET frontmatter = jsonb_set(
  frontmatter,
  '{actions}',
  (frontmatter->'actions')::jsonb || '["send_notification", "invoke_skill"]'::jsonb
)
WHERE skill_key IN (
  'ghosting-detection',
  'deal-stall-analysis',
  'lead-qualification'
)
AND NOT (frontmatter->'actions')::jsonb ? 'send_notification';

-- =============================================================================
-- 8. Update writing skills to use brand-voice via invoke_skill
-- =============================================================================

-- Add invoke_skill to writing skills so they can call brand-voice
UPDATE platform_skills
SET frontmatter = jsonb_set(
  frontmatter,
  '{actions}',
  (frontmatter->'actions')::jsonb || '["invoke_skill"]'::jsonb
)
WHERE category = 'writing'
AND skill_key != 'brand-voice'
AND NOT (frontmatter->'actions')::jsonb ? 'invoke_skill';

-- =============================================================================
-- 9. Verify updates
-- =============================================================================
DO $$
DECLARE
  slack_blocks_exists BOOLEAN;
  brand_voice_has_actions BOOLEAN;
  skills_with_create_task INTEGER;
  skills_with_invoke INTEGER;
BEGIN
  -- Check slack-blocks exists
  SELECT EXISTS(SELECT 1 FROM platform_skills WHERE skill_key = 'slack-blocks') INTO slack_blocks_exists;

  -- Check brand-voice has actions
  SELECT (frontmatter->'actions')::jsonb != '[]'::jsonb
  FROM platform_skills
  WHERE skill_key = 'brand-voice'
  INTO brand_voice_has_actions;

  -- Count skills with create_task
  SELECT COUNT(*)
  FROM platform_skills
  WHERE (frontmatter->'actions')::jsonb ? 'create_task'
  INTO skills_with_create_task;

  -- Count skills with invoke_skill
  SELECT COUNT(*)
  FROM platform_skills
  WHERE (frontmatter->'actions')::jsonb ? 'invoke_skill'
  INTO skills_with_invoke;

  RAISE NOTICE 'Migration Results:';
  RAISE NOTICE '  - slack-blocks skill created: %', slack_blocks_exists;
  RAISE NOTICE '  - brand-voice has actions: %', brand_voice_has_actions;
  RAISE NOTICE '  - Skills with create_task: %', skills_with_create_task;
  RAISE NOTICE '  - Skills with invoke_skill: %', skills_with_invoke;

  IF NOT slack_blocks_exists THEN
    RAISE EXCEPTION 'Failed to create slack-blocks skill';
  END IF;

  IF NOT brand_voice_has_actions THEN
    RAISE EXCEPTION 'Failed to fix brand-voice actions';
  END IF;
END $$;
