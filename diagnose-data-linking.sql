-- Diagnose why data isn't showing up for logged-in user
-- Run this and send me the results

-- 1. Check what user ID you're logged in as
SELECT 'Logged in user info:' as check_type;
SELECT
    id as user_id,
    email,
    created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check if this user has a profile
SELECT 'Profile check:' as check_type;
SELECT
    p.id as profile_id,
    p.email,
    u.id as auth_user_id,
    CASE
        WHEN p.id = u.id THEN '✅ IDs Match'
        ELSE '❌ IDs Mismatch'
    END as id_status
FROM profiles p
LEFT JOIN auth.users u ON p.email = u.email
LIMIT 5;

-- 3. Check activities table owner_id values
SELECT 'Activities ownership check:' as check_type;
SELECT
    a.id,
    a.owner_id,
    a.user_id,
    p.email as profile_email,
    CASE
        WHEN p.id IS NOT NULL THEN '✅ Owner exists in profiles'
        ELSE '❌ Owner missing from profiles'
    END as owner_status
FROM activities a
LEFT JOIN profiles p ON a.owner_id = p.id
LIMIT 10;

-- 4. Check deals table owner_id values
SELECT 'Deals ownership check:' as check_type;
SELECT
    d.id,
    d.owner_id,
    p.email as profile_email,
    CASE
        WHEN p.id IS NOT NULL THEN '✅ Owner exists in profiles'
        ELSE '❌ Owner missing from profiles'
    END as owner_status
FROM deals d
LEFT JOIN profiles p ON d.owner_id = p.id
LIMIT 10;

-- 5. Count orphaned records
SELECT 'Orphaned records summary:' as check_type;

SELECT
    'activities' as table_name,
    COUNT(*) as total_records,
    SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END) as orphaned_records
FROM activities a
LEFT JOIN profiles p ON a.owner_id = p.id

UNION ALL

SELECT
    'deals' as table_name,
    COUNT(*) as total_records,
    SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END) as orphaned_records
FROM deals d
LEFT JOIN profiles p ON d.owner_id = p.id

UNION ALL

SELECT
    'contacts' as table_name,
    COUNT(*) as total_records,
    SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END) as orphaned_records
FROM contacts c
LEFT JOIN profiles p ON c.owner_id = p.id;
