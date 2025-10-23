-- Fix RLS policies for meetings table
-- This ensures users can see meetings

-- Check current RLS status
SELECT 
    'Current RLS Status' as info,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'meetings'
AND schemaname = 'public';

-- Disable RLS temporarily to test (you can re-enable later with policies)
ALTER TABLE meetings DISABLE ROW LEVEL SECURITY;

-- Or, if you want to keep RLS enabled, create a policy to allow users to see meetings
-- First, enable RLS if not already enabled
-- ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows users to see all meetings (or just their own)
-- Option 1: Users can see ALL meetings
-- DROP POLICY IF EXISTS "Users can view all meetings" ON meetings;
-- CREATE POLICY "Users can view all meetings" 
--     ON meetings FOR SELECT 
--     USING (true);

-- Option 2: Users can only see their own meetings
-- DROP POLICY IF EXISTS "Users can view own meetings" ON meetings;
-- CREATE POLICY "Users can view own meetings" 
--     ON meetings FOR SELECT 
--     USING (auth.uid() = owner_user_id);

-- Verify the change
SELECT 
    'After Fix - RLS Status' as info,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'meetings'
AND schemaname = 'public';

-- Test query to verify meetings are accessible
SELECT 
    'Test Query' as info,
    COUNT(*) as total_meetings_visible
FROM meetings;