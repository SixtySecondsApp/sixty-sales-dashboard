-- =============================================================================
-- MANUAL MIGRATIONS TO RUN IN SUPABASE SQL EDITOR
-- Date: December 11, 2025
-- 
-- Run this in: https://supabase.com/dashboard/project/ygdpgliavpxeugaajgrb/sql
-- =============================================================================

-- =============================================================================
-- 1. FREE TIER ENFORCEMENT (20251211110000_add_free_tier_enforcement.sql)
-- =============================================================================

-- Add is_historical_import column to meetings table
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS is_historical_import BOOLEAN DEFAULT false;

COMMENT ON COLUMN meetings.is_historical_import IS 'True if meeting was imported during initial onboarding sync (not counted toward new meeting limit)';

-- Add onboarding_completed_at to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN organizations.onboarding_completed_at IS 'When org completed onboarding - meetings after this are "new" meetings';

-- Create function to check meeting limits for an organization
CREATE OR REPLACE FUNCTION check_meeting_limits(p_org_id UUID)
RETURNS TABLE(
  is_free_tier BOOLEAN,
  max_meetings_per_month INTEGER,
  new_meetings_used INTEGER,
  historical_meetings INTEGER,
  total_meetings INTEGER,
  meetings_remaining INTEGER,
  can_sync_new BOOLEAN,
  historical_cutoff_date TIMESTAMPTZ
) AS $$
DECLARE
  v_plan_is_free BOOLEAN := true;
  v_max_meetings INTEGER := 15;
  v_onboarding_completed TIMESTAMPTZ;
BEGIN
  -- Get plan info
  SELECT 
    COALESCE(sp.is_free_tier, true),
    COALESCE(os.custom_max_meetings, sp.max_meetings_per_month, 15)
  INTO v_plan_is_free, v_max_meetings
  FROM organization_subscriptions os
  JOIN subscription_plans sp ON sp.id = os.plan_id
  WHERE os.org_id = p_org_id
  AND os.status IN ('active', 'trialing');
  
  -- Get onboarding completion time
  SELECT o.onboarding_completed_at INTO v_onboarding_completed
  FROM organizations o
  WHERE o.id = p_org_id;
  
  RETURN QUERY
  SELECT
    v_plan_is_free as is_free_tier,
    v_max_meetings as max_meetings_per_month,
    COALESCE((
      SELECT COUNT(*)::INTEGER 
      FROM meetings m 
      WHERE m.org_id = p_org_id 
      AND m.is_historical_import = false
    ), 0) as new_meetings_used,
    COALESCE((
      SELECT COUNT(*)::INTEGER 
      FROM meetings m 
      WHERE m.org_id = p_org_id 
      AND m.is_historical_import = true
    ), 0) as historical_meetings,
    COALESCE((
      SELECT COUNT(*)::INTEGER 
      FROM meetings m 
      WHERE m.org_id = p_org_id
    ), 0) as total_meetings,
    CASE 
      WHEN v_plan_is_free THEN 
        GREATEST(0, v_max_meetings - COALESCE((
          SELECT COUNT(*)::INTEGER 
          FROM meetings m 
          WHERE m.org_id = p_org_id 
          AND m.is_historical_import = false
        ), 0))
      ELSE -1
    END as meetings_remaining,
    CASE 
      WHEN v_plan_is_free THEN 
        COALESCE((
          SELECT COUNT(*)::INTEGER 
          FROM meetings m 
          WHERE m.org_id = p_org_id 
          AND m.is_historical_import = false
        ), 0) < v_max_meetings
      ELSE true
    END as can_sync_new,
    CASE 
      WHEN v_plan_is_free THEN NOW() - INTERVAL '30 days'
      ELSE NULL
    END as historical_cutoff_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_meeting_limits(UUID) IS 'Check meeting limits for an organization - returns usage and remaining quota';

-- Create function to mark onboarding as complete
CREATE OR REPLACE FUNCTION mark_onboarding_complete(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE organizations
  SET 
    onboarding_completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_org_id
  AND onboarding_completed_at IS NULL;
  
  UPDATE meetings
  SET is_historical_import = true
  WHERE org_id = p_org_id
  AND is_historical_import = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mark_onboarding_complete(UUID) IS 'Mark org onboarding as complete and flag existing meetings as historical imports';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_meeting_limits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_meeting_limits(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION mark_onboarding_complete(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_onboarding_complete(UUID) TO service_role;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_meetings_historical_import 
ON meetings(org_id, is_historical_import) 
WHERE is_historical_import = false;

-- =============================================================================
-- 2. EMAIL LOGS TABLE (20251211120000_add_email_logs_table.sql)
-- =============================================================================

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type TEXT NOT NULL,
  to_email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_via TEXT DEFAULT 'encharge',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_to_email ON email_logs(to_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);

-- RLS Policies
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_logs_service_role" ON email_logs
  FOR ALL
  USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY "email_logs_admin_select" ON email_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.is_admin = true
    )
  );

CREATE POLICY "email_logs_user_select" ON email_logs
  FOR SELECT
  USING (user_id = auth.uid());

COMMENT ON TABLE email_logs IS 'Logs all transactional and marketing emails sent via Encharge.io';

-- =============================================================================
-- DONE! Verify success by running:
-- SELECT * FROM check_meeting_limits('some-org-uuid-here');
-- SELECT COUNT(*) FROM email_logs;
-- =============================================================================
