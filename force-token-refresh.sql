-- Force Token Refresh Test
-- This will call the fathom-sync function which will automatically refresh the token

-- First, let's see the current token status
SELECT
  user_id,
  fathom_user_email,
  token_expires_at,
  LEFT(access_token, 10) || '...' as old_access_token,
  EXTRACT(EPOCH FROM (NOW() - token_expires_at)) / 3600 as hours_since_expiry
FROM fathom_integrations
WHERE is_active = true;

-- Now we'll trigger a sync via the Edge Function
-- Run this command in your terminal instead (SQL can't call Edge Functions directly):
--
-- curl -X POST 'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-sync' \
--   -H 'Authorization: Bearer <YOUR_SERVICE_ROLE_KEY>' \
--   -H 'Content-Type: application/json' \
--   -d '{
--     "sync_type": "manual",
--     "user_id": "<USER_ID_FROM_ABOVE_QUERY>",
--     "limit": 1
--   }'

-- After running the curl command, check if the token was refreshed:
-- (Wait 5 seconds, then run this)

SELECT
  user_id,
  fathom_user_email,
  token_expires_at,
  LEFT(access_token, 10) || '...' as new_access_token,
  updated_at,
  CASE
    WHEN token_expires_at > NOW() THEN '✅ REFRESHED!'
    ELSE '❌ STILL EXPIRED'
  END as refresh_status
FROM fathom_integrations
WHERE is_active = true;
