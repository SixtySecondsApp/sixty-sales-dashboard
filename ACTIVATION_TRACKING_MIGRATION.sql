-- ============================================================================
-- ACTIVATION TRACKING MIGRATION
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Add first_summary_viewed to user_onboarding_progress
ALTER TABLE user_onboarding_progress
ADD COLUMN IF NOT EXISTS first_summary_viewed BOOLEAN DEFAULT false;

ALTER TABLE user_onboarding_progress
ADD COLUMN IF NOT EXISTS first_summary_viewed_at TIMESTAMPTZ;

ALTER TABLE user_onboarding_progress
ADD COLUMN IF NOT EXISTS activation_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN user_onboarding_progress.first_summary_viewed IS 'NORTH STAR: True when user views their first meeting summary';
COMMENT ON COLUMN user_onboarding_progress.first_summary_viewed_at IS 'Timestamp of first summary view - key activation metric';
COMMENT ON COLUMN user_onboarding_progress.activation_completed_at IS 'When user completed full activation funnel';

-- ============================================================================
-- 2. Create activation_events table for detailed tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_activation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activation_events_user_id ON user_activation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_activation_events_type ON user_activation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_activation_events_created_at ON user_activation_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activation_events_org_id ON user_activation_events(org_id);

-- RLS
ALTER TABLE user_activation_events ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (for re-running)
DROP POLICY IF EXISTS "activation_events_service_role" ON user_activation_events;
DROP POLICY IF EXISTS "activation_events_user_select" ON user_activation_events;
DROP POLICY IF EXISTS "activation_events_user_insert" ON user_activation_events;
DROP POLICY IF EXISTS "activation_events_admin_select" ON user_activation_events;

CREATE POLICY "activation_events_user_select" ON user_activation_events
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "activation_events_user_insert" ON user_activation_events
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "activation_events_admin_select" ON user_activation_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

