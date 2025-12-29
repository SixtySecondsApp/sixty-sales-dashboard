-- Fix VSL Analytics: Track watch time from all session events (not just 'ended')
-- and add conversion tracking (waitlist signups per video variant)
-- Also tracks historic signups based on registration_url when signup_source is null

-- Drop existing view
DROP VIEW IF EXISTS public.vsl_analytics_summary;

-- Recreate view with improved watch time calculation and conversion tracking
CREATE OR REPLACE VIEW public.vsl_analytics_summary AS
WITH session_watch_times AS (
  -- Get the maximum watch_time per session from pause/ended/progress events
  -- This captures watch time even for users who don't finish the video
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
-- Derive signup_source from registration_url for historic records
waitlist_with_source AS (
  SELECT
    id,
    created_at,
    -- Use signup_source if available, otherwise derive from registration_url
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
),
-- Count TOTAL waitlist signups by variant (not by date - for overall conversion tracking)
total_conversions AS (
  SELECT
    effective_signup_source as signup_source,
    COUNT(*) as total_conversion_count
  FROM waitlist_with_source
  WHERE effective_signup_source IS NOT NULL
  GROUP BY effective_signup_source
),
-- Count daily waitlist signups by variant (for trend tracking)
daily_conversions AS (
  SELECT
    effective_signup_source as signup_source,
    DATE(created_at) as conversion_date,
    COUNT(*) as conversion_count
  FROM waitlist_with_source
  WHERE effective_signup_source IS NOT NULL
  GROUP BY effective_signup_source, DATE(created_at)
),
-- Pre-aggregate watch time stats by signup_source, video_public_id, and date
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
-- Main aggregation of video analytics
video_daily_stats AS (
  SELECT
    v.signup_source,
    v.video_public_id,
    DATE(v.created_at) as event_date,
    -- View & Play counts
    COUNT(DISTINCT v.session_id) FILTER (WHERE v.event_type = 'view') as unique_views,
    COUNT(*) FILTER (WHERE v.event_type = 'view') as total_views,
    COUNT(DISTINCT v.session_id) FILTER (WHERE v.event_type = 'play') as unique_plays,
    COUNT(*) FILTER (WHERE v.event_type = 'play') as total_plays,
    -- Completion tracking
    COUNT(DISTINCT v.session_id) FILTER (WHERE v.event_type = 'ended') as completions,
    -- Progress milestones
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
  -- FIXED: Average watch time from ALL sessions (not just completed)
  wts.avg_watch_time,
  wts.avg_completion_percent,
  -- Daily conversions for trend tracking (may be 0 if no conversions on that day)
  COALESCE(dc.conversion_count, 0) as daily_conversions,
  -- TOTAL conversions for this variant (same value across all dates for a variant)
  -- This ensures we always show the total even when daily doesn't match
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

-- Add helpful comment
COMMENT ON VIEW public.vsl_analytics_summary IS
  'Aggregated VSL video analytics with improved watch time tracking (from all session events) and conversion tracking (including historic signups derived from registration_url). Note: conversions column shows TOTAL conversions for the variant, daily_conversions shows per-day conversions.';
