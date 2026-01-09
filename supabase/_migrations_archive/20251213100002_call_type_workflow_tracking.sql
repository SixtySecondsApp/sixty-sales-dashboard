-- Migration: Call Type Workflow Tracking
-- Purpose: Track workflow execution results, checklist coverage, and notifications
-- Date: 2025-12-13

-- =============================================================================
-- Table: meeting_workflow_results
-- Purpose: Store workflow execution results for each meeting
-- =============================================================================

CREATE TABLE IF NOT EXISTS meeting_workflow_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  call_type_id UUID REFERENCES org_call_types(id) ON DELETE SET NULL,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Checklist coverage results
  checklist_results JSONB DEFAULT '[]',
  -- Structure: [
  --   {
  --     "item_id": "uuid",
  --     "label": "Asked about current process",
  --     "category": "discovery",
  --     "required": true,
  --     "covered": true,
  --     "timestamp": "00:05:23",
  --     "evidence_quote": "Tell me about how you currently handle..."
  --   }
  -- ]

  coverage_score NUMERIC(5,2), -- 0-100 percentage of items covered
  required_coverage_score NUMERIC(5,2), -- 0-100 percentage of REQUIRED items covered
  missing_required_items TEXT[], -- Array of missing required item labels

  -- Notification status tracking
  notifications_sent JSONB DEFAULT '{}',
  -- Structure: {
  --   "in_app": "2025-12-13T10:30:00Z",
  --   "email": "2025-12-13T10:30:00Z",
  --   "slack": "2025-12-13T10:30:00Z"
  -- }
  notifications_scheduled_at TIMESTAMPTZ,
  notifications_sent_at TIMESTAMPTZ,

  -- Pipeline automation tracking
  pipeline_action_taken TEXT, -- 'stage_advanced', 'task_created', 'deal_updated', null
  pipeline_action_details JSONB,
  -- Structure for stage_advanced: { "from_stage_id": uuid, "to_stage_id": uuid, "deal_id": uuid }
  -- Structure for task_created: { "task_id": uuid, "title": string }
  -- Structure for deal_updated: { "deal_id": uuid, "field": string, "old_value": any, "new_value": any }

  -- Forward movement signals detected
  forward_movement_signals JSONB DEFAULT '[]',
  -- Structure: [
  --   {
  --     "type": "proposal_requested",
  --     "confidence": 0.85,
  --     "evidence": "Can you send me a proposal?"
  --   }
  -- ]

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one result per meeting
  UNIQUE(meeting_id)
);

-- =============================================================================
-- Indexes for performance
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_workflow_results_meeting ON meeting_workflow_results(meeting_id);
CREATE INDEX IF NOT EXISTS idx_workflow_results_call_type ON meeting_workflow_results(call_type_id);
CREATE INDEX IF NOT EXISTS idx_workflow_results_org ON meeting_workflow_results(org_id);
CREATE INDEX IF NOT EXISTS idx_workflow_results_pending_notifications
ON meeting_workflow_results(notifications_scheduled_at)
WHERE notifications_sent_at IS NULL AND notifications_scheduled_at IS NOT NULL;

-- =============================================================================
-- Trigger for updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_workflow_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_workflow_results_updated_at
  BEFORE UPDATE ON meeting_workflow_results
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_results_updated_at();

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE meeting_workflow_results ENABLE ROW LEVEL SECURITY;

-- Users can view workflow results for meetings they own
CREATE POLICY "Users can view workflow results for their meetings"
ON meeting_workflow_results FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM meetings m
    WHERE m.id = meeting_workflow_results.meeting_id
    AND m.owner_user_id = auth.uid()
  )
);

-- Users can view workflow results for their org (for admins/managers)
CREATE POLICY "Org members can view workflow results"
ON meeting_workflow_results FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_memberships om
    WHERE om.org_id = meeting_workflow_results.org_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin', 'manager')
  )
);

-- Service role can insert/update (for edge functions)
CREATE POLICY "Service role can manage workflow results"
ON meeting_workflow_results FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- Function to calculate workflow coverage
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_workflow_coverage(
  p_checklist_results JSONB
)
RETURNS TABLE(
  total_items INTEGER,
  covered_items INTEGER,
  required_items INTEGER,
  required_covered INTEGER,
  coverage_score NUMERIC,
  required_coverage_score NUMERIC,
  missing_required TEXT[]
) AS $$
DECLARE
  v_total INTEGER := 0;
  v_covered INTEGER := 0;
  v_required INTEGER := 0;
  v_required_covered INTEGER := 0;
  v_missing TEXT[] := '{}';
  v_item JSONB;
BEGIN
  -- Loop through checklist results
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_checklist_results)
  LOOP
    v_total := v_total + 1;

    IF (v_item->>'covered')::boolean THEN
      v_covered := v_covered + 1;
    END IF;

    IF (v_item->>'required')::boolean THEN
      v_required := v_required + 1;
      IF (v_item->>'covered')::boolean THEN
        v_required_covered := v_required_covered + 1;
      ELSE
        v_missing := array_append(v_missing, v_item->>'label');
      END IF;
    END IF;
  END LOOP;

  total_items := v_total;
  covered_items := v_covered;
  required_items := v_required;
  required_covered := v_required_covered;
  coverage_score := CASE WHEN v_total > 0 THEN (v_covered::NUMERIC / v_total) * 100 ELSE 0 END;
  required_coverage_score := CASE WHEN v_required > 0 THEN (v_required_covered::NUMERIC / v_required) * 100 ELSE 100 END;
  missing_required := v_missing;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Comments for documentation
-- =============================================================================

COMMENT ON TABLE meeting_workflow_results IS 'Stores workflow execution results including checklist coverage, notifications sent, and pipeline actions taken';
COMMENT ON COLUMN meeting_workflow_results.checklist_results IS 'Array of checklist item results with coverage status and evidence quotes';
COMMENT ON COLUMN meeting_workflow_results.coverage_score IS 'Percentage of all checklist items that were covered (0-100)';
COMMENT ON COLUMN meeting_workflow_results.required_coverage_score IS 'Percentage of required checklist items that were covered (0-100)';
COMMENT ON COLUMN meeting_workflow_results.forward_movement_signals IS 'Detected forward movement signals that may trigger pipeline automation';

-- =============================================================================
-- Grant permissions
-- =============================================================================

GRANT SELECT ON meeting_workflow_results TO authenticated;
GRANT ALL ON meeting_workflow_results TO service_role;
