-- Check the current state of profiles in development-v2

-- 1. How many profiles with each ID do we have?
SELECT 'Profile IDs:' as info;
SELECT
    id,
    email,
    created_at
FROM profiles
ORDER BY email
LIMIT 25;

-- 2. How many auth users?
SELECT 'Auth users:' as info;
SELECT
    COUNT(*) as total_auth_users
FROM auth.users;

-- 3. Do we have duplicate profiles for the same email?
SELECT 'Duplicate emails?' as info;
SELECT
    email,
    COUNT(*) as profile_count,
    array_agg(id) as profile_ids
FROM profiles
GROUP BY email
HAVING COUNT(*) > 1;

-- 4. Show all profile emails
SELECT 'All profile emails:' as info;
SELECT DISTINCT email FROM profiles ORDER BY email;
