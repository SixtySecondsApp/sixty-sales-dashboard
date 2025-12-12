-- Migration: Pipeline Automation Rules
-- Purpose: Org-configurable rules for automatic pipeline updates based on call analysis
-- Date: 2025-12-13

-- =============================================================================
-- Table: pipeline_automation_rules
-- Purpose: Define rules for automatic pipeline actions based on call signals
-- =============================================================================

CREATE TABLE IF NOT EXISTS pipeline_automation_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,

  -- Trigger conditions
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'forward_movement_detected',  -- General forward movement (demo requested, proposal requested, etc.)
    'proposal_requested',         -- Explicit proposal request detected
    'pricing_discussed',          -- Pricing conversation detected
    'verbal_commitment',          -- Verbal agreement/commitment detected
    'next_meeting_scheduled',     -- Follow-up meeting scheduled
    'decision_maker_engaged',     -- Decision maker participated
    'timeline_confirmed',         -- Implementation timeline discussed
    'checklist_incomplete'        -- Required checklist items missing
  )),

  -- Optional: Only trigger for specific call types
  call_type_filter UUID[] DEFAULT NULL,
  -- NULL = all call types, or array of call_type_ids

  -- Action to take when triggered
  action_type TEXT NOT NULL CHECK (action_type IN (
    'advance_stage',       -- Move deal to next/specific stage
    'create_task',         -- Create a follow-up task
    'send_notification',   -- Send notification(s)
    'update_deal_field'    -- Update a deal field
  )),

  -- Action configuration (structure depends on action_type)
  action_config JSONB NOT NULL,
  -- For advance_stage: { "advance_to_next": true } OR { "target_stage_id": "uuid" }
  -- For create_task: { "title_template": "Follow up on {{meeting_title}}", "due_days": 3, "priority": "high" }
  -- For send_notification: { "channels": ["in_app", "email", "slack"], "message_template": "..." }
  -- For update_deal_field: { "field": "next_step", "value_template": "{{signal_type}} detected" }

  -- Conditions for rule execution
  min_confidence NUMERIC(3,2) DEFAULT 0.7, -- Minimum signal confidence to trigger (0-1)
  cooldown_hours INTEGER DEFAULT 24,       -- Hours before rule can trigger again for same deal

  -- Audit fields
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique rule names per org
  UNIQUE(org_id, name)
);

-- =============================================================================
-- Table: pipeline_automation_log
-- Purpose: Audit log of all automation actions taken
-- =============================================================================

CREATE TABLE IF NOT EXISTS pipeline_automation_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES pipeline_automation_rules(id) ON DELETE SET NULL,

  -- Trigger context
  meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL,
  trigger_signal JSONB, -- The signal that triggered this action

  -- Action taken
  action_type TEXT NOT NULL,
  action_result JSONB, -- Result of the action (e.g., new stage, task_id, etc.)

  -- Status
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'skipped')),
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_pipeline_rules_org ON pipeline_automation_rules(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pipeline_rules_trigger ON pipeline_automation_rules(org_id, trigger_type) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_pipeline_log_org ON pipeline_automation_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_log_deal ON pipeline_automation_log(deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_log_meeting ON pipeline_automation_log(meeting_id);

-- =============================================================================
-- Trigger for updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_pipeline_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pipeline_rules_updated_at
  BEFORE UPDATE ON pipeline_automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_pipeline_rules_updated_at();

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE pipeline_automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_automation_log ENABLE ROW LEVEL SECURITY;

-- Org members can view rules
CREATE POLICY "Org members can view pipeline rules"
ON pipeline_automation_rules FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_memberships om
    WHERE om.org_id = pipeline_automation_rules.org_id
    AND om.user_id = auth.uid()
  )
);

-- Only admins can manage rules
CREATE POLICY "Org admins can manage pipeline rules"
ON pipeline_automation_rules FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_memberships om
    WHERE om.org_id = pipeline_automation_rules.org_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_memberships om
    WHERE om.org_id = pipeline_automation_rules.org_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

-- Org members can view automation log
CREATE POLICY "Org members can view pipeline log"
ON pipeline_automation_log FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_memberships om
    WHERE om.org_id = pipeline_automation_log.org_id
    AND om.user_id = auth.uid()
  )
);

