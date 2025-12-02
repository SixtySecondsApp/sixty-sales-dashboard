-- Migration: Fix RLS policy violation for meeting_index_queue trigger
-- Purpose: Allow trigger function to insert into queue without RLS blocking
-- Date: 2025-01-27

-- =============================================================================
-- Fix: Update INSERT policy to allow trigger function inserts
-- SECURITY DEFINER functions still respect RLS, so we need to allow
-- inserts where user_id matches the meeting owner (which is what the trigger does)
-- =============================================================================

-- Drop and recreate the INSERT policy to allow trigger inserts and team-wide indexing
DROP POLICY IF EXISTS "Users can insert own queue items" ON meeting_index_queue;

CREATE POLICY "Users can insert own queue items"
  ON meeting_index_queue FOR INSERT
  WITH CHECK (
    -- Service role can insert anything (edge functions)
    auth.jwt()->>'role' = 'service_role'
    -- Allow inserts where user_id matches the meeting owner
    -- This covers:
    -- 1. Trigger inserts (auth.uid() is NULL, but user_id matches meeting owner)
    -- 2. Team-wide indexing (any authenticated user can queue meetings for other users)
    --    as long as the user_id matches the meeting owner
    OR EXISTS (
      SELECT 1 FROM meetings m 
      WHERE m.id = meeting_id 
      AND m.owner_user_id = user_id
    )
  );

-- Ensure service role policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename = 'meeting_index_queue' 
    AND policyname = 'Service role can manage all queue items'
  ) THEN
    CREATE POLICY "Service role can manage all queue items"
      ON meeting_index_queue FOR ALL
      USING (auth.jwt()->>'role' = 'service_role');
  END IF;
END $$;

