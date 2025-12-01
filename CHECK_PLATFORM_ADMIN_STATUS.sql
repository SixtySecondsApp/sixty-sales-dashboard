-- Check Platform Admin Status and Grant Access
-- Run this query to see your current status and grant admin access

-- 1. Check your current profile status
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

-- 2. Grant yourself platform admin access
UPDATE profiles
SET is_admin = true
WHERE email = 'andrew.bryce@sixtyseconds.video';

-- 3. Verify the update worked
SELECT email, is_admin FROM profiles WHERE email = 'andrew.bryce@sixtyseconds.video';
