-- Re-enable RLS on next_action_suggestions with correct policies

-- Re-enable RLS
ALTER TABLE next_action_suggestions ENABLE ROW LEVEL SECURITY;

-- Verify it's enabled
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'next_action_suggestions';

-- Verify policies are still there
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'next_action_suggestions'
ORDER BY cmd, policyname;
