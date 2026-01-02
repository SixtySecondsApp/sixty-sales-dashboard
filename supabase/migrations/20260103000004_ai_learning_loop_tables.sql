-- Phase 6: AI Learning Loop Tables
-- Tracks AI feedback, user preferences, and outcome measurements

-- ============================================================================
-- User AI Preferences Table
-- Stores learned preferences from feedback + explicit settings
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_ai_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Learned from feedback
  preferred_tone TEXT CHECK (preferred_tone IN ('formal', 'professional', 'casual', 'friendly')),
  preferred_length TEXT CHECK (preferred_length IN ('concise', 'standard', 'detailed')),
  prefers_ctas BOOLEAN,
  prefers_bullet_points BOOLEAN,

  -- Explicit settings
  auto_approve_threshold INTEGER DEFAULT 90 CHECK (auto_approve_threshold BETWEEN 0 AND 100),
  always_hitl_actions TEXT[] DEFAULT ARRAY['send_email', 'send_slack_message'],
  never_auto_send BOOLEAN DEFAULT false,

  -- Engagement preferences
  notification_frequency TEXT DEFAULT 'moderate' CHECK (notification_frequency IN ('high', 'moderate', 'low')),
  preferred_channels TEXT[] DEFAULT ARRAY['slack_dm'],

  -- Stats (calculated from feedback)
  total_suggestions INTEGER DEFAULT 0,
  approval_rate NUMERIC(5,4) DEFAULT 0,
  edit_rate NUMERIC(5,4) DEFAULT 0,
  rejection_rate NUMERIC(5,4) DEFAULT 0,
  avg_time_to_decision_seconds NUMERIC(10,2) DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one preferences row per user
  UNIQUE(user_id)
);

-- ============================================================================
-- AI Feedback Table
-- Records every feedback action on AI suggestions
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL, -- References ai_suggestions or other suggestion sources
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- What happened
  action TEXT NOT NULL CHECK (action IN ('approved', 'edited', 'rejected', 'ignored')),

  -- For edits, what changed
  original_content TEXT,
  edited_content TEXT,
  edit_delta JSONB, -- Structured analysis of what was changed

  -- Context at time of feedback
  action_type TEXT NOT NULL, -- 'send_email', 'create_task', etc.
  confidence_at_generation NUMERIC(5,2) NOT NULL,
  context_quality_at_generation NUMERIC(5,2),

  -- Outcome tracking (updated later)
  outcome_measured BOOLEAN DEFAULT false,
  outcome_positive BOOLEAN,
  outcome_type TEXT, -- 'reply_received', 'meeting_booked', 'task_completed', etc.

  -- Timing
  time_to_decision_seconds NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for analytics
  CONSTRAINT valid_action_type CHECK (action_type IN (
    'send_email', 'draft_follow_up', 'create_task', 'log_activity',
    'update_deal', 'schedule_meeting', 'send_slack_message'
  ))
);

-- ============================================================================
-- Org AI Preferences Table
-- Organization-wide AI settings and brand voice
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_ai_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Organizational tone
  brand_voice TEXT,
  tone_guidelines TEXT,

  -- Compliance
  required_disclaimers TEXT[] DEFAULT ARRAY[]::TEXT[],
  blocked_phrases TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Settings
  enable_auto_send BOOLEAN DEFAULT false,
  min_confidence_for_auto INTEGER DEFAULT 90 CHECK (min_confidence_for_auto BETWEEN 0 AND 100),
  require_manager_approval_above NUMERIC(12,2), -- Deal value threshold

  -- Aggregate stats
  total_suggestions INTEGER DEFAULT 0,
  org_approval_rate NUMERIC(5,4) DEFAULT 0,
  most_edited_action_types TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- User preferences lookup
CREATE INDEX IF NOT EXISTS idx_user_ai_preferences_user_id ON user_ai_preferences(user_id);

-- Feedback queries
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user_id ON ai_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_org_id ON ai_feedback(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_suggestion_id ON ai_feedback(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_action ON ai_feedback(action);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_action_type ON ai_feedback(action_type);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created_at ON ai_feedback(created_at);

-- Composite index for analytics queries
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user_action_date
  ON ai_feedback(user_id, action, created_at DESC);

-- Org preferences lookup
CREATE INDEX IF NOT EXISTS idx_org_ai_preferences_org_id ON org_ai_preferences(org_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE user_ai_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_ai_preferences ENABLE ROW LEVEL SECURITY;

-- User preferences: users can only see/edit their own
CREATE POLICY "Users can view own AI preferences"
  ON user_ai_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own AI preferences"
  ON user_ai_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI preferences"
  ON user_ai_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Feedback: users can see their own feedback
CREATE POLICY "Users can view own AI feedback"
  ON ai_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI feedback"
  ON ai_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow service role to update feedback (for outcome tracking)
CREATE POLICY "Service can update AI feedback"
  ON ai_feedback FOR UPDATE
  USING (auth.role() = 'service_role');

-- Org preferences: admins can view/edit their org's preferences
-- Uses organization_memberships table to check org membership and role
CREATE POLICY "Admins can view org AI preferences"
  ON org_ai_preferences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.user_id = auth.uid()
      AND om.org_id = org_ai_preferences.org_id
      AND om.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can update org AI preferences"
  ON org_ai_preferences FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.user_id = auth.uid()
      AND om.org_id = org_ai_preferences.org_id
      AND om.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can insert org AI preferences"
  ON org_ai_preferences FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships om
      WHERE om.user_id = auth.uid()
      AND om.org_id = org_ai_preferences.org_id
      AND om.role IN ('admin', 'owner')
    )
  );

-- ============================================================================
-- Triggers for Updated At
-- ============================================================================

CREATE OR REPLACE FUNCTION update_ai_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_ai_preferences_updated_at
  BEFORE UPDATE ON user_ai_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_preferences_timestamp();

CREATE TRIGGER org_ai_preferences_updated_at
  BEFORE UPDATE ON org_ai_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_preferences_timestamp();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE user_ai_preferences IS 'Stores user-specific AI preferences and learned behaviors from feedback';
COMMENT ON TABLE ai_feedback IS 'Records all feedback on AI suggestions for learning loop';
COMMENT ON TABLE org_ai_preferences IS 'Organization-wide AI settings including brand voice and compliance rules';

COMMENT ON COLUMN ai_feedback.edit_delta IS 'JSON object containing analysis of what the user changed: tone_shift, length_change, added_cta, etc.';
COMMENT ON COLUMN ai_feedback.outcome_measured IS 'Whether we have measured the outcome of this suggestion (e.g., reply received)';
COMMENT ON COLUMN user_ai_preferences.approval_rate IS 'Fraction of suggestions approved (0-1)';
