-- Remove SECURITY DEFINER from Helper Functions
-- Migration: 20250128200000_fix_function_volatility
-- Purpose: Remove SECURITY DEFINER to avoid PostgreSQL volatility errors
-- Note: RLS policies already protect the data, so SECURITY DEFINER is redundant
-- Created: 2025-01-28

-- ============================================================================
-- Update functions to remove SECURITY DEFINER (rely on RLS instead)
-- ============================================================================

-- Function 1: get_latest_content (now relies on RLS)
CREATE OR REPLACE FUNCTION get_latest_content(
  p_meeting_id UUID,
  p_content_type TEXT
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  title TEXT,
  version INTEGER,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- RLS policies on meeting_generated_content automatically filter by ownership
  -- No need for explicit auth.uid() check

  RETURN QUERY
  SELECT
    mgc.id,
    mgc.content,
    mgc.title,
    mgc.version,
    mgc.created_at
  FROM meeting_generated_content mgc
  WHERE
    mgc.meeting_id = p_meeting_id
    AND mgc.content_type = p_content_type
    AND mgc.is_latest = true
    AND mgc.deleted_at IS NULL
  ORDER BY mgc.created_at DESC
  LIMIT 1;
END;
$$;

-- Function 2: get_content_with_topics (now relies on RLS)
CREATE OR REPLACE FUNCTION get_content_with_topics(p_content_id UUID)
RETURNS TABLE (
  content_id UUID,
  content TEXT,
  title TEXT,
  content_type TEXT,
  topics JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- RLS policies automatically filter results by ownership

  RETURN QUERY
  SELECT
    mgc.id,
    mgc.content,
    mgc.title,
    mgc.content_type,
    mct.topics
  FROM meeting_generated_content mgc
  JOIN content_topic_links ctl ON ctl.content_id = mgc.id
  JOIN meeting_content_topics mct ON mct.meeting_id = mgc.meeting_id
  WHERE
    mgc.id = p_content_id
    AND mgc.deleted_at IS NULL
    AND mct.deleted_at IS NULL
  LIMIT 1;
END;
$$;

-- Function 3: calculate_meeting_content_costs (now relies on RLS)
CREATE OR REPLACE FUNCTION calculate_meeting_content_costs(p_meeting_id UUID)
RETURNS TABLE (
  topics_cost_cents INTEGER,
  content_cost_cents INTEGER,
  total_cost_cents INTEGER,
  total_tokens INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- RLS policies automatically filter results by ownership

  RETURN QUERY
  SELECT
    COALESCE(SUM(mct.cost_cents), 0)::INTEGER as topics_cost_cents,
    COALESCE(SUM(mgc.cost_cents), 0)::INTEGER as content_cost_cents,
    COALESCE(SUM(mct.cost_cents), 0)::INTEGER + COALESCE(SUM(mgc.cost_cents), 0)::INTEGER as total_cost_cents,
    COALESCE(SUM(mct.tokens_used), 0)::INTEGER + COALESCE(SUM(mgc.tokens_used), 0)::INTEGER as total_tokens
  FROM meetings m
  LEFT JOIN meeting_content_topics mct ON mct.meeting_id = m.id AND mct.deleted_at IS NULL
  LEFT JOIN meeting_generated_content mgc ON mgc.meeting_id = m.id AND mgc.deleted_at IS NULL
  WHERE m.id = p_meeting_id
  GROUP BY m.id;
END;
$$;

-- ============================================================================
-- Migration Complete
-- ============================================================================

COMMENT ON SCHEMA public IS 'Function volatility fixed: 20250128200000';
