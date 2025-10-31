-- Migration: Next Action Suggestions System
-- Description: AI-powered next-best-action recommendation engine using Claude Haiku 4.5
-- Author: Claude
-- Date: 2025-10-31

-- ============================================================================
-- PHASE 1: Create next_action_suggestions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS next_action_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Source context (what activity triggered this suggestion)
  activity_id UUID NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('meeting', 'activity', 'email', 'proposal', 'call')),

  -- Related entities
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Suggestion details
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high')),
  recommended_deadline TIMESTAMPTZ,
  confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),

  -- User interaction tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed', 'completed')),
  user_feedback TEXT,
  created_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  dismissed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- AI metadata
  ai_model TEXT DEFAULT 'claude-haiku-4-5-20251001',
  context_quality NUMERIC(3,2) CHECK (context_quality >= 0 AND context_quality <= 1)
);

-- ============================================================================
-- PHASE 2: Create Indexes for Performance
-- ============================================================================

-- Index for fetching user's pending suggestions
CREATE INDEX idx_next_actions_user_status
  ON next_action_suggestions(user_id, status)
  WHERE status = 'pending';

-- Index for activity lookups
CREATE INDEX idx_next_actions_activity
  ON next_action_suggestions(activity_id, activity_type);

-- Index for deal-based suggestions
CREATE INDEX idx_next_actions_deal
  ON next_action_suggestions(deal_id)
  WHERE deal_id IS NOT NULL;

-- Index for company-based suggestions
CREATE INDEX idx_next_actions_company
  ON next_action_suggestions(company_id)
  WHERE company_id IS NOT NULL;

-- Index for urgency-based queries
CREATE INDEX idx_next_actions_urgency_status
  ON next_action_suggestions(urgency, status, user_id)
  WHERE status = 'pending';

-- Index for deadline-based sorting
CREATE INDEX idx_next_actions_deadline
  ON next_action_suggestions(recommended_deadline, status)
  WHERE status = 'pending' AND recommended_deadline IS NOT NULL;

-- ============================================================================
-- PHASE 3: Add Tracking Columns to Source Tables
-- ============================================================================

-- Track when next actions were last generated for meetings
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS next_actions_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_actions_count INTEGER DEFAULT 0;

-- Track when next actions were last generated for activities
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS next_actions_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_actions_count INTEGER DEFAULT 0;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_meetings_next_actions_generated
  ON meetings(next_actions_generated_at)
  WHERE next_actions_generated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activities_next_actions_generated
  ON activities(next_actions_generated_at)
  WHERE next_actions_generated_at IS NOT NULL;

-- ============================================================================
-- PHASE 4: Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE next_action_suggestions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own suggestions
CREATE POLICY "Users can view own suggestions"
  ON next_action_suggestions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update their own suggestions (accept/dismiss)
CREATE POLICY "Users can update own suggestions"
  ON next_action_suggestions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Service role can insert suggestions (from Edge Function)
CREATE POLICY "Service role can insert suggestions"
  ON next_action_suggestions
  FOR INSERT
  WITH CHECK (true); -- Service role has full access

-- Policy: Users can delete their own dismissed suggestions
CREATE POLICY "Users can delete own dismissed suggestions"
  ON next_action_suggestions
  FOR DELETE
  USING (auth.uid() = user_id AND status = 'dismissed');

-- ============================================================================
-- PHASE 5: Helper Functions
-- ============================================================================

