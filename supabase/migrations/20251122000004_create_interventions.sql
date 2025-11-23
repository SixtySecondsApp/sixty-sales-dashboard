-- =====================================================
-- Interventions Table
-- =====================================================
-- Tracks deployed interventions and their outcomes
-- Each record represents a sent "permission to close" or re-engagement attempt

CREATE TABLE IF NOT EXISTS interventions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Target
  relationship_health_id UUID NOT NULL REFERENCES relationship_health_scores(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,

  -- Template used
  template_id UUID REFERENCES intervention_templates(id) ON DELETE SET NULL,
  template_type TEXT NOT NULL,
  context_trigger TEXT NOT NULL,

  -- Intervention content (saved copy in case template changes)
  subject_line TEXT,
  intervention_body TEXT NOT NULL,
  personalization_data JSONB, -- What personalizations were applied

  -- Channel
  intervention_channel TEXT NOT NULL DEFAULT 'email' CHECK (intervention_channel IN ('email', 'linkedin', 'phone', 'video', 'in_person')),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'sent',
    'delivered',
    'opened',
    'clicked',
    'replied',
    'recovered',
    'failed'
  )),

  -- Tracking
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  first_open_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  recovered_at TIMESTAMP WITH TIME ZONE,

  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,

  -- Response handling
  response_type TEXT CHECK (response_type IN (
    'interested_later',
    'still_interested',
    'not_interested',
    'went_competitor',
    'not_fit',
    'apologetic',
    'ghosted_again'
  )),
  response_text TEXT,
  suggested_reply TEXT, -- AI-generated suggested response

  -- Outcome
  outcome TEXT CHECK (outcome IN (
    'relationship_recovered',
    'moved_to_nurture',
    'deal_closed_won',
    'deal_closed_lost',
    'permanent_ghost',
    'pending'
  )),
  outcome_notes TEXT,

  -- Metadata
  health_score_at_send INTEGER CHECK (health_score_at_send >= 0 AND health_score_at_send <= 100),
  days_since_last_contact INTEGER,
  ai_recommendation_score NUMERIC CHECK (ai_recommendation_score >= 0 AND ai_recommendation_score <= 1), -- AI confidence 0-1
  metadata JSONB,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX idx_interventions_user ON interventions(user_id);
CREATE INDEX idx_interventions_relationship ON interventions(relationship_health_id);
CREATE INDEX idx_interventions_contact ON interventions(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_interventions_company ON interventions(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_interventions_deal ON interventions(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX idx_interventions_template ON interventions(template_id) WHERE template_id IS NOT NULL;
CREATE INDEX idx_interventions_status ON interventions(status);
CREATE INDEX idx_interventions_sent ON interventions(sent_at DESC) WHERE sent_at IS NOT NULL;
CREATE INDEX idx_interventions_outcome ON interventions(outcome) WHERE outcome IS NOT NULL;
CREATE INDEX idx_interventions_replied ON interventions(replied_at DESC) WHERE replied_at IS NOT NULL;
CREATE INDEX idx_interventions_pending ON interventions(status) WHERE status = 'pending';

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own interventions"
  ON interventions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own interventions"
  ON interventions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own interventions"
  ON interventions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own interventions"
  ON interventions FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- Updated at trigger
-- =====================================================

CREATE OR REPLACE FUNCTION update_interventions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_interventions_updated_at
  BEFORE UPDATE ON interventions
  FOR EACH ROW
  EXECUTE FUNCTION update_interventions_updated_at();

-- =====================================================
-- Trigger to update template performance on status change
-- =====================================================

CREATE OR REPLACE FUNCTION update_template_performance_on_intervention_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if we have a template_id
  IF NEW.template_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Update based on status changes
  IF OLD.status <> NEW.status THEN
    -- Opened
    IF NEW.status = 'opened' AND OLD.status <> 'opened' THEN
      PERFORM update_template_performance(NEW.template_id, opened => TRUE);
    END IF;

    -- Clicked
    IF NEW.status = 'clicked' AND OLD.status <> 'clicked' THEN
      PERFORM update_template_performance(NEW.template_id, clicked => TRUE);
    END IF;

    -- Replied
    IF NEW.status = 'replied' AND OLD.status <> 'replied' THEN
      -- Calculate response time if we have sent_at and replied_at
      IF NEW.sent_at IS NOT NULL AND NEW.replied_at IS NOT NULL THEN
        PERFORM update_template_performance(
          NEW.template_id,
          replied => TRUE,
          response_time_hours => EXTRACT(EPOCH FROM (NEW.replied_at - NEW.sent_at)) / 3600
        );
      ELSE
        PERFORM update_template_performance(NEW.template_id, replied => TRUE);
      END IF;
    END IF;

    -- Recovered
    IF NEW.status = 'recovered' AND OLD.status <> 'recovered' THEN
      PERFORM update_template_performance(NEW.template_id, recovered => TRUE);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_template_performance_on_intervention_change
  AFTER UPDATE ON interventions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_template_performance_on_intervention_change();

-- =====================================================
-- Helper Functions
-- =====================================================

-- Get active interventions for a user
CREATE OR REPLACE FUNCTION get_active_interventions(user_id_param UUID)
RETURNS SETOF interventions AS $$
  SELECT *
  FROM interventions
  WHERE user_id = user_id_param
    AND status IN ('pending', 'sent', 'delivered', 'opened')
    AND outcome = 'pending'
  ORDER BY created_at DESC;
$$ LANGUAGE SQL STABLE;

-- Get intervention success rate for a user
CREATE OR REPLACE FUNCTION get_intervention_success_rate(user_id_param UUID)
RETURNS TABLE (
  total_sent INTEGER,
  total_replied INTEGER,
  total_recovered INTEGER,
  response_rate_percent INTEGER,
  recovery_rate_percent INTEGER
) AS $$
  SELECT
    COUNT(*)::INTEGER AS total_sent,
    COUNT(*) FILTER (WHERE status IN ('replied', 'recovered'))::INTEGER AS total_replied,
    COUNT(*) FILTER (WHERE status = 'recovered')::INTEGER AS total_recovered,
    CASE
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE status IN ('replied', 'recovered'))::NUMERIC / COUNT(*)::NUMERIC) * 100)::INTEGER
      ELSE 0
    END AS response_rate_percent,
    CASE
      WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE status = 'recovered')::NUMERIC / COUNT(*)::NUMERIC) * 100)::INTEGER
      ELSE 0
    END AS recovery_rate_percent
  FROM interventions
  WHERE user_id = user_id_param
    AND status <> 'pending'
    AND sent_at IS NOT NULL;
$$ LANGUAGE SQL STABLE;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE interventions IS 'Tracks deployed interventions and their outcomes';
COMMENT ON COLUMN interventions.personalization_data IS 'JSONB containing the AI-generated personalizations applied to this intervention';
COMMENT ON COLUMN interventions.suggested_reply IS 'AI-generated suggested response when prospect replies';
COMMENT ON COLUMN interventions.ai_recommendation_score IS 'AI confidence score (0-1) for template selection';
COMMENT ON COLUMN interventions.health_score_at_send IS 'Relationship health score at the time intervention was sent (for analysis)';
