-- Check Platform Admin Status
-- Run this query to see why you're being redirected

-- 1. Check your profile and admin status
SELECT
  id,
  email,
  first_name,
  last_name,
  is_admin,
  created_at
FROM profiles
WHERE email = 'andrew.bryce@sixtyseconds.video'
LIMIT 1;

-- 2. Check internal domains configuration
SELECT * FROM internal_domains ORDER BY domain;

-- 3. Grant yourself platform admin access
UPDATE profiles
SET is_admin = true
WHERE email = 'andrew.bryce@sixtyseconds.video';

-- 4. Verify after update
SELECT email, is_admin FROM profiles WHERE email = 'andrew.bryce@sixtyseconds.video';
