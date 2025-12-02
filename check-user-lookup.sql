-- Check User Lookup Issue
-- The webhook is failing to find users by email

-- 1. What emails are in the webhook payload?
-- (You'll need to check Fathom's webhook logs for this)

-- 2. What emails are in your system?
SELECT
  user_id,
  fathom_user_email,
  is_active,
  token_expires_at,
  token_expires_at > NOW() as token_valid
FROM fathom_integrations
WHERE is_active = true
ORDER BY fathom_user_email;

-- 3. What users exist in auth.users?
SELECT
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY email;

-- 4. Check if there's a mismatch
-- Common issues:
-- - Email in webhook has different casing (andrew@example.com vs Andrew@example.com)
-- - Email in webhook is from a different account than expected
-- - User was deleted but webhooks still fire

-- DIAGNOSIS:
-- If the webhook receives "user@example.com" but fathom_integrations has "User@example.com",
-- the lookup will fail and user_id will be null.

-- SOLUTION:
-- Run this to see what's happening:
