-- Waitlist Onboarding Progress Tracking System
-- Tracks user completion of 6 key onboarding steps with automatic percentage calculation
-- Note: Renamed from 'user_onboarding_progress' to avoid conflict with existing general onboarding table

CREATE TABLE waitlist_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  waitlist_entry_id UUID REFERENCES meetings_waitlist(id) ON DELETE SET NULL,

  -- Onboarding step timestamps (6 steps)
  account_created_at TIMESTAMPTZ,
  profile_completed_at TIMESTAMPTZ,
  first_meeting_synced_at TIMESTAMPTZ,
  meeting_intelligence_used_at TIMESTAMPTZ,
  crm_integrated_at TIMESTAMPTZ,
  team_invited_at TIMESTAMPTZ,

  -- Calculated fields (auto-updated by trigger)
  completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  completed_steps INTEGER DEFAULT 0 CHECK (completed_steps >= 0 AND completed_steps <= 6),
  total_steps INTEGER DEFAULT 6 NOT NULL,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_waitlist_onboarding_user_id ON waitlist_onboarding_progress(user_id);
CREATE INDEX idx_waitlist_onboarding_entry_id ON waitlist_onboarding_progress(waitlist_entry_id);
CREATE INDEX idx_waitlist_onboarding_completion ON waitlist_onboarding_progress(completion_percentage);
CREATE INDEX idx_waitlist_onboarding_stuck_users ON waitlist_onboarding_progress(completion_percentage, updated_at)
  WHERE completion_percentage < 50;

-- Enable RLS
ALTER TABLE waitlist_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own onboarding progress
CREATE POLICY "Users can view own waitlist onboarding progress"
ON waitlist_onboarding_progress FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update their own onboarding progress (via service functions)
CREATE POLICY "Users can update own waitlist onboarding progress"
ON waitlist_onboarding_progress FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- System can insert onboarding progress (typically via trigger)
CREATE POLICY "System can insert waitlist onboarding progress"
ON waitlist_onboarding_progress FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Admins can view all onboarding progress
CREATE POLICY "Admins can view all waitlist onboarding progress"
ON waitlist_onboarding_progress FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Trigger function to auto-calculate completion percentage and steps
CREATE OR REPLACE FUNCTION calculate_waitlist_onboarding_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Count completed steps
  NEW.completed_steps := (
    CASE WHEN NEW.account_created_at IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN NEW.profile_completed_at IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN NEW.first_meeting_synced_at IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN NEW.meeting_intelligence_used_at IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN NEW.crm_integrated_at IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN NEW.team_invited_at IS NOT NULL THEN 1 ELSE 0 END
  );

  -- Calculate percentage
  NEW.completion_percentage := ROUND((NEW.completed_steps::FLOAT / NEW.total_steps::FLOAT) * 100);

  -- Update timestamp
  NEW.updated_at := now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_waitlist_onboarding_completion
BEFORE INSERT OR UPDATE ON waitlist_onboarding_progress
FOR EACH ROW
EXECUTE FUNCTION calculate_waitlist_onboarding_completion();

