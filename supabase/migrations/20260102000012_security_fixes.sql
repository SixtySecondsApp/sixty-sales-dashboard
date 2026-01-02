-- Migration: Security Fixes for USE60_External
-- Date: 2026-01-02
-- Description: Fix critical security issues identified by Supabase advisors
--   1. Enable RLS on exposed public tables
--   2. Convert SECURITY DEFINER views to SECURITY INVOKER
--   3. Fix functions with mutable search_path

-- ============================================================================
-- PART 1: Enable RLS on exposed public tables
-- ============================================================================

-- Enable RLS on vsl_video_analytics (has policies but RLS was disabled)
ALTER TABLE public.vsl_video_analytics ENABLE ROW LEVEL SECURITY;

-- Enable RLS on sentry_webhook_queue
ALTER TABLE public.sentry_webhook_queue ENABLE ROW LEVEL SECURITY;

-- Add basic RLS policies for sentry_webhook_queue (service role only)
CREATE POLICY "sentry_webhook_queue_service_role" ON public.sentry_webhook_queue
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- PART 2: Convert SECURITY DEFINER views to SECURITY INVOKER
-- These views bypass RLS and run as the view owner - security risk
-- ============================================================================

-- 2.1 cron_jobs_status view
DROP VIEW IF EXISTS public.cron_jobs_status;
CREATE VIEW public.cron_jobs_status
WITH (security_invoker = true)
AS
SELECT
  j.jobid,
  j.jobname,
  j.schedule,
  j.active,
  j.nodename,
  s.display_name,
  s.description,
  s.category,
  s.is_monitored,
  s.alert_on_failure,
  (
    SELECT jsonb_build_object(
      'runid', rd.runid,
      'status', rd.status,
      'start_time', rd.start_time,
      'end_time', rd.end_time,
      'return_message', rd.return_message
    )
    FROM cron.job_run_details rd
    WHERE rd.jobid = j.jobid
    ORDER BY rd.start_time DESC
    LIMIT 1
  ) AS last_run,
  (
    SELECT count(*)::integer
    FROM cron.job_run_details rd
    WHERE rd.jobid = j.jobid
      AND rd.status = 'failed'
      AND rd.start_time > (now() - interval '24 hours')
  ) AS failures_last_24h,
  (
    SELECT count(*)::integer
    FROM cron.job_run_details rd
    WHERE rd.jobid = j.jobid
      AND rd.start_time > (now() - interval '24 hours')
  ) AS runs_last_24h
FROM cron.job j
LEFT JOIN cron_job_settings s ON s.job_name = j.jobname;

