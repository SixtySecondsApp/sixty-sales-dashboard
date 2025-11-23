-- =====================================================
-- Relationship Health History Table
-- =====================================================
-- Historical snapshots of relationship health for trend analysis
-- Enables tracking health score changes over time

CREATE TABLE IF NOT EXISTS relationship_health_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_health_id UUID NOT NULL REFERENCES relationship_health_scores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Snapshot of scores
  overall_health_score INTEGER NOT NULL CHECK (overall_health_score >= 0 AND overall_health_score <= 100),
  health_status TEXT NOT NULL CHECK (health_status IN ('healthy', 'at_risk', 'critical', 'ghost')),
  communication_frequency_score INTEGER CHECK (communication_frequency_score >= 0 AND communication_frequency_score <= 100),
  response_behavior_score INTEGER CHECK (response_behavior_score >= 0 AND response_behavior_score <= 100),
  engagement_quality_score INTEGER CHECK (engagement_quality_score >= 0 AND engagement_quality_score <= 100),
  sentiment_score INTEGER CHECK (sentiment_score >= 0 AND sentiment_score <= 100),
  meeting_pattern_score INTEGER CHECK (meeting_pattern_score >= 0 AND meeting_pattern_score <= 100),

  -- Ghost detection snapshot
  is_ghost_risk BOOLEAN DEFAULT FALSE,
  ghost_probability_percent INTEGER CHECK (ghost_probability_percent >= 0 AND ghost_probability_percent <= 100),

  -- Snapshot timestamp
  snapshot_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Metadata
  snapshot_reason TEXT CHECK (snapshot_reason IN (
    'scheduled',
    'intervention_sent',
    'major_change',
    'alert_triggered',
    'manual_refresh',
    'ghost_detected',
    'recovery'
  )),
  changes_from_previous JSONB, -- What changed since last snapshot

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX idx_relationship_history_relationship ON relationship_health_history(relationship_health_id);
CREATE INDEX idx_relationship_history_user ON relationship_health_history(user_id);
CREATE INDEX idx_relationship_history_snapshot ON relationship_health_history(snapshot_at DESC);
CREATE INDEX idx_relationship_history_status ON relationship_health_history(health_status);

-- Composite index for time-series analysis
CREATE INDEX idx_relationship_history_relationship_time ON relationship_health_history(relationship_health_id, snapshot_at DESC);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

ALTER TABLE relationship_health_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own relationship health history"
  ON relationship_health_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own relationship health history"
  ON relationship_health_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No update/delete policies - history is append-only

-- =====================================================
-- Trigger to auto-create history snapshot on health score update
-- =====================================================

CREATE OR REPLACE FUNCTION create_relationship_health_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  previous_snapshot RECORD;
  changes JSONB;
BEGIN
  -- Get previous snapshot
  SELECT * INTO previous_snapshot
  FROM relationship_health_history
  WHERE relationship_health_id = NEW.id
  ORDER BY snapshot_at DESC
  LIMIT 1;

  -- Calculate changes
  IF previous_snapshot IS NOT NULL THEN
    changes := jsonb_build_object(
      'overall_health_score_delta', NEW.overall_health_score - previous_snapshot.overall_health_score,
      'status_changed', NEW.health_status <> previous_snapshot.health_status,
      'ghost_risk_changed', NEW.is_ghost_risk <> previous_snapshot.is_ghost_risk,
      'previous_status', previous_snapshot.health_status,
      'new_status', NEW.health_status
    );
  ELSE
    changes := jsonb_build_object(
      'initial_snapshot', true,
      'status', NEW.health_status
    );
  END IF;

  -- Determine snapshot reason
  DECLARE
    reason TEXT;
  BEGIN
    IF previous_snapshot IS NULL THEN
      reason := 'scheduled';
    ELSIF ABS(NEW.overall_health_score - previous_snapshot.overall_health_score) >= 15 THEN
      reason := 'major_change';
    ELSIF NEW.is_ghost_risk = TRUE AND previous_snapshot.is_ghost_risk = FALSE THEN
      reason := 'ghost_detected';
    ELSIF NEW.is_ghost_risk = FALSE AND previous_snapshot.is_ghost_risk = TRUE THEN
      reason := 'recovery';
    ELSE
      reason := 'scheduled';
    END IF;

    -- Insert snapshot
    INSERT INTO relationship_health_history (
      relationship_health_id,
      user_id,
      overall_health_score,
      health_status,
      communication_frequency_score,
      response_behavior_score,
      engagement_quality_score,
      sentiment_score,
      meeting_pattern_score,
      is_ghost_risk,
      ghost_probability_percent,
      snapshot_at,
      snapshot_reason,
      changes_from_previous
    ) VALUES (
      NEW.id,
      NEW.user_id,
      NEW.overall_health_score,
      NEW.health_status,
      NEW.communication_frequency_score,
      NEW.response_behavior_score,
      NEW.engagement_quality_score,
      NEW.sentiment_score,
      NEW.meeting_pattern_score,
      NEW.is_ghost_risk,
      NEW.ghost_probability_percent,
      NOW(),
      reason,
      changes
    );
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_relationship_health_snapshot_trigger
  AFTER INSERT OR UPDATE ON relationship_health_scores
  FOR EACH ROW
  EXECUTE FUNCTION create_relationship_health_snapshot();

