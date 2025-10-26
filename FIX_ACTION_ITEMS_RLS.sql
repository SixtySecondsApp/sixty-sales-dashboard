-- Fix RLS Policies for Meeting Action Items Display
--
-- ISSUE: Action items exist in database but frontend can't see them
-- CAUSE: RLS policies are too restrictive or conflicting
--
-- This script will:
-- 1. Drop all conflicting/duplicate policies
-- 2. Create clean, simple policies that allow users to view action items for their meetings
-- 3. Grant service role full access for Edge Function operations

-- ============================================================================
-- Step 1: Clean up all existing policies on meeting_action_items
-- ============================================================================

DO $$
BEGIN
  -- Drop all old policies
  DROP POLICY IF EXISTS "View action items for own meetings" ON meeting_action_items;
  DROP POLICY IF EXISTS "Manage action items for own meetings" ON meeting_action_items;
  DROP POLICY IF EXISTS "View action items for accessible meetings" ON meeting_action_items;
  DROP POLICY IF EXISTS "action_items_select_policy" ON meeting_action_items;
  DROP POLICY IF EXISTS "action_items_insert_policy" ON meeting_action_items;
  DROP POLICY IF EXISTS "action_items_update_policy" ON meeting_action_items;
  DROP POLICY IF EXISTS "action_items_delete_policy" ON meeting_action_items;
  DROP POLICY IF EXISTS "action_items_service_role_all" ON meeting_action_items;
  DROP POLICY IF EXISTS "Users can view meeting action items" ON meeting_action_items;
  DROP POLICY IF EXISTS "Users can update meeting action items" ON meeting_action_items;

  RAISE NOTICE '✅ Dropped all old meeting_action_items policies';
END $$;

-- ============================================================================
-- Step 2: Create clean, simple policies
-- ============================================================================

-- Allow users to view action items for meetings they own
CREATE POLICY "meeting_action_items_select" ON meeting_action_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = meeting_action_items.meeting_id
      AND meetings.owner_user_id = auth.uid()
    )
  );

-- Allow users to insert action items for their own meetings
CREATE POLICY "meeting_action_items_insert" ON meeting_action_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = meeting_action_items.meeting_id
      AND meetings.owner_user_id = auth.uid()
    )
  );

-- Allow users to update action items for their own meetings
CREATE POLICY "meeting_action_items_update" ON meeting_action_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = meeting_action_items.meeting_id
      AND meetings.owner_user_id = auth.uid()
    )
  );

-- Allow users to delete action items for their own meetings
CREATE POLICY "meeting_action_items_delete" ON meeting_action_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM meetings
      WHERE meetings.id = meeting_action_items.meeting_id
      AND meetings.owner_user_id = auth.uid()
    )
  );

-- Service role (Edge Functions) gets full access
CREATE POLICY "meeting_action_items_service_role" ON meeting_action_items
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- Step 3: Verify RLS is enabled
-- ============================================================================

ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 4: Test Query
-- ============================================================================

-- This should return action items if you run it as the meeting owner
SELECT
  'Test Query' as status,
  'Run this to verify action items are visible' as message;

-- Test: Check if current user can see their meeting action items
SELECT
  mai.id,
  mai.meeting_id,
  mai.title,
  mai.priority,
  m.title as meeting_title,
  m.owner_user_id,
  m.owner_email
FROM meeting_action_items mai
JOIN meetings m ON m.id = mai.meeting_id
WHERE m.owner_user_id = auth.uid()
ORDER BY m.meeting_start DESC
LIMIT 10;

-- ============================================================================
-- Expected Results
-- ============================================================================

-- ✅ Users should now be able to see action items for their own meetings
-- ✅ Edge Functions (service role) can create/update action items
-- ✅ Frontend query at MeetingDetail.tsx:113-120 should now work
-- ✅ No duplicate or conflicting policies

SELECT '✅ RLS policies updated successfully!' as status;
