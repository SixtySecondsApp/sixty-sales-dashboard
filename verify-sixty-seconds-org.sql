-- Verification Script for Sixty Seconds Organization Setup
-- Run this script to verify the organization was created and users were assigned

-- 1. Check if Sixty Seconds organization exists
SELECT
  id,
  name,
  is_active,
  created_at,
  created_by
FROM organizations
WHERE name = 'Sixty Seconds';

-- 2. List all users with @sixtyseconds.video email addresses
SELECT
  u.id,
  u.email,
  p.first_name,
  p.last_name,
  u.created_at as user_created_at
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE
  u.email LIKE '%@sixtyseconds.video'
  OR p.email LIKE '%@sixtyseconds.video'
ORDER BY u.email;

-- 3. Check organization memberships for Sixty Seconds org
SELECT
  om.org_id,
  o.name as org_name,
  om.user_id,
  u.email,
  p.first_name,
  p.last_name,
  om.role,
  om.created_at as membership_created_at
FROM organization_memberships om
JOIN organizations o ON o.id = om.org_id
JOIN auth.users u ON u.id = om.user_id
LEFT JOIN profiles p ON p.id = om.user_id
WHERE o.name = 'Sixty Seconds'
ORDER BY u.email;

-- 4. Count summary
SELECT
  'Total @sixtyseconds.video users' as metric,
  COUNT(DISTINCT u.id) as count
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE
  u.email LIKE '%@sixtyseconds.video'
  OR p.email LIKE '%@sixtyseconds.video'

UNION ALL

SELECT
  'Users in Sixty Seconds org' as metric,
  COUNT(*) as count
FROM organization_memberships om
JOIN organizations o ON o.id = om.org_id
WHERE o.name = 'Sixty Seconds';

-- 5. Check if auto-assignment triggers exist
SELECT
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled
FROM pg_trigger
WHERE tgname LIKE '%sixty_seconds%'
ORDER BY tgname;
