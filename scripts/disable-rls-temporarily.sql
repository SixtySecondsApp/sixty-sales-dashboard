-- Temporary fix: Disable RLS on workflow_executions for testing
-- CAUTION: This removes security restrictions - use only for testing

-- Disable RLS temporarily
ALTER TABLE workflow_executions DISABLE ROW LEVEL SECURITY;

-- Grant full access to authenticated users
GRANT ALL ON workflow_executions TO authenticated;
GRANT ALL ON node_executions TO authenticated;
GRANT ALL ON workflow_forms TO authenticated;

-- Note: Re-enable RLS later with proper policies for production