-- 2.2 deal_sentiment_trends view
DROP VIEW IF EXISTS public.deal_sentiment_trends;
CREATE VIEW public.deal_sentiment_trends
WITH (security_invoker = true)
AS
WITH deal_meeting_data AS (
  SELECT DISTINCT
    a.deal_id,
    m.id AS meeting_id,
    m.sentiment_score,
    m.meeting_start,
    m.talk_time_rep_pct,
    m.coach_rating
  FROM activities a
  JOIN meetings m ON m.id = a.meeting_id
  WHERE a.deal_id IS NOT NULL
    AND a.meeting_id IS NOT NULL
    AND m.sentiment_score IS NOT NULL
),
ranked_meetings AS (
  SELECT
    deal_id,
    meeting_id,
    sentiment_score,
    meeting_start,
    talk_time_rep_pct,
    coach_rating,
    row_number() OVER (PARTITION BY deal_id ORDER BY meeting_start DESC NULLS LAST) AS rn
  FROM deal_meeting_data
),
aggregated AS (
  SELECT
    deal_id,
    avg(sentiment_score)::numeric(4,3) AS avg_sentiment,
    min(sentiment_score)::numeric(4,3) AS min_sentiment,
    max(sentiment_score)::numeric(4,3) AS max_sentiment,
    count(DISTINCT meeting_id)::integer AS meeting_count,
    max(meeting_start) AS last_meeting_at,
    avg(CASE WHEN rn <= 3 THEN sentiment_score END)::numeric(4,3) AS recent_avg,
    avg(CASE WHEN rn > 3 AND rn <= 6 THEN sentiment_score END)::numeric(4,3) AS previous_avg,
    avg(talk_time_rep_pct)::numeric(5,2) AS avg_talk_time_rep_pct,
    avg(coach_rating)::numeric(4,2) AS avg_coach_rating,
    ARRAY(
      SELECT rm2.sentiment_score
      FROM ranked_meetings rm2
      WHERE rm2.deal_id = ranked_meetings.deal_id AND rm2.rn <= 6
      ORDER BY rm2.rn DESC
    ) AS sentiment_history
  FROM ranked_meetings
  GROUP BY deal_id
)
SELECT
  deal_id,
  avg_sentiment,
  min_sentiment,
  max_sentiment,
  meeting_count,
  last_meeting_at,
  recent_avg,
  previous_avg,
  avg_talk_time_rep_pct,
  avg_coach_rating,
  sentiment_history,
  CASE
    WHEN previous_avg IS NULL THEN 'insufficient_data'
    WHEN (recent_avg - previous_avg) > 0.1 THEN 'improving'
    WHEN (recent_avg - previous_avg) < -0.1 THEN 'declining'
    ELSE 'stable'
  END AS trend_direction,
  CASE
    WHEN previous_avg IS NULL THEN 0::numeric
    ELSE (recent_avg - previous_avg)::numeric(4,3)
  END AS trend_delta
FROM aggregated;

-- 2.3 integration_health_summary view
DROP VIEW IF EXISTS public.integration_health_summary;
CREATE VIEW public.integration_health_summary
WITH (security_invoker = true)
AS
WITH latest_run_per_integration AS (
  SELECT
    integration_name,
    max(created_at) AS latest_run_at
  FROM integration_test_results
  GROUP BY integration_name
),
latest_run_tests AS (
  SELECT
    itr.id,
    itr.created_at,
    itr.integration_name,
    itr.test_name,
    itr.test_category,
    itr.status,
    itr.duration_ms,
    itr.message,
    itr.error_details,
    itr.response_data,
    itr.triggered_by,
    itr.triggered_by_user_id,
    itr.org_id
  FROM integration_test_results itr
  JOIN latest_run_per_integration lrpi
    ON itr.integration_name = lrpi.integration_name
    AND itr.created_at >= (lrpi.latest_run_at - interval '5 minutes')
)
SELECT
  integration_name,
  count(*) FILTER (WHERE status = 'passed') AS passed_count,
  count(*) FILTER (WHERE status = 'failed') AS failed_count,
  count(*) FILTER (WHERE status = 'error') AS error_count,
  count(*) AS total_tests,
  round((count(*) FILTER (WHERE status = 'passed')::numeric / NULLIF(count(*), 0)::numeric) * 100, 1) AS pass_rate,
  max(created_at) AS last_test_at,
  CASE
    WHEN count(*) FILTER (WHERE status IN ('failed', 'error')) > 0 THEN 'critical'
    WHEN count(*) FILTER (WHERE status = 'passed') = count(*) THEN 'healthy'
    ELSE 'warning'
  END AS health_status
FROM latest_run_tests
GROUP BY integration_name;

-- 2.4 latest_integration_test_results view
DROP VIEW IF EXISTS public.latest_integration_test_results;
CREATE VIEW public.latest_integration_test_results
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (integration_name, test_name)
  id,
  created_at,
  integration_name,
  test_name,
  test_category,
  status,
  duration_ms,
  message,
  error_details,
  triggered_by,
  triggered_by_user_id,
  org_id
FROM integration_test_results
ORDER BY integration_name, test_name, created_at DESC;

