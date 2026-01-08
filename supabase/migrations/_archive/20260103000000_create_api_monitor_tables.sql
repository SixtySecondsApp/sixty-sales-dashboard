-- Migration: Create API Monitor Tables
-- Purpose: Track REST API usage, errors, bursts, and improvements
-- Date: 2026-01-03

-- ============================================================================
-- 1. API Monitor Snapshots (aggregated metrics by time bucket)
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_monitor_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_bucket_start TIMESTAMPTZ NOT NULL,
  time_bucket_end TIMESTAMPTZ NOT NULL,
  bucket_type TEXT NOT NULL CHECK (bucket_type IN ('5m', '1h', '1d')),
  
  -- Aggregated metrics
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_errors INTEGER NOT NULL DEFAULT 0,
  error_rate NUMERIC(5, 2) NOT NULL DEFAULT 0, -- percentage
  
  -- Top endpoints (stored as JSONB array)
  top_endpoints JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{"endpoint": "/rest/v1/...", "method": "GET", "count": 123, "errors": 5}, ...]
  
  -- Top errors (stored as JSONB array)
  top_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{"status": 400, "endpoint": "/rest/v1/...", "count": 10, "sample_message": "..."}, ...]
  
  -- Top callers (IP/user-agent)
  top_callers JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{"ip": "1.2.3.4", "user_agent": "...", "count": 50}, ...]
  
  -- Burst detection
  suspected_bursts JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{"endpoint": "/rest/v1/...", "requests_per_minute": 120, "time_window": "..."}, ...]
  
  -- Source metadata
  source TEXT NOT NULL CHECK (source IN ('supabase_logs', 'app_instrumented')),
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_monitor_snapshots_time_bucket ON api_monitor_snapshots(time_bucket_start DESC, bucket_type);
CREATE INDEX idx_api_monitor_snapshots_snapshot_time ON api_monitor_snapshots(snapshot_time DESC);
CREATE INDEX idx_api_monitor_snapshots_source ON api_monitor_snapshots(source);

-- ============================================================================
-- 2. API Monitor Daily Rollups (per-user + total)
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_monitor_rollups_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- NULL user_id means "total" (aggregate across all users)
  
  -- Daily totals
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_errors INTEGER NOT NULL DEFAULT 0,
  error_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
  
  -- Top endpoints for this user/day
  top_endpoints JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{"endpoint": "/rest/v1/...", "method": "GET", "count": 50}, ...]
  
  -- Error breakdown
  error_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Format: {"400": 5, "500": 2, ...}
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one row per user per day (or one total row per day)
  UNIQUE(date, user_id)
);

CREATE INDEX idx_api_monitor_rollups_date ON api_monitor_rollups_daily(date DESC);
CREATE INDEX idx_api_monitor_rollups_user_date ON api_monitor_rollups_daily(user_id, date DESC);
CREATE INDEX idx_api_monitor_rollups_total ON api_monitor_rollups_daily(date DESC) WHERE user_id IS NULL;

-- ============================================================================
-- 3. API Monitor Improvements Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_monitor_improvements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  shipped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Expected impact
  expected_delta_requests_per_day INTEGER, -- negative = reduction, positive = increase
  expected_delta_error_rate NUMERIC(5, 2), -- percentage change
  
  -- Actual impact (computed from rollups)
  actual_delta_requests_per_day INTEGER,
  actual_delta_error_rate NUMERIC(5, 2),
  actual_delta_requests_per_user_per_day NUMERIC(10, 2),
  
  -- Comparison windows
  before_window_start TIMESTAMPTZ,
  before_window_end TIMESTAMPTZ,
  after_window_start TIMESTAMPTZ,
  after_window_end TIMESTAMPTZ,
  
  -- Metadata
  code_changes JSONB DEFAULT '[]'::jsonb,
  -- Format: [{"file": "src/...", "type": "fix|optimization|refactor"}, ...]
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_monitor_improvements_shipped_at ON api_monitor_improvements(shipped_at DESC);

-- ============================================================================
-- 4. Enable RLS (restrict to platform admins + service role)
-- ============================================================================

ALTER TABLE api_monitor_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_monitor_rollups_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_monitor_improvements ENABLE ROW LEVEL SECURITY;

-- Platform admins can read all
CREATE POLICY "platform_admins_can_read_snapshots"
  ON api_monitor_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "platform_admins_can_read_rollups"
  ON api_monitor_rollups_daily FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "platform_admins_can_read_improvements"
  ON api_monitor_improvements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Service role can do everything
CREATE POLICY "service_role_all_snapshots"
  ON api_monitor_snapshots FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_rollups"
  ON api_monitor_rollups_daily FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_all_improvements"
  ON api_monitor_improvements FOR ALL
  USING (auth.role() = 'service_role');

-- Users can read their own rollups (for transparency)
CREATE POLICY "users_can_read_own_rollups"
  ON api_monitor_rollups_daily FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- 5. Retention Cleanup Function (delete snapshots older than 7 days)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_api_monitor_snapshots()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM api_monitor_snapshots
  WHERE snapshot_time < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. Schedule Retention Cleanup (daily at 2am)
-- ============================================================================

