-- Migration: Deal Risk Signals
-- Purpose: Track AI-detected risk signals per deal from meeting analysis
-- Date: 2025-12-12

-- =============================================================================
-- Table: deal_risk_signals
-- Purpose: Individual risk signals detected from meetings
-- =============================================================================

CREATE TABLE IF NOT EXISTS deal_risk_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,

  -- Signal classification
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'timeline_slip',       -- Prospect mentioned timeline delays
    'budget_concern',      -- Budget/cost objections raised
    'competitor_mention',  -- Competitor discussed (especially late stage)
    'champion_silent',     -- Key contact hasn't engaged recently
    'sentiment_decline',   -- Negative sentiment trend
    'stalled_deal',        -- No forward movement detected
    'objection_unresolved', -- Open objection not addressed
    'stakeholder_concern', -- New stakeholder raised concerns
    'scope_creep',         -- Requirements expanding without commitment
    'decision_delay'       -- Decision process pushed back
  )),

  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  -- Signal details
  title TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Evidence supporting this signal
  -- Schema: {meeting_ids: string[], quotes: string[], dates: string[], context: string}
  evidence JSONB DEFAULT '{}',

  -- Source meeting (if triggered by a specific meeting)
  source_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,

  -- AI confidence in this signal
  confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 1),

  -- Resolution tracking
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  resolution_action TEXT,

  -- Auto-dismiss tracking (e.g., signal becomes stale)
  auto_dismissed BOOLEAN DEFAULT false,
  dismissed_reason TEXT,

  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Table: deal_risk_aggregates
-- Purpose: Aggregated risk summary per deal (denormalized for fast queries)
-- =============================================================================

CREATE TABLE IF NOT EXISTS deal_risk_aggregates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE UNIQUE,
  org_id UUID NOT NULL,

  -- Overall risk assessment
  overall_risk_level TEXT CHECK (overall_risk_level IN ('low', 'medium', 'high', 'critical')),
  risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),

  -- Active signal counts
  active_signals_count INTEGER DEFAULT 0,
  critical_signals_count INTEGER DEFAULT 0,
  high_signals_count INTEGER DEFAULT 0,
  medium_signals_count INTEGER DEFAULT 0,
  low_signals_count INTEGER DEFAULT 0,

  -- Signal breakdown by type
  -- Schema: {signal_type: count}
  signal_breakdown JSONB DEFAULT '{}',

  -- Sentiment analysis from recent meetings
  sentiment_trend TEXT CHECK (sentiment_trend IN ('improving', 'stable', 'declining', 'unknown')),
  avg_sentiment_last_3_meetings NUMERIC,
  sentiment_change_pct NUMERIC,

  -- Engagement metrics
  days_since_last_meeting INTEGER,
  days_since_champion_contact INTEGER,
  meeting_frequency_trend TEXT CHECK (meeting_frequency_trend IN ('increasing', 'stable', 'decreasing', 'unknown')),

  -- Forward movement tracking
  last_forward_movement_at TIMESTAMPTZ,
  days_without_forward_movement INTEGER,

  -- AI-generated recommendations
  -- Schema: [{action: string, priority: 'high'|'medium'|'low', rationale: string, suggested_by?: string}]
  recommended_actions JSONB DEFAULT '[]',

  -- Summary text for quick display
  risk_summary TEXT,

  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_deal_risk_signals_deal_id
  ON deal_risk_signals(deal_id);

CREATE INDEX IF NOT EXISTS idx_deal_risk_signals_org_id
  ON deal_risk_signals(org_id);

CREATE INDEX IF NOT EXISTS idx_deal_risk_signals_signal_type
  ON deal_risk_signals(signal_type);

CREATE INDEX IF NOT EXISTS idx_deal_risk_signals_severity
  ON deal_risk_signals(severity);

CREATE INDEX IF NOT EXISTS idx_deal_risk_signals_is_resolved
  ON deal_risk_signals(is_resolved) WHERE is_resolved = false;

CREATE INDEX IF NOT EXISTS idx_deal_risk_signals_source_meeting
  ON deal_risk_signals(source_meeting_id);

