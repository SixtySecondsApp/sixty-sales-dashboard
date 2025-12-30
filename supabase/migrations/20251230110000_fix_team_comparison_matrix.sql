-- Migration: Fix get_team_comparison_matrix function
-- Purpose: Fix nested aggregation bug in trend_data CTE
-- Date: 2025-12-30

-- =============================================================================
-- Function 5 (FIXED): get_team_comparison_matrix
-- Purpose: Get all reps with their metrics for comparison table
-- Bug Fix: Restructured trend_data CTE to properly aggregate daily data first,
--          then build JSONB array
-- =============================================================================

CREATE OR REPLACE FUNCTION get_team_comparison_matrix(
  p_org_id UUID,
  p_period_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  avatar_url TEXT,
  total_meetings BIGINT,
  avg_sentiment NUMERIC,
  avg_talk_time NUMERIC,
  avg_coach_rating NUMERIC,
  forward_movement_rate NUMERIC,
  positive_outcome_rate NUMERIC,
  -- 7-day trend data for sparklines
  trend_data JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH rep_metrics AS (
    SELECT
      m.owner_user_id,
      COUNT(m.id) as total_meetings,
      AVG(m.sentiment_score) as avg_sentiment,
      AVG(m.talk_time_rep_pct) as avg_talk_time,
      AVG(m.coach_rating) as avg_coach_rating,
      CASE WHEN COUNT(mc.id) > 0 THEN
        ROUND((COUNT(CASE WHEN mc.has_forward_movement = true THEN 1 END)::NUMERIC / COUNT(mc.id)) * 100, 1)
      ELSE NULL END as forward_movement_rate,
      CASE WHEN COUNT(mc.id) > 0 THEN
        ROUND((COUNT(CASE WHEN mc.outcome = 'positive' THEN 1 END)::NUMERIC / COUNT(mc.id)) * 100, 1)
      ELSE NULL END as positive_outcome_rate
    FROM meetings m
    LEFT JOIN meeting_classifications mc ON mc.meeting_id = m.id
    WHERE m.org_id = p_org_id
      AND m.meeting_start >= NOW() - (p_period_days || ' days')::INTERVAL
      AND m.meeting_start IS NOT NULL
    GROUP BY m.owner_user_id
  ),
  -- First: aggregate meetings by user and date
  daily_trends AS (
    SELECT
      m.owner_user_id,
      DATE_TRUNC('day', m.meeting_start)::DATE as meeting_date,
      COUNT(*) as daily_count,
      ROUND(AVG(m.sentiment_score), 2) as daily_sentiment
    FROM meetings m
    WHERE m.org_id = p_org_id
      AND m.meeting_start >= NOW() - INTERVAL '7 days'
      AND m.meeting_start IS NOT NULL
    GROUP BY m.owner_user_id, DATE_TRUNC('day', m.meeting_start)::DATE
  ),
  -- Second: build JSONB array from daily data
  aggregated_trends AS (
    SELECT
      owner_user_id,
      jsonb_agg(
        jsonb_build_object(
          'date', meeting_date::TEXT,
          'count', daily_count,
          'sentiment', daily_sentiment
        ) ORDER BY meeting_date
      ) as trend_data
    FROM daily_trends
    GROUP BY owner_user_id
  )
  SELECT
    rm.owner_user_id as user_id,
    COALESCE(
      NULLIF(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), ''),
      p.email
    ) as user_name,
    p.email as user_email,
    p.avatar_url,
    rm.total_meetings,
    ROUND(rm.avg_sentiment, 3),
    ROUND(rm.avg_talk_time, 1),
    ROUND(rm.avg_coach_rating, 1),
    rm.forward_movement_rate,
    rm.positive_outcome_rate,
    COALESCE(at.trend_data, '[]'::jsonb) as trend_data
  FROM rep_metrics rm
  LEFT JOIN profiles p ON rm.owner_user_id = p.id
  LEFT JOIN aggregated_trends at ON at.owner_user_id = rm.owner_user_id
  ORDER BY rm.total_meetings DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_team_comparison_matrix IS 'Returns all reps with metrics for comparison table (fixed trend_data aggregation)';