-- =====================================================
-- Helper Functions
-- =====================================================

-- Get health score trend for a relationship
CREATE OR REPLACE FUNCTION get_health_score_trend(
  relationship_health_id_param UUID,
  days INTEGER DEFAULT 30
)
RETURNS TABLE (
  date DATE,
  score INTEGER,
  status TEXT
) AS $$
  SELECT
    snapshot_at::DATE AS date,
    overall_health_score AS score,
    health_status AS status
  FROM relationship_health_history
  WHERE relationship_health_id = relationship_health_id_param
    AND snapshot_at >= NOW() - (days || ' days')::INTERVAL
  ORDER BY snapshot_at ASC;
$$ LANGUAGE SQL STABLE;

-- Get average health score change per day
CREATE OR REPLACE FUNCTION get_avg_health_change_per_day(
  relationship_health_id_param UUID,
  days INTEGER DEFAULT 7
)
RETURNS NUMERIC AS $$
DECLARE
  oldest_score INTEGER;
  newest_score INTEGER;
  days_diff INTEGER;
BEGIN
  SELECT overall_health_score INTO oldest_score
  FROM relationship_health_history
  WHERE relationship_health_id = relationship_health_id_param
    AND snapshot_at >= NOW() - (days || ' days')::INTERVAL
  ORDER BY snapshot_at ASC
  LIMIT 1;

  SELECT overall_health_score INTO newest_score
  FROM relationship_health_history
  WHERE relationship_health_id = relationship_health_id_param
  ORDER BY snapshot_at DESC
  LIMIT 1;

  IF oldest_score IS NULL OR newest_score IS NULL THEN
    RETURN 0;
  END IF;

  days_diff := GREATEST(days, 1);

  RETURN (newest_score - oldest_score)::NUMERIC / days_diff::NUMERIC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get count of status changes
CREATE OR REPLACE FUNCTION get_status_change_count(
  relationship_health_id_param UUID,
  days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM relationship_health_history
  WHERE relationship_health_id = relationship_health_id_param
    AND snapshot_at >= NOW() - (days || ' days')::INTERVAL
    AND changes_from_previous->>'status_changed' = 'true';
$$ LANGUAGE SQL STABLE;

-- Clean up old history snapshots (keep daily snapshots for old data)
CREATE OR REPLACE FUNCTION cleanup_old_relationship_health_history(days_to_keep_hourly INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete all but one snapshot per day for data older than days_to_keep_hourly
  WITH snapshots_to_keep AS (
    SELECT DISTINCT ON (relationship_health_id, snapshot_at::DATE) id
    FROM relationship_health_history
    WHERE snapshot_at < NOW() - (days_to_keep_hourly || ' days')::INTERVAL
    ORDER BY relationship_health_id, snapshot_at::DATE, snapshot_at DESC
  )
  DELETE FROM relationship_health_history
  WHERE snapshot_at < NOW() - (days_to_keep_hourly || ' days')::INTERVAL
    AND id NOT IN (SELECT id FROM snapshots_to_keep);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE relationship_health_history IS 'Historical snapshots of relationship health scores for trend analysis';
COMMENT ON COLUMN relationship_health_history.snapshot_reason IS 'Why this snapshot was created (scheduled, major change, intervention, etc.)';
COMMENT ON COLUMN relationship_health_history.changes_from_previous IS 'JSONB containing deltas and changes from previous snapshot';
COMMENT ON FUNCTION create_relationship_health_snapshot() IS 'Auto-creates history snapshots when relationship health scores are updated';
COMMENT ON FUNCTION cleanup_old_relationship_health_history(INTEGER) IS 'Consolidates old snapshots to one per day to save space';
