-- ============================================================================
-- FIX: meetings_waitlist RLS Policies
-- ============================================================================
-- 
-- PROBLEM: The migration 20251210000010_fix_rls_performance_issues_part2.sql 
-- applied RLS policies that reference a `user_id` column which does NOT exist
-- on the meetings_waitlist table. This causes a 404 error when querying the table.
--
-- HOW TO RUN: Copy and paste this SQL into the Supabase Dashboard SQL Editor
-- and execute it.
--
-- ============================================================================

-- Drop the broken policies that reference non-existent user_id column
DROP POLICY IF EXISTS "meetings_waitlist_select" ON meetings_waitlist;
DROP POLICY IF EXISTS "meetings_waitlist_insert" ON meetings_waitlist;
DROP POLICY IF EXISTS "meetings_waitlist_update" ON meetings_waitlist;
DROP POLICY IF EXISTS "meetings_waitlist_delete" ON meetings_waitlist;

-- Also drop the original policies if they exist
DROP POLICY IF EXISTS "Anyone can signup for waitlist" ON meetings_waitlist;
DROP POLICY IF EXISTS "Anyone can view waitlist entries" ON meetings_waitlist;
DROP POLICY IF EXISTS "Platform admins can manage waitlist" ON meetings_waitlist;

-- Recreate correct policies for public waitlist access

-- Public can insert (signup) - no authentication required
CREATE POLICY "meetings_waitlist_insert"
ON meetings_waitlist FOR INSERT
TO public
WITH CHECK (true);

-- Public can view all waitlist entries (needed for leaderboard, position lookup)
CREATE POLICY "meetings_waitlist_select"
ON meetings_waitlist FOR SELECT
TO public
USING (true);

-- Platform admins can update entries (grant access, change status, etc.)
CREATE POLICY "meetings_waitlist_update"
ON meetings_waitlist FOR UPDATE
TO authenticated
USING (
  is_service_role() 
  OR is_admin_optimized()
);

-- Platform admins can delete entries if needed
CREATE POLICY "meetings_waitlist_delete"
ON meetings_waitlist FOR DELETE
TO authenticated
USING (
  is_service_role() 
  OR is_admin_optimized()
);

-- Ensure RLS is enabled
ALTER TABLE meetings_waitlist ENABLE ROW LEVEL SECURITY;

-- Re-grant necessary permissions
GRANT SELECT, INSERT ON meetings_waitlist TO anon;
GRANT ALL ON meetings_waitlist TO authenticated;

-- Verify the fix was applied
SELECT 
  policyname, 
  cmd, 
  roles,
  qual
FROM pg_policies 
WHERE tablename = 'meetings_waitlist';