-- Unschedule if exists
SELECT cron.unschedule('cleanup-api-monitor-snapshots') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-api-monitor-snapshots'
);

-- Schedule cleanup job
SELECT cron.schedule(
  'cleanup-api-monitor-snapshots',
  '0 2 * * *', -- Daily at 2am
  $$SELECT cleanup_old_api_monitor_snapshots();$$
);

-- ============================================================================
-- 7. Helper Function: Compute Improvement Deltas
-- ============================================================================

CREATE OR REPLACE FUNCTION compute_improvement_deltas(p_improvement_id UUID)
RETURNS TABLE (
  actual_delta_requests_per_day INTEGER,
  actual_delta_error_rate NUMERIC(5, 2),
  actual_delta_requests_per_user_per_day NUMERIC(10, 2)
) AS $$
DECLARE
  v_improvement api_monitor_improvements%ROWTYPE;
  v_before_total INTEGER;
  v_after_total INTEGER;
  v_before_error_rate NUMERIC(5, 2);
  v_after_error_rate NUMERIC(5, 2);
  v_before_avg_per_user NUMERIC(10, 2);
  v_after_avg_per_user NUMERIC(10, 2);
  v_days_before INTEGER;
  v_days_after INTEGER;
BEGIN
  -- Get improvement record
  SELECT * INTO v_improvement
  FROM api_monitor_improvements
  WHERE id = p_improvement_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Improvement not found: %', p_improvement_id;
  END IF;
  
  -- Calculate days in each window
  v_days_before := EXTRACT(EPOCH FROM (v_improvement.before_window_end - v_improvement.before_window_start)) / 86400;
  v_days_after := EXTRACT(EPOCH FROM (v_improvement.after_window_end - v_improvement.after_window_start)) / 86400;
  
  -- Get before totals (from daily rollups where user_id IS NULL = total)
  SELECT 
    COALESCE(SUM(total_requests), 0)::INTEGER,
    COALESCE(AVG(error_rate), 0)::NUMERIC(5, 2),
    COALESCE(AVG(total_requests), 0)::NUMERIC(10, 2)
  INTO v_before_total, v_before_error_rate, v_before_avg_per_user
  FROM api_monitor_rollups_daily
  WHERE date >= v_improvement.before_window_start::DATE
    AND date <= v_improvement.before_window_end::DATE
    AND user_id IS NULL;
  
  -- Get after totals
  SELECT 
    COALESCE(SUM(total_requests), 0)::INTEGER,
    COALESCE(AVG(error_rate), 0)::NUMERIC(5, 2),
    COALESCE(AVG(total_requests), 0)::NUMERIC(10, 2)
  INTO v_after_total, v_after_error_rate, v_after_avg_per_user
  FROM api_monitor_rollups_daily
  WHERE date >= v_improvement.after_window_start::DATE
    AND date <= v_improvement.after_window_end::DATE
    AND user_id IS NULL;
  
  -- Calculate per-user averages (from user-specific rollups)
  SELECT COALESCE(AVG(total_requests), 0)::NUMERIC(10, 2)
  INTO v_before_avg_per_user
  FROM api_monitor_rollups_daily
  WHERE date >= v_improvement.before_window_start::DATE
    AND date <= v_improvement.before_window_end::DATE
    AND user_id IS NOT NULL;
  
  SELECT COALESCE(AVG(total_requests), 0)::NUMERIC(10, 2)
  INTO v_after_avg_per_user
  FROM api_monitor_rollups_daily
  WHERE date >= v_improvement.after_window_start::DATE
    AND date <= v_improvement.after_window_end::DATE
    AND user_id IS NOT NULL;
  
  -- Normalize to per-day
  IF v_days_before > 0 THEN
    v_before_total := (v_before_total::NUMERIC / v_days_before)::INTEGER;
    v_before_avg_per_user := v_before_avg_per_user / v_days_before;
  END IF;
  
  IF v_days_after > 0 THEN
    v_after_total := (v_after_total::NUMERIC / v_days_after)::INTEGER;
    v_after_avg_per_user := v_after_avg_per_user / v_days_after;
  END IF;
  
  -- Return deltas
  RETURN QUERY SELECT
    (v_after_total - v_before_total)::INTEGER,
    (v_after_error_rate - v_before_error_rate)::NUMERIC(5, 2),
    (v_after_avg_per_user - v_before_avg_per_user)::NUMERIC(10, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. Comments
-- ============================================================================

COMMENT ON TABLE api_monitor_snapshots IS 'Aggregated API metrics by time bucket (5m/1h/1d). Retained for 7 days.';
COMMENT ON TABLE api_monitor_rollups_daily IS 'Daily per-user and total API request rollups. Used for before/after comparisons.';
COMMENT ON TABLE api_monitor_improvements IS 'Log of API optimizations with expected vs actual impact metrics.';
COMMENT ON FUNCTION cleanup_old_api_monitor_snapshots() IS 'Deletes snapshots older than 7 days. Called by cron daily.';
COMMENT ON FUNCTION compute_improvement_deltas(UUID) IS 'Computes actual deltas for an improvement by comparing rollups before/after shipped_at.';
