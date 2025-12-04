-- Diagnose why the mapping didn't work

-- 1. How many profiles do we have?
SELECT 'Profile counts:' as check_type;
SELECT
    COUNT(*) as total_profiles,
    COUNT(DISTINCT email) as unique_emails
FROM profiles;

-- 2. How many auth users do we have?
SELECT 'Auth user counts:' as check_type;
SELECT
    COUNT(*) as total_auth_users
FROM auth.users;

-- 3. Do profile emails match auth user emails?
SELECT 'Email matching:' as check_type;
SELECT
    COUNT(DISTINCT p.email) as profile_emails,
    COUNT(DISTINCT u.email) as auth_emails,
    COUNT(DISTINCT CASE WHEN u.email IS NOT NULL THEN p.email END) as matching_emails,
    COUNT(DISTINCT CASE WHEN u.email IS NULL THEN p.email END) as unmatched_profile_emails
FROM profiles p
LEFT JOIN auth.users u ON p.email = u.email;

-- 4. Show some orphaned activity owner_ids
SELECT 'Sample orphaned activities:' as check_type;
SELECT
    a.owner_id,
    a.user_id,
    COUNT(*) as activity_count
FROM activities a
LEFT JOIN profiles p ON a.user_id = p.id
WHERE p.id IS NULL
GROUP BY a.owner_id, a.user_id
LIMIT 10;

-- 5. Can we find these owner_ids in the OLD profiles data?
SELECT 'Do orphaned IDs exist in profiles at all?' as check_type;
SELECT
    a.owner_id as orphaned_id,
    p.id as profile_id,
    p.email as profile_email
FROM activities a
LEFT JOIN profiles p ON a.owner_id = p.id
WHERE a.user_id IS NULL
LIMIT 10;
