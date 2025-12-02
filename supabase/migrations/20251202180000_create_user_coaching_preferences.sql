-- User Coaching Preferences
-- Allows users to define their own coaching criteria and evaluation framework

CREATE TABLE IF NOT EXISTS user_coaching_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Coaching Framework
  coaching_framework TEXT NOT NULL DEFAULT 'Evaluate the sales representative''s performance across key areas: discovery, objection handling, value articulation, closing technique, and relationship building.',

  -- Specific evaluation criteria (user-defined)
  evaluation_criteria JSONB DEFAULT '[
    {"area": "Discovery", "weight": 20, "description": "How well did the rep uncover customer needs and pain points?"},
    {"area": "Listening", "weight": 20, "description": "Did the rep actively listen and respond appropriately?"},
    {"area": "Value Articulation", "weight": 20, "description": "How clearly did the rep communicate value and differentiation?"},
    {"area": "Objection Handling", "weight": 20, "description": "How effectively did the rep address concerns and objections?"},
    {"area": "Next Steps", "weight": 20, "description": "Did the rep secure clear next steps and commitment?"}
  ]'::jsonb,

  -- Examples of good and bad techniques (user-provided)
  good_examples TEXT DEFAULT 'GOOD EXAMPLES:
- "Tell me more about your current process..." (open-ended discovery)
- "Based on what you shared, here''s how we can help..." (value alignment)
- "That''s a great concern. Here''s how we address that..." (confident objection handling)
- "Let''s get that demo scheduled for next Tuesday - does 2pm work?" (clear next step)',

  bad_examples TEXT DEFAULT 'BAD EXAMPLES:
- Talking more than 70% of the time (poor listening)
- Pitching features before understanding needs (premature presentation)
- Avoiding or dismissing objections (defensive behavior)
- Ending without clear next steps or commitment (weak closing)',

  -- Rating scale definition (1-10)
  rating_scale JSONB DEFAULT '{
    "1-3": "Poor - Significant improvement needed. Multiple areas performed below standard.",
    "4-5": "Below Average - Some good moments but key areas need work.",
    "6-7": "Good - Solid performance with a few areas to improve.",
    "8-9": "Excellent - Strong performance across most areas.",
    "10": "Outstanding - Exceptional performance, best-in-class execution."
  }'::jsonb,

  -- Focus areas for this user (can be customized)
  focus_areas TEXT[] DEFAULT ARRAY['discovery', 'listening', 'value_articulation', 'objection_handling', 'closing', 'relationship_building'],

  -- Custom instructions to AI
  custom_instructions TEXT DEFAULT 'Focus on actionable feedback. Be specific about what was done well and what could be improved. Provide 2-3 concrete improvement suggestions.',

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one active preference per user
  UNIQUE(user_id, is_active)
);

-- Indexes
CREATE INDEX idx_user_coaching_preferences_user_id ON user_coaching_preferences(user_id);
CREATE INDEX idx_user_coaching_preferences_active ON user_coaching_preferences(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE user_coaching_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read their own preferences
CREATE POLICY "Users can read own coaching preferences"
  ON user_coaching_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own coaching preferences"
  ON user_coaching_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own coaching preferences"
  ON user_coaching_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own preferences
CREATE POLICY "Users can delete own coaching preferences"
  ON user_coaching_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_coaching_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_coaching_preferences_updated_at
  BEFORE UPDATE ON user_coaching_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_coaching_preferences_updated_at();

-- Create default preferences for existing active users
INSERT INTO user_coaching_preferences (user_id)
SELECT id FROM auth.users
WHERE id IN (
  SELECT DISTINCT user_id
  FROM fathom_integrations
  WHERE is_active = true
)
ON CONFLICT DO NOTHING;

-- Comment
COMMENT ON TABLE user_coaching_preferences IS 'User-defined coaching evaluation frameworks and criteria for AI analysis of sales calls';
