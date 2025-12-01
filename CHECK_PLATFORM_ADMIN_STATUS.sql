-- Check Platform Admin Status
-- Run this query to see why you're being redirected

-- 1. Check your profile and admin status
SELECT
  p.id,
  p.email,
  p.full_name,
  p.is_admin,
  p.role,
  p.created_at
FROM profiles p
WHERE p.email = 'andrew.bryce@sixtyseconds.video'
LIMIT 1;

-- 2. Check internal domains configuration
SELECT * FROM internal_domains ORDER BY domain;

-- 3. Quick fix - Grant yourself platform admin access
-- OPTION A: Set is_admin flag (RECOMMENDED)
UPDATE profiles
SET is_admin = true
WHERE email = 'andrew.bryce@sixtyseconds.video';

-- OPTION B: Set role to admin (alternative method)
-- UPDATE profiles
-- SET role = 'admin'
-- WHERE email = 'andrew.bryce@sixtyseconds.video';

-- 4. Verify after update
SELECT email, is_admin, role FROM profiles WHERE email = 'andrew.bryce@sixtyseconds.video';
