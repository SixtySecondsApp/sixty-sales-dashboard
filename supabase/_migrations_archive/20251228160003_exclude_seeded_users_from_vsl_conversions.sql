-- Exclude seeded/test users from VSL conversion tracking

DROP VIEW IF EXISTS public.vsl_analytics_summary;

CREATE OR REPLACE VIEW public.vsl_analytics_summary AS
WITH session_watch_times AS (
  SELECT
    session_id,
    signup_source,
    video_public_id,
    DATE(created_at) as event_date,
    MAX(watch_time) as max_watch_time,
    MAX(progress_percent) as max_progress
  FROM public.vsl_video_analytics
  WHERE event_type IN ('pause', 'ended', 'progress')
    AND watch_time IS NOT NULL
    AND watch_time > 0
  GROUP BY session_id, signup_source, video_public_id, DATE(created_at)
),
-- Derive signup_source from registration_url, excluding seeded users
waitlist_with_source AS (
  SELECT
    id,
    created_at,
    COALESCE(
      signup_source,
      CASE
        WHEN registration_url LIKE '%/intro%' AND registration_url NOT LIKE '%/introducing%' AND registration_url NOT LIKE '%/introduction%' THEN 'intro-vsl'
        WHEN registration_url LIKE '%/introducing%' THEN 'introducing-vsl'
        WHEN registration_url LIKE '%/introduction%' THEN 'introduction-vsl'
        ELSE NULL
      END
    ) as effective_signup_source
  FROM public.meetings_waitlist
  WHERE is_seeded IS NOT TRUE  -- Exclude seeded/test users
),
total_conversions AS (
  SELECT
    effective_signup_source as signup_source,
    COUNT(*) as total_conversion_count
  FROM waitlist_with_source
  WHERE effective_signup_source IS NOT NULL
  GROUP BY effective_signup_source
),
daily_conversions AS (
  SELECT
    effective_signup_source as signup_source,
    DATE(created_at) as conversion_date,
    COUNT(*) as conversion_count
  FROM waitlist_with_source
  WHERE effective_signup_source IS NOT NULL
  GROUP BY effective_signup_source, DATE(created_at)
),
watch_time_stats AS (
  SELECT
    signup_source,
    video_public_id,
    event_date,
    AVG(max_watch_time) as avg_watch_time,
    AVG(max_progress) as avg_completion_percent
  FROM session_watch_times
  GROUP BY signup_source, video_public_id, event_date
),
video_daily_stats AS (
  SELECT
    v.signup_source,
    v.video_public_id,
    DATE(v.created_at) as event_date,
    COUNT(DISTINCT v.session_id) FILTER (WHERE v.event_type = 'view') as unique_views,
    COUNT(*) FILTER (WHERE v.event_type = 'view') as total_views,
    COUNT(DISTINCT v.session_id) FILTER (WHERE v.event_type = 'play') as unique_plays,
    COUNT(*) FILTER (WHERE v.event_type = 'play') as total_plays,
    COUNT(DISTINCT v.session_id) FILTER (WHERE v.event_type = 'ended') as completions,
    COUNT(DISTINCT v.session_id) FILTER (WHERE v.event_type = 'progress' AND v.progress_percent >= 25) as reached_25,
    COUNT(DISTINCT v.session_id) FILTER (WHERE v.event_type = 'progress' AND v.progress_percent >= 50) as reached_50,
    COUNT(DISTINCT v.session_id) FILTER (WHERE v.event_type = 'progress' AND v.progress_percent >= 75) as reached_75
  FROM public.vsl_video_analytics v
  GROUP BY v.signup_source, v.video_public_id, DATE(v.created_at)
)
SELECT
  vds.signup_source,
  vds.video_public_id,
  vds.event_date as date,
  vds.unique_views,
  vds.total_views,
  vds.unique_plays,
  vds.total_plays,
  vds.completions,
  vds.reached_25,
  vds.reached_50,
  vds.reached_75,
  wts.avg_watch_time,
  wts.avg_completion_percent,
  COALESCE(dc.conversion_count, 0) as daily_conversions,
  COALESCE(tc.total_conversion_count, 0) as conversions
FROM video_daily_stats vds
LEFT JOIN watch_time_stats wts
  ON wts.signup_source = vds.signup_source
  AND wts.video_public_id = vds.video_public_id
  AND wts.event_date = vds.event_date
LEFT JOIN daily_conversions dc
  ON dc.signup_source = vds.signup_source
  AND dc.conversion_date = vds.event_date
LEFT JOIN total_conversions tc
  ON tc.signup_source = vds.signup_source;

COMMENT ON VIEW public.vsl_analytics_summary IS
  'VSL analytics excluding seeded users from conversion counts.';
