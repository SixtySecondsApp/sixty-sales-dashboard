-- =====================================================
-- Ghost Detection Signals Table
-- =====================================================
-- Tracks specific signals that indicate ghosting risk
-- Each signal represents a specific behavioral pattern that predicts ghosting

CREATE TABLE IF NOT EXISTS ghost_detection_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_health_id UUID NOT NULL REFERENCES relationship_health_scores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Signal details
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'email_no_response',
    'response_time_increased',
    'email_opens_declined',
    'meeting_cancelled',
    'meeting_rescheduled_repeatedly',
    'one_word_responses',
    'thread_dropout',
    'attendee_count_decreased',
    'meeting_duration_shortened',
    'sentiment_declining',
    'formal_language_shift',
    'engagement_pattern_break',
    'champion_disappeared',
    'delayed_meeting_acceptance'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  -- Context
  signal_context TEXT, -- Human-readable description
  signal_data JSONB, -- Raw data that triggered signal

  -- Timestamps
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  metadata JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX idx_ghost_signals_relationship ON ghost_detection_signals(relationship_health_id);
CREATE INDEX idx_ghost_signals_user ON ghost_detection_signals(user_id);
CREATE INDEX idx_ghost_signals_type ON ghost_detection_signals(signal_type);
CREATE INDEX idx_ghost_signals_detected ON ghost_detection_signals(detected_at DESC);
CREATE INDEX idx_ghost_signals_severity ON ghost_detection_signals(severity);
CREATE INDEX idx_ghost_signals_unresolved ON ghost_detection_signals(resolved_at) WHERE resolved_at IS NULL;

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

ALTER TABLE ghost_detection_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ghost signals"
  ON ghost_detection_signals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ghost signals"
  ON ghost_detection_signals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ghost signals"
  ON ghost_detection_signals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ghost signals"
  ON ghost_detection_signals FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to get unresolved signals count for a relationship
CREATE OR REPLACE FUNCTION get_unresolved_ghost_signals_count(relationship_health_id_param UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM ghost_detection_signals
  WHERE relationship_health_id = relationship_health_id_param
    AND resolved_at IS NULL;
$$ LANGUAGE SQL STABLE;

-- Function to get highest severity signal for a relationship
CREATE OR REPLACE FUNCTION get_highest_ghost_signal_severity(relationship_health_id_param UUID)
RETURNS TEXT AS $$
  SELECT
    CASE
      WHEN COUNT(*) FILTER (WHERE severity = 'critical') > 0 THEN 'critical'
      WHEN COUNT(*) FILTER (WHERE severity = 'high') > 0 THEN 'high'
      WHEN COUNT(*) FILTER (WHERE severity = 'medium') > 0 THEN 'medium'
      WHEN COUNT(*) FILTER (WHERE severity = 'low') > 0 THEN 'low'
      ELSE 'none'
    END
  FROM ghost_detection_signals
  WHERE relationship_health_id = relationship_health_id_param
    AND resolved_at IS NULL;
$$ LANGUAGE SQL STABLE;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE ghost_detection_signals IS 'Tracks specific behavioral signals that indicate ghosting risk';
COMMENT ON COLUMN ghost_detection_signals.signal_context IS 'Human-readable description of why this signal was detected';
COMMENT ON COLUMN ghost_detection_signals.signal_data IS 'JSONB containing raw data that triggered the signal (baseline vs current values, etc.)';
COMMENT ON COLUMN ghost_detection_signals.resolved_at IS 'Timestamp when signal was resolved (e.g., prospect responded, meeting rescheduled)';