-- Service role can manage everything
CREATE POLICY "Service role can manage pipeline rules"
ON pipeline_automation_rules FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage pipeline log"
ON pipeline_automation_log FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- =============================================================================
-- Function to get applicable rules for a signal
-- =============================================================================

CREATE OR REPLACE FUNCTION get_applicable_automation_rules(
  p_org_id UUID,
  p_trigger_type TEXT,
  p_call_type_id UUID DEFAULT NULL,
  p_confidence NUMERIC DEFAULT 1.0
)
RETURNS SETOF pipeline_automation_rules AS $$
BEGIN
  RETURN QUERY
  SELECT r.*
  FROM pipeline_automation_rules r
  WHERE r.org_id = p_org_id
    AND r.is_active = true
    AND r.trigger_type = p_trigger_type
    AND r.min_confidence <= p_confidence
    AND (
      r.call_type_filter IS NULL
      OR p_call_type_id = ANY(r.call_type_filter)
    )
  ORDER BY r.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Seed default automation rules for all orgs
-- =============================================================================

-- Note: This inserts default rules for ALL existing organizations
-- Each org gets one "Advance on Forward Movement" rule

INSERT INTO pipeline_automation_rules (org_id, name, description, trigger_type, action_type, action_config, min_confidence)
SELECT
  o.id,
  'Advance Stage on Forward Movement',
  'Automatically advance deal stage when forward movement signals are detected in calls',
  'forward_movement_detected',
  'advance_stage',
  '{"advance_to_next": true}'::jsonb,
  0.75
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_automation_rules r
  WHERE r.org_id = o.id AND r.name = 'Advance Stage on Forward Movement'
);

INSERT INTO pipeline_automation_rules (org_id, name, description, trigger_type, action_type, action_config, min_confidence)
SELECT
  o.id,
  'Create Task on Proposal Request',
  'Create a follow-up task when a proposal is requested',
  'proposal_requested',
  'create_task',
  '{"title_template": "Send proposal for {{deal_name}}", "due_days": 2, "priority": "high"}'::jsonb,
  0.8
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_automation_rules r
  WHERE r.org_id = o.id AND r.name = 'Create Task on Proposal Request'
);

INSERT INTO pipeline_automation_rules (org_id, name, description, trigger_type, action_type, action_config, min_confidence)
SELECT
  o.id,
  'Notify on Missing Checklist Items',
  'Send notification when required checklist items are missed',
  'checklist_incomplete',
  'send_notification',
  '{"channels": ["in_app"], "message_template": "Missing required items from call: {{missing_items}}"}'::jsonb,
  0.0  -- Always trigger for checklist incomplete
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_automation_rules r
  WHERE r.org_id = o.id AND r.name = 'Notify on Missing Checklist Items'
);

-- =============================================================================
-- Comments for documentation
-- =============================================================================

COMMENT ON TABLE pipeline_automation_rules IS 'Org-configurable rules for automatic pipeline actions based on call analysis signals';
COMMENT ON TABLE pipeline_automation_log IS 'Audit log tracking all pipeline automation actions taken';
COMMENT ON COLUMN pipeline_automation_rules.trigger_type IS 'Type of signal that triggers this rule';
COMMENT ON COLUMN pipeline_automation_rules.call_type_filter IS 'Optional: Only trigger for specific call types (NULL = all)';
COMMENT ON COLUMN pipeline_automation_rules.action_config IS 'Configuration for the action, structure depends on action_type';
COMMENT ON COLUMN pipeline_automation_rules.min_confidence IS 'Minimum signal confidence required to trigger (0-1)';
COMMENT ON COLUMN pipeline_automation_rules.cooldown_hours IS 'Hours before rule can trigger again for the same deal';

-- =============================================================================
-- Grant permissions
-- =============================================================================

GRANT SELECT ON pipeline_automation_rules TO authenticated;
GRANT SELECT ON pipeline_automation_log TO authenticated;
GRANT ALL ON pipeline_automation_rules TO service_role;
GRANT ALL ON pipeline_automation_log TO service_role;
