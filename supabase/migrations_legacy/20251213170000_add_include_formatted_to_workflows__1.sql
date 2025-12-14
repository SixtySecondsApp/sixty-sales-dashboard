-- Add include_formatted column to org_proposal_workflows
-- This output type uses markdown from AI but renders it formatted on the frontend

ALTER TABLE org_proposal_workflows
ADD COLUMN IF NOT EXISTS include_formatted BOOLEAN NOT NULL DEFAULT false;

-- Update the constraint to include the new column
ALTER TABLE org_proposal_workflows
DROP CONSTRAINT IF EXISTS org_proposal_workflows_has_output;

ALTER TABLE org_proposal_workflows
ADD CONSTRAINT org_proposal_workflows_has_output CHECK (
  include_goals OR include_sow OR include_html OR include_email OR include_formatted OR include_markdown
);

-- Add comment for documentation
COMMENT ON COLUMN org_proposal_workflows.include_formatted IS 'When true, generates markdown content that is rendered as formatted text on the frontend';