CREATE INDEX IF NOT EXISTS idx_deal_risk_signals_detected_at
  ON deal_risk_signals(detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_deal_risk_aggregates_deal_id
  ON deal_risk_aggregates(deal_id);

CREATE INDEX IF NOT EXISTS idx_deal_risk_aggregates_org_id
  ON deal_risk_aggregates(org_id);

CREATE INDEX IF NOT EXISTS idx_deal_risk_aggregates_risk_level
  ON deal_risk_aggregates(overall_risk_level);

CREATE INDEX IF NOT EXISTS idx_deal_risk_aggregates_risk_score
  ON deal_risk_aggregates(risk_score DESC);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE deal_risk_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_risk_aggregates ENABLE ROW LEVEL SECURITY;

-- Risk signals: Org members can view, service role manages
CREATE POLICY "Org members can view deal risk signals"
  ON deal_risk_signals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = deal_risk_signals.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can resolve risk signals"
  ON deal_risk_signals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = deal_risk_signals.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = deal_risk_signals.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all risk signals"
  ON deal_risk_signals FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Risk aggregates: Org members can view
CREATE POLICY "Org members can view deal risk aggregates"
  ON deal_risk_aggregates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = deal_risk_aggregates.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all risk aggregates"
  ON deal_risk_aggregates FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================================================
-- Trigger: Auto-update timestamps
-- =============================================================================

CREATE OR REPLACE FUNCTION update_deal_risk_tables_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_deal_risk_signals_timestamp
  BEFORE UPDATE ON deal_risk_signals
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_risk_tables_timestamp();

CREATE TRIGGER trigger_update_deal_risk_aggregates_timestamp
  BEFORE UPDATE ON deal_risk_aggregates
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_risk_tables_timestamp();

-- =============================================================================
-- Helper Function: Get active risk signals for a deal
-- =============================================================================

CREATE OR REPLACE FUNCTION get_deal_active_risks(p_deal_id UUID)
RETURNS TABLE (
  signal_id UUID,
  signal_type TEXT,
  severity TEXT,
  title TEXT,
  description TEXT,
  evidence JSONB,
  confidence_score NUMERIC,
  detected_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    drs.id as signal_id,
    drs.signal_type,
    drs.severity,
    drs.title,
    drs.description,
    drs.evidence,
    drs.confidence_score,
    drs.detected_at
  FROM deal_risk_signals drs
  WHERE drs.deal_id = p_deal_id
    AND drs.is_resolved = false
    AND drs.auto_dismissed = false
  ORDER BY
    CASE drs.severity
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
    END,
    drs.detected_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Helper Function: Calculate and update deal risk aggregate
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_deal_risk_aggregate(p_deal_id UUID)
RETURNS VOID AS $$
DECLARE
  v_org_id UUID;
  v_active_count INTEGER;
  v_critical_count INTEGER;
  v_high_count INTEGER;
  v_medium_count INTEGER;
  v_low_count INTEGER;
  v_signal_breakdown JSONB;
  v_risk_score INTEGER;
  v_risk_level TEXT;
  v_sentiment_trend TEXT;
  v_avg_sentiment NUMERIC;
  v_days_since_meeting INTEGER;
  v_last_forward_movement TIMESTAMPTZ;
  v_risk_summary TEXT;
BEGIN
  -- Get org_id from deal
  SELECT d.org_id INTO v_org_id FROM deals d WHERE d.id = p_deal_id;

  -- Count active signals by severity
  SELECT
    COUNT(*) FILTER (WHERE NOT is_resolved AND NOT auto_dismissed),
    COUNT(*) FILTER (WHERE severity = 'critical' AND NOT is_resolved AND NOT auto_dismissed),
    COUNT(*) FILTER (WHERE severity = 'high' AND NOT is_resolved AND NOT auto_dismissed),
    COUNT(*) FILTER (WHERE severity = 'medium' AND NOT is_resolved AND NOT auto_dismissed),
    COUNT(*) FILTER (WHERE severity = 'low' AND NOT is_resolved AND NOT auto_dismissed)
  INTO v_active_count, v_critical_count, v_high_count, v_medium_count, v_low_count
  FROM deal_risk_signals
  WHERE deal_id = p_deal_id;

  -- Signal breakdown by type
  SELECT jsonb_object_agg(signal_type, cnt)
  INTO v_signal_breakdown
  FROM (
    SELECT signal_type, COUNT(*) as cnt
    FROM deal_risk_signals
    WHERE deal_id = p_deal_id AND NOT is_resolved AND NOT auto_dismissed
    GROUP BY signal_type
  ) t;

  -- Calculate risk score (weighted)
  v_risk_score := LEAST(100, (
    v_critical_count * 30 +
    v_high_count * 20 +
    v_medium_count * 10 +
    v_low_count * 5
  ));

  -- Determine risk level
  v_risk_level := CASE
    WHEN v_critical_count > 0 OR v_risk_score >= 80 THEN 'critical'
    WHEN v_high_count >= 2 OR v_risk_score >= 50 THEN 'high'
    WHEN v_high_count >= 1 OR v_medium_count >= 2 OR v_risk_score >= 25 THEN 'medium'
    ELSE 'low'
  END;

  -- Get sentiment data from recent meetings
  SELECT
    AVG(m.sentiment_score),
    CASE
      WHEN AVG(m.sentiment_score) FILTER (WHERE m.start_time > NOW() - interval '14 days') >
           AVG(m.sentiment_score) FILTER (WHERE m.start_time <= NOW() - interval '14 days') THEN 'improving'
      WHEN AVG(m.sentiment_score) FILTER (WHERE m.start_time > NOW() - interval '14 days') <
           AVG(m.sentiment_score) FILTER (WHERE m.start_time <= NOW() - interval '14 days') THEN 'declining'
      ELSE 'stable'
    END
  INTO v_avg_sentiment, v_sentiment_trend
  FROM meetings m
  WHERE m.company_id = (SELECT company_id FROM deals WHERE id = p_deal_id)
    AND m.start_time > NOW() - interval '90 days';

  -- Days since last meeting
  SELECT EXTRACT(DAY FROM NOW() - MAX(m.start_time))::INTEGER
  INTO v_days_since_meeting
  FROM meetings m
  WHERE m.company_id = (SELECT company_id FROM deals WHERE id = p_deal_id);

  -- Get last forward movement
  SELECT MAX(mss.created_at)
  INTO v_last_forward_movement
  FROM meeting_structured_summaries mss
  INNER JOIN meetings m ON mss.meeting_id = m.id
  WHERE m.company_id = (SELECT company_id FROM deals WHERE id = p_deal_id)
    AND (mss.outcome_signals->>'forward_movement')::boolean = true;

  -- Generate summary
  v_risk_summary := CASE
    WHEN v_risk_level = 'critical' THEN 'Critical risk: ' || v_critical_count || ' critical signal(s) detected'
    WHEN v_risk_level = 'high' THEN 'High risk: ' || v_high_count || ' high priority signal(s) require attention'
    WHEN v_risk_level = 'medium' THEN 'Moderate risk: Monitor ' || v_active_count || ' active signal(s)'
    ELSE 'Low risk: Deal is progressing normally'
  END;

  -- Upsert aggregate
  INSERT INTO deal_risk_aggregates (
    deal_id, org_id, overall_risk_level, risk_score,
    active_signals_count, critical_signals_count, high_signals_count,
    medium_signals_count, low_signals_count, signal_breakdown,
    sentiment_trend, avg_sentiment_last_3_meetings,
    days_since_last_meeting, last_forward_movement_at,
    days_without_forward_movement, risk_summary, last_calculated_at
  )
  VALUES (
    p_deal_id, v_org_id, v_risk_level, v_risk_score,
    v_active_count, v_critical_count, v_high_count,
    v_medium_count, v_low_count, COALESCE(v_signal_breakdown, '{}'::jsonb),
    COALESCE(v_sentiment_trend, 'unknown'), v_avg_sentiment,
    v_days_since_meeting, v_last_forward_movement,
    CASE WHEN v_last_forward_movement IS NOT NULL
      THEN EXTRACT(DAY FROM NOW() - v_last_forward_movement)::INTEGER
      ELSE NULL
    END,
    v_risk_summary, NOW()
  )
  ON CONFLICT (deal_id) DO UPDATE SET
    overall_risk_level = EXCLUDED.overall_risk_level,
    risk_score = EXCLUDED.risk_score,
    active_signals_count = EXCLUDED.active_signals_count,
    critical_signals_count = EXCLUDED.critical_signals_count,
    high_signals_count = EXCLUDED.high_signals_count,
    medium_signals_count = EXCLUDED.medium_signals_count,
    low_signals_count = EXCLUDED.low_signals_count,
    signal_breakdown = EXCLUDED.signal_breakdown,
    sentiment_trend = EXCLUDED.sentiment_trend,
    avg_sentiment_last_3_meetings = EXCLUDED.avg_sentiment_last_3_meetings,
    days_since_last_meeting = EXCLUDED.days_since_last_meeting,
    last_forward_movement_at = EXCLUDED.last_forward_movement_at,
    days_without_forward_movement = EXCLUDED.days_without_forward_movement,
    risk_summary = EXCLUDED.risk_summary,
    last_calculated_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Helper Function: Get high-risk deals for an org
-- =============================================================================

CREATE OR REPLACE FUNCTION get_high_risk_deals(
  p_org_id UUID,
  p_min_risk_level TEXT DEFAULT 'medium'
)
RETURNS TABLE (
  deal_id UUID,
  deal_name TEXT,
  company_name TEXT,
  deal_value NUMERIC,
  deal_stage TEXT,
  risk_level TEXT,
  risk_score INTEGER,
  active_signals_count INTEGER,
  top_risk_signal TEXT,
  risk_summary TEXT,
  owner_user_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id as deal_id,
    d.name as deal_name,
    c.name as company_name,
    d.value as deal_value,
    ds.name as deal_stage,
    dra.overall_risk_level as risk_level,
    dra.risk_score,
    dra.active_signals_count,
    (
      SELECT drs.title
      FROM deal_risk_signals drs
      WHERE drs.deal_id = d.id AND NOT drs.is_resolved
      ORDER BY
        CASE drs.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END
      LIMIT 1
    ) as top_risk_signal,
    dra.risk_summary,
    d.user_id as owner_user_id
  FROM deal_risk_aggregates dra
  INNER JOIN deals d ON dra.deal_id = d.id
  LEFT JOIN companies c ON d.company_id = c.id
  LEFT JOIN deal_stages ds ON d.stage_id = ds.id
  WHERE dra.org_id = p_org_id
    AND dra.active_signals_count > 0
    AND (
      (p_min_risk_level = 'low') OR
      (p_min_risk_level = 'medium' AND dra.overall_risk_level IN ('medium', 'high', 'critical')) OR
      (p_min_risk_level = 'high' AND dra.overall_risk_level IN ('high', 'critical')) OR
      (p_min_risk_level = 'critical' AND dra.overall_risk_level = 'critical')
    )
  ORDER BY dra.risk_score DESC, dra.active_signals_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Trigger: Recalculate aggregate when signals change
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_recalculate_deal_risk()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM calculate_deal_risk_aggregate(OLD.deal_id);
    RETURN OLD;
  ELSE
    PERFORM calculate_deal_risk_aggregate(NEW.deal_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_deal_risk_signals_change
  AFTER INSERT OR UPDATE OR DELETE ON deal_risk_signals
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_deal_risk();

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE deal_risk_signals IS 'Individual risk signals detected from meeting analysis';
COMMENT ON TABLE deal_risk_aggregates IS 'Aggregated risk summary per deal for fast dashboard queries';
COMMENT ON FUNCTION get_deal_active_risks IS 'Returns all active (unresolved) risk signals for a deal';
COMMENT ON FUNCTION calculate_deal_risk_aggregate IS 'Recalculates the risk aggregate for a deal based on current signals';
COMMENT ON FUNCTION get_high_risk_deals IS 'Returns deals above a certain risk threshold for an org';