-- Function to get user_id from activity
CREATE OR REPLACE FUNCTION get_user_id_from_activity(
  p_activity_id UUID,
  p_activity_type TEXT
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
BEGIN
  CASE p_activity_type
    WHEN 'meeting' THEN
      SELECT owner_user_id INTO v_user_id
      FROM meetings
      WHERE id = p_activity_id;

    WHEN 'activity' THEN
      SELECT user_id INTO v_user_id
      FROM activities
      WHERE id = p_activity_id;

    ELSE
      -- Default fallback
      RETURN NULL;
  END CASE;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-populate user_id on suggestion insert
CREATE OR REPLACE FUNCTION auto_populate_suggestion_user_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If user_id not provided, try to get it from the activity
  IF NEW.user_id IS NULL THEN
    NEW.user_id := get_user_id_from_activity(NEW.activity_id, NEW.activity_type);
  END IF;

  -- Validate user_id exists
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine user_id for suggestion';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-populate user_id
CREATE TRIGGER trigger_auto_populate_suggestion_user_id
  BEFORE INSERT ON next_action_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_suggestion_user_id();

-- Function to update suggestion counts on source tables
CREATE OR REPLACE FUNCTION update_next_actions_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update count based on activity type
  IF TG_OP = 'INSERT' THEN
    IF NEW.activity_type = 'meeting' THEN
      UPDATE meetings
      SET
        next_actions_count = COALESCE(next_actions_count, 0) + 1,
        next_actions_generated_at = NOW()
      WHERE id = NEW.activity_id;
    ELSIF NEW.activity_type = 'activity' THEN
      UPDATE activities
      SET
        next_actions_count = COALESCE(next_actions_count, 0) + 1,
        next_actions_generated_at = NOW()
      WHERE id = NEW.activity_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.activity_type = 'meeting' THEN
      UPDATE meetings
      SET next_actions_count = GREATEST(0, COALESCE(next_actions_count, 0) - 1)
      WHERE id = OLD.activity_id;
    ELSIF OLD.activity_type = 'activity' THEN
      UPDATE activities
      SET next_actions_count = GREATEST(0, COALESCE(next_actions_count, 0) - 1)
      WHERE id = OLD.activity_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update counts
CREATE TRIGGER trigger_update_next_actions_count
  AFTER INSERT OR DELETE ON next_action_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_next_actions_count();

-- Function to automatically update status when task is created
CREATE OR REPLACE FUNCTION update_suggestion_on_task_creation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_task_id IS NOT NULL AND OLD.created_task_id IS NULL THEN
    NEW.status := 'accepted';
    NEW.accepted_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for task creation
CREATE TRIGGER trigger_update_suggestion_on_task_creation
  BEFORE UPDATE ON next_action_suggestions
  FOR EACH ROW
  WHEN (NEW.created_task_id IS NOT NULL AND OLD.created_task_id IS NULL)
  EXECUTE FUNCTION update_suggestion_on_task_creation();

-- ============================================================================
-- PHASE 6: Utility Functions for Application
-- ============================================================================

-- Function to accept a suggestion and create task
CREATE OR REPLACE FUNCTION accept_next_action_suggestion(
  p_suggestion_id UUID,
  p_task_data JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_suggestion RECORD;
  v_task_id UUID;
  v_task_title TEXT;
  v_task_description TEXT;
  v_task_due_date TIMESTAMPTZ;
  v_task_priority TEXT;
BEGIN
  -- Get suggestion
  SELECT * INTO v_suggestion
  FROM next_action_suggestions
  WHERE id = p_suggestion_id
    AND user_id = auth.uid()
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suggestion not found or already processed';
  END IF;

  -- Prepare task data (allow overrides from p_task_data)
  v_task_title := COALESCE(
    p_task_data->>'title',
    v_suggestion.title
  );

  v_task_description := COALESCE(
    p_task_data->>'description',
    'AI Suggestion: ' || v_suggestion.reasoning
  );

  v_task_due_date := COALESCE(
    (p_task_data->>'due_date')::TIMESTAMPTZ,
    v_suggestion.recommended_deadline
  );

  v_task_priority := COALESCE(
    p_task_data->>'priority',
    v_suggestion.urgency
  );

  -- Create task
  INSERT INTO tasks (
    title,
    description,
    due_date,
    priority,
    status,
    task_type,
    user_id,
    company_id,
    deal_id,
    notes
  ) VALUES (
    v_task_title,
    v_task_description,
    v_task_due_date,
    v_task_priority,
    'pending',
    v_suggestion.action_type,
    v_suggestion.user_id,
    v_suggestion.company_id,
    v_suggestion.deal_id,
    'Created from AI suggestion (confidence: ' || ROUND(v_suggestion.confidence_score * 100) || '%)'
  )
  RETURNING id INTO v_task_id;

  -- Update suggestion
  UPDATE next_action_suggestions
  SET
    created_task_id = v_task_id,
    status = 'accepted',
    accepted_at = NOW()
  WHERE id = p_suggestion_id;

  RETURN v_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to dismiss a suggestion
CREATE OR REPLACE FUNCTION dismiss_next_action_suggestion(
  p_suggestion_id UUID,
  p_feedback TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE next_action_suggestions
  SET
    status = 'dismissed',
    dismissed_at = NOW(),
    user_feedback = p_feedback
  WHERE id = p_suggestion_id
    AND user_id = auth.uid()
    AND status = 'pending';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending suggestions count for user
CREATE OR REPLACE FUNCTION get_pending_suggestions_count(p_user_id UUID DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  v_user_id UUID;
  v_count INTEGER;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM next_action_suggestions
  WHERE user_id = v_user_id
    AND status = 'pending';

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PHASE 7: Comments and Documentation
-- ============================================================================

COMMENT ON TABLE next_action_suggestions IS 'AI-generated next-best-action suggestions based on sales activities';
COMMENT ON COLUMN next_action_suggestions.activity_id IS 'ID of the source activity (meeting, email, etc.)';
COMMENT ON COLUMN next_action_suggestions.activity_type IS 'Type of source activity';
COMMENT ON COLUMN next_action_suggestions.action_type IS 'Specific action category (e.g., send_roi_calculator, schedule_demo)';
COMMENT ON COLUMN next_action_suggestions.reasoning IS 'AI-generated explanation for why this action is recommended';
COMMENT ON COLUMN next_action_suggestions.confidence_score IS 'AI confidence in this suggestion (0.0 to 1.0)';
COMMENT ON COLUMN next_action_suggestions.context_quality IS 'Quality of context used for analysis (0.0 to 1.0)';

COMMENT ON FUNCTION accept_next_action_suggestion IS 'Accept an AI suggestion and create a task from it';
COMMENT ON FUNCTION dismiss_next_action_suggestion IS 'Dismiss an AI suggestion with optional feedback';
COMMENT ON FUNCTION get_pending_suggestions_count IS 'Get count of pending suggestions for current user';

-- ============================================================================
-- PHASE 8: Grant Permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON next_action_suggestions TO authenticated;
GRANT EXECUTE ON FUNCTION accept_next_action_suggestion TO authenticated;
GRANT EXECUTE ON FUNCTION dismiss_next_action_suggestion TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_suggestions_count TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_id_from_activity TO service_role;
