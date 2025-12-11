-- User Cohorts and At-Risk Alerts
-- Date: December 11, 2025
-- Purpose: Add cohort analysis and at-risk user detection for activation tracking

-- ============================================================================
-- 1. Weekly Cohort View - Groups users by signup week
-- ============================================================================

CREATE OR REPLACE VIEW user_weekly_cohorts AS
SELECT 
  -- Cohort identifier (start of week)
  date_trunc('week', u.created_at)::date AS cohort_week,
  
  -- Week number for easier grouping
  EXTRACT(week FROM u.created_at) AS week_number,
  EXTRACT(year FROM u.created_at) AS year,
  
  -- Total users in cohort
  COUNT(DISTINCT u.id) AS total_users,
  
  -- Activation milestones
  COUNT(DISTINCT CASE WHEN uop.fathom_connected = true THEN u.id END) AS fathom_connected,
  COUNT(DISTINCT CASE WHEN uop.first_meeting_synced = true THEN u.id END) AS first_meeting_synced,
  COUNT(DISTINCT CASE WHEN uop.first_summary_viewed = true THEN u.id END) AS first_summary_viewed,
  COUNT(DISTINCT CASE WHEN uop.activation_completed_at IS NOT NULL THEN u.id END) AS fully_activated,
  
  -- Conversion rates
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN uop.fathom_connected = true THEN u.id END) / 
    NULLIF(COUNT(DISTINCT u.id), 0), 
    1
  ) AS fathom_rate,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN uop.first_meeting_synced = true THEN u.id END) / 
    NULLIF(COUNT(DISTINCT u.id), 0), 
    1
  ) AS meeting_synced_rate,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN uop.first_summary_viewed = true THEN u.id END) / 
    NULLIF(COUNT(DISTINCT u.id), 0), 
    1
  ) AS summary_viewed_rate,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN uop.activation_completed_at IS NOT NULL THEN u.id END) / 
    NULLIF(COUNT(DISTINCT u.id), 0), 
    1
  ) AS activation_rate,
  
  -- Average days to activation
  ROUND(
    AVG(
      CASE 
        WHEN uop.activation_completed_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (uop.activation_completed_at - u.created_at)) / 86400
      END
    )::numeric,
    1
  ) AS avg_days_to_activation
  
FROM auth.users u
LEFT JOIN user_onboarding_progress uop ON uop.user_id = u.id
WHERE u.created_at >= NOW() - INTERVAL '90 days'
GROUP BY date_trunc('week', u.created_at), EXTRACT(week FROM u.created_at), EXTRACT(year FROM u.created_at)
ORDER BY cohort_week DESC;

-- ============================================================================
-- 2. At-Risk Users View - Users not activating within expected timeframes
-- ============================================================================

CREATE OR REPLACE VIEW at_risk_users AS
SELECT 
  u.id AS user_id,
  u.email,
  u.raw_user_meta_data->>'full_name' AS full_name,
  u.created_at AS signup_date,
  EXTRACT(EPOCH FROM (NOW() - u.created_at)) / 3600 AS hours_since_signup,
  
  -- Current activation state
  COALESCE(uop.fathom_connected, false) AS fathom_connected,
  COALESCE(uop.first_meeting_synced, false) AS first_meeting_synced,
  COALESCE(uop.first_summary_viewed, false) AS first_summary_viewed,
  uop.activation_completed_at,
  
  -- Risk assessment
  CASE
    -- High risk: Signed up > 48 hours ago, hasn't connected Fathom
    WHEN NOT COALESCE(uop.fathom_connected, false) 
         AND u.created_at < NOW() - INTERVAL '48 hours'
    THEN 'high'
    
    -- Medium risk: Connected Fathom but no meeting synced after 24 hours
    WHEN COALESCE(uop.fathom_connected, false) 
         AND NOT COALESCE(uop.first_meeting_synced, false)
         AND u.created_at < NOW() - INTERVAL '24 hours'
    THEN 'medium'
    
    -- Low risk: Has meetings but hasn't viewed summary after 12 hours
    WHEN COALESCE(uop.first_meeting_synced, false)
         AND NOT COALESCE(uop.first_summary_viewed, false)
         AND u.created_at < NOW() - INTERVAL '12 hours'
    THEN 'low'
    
    ELSE 'on_track'
  END AS risk_level,
  
  -- Suggested action
  CASE
    WHEN NOT COALESCE(uop.fathom_connected, false) 
         AND u.created_at < NOW() - INTERVAL '48 hours'
    THEN 'Send Fathom connection reminder email'
    
    WHEN COALESCE(uop.fathom_connected, false) 
         AND NOT COALESCE(uop.first_meeting_synced, false)
         AND u.created_at < NOW() - INTERVAL '24 hours'
    THEN 'Check if user has meetings to sync'
    
    WHEN COALESCE(uop.first_meeting_synced, false)
         AND NOT COALESCE(uop.first_summary_viewed, false)
         AND u.created_at < NOW() - INTERVAL '12 hours'
    THEN 'Prompt user to view meeting insights'
    
    ELSE 'No action needed'
  END AS suggested_action,
  
  -- Last activity
  uop.updated_at AS last_onboarding_update,
  
  -- Organization info
  om.org_id,
  o.name AS org_name
  
