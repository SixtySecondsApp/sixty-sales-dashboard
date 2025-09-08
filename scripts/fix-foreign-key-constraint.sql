-- Fix foreign key constraint for workflow_executions
-- Allow executions for workflows that don't exist in user_automation_rules yet

-- Drop the existing foreign key constraint
ALTER TABLE workflow_executions 
  DROP CONSTRAINT IF EXISTS workflow_executions_workflow_id_fkey;

-- Add a new optional foreign key constraint
-- This allows NULL workflow_id or valid references to user_automation_rules
ALTER TABLE workflow_executions 
  ADD CONSTRAINT workflow_executions_workflow_id_fkey 
  FOREIGN KEY (workflow_id) 
  REFERENCES user_automation_rules(id) 
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- Alternative: Make workflow_id nullable for temporary executions
-- ALTER TABLE workflow_executions ALTER COLUMN workflow_id DROP NOT NULL;