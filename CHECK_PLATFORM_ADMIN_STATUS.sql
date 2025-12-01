-- Check Platform Admin Status and Grant Access
-- Based on actual profiles table schema

-- Actual columns in profiles table:
-- id, first_name, last_name, email, stage, avatar_url, created_at, updated_at,
-- is_admin, clerk_user_id, last_login_at

-- 1. Check your current profile status
SELECT
  id,
  email,
  first_name,
  last_name,
  is_admin,
  last_login_at,
  created_at
FROM profiles
WHERE email = 'andrew.bryce@sixtyseconds.video';

-- 2. Grant yourself platform admin access
UPDATE profiles
SET is_admin = true
WHERE email = 'andrew.bryce@sixtyseconds.video';

-- 3. Verify the update worked
SELECT
  email,
  is_admin,
  last_login_at
FROM profiles
WHERE email = 'andrew.bryce@sixtyseconds.video';