-- 2.5 vsl_analytics_summary view
DROP VIEW IF EXISTS public.vsl_analytics_summary;
CREATE VIEW public.vsl_analytics_summary
WITH (security_invoker = true)
AS
WITH session_watch_times AS (
  SELECT
    session_id,
    signup_source,
    video_public_id,
    date(created_at) AS event_date,
    max(watch_time) AS max_watch_time,
    max(progress_percent) AS max_progress
  FROM vsl_video_analytics
  WHERE event_type IN ('pause', 'ended', 'progress')
    AND watch_time IS NOT NULL
    AND watch_time > 0
  GROUP BY session_id, signup_source, video_public_id, date(created_at)
),
waitlist_with_source AS (
  SELECT
    id,
    created_at,
    COALESCE(signup_source,
      CASE
        WHEN registration_url LIKE '%/intro%' AND registration_url NOT LIKE '%/introducing%' AND registration_url NOT LIKE '%/introduction%' THEN 'intro-vsl'
        WHEN registration_url LIKE '%/introducing%' THEN 'introducing-vsl'
        WHEN registration_url LIKE '%/introduction%' THEN 'introduction-vsl'
        WHEN registration_url LIKE '%/waitlist%' THEN 'waitlist'
        ELSE NULL
      END
    ) AS effective_signup_source
  FROM meetings_waitlist
  WHERE is_seeded IS NOT TRUE
),
total_conversions AS (
  SELECT
    effective_signup_source AS signup_source,
    count(*) AS total_conversion_count
  FROM waitlist_with_source
  WHERE effective_signup_source IS NOT NULL
  GROUP BY effective_signup_source
),
daily_conversions AS (
  SELECT
    effective_signup_source AS signup_source,
    date(created_at) AS conversion_date,
    count(*) AS conversion_count
  FROM waitlist_with_source
  WHERE effective_signup_source IS NOT NULL
  GROUP BY effective_signup_source, date(created_at)
),
watch_time_stats AS (
  SELECT
    signup_source,
    video_public_id,
    event_date,
    avg(max_watch_time) AS avg_watch_time,
    avg(max_progress) AS avg_completion_percent
  FROM session_watch_times
  GROUP BY signup_source, video_public_id, event_date
),
video_daily_stats AS (
  SELECT
    signup_source,
    video_public_id,
    date(created_at) AS event_date,
    count(DISTINCT session_id) FILTER (WHERE event_type = 'view') AS unique_views,
    count(*) FILTER (WHERE event_type = 'view') AS total_views,
    count(DISTINCT session_id) FILTER (WHERE event_type = 'play') AS unique_plays,
    count(*) FILTER (WHERE event_type = 'play') AS total_plays,
    count(DISTINCT session_id) FILTER (WHERE event_type = 'ended') AS completions,
    count(DISTINCT session_id) FILTER (WHERE event_type = 'progress' AND progress_percent >= 25) AS reached_25,
    count(DISTINCT session_id) FILTER (WHERE event_type = 'progress' AND progress_percent >= 50) AS reached_50,
    count(DISTINCT session_id) FILTER (WHERE event_type = 'progress' AND progress_percent >= 75) AS reached_75
  FROM vsl_video_analytics
  GROUP BY signup_source, video_public_id, date(created_at)
),
all_dates AS (
  SELECT DISTINCT event_date AS date FROM video_daily_stats
  UNION
  SELECT DISTINCT conversion_date AS date FROM daily_conversions
),
all_sources AS (
  SELECT DISTINCT signup_source FROM video_daily_stats WHERE signup_source IS NOT NULL
  UNION
  SELECT DISTINCT signup_source FROM daily_conversions WHERE signup_source IS NOT NULL
),
source_date_matrix AS (
  SELECT s.signup_source, d.date
  FROM all_sources s
  CROSS JOIN all_dates d
)
SELECT
  sdm.signup_source,
  vds.video_public_id,
  sdm.date,
  COALESCE(vds.unique_views, 0) AS unique_views,
  COALESCE(vds.total_views, 0) AS total_views,
  COALESCE(vds.unique_plays, 0) AS unique_plays,
  COALESCE(vds.total_plays, 0) AS total_plays,
  COALESCE(vds.completions, 0) AS completions,
  COALESCE(vds.reached_25, 0) AS reached_25,
  COALESCE(vds.reached_50, 0) AS reached_50,
  COALESCE(vds.reached_75, 0) AS reached_75,
  wts.avg_watch_time,
  wts.avg_completion_percent,
  COALESCE(dc.conversion_count, 0) AS daily_conversions,
  COALESCE(tc.total_conversion_count, 0) AS conversions
