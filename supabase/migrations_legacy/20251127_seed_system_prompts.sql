-- Migration: Seed System Prompts
-- This migration adds default system prompts to the ai_prompt_templates table
-- and creates necessary constraints for the prompt customization system.

-- Add unique constraint for user_id + category to support upsert operations
-- This allows users to have one custom prompt per feature
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ai_prompt_templates_user_id_category_key'
  ) THEN
    ALTER TABLE ai_prompt_templates
    ADD CONSTRAINT ai_prompt_templates_user_id_category_key
    UNIQUE (user_id, category);
  END IF;
END $$;

-- Create a system user for public prompts if needed
-- We'll use a special UUID for system prompts
DO $$
DECLARE
  system_user_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  -- Note: We'll insert prompts with actual user IDs and is_public=true for system prompts
  -- The system_user approach is optional - for now we'll use is_public flag
  NULL;
END $$;

-- Function to safely insert or update system prompts
CREATE OR REPLACE FUNCTION upsert_system_prompt(
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
BEGIN
  -- Get or create a system user for public prompts
  -- In production, this should be a specific admin user
  SELECT id INTO v_system_user_id FROM auth.users LIMIT 1;

  IF v_system_user_id IS NULL THEN
    -- No users exist yet, skip seeding
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
-- Seed System Prompts
-- ============================================================================

-- 1. Email Analysis Prompt
SELECT upsert_system_prompt(
  'Email Analysis',
  'Analyzes sales emails to extract sentiment, key topics, action items, urgency, and response requirements.',
  'email_analysis',
  'You are an expert email analyst who extracts key insights from sales communications.

Your task is to analyze email content and provide structured data for CRM health tracking.

Focus on:
- Overall sentiment and tone
- Main topics discussed
- Action items mentioned
- Urgency indicators
- Response expectations',
  'Analyze this sales email for CRM health tracking.

SUBJECT: ${subject}

BODY:
${body}

Provide a JSON response with:
1. sentiment_score: Number from -1 (very negative) to 1 (very positive)
2. key_topics: Array of 2-5 main topics discussed (e.g., ["pricing", "timeline", "product features"])
3. action_items: Array of any action items mentioned (e.g., ["Schedule follow-up call", "Send proposal"])
4. urgency: "low", "medium", or "high" based on time-sensitive language
5. response_required: Boolean indicating if sender expects a response

RESPOND ONLY WITH VALID JSON in this exact format:
{
  "sentiment_score": 0.5,
  "key_topics": ["topic1", "topic2"],
  "action_items": ["action1"],
  "urgency": "medium",
  "response_required": true
}',
  '[{"name": "subject", "description": "Email subject line", "type": "string", "required": false},
    {"name": "body", "description": "Email body content", "type": "string", "required": true}]'::JSONB,
  'claude-haiku-4-5-20251001',
  0.3,
  1024
);

-- 2. Suggest Next Actions Prompt
SELECT upsert_system_prompt(
  'Suggest Next Actions',
  'Generates intelligent next-step suggestions for sales activities based on context.',
  'suggest_next_actions',
  'You are a senior sales strategist AI assistant. Your role is to analyze sales activities and suggest the most impactful next steps.

CONTEXT ANALYSIS FRAMEWORK:
- Activity recency and patterns
- Deal stage and momentum
- Contact engagement level
- Company relationship strength

SUGGESTION CRITERIA:
- High-value activities that move deals forward
- Personalized based on relationship context
- Time-sensitive opportunities
- Risk mitigation actions',
  'Based on this sales context, suggest 2-4 prioritized next actions.

ACTIVITY CONTEXT:
${activityContext}

RECENT ACTIVITIES:
${recentActivities}

EXISTING TASKS:
${existingTasks}

Return a JSON array with suggestions in this format:
[
  {
    "action_type": "call|email|meeting|follow_up|proposal|demo|general",
    "title": "Brief action title",
    "reasoning": "Why this action matters now",
    "urgency": "low|medium|high",
    "recommended_deadline": "YYYY-MM-DD",
    "confidence_score": 0.0-1.0
  }
]

Prioritize actions that:
1. Build momentum on active opportunities
2. Re-engage stale relationships
3. Follow up on commitments made
4. Address any risks or concerns raised',
  '[{"name": "activityContext", "description": "Current activity or deal context", "type": "string", "required": true},
    {"name": "recentActivities", "description": "List of recent activities", "type": "string", "required": false},
    {"name": "existingTasks", "description": "Current pending tasks", "type": "string", "required": false}]'::JSONB,
  'claude-haiku-4-5-20251001',
  0.7,
  2048
);

