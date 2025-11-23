-- =====================================================
-- Relationship Health Scores Table
-- =====================================================
-- Tracks health scores at the contact/company level (not just deal-level)
-- Enables ghost detection and relationship monitoring

CREATE TABLE IF NOT EXISTS relationship_health_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Relationship target (either contact or company)
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('contact', 'company')),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  -- Overall health
  overall_health_score INTEGER NOT NULL CHECK (overall_health_score >= 0 AND overall_health_score <= 100),
  health_status TEXT NOT NULL CHECK (health_status IN ('healthy', 'at_risk', 'critical', 'ghost')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),

  -- Communication metrics
  communication_frequency_score INTEGER CHECK (communication_frequency_score >= 0 AND communication_frequency_score <= 100),
  response_behavior_score INTEGER CHECK (response_behavior_score >= 0 AND response_behavior_score <= 100),
  engagement_quality_score INTEGER CHECK (engagement_quality_score >= 0 AND engagement_quality_score <= 100),
  sentiment_score INTEGER CHECK (sentiment_score >= 0 AND sentiment_score <= 100),
  meeting_pattern_score INTEGER CHECK (meeting_pattern_score >= 0 AND meeting_pattern_score <= 100),

  -- Raw metrics
  days_since_last_contact INTEGER,
  days_since_last_response INTEGER,
  avg_response_time_hours NUMERIC,
  response_rate_percent INTEGER CHECK (response_rate_percent >= 0 AND response_rate_percent <= 100),
  email_open_rate_percent INTEGER CHECK (email_open_rate_percent >= 0 AND email_open_rate_percent <= 100),
  meeting_count_30_days INTEGER DEFAULT 0,
  email_count_30_days INTEGER DEFAULT 0,
  total_interactions_30_days INTEGER DEFAULT 0,

  -- Communication baseline (for anomaly detection)
  baseline_response_time_hours NUMERIC,
  baseline_contact_frequency_days NUMERIC,
  baseline_meeting_frequency_days NUMERIC,

  -- Ghost detection
  is_ghost_risk BOOLEAN DEFAULT FALSE,
  ghost_signals JSONB, -- Array of ghost detection signals
  ghost_probability_percent INTEGER CHECK (ghost_probability_percent >= 0 AND ghost_probability_percent <= 100),
  days_until_predicted_ghost INTEGER,

  -- Sentiment tracking
  sentiment_trend TEXT CHECK (sentiment_trend IN ('improving', 'stable', 'declining', 'unknown')),
  avg_sentiment_last_3_interactions NUMERIC,

  -- Risk factors
  risk_factors TEXT[],

  -- Metadata
  last_meaningful_interaction JSONB, -- {type, date, topic, concerns_raised, commitments_made}
  related_deals_count INTEGER DEFAULT 0,
  total_deal_value NUMERIC DEFAULT 0,
  at_risk_deal_value NUMERIC DEFAULT 0,

  -- Timestamps
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT contact_or_company CHECK (
    (relationship_type = 'contact' AND contact_id IS NOT NULL AND company_id IS NULL) OR
    (relationship_type = 'company' AND company_id IS NOT NULL AND contact_id IS NULL)
  ),

  -- Unique constraint
  UNIQUE(user_id, relationship_type, contact_id, company_id)
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX idx_relationship_health_user ON relationship_health_scores(user_id);
CREATE INDEX idx_relationship_health_contact ON relationship_health_scores(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_relationship_health_company ON relationship_health_scores(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_relationship_health_status ON relationship_health_scores(health_status);
CREATE INDEX idx_relationship_health_ghost_risk ON relationship_health_scores(is_ghost_risk) WHERE is_ghost_risk = TRUE;
CREATE INDEX idx_relationship_health_calculated ON relationship_health_scores(last_calculated_at DESC);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

ALTER TABLE relationship_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own relationship health"
  ON relationship_health_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own relationship health"
  ON relationship_health_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own relationship health"
  ON relationship_health_scores FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own relationship health"
  ON relationship_health_scores FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- Updated at trigger
-- =====================================================

CREATE OR REPLACE FUNCTION update_relationship_health_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_relationship_health_scores_updated_at
  BEFORE UPDATE ON relationship_health_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_relationship_health_scores_updated_at();

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE relationship_health_scores IS 'Tracks health scores for relationships (contacts/companies) with ghost detection';
COMMENT ON COLUMN relationship_health_scores.ghost_signals IS 'JSONB array of detected ghost signals with severity and context';
COMMENT ON COLUMN relationship_health_scores.last_meaningful_interaction IS 'JSONB object containing details of the last significant interaction';
