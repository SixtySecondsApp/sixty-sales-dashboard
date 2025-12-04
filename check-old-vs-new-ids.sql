-- Check if we have old profile IDs vs new ones

-- 1. Show current profiles (new IDs from auth)
SELECT 'Current profiles (from auth):' as info;
SELECT
    p.id,
    p.email,
    'NEW' as type
FROM profiles p
ORDER BY p.email
LIMIT 5;

-- 2. Show owner_ids from activities (should be old IDs)
SELECT 'Activities owner_ids (old IDs):' as info;
SELECT DISTINCT
    a.owner_id,
    'OLD' as type,
    COUNT(*) as activity_count
FROM activities a
GROUP BY a.owner_id
ORDER BY activity_count DESC
LIMIT 5;

-- 3. Check if any activities owner_id matches current profile IDs
SELECT 'Match check:' as info;
SELECT
    COUNT(DISTINCT a.owner_id) as unique_activity_owners,
    COUNT(DISTINCT p.id) as unique_profiles,
    COUNT(DISTINCT CASE WHEN p.id IS NOT NULL THEN a.owner_id END) as matching_ids
FROM activities a
LEFT JOIN profiles p ON a.owner_id = p.id;

-- 4. Show emails from activities that we can use to map
SELECT 'Can we map by email?' as info;
SELECT DISTINCT
    a.owner_id as old_owner_id,
    c.email as contact_email,
    p.id as new_profile_id,
    p.email as profile_email
FROM activities a
LEFT JOIN contacts c ON c.owner_id = a.owner_id
LEFT JOIN profiles p ON c.email = p.email
WHERE c.email IS NOT NULL
LIMIT 10;
