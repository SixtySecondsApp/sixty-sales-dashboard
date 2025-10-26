-- Check current RLS policies on meetings table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'meetings'
ORDER BY policyname;

-- Check if RLS is enabled
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'meetings';

-- Test query to see what's failing
SELECT
  id,
  title,
  meeting_start,
  owner_user_id
FROM meetings
WHERE owner_user_id = auth.uid()
ORDER BY meeting_start DESC
LIMIT 5;
