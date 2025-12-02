-- Check if your user was added to Sixty Seconds organization
-- Run this in Supabase SQL Editor

-- 1. Show the Sixty Seconds organization
SELECT
  'Organization' as type,
  id,
  name,
  is_active,
  created_at
FROM organizations
WHERE name = 'Sixty Seconds';

-- 2. Show all @sixtyseconds.video users
SELECT
  'Users with @sixtyseconds.video' as type,
  u.id,
  u.email,
  p.first_name,
  p.last_name
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email LIKE '%@sixtyseconds.video'
   OR p.email LIKE '%@sixtyseconds.video';

-- 3. Show organization memberships for Sixty Seconds
SELECT
  'Organization Memberships' as type,
  o.name as org_name,
  u.email,
  p.first_name,
  p.last_name,
  om.role,
  om.created_at
FROM organization_memberships om
JOIN organizations o ON o.id = om.org_id
JOIN auth.users u ON u.id = om.user_id
LEFT JOIN profiles p ON p.id = om.user_id
WHERE o.name = 'Sixty Seconds';

-- 4. Count summary
SELECT
  COUNT(DISTINCT u.id) as total_sixtyseconds_users,
  (SELECT COUNT(*) FROM organization_memberships om
   JOIN organizations o ON o.id = om.org_id
   WHERE o.name = 'Sixty Seconds') as total_members_assigned
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE u.email LIKE '%@sixtyseconds.video'
   OR p.email LIKE '%@sixtyseconds.video';
