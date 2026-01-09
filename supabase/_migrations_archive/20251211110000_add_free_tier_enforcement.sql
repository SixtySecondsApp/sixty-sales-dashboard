-- Free Tier Enforcement Migration
-- Adds columns and functions needed to enforce:
-- 1. 30-day historical import limit for free tier
-- 2. 15 new meetings limit for free tier

-- ============================================================================
-- 1. Add is_historical_import column to meetings table
-- ============================================================================
ALTER TABLE meetings 
ADD COLUMN IF NOT EXISTS is_historical_import BOOLEAN DEFAULT false;

COMMENT ON COLUMN meetings.is_historical_import IS 'True if meeting was imported during initial onboarding sync (not counted toward new meeting limit)';

-- ============================================================================
-- 2. Add onboarding_completed_at to organizations table
-- ============================================================================
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN organizations.onboarding_completed_at IS 'When org completed onboarding - meetings after this are "new" meetings';

-- ============================================================================
-- 3. Create function to check meeting limits for an organization
-- ============================================================================
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
    -- Count new meetings (not historical imports, after onboarding)
    COALESCE((
      SELECT COUNT(*)::INTEGER 
      FROM meetings m 
      WHERE m.org_id = p_org_id 
      AND m.is_historical_import = false
    ), 0) as new_meetings_used,
    -- Count historical imports
    COALESCE((
      SELECT COUNT(*)::INTEGER 
      FROM meetings m 
      WHERE m.org_id = p_org_id 
      AND m.is_historical_import = true
    ), 0) as historical_meetings,
    -- Total meetings
    COALESCE((
      SELECT COUNT(*)::INTEGER 
      FROM meetings m 
      WHERE m.org_id = p_org_id
    ), 0) as total_meetings,
    -- Remaining (only matters for free tier)
    CASE 
      WHEN v_plan_is_free THEN 
        GREATEST(0, v_max_meetings - COALESCE((
          SELECT COUNT(*)::INTEGER 
          FROM meetings m 
          WHERE m.org_id = p_org_id 
          AND m.is_historical_import = false
        ), 0))
      ELSE -1 -- Unlimited
    END as meetings_remaining,
    -- Can sync new meetings?
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
    -- Historical cutoff (30 days ago for free tier)
    CASE 
      WHEN v_plan_is_free THEN NOW() - INTERVAL '30 days'
      ELSE NULL -- No limit for paid
    END as historical_cutoff_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_meeting_limits(UUID) IS 'Check meeting limits for an organization - returns usage and remaining quota';

-- ============================================================================
-- 4. Create function to mark onboarding as complete
-- ============================================================================
CREATE OR REPLACE FUNCTION mark_onboarding_complete(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE organizations
  SET 
    onboarding_completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_org_id
  AND onboarding_completed_at IS NULL;
  
  -- Also mark all existing meetings as historical imports
  UPDATE meetings
  SET is_historical_import = true
  WHERE org_id = p_org_id
  AND is_historical_import = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mark_onboarding_complete(UUID) IS 'Mark org onboarding as complete and flag existing meetings as historical imports';

-- ============================================================================
-- 5. Grant execute permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION check_meeting_limits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_meeting_limits(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION mark_onboarding_complete(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_onboarding_complete(UUID) TO service_role;

-- ============================================================================
-- 6. Create index for faster queries on is_historical_import
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_meetings_historical_import 
ON meetings(org_id, is_historical_import) 
WHERE is_historical_import = false;
