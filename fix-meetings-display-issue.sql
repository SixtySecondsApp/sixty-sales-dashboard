-- Fix meetings display issue - comprehensive solution
-- This script checks and fixes RLS policies for the meetings table

-- 1. Check current RLS status
SELECT 
    'Current RLS Status' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'meetings'
AND schemaname = 'public';

-- 2. Check existing policies on meetings table
SELECT 
    'Existing Policies' as check_type,
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
AND schemaname = 'public';

-- 3. Check if there are actually meetings in the table
SELECT 
    'Total Meetings Count' as check_type,
    COUNT(*) as total_meetings
FROM meetings;

-- 4. Check meetings for our specific user
SELECT 
    'User Meetings Count' as check_type,
    COUNT(*) as user_meetings
FROM meetings
WHERE owner_user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459';

-- 5. Test if we can see meetings with current RLS
SELECT 
    'Visible Meetings Test' as check_type,
    id,
    title,
    owner_user_id,
    meeting_start
FROM meetings
LIMIT 5;

-- 6. SOLUTION: Disable RLS to allow all users to see meetings
-- This is a temporary fix for development/testing
ALTER TABLE meetings DISABLE ROW LEVEL SECURITY;

-- 7. Alternative: If you want to keep RLS enabled, create proper policies
-- Uncomment the following lines to use RLS with proper policies:

-- -- First, ensure RLS is enabled
-- ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- -- Drop existing policies if any
-- DROP POLICY IF EXISTS "Users can view own meetings" ON meetings;
-- DROP POLICY IF EXISTS "Users can view all meetings" ON meetings;
-- DROP POLICY IF EXISTS "Users can insert own meetings" ON meetings;
-- DROP POLICY IF EXISTS "Users can update own meetings" ON meetings;
-- DROP POLICY IF EXISTS "Users can delete own meetings" ON meetings;

-- -- Create a policy that allows users to view their own meetings
-- CREATE POLICY "Users can view own meetings" 
--     ON meetings FOR SELECT 
--     USING (auth.uid() = owner_user_id);

-- -- Or if you want users to see ALL meetings (better for CRM):
-- CREATE POLICY "Users can view all meetings" 
--     ON meetings FOR SELECT 
--     USING (true);

-- -- Allow users to insert their own meetings
-- CREATE POLICY "Users can insert own meetings" 
--     ON meetings FOR INSERT 
--     WITH CHECK (auth.uid() = owner_user_id);

-- -- Allow users to update their own meetings
-- CREATE POLICY "Users can update own meetings" 
--     ON meetings FOR UPDATE 
--     USING (auth.uid() = owner_user_id)
--     WITH CHECK (auth.uid() = owner_user_id);

-- -- Allow users to delete their own meetings
-- CREATE POLICY "Users can delete own meetings" 
--     ON meetings FOR DELETE 
--     USING (auth.uid() = owner_user_id);

-- 8. Verify the fix
SELECT 
    'After Fix - RLS Status' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'meetings'
AND schemaname = 'public';

-- 9. Test that meetings are now visible
SELECT 
    'Final Visibility Test' as check_type,
    COUNT(*) as visible_meetings
FROM meetings;

-- 10. Show a sample of meetings to confirm they're accessible
SELECT 
    'Sample Meetings' as check_type,
    id,
    title,
    owner_user_id,
    meeting_start,
    duration_minutes
FROM meetings
ORDER BY meeting_start DESC
LIMIT 5;