-- Migration: Rep Coaching Scorecards
-- Purpose: Admin-configurable coaching scorecards with custom checklists and scripts
-- Date: 2025-12-12

-- =============================================================================
-- Table: coaching_scorecard_templates
-- Purpose: Admin-configurable scorecard templates per meeting type
-- =============================================================================

CREATE TABLE IF NOT EXISTS coaching_scorecard_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,

  name TEXT NOT NULL,
  description TEXT,

  -- Meeting type this template applies to
  meeting_type TEXT NOT NULL CHECK (meeting_type IN ('discovery', 'demo', 'negotiation', 'closing', 'follow_up', 'general')),

  -- Core metrics configuration
  -- Schema: [{id: string, name: string, weight: number, enabled: boolean, ideal_range?: {min: number, max: number}, description?: string}]
  metrics JSONB NOT NULL DEFAULT '[
    {"id": "talk_ratio", "name": "Talk-to-Listen Ratio", "weight": 25, "enabled": true, "ideal_range": {"min": 30, "max": 45}, "description": "Percentage of time rep speaks vs prospect"},
    {"id": "discovery_questions", "name": "Discovery Questions", "weight": 25, "enabled": true, "ideal_range": {"min": 5, "max": 15}, "description": "Number of open-ended questions asked"},
    {"id": "next_steps", "name": "Next Steps Established", "weight": 25, "enabled": true, "description": "Whether clear next steps were agreed upon"},
    {"id": "monologue_detection", "name": "Monologue Avoidance", "weight": 25, "enabled": true, "ideal_range": {"min": 0, "max": 2}, "description": "Number of times rep spoke for over 60 seconds"}
  ]',

  -- Custom checklist items for this call type
  -- Schema: [{id: string, question: string, required: boolean, category?: string, order: number}]
  checklist_items JSONB DEFAULT '[]',

  -- Script flow definition (expected conversation flow)
  -- Schema: [{step_number: number, step_name: string, expected_topics: string[], required: boolean, max_duration_minutes?: number}]
  script_flow JSONB DEFAULT '[]',

  -- Scoring thresholds
  passing_score INTEGER DEFAULT 70,
  excellence_score INTEGER DEFAULT 90,

  -- Template status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(org_id, name)
);

-- =============================================================================
-- Table: meeting_scorecards
-- Purpose: Individual scorecard results for each meeting
-- =============================================================================

CREATE TABLE IF NOT EXISTS meeting_scorecards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE UNIQUE,
  template_id UUID REFERENCES coaching_scorecard_templates(id) ON DELETE SET NULL,
  org_id UUID NOT NULL,
  rep_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Overall calculated score
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  grade TEXT CHECK (grade IN ('A', 'B', 'C', 'D', 'F')),

  -- Individual metric scores
  -- Schema: {metric_id: {score: number, raw_value: any, feedback?: string, weight: number}}
  metric_scores JSONB DEFAULT '{}',

  -- Standard metrics (always tracked regardless of template)
  talk_time_rep_pct NUMERIC,
  talk_time_customer_pct NUMERIC,
  discovery_questions_count INTEGER DEFAULT 0,
  discovery_questions_examples JSONB DEFAULT '[]',
  next_steps_established BOOLEAN,
  next_steps_details TEXT,

  -- Monologue detection
  -- Schema: [{start_seconds: number, duration_seconds: number, transcript_snippet: string}]
  monologue_instances JSONB DEFAULT '[]',
  monologue_count INTEGER DEFAULT 0,

  -- Checklist completion
  -- Schema: {item_id: {covered: boolean, timestamp_seconds?: number, quote?: string, notes?: string}}
  checklist_results JSONB DEFAULT '{}',
  checklist_completion_pct INTEGER DEFAULT 0,
  checklist_required_completion_pct INTEGER DEFAULT 0,

  -- Script adherence analysis
  script_adherence_score INTEGER,
  -- Schema: {steps_covered: string[], steps_missed: string[], order_followed: boolean, deviations: string[]}
  script_flow_analysis JSONB DEFAULT '{}',

  -- AI-generated coaching feedback
  strengths JSONB DEFAULT '[]',
  areas_for_improvement JSONB DEFAULT '[]',
  specific_feedback TEXT,
  coaching_tips JSONB DEFAULT '[]',

  -- Key moments from the call
  -- Schema: [{timestamp_seconds: number, type: 'positive'|'negative'|'coaching', description: string, quote?: string}]
  key_moments JSONB DEFAULT '[]',

  -- Processing metadata
  detected_meeting_type TEXT,
  ai_model_used TEXT,
  tokens_used INTEGER,
  processing_time_ms INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_coaching_scorecard_templates_org_id
  ON coaching_scorecard_templates(org_id);

