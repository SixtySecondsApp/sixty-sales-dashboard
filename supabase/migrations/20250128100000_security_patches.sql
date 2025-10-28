-- Security Patches for Content Tab Feature
-- Migration: 20250128100000_security_patches
-- Addresses: CRITICAL-3 (SECURITY DEFINER functions)
-- Created: 2025-01-28
-- Fixed: Removed DROP FUNCTION IF EXISTS to avoid index dependency issues

-- ============================================================================
-- CRITICAL FIX: Add Authorization to SECURITY DEFINER Functions
-- ============================================================================
-- Issue: Functions bypass RLS without checking caller permissions
-- Fix: Add explicit ownership validation before returning data

-- ============================================================================
-- Function 1: get_latest_content with Authorization Check
-- ============================================================================

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
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- CRITICAL SECURITY CHECK: Verify caller owns the meeting
  IF NOT EXISTS (
    SELECT 1
    FROM meetings
    WHERE meetings.id = p_meeting_id
      AND meetings.owner_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Permission denied: You do not own this meeting'
      USING HINT = 'You can only access content for meetings you own',
            ERRCODE = 'insufficient_privilege';
  END IF;

  -- Authorization passed, return content
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

COMMENT ON FUNCTION get_latest_content IS 'Get latest content for a meeting (with ownership validation)';

-- ============================================================================
-- Function 2: get_content_with_topics with Authorization Check
-- ============================================================================

CREATE OR REPLACE FUNCTION get_content_with_topics(p_content_id UUID)
RETURNS TABLE (
  content_id UUID,
  content TEXT,
  title TEXT,
  content_type TEXT,
  topics JSONB
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- CRITICAL SECURITY CHECK: Verify caller owns the meeting associated with this content
  IF NOT EXISTS (
    SELECT 1
    FROM meeting_generated_content mgc
    JOIN meetings m ON m.id = mgc.meeting_id
    WHERE mgc.id = p_content_id
      AND m.owner_user_id = auth.uid()
      AND mgc.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Permission denied: You do not own the meeting for this content'
      USING HINT = 'You can only access content for meetings you own',
            ERRCODE = 'insufficient_privilege';
  END IF;

  -- Authorization passed, return content with topics
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

COMMENT ON FUNCTION get_content_with_topics IS 'Get content with linked topics (with ownership validation)';

-- ============================================================================
-- Function 3: calculate_meeting_content_costs with Authorization Check
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_meeting_content_costs(p_meeting_id UUID)
RETURNS TABLE (
  topics_cost_cents INTEGER,
  content_cost_cents INTEGER,
  total_cost_cents INTEGER,
  total_tokens INTEGER
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- CRITICAL SECURITY CHECK: Verify caller owns the meeting
  IF NOT EXISTS (
    SELECT 1
    FROM meetings
    WHERE meetings.id = p_meeting_id
      AND meetings.owner_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Permission denied: You do not own this meeting'
      USING HINT = 'You can only view costs for meetings you own',
            ERRCODE = 'insufficient_privilege';
  END IF;

  -- Authorization passed, calculate and return costs
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

COMMENT ON FUNCTION calculate_meeting_content_costs IS 'Calculate total AI costs for a meeting (with ownership validation)';

-- ============================================================================
-- New Security Tables for Cost Tracking and Event Logging
-- ============================================================================

-- Table: cost_tracking (for monitoring and rate limiting)
CREATE TABLE IF NOT EXISTS cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  operation TEXT NOT NULL CHECK (operation IN ('extract_topics', 'generate_content')),
  cost_cents INTEGER NOT NULL CHECK (cost_cents >= 0),
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cost_tracking_user_id ON cost_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_created_at ON cost_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_tracking_user_date ON cost_tracking(user_id, DATE(created_at));

COMMENT ON TABLE cost_tracking IS 'Tracks AI operation costs for monitoring and rate limiting';

-- Enable RLS
ALTER TABLE cost_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own costs"
  ON cost_tracking FOR SELECT
  USING (user_id = auth.uid());

-- Table: security_events (for audit logging)
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'AUTH_FAILURE',
    'RATE_LIMIT',
    'COST_ALERT',
    'SUSPICIOUS_PATTERN',
    'UNAUTHORIZED_ACCESS'
  )),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  details TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id) WHERE user_id IS NOT NULL;

COMMENT ON TABLE security_events IS 'Audit log for security-related events';

-- Enable RLS (admin-only access via service role)
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- No SELECT policy - only service role can read (for admin dashboard)

-- ============================================================================
-- Helper Functions for Cost Tracking
-- ============================================================================

-- Function to get user's hourly costs
CREATE OR REPLACE FUNCTION get_user_hourly_cost(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hourly_cost INTEGER;
BEGIN
  SELECT COALESCE(SUM(cost_cents), 0)
  INTO hourly_cost
  FROM cost_tracking
  WHERE user_id = p_user_id
    AND created_at >= NOW() - INTERVAL '1 hour';

  RETURN hourly_cost;
END;
$$;

-- Function to get user's daily costs
CREATE OR REPLACE FUNCTION get_user_daily_cost(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  daily_cost INTEGER;
BEGIN
  SELECT COALESCE(SUM(cost_cents), 0)
  INTO daily_cost
  FROM cost_tracking
  WHERE user_id = p_user_id
    AND DATE(created_at) = CURRENT_DATE;

  RETURN daily_cost;
END;
$$;

-- Function to get global hourly costs (all users)
CREATE OR REPLACE FUNCTION get_global_hourly_cost()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  global_cost INTEGER;
BEGIN
  SELECT COALESCE(SUM(cost_cents), 0)
  INTO global_cost
  FROM cost_tracking
  WHERE created_at >= NOW() - INTERVAL '1 hour';

  RETURN global_cost;
END;
$$;

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_latest_content(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_content_with_topics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_meeting_content_costs(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_hourly_cost(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_daily_cost(UUID) TO authenticated;

-- Grant execute on global cost function to service role only
GRANT EXECUTE ON FUNCTION get_global_hourly_cost() TO service_role;

-- ============================================================================
-- Migration Complete
-- ============================================================================

COMMENT ON SCHEMA public IS 'Security patches applied: 20250128100000';
