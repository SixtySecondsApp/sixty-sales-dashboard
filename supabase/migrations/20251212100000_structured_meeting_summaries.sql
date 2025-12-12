-- Migration: Structured Meeting Summaries
-- Purpose: Store AI-extracted structured data from meeting transcripts
-- Date: 2025-12-12

-- =============================================================================
-- Table: meeting_structured_summaries
-- Purpose: Store structured data extracted from meeting transcripts by AI
-- =============================================================================

CREATE TABLE IF NOT EXISTS meeting_structured_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE UNIQUE,
  org_id UUID NOT NULL,

  -- Key Decisions made during the meeting
  key_decisions JSONB DEFAULT '[]',
  -- Schema: [{decision: string, context: string, importance: 'high'|'medium'|'low'}]

  -- Commitments made by the rep
  rep_commitments JSONB DEFAULT '[]',
  -- Schema: [{commitment: string, due_date?: string, priority: 'high'|'medium'|'low'}]

  -- Commitments made by the prospect
  prospect_commitments JSONB DEFAULT '[]',
  -- Schema: [{commitment: string, expectation?: string}]

  -- Stakeholders mentioned in the meeting
  stakeholders_mentioned JSONB DEFAULT '[]',
  -- Schema: [{name: string, role?: string, concerns: string[], sentiment: 'positive'|'neutral'|'negative'}]

  -- Pricing/commercial details discussed
  pricing_discussed JSONB DEFAULT '{}',
  -- Schema: {mentioned: boolean, amount?: number, structure?: string, objections?: string[], notes?: string}

  -- Technical requirements captured
  technical_requirements JSONB DEFAULT '[]',
  -- Schema: [{requirement: string, priority: 'high'|'medium'|'low', notes?: string}]

  -- Outcome signals (positive/negative indicators)
  outcome_signals JSONB DEFAULT '{}',
  -- Schema: {
  --   overall: 'positive'|'negative'|'neutral',
  --   positive_signals: string[],
  --   negative_signals: string[],
  --   next_steps: string[],
  --   forward_movement: boolean
  -- }

  -- Stage indicators (detected sales stage signals)
  stage_indicators JSONB DEFAULT '{}',
  -- Schema: {
  --   detected_stage: 'discovery'|'demo'|'negotiation'|'closing'|'general',
  --   confidence: number (0-1),
  --   signals: string[]
  -- }

  -- Competitor mentions
  competitor_mentions JSONB DEFAULT '[]',
  -- Schema: [{name: string, context: string, sentiment: 'positive'|'neutral'|'negative'}]

  -- Objections raised
  objections JSONB DEFAULT '[]',
  -- Schema: [{objection: string, response?: string, resolved: boolean}]

  -- Processing metadata
  ai_model_used TEXT,
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  version INTEGER DEFAULT 1,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_meeting_structured_summaries_meeting_id
  ON meeting_structured_summaries(meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_structured_summaries_org_id
  ON meeting_structured_summaries(org_id);

-- GIN indexes for JSONB queries
CREATE INDEX IF NOT EXISTS idx_meeting_structured_summaries_outcome_signals
  ON meeting_structured_summaries USING GIN (outcome_signals);

CREATE INDEX IF NOT EXISTS idx_meeting_structured_summaries_competitor_mentions
  ON meeting_structured_summaries USING GIN (competitor_mentions);

CREATE INDEX IF NOT EXISTS idx_meeting_structured_summaries_objections
  ON meeting_structured_summaries USING GIN (objections);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE meeting_structured_summaries ENABLE ROW LEVEL SECURITY;

-- Org members can view summaries for their org
CREATE POLICY "Org members can view structured summaries"
  ON meeting_structured_summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = meeting_structured_summaries.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  );

-- Service role can manage all summaries (for edge functions)
CREATE POLICY "Service role can manage all structured summaries"
  ON meeting_structured_summaries FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================================================
-- Trigger: Auto-update updated_at timestamp
-- =============================================================================

CREATE OR REPLACE FUNCTION update_meeting_structured_summaries_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_meeting_structured_summaries_timestamp
  BEFORE UPDATE ON meeting_structured_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_structured_summaries_timestamp();

-- =============================================================================
-- Helper Function: Get structured summary for a meeting
-- =============================================================================

CREATE OR REPLACE FUNCTION get_meeting_structured_summary(p_meeting_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_summary JSONB;
BEGIN
  SELECT row_to_json(mss.*)::JSONB
  INTO v_summary
  FROM meeting_structured_summaries mss
  WHERE mss.meeting_id = p_meeting_id;

  RETURN COALESCE(v_summary, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Helper Function: Get meetings with forward movement in date range
-- =============================================================================

CREATE OR REPLACE FUNCTION get_meetings_with_forward_movement(
  p_org_id UUID,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  meeting_id UUID,
  meeting_title TEXT,
  meeting_date TIMESTAMPTZ,
  owner_user_id UUID,
  company_name TEXT,
  positive_signals JSONB,
  next_steps JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id as meeting_id,
    m.title as meeting_title,
    m.start_time as meeting_date,
    m.owner_user_id,
    c.name as company_name,
    mss.outcome_signals->'positive_signals' as positive_signals,
    mss.outcome_signals->'next_steps' as next_steps
  FROM meeting_structured_summaries mss
  INNER JOIN meetings m ON mss.meeting_id = m.id
  LEFT JOIN companies c ON m.company_id = c.id
  WHERE mss.org_id = p_org_id
    AND (mss.outcome_signals->>'forward_movement')::boolean = true
    AND (p_date_from IS NULL OR m.start_time >= p_date_from)
    AND (p_date_to IS NULL OR m.start_time <= p_date_to)
  ORDER BY m.start_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Helper Function: Get meetings with competitor mentions
-- =============================================================================

CREATE OR REPLACE FUNCTION get_meetings_with_competitors(
  p_org_id UUID,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  meeting_id UUID,
  meeting_title TEXT,
  meeting_date TIMESTAMPTZ,
  owner_user_id UUID,
  company_name TEXT,
  competitor_mentions JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id as meeting_id,
    m.title as meeting_title,
    m.start_time as meeting_date,
    m.owner_user_id,
    c.name as company_name,
    mss.competitor_mentions
  FROM meeting_structured_summaries mss
  INNER JOIN meetings m ON mss.meeting_id = m.id
  LEFT JOIN companies c ON m.company_id = c.id
  WHERE mss.org_id = p_org_id
    AND jsonb_array_length(mss.competitor_mentions) > 0
    AND (p_date_from IS NULL OR m.start_time >= p_date_from)
    AND (p_date_to IS NULL OR m.start_time <= p_date_to)
  ORDER BY m.start_time DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE meeting_structured_summaries IS 'AI-extracted structured data from meeting transcripts including decisions, commitments, stakeholders, pricing, and outcome signals';
COMMENT ON FUNCTION get_meeting_structured_summary IS 'Returns structured summary for a specific meeting';
COMMENT ON FUNCTION get_meetings_with_forward_movement IS 'Returns meetings where forward movement was detected';
COMMENT ON FUNCTION get_meetings_with_competitors IS 'Returns meetings where competitors were mentioned';
