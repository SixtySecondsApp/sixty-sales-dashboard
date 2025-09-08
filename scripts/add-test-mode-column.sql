-- Add test mode support to workflow_executions table
-- This allows tracking production vs test executions separately

-- Add is_test_mode column to workflow_executions table
ALTER TABLE workflow_executions 
ADD COLUMN IF NOT EXISTS is_test_mode BOOLEAN DEFAULT false;

-- Create index for filtering by test mode
CREATE INDEX IF NOT EXISTS idx_workflow_executions_test_mode 
  ON workflow_executions(workflow_id, is_test_mode, started_at DESC);

-- Update existing executions to be production by default
UPDATE workflow_executions 
SET is_test_mode = false 
WHERE is_test_mode IS NULL;

-- Add constraint to ensure is_test_mode is never null
ALTER TABLE workflow_executions 
ALTER COLUMN is_test_mode SET NOT NULL;

-- Grant permissions (if needed)
GRANT SELECT, INSERT, UPDATE ON workflow_executions TO authenticated;