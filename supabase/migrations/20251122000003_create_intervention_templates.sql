-- =====================================================
-- Intervention Templates Table
-- =====================================================
-- Library of "permission to close" templates for re-engaging ghosting prospects
-- Includes system templates and user-created custom templates

CREATE TABLE IF NOT EXISTS intervention_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for system templates

  -- Template details
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN (
    'permission_to_close',
    'value_add',
    'pattern_interrupt',
    'soft_checkin',
    'channel_switch'
  )),
  context_trigger TEXT NOT NULL CHECK (context_trigger IN (
    'after_proposal',
    'after_demo',
    'after_meeting_noshow',
    'multiple_followups_ignored',
    'after_technical_questions',
    'champion_quiet',
    'general_ghosting',
    'meeting_rescheduled',
    'email_opens_stopped',
    'response_time_increased'
  )),

  -- Template content
  subject_line TEXT,
  template_body TEXT NOT NULL,

  -- Personalization fields (AI will replace these)
  personalization_fields JSONB, -- {last_meaningful_interaction, personalized_assumption, reconnect_suggestion}

  -- A/B testing
  is_control_variant BOOLEAN DEFAULT FALSE,
  variant_name TEXT, -- 'control', 'specific', 'vulnerable', 'question', 'competitive', 'time_specific'
  parent_template_id UUID REFERENCES intervention_templates(id) ON DELETE SET NULL, -- Link to parent if this is a variant

  -- Performance metrics
  times_sent INTEGER DEFAULT 0,
  times_opened INTEGER DEFAULT 0,
  times_clicked INTEGER DEFAULT 0,
  times_replied INTEGER DEFAULT 0,
  times_recovered INTEGER DEFAULT 0, -- Led to re-engagement
  avg_response_time_hours NUMERIC,
  response_rate_percent INTEGER,
  recovery_rate_percent INTEGER,

  -- Effectiveness by segment
  best_performing_persona TEXT,
  best_performing_industry TEXT,
  best_performing_deal_stage TEXT,
  performance_by_segment JSONB, -- Detailed breakdown by persona/industry/stage

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_system_template BOOLEAN DEFAULT FALSE,

  -- Metadata
  description TEXT,
  usage_notes TEXT,
  recommended_timing TEXT, -- e.g., "After 2-3 ignored follow-ups"
  tags TEXT[],

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX idx_intervention_templates_user ON intervention_templates(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_intervention_templates_type ON intervention_templates(template_type);
CREATE INDEX idx_intervention_templates_context ON intervention_templates(context_trigger);
CREATE INDEX idx_intervention_templates_active ON intervention_templates(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_intervention_templates_system ON intervention_templates(is_system_template) WHERE is_system_template = TRUE;
CREATE INDEX idx_intervention_templates_parent ON intervention_templates(parent_template_id) WHERE parent_template_id IS NOT NULL;
CREATE INDEX idx_intervention_templates_performance ON intervention_templates(recovery_rate_percent DESC NULLS LAST);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================

ALTER TABLE intervention_templates ENABLE ROW LEVEL SECURITY;

-- Users can view system templates and their own templates
CREATE POLICY "Users can view system and own templates"
  ON intervention_templates FOR SELECT
  USING (is_system_template = TRUE OR auth.uid() = user_id);

-- Users can insert own templates
CREATE POLICY "Users can insert own templates"
  ON intervention_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_system_template = FALSE);

-- Users can update own templates (not system templates)
CREATE POLICY "Users can update own templates"
  ON intervention_templates FOR UPDATE
  USING (auth.uid() = user_id AND is_system_template = FALSE);

-- Users can delete own templates (not system templates)
CREATE POLICY "Users can delete own templates"
  ON intervention_templates FOR DELETE
  USING (auth.uid() = user_id AND is_system_template = FALSE);

-- =====================================================
-- Updated at trigger
-- =====================================================

CREATE OR REPLACE FUNCTION update_intervention_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_intervention_templates_updated_at
  BEFORE UPDATE ON intervention_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_intervention_templates_updated_at();

-- =====================================================
-- Helper Functions
-- =====================================================

-- Update template performance metrics after intervention is sent/responded
CREATE OR REPLACE FUNCTION update_template_performance(
  template_id_param UUID,
  opened BOOLEAN DEFAULT FALSE,
  clicked BOOLEAN DEFAULT FALSE,
  replied BOOLEAN DEFAULT FALSE,
  recovered BOOLEAN DEFAULT FALSE,
  response_time_hours NUMERIC DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  current_template RECORD;
  new_response_rate INTEGER;
  new_recovery_rate INTEGER;
  new_avg_response_time NUMERIC;
BEGIN
  -- Get current template metrics
  SELECT * INTO current_template FROM intervention_templates WHERE id = template_id_param;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Update last_used_at
  UPDATE intervention_templates
  SET last_used_at = NOW()
  WHERE id = template_id_param;

  -- Increment counters
  UPDATE intervention_templates
  SET
    times_sent = times_sent + 1,
    times_opened = CASE WHEN opened THEN times_opened + 1 ELSE times_opened END,
    times_clicked = CASE WHEN clicked THEN times_clicked + 1 ELSE times_clicked END,
    times_replied = CASE WHEN replied THEN times_replied + 1 ELSE times_replied END,
    times_recovered = CASE WHEN recovered THEN times_recovered + 1 ELSE times_recovered END
  WHERE id = template_id_param;

  -- Recalculate rates
  SELECT
    CASE WHEN times_sent > 0 THEN ROUND((times_replied::NUMERIC / times_sent::NUMERIC) * 100) ELSE 0 END,
    CASE WHEN times_sent > 0 THEN ROUND((times_recovered::NUMERIC / times_sent::NUMERIC) * 100) ELSE 0 END
  INTO new_response_rate, new_recovery_rate
  FROM intervention_templates
  WHERE id = template_id_param;

  -- Calculate new average response time if provided
  IF response_time_hours IS NOT NULL THEN
    SELECT
      CASE
        WHEN avg_response_time_hours IS NULL THEN response_time_hours
        ELSE ((avg_response_time_hours * (times_replied - 1)) + response_time_hours) / times_replied
      END
    INTO new_avg_response_time
    FROM intervention_templates
    WHERE id = template_id_param;

    UPDATE intervention_templates
    SET avg_response_time_hours = new_avg_response_time
    WHERE id = template_id_param;
  END IF;

  -- Update rates
  UPDATE intervention_templates
  SET
    response_rate_percent = new_response_rate,
    recovery_rate_percent = new_recovery_rate
  WHERE id = template_id_param;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE intervention_templates IS 'Library of intervention templates for re-engaging ghosting prospects';
COMMENT ON COLUMN intervention_templates.personalization_fields IS 'JSONB fields that AI will personalize (last_meaningful_interaction, personalized_assumption, reconnect_suggestion)';
COMMENT ON COLUMN intervention_templates.performance_by_segment IS 'JSONB breakdown of template effectiveness by persona, industry, and deal stage';
COMMENT ON COLUMN intervention_templates.is_system_template IS 'System templates are read-only defaults provided by the platform';
