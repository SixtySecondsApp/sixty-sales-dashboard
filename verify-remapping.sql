-- Quick verification that remapping worked
SELECT
    'auth.users' as table_name,
    COUNT(*) as count
FROM auth.users

UNION ALL

SELECT
    'profiles' as table_name,
    COUNT(*) as count
FROM profiles

UNION ALL

SELECT
    'profiles with auth' as table_name,
    COUNT(*) as count
FROM profiles p
INNER JOIN auth.users u ON p.id = u.id;

-- Check if any profile IDs don't have auth users
SELECT
    p.email,
    p.id as profile_id,
    u.id as auth_id,
    CASE WHEN u.id IS NOT NULL THEN '✅ Has Auth' ELSE '❌ Missing Auth' END as status
FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
ORDER BY p.email;
