-- Org-level custom proposal workflows
-- Allows organizations to create named workflow configurations that combine multiple output types

CREATE TABLE org_proposal_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Workflow identity
  name TEXT NOT NULL,                    -- e.g., "Quick Follow-up Email"
  description TEXT,                       -- e.g., "Fast email for post-meeting follow-up"
  icon TEXT DEFAULT 'file-text',          -- Lucide icon name
  color TEXT DEFAULT 'blue',              -- Theme color

  -- Output types to generate (at least one required)
  include_goals BOOLEAN NOT NULL DEFAULT false,
  include_sow BOOLEAN NOT NULL DEFAULT false,
  include_html BOOLEAN NOT NULL DEFAULT false,
  include_email BOOLEAN NOT NULL DEFAULT false,
  include_markdown BOOLEAN NOT NULL DEFAULT false,

  -- Workflow settings
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,  -- Show first in list

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  -- Ensure unique names per org
  CONSTRAINT org_proposal_workflows_unique_name UNIQUE (org_id, name),

  -- Ensure at least one output type is selected
  CONSTRAINT org_proposal_workflows_has_output CHECK (
    include_goals OR include_sow OR include_html OR include_email OR include_markdown
  )
);

-- Index for fast lookups
CREATE INDEX idx_org_proposal_workflows_org_id ON org_proposal_workflows(org_id);
CREATE INDEX idx_org_proposal_workflows_active ON org_proposal_workflows(org_id, is_active);

-- RLS policies
ALTER TABLE org_proposal_workflows ENABLE ROW LEVEL SECURITY;

-- Org members can read their org's workflows
CREATE POLICY "Org members can read proposal workflows"
  ON org_proposal_workflows FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM organization_memberships
    WHERE user_id = auth.uid()
  ));

-- Org admins/owners can manage workflows
CREATE POLICY "Org admins can manage proposal workflows"
  ON org_proposal_workflows FOR ALL
  USING (org_id IN (
    SELECT org_id FROM organization_memberships
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Create default workflows for new orgs
CREATE OR REPLACE FUNCTION create_default_org_proposal_workflows()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default workflows
  INSERT INTO org_proposal_workflows (org_id, name, description, include_goals, include_sow, include_html, include_email, include_markdown, display_order, is_default)
  VALUES
    (NEW.id, 'Full Proposal', 'Complete proposal with goals, SOW, and presentation', true, true, true, false, false, 1, true),
    (NEW.id, 'Quick Follow-up Email', 'Fast post-meeting follow-up email', false, false, false, true, false, 2, false),
    (NEW.id, 'Client Summary', 'Clean markdown summary document', true, false, false, false, true, 3, false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_org_created_add_proposal_workflows
  AFTER INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION create_default_org_proposal_workflows();

-- Backfill existing orgs with default workflows
INSERT INTO org_proposal_workflows (org_id, name, description, include_goals, include_sow, include_html, include_email, include_markdown, display_order, is_default)
SELECT
  id,
  'Full Proposal',
  'Complete proposal with goals, SOW, and presentation',
  true, true, true, false, false, 1, true
FROM organizations
ON CONFLICT (org_id, name) DO NOTHING;

INSERT INTO org_proposal_workflows (org_id, name, description, include_goals, include_sow, include_html, include_email, include_markdown, display_order, is_default)
SELECT
  id,
  'Quick Follow-up Email',
  'Fast post-meeting follow-up email',
  false, false, false, true, false, 2, false
FROM organizations
ON CONFLICT (org_id, name) DO NOTHING;

INSERT INTO org_proposal_workflows (org_id, name, description, include_goals, include_sow, include_html, include_email, include_markdown, display_order, is_default)
SELECT
  id,
  'Client Summary',
  'Clean markdown summary document',
  true, false, false, false, true, 3, false
FROM organizations
ON CONFLICT (org_id, name) DO NOTHING;

-- Add updated_at trigger
CREATE TRIGGER update_org_proposal_workflows_updated_at
  BEFORE UPDATE ON org_proposal_workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
