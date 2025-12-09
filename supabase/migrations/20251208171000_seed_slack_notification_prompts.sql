-- ============================================================================
-- Migration: Seed Slack Notification Prompts
-- ============================================================================
-- Purpose: Add default system prompts for Slack notification features:
-- - Meeting Debrief
-- - Daily Digest
-- - Meeting Prep
-- - Task Suggestions
-- ============================================================================

-- First, check if ai_prompt_templates table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_prompt_templates'
  ) THEN
    RAISE NOTICE 'ai_prompt_templates table does not exist. Skipping Slack prompts seeding.';
    RAISE NOTICE 'Run this migration after 20240315_ai_agent_tables.sql';
    RETURN;
  END IF;
END;
$$;

-- Create or replace the helper function for upserting prompts
CREATE OR REPLACE FUNCTION upsert_slack_prompt(
  p_name VARCHAR,
  p_description TEXT,
  p_category VARCHAR,
  p_system_prompt TEXT,
  p_user_prompt TEXT,
  p_variables JSONB,
  p_model VARCHAR,
  p_temperature DECIMAL,
  p_max_tokens INTEGER
) RETURNS VOID AS $$
DECLARE
  v_existing_id UUID;
  v_system_user_id UUID;
  v_table_exists BOOLEAN;
BEGIN
  -- Check if ai_prompt_templates exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_prompt_templates'
  ) INTO v_table_exists;

  IF NOT v_table_exists THEN
    RAISE NOTICE 'ai_prompt_templates table does not exist. Skipping: %', p_category;
    RETURN;
  END IF;

  -- Get a system user for public prompts
  SELECT id INTO v_system_user_id FROM auth.users LIMIT 1;

  IF v_system_user_id IS NULL THEN
    RAISE NOTICE 'No users exist, skipping prompt seeding for: %', p_category;
    RETURN;
  END IF;

  -- Check if prompt already exists
  SELECT id INTO v_existing_id
  FROM ai_prompt_templates
  WHERE category = p_category
    AND is_public = true
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Update existing
    UPDATE ai_prompt_templates
    SET
      name = p_name,
      description = p_description,
      system_prompt = p_system_prompt,
      user_prompt = p_user_prompt,
      variables = p_variables,
      model = p_model,
      temperature = p_temperature,
      max_tokens = p_max_tokens,
      updated_at = NOW()
    WHERE id = v_existing_id;
  ELSE
    -- Insert new
    INSERT INTO ai_prompt_templates (
      user_id, name, description, category,
      system_prompt, user_prompt, variables,
      model, temperature, max_tokens, is_public
    ) VALUES (
      v_system_user_id, p_name, p_description, p_category,
      p_system_prompt, p_user_prompt, p_variables,
      p_model, p_temperature, p_max_tokens, true
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. Slack Meeting Debrief Prompt
-- ============================================================================
SELECT upsert_slack_prompt(
  'Slack Meeting Debrief',
  'Generates meeting summary, sentiment, action items, and coaching insights for Slack notifications.',
  'slack_meeting_debrief',
  'You are a sales meeting analyst creating concise Slack notifications for sales teams.

Your goal is to provide an actionable meeting summary that helps:
1. Sales managers quickly understand meeting outcomes without watching recordings
2. Sales reps get immediate coaching feedback
3. Teams stay aligned on deal progress

Focus on:
- Brevity - This goes to Slack, keep it scannable
- Action-orientation - Emphasize what needs to happen next
- Insight - Surface things humans might miss
- Positivity in coaching - Frame feedback constructively

Return ONLY valid JSON with no additional text.',
  'Analyze this sales meeting and provide a Slack-ready summary:

MEETING: ${meetingTitle}
ATTENDEES: ${attendees}
DURATION: ${duration} minutes
DEAL: ${dealName} (Stage: ${dealStage}, Value: ${dealValue})

TRANSCRIPT:
${transcript}

Return your analysis as JSON with this exact structure:
{
  "summary": "2-3 sentence summary of the meeting - focus on outcomes and next steps",
  "sentiment": "positive" | "neutral" | "challenging",
  "sentimentScore": 0-100,
  "talkTimeRep": 0-100,
  "talkTimeCustomer": 0-100,
  "actionItems": [
    {
      "task": "Specific, actionable task description",
      "suggestedOwner": "Name or role of who should do this",
      "dueInDays": 1-14
    }
  ],
  "coachingInsight": "One specific, constructive tip for the sales rep based on this call",
  "keyQuotes": ["Notable quote from the customer that reveals intent or concerns"]
}

Guidelines:
- Keep summary under 3 sentences
- actionItems should be 2-4 concrete tasks extracted from the meeting
- coachingInsight should be specific and actionable
- sentiment: "positive" = buying signals present, "challenging" = objections/concerns, "neutral" = informational
- Talk time: estimate based on who spoke more. Ideal is 30-40% rep.',
  '[
    {"name": "meetingTitle", "description": "Title of the meeting", "type": "string", "required": true},
    {"name": "attendees", "description": "List of attendees", "type": "string", "required": true},
    {"name": "duration", "description": "Meeting duration in minutes", "type": "number", "required": true},
    {"name": "dealName", "description": "Name of the associated deal", "type": "string", "required": false},
    {"name": "dealStage", "description": "Current deal stage", "type": "string", "required": false},
    {"name": "dealValue", "description": "Deal value", "type": "string", "required": false},
    {"name": "transcript", "description": "Full meeting transcript", "type": "string", "required": true}
  ]'::JSONB,
  'claude-haiku-4-5-20251001',
  0.5,
  2048
);