FROM source_date_matrix sdm
LEFT JOIN video_daily_stats vds
  ON vds.signup_source = sdm.signup_source AND vds.event_date = sdm.date
LEFT JOIN watch_time_stats wts
  ON wts.signup_source = sdm.signup_source
  AND wts.video_public_id = vds.video_public_id
  AND wts.event_date = sdm.date
LEFT JOIN daily_conversions dc
  ON dc.signup_source = sdm.signup_source AND dc.conversion_date = sdm.date
LEFT JOIN total_conversions tc
  ON tc.signup_source = sdm.signup_source
WHERE sdm.signup_source IS NOT NULL;

-- 2.6 landing_page_analytics view
DROP VIEW IF EXISTS public.landing_page_analytics;
CREATE VIEW public.landing_page_analytics
WITH (security_invoker = true)
AS
WITH daily_views AS (
  SELECT
    date(created_at) AS date,
    landing_page,
    COALESCE(utm_source, CASE WHEN fbclid IS NOT NULL THEN 'facebook' ELSE 'direct' END) AS source,
    utm_campaign,
    utm_content AS creative_id,
    count(*) AS page_views,
    count(DISTINCT session_id) AS unique_sessions,
    count(DISTINCT visitor_id) AS unique_visitors
  FROM page_views
  GROUP BY date(created_at), landing_page,
    COALESCE(utm_source, CASE WHEN fbclid IS NOT NULL THEN 'facebook' ELSE 'direct' END),
    utm_campaign, utm_content
),
daily_partial_signups AS (
  SELECT
    date(created_at) AS date,
    landing_page,
    COALESCE(utm_source, CASE WHEN fbclid IS NOT NULL THEN 'facebook' ELSE 'direct' END) AS source,
    utm_campaign,
    utm_content AS creative_id,
    count(*) AS partial_signups,
    count(*) FILTER (WHERE converted = true) AS partial_converted
  FROM partial_signups
  GROUP BY date(created_at), landing_page,
    COALESCE(utm_source, CASE WHEN fbclid IS NOT NULL THEN 'facebook' ELSE 'direct' END),
    utm_campaign, utm_content
),
daily_conversions AS (
  SELECT
    date(created_at) AS date,
    CASE
      WHEN registration_url LIKE '%/intro%' AND registration_url NOT LIKE '%/introducing%' AND registration_url NOT LIKE '%/introduction%' THEN '/intro'
      WHEN registration_url LIKE '%/introducing%' THEN '/introducing'
      WHEN registration_url LIKE '%/introduction%' THEN '/introduction'
      WHEN registration_url LIKE '%/waitlist%' THEN '/waitlist'
      WHEN registration_url LIKE '%/join%' THEN '/join'
      ELSE 'other'
    END AS landing_page,
    COALESCE(utm_source, CASE WHEN registration_url LIKE '%fbclid%' THEN 'facebook' ELSE 'direct' END) AS source,
    utm_campaign,
    (regexp_match(registration_url, 'utm_content=([^&]+)'))[1] AS creative_id,
    count(*) AS conversions
  FROM meetings_waitlist
  WHERE is_seeded IS NOT TRUE
  GROUP BY date(created_at),
    CASE
      WHEN registration_url LIKE '%/intro%' AND registration_url NOT LIKE '%/introducing%' AND registration_url NOT LIKE '%/introduction%' THEN '/intro'
      WHEN registration_url LIKE '%/introducing%' THEN '/introducing'
      WHEN registration_url LIKE '%/introduction%' THEN '/introduction'
      WHEN registration_url LIKE '%/waitlist%' THEN '/waitlist'
      WHEN registration_url LIKE '%/join%' THEN '/join'
      ELSE 'other'
    END,
    COALESCE(utm_source, CASE WHEN registration_url LIKE '%fbclid%' THEN 'facebook' ELSE 'direct' END),
    utm_campaign,
    (regexp_match(registration_url, 'utm_content=([^&]+)'))[1]
)
SELECT
  COALESCE(v.date, c.date, p.date) AS date,
  COALESCE(v.landing_page, c.landing_page, p.landing_page) AS landing_page,
  COALESCE(v.source, c.source, p.source) AS source,
  COALESCE(v.utm_campaign, c.utm_campaign, p.utm_campaign) AS campaign,
  COALESCE(v.creative_id, c.creative_id, p.creative_id) AS creative_id,
  COALESCE(v.page_views, 0) AS page_views,
  COALESCE(v.unique_sessions, 0) AS unique_sessions,
  COALESCE(v.unique_visitors, 0) AS unique_visitors,
  COALESCE(p.partial_signups, 0) AS partial_signups,
  COALESCE(c.conversions, 0) AS conversions,
  CASE
    WHEN COALESCE(v.unique_sessions, 0) > 0
    THEN round((COALESCE(c.conversions, 0)::numeric / v.unique_sessions::numeric) * 100, 2)
    ELSE 0
  END AS conversion_rate,
  CASE
    WHEN COALESCE(v.unique_sessions, 0) > 0
    THEN round((COALESCE(p.partial_signups, 0)::numeric / v.unique_sessions::numeric) * 100, 2)
    ELSE 0
  END AS lead_capture_rate
