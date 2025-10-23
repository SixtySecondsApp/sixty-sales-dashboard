-- Check RLS policies for meetings table

-- Check if RLS is enabled
SELECT 
    'RLS Status' as check_type,
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'meetings'
AND schemaname = 'public';

-- Check existing policies
SELECT 
    'Policies' as check_type,
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

-- Test if we can select meetings directly
SELECT 
    'Direct Select Test' as check_type,
    COUNT(*) as visible_meetings
FROM meetings;

-- Check if the user can see their own meetings
SELECT 
    'User Meetings Test' as check_type,
    id,
    title,
    owner_user_id,
    meeting_start
FROM meetings
WHERE owner_user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'
LIMIT 3;