CREATE INDEX IF NOT EXISTS idx_coaching_scorecard_templates_meeting_type
  ON coaching_scorecard_templates(meeting_type);

CREATE INDEX IF NOT EXISTS idx_coaching_scorecard_templates_active
  ON coaching_scorecard_templates(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_meeting_scorecards_meeting_id
  ON meeting_scorecards(meeting_id);

CREATE INDEX IF NOT EXISTS idx_meeting_scorecards_rep_user_id
  ON meeting_scorecards(rep_user_id);

CREATE INDEX IF NOT EXISTS idx_meeting_scorecards_org_id
  ON meeting_scorecards(org_id);

CREATE INDEX IF NOT EXISTS idx_meeting_scorecards_template_id
  ON meeting_scorecards(template_id);

CREATE INDEX IF NOT EXISTS idx_meeting_scorecards_overall_score
  ON meeting_scorecards(overall_score);

CREATE INDEX IF NOT EXISTS idx_meeting_scorecards_created_at
  ON meeting_scorecards(created_at DESC);

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE coaching_scorecard_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_scorecards ENABLE ROW LEVEL SECURITY;

-- Templates: All org members can view, only admins can manage
CREATE POLICY "Org members can view scorecard templates"
  ON coaching_scorecard_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = coaching_scorecard_templates.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Org admins can manage scorecard templates"
  ON coaching_scorecard_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = coaching_scorecard_templates.org_id
        AND organization_memberships.user_id = auth.uid()
        AND organization_memberships.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Service role can manage all templates"
  ON coaching_scorecard_templates FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- Scorecards: All org members can view
CREATE POLICY "Org members can view meeting scorecards"
  ON meeting_scorecards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE organization_memberships.org_id = meeting_scorecards.org_id
        AND organization_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all scorecards"
  ON meeting_scorecards FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =============================================================================
-- Trigger: Auto-update timestamps
-- =============================================================================

CREATE OR REPLACE FUNCTION update_coaching_scorecard_templates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_coaching_scorecard_templates_timestamp
  BEFORE UPDATE ON coaching_scorecard_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_coaching_scorecard_templates_timestamp();

CREATE TRIGGER trigger_update_meeting_scorecards_timestamp
  BEFORE UPDATE ON meeting_scorecards
  FOR EACH ROW
  EXECUTE FUNCTION update_coaching_scorecard_templates_timestamp();

-- =============================================================================
-- Helper Function: Get template for meeting type
-- =============================================================================

CREATE OR REPLACE FUNCTION get_scorecard_template_for_type(
  p_org_id UUID,
  p_meeting_type TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_template JSONB;
BEGIN
  SELECT row_to_json(cst.*)::JSONB
  INTO v_template
  FROM coaching_scorecard_templates cst
  WHERE cst.org_id = p_org_id
    AND cst.meeting_type = p_meeting_type
    AND cst.is_active = true
  ORDER BY cst.is_default DESC, cst.created_at DESC
  LIMIT 1;

  RETURN COALESCE(v_template, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Helper Function: Get rep performance stats
-- =============================================================================

CREATE OR REPLACE FUNCTION get_rep_scorecard_stats(
  p_org_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  rep_user_id UUID,
  meeting_count BIGINT,
  avg_overall_score NUMERIC,
  avg_talk_ratio NUMERIC,
  avg_discovery_questions NUMERIC,
  next_steps_rate NUMERIC,
  grade_distribution JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ms.rep_user_id,
    COUNT(ms.id) as meeting_count,
    ROUND(AVG(ms.overall_score)::numeric, 1) as avg_overall_score,
    ROUND(AVG(ms.talk_time_rep_pct)::numeric, 1) as avg_talk_ratio,
    ROUND(AVG(ms.discovery_questions_count)::numeric, 1) as avg_discovery_questions,
    ROUND((COUNT(*) FILTER (WHERE ms.next_steps_established = true)::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100, 1) as next_steps_rate,
    jsonb_build_object(
      'A', COUNT(*) FILTER (WHERE ms.grade = 'A'),
      'B', COUNT(*) FILTER (WHERE ms.grade = 'B'),
      'C', COUNT(*) FILTER (WHERE ms.grade = 'C'),
      'D', COUNT(*) FILTER (WHERE ms.grade = 'D'),
      'F', COUNT(*) FILTER (WHERE ms.grade = 'F')
    ) as grade_distribution
  FROM meeting_scorecards ms
  INNER JOIN meetings m ON ms.meeting_id = m.id
  WHERE ms.org_id = p_org_id
    AND (p_user_id IS NULL OR ms.rep_user_id = p_user_id)
    AND (p_date_from IS NULL OR m.start_time >= p_date_from)
    AND (p_date_to IS NULL OR m.start_time <= p_date_to)
  GROUP BY ms.rep_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Helper Function: Get team scorecard leaderboard
-- =============================================================================

CREATE OR REPLACE FUNCTION get_team_scorecard_leaderboard(
  p_org_id UUID,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  rep_user_id UUID,
  rep_name TEXT,
  meeting_count BIGINT,
  avg_score NUMERIC,
  improvement_trend NUMERIC,
  top_strength TEXT,
  top_improvement_area TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH rep_stats AS (
    SELECT
      ms.rep_user_id,
      COUNT(*) as meeting_count,
      AVG(ms.overall_score) as avg_score,
      -- Calculate trend (comparing first half to second half of period)
      AVG(ms.overall_score) FILTER (
        WHERE m.start_time > (COALESCE(p_date_from, m.start_time - interval '30 days') +
          (COALESCE(p_date_to, NOW()) - COALESCE(p_date_from, m.start_time - interval '30 days')) / 2)
      ) - AVG(ms.overall_score) FILTER (
        WHERE m.start_time <= (COALESCE(p_date_from, m.start_time - interval '30 days') +
          (COALESCE(p_date_to, NOW()) - COALESCE(p_date_from, m.start_time - interval '30 days')) / 2)
      ) as improvement_trend,
      -- Most common strength
      (SELECT s FROM jsonb_array_elements_text(ms.strengths) s GROUP BY s ORDER BY COUNT(*) DESC LIMIT 1) as top_strength,
      -- Most common improvement area
      (SELECT a FROM jsonb_array_elements_text(ms.areas_for_improvement) a GROUP BY a ORDER BY COUNT(*) DESC LIMIT 1) as top_improvement_area
    FROM meeting_scorecards ms
    INNER JOIN meetings m ON ms.meeting_id = m.id
    WHERE ms.org_id = p_org_id
      AND (p_date_from IS NULL OR m.start_time >= p_date_from)
      AND (p_date_to IS NULL OR m.start_time <= p_date_to)
    GROUP BY ms.rep_user_id, ms.strengths, ms.areas_for_improvement
  )
  SELECT
    rs.rep_user_id,
    COALESCE(p.full_name, u.email) as rep_name,
    rs.meeting_count,
    ROUND(rs.avg_score::numeric, 1) as avg_score,
    ROUND(COALESCE(rs.improvement_trend, 0)::numeric, 1) as improvement_trend,
    rs.top_strength,
    rs.top_improvement_area
  FROM rep_stats rs
  LEFT JOIN auth.users u ON rs.rep_user_id = u.id
  LEFT JOIN profiles p ON rs.rep_user_id = p.id
  ORDER BY rs.avg_score DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Insert Default Templates (will be inserted per org on first use)
-- =============================================================================

-- Note: Default templates are created programmatically when an org first
-- accesses the coaching feature, not via migration. This allows customization.

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON TABLE coaching_scorecard_templates IS 'Admin-configurable scorecard templates with metrics, checklists, and script flows per meeting type';
COMMENT ON TABLE meeting_scorecards IS 'Individual scorecard results for each analyzed meeting';
COMMENT ON FUNCTION get_scorecard_template_for_type IS 'Returns the active template for a specific meeting type in an org';
COMMENT ON FUNCTION get_rep_scorecard_stats IS 'Returns performance statistics for reps based on their scorecards';
COMMENT ON FUNCTION get_team_scorecard_leaderboard IS 'Returns ranked leaderboard of rep performance';
