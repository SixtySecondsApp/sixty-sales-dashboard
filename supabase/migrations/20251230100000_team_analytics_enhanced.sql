-- Migration: Enhanced Team Analytics Functions
-- Purpose: Functions for time-series data, period comparisons, quality signals, and drill-down
-- Date: 2025-12-30

-- =============================================================================
-- Function 1: get_team_aggregates_with_comparison
-- Purpose: Get team aggregates with period-over-period comparison
-- =============================================================================

CREATE OR REPLACE FUNCTION get_team_aggregates_with_comparison(
  p_org_id UUID,
  p_period_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  -- Current period metrics
  current_total_meetings BIGINT,
  current_avg_sentiment NUMERIC,
  current_avg_talk_time NUMERIC,
  current_avg_coach_rating NUMERIC,
  current_positive_count BIGINT,
  current_negative_count BIGINT,
  current_total_duration NUMERIC,
  current_team_members BIGINT,
  current_forward_movement_count BIGINT,
  current_objection_count BIGINT,
  current_positive_outcome_count BIGINT,
  -- Previous period metrics
  previous_total_meetings BIGINT,
  previous_avg_sentiment NUMERIC,
  previous_avg_talk_time NUMERIC,
  previous_avg_coach_rating NUMERIC,
  previous_positive_count BIGINT,
  previous_forward_movement_count BIGINT,
  previous_positive_outcome_count BIGINT,
  -- Percentage changes
  meetings_change_pct NUMERIC,
  sentiment_change_pct NUMERIC,
  talk_time_change_pct NUMERIC,
  coach_rating_change_pct NUMERIC,
  forward_movement_change_pct NUMERIC,
  positive_outcome_change_pct NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH current_period AS (
    SELECT
      COUNT(m.id) as total_meetings,
      AVG(m.sentiment_score) as avg_sentiment,
      AVG(m.talk_time_rep_pct) as avg_talk_time,
      AVG(m.coach_rating) as avg_coach_rating,
      COUNT(CASE WHEN m.sentiment_score > 0.2 THEN 1 END) as positive_count,
      COUNT(CASE WHEN m.sentiment_score < -0.2 THEN 1 END) as negative_count,
      SUM(m.duration_minutes) as total_duration,
      COUNT(DISTINCT m.owner_user_id) as team_members,
      COUNT(CASE WHEN mc.has_forward_movement = true THEN 1 END) as forward_movement_count,
      COUNT(CASE WHEN mc.has_objection = true THEN 1 END) as objection_count,
      COUNT(CASE WHEN mc.outcome = 'positive' THEN 1 END) as positive_outcome_count
    FROM meetings m
    LEFT JOIN meeting_classifications mc ON mc.meeting_id = m.id
    WHERE m.org_id = p_org_id
      AND m.meeting_start >= NOW() - (p_period_days || ' days')::INTERVAL
      AND m.meeting_start IS NOT NULL
  ),
  previous_period AS (
    SELECT
      COUNT(m.id) as total_meetings,
      AVG(m.sentiment_score) as avg_sentiment,
      AVG(m.talk_time_rep_pct) as avg_talk_time,
      AVG(m.coach_rating) as avg_coach_rating,
      COUNT(CASE WHEN m.sentiment_score > 0.2 THEN 1 END) as positive_count,
      COUNT(CASE WHEN mc.has_forward_movement = true THEN 1 END) as forward_movement_count,
      COUNT(CASE WHEN mc.outcome = 'positive' THEN 1 END) as positive_outcome_count
    FROM meetings m
    LEFT JOIN meeting_classifications mc ON mc.meeting_id = m.id
    WHERE m.org_id = p_org_id
      AND m.meeting_start >= NOW() - (p_period_days * 2 || ' days')::INTERVAL
      AND m.meeting_start < NOW() - (p_period_days || ' days')::INTERVAL
      AND m.meeting_start IS NOT NULL
  )
  SELECT
    -- Current period
    cp.total_meetings,
    ROUND(cp.avg_sentiment, 3),
    ROUND(cp.avg_talk_time, 1),
    ROUND(cp.avg_coach_rating, 1),
    cp.positive_count,
    cp.negative_count,
    ROUND(cp.total_duration, 0),
    cp.team_members,
    cp.forward_movement_count,
    cp.objection_count,
    cp.positive_outcome_count,
    -- Previous period
    pp.total_meetings,
    ROUND(pp.avg_sentiment, 3),
    ROUND(pp.avg_talk_time, 1),
    ROUND(pp.avg_coach_rating, 1),
    pp.positive_count,
    pp.forward_movement_count,
    pp.positive_outcome_count,
    -- Changes
    CASE WHEN pp.total_meetings > 0 THEN
      ROUND(((cp.total_meetings - pp.total_meetings)::NUMERIC / pp.total_meetings) * 100, 1)
    ELSE NULL END,
    CASE WHEN pp.avg_sentiment IS NOT NULL AND ABS(pp.avg_sentiment) > 0.001 THEN
      ROUND(((cp.avg_sentiment - pp.avg_sentiment) / ABS(pp.avg_sentiment)) * 100, 1)
    ELSE NULL END,
    CASE WHEN pp.avg_talk_time IS NOT NULL AND pp.avg_talk_time > 0 THEN
      ROUND(((cp.avg_talk_time - pp.avg_talk_time) / pp.avg_talk_time) * 100, 1)
    ELSE NULL END,
    CASE WHEN pp.avg_coach_rating IS NOT NULL AND pp.avg_coach_rating > 0 THEN
      ROUND(((cp.avg_coach_rating - pp.avg_coach_rating) / pp.avg_coach_rating) * 100, 1)
    ELSE NULL END,
    CASE WHEN pp.forward_movement_count > 0 THEN
      ROUND(((cp.forward_movement_count - pp.forward_movement_count)::NUMERIC / pp.forward_movement_count) * 100, 1)
    ELSE NULL END,
    CASE WHEN pp.positive_outcome_count > 0 THEN
      ROUND(((cp.positive_outcome_count - pp.positive_outcome_count)::NUMERIC / pp.positive_outcome_count) * 100, 1)
    ELSE NULL END
  FROM current_period cp, previous_period pp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Function 2: get_team_time_series_metrics
-- Purpose: Get time-series data for charts
-- =============================================================================

CREATE OR REPLACE FUNCTION get_team_time_series_metrics(
  p_org_id UUID,
  p_period_days INTEGER DEFAULT 30,
  p_granularity TEXT DEFAULT 'day', -- 'day' or 'week'
  p_user_id UUID DEFAULT NULL -- Optional: filter by specific user
)
RETURNS TABLE (
  period_start TIMESTAMPTZ,
  user_id UUID,
  user_name TEXT,
  meeting_count BIGINT,
  avg_sentiment NUMERIC,
  avg_talk_time NUMERIC,
  avg_coach_rating NUMERIC,
  positive_count BIGINT,
  negative_count BIGINT,
  forward_movement_count BIGINT,
  total_duration NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE p_granularity
      WHEN 'week' THEN DATE_TRUNC('week', m.meeting_start)
      ELSE DATE_TRUNC('day', m.meeting_start)
    END as period_start,
    m.owner_user_id as user_id,
    COALESCE(
      NULLIF(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), ''),
      p.email
    ) as user_name,
    COUNT(m.id) as meeting_count,
    ROUND(AVG(m.sentiment_score), 3) as avg_sentiment,
    ROUND(AVG(m.talk_time_rep_pct), 1) as avg_talk_time,
    ROUND(AVG(m.coach_rating), 1) as avg_coach_rating,
    COUNT(CASE WHEN m.sentiment_score > 0.2 THEN 1 END) as positive_count,
    COUNT(CASE WHEN m.sentiment_score < -0.2 THEN 1 END) as negative_count,
    COUNT(CASE WHEN mc.has_forward_movement = true THEN 1 END) as forward_movement_count,
    ROUND(SUM(m.duration_minutes), 0) as total_duration
  FROM meetings m
  LEFT JOIN profiles p ON m.owner_user_id = p.id
  LEFT JOIN meeting_classifications mc ON mc.meeting_id = m.id
  WHERE m.org_id = p_org_id
    AND m.meeting_start >= NOW() - (p_period_days || ' days')::INTERVAL
    AND m.meeting_start IS NOT NULL
    AND (p_user_id IS NULL OR m.owner_user_id = p_user_id)
  GROUP BY
    CASE p_granularity
      WHEN 'week' THEN DATE_TRUNC('week', m.meeting_start)
      ELSE DATE_TRUNC('day', m.meeting_start)
    END,
    m.owner_user_id,
    p.first_name,
    p.last_name,
    p.email
  ORDER BY period_start DESC, meeting_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Function 3: get_team_quality_signals
-- Purpose: Get meeting quality signals per rep from meeting_classifications
-- =============================================================================

CREATE OR REPLACE FUNCTION get_team_quality_signals(
  p_org_id UUID,
  p_period_days INTEGER DEFAULT 30,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  total_meetings BIGINT,
  classified_meetings BIGINT,
  forward_movement_count BIGINT,
  forward_movement_rate NUMERIC,
  objection_count BIGINT,
  objection_rate NUMERIC,
  competitor_mention_count BIGINT,
  pricing_discussion_count BIGINT,
  positive_outcome_count BIGINT,
  negative_outcome_count BIGINT,
  neutral_outcome_count BIGINT,
  positive_outcome_rate NUMERIC,
  avg_sentiment NUMERIC,
  avg_talk_time NUMERIC,
  avg_coach_rating NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.owner_user_id as user_id,
    COALESCE(
      NULLIF(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), ''),
      p.email
    ) as user_name,
    p.email as user_email,
    COUNT(m.id) as total_meetings,
    COUNT(mc.id) as classified_meetings,
    COUNT(CASE WHEN mc.has_forward_movement = true THEN 1 END) as forward_movement_count,
    CASE WHEN COUNT(mc.id) > 0 THEN
      ROUND((COUNT(CASE WHEN mc.has_forward_movement = true THEN 1 END)::NUMERIC / COUNT(mc.id)) * 100, 1)
    ELSE NULL END as forward_movement_rate,
    COUNT(CASE WHEN mc.has_objection = true THEN 1 END) as objection_count,
    CASE WHEN COUNT(mc.id) > 0 THEN
      ROUND((COUNT(CASE WHEN mc.has_objection = true THEN 1 END)::NUMERIC / COUNT(mc.id)) * 100, 1)
    ELSE NULL END as objection_rate,
    COUNT(CASE WHEN mc.has_competitor_mention = true THEN 1 END) as competitor_mention_count,
    COUNT(CASE WHEN mc.has_pricing_discussion = true THEN 1 END) as pricing_discussion_count,
    COUNT(CASE WHEN mc.outcome = 'positive' THEN 1 END) as positive_outcome_count,
    COUNT(CASE WHEN mc.outcome = 'negative' THEN 1 END) as negative_outcome_count,
    COUNT(CASE WHEN mc.outcome = 'neutral' THEN 1 END) as neutral_outcome_count,
    CASE WHEN COUNT(mc.id) > 0 THEN
      ROUND((COUNT(CASE WHEN mc.outcome = 'positive' THEN 1 END)::NUMERIC / COUNT(mc.id)) * 100, 1)
    ELSE NULL END as positive_outcome_rate,
    ROUND(AVG(m.sentiment_score), 3) as avg_sentiment,
    ROUND(AVG(m.talk_time_rep_pct), 1) as avg_talk_time,
    ROUND(AVG(m.coach_rating), 1) as avg_coach_rating
  FROM meetings m
  LEFT JOIN profiles p ON m.owner_user_id = p.id
  LEFT JOIN meeting_classifications mc ON mc.meeting_id = m.id
  WHERE m.org_id = p_org_id
    AND m.meeting_start >= NOW() - (p_period_days || ' days')::INTERVAL
    AND m.meeting_start IS NOT NULL
    AND (p_user_id IS NULL OR m.owner_user_id = p_user_id)
  GROUP BY m.owner_user_id, p.first_name, p.last_name, p.email
  ORDER BY COUNT(m.id) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Function 4: get_meetings_for_drill_down
-- Purpose: Get meetings list for drill-down modal, filtered by metric
-- =============================================================================

CREATE OR REPLACE FUNCTION get_meetings_for_drill_down(
  p_org_id UUID,
  p_metric_type TEXT, -- 'all', 'positive_sentiment', 'negative_sentiment', 'forward_movement', 'objection', 'positive_outcome', 'negative_outcome'
  p_period_days INTEGER DEFAULT 30,
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  meeting_id UUID,
  title TEXT,
  meeting_date TIMESTAMPTZ,
  owner_user_id UUID,
  owner_name TEXT,
  company_name TEXT,
  sentiment_score NUMERIC,
  talk_time_pct NUMERIC,
  outcome TEXT,
  has_forward_movement BOOLEAN,
  has_objection BOOLEAN,
  duration_minutes NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id as meeting_id,
    m.title,
    m.meeting_start as meeting_date,
    m.owner_user_id,
    COALESCE(
      NULLIF(TRIM(CONCAT(COALESCE(p.first_name, ''), ' ', COALESCE(p.last_name, ''))), ''),
      p.email
    ) as owner_name,
    c.name as company_name,
    m.sentiment_score,
    m.talk_time_rep_pct as talk_time_pct,
    mc.outcome,
    mc.has_forward_movement,
    mc.has_objection,
    m.duration_minutes
  FROM meetings m
  LEFT JOIN profiles p ON m.owner_user_id = p.id
  LEFT JOIN companies c ON m.company_id = c.id
  LEFT JOIN meeting_classifications mc ON mc.meeting_id = m.id
  WHERE m.org_id = p_org_id
    AND m.meeting_start >= NOW() - (p_period_days || ' days')::INTERVAL
    AND m.meeting_start IS NOT NULL
    AND (p_user_id IS NULL OR m.owner_user_id = p_user_id)
    AND (
      p_metric_type = 'all' OR
      (p_metric_type = 'positive_sentiment' AND m.sentiment_score > 0.2) OR
      (p_metric_type = 'negative_sentiment' AND m.sentiment_score < -0.2) OR
      (p_metric_type = 'forward_movement' AND mc.has_forward_movement = true) OR
      (p_metric_type = 'objection' AND mc.has_objection = true) OR
      (p_metric_type = 'positive_outcome' AND mc.outcome = 'positive') OR
      (p_metric_type = 'negative_outcome' AND mc.outcome = 'negative')
    )
  ORDER BY m.meeting_start DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Function 5: get_team_comparison_matrix
-- Purpose: Get all reps with their metrics for comparison table
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
  trend_data AS (
    SELECT
      m.owner_user_id,
      jsonb_agg(
        jsonb_build_object(
          'date', DATE_TRUNC('day', m.meeting_start)::DATE,
          'count', COUNT(m.id),
          'sentiment', ROUND(AVG(m.sentiment_score), 2)
        ) ORDER BY DATE_TRUNC('day', m.meeting_start)
      ) as trend
    FROM meetings m
    WHERE m.org_id = p_org_id
      AND m.meeting_start >= NOW() - INTERVAL '7 days'
      AND m.meeting_start IS NOT NULL
    GROUP BY m.owner_user_id, DATE_TRUNC('day', m.meeting_start)
  ),
  aggregated_trends AS (
    SELECT
      owner_user_id,
      jsonb_agg(trend) as trend_data
    FROM trend_data
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

-- =============================================================================
-- Indexes for performance
-- =============================================================================

-- Index for org + meeting_start filtering
CREATE INDEX IF NOT EXISTS idx_meetings_org_meeting_start
  ON meetings(org_id, meeting_start DESC)
  WHERE meeting_start IS NOT NULL;

-- Index for owner + meeting_start filtering
CREATE INDEX IF NOT EXISTS idx_meetings_owner_meeting_start
  ON meetings(owner_user_id, meeting_start DESC)
  WHERE meeting_start IS NOT NULL;

-- Composite index for meeting_classifications with org
CREATE INDEX IF NOT EXISTS idx_meeting_classifications_org_outcome
  ON meeting_classifications(org_id, outcome, has_forward_movement);

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON FUNCTION get_team_aggregates_with_comparison IS 'Returns team aggregates with period-over-period comparison for KPI cards';
COMMENT ON FUNCTION get_team_time_series_metrics IS 'Returns time-bucketed metrics for trend charts';
COMMENT ON FUNCTION get_team_quality_signals IS 'Returns meeting quality signals per rep from classifications';
COMMENT ON FUNCTION get_meetings_for_drill_down IS 'Returns filtered meeting list for drill-down modal';
COMMENT ON FUNCTION get_team_comparison_matrix IS 'Returns all reps with metrics for comparison table';