FROM auth.users u
LEFT JOIN user_onboarding_progress uop ON uop.user_id = u.id
LEFT JOIN organization_memberships om ON om.user_id = u.id
LEFT JOIN organizations o ON o.id = om.org_id
WHERE 
  -- Only include users who haven't fully activated
  uop.activation_completed_at IS NULL
  -- And signed up in the last 14 days (recent enough to re-engage)
  AND u.created_at >= NOW() - INTERVAL '14 days'
  -- Exclude internal test accounts
  AND u.email NOT LIKE '%@sixtyapp.com'
  AND u.email NOT LIKE '%test%'
ORDER BY 
  CASE 
    WHEN NOT COALESCE(uop.fathom_connected, false) AND u.created_at < NOW() - INTERVAL '48 hours' THEN 1
    WHEN COALESCE(uop.fathom_connected, false) AND NOT COALESCE(uop.first_meeting_synced, false) AND u.created_at < NOW() - INTERVAL '24 hours' THEN 2
    WHEN COALESCE(uop.first_meeting_synced, false) AND NOT COALESCE(uop.first_summary_viewed, false) AND u.created_at < NOW() - INTERVAL '12 hours' THEN 3
    ELSE 4
  END,
  u.created_at DESC;

-- ============================================================================
-- 3. RPC Function: Get Cohort Data
-- ============================================================================

CREATE OR REPLACE FUNCTION get_cohort_analysis(
  p_weeks INTEGER DEFAULT 8
)
RETURNS TABLE (
  cohort_week DATE,
  week_label TEXT,
  total_users BIGINT,
  fathom_connected BIGINT,
  first_meeting_synced BIGINT,
  first_summary_viewed BIGINT,
  fully_activated BIGINT,
  fathom_rate NUMERIC,
  meeting_synced_rate NUMERIC,
  summary_viewed_rate NUMERIC,
  activation_rate NUMERIC,
  avg_days_to_activation NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    cohort_week,
    'Week ' || week_number || ' (' || to_char(cohort_week, 'Mon DD') || ')' AS week_label,
    total_users,
    fathom_connected,
    first_meeting_synced,
    first_summary_viewed,
    fully_activated,
    fathom_rate,
    meeting_synced_rate,
    summary_viewed_rate,
    activation_rate,
    avg_days_to_activation
  FROM user_weekly_cohorts
  WHERE cohort_week >= NOW() - (p_weeks || ' weeks')::INTERVAL
  ORDER BY cohort_week DESC
  LIMIT p_weeks;
$$;

-- ============================================================================
-- 4. RPC Function: Get At-Risk Users
-- ============================================================================

CREATE OR REPLACE FUNCTION get_at_risk_users(
  p_risk_level TEXT DEFAULT 'all',  -- 'high', 'medium', 'low', 'all'
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  signup_date TIMESTAMPTZ,
  hours_since_signup NUMERIC,
  fathom_connected BOOLEAN,
  first_meeting_synced BOOLEAN,
  first_summary_viewed BOOLEAN,
  risk_level TEXT,
  suggested_action TEXT,
  org_name TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    user_id,
    email,
    full_name,
    signup_date,
    hours_since_signup::NUMERIC,
    fathom_connected,
    first_meeting_synced,
    first_summary_viewed,
    risk_level,
    suggested_action,
    org_name
  FROM at_risk_users
  WHERE 
    risk_level != 'on_track'
    AND (p_risk_level = 'all' OR risk_level = p_risk_level)
  LIMIT p_limit;
$$;

-- ============================================================================
-- 5. RPC Function: Get At-Risk Summary
-- ============================================================================

CREATE OR REPLACE FUNCTION get_at_risk_summary()
RETURNS TABLE (
  risk_level TEXT,
  user_count BIGINT,
  percentage NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH risk_counts AS (
    SELECT 
      risk_level,
      COUNT(*) AS user_count
    FROM at_risk_users
    WHERE risk_level != 'on_track'
    GROUP BY risk_level
  ),
  total AS (
    SELECT SUM(user_count) AS total_count FROM risk_counts
  )
  SELECT 
    rc.risk_level,
    rc.user_count,
    ROUND(100.0 * rc.user_count / NULLIF(t.total_count, 0), 1) AS percentage
  FROM risk_counts rc
  CROSS JOIN total t
  ORDER BY 
    CASE rc.risk_level
      WHEN 'high' THEN 1
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 3
      ELSE 4
    END;
$$;

-- ============================================================================
-- 6. Grant permissions
-- ============================================================================

-- Grant access to authenticated users (will be filtered by RLS in practice)
GRANT SELECT ON user_weekly_cohorts TO authenticated;
GRANT SELECT ON at_risk_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_cohort_analysis TO authenticated;
GRANT EXECUTE ON FUNCTION get_at_risk_users TO authenticated;
GRANT EXECUTE ON FUNCTION get_at_risk_summary TO authenticated;

-- ============================================================================
-- Done!
-- ============================================================================

COMMENT ON VIEW user_weekly_cohorts IS 'Weekly cohort analysis of user activation metrics';
COMMENT ON VIEW at_risk_users IS 'Users at risk of not completing activation, with suggested actions';
COMMENT ON FUNCTION get_cohort_analysis IS 'Get weekly cohort breakdown with activation rates';
COMMENT ON FUNCTION get_at_risk_users IS 'Get list of at-risk users filtered by risk level';
COMMENT ON FUNCTION get_at_risk_summary IS 'Get summary counts of at-risk users by level';
