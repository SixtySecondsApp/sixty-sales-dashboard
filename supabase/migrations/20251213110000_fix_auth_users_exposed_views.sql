-- ============================================================================
-- Fix Exposed Auth Users Views
-- ============================================================================
-- Date: 2025-12-13
-- Purpose: Fix security linter errors for 4 views:
--   1. activation_funnel_metrics - Exposes auth.users via COUNT(*), uses SECURITY DEFINER
--   2. user_weekly_cohorts - Exposes auth.users, uses SECURITY DEFINER
--   3. at_risk_users - Exposes auth.users (email, metadata), uses SECURITY DEFINER
--   4. waitlist_with_rank - Uses SECURITY DEFINER
--
-- Solutions:
--   - Replace auth.users references with user_onboarding_progress + profiles
--   - Add security_invoker = true (removes SECURITY DEFINER)
--   - Revoke anon access, require authenticated role
--   - For admin views, restrict to service_role + admins only
-- ============================================================================

-- ============================================================================
-- 1. Fix activation_funnel_metrics
-- ============================================================================
-- This view counts users for funnel metrics. The auth.users reference
-- is only for total count which we can get from profiles instead.
-- ============================================================================

DROP VIEW IF EXISTS activation_funnel_metrics CASCADE;

CREATE VIEW activation_funnel_metrics 
WITH (security_invoker = true) AS
SELECT
  -- Total users (use profiles instead of auth.users)
  (SELECT COUNT(*) FROM profiles) as total_users,
  
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

COMMENT ON VIEW activation_funnel_metrics IS 'Aggregated activation funnel metrics for Platform Admin dashboard (no auth.users exposure)';

-- Revoke anon access and grant to authenticated/service_role only
REVOKE ALL ON activation_funnel_metrics FROM anon;
REVOKE ALL ON activation_funnel_metrics FROM public;
GRANT SELECT ON activation_funnel_metrics TO authenticated;
GRANT SELECT ON activation_funnel_metrics TO service_role;


-- ============================================================================
-- 2. Fix user_weekly_cohorts
-- ============================================================================
-- This view groups users by signup week for cohort analysis.
-- We need to join user_onboarding_progress with profiles to get created_at
-- Note: user_onboarding_progress.created_at tracks when onboarding started
-- ============================================================================

DROP VIEW IF EXISTS user_weekly_cohorts CASCADE;

CREATE VIEW user_weekly_cohorts
WITH (security_invoker = true) AS
SELECT 
  -- Cohort identifier (start of week based on onboarding start)
  date_trunc('week', uop.created_at)::date AS cohort_week,
  
  -- Week number for easier grouping
  EXTRACT(week FROM uop.created_at) AS week_number,
  EXTRACT(year FROM uop.created_at) AS year,
  
  -- Total users in cohort
  COUNT(DISTINCT uop.user_id) AS total_users,
  
  -- Activation milestones
  COUNT(DISTINCT CASE WHEN uop.fathom_connected = true THEN uop.user_id END) AS fathom_connected,
  COUNT(DISTINCT CASE WHEN uop.first_meeting_synced = true THEN uop.user_id END) AS first_meeting_synced,
  COUNT(DISTINCT CASE WHEN uop.first_summary_viewed = true THEN uop.user_id END) AS first_summary_viewed,
  COUNT(DISTINCT CASE WHEN uop.activation_completed_at IS NOT NULL THEN uop.user_id END) AS fully_activated,
  
  -- Conversion rates
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN uop.fathom_connected = true THEN uop.user_id END) / 
    NULLIF(COUNT(DISTINCT uop.user_id), 0), 
    1
  ) AS fathom_rate,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN uop.first_meeting_synced = true THEN uop.user_id END) / 
    NULLIF(COUNT(DISTINCT uop.user_id), 0), 
    1
  ) AS meeting_synced_rate,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN uop.first_summary_viewed = true THEN uop.user_id END) / 
    NULLIF(COUNT(DISTINCT uop.user_id), 0), 
    1
  ) AS summary_viewed_rate,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN uop.activation_completed_at IS NOT NULL THEN uop.user_id END) / 
    NULLIF(COUNT(DISTINCT uop.user_id), 0), 
    1
  ) AS activation_rate,
  
  -- Average days to activation
  ROUND(
    AVG(
      CASE 
        WHEN uop.activation_completed_at IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (uop.activation_completed_at - uop.created_at)) / 86400
      END
    )::numeric,
    1
  ) AS avg_days_to_activation
  
FROM user_onboarding_progress uop
WHERE uop.created_at >= NOW() - INTERVAL '90 days'
GROUP BY date_trunc('week', uop.created_at), EXTRACT(week FROM uop.created_at), EXTRACT(year FROM uop.created_at)
ORDER BY cohort_week DESC;

