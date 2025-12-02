-- Fix Missing fathom_user_email Values
-- This is why webhooks are failing!

-- Step 1: Populate fathom_user_email from auth.users
UPDATE fathom_integrations fi
SET
  fathom_user_email = u.email,
  updated_at = NOW()
FROM auth.users u
WHERE fi.user_id = u.id
  AND fi.fathom_user_email IS NULL
  AND fi.is_active = true;

-- Step 2: Verify the fix
SELECT
  user_id,
  fathom_user_email,
  is_active,
  CASE
    WHEN fathom_user_email IS NULL THEN '❌ STILL NULL'
    ELSE '✅ FIXED'
  END as status
FROM fathom_integrations
WHERE is_active = true
ORDER BY fathom_user_email;

-- Step 3: Check if any are still null
SELECT COUNT(*) as still_null_count
FROM fathom_integrations
WHERE is_active = true
  AND fathom_user_email IS NULL;

-- If any are still null, you'll need to manually set them:
-- UPDATE fathom_integrations
-- SET fathom_user_email = 'their-actual-email@example.com'
-- WHERE user_id = 'user-id-here';

-- EXPECTED RESULT:
-- All 9 users should now have fathom_user_email populated
-- Webhooks will now be able to find users by email