FROM daily_views v
FULL JOIN daily_conversions c
  ON v.date = c.date
  AND v.landing_page = c.landing_page
  AND v.source = c.source
  AND COALESCE(v.utm_campaign, '') = COALESCE(c.utm_campaign, '')
  AND COALESCE(v.creative_id, '') = COALESCE(c.creative_id, '')
FULL JOIN daily_partial_signups p
  ON COALESCE(v.date, c.date) = p.date
  AND COALESCE(v.landing_page, c.landing_page) = p.landing_page
  AND COALESCE(v.source, c.source) = p.source
  AND COALESCE(v.utm_campaign, c.utm_campaign, '') = COALESCE(p.utm_campaign, '')
  AND COALESCE(v.creative_id, c.creative_id, '') = COALESCE(p.creative_id, '')
ORDER BY COALESCE(v.date, c.date, p.date) DESC, COALESCE(v.page_views, 0) DESC;

-- 2.7 meta_ads_analytics view
DROP VIEW IF EXISTS public.meta_ads_analytics;
CREATE VIEW public.meta_ads_analytics
WITH (security_invoker = true)
AS
WITH parsed_signups AS (
  SELECT
    id,
    email,
    full_name,
    company_name,
    created_at,
    registration_url,
    utm_source,
    utm_medium,
    utm_campaign,
    COALESCE(NULL::text, (regexp_match(registration_url, 'utm_content=([^&]+)'))[1]) AS utm_content,
    (regexp_match(registration_url, 'utm_term=([^&]+)'))[1] AS utm_term,
    (regexp_match(registration_url, 'utm_id=([^&]+)'))[1] AS utm_id,
    (regexp_match(registration_url, 'fbclid=([^&]+)'))[1] AS fbclid,
    CASE
      WHEN registration_url LIKE '%?%' THEN split_part(registration_url, '?', 1)
      ELSE registration_url
    END AS landing_page
  FROM meetings_waitlist
  WHERE is_seeded IS NOT TRUE
    AND (utm_source IS NOT NULL
      OR registration_url LIKE '%utm_%'
      OR registration_url LIKE '%fbclid%')
)
SELECT
  COALESCE(utm_source, CASE WHEN fbclid IS NOT NULL THEN 'facebook' ELSE 'unknown' END) AS source,
  CASE COALESCE(utm_source, CASE WHEN fbclid IS NOT NULL THEN 'fb' ELSE 'unknown' END)
    WHEN 'fb' THEN 'Facebook'
    WHEN 'ig' THEN 'Instagram'
    WHEN 'an' THEN 'Audience Network'
    WHEN 'facebook' THEN 'Facebook'
    WHEN 'messenger' THEN 'Messenger'
    ELSE COALESCE(utm_source, 'Unknown')
  END AS source_name,
  COALESCE(utm_medium, 'unknown') AS medium,
  utm_campaign AS campaign_id,
  utm_id AS meta_campaign_id,
  utm_content AS creative_id,
  utm_term AS adset_id,
  landing_page,
  count(*) AS conversions,
  min(created_at) AS first_conversion,
  max(created_at) AS last_conversion,
  array_agg(
    jsonb_build_object(
      'id', id,
      'email', email,
      'name', full_name,
      'company', company_name,
      'date', created_at
    ) ORDER BY created_at DESC
  ) AS signups