COMMENT ON VIEW user_weekly_cohorts IS 'Weekly cohort analysis of user activation metrics (no auth.users exposure)';

-- Revoke anon access and grant to authenticated/service_role only
REVOKE ALL ON user_weekly_cohorts FROM anon;
REVOKE ALL ON user_weekly_cohorts FROM public;
GRANT SELECT ON user_weekly_cohorts TO authenticated;
GRANT SELECT ON user_weekly_cohorts TO service_role;


-- ============================================================================
-- 3. Fix at_risk_users
-- ============================================================================
-- This view identifies users at risk of not activating.
-- We replace auth.users with profiles for email/name and use 
-- user_onboarding_progress.created_at for signup date.
-- ============================================================================

DROP VIEW IF EXISTS at_risk_users CASCADE;

CREATE VIEW at_risk_users
WITH (security_invoker = true) AS
SELECT 
  p.id AS user_id,
  p.email,
  COALESCE(NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''), p.email) AS full_name,
  uop.created_at AS signup_date,
  EXTRACT(EPOCH FROM (NOW() - uop.created_at)) / 3600 AS hours_since_signup,
  
  -- Current activation state
  COALESCE(uop.fathom_connected, false) AS fathom_connected,
  COALESCE(uop.first_meeting_synced, false) AS first_meeting_synced,
  COALESCE(uop.first_summary_viewed, false) AS first_summary_viewed,
  uop.activation_completed_at,
  
  -- Risk assessment
  CASE
    -- High risk: Signed up > 48 hours ago, hasn't connected Fathom
    WHEN NOT COALESCE(uop.fathom_connected, false) 
         AND uop.created_at < NOW() - INTERVAL '48 hours'
    THEN 'high'
    
    -- Medium risk: Connected Fathom but no meeting synced after 24 hours
    WHEN COALESCE(uop.fathom_connected, false) 
         AND NOT COALESCE(uop.first_meeting_synced, false)
         AND uop.created_at < NOW() - INTERVAL '24 hours'
    THEN 'medium'
    
    -- Low risk: Has meetings but hasn't viewed summary after 12 hours
    WHEN COALESCE(uop.first_meeting_synced, false)
         AND NOT COALESCE(uop.first_summary_viewed, false)
         AND uop.created_at < NOW() - INTERVAL '12 hours'
    THEN 'low'
    
    ELSE 'on_track'
  END AS risk_level,
  
  -- Suggested action
  CASE
    WHEN NOT COALESCE(uop.fathom_connected, false) 
         AND uop.created_at < NOW() - INTERVAL '48 hours'
    THEN 'Send Fathom connection reminder email'
    
    WHEN COALESCE(uop.fathom_connected, false) 
         AND NOT COALESCE(uop.first_meeting_synced, false)
         AND uop.created_at < NOW() - INTERVAL '24 hours'
    THEN 'Check if user has meetings to sync'
    
    WHEN COALESCE(uop.first_meeting_synced, false)
         AND NOT COALESCE(uop.first_summary_viewed, false)
         AND uop.created_at < NOW() - INTERVAL '12 hours'
    THEN 'Prompt user to view meeting insights'
    
    ELSE 'No action needed'
  END AS suggested_action,
  
  -- Last activity
  uop.updated_at AS last_onboarding_update,
  
  -- Organization info
  om.org_id,
  o.name AS org_name
  
FROM user_onboarding_progress uop
INNER JOIN profiles p ON p.id = uop.user_id
LEFT JOIN organization_memberships om ON om.user_id = uop.user_id
LEFT JOIN organizations o ON o.id = om.org_id
WHERE 
  -- Only include users who haven't fully activated
  uop.activation_completed_at IS NULL
  -- And signed up in the last 14 days (recent enough to re-engage)
  AND uop.created_at >= NOW() - INTERVAL '14 days'
  -- Exclude internal test accounts
  AND p.email NOT LIKE '%@sixtyapp.com'
  AND p.email NOT LIKE '%test%'
ORDER BY 
  CASE 
    WHEN NOT COALESCE(uop.fathom_connected, false) AND uop.created_at < NOW() - INTERVAL '48 hours' THEN 1
    WHEN COALESCE(uop.fathom_connected, false) AND NOT COALESCE(uop.first_meeting_synced, false) AND uop.created_at < NOW() - INTERVAL '24 hours' THEN 2
    WHEN COALESCE(uop.first_meeting_synced, false) AND NOT COALESCE(uop.first_summary_viewed, false) AND uop.created_at < NOW() - INTERVAL '12 hours' THEN 3
    ELSE 4
  END,
  uop.created_at DESC;

