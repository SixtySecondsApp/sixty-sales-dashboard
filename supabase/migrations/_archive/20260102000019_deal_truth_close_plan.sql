-- Migration: Deal Truth + Close Plan
-- Purpose: Add Deal Truth fields (clarity scoring) and Close Plan milestones (execution tracking)
-- Date: 2026-01-02

-- =============================================================================
-- Table: deal_truth_fields
-- Purpose: 6 core fields that answer "do we actually know this deal?"
-- =============================================================================

CREATE TABLE IF NOT EXISTS deal_truth_fields (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Field identification
  field_key TEXT NOT NULL CHECK (field_key IN (
    'pain',             -- What is the customer's pain point?
    'success_metric',   -- How will they measure success?
    'champion',         -- Who is the internal champion?
    'economic_buyer',   -- Who controls the budget?
    'next_step',        -- What's the next dated step?
    'top_risks'         -- What are the top risks?
  )),

  -- Field value and metadata
  value TEXT,                                      -- The actual value
  confidence DECIMAL(3,2) DEFAULT 0.50             -- 0.00-1.00 confidence level
    CHECK (confidence >= 0 AND confidence <= 1),

  -- Source tracking for provenance
  source TEXT CHECK (source IN (
    'meeting_transcript',  -- Extracted from Fathom meeting
    'email',               -- Extracted from email
    'crm_sync',            -- From HubSpot/Salesforce sync
    'manual',              -- Manual entry by user
    'ai_inferred'          -- AI inferred from context
  )),
  source_id UUID,                                  -- Reference to meeting/email/etc

  -- For champion and economic_buyer, link to contact
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- For champion, track strength indicator
  champion_strength TEXT CHECK (champion_strength IN (
    'strong',    -- Actively advocating
    'moderate',  -- Supportive but not pushing
    'weak',      -- Interested but limited influence
    'unknown'    -- Not yet determined
  )),

  -- For next_step, track if it has a date
  next_step_date DATE,

  -- Timestamps
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One field per deal
  UNIQUE(deal_id, field_key)
);

-- =============================================================================
-- Table: deal_close_plan_items
-- Purpose: 6 milestones that show deal progression (lightweight execution tracker)
-- =============================================================================

CREATE TABLE IF NOT EXISTS deal_close_plan_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Milestone identification
  milestone_key TEXT NOT NULL CHECK (milestone_key IN (
    'success_criteria',     -- Success criteria confirmed with customer
    'stakeholders_mapped',  -- All stakeholders identified and mapped
    'solution_fit',         -- Solution fit confirmed (usually SE involved)
    'commercials_aligned',  -- Pricing and terms aligned
    'legal_procurement',    -- Legal/procurement process progressing
    'signature_kickoff'     -- Contract signed and kickoff scheduled
  )),

  title TEXT NOT NULL,

  -- Ownership and timeline
  owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date DATE,

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Not started
    'in_progress',  -- Currently being worked on
    'completed',    -- Done
    'blocked',      -- Blocked by something
    'skipped'       -- Not applicable for this deal
  )),

  -- Blocker tracking (when status = 'blocked')
  blocker_note TEXT,

  -- Link to task (only created when needed, not upfront)
  linked_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,

  -- Ordering and completion
  sort_order INT DEFAULT 0,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One milestone per deal
  UNIQUE(deal_id, milestone_key)
);

-- =============================================================================
-- Table: deal_clarity_scores
-- Purpose: Denormalized clarity score per deal for fast queries
-- =============================================================================

CREATE TABLE IF NOT EXISTS deal_clarity_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE UNIQUE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Overall clarity score (0-100)
  clarity_score INTEGER CHECK (clarity_score >= 0 AND clarity_score <= 100),

  -- Individual field scores for breakdown
  next_step_score INTEGER DEFAULT 0,       -- 30 points max
  economic_buyer_score INTEGER DEFAULT 0,  -- 25 points max
  champion_score INTEGER DEFAULT 0,        -- 20 points max
  success_metric_score INTEGER DEFAULT 0,  -- 15 points max
  risks_score INTEGER DEFAULT 0,           -- 10 points max

  -- Close plan progress
  close_plan_completed INTEGER DEFAULT 0,
  close_plan_total INTEGER DEFAULT 6,
  close_plan_overdue INTEGER DEFAULT 0,

  -- Momentum score (combines health + risk + clarity + plan)
  momentum_score INTEGER CHECK (momentum_score >= 0 AND momentum_score <= 100),

  -- Last calculation timestamp
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Indexes
-- =============================================================================