-- ============================================================================
-- 2. Slack Daily Digest Prompt
-- ============================================================================
SELECT upsert_slack_prompt(
  'Slack Daily Digest Insights',
  'Generates AI insights for the morning standup digest based on team data.',
  'slack_daily_digest',
  'You are a sales operations analyst generating AI insights for a team''s morning Slack digest.

Your goal is to provide 2-3 brief, actionable insights that help the team prioritize their day.

Focus on:
- Deals at risk or needing immediate action
- Patterns or trends the team should know about
- Quick wins that are available today
- Time-sensitive opportunities

Keep each insight to ONE concise sentence. Be specific and actionable.

Return ONLY valid JSON with no additional text.',
  'Generate morning insights for the sales team''s standup digest:

TODAY''S DATE: ${today}
TIMEZONE: ${timezone}

TODAY''S MEETINGS (${meetingsCount} total):
${meetingsList}

OVERDUE TASKS (${overdueCount} total):
${overdueTasks}

TASKS DUE TODAY (${dueTodayCount} total):
${dueTodayTasks}

PIPELINE STATUS:
${pipelineStatus}

DEALS NEEDING ATTENTION:
- Stale deals (no activity 14+ days): ${staleDealsCount}
- At-risk deals (win prob dropped): ${atRiskDealsCount}

${staleDeals}

Return insights as JSON:
{
  "insights": [
    "Brief, specific insight about what the team should focus on",
    "Another actionable insight based on the data"
  ],
  "urgentItems": ["Optional: any items requiring immediate attention"]
}

Guidelines:
- Return 2-3 insights maximum
- Each insight should be one sentence, under 100 characters if possible
- Focus on patterns and priorities, not just restating the data
- Be specific (mention company names, deal values, dates)
- Frame positively when possible',
  '[
    {"name": "today", "description": "Current date", "type": "string", "required": true},
    {"name": "timezone", "description": "Team timezone", "type": "string", "required": true},
    {"name": "meetingsCount", "description": "Number of meetings today", "type": "number", "required": true},
    {"name": "meetingsList", "description": "List of today''s meetings", "type": "string", "required": true},
    {"name": "overdueCount", "description": "Number of overdue tasks", "type": "number", "required": true},
    {"name": "overdueTasks", "description": "List of overdue tasks", "type": "string", "required": true},
    {"name": "dueTodayCount", "description": "Number of tasks due today", "type": "number", "required": true},
    {"name": "dueTodayTasks", "description": "List of tasks due today", "type": "string", "required": true},
    {"name": "pipelineStatus", "description": "Current pipeline status", "type": "string", "required": true},
    {"name": "staleDealsCount", "description": "Number of stale deals", "type": "number", "required": true},
    {"name": "atRiskDealsCount", "description": "Number of at-risk deals", "type": "number", "required": true},
    {"name": "staleDeals", "description": "Details of stale deals", "type": "string", "required": false}
  ]'::JSONB,
  'claude-haiku-4-5-20251001',
  0.5,
  1024
);

