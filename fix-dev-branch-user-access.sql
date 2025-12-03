-- Fix Development Branch User Access
-- This script ensures your user exists and has proper access in the development branch

-- 1. Check if user exists in profiles
SELECT
  id,
  email,
  first_name,
  last_name,
  is_admin,
  created_at
FROM profiles
WHERE email = 'andrew.bryce@sixtyseconds.video'
   OR id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459';

-- 2. If user doesn't exist, create profile record
-- Note: The auth.users record should come from production data sync
-- This just ensures the profile exists with admin privileges
INSERT INTO profiles (
  id,
  email,
  first_name,
  last_name,
  is_admin,
  stage
)
VALUES (
  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459',
  'andrew.bryce@sixtyseconds.video',
  'Andrew',
  'Bryce',
  true,
  'Admin'
)
ON CONFLICT (id) DO UPDATE SET
  is_admin = true,
  stage = 'Admin';

-- 3. Check meetings table for RLS policies
SELECT
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
ORDER BY policyname;

-- 4. Check if the user has any meetings
SELECT COUNT(*) as meeting_count
FROM meetings
WHERE owner_user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'
   OR owner_email = 'andrew.bryce@sixtyseconds.video';

-- 5. Check organization memberships
SELECT
  om.id,
  om.org_id,
  o.name as org_name,
  om.role,
  om.created_at
FROM organization_memberships om
LEFT JOIN organizations o ON o.id = om.org_id
WHERE om.user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459';

-- 6. If no org membership, create one
-- First get or create the default organization
INSERT INTO organizations (id, name, created_by)
VALUES (
  gen_random_uuid(),
  'Sixty Seconds',
  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'
)
ON CONFLICT (name) DO NOTHING;

-- Add user to organization as owner
INSERT INTO organization_memberships (
  org_id,
  user_id,
  role
)
SELECT
  id,
  'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459',
  'owner'
FROM organizations
WHERE name = 'Sixty Seconds'
ON CONFLICT (org_id, user_id) DO UPDATE SET
  role = 'owner';