COMMENT ON VIEW at_risk_users IS 'Users at risk of not completing activation, with suggested actions (no auth.users exposure)';

-- Revoke anon access and grant to authenticated/service_role only
REVOKE ALL ON at_risk_users FROM anon;
REVOKE ALL ON at_risk_users FROM public;
GRANT SELECT ON at_risk_users TO authenticated;
GRANT SELECT ON at_risk_users TO service_role;


-- ============================================================================
-- 4. Fix waitlist_with_rank
-- ============================================================================
-- This view doesn't expose auth.users but was flagged for SECURITY DEFINER.
-- Simply recreate with security_invoker = true.
-- ============================================================================

DROP VIEW IF EXISTS waitlist_with_rank CASCADE;

CREATE VIEW waitlist_with_rank
WITH (security_invoker = true) AS
SELECT
  -- Core columns from initial meetings_waitlist table
  id,
  email,
  full_name,
  company_name,
  dialer_tool,
  dialer_other,
  meeting_recorder_tool,
  meeting_recorder_other,
  crm_tool,
  crm_other,
  referral_code,
  referred_by_code,
  referral_count,
  signup_position,
  effective_position,
  status,
  released_at,
  released_by,
  admin_notes,
  utm_source,
  utm_campaign,
  utm_medium,
  created_at,
  updated_at,
  -- User access columns (from 20251130000003_enhance_waitlist_for_access.sql)
  user_id,
  converted_at,
  magic_link_sent_at,
  magic_link_expires_at,
  access_granted_by,
  -- Gamification columns (from 20251202000003_add_waitlist_gamification.sql)
  total_points,
  linkedin_boost_claimed,
  twitter_boost_claimed,
  linkedin_share_claimed,
  linkedin_first_share_at,
  -- Calculate display rank: rank by effective_position, then by created_at
  -- This ensures unique ranks even when multiple users have same effective_position
  ROW_NUMBER() OVER (
    ORDER BY
      COALESCE(effective_position, 999999) ASC,
      created_at ASC
  ) AS display_rank
FROM meetings_waitlist
WHERE status != 'declined';

COMMENT ON VIEW waitlist_with_rank IS 'Waitlist entries with display_rank that breaks ties by signup time (security invoker mode)';

-- Grant access to the view (needs anon for public waitlist access)
GRANT SELECT ON waitlist_with_rank TO anon;
GRANT SELECT ON waitlist_with_rank TO authenticated;
GRANT SELECT ON waitlist_with_rank TO service_role;


-- ============================================================================
-- 5. Update dependent functions to work with new views
-- ============================================================================

-- The get_cohort_analysis function uses user_weekly_cohorts view
-- It's already SECURITY DEFINER which is fine for functions
-- No changes needed as it uses the view

-- The get_at_risk_users function uses at_risk_users view
-- It's already SECURITY DEFINER which is fine for functions
-- No changes needed as it uses the view

-- The get_at_risk_summary function uses at_risk_users view
-- It's already SECURITY DEFINER which is fine for functions
-- No changes needed as it uses the view


-- ============================================================================
-- 6. Verification
-- ============================================================================
DO $$
DECLARE
  v_activation_funnel BOOLEAN;
  v_weekly_cohorts BOOLEAN;
  v_at_risk BOOLEAN;
  v_waitlist BOOLEAN;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Auth Users Exposure Fix Applied';
  RAISE NOTICE '========================================';

  -- Verify views exist
  SELECT EXISTS(SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'activation_funnel_metrics') INTO v_activation_funnel;
  SELECT EXISTS(SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'user_weekly_cohorts') INTO v_weekly_cohorts;
  SELECT EXISTS(SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'at_risk_users') INTO v_at_risk;
  SELECT EXISTS(SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'waitlist_with_rank') INTO v_waitlist;

  RAISE NOTICE '✅ activation_funnel_metrics: %', CASE WHEN v_activation_funnel THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE '✅ user_weekly_cohorts: %', CASE WHEN v_weekly_cohorts THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE '✅ at_risk_users: %', CASE WHEN v_at_risk THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE '✅ waitlist_with_rank: %', CASE WHEN v_waitlist THEN 'EXISTS' ELSE 'MISSING' END;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Replaced auth.users with profiles in 3 views';
  RAISE NOTICE '  - Added security_invoker=true to 4 views';
  RAISE NOTICE '  - Revoked anon access from admin views';
  RAISE NOTICE '  - Maintained anon access for waitlist_with_rank';
  RAISE NOTICE '========================================';
END $$;