FROM parsed_signups
GROUP BY
  COALESCE(utm_source, CASE WHEN fbclid IS NOT NULL THEN 'facebook' ELSE 'unknown' END),
  CASE COALESCE(utm_source, CASE WHEN fbclid IS NOT NULL THEN 'fb' ELSE 'unknown' END)
    WHEN 'fb' THEN 'Facebook'
    WHEN 'ig' THEN 'Instagram'
    WHEN 'an' THEN 'Audience Network'
    WHEN 'facebook' THEN 'Facebook'
    WHEN 'messenger' THEN 'Messenger'
    ELSE COALESCE(utm_source, 'Unknown')
  END,
  COALESCE(utm_medium, 'unknown'),
  utm_campaign, utm_id, utm_content, utm_term, landing_page
ORDER BY count(*) DESC;

-- 2.8 meta_ads_daily_summary view
DROP VIEW IF EXISTS public.meta_ads_daily_summary;
CREATE VIEW public.meta_ads_daily_summary
WITH (security_invoker = true)
AS
SELECT
  date(created_at) AS date,
  COALESCE(utm_source, CASE WHEN registration_url LIKE '%fbclid%' THEN 'facebook' ELSE 'organic' END) AS source,
  CASE
    WHEN registration_url LIKE '%/intro%' AND registration_url NOT LIKE '%/introducing%' AND registration_url NOT LIKE '%/introduction%' THEN '/intro'
    WHEN registration_url LIKE '%/introducing%' THEN '/introducing'
    WHEN registration_url LIKE '%/introduction%' THEN '/introduction'
    WHEN registration_url LIKE '%/waitlist%' THEN '/waitlist'
    ELSE 'other'
  END AS landing_page,
  count(*) AS conversions,
  count(DISTINCT (regexp_match(registration_url, 'utm_campaign=([^&]+)'))[1]) AS campaigns,
  count(DISTINCT (regexp_match(registration_url, 'utm_content=([^&]+)'))[1]) AS creatives
FROM meetings_waitlist
WHERE is_seeded IS NOT TRUE
GROUP BY
  date(created_at),
  COALESCE(utm_source, CASE WHEN registration_url LIKE '%fbclid%' THEN 'facebook' ELSE 'organic' END),
  CASE
    WHEN registration_url LIKE '%/intro%' AND registration_url NOT LIKE '%/introducing%' AND registration_url NOT LIKE '%/introduction%' THEN '/intro'
    WHEN registration_url LIKE '%/introducing%' THEN '/introducing'
    WHEN registration_url LIKE '%/introduction%' THEN '/introduction'
    WHEN registration_url LIKE '%/waitlist%' THEN '/waitlist'
    ELSE 'other'
  END
