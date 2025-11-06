-- Check RLS policies on task_notifications table

-- Check if RLS is enabled
SELECT
  'RLS Status' as info,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'task_notifications';

-- Check all policies
SELECT
  'Policies' as info,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'task_notifications'
ORDER BY cmd, policyname;

-- Try to count rows using service role query
SELECT
  'Row Count' as info,
  COUNT(*) as count
FROM task_notifications;