-- Function to mark an onboarding step as complete
CREATE OR REPLACE FUNCTION mark_waitlist_onboarding_step(
  p_user_id UUID,
  p_step TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  step_column TEXT;
  rows_affected INTEGER;
BEGIN
  -- Validate step name and map to column
  step_column := CASE p_step
    WHEN 'account_created' THEN 'account_created_at'
    WHEN 'profile_completed' THEN 'profile_completed_at'
    WHEN 'first_meeting_synced' THEN 'first_meeting_synced_at'
    WHEN 'meeting_intelligence_used' THEN 'meeting_intelligence_used_at'
    WHEN 'crm_integrated' THEN 'crm_integrated_at'
    WHEN 'team_invited' THEN 'team_invited_at'
    ELSE NULL
  END;

  IF step_column IS NULL THEN
    RAISE EXCEPTION 'Invalid onboarding step: %', p_step;
  END IF;

  -- Update the step timestamp if not already set
  EXECUTE format(
    'UPDATE waitlist_onboarding_progress
     SET %I = COALESCE(%I, now())
     WHERE user_id = $1',
    step_column, step_column
  ) USING p_user_id;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;

  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get onboarding analytics
CREATE OR REPLACE FUNCTION get_waitlist_onboarding_analytics()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', COUNT(*),
    'avg_completion', ROUND(AVG(completion_percentage), 2),
    'completed_users', COUNT(*) FILTER (WHERE completion_percentage = 100),
    'in_progress_users', COUNT(*) FILTER (WHERE completion_percentage > 0 AND completion_percentage < 100),
    'not_started_users', COUNT(*) FILTER (WHERE completion_percentage = 0),
    'stuck_users', COUNT(*) FILTER (
      WHERE completion_percentage < 50
      AND created_at < now() - INTERVAL '7 days'
    ),
    'distribution', json_build_object(
      '0-25', COUNT(*) FILTER (WHERE completion_percentage >= 0 AND completion_percentage <= 25),
      '26-50', COUNT(*) FILTER (WHERE completion_percentage >= 26 AND completion_percentage <= 50),
      '51-75', COUNT(*) FILTER (WHERE completion_percentage >= 51 AND completion_percentage <= 75),
      '76-100', COUNT(*) FILTER (WHERE completion_percentage >= 76 AND completion_percentage <= 100)
    ),
    'avg_days_to_complete', ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400), 2)
      FILTER (WHERE completion_percentage = 100)
  ) INTO result
  FROM waitlist_onboarding_progress;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get stuck users (< 50% completion, > 7 days)
CREATE OR REPLACE FUNCTION get_stuck_waitlist_onboarding_users()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  name TEXT,
  completion_percentage INTEGER,
  completed_steps INTEGER,
  days_since_created INTEGER,
  last_step_completed TEXT,
  last_step_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    uop.user_id,
    au.email,
    p.name,
    uop.completion_percentage,
    uop.completed_steps,
    EXTRACT(DAY FROM (now() - uop.created_at))::INTEGER AS days_since_created,
    CASE
      WHEN uop.team_invited_at IS NOT NULL THEN 'team_invited'
      WHEN uop.crm_integrated_at IS NOT NULL THEN 'crm_integrated'
      WHEN uop.meeting_intelligence_used_at IS NOT NULL THEN 'meeting_intelligence_used'
      WHEN uop.first_meeting_synced_at IS NOT NULL THEN 'first_meeting_synced'
      WHEN uop.profile_completed_at IS NOT NULL THEN 'profile_completed'
      WHEN uop.account_created_at IS NOT NULL THEN 'account_created'
      ELSE 'none'
    END AS last_step_completed,
    GREATEST(
      uop.account_created_at,
      uop.profile_completed_at,
      uop.first_meeting_synced_at,
      uop.meeting_intelligence_used_at,
      uop.crm_integrated_at,
      uop.team_invited_at
    ) AS last_step_date
  FROM waitlist_onboarding_progress uop
  JOIN auth.users au ON au.id = uop.user_id
  LEFT JOIN profiles p ON p.id = uop.user_id
  WHERE uop.completion_percentage < 50
    AND uop.created_at < now() - INTERVAL '7 days'
  ORDER BY uop.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE waitlist_onboarding_progress IS 'Tracks waitlist user completion of 6 key onboarding steps with automatic progress calculation';
COMMENT ON COLUMN waitlist_onboarding_progress.completion_percentage IS 'Auto-calculated percentage of completed steps (0-100)';
COMMENT ON COLUMN waitlist_onboarding_progress.completed_steps IS 'Auto-calculated count of completed steps (0-6)';
COMMENT ON FUNCTION mark_waitlist_onboarding_step IS 'Mark a specific waitlist onboarding step as complete for a user';
COMMENT ON FUNCTION get_waitlist_onboarding_analytics IS 'Get aggregated waitlist onboarding analytics across all users';
COMMENT ON FUNCTION get_stuck_waitlist_onboarding_users IS 'Get list of users who are stuck in waitlist onboarding (< 50% completion after 7 days)';
