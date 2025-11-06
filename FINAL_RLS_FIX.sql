-- Final RLS Configuration for suggestions and tasks
-- Both tables need "Allow all inserts" policy for Edge Functions to work

-- ============================================================================
-- NEXT_ACTION_SUGGESTIONS TABLE
-- ============================================================================

-- Re-enable RLS
ALTER TABLE next_action_suggestions ENABLE ROW LEVEL SECURITY;

-- Drop old INSERT policies
DROP POLICY IF EXISTS "Service role can insert suggestions" ON next_action_suggestions;
DROP POLICY IF EXISTS "Allow insert from Edge Functions" ON next_action_suggestions;
DROP POLICY IF EXISTS "Allow insert for service role and authenticated" ON next_action_suggestions;

-- Create new INSERT policy
CREATE POLICY "Allow all inserts"
  ON next_action_suggestions
  FOR INSERT
  WITH CHECK (true);

-- Verify other policies exist (should already be there)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'next_action_suggestions'
    AND policyname = 'Users can view own suggestions'
  ) THEN
    CREATE POLICY "Users can view own suggestions"
      ON next_action_suggestions
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'next_action_suggestions'
    AND policyname = 'Users can update own suggestions'
  ) THEN
    CREATE POLICY "Users can update own suggestions"
      ON next_action_suggestions
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'next_action_suggestions'
    AND policyname = 'Users can delete own dismissed suggestions'
  ) THEN
    CREATE POLICY "Users can delete own dismissed suggestions"
      ON next_action_suggestions
      FOR DELETE
      USING (auth.uid() = user_id AND status = 'dismissed');
  END IF;
END $$;

-- ============================================================================
-- TASKS TABLE
-- ============================================================================

-- Re-enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Drop old INSERT policies if they exist
DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
DROP POLICY IF EXISTS "Service role can insert tasks" ON tasks;

-- Create new INSERT policy that allows all inserts
CREATE POLICY "Allow all inserts"
  ON tasks
  FOR INSERT
  WITH CHECK (true);

-- Ensure other policies exist for tasks
-- Users can view their own tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tasks'
    AND policyname = 'Users can view own tasks'
  ) THEN
    CREATE POLICY "Users can view own tasks"
      ON tasks
      FOR SELECT
      USING (auth.uid() = assigned_to OR auth.uid() = created_by);
  END IF;
END $$;

-- Users can update their own tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tasks'
    AND policyname = 'Users can update own tasks'
  ) THEN
    CREATE POLICY "Users can update own tasks"
      ON tasks
      FOR UPDATE
      USING (auth.uid() = assigned_to OR auth.uid() = created_by);
  END IF;
END $$;

-- Users can delete their own tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tasks'
    AND policyname = 'Users can delete own tasks'
  ) THEN
    CREATE POLICY "Users can delete own tasks"
      ON tasks
      FOR DELETE
      USING (auth.uid() = assigned_to OR auth.uid() = created_by);
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check RLS is enabled
SELECT
  'RLS Status' as info,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('next_action_suggestions', 'tasks')
ORDER BY tablename;

-- Check policies
SELECT
  'Policies' as info,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('next_action_suggestions', 'tasks')
ORDER BY tablename, cmd, policyname;
