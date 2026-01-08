-- Add /waitlist as a variant in VSL analytics
-- This allows tracking direct waitlist signups alongside VSL video variants

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
-- Derive signup_source from registration_url, now including /waitlist
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
        WHEN registration_url LIKE '%/waitlist%' THEN 'waitlist'
        ELSE NULL
      END
    ) as effective_signup_source
  FROM public.meetings_waitlist
  WHERE is_seeded IS NOT TRUE
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
),
-- Get all unique dates from both video analytics and conversions
all_dates AS (
  SELECT DISTINCT event_date as date FROM video_daily_stats
  UNION
  SELECT DISTINCT conversion_date as date FROM daily_conversions
),
-- Get all unique signup sources
all_sources AS (
  SELECT DISTINCT signup_source FROM video_daily_stats WHERE signup_source IS NOT NULL
  UNION
  SELECT DISTINCT signup_source FROM daily_conversions WHERE signup_source IS NOT NULL
),
-- Cross join to get all source/date combinations
source_date_matrix AS (
  SELECT s.signup_source, d.date
  FROM all_sources s
  CROSS JOIN all_dates d
)
-- Main query: video stats with conversions
SELECT
  sdm.signup_source,
  vds.video_public_id,
  sdm.date,
  COALESCE(vds.unique_views, 0) as unique_views,
  COALESCE(vds.total_views, 0) as total_views,
  COALESCE(vds.unique_plays, 0) as unique_plays,
  COALESCE(vds.total_plays, 0) as total_plays,
  COALESCE(vds.completions, 0) as completions,
  COALESCE(vds.reached_25, 0) as reached_25,
  COALESCE(vds.reached_50, 0) as reached_50,
  COALESCE(vds.reached_75, 0) as reached_75,
  wts.avg_watch_time,
  wts.avg_completion_percent,
  COALESCE(dc.conversion_count, 0) as daily_conversions,
  COALESCE(tc.total_conversion_count, 0) as conversions
FROM source_date_matrix sdm
LEFT JOIN video_daily_stats vds
  ON vds.signup_source = sdm.signup_source
  AND vds.event_date = sdm.date
LEFT JOIN watch_time_stats wts
  ON wts.signup_source = sdm.signup_source
  AND wts.video_public_id = vds.video_public_id
  AND wts.event_date = sdm.date
LEFT JOIN daily_conversions dc
  ON dc.signup_source = sdm.signup_source
  AND dc.conversion_date = sdm.date
LEFT JOIN total_conversions tc
  ON tc.signup_source = sdm.signup_source
WHERE sdm.signup_source IS NOT NULL;

COMMENT ON VIEW public.vsl_analytics_summary IS
  'VSL analytics including direct /waitlist signups as a variant. Excludes seeded users.';
