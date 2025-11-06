-- TEMPORARY: Disable RLS to test if that's the issue
-- This removes all security - ONLY for debugging!

ALTER TABLE next_action_suggestions DISABLE ROW LEVEL SECURITY;

-- Check if RLS is disabled
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'next_action_suggestions';
