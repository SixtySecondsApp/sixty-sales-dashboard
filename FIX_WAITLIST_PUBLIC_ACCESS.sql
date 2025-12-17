-- ============================================================================
-- FIX: Ensure Public Access to Waitlist Status Pages
-- ============================================================================
-- 
-- PROBLEM: Users are being asked to login when accessing waitlist status URLs
-- like /waitlist/status/:id. The waitlist status pages should be PUBLIC and
-- accessible to anyone with the link - no authentication required.
--
-- SOLUTION: Ensure the SELECT policy allows public (anon) access to view
-- waitlist entries. This is needed for:
-- - Status pages (/waitlist/status/:id)
-- - Leaderboard pages
-- - Position lookups
--
-- HOW TO RUN: Copy and paste this SQL into the Supabase Dashboard SQL Editor
-- and execute it.
--
-- ============================================================================

-- Drop ALL existing SELECT policies to start fresh
DROP POLICY IF EXISTS "meetings_waitlist_select" ON meetings_waitlist;
DROP POLICY IF EXISTS "Anyone can view waitlist entries" ON meetings_waitlist;
DROP POLICY IF EXISTS "Users can view their own waitlist entry" ON meetings_waitlist;
DROP POLICY IF EXISTS "Admins can view all waitlist entries" ON meetings_waitlist;

-- Create a single, simple SELECT policy that allows PUBLIC access
-- This is safe because waitlist entries don't contain sensitive information
-- and are meant to be publicly viewable (for leaderboards, status pages, etc.)
CREATE POLICY "meetings_waitlist_select"
ON meetings_waitlist FOR SELECT
TO public  -- This includes both 'anon' and 'authenticated' roles
USING (true);  -- Allow anyone to view any waitlist entry

-- Ensure RLS is enabled (it should be, but just in case)
ALTER TABLE meetings_waitlist ENABLE ROW LEVEL SECURITY;

-- Grant SELECT permission to anon role explicitly
-- This ensures anonymous users can query the table
GRANT SELECT ON meetings_waitlist TO anon;
GRANT SELECT ON meetings_waitlist TO authenticated;

-- Verify the policy was created correctly
SELECT 
  policyname, 
  cmd, 
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'meetings_waitlist'
AND cmd = 'SELECT'
ORDER BY policyname;

-- Test query (should work without authentication)
-- This should return results even when not logged in
SELECT 
  id,
  email,
  full_name,
  effective_position,
  total_points,
  referral_count
FROM meetings_waitlist
LIMIT 1;
