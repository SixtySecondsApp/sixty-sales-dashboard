-- Fix RLS Policy for Workflow Executions
-- This script updates the RLS policy to allow executions even for workflows that aren't saved yet

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can manage their own workflow executions" ON workflow_executions;

-- Create a more flexible policy that allows:
-- 1. Executions for workflows owned by the user
-- 2. Executions for any workflow if the user is authenticated (for testing)
CREATE POLICY "Users can manage workflow executions" 
  ON workflow_executions FOR ALL 
  USING (
    -- Allow if user is authenticated (for testing with temporary workflow IDs)
    auth.uid() IS NOT NULL
    AND (
      -- Either the workflow exists and belongs to the user
      workflow_id IN (
        SELECT id FROM user_automation_rules 
        WHERE user_id = auth.uid()
      )
      -- Or it's a test execution (temporary workflow ID)
      OR workflow_id NOT IN (SELECT id FROM user_automation_rules)
    )
  );

-- Also ensure service role can insert (for background processes)
CREATE POLICY "Service role can manage all executions"
  ON workflow_executions FOR ALL
  TO service_role
  USING (true);

-- Grant additional permissions to authenticated users
GRANT INSERT, SELECT, UPDATE ON workflow_executions TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;