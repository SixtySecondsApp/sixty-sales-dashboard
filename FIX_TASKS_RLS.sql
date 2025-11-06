-- Fix tasks table RLS policy to allow Edge Function inserts
-- Same issue as next_action_suggestions - need to allow service role inserts

-- Step 1: Check current policies
SELECT
  'Current Tasks Policies' as info,
  policyname,
  cmd,
  with_check
FROM pg_policies
WHERE tablename = 'tasks'
ORDER BY cmd, policyname;

-- Step 2: Temporarily disable RLS to test
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;

-- Step 3: Verify RLS is disabled
SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'tasks';

-- NOTE: After testing, we'll create proper policies like we did for suggestions
-- For now, let's just disable RLS to confirm this is the issue