-- ============================================================================
-- 3. Create function to record activation event
-- ============================================================================
CREATE OR REPLACE FUNCTION record_activation_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_org_id UUID;
BEGIN
  -- Get user's org_id
  SELECT org_id INTO v_org_id
  FROM organization_memberships
  WHERE user_id = p_user_id
  LIMIT 1;

  -- Insert the event
  INSERT INTO user_activation_events (user_id, org_id, event_type, event_data)
  VALUES (p_user_id, v_org_id, p_event_type, p_event_data)
  RETURNING id INTO v_event_id;

  -- Update onboarding progress based on event type
  CASE p_event_type
    WHEN 'fathom_connected' THEN
      UPDATE user_onboarding_progress
      SET fathom_connected = true, updated_at = NOW()
      WHERE user_id = p_user_id;
      
    WHEN 'first_meeting_synced' THEN
      UPDATE user_onboarding_progress
      SET first_meeting_synced = true, updated_at = NOW()
      WHERE user_id = p_user_id;
      
    WHEN 'first_summary_viewed' THEN
      UPDATE user_onboarding_progress
      SET 
        first_summary_viewed = true, 
        first_summary_viewed_at = NOW(),
        updated_at = NOW()
      WHERE user_id = p_user_id
      AND first_summary_viewed = false; -- Only update if not already set
      
    WHEN 'first_proposal_generated' THEN
      UPDATE user_onboarding_progress
      SET first_proposal_generated = true, updated_at = NOW()
      WHERE user_id = p_user_id;
      
    ELSE
      -- No special handling needed
      NULL;
  END CASE;

  -- Check if user has completed full activation (all key milestones)
  UPDATE user_onboarding_progress
  SET 
    activation_completed_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id
  AND activation_completed_at IS NULL
  AND fathom_connected = true
  AND first_meeting_synced = true
  AND first_summary_viewed = true;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION record_activation_event(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION record_activation_event(UUID, TEXT, JSONB) TO service_role;

-- ============================================================================
-- 4. Create view for activation funnel metrics (Platform Admin)
-- ============================================================================
CREATE OR REPLACE VIEW activation_funnel_metrics AS
SELECT
  -- Total users
  (SELECT COUNT(*) FROM auth.users) as total_users,
  
  -- Users with onboarding progress
  (SELECT COUNT(*) FROM user_onboarding_progress) as users_with_progress,
  
  -- Fathom connected
  (SELECT COUNT(*) FROM user_onboarding_progress WHERE fathom_connected = true) as fathom_connected_count,
  
  -- First meeting synced
  (SELECT COUNT(*) FROM user_onboarding_progress WHERE first_meeting_synced = true) as first_meeting_synced_count,
  
  -- NORTH STAR: First summary viewed
  (SELECT COUNT(*) FROM user_onboarding_progress WHERE first_summary_viewed = true) as first_summary_viewed_count,
  
  -- First proposal generated
  (SELECT COUNT(*) FROM user_onboarding_progress WHERE first_proposal_generated = true) as first_proposal_generated_count,
  
  -- Fully activated (completed funnel)
  (SELECT COUNT(*) FROM user_onboarding_progress WHERE activation_completed_at IS NOT NULL) as fully_activated_count,
  
  -- Onboarding completed
  (SELECT COUNT(*) FROM user_onboarding_progress WHERE onboarding_completed_at IS NOT NULL) as onboarding_completed_count,
  
  -- Skipped onboarding
  (SELECT COUNT(*) FROM user_onboarding_progress WHERE skipped_onboarding = true) as skipped_onboarding_count,
  
  -- Today's activations
  (SELECT COUNT(*) FROM user_activation_events WHERE created_at >= CURRENT_DATE) as activations_today,
  
  -- This week's activations
  (SELECT COUNT(*) FROM user_activation_events WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as activations_this_week;

-- ============================================================================
-- 5. Create function to get activation funnel for date range
-- ============================================================================
CREATE OR REPLACE FUNCTION get_activation_funnel(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  step_name TEXT,
  step_order INT,
  user_count BIGINT,
  percentage NUMERIC,
  avg_time_to_step INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  WITH funnel_data AS (
    SELECT
      uop.user_id,
      uop.created_at as account_created,
      CASE WHEN uop.fathom_connected THEN uop.updated_at END as fathom_time,
      CASE WHEN uop.first_meeting_synced THEN uop.updated_at END as meeting_time,
      uop.first_summary_viewed_at as summary_time,
      uop.activation_completed_at
    FROM user_onboarding_progress uop
    WHERE uop.created_at::date BETWEEN p_start_date AND p_end_date
  ),
  totals AS (
    SELECT COUNT(*) as total FROM funnel_data
  )
  SELECT 
    s.step_name,
    s.step_order,
    s.user_count,
    ROUND((s.user_count::NUMERIC / NULLIF(t.total, 0) * 100), 1) as percentage,
    s.avg_time
  FROM totals t
  CROSS JOIN LATERAL (
    VALUES
      ('Account Created', 1, (SELECT COUNT(*) FROM funnel_data), NULL::INTERVAL),
      ('Fathom Connected', 2, (SELECT COUNT(*) FROM funnel_data WHERE fathom_time IS NOT NULL), 
        (SELECT AVG(fathom_time - account_created) FROM funnel_data WHERE fathom_time IS NOT NULL)),
      ('First Meeting Synced', 3, (SELECT COUNT(*) FROM funnel_data WHERE meeting_time IS NOT NULL),
        (SELECT AVG(meeting_time - account_created) FROM funnel_data WHERE meeting_time IS NOT NULL)),
      ('First Summary Viewed (North Star)', 4, (SELECT COUNT(*) FROM funnel_data WHERE summary_time IS NOT NULL),
        (SELECT AVG(summary_time - account_created) FROM funnel_data WHERE summary_time IS NOT NULL)),
      ('Fully Activated', 5, (SELECT COUNT(*) FROM funnel_data WHERE activation_completed_at IS NOT NULL),
        (SELECT AVG(activation_completed_at - account_created) FROM funnel_data WHERE activation_completed_at IS NOT NULL))
  ) AS s(step_name, step_order, user_count, avg_time);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_activation_funnel(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_activation_funnel(DATE, DATE) TO service_role;

-- ============================================================================
-- 6. Update Launch Checklist (by title match since IDs are UUIDs)
-- ============================================================================
UPDATE launch_checklist_items 
SET 
  status = 'completed',
  notes = 'Database migration, useActivationTracking hook, ActivationDashboard page built - Dec 11',
  updated_at = NOW()
WHERE title ILIKE '%North Star%' OR title ILIKE '%activation dashboard%';

-- ============================================================================
-- Done! 
-- ============================================================================
SELECT 'Activation tracking migration complete!' as status;








