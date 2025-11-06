-- Check tasks table RLS policies

SELECT
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'tasks'
ORDER BY cmd, policyname;

-- Also check if RLS is enabled
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'tasks';