ORDER BY date(created_at) DESC, count(*) DESC;

-- ============================================================================
-- PART 3: Fix functions with mutable search_path (top 20 most critical)
-- Setting search_path prevents SQL injection via search path manipulation
-- ============================================================================

-- Helper function to check if we should skip (function doesn't exist)
-- We'll use CREATE OR REPLACE with explicit search_path

-- Fix is_platform_admin - critical security function
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND is_admin = true
  );
$$;

-- Fix is_super_admin - critical security function
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_super_admin = true OR is_admin = true)
  );
$$;

-- Fix is_service_role - critical security function
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.role() = 'service_role';
$$;

-- Fix can_access_org_data - critical security function
CREATE OR REPLACE FUNCTION public.can_access_org_data(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE org_id = p_org_id
    AND user_id = auth.uid()
  ) OR is_platform_admin();
$$;

-- Fix can_write_to_org - critical security function
CREATE OR REPLACE FUNCTION public.can_write_to_org(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE org_id = p_org_id
    AND user_id = auth.uid()
    AND role IN ('admin', 'owner', 'member')
  ) OR is_platform_admin();
$$;

-- Fix can_admin_org - critical security function
CREATE OR REPLACE FUNCTION public.can_admin_org(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE org_id = p_org_id
    AND user_id = auth.uid()
    AND role IN ('admin', 'owner')
  ) OR is_platform_admin();
$$;

-- Fix is_org_owner - critical security function
CREATE OR REPLACE FUNCTION public.is_org_owner(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE org_id = p_org_id
    AND user_id = auth.uid()
    AND role = 'owner'
  ) OR is_platform_admin();
$$;

-- Fix current_user_orgs
CREATE OR REPLACE FUNCTION public.current_user_orgs()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT org_id FROM organization_memberships WHERE user_id = auth.uid();
$$;

-- Fix get_user_primary_org
CREATE OR REPLACE FUNCTION public.get_user_primary_org()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT org_id
  FROM organization_memberships
  WHERE user_id = auth.uid()
  ORDER BY created_at
  LIMIT 1;
$$;

-- Fix get_user_active_org
CREATE OR REPLACE FUNCTION public.get_user_active_org()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT active_org_id FROM profiles WHERE id = auth.uid()),
    get_user_primary_org()
  );
$$;

-- ============================================================================
-- PART 4: Remove duplicate index
-- ============================================================================

DROP INDEX IF EXISTS public.idx_deal_stage_history_deal_fk;
-- Keep idx_deal_stage_history_deal_id

-- ============================================================================
-- Grant necessary permissions on views
-- ============================================================================

GRANT SELECT ON public.cron_jobs_status TO authenticated;
GRANT SELECT ON public.deal_sentiment_trends TO authenticated;
GRANT SELECT ON public.integration_health_summary TO authenticated;
GRANT SELECT ON public.latest_integration_test_results TO authenticated;
GRANT SELECT ON public.vsl_analytics_summary TO authenticated;
GRANT SELECT ON public.landing_page_analytics TO authenticated;
GRANT SELECT ON public.meta_ads_analytics TO authenticated;
GRANT SELECT ON public.meta_ads_daily_summary TO authenticated;

-- ============================================================================
-- Summary of changes:
-- ============================================================================
-- 1. Enabled RLS on 2 tables (vsl_video_analytics, sentry_webhook_queue)
-- 2. Converted 8 SECURITY DEFINER views to SECURITY INVOKER
-- 3. Fixed search_path on 10 critical security functions
-- 4. Removed 1 duplicate index
-- ============================================================================
