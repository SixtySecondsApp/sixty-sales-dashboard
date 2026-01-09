-- Fix get_reengagement_candidates function to use slack_user_mappings table
-- instead of expecting slack_user_id on profiles table

CREATE OR REPLACE FUNCTION get_reengagement_candidates(
  p_org_id UUID DEFAULT NULL,
  p_segment TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  user_id UUID,
  org_id UUID,
  slack_user_id TEXT,
  email TEXT,
  full_name TEXT,
  segment TEXT,
  days_inactive INTEGER,
  overall_engagement_score INTEGER,
  reengagement_attempts INTEGER,
  last_reengagement_at TIMESTAMPTZ,
  last_reengagement_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    uem.user_id,
    uem.org_id,
    sum.slack_user_id,
    p.email,
    COALESCE(p.full_name, p.first_name || ' ' || p.last_name, p.email) AS full_name,
    uem.user_segment AS segment,
    EXTRACT(DAY FROM NOW() - GREATEST(
      uem.last_app_active_at,
      uem.last_slack_active_at,
      uem.last_login_at
    ))::INTEGER AS days_inactive,
    uem.overall_engagement_score,
    COALESCE(uem.reengagement_attempts, 0) AS reengagement_attempts,
    uem.last_reengagement_at,
    uem.last_reengagement_type
  FROM user_engagement_metrics uem
  JOIN profiles p ON p.id = uem.user_id
  LEFT JOIN slack_user_mappings sum ON sum.user_id = uem.user_id AND sum.org_id = uem.org_id
  WHERE
    -- Filter by org if specified
    (p_org_id IS NULL OR uem.org_id = p_org_id)
    -- Filter by segment if specified, otherwise get at_risk, dormant, churned
    AND (
      (p_segment IS NOT NULL AND uem.user_segment = p_segment)
      OR (p_segment IS NULL AND uem.user_segment IN ('at_risk', 'dormant', 'churned'))
    )
    -- Must have email or Slack
    AND (p.email IS NOT NULL OR sum.slack_user_id IS NOT NULL)
    -- Not in cooldown
    AND (uem.reengagement_cooldown_until IS NULL OR uem.reengagement_cooldown_until < NOW())
    -- Check max attempts based on segment
    AND (
      (uem.user_segment = 'at_risk' AND COALESCE(uem.reengagement_attempts, 0) < 3)
      OR (uem.user_segment = 'dormant' AND COALESCE(uem.reengagement_attempts, 0) < 4)
      OR (uem.user_segment = 'churned' AND COALESCE(uem.reengagement_attempts, 0) < 2)
    )
    -- Days inactive thresholds
    AND (
      (uem.user_segment = 'at_risk' AND EXTRACT(DAY FROM NOW() - GREATEST(
        uem.last_app_active_at, uem.last_slack_active_at, uem.last_login_at
      )) >= 5)
      OR (uem.user_segment = 'dormant' AND EXTRACT(DAY FROM NOW() - GREATEST(
        uem.last_app_active_at, uem.last_slack_active_at, uem.last_login_at
      )) >= 3)
      OR (uem.user_segment = 'churned' AND EXTRACT(DAY FROM NOW() - GREATEST(
        uem.last_app_active_at, uem.last_slack_active_at, uem.last_login_at
      )) >= 14)
    )
  ORDER BY
    -- Prioritize by segment (at_risk first, then dormant, then churned)
    CASE uem.user_segment
      WHEN 'at_risk' THEN 1
      WHEN 'dormant' THEN 2
      WHEN 'churned' THEN 3
      ELSE 4
    END,
    -- Then by engagement score (higher = more likely to return)
    uem.overall_engagement_score DESC,
    -- Then by fewer attempts
    COALESCE(uem.reengagement_attempts, 0) ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix the get_notification_candidates_for_testing function if it exists
CREATE OR REPLACE FUNCTION get_notification_candidates_for_testing(
  p_org_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  user_id UUID,
  org_id UUID,
  slack_user_id TEXT,
  email TEXT,
  full_name TEXT,
  segment TEXT,
  notification_fatigue_level NUMERIC,
  preferred_notification_frequency TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    uem.user_id,
    uem.org_id,
    sum.slack_user_id,
    p.email,
    COALESCE(p.full_name, p.first_name || ' ' || p.last_name, p.email) AS full_name,
    uem.user_segment AS segment,
    uem.notification_fatigue_level,
    uem.preferred_notification_frequency
  FROM user_engagement_metrics uem
  JOIN profiles p ON p.id = uem.user_id
  LEFT JOIN slack_user_mappings sum ON sum.user_id = uem.user_id AND sum.org_id = uem.org_id
  WHERE
    (p_org_id IS NULL OR uem.org_id = p_org_id)
    AND (p.email IS NOT NULL OR sum.slack_user_id IS NOT NULL)
  ORDER BY uem.overall_engagement_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_reengagement_candidates IS 'Get users eligible for re-engagement - now uses slack_user_mappings for Slack IDs';
