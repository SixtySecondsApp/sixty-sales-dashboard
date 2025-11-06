-- Simple RLS Fix for next_action_suggestions
-- Run this in Supabase SQL Editor

-- Step 1: Drop all existing INSERT policies
DROP POLICY IF EXISTS "Service role can insert suggestions" ON next_action_suggestions;
DROP POLICY IF EXISTS "Allow insert from Edge Functions" ON next_action_suggestions;
DROP POLICY IF EXISTS "Allow insert for service role and authenticated" ON next_action_suggestions;
DROP POLICY IF EXISTS "Allow all inserts (user_id set by trigger)" ON next_action_suggestions;

-- Step 2: Create new INSERT policy that allows all inserts
-- The trigger will ensure user_id is set correctly
CREATE POLICY "Allow all inserts"
  ON next_action_suggestions
  FOR INSERT
  WITH CHECK (true);

-- Step 3: Verify other policies exist
-- (These should already exist from the original migration)

-- SELECT policy - users can view their own suggestions
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

-- UPDATE policy - users can update their own suggestions
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

-- DELETE policy - users can delete their own dismissed suggestions
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

-- Step 4: Grant permissions
GRANT INSERT, SELECT, UPDATE, DELETE ON next_action_suggestions TO service_role;
GRANT INSERT, SELECT, UPDATE, DELETE ON next_action_suggestions TO authenticated;

-- Step 5: Verify the fix
SELECT
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'next_action_suggestions'
ORDER BY cmd, policyname;