-- ============================================================================
-- 3. Slack Meeting Prep Prompt
-- ============================================================================
SELECT upsert_slack_prompt(
  'Slack Meeting Prep Talking Points',
  'Generates suggested talking points for upcoming meetings based on context.',
  'slack_meeting_prep',
  'You are a sales preparation assistant generating talking points for upcoming meetings.

Your goal is to provide 3 specific, actionable talking points that help the rep:
1. Reference relevant context from previous interactions
2. Address known concerns or objections
3. Move the deal forward

Keep talking points:
- Specific to this meeting and company
- Based on the provided context
- Actionable (things to say or ask)
- Concise (one sentence each)

Return ONLY valid JSON with no additional text.',
  'Generate meeting prep talking points:

MEETING: ${meetingTitle}
TIME: ${meetingTime}

COMPANY: ${companyName}
- Industry: ${companyIndustry}
- Size: ${companySize}
- Stage: ${companyStage}

ATTENDEES:
${attendeesList}

DEAL STATUS:
- Value: ${dealValue}
- Stage: ${dealStage}
- Days in pipeline: ${daysInPipeline}
- Win probability: ${winProbability}%

PREVIOUS MEETING NOTES (${lastMeetingDate}):
${lastMeetingNotes}

RECENT ACTIVITIES:
${recentActivities}

Return talking points as JSON:
{
  "talkingPoints": [
    "Specific talking point referencing context",
    "Another talking point addressing a concern",
    "Third talking point to move deal forward"
  ],
  "keyReminder": "Optional: one important thing to remember about this prospect"
}

Guidelines:
- 3 talking points exactly
- Each should be specific to this prospect and deal
- Reference previous conversations when relevant
- Include at least one question to ask
- Focus on what will move the deal forward',
  '[
    {"name": "meetingTitle", "description": "Title of the upcoming meeting", "type": "string", "required": true},
    {"name": "meetingTime", "description": "Meeting time", "type": "string", "required": true},
    {"name": "companyName", "description": "Company name", "type": "string", "required": true},
    {"name": "companyIndustry", "description": "Company industry", "type": "string", "required": false},
    {"name": "companySize", "description": "Company size", "type": "string", "required": false},
    {"name": "companyStage", "description": "Company funding stage", "type": "string", "required": false},
    {"name": "attendeesList", "description": "List of meeting attendees", "type": "string", "required": true},
    {"name": "dealValue", "description": "Deal value", "type": "string", "required": false},
    {"name": "dealStage", "description": "Current deal stage", "type": "string", "required": false},
    {"name": "daysInPipeline", "description": "Days deal has been in pipeline", "type": "number", "required": false},
    {"name": "winProbability", "description": "Current win probability", "type": "number", "required": false},
    {"name": "lastMeetingDate", "description": "Date of last meeting", "type": "string", "required": false},
    {"name": "lastMeetingNotes", "description": "Notes from last meeting", "type": "string", "required": false},
    {"name": "recentActivities", "description": "Recent activities with this prospect", "type": "string", "required": false}
  ]'::JSONB,
  'claude-haiku-4-5-20251001',
  0.5,
  1024
);

-- ============================================================================
-- 4. Slack Task Suggestions Prompt
-- ============================================================================
SELECT upsert_slack_prompt(
  'Slack Task Suggestions',
  'Generates actionable tasks from context for Slack interactive blocks.',
  'slack_task_suggestions',
  'You are a task generation assistant that creates actionable follow-up tasks from sales context.

Your goal is to identify 2-4 specific tasks that will help move deals forward or maintain customer relationships.

Focus on tasks that are:
- Specific and actionable (clear what needs to be done)
- Time-bound (reasonable deadlines)
- Tied to business outcomes
- Not duplicating existing work

Return ONLY valid JSON with no additional text.',
  'Generate follow-up tasks from this context:

CONTEXT TYPE: ${contextType}
COMPANY: ${companyName}
DEAL: ${dealName} (${dealStage}, ${dealValue})
CONTACT: ${contactName}

SOURCE CONTENT:
${sourceContent}

EXISTING TASKS (avoid duplicates):
${existingTasks}

Return tasks as JSON:
{
  "tasks": [
    {
      "title": "Clear, actionable task title",
      "dueInDays": 3,
      "priority": "high" | "medium" | "low",
      "reasoning": "Brief explanation of why this task matters"
    }
  ]
}

Guidelines:
- 2-4 tasks maximum
- Each title should be under 80 characters
- dueInDays: 1-2 for urgent, 3-5 for medium, 7-14 for low priority
- Don''t duplicate tasks that already exist
- Make tasks specific to the context provided',
  '[
    {"name": "contextType", "description": "Type of context (meeting, email, deal_update, etc.)", "type": "string", "required": true},
    {"name": "companyName", "description": "Company name", "type": "string", "required": false},
    {"name": "dealName", "description": "Deal name", "type": "string", "required": false},
    {"name": "dealStage", "description": "Deal stage", "type": "string", "required": false},
    {"name": "dealValue", "description": "Deal value", "type": "string", "required": false},
    {"name": "contactName", "description": "Primary contact name", "type": "string", "required": false},
    {"name": "sourceContent", "description": "Source content to analyze (transcript, email, notes)", "type": "string", "required": true},
    {"name": "existingTasks", "description": "List of existing tasks to avoid duplicates", "type": "string", "required": false}
  ]'::JSONB,
  'claude-haiku-4-5-20251001',
  0.3,
  1024
);

-- Drop the helper function after seeding
DROP FUNCTION IF EXISTS upsert_slack_prompt;

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
  slack_prompt_count INT;
  v_table_exists BOOLEAN;
BEGIN
  -- Check if ai_prompt_templates exists before counting
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_prompt_templates'
  ) INTO v_table_exists;

  IF v_table_exists THEN
    SELECT COUNT(*) INTO slack_prompt_count
    FROM ai_prompt_templates
    WHERE category LIKE 'slack_%';

    RAISE NOTICE 'Slack notification prompts seeded: %', slack_prompt_count;
    RAISE NOTICE 'Slack notification prompts migration completed ✓';
  ELSE
    RAISE NOTICE 'ai_prompt_templates table does not exist - prompts not seeded';
    RAISE NOTICE 'Run 20240315_ai_agent_tables.sql first, then re-run this migration';
  END IF;
END;
$$;
