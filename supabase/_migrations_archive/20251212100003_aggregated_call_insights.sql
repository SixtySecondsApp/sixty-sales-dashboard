-- Migration: Aggregated Call Insights
-- Purpose: Enable aggregate queries across meetings (counts, stats, trends)
-- Date: 2025-12-12

-- =============================================================================
-- Table: meeting_classifications
-- Purpose: Per-meeting classification flags for aggregate queries
-- =============================================================================

CREATE TABLE IF NOT EXISTS meeting_classifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE UNIQUE,
  org_id UUID NOT NULL,

  -- Classification flags (boolean for fast filtering)
  has_forward_movement BOOLEAN DEFAULT false,
  has_proposal_request BOOLEAN DEFAULT false,
  has_pricing_discussion BOOLEAN DEFAULT false,
  has_competitor_mention BOOLEAN DEFAULT false,
  has_objection BOOLEAN DEFAULT false,
  has_demo_request BOOLEAN DEFAULT false,
  has_timeline_discussion BOOLEAN DEFAULT false,
  has_budget_discussion BOOLEAN DEFAULT false,
  has_decision_maker BOOLEAN DEFAULT false,
  has_next_steps BOOLEAN DEFAULT false,

  -- Meeting outcome classification
  outcome TEXT CHECK (outcome IN ('positive', 'neutral', 'negative', 'unknown')),

  -- Detected stage from content
  detected_stage TEXT CHECK (detected_stage IN ('discovery', 'demo', 'negotiation', 'closing', 'follow_up', 'general')),

  -- Extracted topics with confidence scores
  -- Schema: [{topic: string, confidence: number, mentions: number}]
  topics JSONB DEFAULT '[]',

  -- Extracted objections
  -- Schema: [{objection: string, category: string, resolved: boolean, response?: string}]
  objections JSONB DEFAULT '[]',

  -- Competitor mentions
  -- Schema: [{name: string, context: string, sentiment: string}]
  competitors JSONB DEFAULT '[]',

  -- Key phrases/keywords found
  keywords JSONB DEFAULT '[]',

  -- Counts for quick aggregation
  objection_count INTEGER DEFAULT 0,
  competitor_mention_count INTEGER DEFAULT 0,
  positive_signal_count INTEGER DEFAULT 0,
  negative_signal_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Table: meeting_aggregate_metrics
-- Purpose: Pre-computed aggregate metrics per org/period
-- =============================================================================

CREATE TABLE IF NOT EXISTS meeting_aggregate_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,

  -- Time period
  period_type TEXT NOT NULL CHECK (period_type IN ('day', 'week', 'month', 'quarter')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Meeting counts
  total_meetings INTEGER DEFAULT 0,
  meetings_with_transcripts INTEGER DEFAULT 0,
  meetings_analyzed INTEGER DEFAULT 0,

  -- Sentiment breakdown
  positive_sentiment_count INTEGER DEFAULT 0,
  neutral_sentiment_count INTEGER DEFAULT 0,
  negative_sentiment_count INTEGER DEFAULT 0,
  avg_sentiment_score NUMERIC,

  -- Outcome counts
  positive_outcome_count INTEGER DEFAULT 0,
  neutral_outcome_count INTEGER DEFAULT 0,
  negative_outcome_count INTEGER DEFAULT 0,

  -- Forward movement signals
  forward_movement_count INTEGER DEFAULT 0,
  proposal_request_count INTEGER DEFAULT 0,
  demo_request_count INTEGER DEFAULT 0,
  next_steps_established_count INTEGER DEFAULT 0,

  -- Topics/themes counts
  pricing_discussion_count INTEGER DEFAULT 0,
  competitor_mention_count INTEGER DEFAULT 0,
  timeline_discussion_count INTEGER DEFAULT 0,
  budget_discussion_count INTEGER DEFAULT 0,
  objection_count INTEGER DEFAULT 0,

  -- Top objections for the period
  -- Schema: [{objection: string, count: number, resolution_rate: number}]
  top_objections JSONB DEFAULT '[]',

  -- Top competitors mentioned
  -- Schema: [{name: string, count: number}]
  top_competitors JSONB DEFAULT '[]',

  -- Talk time averages
  avg_rep_talk_time NUMERIC,
  avg_customer_talk_time NUMERIC,

  -- Scorecard averages (if scorecards enabled)
  avg_scorecard_score NUMERIC,
  avg_discovery_questions NUMERIC,
  next_steps_rate NUMERIC,

  -- Stage breakdown
  -- Schema: {stage: count}
  stage_breakdown JSONB DEFAULT '{}',

  -- Rep-level breakdown
  -- Schema: [{user_id: string, meeting_count: number, avg_score: number, forward_movement_rate: number}]
  rep_breakdown JSONB DEFAULT '[]',

  -- Comparison to previous period
  meetings_change_pct NUMERIC,
  forward_movement_change_pct NUMERIC,
  sentiment_change_pct NUMERIC,

  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, period_type, period_start)
);

