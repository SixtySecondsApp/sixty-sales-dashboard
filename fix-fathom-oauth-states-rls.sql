-- Fix RLS policy for fathom_oauth_states table
-- The service role key should bypass RLS entirely

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Service role can manage OAuth states" ON fathom_oauth_states;

-- Disable RLS temporarily to allow service role to work
-- Service role key bypasses RLS by default when RLS is disabled
ALTER TABLE fathom_oauth_states DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE fathom_oauth_states ENABLE ROW LEVEL SECURITY;

-- Create a permissive policy for service role
-- This allows the service role key to bypass RLS
CREATE POLICY "Allow service role full access"
  ON fathom_oauth_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Verify the change
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'fathom_oauth_states';