-- deal_truth_fields indexes
CREATE INDEX IF NOT EXISTS idx_deal_truth_fields_deal_id
  ON deal_truth_fields(deal_id);

CREATE INDEX IF NOT EXISTS idx_deal_truth_fields_org_id
  ON deal_truth_fields(org_id);

CREATE INDEX IF NOT EXISTS idx_deal_truth_fields_field_key
  ON deal_truth_fields(field_key);

CREATE INDEX IF NOT EXISTS idx_deal_truth_fields_confidence
  ON deal_truth_fields(confidence) WHERE confidence < 0.6;

CREATE INDEX IF NOT EXISTS idx_deal_truth_fields_contact_id
  ON deal_truth_fields(contact_id) WHERE contact_id IS NOT NULL;

-- deal_close_plan_items indexes
CREATE INDEX IF NOT EXISTS idx_deal_close_plan_items_deal_id
  ON deal_close_plan_items(deal_id);

CREATE INDEX IF NOT EXISTS idx_deal_close_plan_items_org_id
  ON deal_close_plan_items(org_id);

CREATE INDEX IF NOT EXISTS idx_deal_close_plan_items_status
  ON deal_close_plan_items(status);

CREATE INDEX IF NOT EXISTS idx_deal_close_plan_items_owner_id
  ON deal_close_plan_items(owner_id) WHERE owner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deal_close_plan_items_due_date
  ON deal_close_plan_items(due_date) WHERE due_date IS NOT NULL;

-- Note: Overdue items are queried dynamically rather than via partial index
-- because CURRENT_DATE is not immutable

-- deal_clarity_scores indexes
CREATE INDEX IF NOT EXISTS idx_deal_clarity_scores_org_id
  ON deal_clarity_scores(org_id);

CREATE INDEX IF NOT EXISTS idx_deal_clarity_scores_clarity
  ON deal_clarity_scores(clarity_score);

CREATE INDEX IF NOT EXISTS idx_deal_clarity_scores_momentum
  ON deal_clarity_scores(momentum_score);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE deal_truth_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_close_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_clarity_scores ENABLE ROW LEVEL SECURITY;

-- deal_truth_fields policies
CREATE POLICY "Org members can view deal truth fields"
  ON deal_truth_fields FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = deal_truth_fields.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert deal truth fields"
  ON deal_truth_fields FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = deal_truth_fields.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update deal truth fields"
  ON deal_truth_fields FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = deal_truth_fields.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = deal_truth_fields.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete deal truth fields"
  ON deal_truth_fields FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = deal_truth_fields.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all truth fields"
  ON deal_truth_fields FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- deal_close_plan_items policies
CREATE POLICY "Org members can view close plan items"
  ON deal_close_plan_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = deal_close_plan_items.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can insert close plan items"
  ON deal_close_plan_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = deal_close_plan_items.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can update close plan items"
  ON deal_close_plan_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = deal_close_plan_items.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = deal_close_plan_items.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Org members can delete close plan items"
  ON deal_close_plan_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = deal_close_plan_items.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all close plan items"
  ON deal_close_plan_items FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- deal_clarity_scores policies
CREATE POLICY "Org members can view clarity scores"
  ON deal_clarity_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = deal_clarity_scores.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all clarity scores"
  ON deal_clarity_scores FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================================================
-- Triggers: Auto-update timestamps
-- =============================================================================

CREATE OR REPLACE FUNCTION update_deal_truth_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_deal_truth_fields_timestamp
  BEFORE UPDATE ON deal_truth_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_truth_timestamp();

CREATE OR REPLACE FUNCTION update_deal_close_plan_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  -- Auto-set completed_at when status changes to completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_deal_close_plan_timestamp
  BEFORE UPDATE ON deal_close_plan_items
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_close_plan_timestamp();

CREATE OR REPLACE FUNCTION update_deal_clarity_scores_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_deal_clarity_scores_timestamp
  BEFORE UPDATE ON deal_clarity_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_clarity_scores_timestamp();

-- =============================================================================
-- Function: Calculate clarity score for a deal
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_deal_clarity_score(p_deal_id UUID)
RETURNS TABLE (
  clarity_score INTEGER,
  next_step_score INTEGER,
  economic_buyer_score INTEGER,
  champion_score INTEGER,
  success_metric_score INTEGER,
  risks_score INTEGER
) AS $$
DECLARE
  v_next_step RECORD;
  v_eb RECORD;
  v_champion RECORD;
  v_success RECORD;
  v_risks RECORD;
  v_ns_score INTEGER := 0;
  v_eb_score INTEGER := 0;
  v_ch_score INTEGER := 0;
  v_sm_score INTEGER := 0;
  v_rk_score INTEGER := 0;