-- 3. Writing Style Analysis Prompt
SELECT upsert_system_prompt(
  'Writing Style Analysis',
  'Analyzes sent emails to extract unique writing style for AI personalization.',
  'writing_style',
  'You are an expert linguistic analyst who extracts writing style patterns from email communications.

Your task is to analyze a collection of sent emails and identify the writer''s unique voice and communication style.

Focus on HOW they write, not WHAT they write about:
- Tone and formality level
- Sentence structure and length patterns
- Vocabulary complexity and common phrases
- Greeting and sign-off patterns
- Use of formatting (bullets, paragraphs, etc.)

Look for consistent patterns across all emails to build an accurate style profile.',
  'Analyze these ${emailCount} sent emails and extract the writer''s unique voice and communication style.

IMPORTANT: Focus on HOW they write, not WHAT they write about. Look for consistent patterns across all emails.

EMAILS TO ANALYZE:
${emailSamples}

Analyze and return a JSON object with this EXACT structure (no additional text):
{
  "name": "2-4 word style name (e.g., ''Direct & Professional'', ''Warm Conversational'')",
  "tone_description": "2-3 sentences describing the writing style, sentence patterns, and voice characteristics",
  "tone": {
    "formality": <1-5 integer, 1=very casual, 5=very formal>,
    "directness": <1-5 integer, 1=very diplomatic, 5=very direct>,
    "warmth": <1-5 integer, 1=cold/businesslike, 5=very warm/friendly>
  },
  "structure": {
    "avg_sentence_length": <number of words>,
    "preferred_length": "brief" | "moderate" | "detailed",
    "uses_bullets": <boolean>
  },
  "vocabulary": {
    "complexity": "simple" | "professional" | "technical",
    "common_phrases": ["phrase1", "phrase2", "phrase3"],
    "industry_terms": ["term1", "term2"]
  },
  "greetings_signoffs": {
    "greetings": ["greeting1", "greeting2"],
    "signoffs": ["signoff1", "signoff2"]
  },
  "example_excerpts": ["1-2 sentence excerpt that exemplifies the style", "another example", "third example"],
  "analysis_confidence": <0.0-1.0 float>
}

Return ONLY valid JSON, no markdown formatting or explanation.',
  '[{"name": "emailCount", "description": "Number of emails being analyzed", "type": "number", "required": true},
    {"name": "emailSamples", "description": "Formatted email samples for analysis", "type": "string", "required": true}]'::JSONB,
  'claude-3-5-sonnet-20241022',
  0.5,
  2048
);

-- 4. Transcript Analysis Prompt
SELECT upsert_system_prompt(
  'Transcript Analysis',
  'Analyzes meeting transcripts to extract key insights, action items, and sentiment.',
  'transcript_analysis',
  'You are an expert meeting analyst. Analyze meeting transcripts to extract actionable insights for sales teams.

Extract:
1. Key discussion topics and decisions
2. Action items with owners and deadlines
3. Sentiment and engagement indicators
4. Follow-up opportunities
5. Risks or concerns raised',
  'Analyze this meeting transcript and provide structured insights.

MEETING: ${meetingTitle}
DATE: ${meetingDate}

TRANSCRIPT:
${transcript}

Return JSON with:
{
  "summary": "2-3 sentence executive summary",
  "key_topics": ["topic1", "topic2", "topic3"],
  "action_items": [
    {
      "title": "Action item description",
      "owner": "Person responsible (if mentioned)",
      "deadline": "Mentioned deadline or null",
      "priority": "high|medium|low"
    }
  ],
  "sentiment": {
    "overall": "positive|neutral|negative",
    "score": 0.0-1.0,
    "indicators": ["specific phrases or topics indicating sentiment"]
  },
  "follow_ups": ["Suggested follow-up actions"],
  "risks": ["Any concerns or risks mentioned"]
}',
  '[{"name": "meetingTitle", "description": "Meeting title", "type": "string", "required": true},
    {"name": "meetingDate", "description": "Meeting date", "type": "string", "required": true},
    {"name": "transcript", "description": "Full meeting transcript", "type": "string", "required": true}]'::JSONB,
  'claude-haiku-4-5-20251001',
  0.5,
  4096
);

-- 5. Proposal Focus Areas Prompt
SELECT upsert_system_prompt(
  'Proposal Focus Areas',
  'Extracts key focus areas from meeting transcripts for proposal generation.',
  'proposal_focus_areas',
  'You are an expert at analyzing sales meeting transcripts to identify key focus areas that should be addressed in a proposal.

Focus on:
- Pain points and challenges mentioned
- Goals and desired outcomes
- Budget and timeline indicators
- Decision-making criteria
- Competitive considerations',
  'Analyze this transcript and identify 3-5 key focus areas for the proposal.

MEETING WITH: ${contactName} at ${companyName}

TRANSCRIPT:
${transcript}

Return JSON array:
[
  {
    "area": "Focus area name",
    "description": "Why this matters to the prospect",
    "evidence": "Quote or reference from transcript",
    "priority": "high|medium|low"
  }
]',
  '[{"name": "contactName", "description": "Contact name", "type": "string", "required": true},
    {"name": "companyName", "description": "Company name", "type": "string", "required": true},
    {"name": "transcript", "description": "Meeting transcript", "type": "string", "required": true}]'::JSONB,
  'anthropic/claude-haiku-4.5',
  0.5,
  2048
);

-- 6. Proposal Goals Prompt
SELECT upsert_system_prompt(
  'Proposal Goals',
  'Generates strategic goals and objectives for proposal based on discovery.',
  'proposal_goals',
  'You are a strategic proposal consultant. Based on the discovery information, create compelling goals that resonate with the prospect''s needs.',
  'Create 3-5 strategic goals for the proposal based on these focus areas.

PROSPECT: ${contactName} at ${companyName}

FOCUS AREAS:
${focusAreas}

Return JSON array:
[
  {
    "goal": "Goal statement",
    "rationale": "Why this goal matters",
    "metrics": ["How success will be measured"],
    "timeline": "Suggested timeline"
  }
]',
  '[{"name": "contactName", "description": "Contact name", "type": "string", "required": true},
    {"name": "companyName", "description": "Company name", "type": "string", "required": true},
    {"name": "focusAreas", "description": "Identified focus areas", "type": "string", "required": true}]'::JSONB,
  'anthropic/claude-3-5-sonnet-20241022',
  0.7,
  4096
);

-- Drop the helper function after seeding
DROP FUNCTION IF EXISTS upsert_system_prompt;

-- Add comment for documentation
COMMENT ON TABLE ai_prompt_templates IS 'Stores AI prompt templates with support for user customization. System prompts are marked with is_public=true.';