-- =============================================================================
-- Indexes
-- =============================================================================

-- Meeting classifications indexes
CREATE INDEX IF NOT EXISTS idx_meeting_classifications_meeting_id
  ON meeting_classifications(meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_classifications_org_id
  ON meeting_classifications(org_id);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_meeting_classifications_forward_movement
  ON meeting_classifications(org_id, has_forward_movement)
  WHERE has_forward_movement = true;

CREATE INDEX IF NOT EXISTS idx_meeting_classifications_proposal_request
  ON meeting_classifications(org_id, has_proposal_request)
  WHERE has_proposal_request = true;

CREATE INDEX IF NOT EXISTS idx_meeting_classifications_competitor
  ON meeting_classifications(org_id, has_competitor_mention)
  WHERE has_competitor_mention = true;

CREATE INDEX IF NOT EXISTS idx_meeting_classifications_pricing
  ON meeting_classifications(org_id, has_pricing_discussion)
  WHERE has_pricing_discussion = true;

CREATE INDEX IF NOT EXISTS idx_meeting_classifications_objection
  ON meeting_classifications(org_id, has_objection)
  WHERE has_objection = true;

CREATE INDEX IF NOT EXISTS idx_meeting_classifications_outcome
  ON meeting_classifications(org_id, outcome);

-- Aggregate metrics indexes
CREATE INDEX IF NOT EXISTS idx_meeting_aggregate_metrics_org_id
  ON meeting_aggregate_metrics(org_id);

CREATE INDEX IF NOT EXISTS idx_meeting_aggregate_metrics_period
  ON meeting_aggregate_metrics(period_type, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_meeting_aggregate_metrics_org_period
  ON meeting_aggregate_metrics(org_id, period_type, period_start DESC);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE meeting_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_aggregate_metrics ENABLE ROW LEVEL SECURITY;

-- Meeting classifications: Org members can view
CREATE POLICY "Org members can view meeting classifications"
  ON meeting_classifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = meeting_classifications.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all classifications"
  ON meeting_classifications FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Aggregate metrics: Org members can view
CREATE POLICY "Org members can view aggregate metrics"
  ON meeting_aggregate_metrics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = meeting_aggregate_metrics.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all aggregate metrics"
  ON meeting_aggregate_metrics FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================================================
-- Trigger: Auto-update timestamps
-- =============================================================================

CREATE TRIGGER trigger_update_meeting_classifications_timestamp
  BEFORE UPDATE ON meeting_classifications
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_risk_tables_timestamp();

-- =============================================================================
-- Helper Function: Get meeting counts by classification
-- =============================================================================

CREATE OR REPLACE FUNCTION get_meeting_classification_counts(
  p_org_id UUID,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_owner_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_meetings BIGINT,
  forward_movement_count BIGINT,
  proposal_request_count BIGINT,
  pricing_discussion_count BIGINT,
  competitor_mention_count BIGINT,
  objection_count BIGINT,
  demo_request_count BIGINT,
  positive_outcome_count BIGINT,
  negative_outcome_count BIGINT,
  next_steps_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_meetings,
    COUNT(*) FILTER (WHERE mc.has_forward_movement = true) as forward_movement_count,
    COUNT(*) FILTER (WHERE mc.has_proposal_request = true) as proposal_request_count,
    COUNT(*) FILTER (WHERE mc.has_pricing_discussion = true) as pricing_discussion_count,
    COUNT(*) FILTER (WHERE mc.has_competitor_mention = true) as competitor_mention_count,
    COUNT(*) FILTER (WHERE mc.has_objection = true) as objection_count,
    COUNT(*) FILTER (WHERE mc.has_demo_request = true) as demo_request_count,
    COUNT(*) FILTER (WHERE mc.outcome = 'positive') as positive_outcome_count,
    COUNT(*) FILTER (WHERE mc.outcome = 'negative') as negative_outcome_count,
    COUNT(*) FILTER (WHERE mc.has_next_steps = true) as next_steps_count
  FROM meeting_classifications mc
  INNER JOIN meetings m ON mc.meeting_id = m.id
  WHERE mc.org_id = p_org_id
    AND (p_date_from IS NULL OR m.start_time >= p_date_from)
    AND (p_date_to IS NULL OR m.start_time <= p_date_to)
    AND (p_owner_user_id IS NULL OR m.owner_user_id = p_owner_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Helper Function: Get meetings by classification filter
-- =============================================================================

CREATE OR REPLACE FUNCTION get_meetings_by_classification(
  p_org_id UUID,
  p_filter_type TEXT, -- 'forward_movement', 'proposal_request', 'competitor', 'pricing', 'objection', 'positive', 'negative'
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_owner_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  meeting_id UUID,
  meeting_title TEXT,
  meeting_date TIMESTAMPTZ,
  owner_user_id UUID,
  owner_name TEXT,
  company_name TEXT,
  outcome TEXT,
  topics JSONB,
  objections JSONB,
  competitors JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id as meeting_id,
    m.title as meeting_title,
    m.start_time as meeting_date,
    m.owner_user_id,
    COALESCE(p.full_name, u.email) as owner_name,
    c.name as company_name,
    mc.outcome,
    mc.topics,
    mc.objections,
    mc.competitors
  FROM meeting_classifications mc
  INNER JOIN meetings m ON mc.meeting_id = m.id
  LEFT JOIN companies c ON m.company_id = c.id
  LEFT JOIN auth.users u ON m.owner_user_id = u.id
  LEFT JOIN profiles p ON m.owner_user_id = p.id
  WHERE mc.org_id = p_org_id
    AND (p_date_from IS NULL OR m.start_time >= p_date_from)
    AND (p_date_to IS NULL OR m.start_time <= p_date_to)
    AND (p_owner_user_id IS NULL OR m.owner_user_id = p_owner_user_id)
    AND (
      (p_filter_type = 'forward_movement' AND mc.has_forward_movement = true) OR
      (p_filter_type = 'proposal_request' AND mc.has_proposal_request = true) OR
      (p_filter_type = 'competitor' AND mc.has_competitor_mention = true) OR
      (p_filter_type = 'pricing' AND mc.has_pricing_discussion = true) OR
      (p_filter_type = 'objection' AND mc.has_objection = true) OR
      (p_filter_type = 'demo_request' AND mc.has_demo_request = true) OR
      (p_filter_type = 'positive' AND mc.outcome = 'positive') OR
      (p_filter_type = 'negative' AND mc.outcome = 'negative') OR
      (p_filter_type = 'next_steps' AND mc.has_next_steps = true)
    )
  ORDER BY m.start_time DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Helper Function: Get top objections for a period
-- =============================================================================

CREATE OR REPLACE FUNCTION get_top_objections(
  p_org_id UUID,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  objection TEXT,
  category TEXT,
  occurrence_count BIGINT,
  resolved_count BIGINT,
  resolution_rate NUMERIC,
  sample_meetings JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH objection_data AS (
    SELECT
      obj->>'objection' as objection,
      obj->>'category' as category,
      (obj->>'resolved')::boolean as resolved,
      mc.meeting_id
    FROM meeting_classifications mc
    INNER JOIN meetings m ON mc.meeting_id = m.id
    CROSS JOIN jsonb_array_elements(mc.objections) as obj
    WHERE mc.org_id = p_org_id
      AND (p_date_from IS NULL OR m.start_time >= p_date_from)
      AND (p_date_to IS NULL OR m.start_time <= p_date_to)
  )
  SELECT
    od.objection,
    od.category,
    COUNT(*) as occurrence_count,
    COUNT(*) FILTER (WHERE od.resolved = true) as resolved_count,
    ROUND((COUNT(*) FILTER (WHERE od.resolved = true)::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100, 1) as resolution_rate,
    jsonb_agg(DISTINCT od.meeting_id) FILTER (WHERE od.meeting_id IS NOT NULL) as sample_meetings
  FROM objection_data od
  GROUP BY od.objection, od.category
  ORDER BY COUNT(*) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Helper Function: Get competitor mention analysis
-- =============================================================================

CREATE OR REPLACE FUNCTION get_competitor_analysis(
  p_org_id UUID,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  competitor_name TEXT,
  mention_count BIGINT,
  positive_mentions BIGINT,
  negative_mentions BIGINT,
  neutral_mentions BIGINT,
  recent_meetings JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH competitor_data AS (
    SELECT
      comp->>'name' as competitor_name,
      comp->>'sentiment' as sentiment,
      mc.meeting_id,
      m.start_time
    FROM meeting_classifications mc
    INNER JOIN meetings m ON mc.meeting_id = m.id
    CROSS JOIN jsonb_array_elements(mc.competitors) as comp
    WHERE mc.org_id = p_org_id
      AND (p_date_from IS NULL OR m.start_time >= p_date_from)
      AND (p_date_to IS NULL OR m.start_time <= p_date_to)
  )
  SELECT
    cd.competitor_name,
    COUNT(*) as mention_count,
    COUNT(*) FILTER (WHERE cd.sentiment = 'positive') as positive_mentions,
    COUNT(*) FILTER (WHERE cd.sentiment = 'negative') as negative_mentions,
    COUNT(*) FILTER (WHERE cd.sentiment = 'neutral') as neutral_mentions,
    (
      SELECT jsonb_agg(jsonb_build_object('meeting_id', sub.meeting_id, 'date', sub.start_time))
      FROM (
        SELECT DISTINCT ON (cd2.meeting_id) cd2.meeting_id, cd2.start_time
        FROM competitor_data cd2
        WHERE cd2.competitor_name = cd.competitor_name
        ORDER BY cd2.meeting_id, cd2.start_time DESC
        LIMIT 5
      ) sub
    ) as recent_meetings
  FROM competitor_data cd
  GROUP BY cd.competitor_name
  ORDER BY COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Helper Function: Refresh aggregate metrics for a period
-- =============================================================================

CREATE OR REPLACE FUNCTION refresh_meeting_aggregate_metrics(
  p_org_id UUID,
  p_period_type TEXT,
  p_period_start DATE
)
RETURNS VOID AS $$
DECLARE
  v_period_end DATE;
  v_prev_period_start DATE;
  v_metrics RECORD;
  v_prev_metrics RECORD;
BEGIN
  -- Calculate period end
  v_period_end := CASE p_period_type
    WHEN 'day' THEN p_period_start + interval '1 day' - interval '1 second'
    WHEN 'week' THEN p_period_start + interval '1 week' - interval '1 second'
    WHEN 'month' THEN (p_period_start + interval '1 month')::date - interval '1 second'
    WHEN 'quarter' THEN (p_period_start + interval '3 months')::date - interval '1 second'
  END;

  -- Calculate previous period start for comparison
  v_prev_period_start := CASE p_period_type
    WHEN 'day' THEN p_period_start - interval '1 day'
    WHEN 'week' THEN p_period_start - interval '1 week'
    WHEN 'month' THEN p_period_start - interval '1 month'
    WHEN 'quarter' THEN p_period_start - interval '3 months'
  END;

  -- Get current period metrics
  SELECT
    COUNT(DISTINCT m.id) as total_meetings,
    COUNT(DISTINCT m.id) FILTER (WHERE m.transcript_text IS NOT NULL AND m.transcript_text != '') as meetings_with_transcripts,
    COUNT(DISTINCT mc.meeting_id) as meetings_analyzed,
    COUNT(*) FILTER (WHERE m.sentiment_label = 'positive') as positive_sentiment_count,
    COUNT(*) FILTER (WHERE m.sentiment_label = 'neutral') as neutral_sentiment_count,
    COUNT(*) FILTER (WHERE m.sentiment_label = 'negative') as negative_sentiment_count,
    AVG(m.sentiment_score) as avg_sentiment_score,
    COUNT(*) FILTER (WHERE mc.outcome = 'positive') as positive_outcome_count,
    COUNT(*) FILTER (WHERE mc.outcome = 'neutral') as neutral_outcome_count,
    COUNT(*) FILTER (WHERE mc.outcome = 'negative') as negative_outcome_count,
    COUNT(*) FILTER (WHERE mc.has_forward_movement = true) as forward_movement_count,
    COUNT(*) FILTER (WHERE mc.has_proposal_request = true) as proposal_request_count,
    COUNT(*) FILTER (WHERE mc.has_demo_request = true) as demo_request_count,
    COUNT(*) FILTER (WHERE mc.has_next_steps = true) as next_steps_established_count,
    COUNT(*) FILTER (WHERE mc.has_pricing_discussion = true) as pricing_discussion_count,
    COUNT(*) FILTER (WHERE mc.has_competitor_mention = true) as competitor_mention_count,
    COUNT(*) FILTER (WHERE mc.has_timeline_discussion = true) as timeline_discussion_count,
    COUNT(*) FILTER (WHERE mc.has_budget_discussion = true) as budget_discussion_count,
    COUNT(*) FILTER (WHERE mc.has_objection = true) as objection_count,
    AVG(m.talk_time_rep_pct) as avg_rep_talk_time,
    AVG(m.talk_time_customer_pct) as avg_customer_talk_time
  INTO v_metrics
  FROM meetings m
  INNER JOIN organization_memberships om ON m.owner_user_id = om.user_id AND om.org_id = p_org_id
  LEFT JOIN meeting_classifications mc ON m.id = mc.meeting_id
  WHERE m.start_time >= p_period_start::timestamptz
    AND m.start_time < v_period_end::timestamptz;

  -- Get previous period for comparison
  SELECT
    COUNT(DISTINCT m.id) as total_meetings,
    COUNT(*) FILTER (WHERE mc.has_forward_movement = true) as forward_movement_count,
    AVG(m.sentiment_score) as avg_sentiment_score
  INTO v_prev_metrics
  FROM meetings m
  INNER JOIN organization_memberships om ON m.owner_user_id = om.user_id AND om.org_id = p_org_id
  LEFT JOIN meeting_classifications mc ON m.id = mc.meeting_id
  WHERE m.start_time >= v_prev_period_start::timestamptz
    AND m.start_time < p_period_start::timestamptz;

  -- Upsert metrics
  INSERT INTO meeting_aggregate_metrics (
    org_id, period_type, period_start, period_end,
    total_meetings, meetings_with_transcripts, meetings_analyzed,
    positive_sentiment_count, neutral_sentiment_count, negative_sentiment_count,
    avg_sentiment_score, positive_outcome_count, neutral_outcome_count, negative_outcome_count,
    forward_movement_count, proposal_request_count, demo_request_count, next_steps_established_count,
    pricing_discussion_count, competitor_mention_count, timeline_discussion_count,
    budget_discussion_count, objection_count,
    avg_rep_talk_time, avg_customer_talk_time,
    meetings_change_pct, forward_movement_change_pct, sentiment_change_pct,
    last_calculated_at
  )
  VALUES (
    p_org_id, p_period_type, p_period_start, v_period_end,
    v_metrics.total_meetings, v_metrics.meetings_with_transcripts, v_metrics.meetings_analyzed,
    v_metrics.positive_sentiment_count, v_metrics.neutral_sentiment_count, v_metrics.negative_sentiment_count,
    v_metrics.avg_sentiment_score, v_metrics.positive_outcome_count, v_metrics.neutral_outcome_count, v_metrics.negative_outcome_count,
    v_metrics.forward_movement_count, v_metrics.proposal_request_count, v_metrics.demo_request_count, v_metrics.next_steps_established_count,
    v_metrics.pricing_discussion_count, v_metrics.competitor_mention_count, v_metrics.timeline_discussion_count,
    v_metrics.budget_discussion_count, v_metrics.objection_count,
    v_metrics.avg_rep_talk_time, v_metrics.avg_customer_talk_time,
    CASE WHEN v_prev_metrics.total_meetings > 0 THEN
      ROUND(((v_metrics.total_meetings - v_prev_metrics.total_meetings)::numeric / v_prev_metrics.total_meetings) * 100, 1)
    END,
    CASE WHEN v_prev_metrics.forward_movement_count > 0 THEN
      ROUND(((v_metrics.forward_movement_count - v_prev_metrics.forward_movement_count)::numeric / v_prev_metrics.forward_movement_count) * 100, 1)
    END,
    CASE WHEN v_prev_metrics.avg_sentiment_score IS NOT NULL AND v_prev_metrics.avg_sentiment_score > 0 THEN
      ROUND(((v_metrics.avg_sentiment_score - v_prev_metrics.avg_sentiment_score) / v_prev_metrics.avg_sentiment_score) * 100, 1)
    END,
    NOW()
  )
  ON CONFLICT (org_id, period_type, period_start) DO UPDATE SET
    total_meetings = EXCLUDED.total_meetings,
    meetings_with_transcripts = EXCLUDED.meetings_with_transcripts,
    meetings_analyzed = EXCLUDED.meetings_analyzed,
    positive_sentiment_count = EXCLUDED.positive_sentiment_count,
    neutral_sentiment_count = EXCLUDED.neutral_sentiment_count,
    negative_sentiment_count = EXCLUDED.negative_sentiment_count,
    avg_sentiment_score = EXCLUDED.avg_sentiment_score,
    positive_outcome_count = EXCLUDED.positive_outcome_count,
    neutral_outcome_count = EXCLUDED.neutral_outcome_count,
    negative_outcome_count = EXCLUDED.negative_outcome_count,
    forward_movement_count = EXCLUDED.forward_movement_count,
    proposal_request_count = EXCLUDED.proposal_request_count,
    demo_request_count = EXCLUDED.demo_request_count,
    next_steps_established_count = EXCLUDED.next_steps_established_count,
    pricing_discussion_count = EXCLUDED.pricing_discussion_count,
    competitor_mention_count = EXCLUDED.competitor_mention_count,
    timeline_discussion_count = EXCLUDED.timeline_discussion_count,
    budget_discussion_count = EXCLUDED.budget_discussion_count,
    objection_count = EXCLUDED.objection_count,
    avg_rep_talk_time = EXCLUDED.avg_rep_talk_time,
    avg_customer_talk_time = EXCLUDED.avg_customer_talk_time,
    meetings_change_pct = EXCLUDED.meetings_change_pct,
    forward_movement_change_pct = EXCLUDED.forward_movement_change_pct,
    sentiment_change_pct = EXCLUDED.sentiment_change_pct,
    last_calculated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE meeting_classifications IS 'Per-meeting classification flags for fast aggregate queries';
COMMENT ON TABLE meeting_aggregate_metrics IS 'Pre-computed aggregate metrics per org/period';
COMMENT ON FUNCTION get_meeting_classification_counts IS 'Returns count breakdown of meeting classifications for an org';
COMMENT ON FUNCTION get_meetings_by_classification IS 'Returns meetings matching a specific classification filter';
COMMENT ON FUNCTION get_top_objections IS 'Returns most common objections with resolution rates';
COMMENT ON FUNCTION get_competitor_analysis IS 'Returns competitor mention analysis with sentiment breakdown';
COMMENT ON FUNCTION refresh_meeting_aggregate_metrics IS 'Refreshes pre-computed aggregate metrics for a period';