BEGIN
  -- Next step (30 points max)
  SELECT value, next_step_date INTO v_next_step
  FROM deal_truth_fields
  WHERE deal_id = p_deal_id AND field_key = 'next_step';

  IF v_next_step.value IS NOT NULL AND v_next_step.value != '' THEN
    IF v_next_step.next_step_date IS NOT NULL THEN
      v_ns_score := 30;  -- Has next step with date
    ELSE
      v_ns_score := 15;  -- Has next step but no date
    END IF;
  END IF;

  -- Economic buyer (25 points max)
  SELECT value, confidence, contact_id INTO v_eb
  FROM deal_truth_fields
  WHERE deal_id = p_deal_id AND field_key = 'economic_buyer';

  IF v_eb.contact_id IS NOT NULL THEN
    v_eb_score := 25;  -- Known and linked
  ELSIF v_eb.value IS NOT NULL AND v_eb.value != '' THEN
    IF v_eb.confidence >= 0.8 THEN
      v_eb_score := 20;  -- High confidence
    ELSIF v_eb.confidence >= 0.5 THEN
      v_eb_score := 12;  -- Medium confidence
    ELSE
      v_eb_score := 5;   -- Low confidence
    END IF;
  END IF;

  -- Champion (20 points max)
  SELECT value, champion_strength, contact_id INTO v_champion
  FROM deal_truth_fields
  WHERE deal_id = p_deal_id AND field_key = 'champion';

  IF v_champion.contact_id IS NOT NULL THEN
    IF v_champion.champion_strength = 'strong' THEN
      v_ch_score := 20;
    ELSIF v_champion.champion_strength = 'moderate' THEN
      v_ch_score := 15;
    ELSIF v_champion.champion_strength = 'weak' THEN
      v_ch_score := 10;
    ELSE
      v_ch_score := 8;  -- Known but strength unknown
    END IF;
  ELSIF v_champion.value IS NOT NULL AND v_champion.value != '' THEN
    v_ch_score := 5;  -- Name mentioned but not linked
  END IF;

  -- Success metric (15 points max)
  SELECT value, confidence INTO v_success
  FROM deal_truth_fields
  WHERE deal_id = p_deal_id AND field_key = 'success_metric';

  IF v_success.value IS NOT NULL AND v_success.value != '' THEN
    IF v_success.confidence >= 0.7 THEN
      v_sm_score := 15;
    ELSIF v_success.confidence >= 0.4 THEN
      v_sm_score := 10;
    ELSE
      v_sm_score := 5;
    END IF;
  END IF;

  -- Risks documented (10 points max)
  SELECT value INTO v_risks
  FROM deal_truth_fields
  WHERE deal_id = p_deal_id AND field_key = 'top_risks';

  IF v_risks.value IS NOT NULL AND v_risks.value != '' THEN
    v_rk_score := 10;
  END IF;

  RETURN QUERY SELECT
    (v_ns_score + v_eb_score + v_ch_score + v_sm_score + v_rk_score)::INTEGER,
    v_ns_score,
    v_eb_score,
    v_ch_score,
    v_sm_score,
    v_rk_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Function: Calculate close plan progress
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_close_plan_progress(p_deal_id UUID)
RETURNS TABLE (
  completed INTEGER,
  total INTEGER,
  overdue INTEGER,
  progress_pct INTEGER
) AS $$
DECLARE
  v_completed INTEGER;
  v_total INTEGER;
  v_overdue INTEGER;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status != 'skipped'),
    COUNT(*) FILTER (WHERE status NOT IN ('completed', 'skipped') AND due_date < CURRENT_DATE)
  INTO v_completed, v_total, v_overdue
  FROM deal_close_plan_items
  WHERE deal_id = p_deal_id;

  RETURN QUERY SELECT
    v_completed,
    GREATEST(v_total, 1),  -- Avoid division by zero
    v_overdue,
    CASE WHEN v_total > 0
      THEN ((v_completed * 100) / v_total)::INTEGER
      ELSE 0
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Function: Calculate momentum score
-- Combines: health (55%) + inverse_risk (25%) + clarity (20%)
-- With penalty for overdue milestones
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_deal_momentum_score(p_deal_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_health_score INTEGER;
  v_risk_score INTEGER;
  v_clarity_result RECORD;
  v_plan_result RECORD;
  v_momentum INTEGER;
  v_overdue_penalty INTEGER;
BEGIN
  -- Get health score
  SELECT overall_health_score INTO v_health_score
  FROM deal_health_scores
  WHERE deal_id = p_deal_id;

  v_health_score := COALESCE(v_health_score, 50);  -- Default to 50 if not calculated

  -- Get risk score (inverted: high risk = low score)
  SELECT risk_score INTO v_risk_score
  FROM deal_risk_aggregates
  WHERE deal_id = p_deal_id;

  v_risk_score := 100 - COALESCE(v_risk_score, 50);  -- Invert risk score

  -- Get clarity score
  SELECT * INTO v_clarity_result
  FROM calculate_deal_clarity_score(p_deal_id);

  -- Get close plan progress
  SELECT * INTO v_plan_result
  FROM calculate_close_plan_progress(p_deal_id);

  -- Calculate overdue penalty (5 points per overdue milestone, max 20)
  v_overdue_penalty := LEAST(COALESCE(v_plan_result.overdue, 0) * 5, 20);

  -- Calculate momentum: health(55%) + risk(25%) + clarity(20%) - overdue penalty
  v_momentum := (
    (COALESCE(v_clarity_result.clarity_score, 0) * 0.55) +
    (v_risk_score * 0.25) +
    (v_health_score * 0.20)
  )::INTEGER - v_overdue_penalty;

  -- Clamp to 0-100
  v_momentum := GREATEST(0, LEAST(100, v_momentum));

  RETURN v_momentum;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Function: Upsert and recalculate clarity score for a deal
-- =============================================================================

CREATE OR REPLACE FUNCTION upsert_deal_clarity_score(p_deal_id UUID, p_org_id UUID)
RETURNS VOID AS $$
DECLARE
  v_clarity RECORD;
  v_plan RECORD;
  v_momentum INTEGER;
BEGIN
  -- Calculate clarity
  SELECT * INTO v_clarity FROM calculate_deal_clarity_score(p_deal_id);

  -- Calculate close plan progress
  SELECT * INTO v_plan FROM calculate_close_plan_progress(p_deal_id);

  -- Calculate momentum
  v_momentum := calculate_deal_momentum_score(p_deal_id);

  -- Upsert
  INSERT INTO deal_clarity_scores (
    deal_id, org_id, clarity_score,
    next_step_score, economic_buyer_score, champion_score,
    success_metric_score, risks_score,
    close_plan_completed, close_plan_total, close_plan_overdue,
    momentum_score, last_calculated_at
  )
  VALUES (
    p_deal_id, p_org_id, v_clarity.clarity_score,
    v_clarity.next_step_score, v_clarity.economic_buyer_score, v_clarity.champion_score,
    v_clarity.success_metric_score, v_clarity.risks_score,
    v_plan.completed, v_plan.total, v_plan.overdue,
    v_momentum, NOW()
  )
  ON CONFLICT (deal_id) DO UPDATE SET
    clarity_score = EXCLUDED.clarity_score,
    next_step_score = EXCLUDED.next_step_score,
    economic_buyer_score = EXCLUDED.economic_buyer_score,
    champion_score = EXCLUDED.champion_score,
    success_metric_score = EXCLUDED.success_metric_score,
    risks_score = EXCLUDED.risks_score,
    close_plan_completed = EXCLUDED.close_plan_completed,
    close_plan_total = EXCLUDED.close_plan_total,
    close_plan_overdue = EXCLUDED.close_plan_overdue,
    momentum_score = EXCLUDED.momentum_score,
    last_calculated_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Function: Initialize close plan for a deal
-- Creates the 6 standard milestones
-- =============================================================================

CREATE OR REPLACE FUNCTION initialize_deal_close_plan(
  p_deal_id UUID,
  p_org_id UUID,
  p_owner_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO deal_close_plan_items (deal_id, org_id, milestone_key, title, owner_id, sort_order)
  VALUES
    (p_deal_id, p_org_id, 'success_criteria', 'Success criteria confirmed', p_owner_id, 1),
    (p_deal_id, p_org_id, 'stakeholders_mapped', 'Stakeholders mapped', p_owner_id, 2),
    (p_deal_id, p_org_id, 'solution_fit', 'Solution fit confirmed', p_owner_id, 3),
    (p_deal_id, p_org_id, 'commercials_aligned', 'Commercials aligned', p_owner_id, 4),
    (p_deal_id, p_org_id, 'legal_procurement', 'Legal/procurement progressing', p_owner_id, 5),
    (p_deal_id, p_org_id, 'signature_kickoff', 'Signature + kickoff scheduled', p_owner_id, 6)
  ON CONFLICT (deal_id, milestone_key) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Function: Get deal truth snapshot (for Slack cards)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_deal_truth_snapshot(p_deal_id UUID)
RETURNS TABLE (
  field_key TEXT,
  value TEXT,
  confidence DECIMAL,
  source TEXT,
  contact_name TEXT,
  champion_strength TEXT,
  next_step_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dtf.field_key,
    dtf.value,
    dtf.confidence,
    dtf.source,
    c.name as contact_name,
    dtf.champion_strength,
    dtf.next_step_date
  FROM deal_truth_fields dtf
  LEFT JOIN contacts c ON dtf.contact_id = c.id
  WHERE dtf.deal_id = p_deal_id
  ORDER BY
    CASE dtf.field_key
      WHEN 'next_step' THEN 1
      WHEN 'economic_buyer' THEN 2
      WHEN 'champion' THEN 3
      WHEN 'success_metric' THEN 4
      WHEN 'pain' THEN 5
      WHEN 'top_risks' THEN 6
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Function: Get deals needing attention (low clarity or at risk)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_deals_needing_attention(
  p_org_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_min_clarity_score INTEGER DEFAULT 50,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  deal_id UUID,
  deal_name TEXT,
  company_name TEXT,
  deal_value NUMERIC,
  deal_stage TEXT,
  clarity_score INTEGER,
  momentum_score INTEGER,
  health_status TEXT,
  risk_level TEXT,
  close_plan_progress INTEGER,
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
    COALESCE(dcs.clarity_score, 0) as clarity_score,
    COALESCE(dcs.momentum_score, 50) as momentum_score,
    COALESCE(dhs.health_status, 'unknown') as health_status,
    COALESCE(dra.overall_risk_level, 'unknown') as risk_level,
    COALESCE(dcs.close_plan_completed * 100 / NULLIF(dcs.close_plan_total, 0), 0)::INTEGER as close_plan_progress,
    d.user_id as owner_user_id
  FROM deals d
  LEFT JOIN companies c ON d.company_id = c.id
  LEFT JOIN deal_stages ds ON d.stage_id = ds.id
  LEFT JOIN deal_clarity_scores dcs ON d.id = dcs.deal_id
  LEFT JOIN deal_health_scores dhs ON d.id = dhs.deal_id
  LEFT JOIN deal_risk_aggregates dra ON d.id = dra.deal_id
  WHERE d.org_id = p_org_id
    AND d.status = 'active'
    AND (p_user_id IS NULL OR d.user_id = p_user_id)
    AND (
      COALESCE(dcs.clarity_score, 0) < p_min_clarity_score OR
      dhs.health_status IN ('warning', 'critical', 'stalled') OR
      dra.overall_risk_level IN ('high', 'critical')
    )
  ORDER BY
    COALESCE(dcs.momentum_score, 0) ASC,
    d.value DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Trigger: Auto-recalculate clarity score when truth fields change
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_recalculate_clarity_on_truth_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM upsert_deal_clarity_score(OLD.deal_id, OLD.org_id);
    RETURN OLD;
  ELSE
    PERFORM upsert_deal_clarity_score(NEW.deal_id, NEW.org_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_truth_fields_recalc_clarity
  AFTER INSERT OR UPDATE OR DELETE ON deal_truth_fields
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_clarity_on_truth_change();

-- =============================================================================
-- Trigger: Auto-recalculate clarity score when close plan changes
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_recalculate_clarity_on_plan_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM upsert_deal_clarity_score(OLD.deal_id, OLD.org_id);
    RETURN OLD;
  ELSE
    PERFORM upsert_deal_clarity_score(NEW.deal_id, NEW.org_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_close_plan_recalc_clarity
  AFTER INSERT OR UPDATE OR DELETE ON deal_close_plan_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_clarity_on_plan_change();

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE deal_truth_fields IS 'Core deal truth fields (pain, champion, EB, next step, etc.) with confidence scoring';
COMMENT ON TABLE deal_close_plan_items IS 'Lightweight execution tracker with 6 standard milestones per deal';
COMMENT ON TABLE deal_clarity_scores IS 'Denormalized clarity and momentum scores for fast dashboard queries';

COMMENT ON FUNCTION calculate_deal_clarity_score IS 'Calculates clarity score (0-100) based on truth field completeness';
COMMENT ON FUNCTION calculate_deal_momentum_score IS 'Combines health (55%) + inverse_risk (25%) + clarity (20%) - overdue penalty';
COMMENT ON FUNCTION get_deal_truth_snapshot IS 'Returns all truth fields for a deal, used for Slack cards';
COMMENT ON FUNCTION get_deals_needing_attention IS 'Returns deals with low clarity or at-risk status';
COMMENT ON FUNCTION initialize_deal_close_plan IS 'Creates the 6 standard milestones for a deal';
