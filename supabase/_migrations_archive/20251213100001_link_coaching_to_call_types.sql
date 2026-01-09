-- Migration: Link Coaching Templates to Call Types
-- Purpose: Add call_type_id to coaching_scorecard_templates for automatic template selection
-- Date: 2025-12-13

-- =============================================================================
-- Add call_type_id to coaching_scorecard_templates
-- =============================================================================

ALTER TABLE coaching_scorecard_templates
ADD COLUMN IF NOT EXISTS call_type_id UUID REFERENCES org_call_types(id) ON DELETE SET NULL;

-- Create index for efficient lookup by call type
CREATE INDEX IF NOT EXISTS idx_coaching_templates_call_type
ON coaching_scorecard_templates(org_id, call_type_id)
WHERE call_type_id IS NOT NULL;

-- =============================================================================
-- Add workflow checklist results to meeting_scorecards
-- =============================================================================

ALTER TABLE meeting_scorecards
ADD COLUMN IF NOT EXISTS workflow_checklist_results JSONB DEFAULT '[]';

-- Structure of workflow_checklist_results:
-- [
--   {
--     "item_id": "uuid",
--     "label": "Asked about current process",
--     "covered": true,
--     "timestamp": "00:05:23",
--     "evidence_quote": "Tell me about how you currently..."
--   }
-- ]

-- =============================================================================
-- Function to find best matching template for a call type
-- =============================================================================

CREATE OR REPLACE FUNCTION get_coaching_template_for_call_type(
  p_org_id UUID,
  p_call_type_id UUID,
  p_meeting_type TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_template_id UUID;
BEGIN
  -- First try to find template linked to this specific call type
  SELECT id INTO v_template_id
  FROM coaching_scorecard_templates
  WHERE org_id = p_org_id
    AND call_type_id = p_call_type_id
    AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  -- If found, return it
  IF v_template_id IS NOT NULL THEN
    RETURN v_template_id;
  END IF;

  -- Fallback: try to match by meeting_type name
  IF p_meeting_type IS NOT NULL THEN
    SELECT id INTO v_template_id
    FROM coaching_scorecard_templates
    WHERE org_id = p_org_id
      AND LOWER(meeting_type) = LOWER(p_meeting_type)
      AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_template_id IS NOT NULL THEN
      RETURN v_template_id;
    END IF;
  END IF;

  -- Final fallback: get default/general template
  SELECT id INTO v_template_id
  FROM coaching_scorecard_templates
  WHERE org_id = p_org_id
    AND (LOWER(meeting_type) = 'general' OR meeting_type IS NULL)
    AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN v_template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Update existing templates to link to call types where names match
-- =============================================================================

-- Link Discovery templates to Discovery call type
UPDATE coaching_scorecard_templates cst
SET call_type_id = oct.id
FROM org_call_types oct
WHERE cst.org_id = oct.org_id
  AND LOWER(cst.meeting_type) = LOWER(oct.name)
  AND cst.call_type_id IS NULL;

-- =============================================================================
-- Comments for documentation
-- =============================================================================

COMMENT ON COLUMN coaching_scorecard_templates.call_type_id IS 'Link template to specific call type for automatic selection during scorecard generation';
COMMENT ON COLUMN meeting_scorecards.workflow_checklist_results IS 'Results from workflow checklist analysis showing which items were covered';
COMMENT ON FUNCTION get_coaching_template_for_call_type IS 'Find the best matching coaching template for a given call type, with fallbacks';
