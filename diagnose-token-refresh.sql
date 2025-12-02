-- Diagnose Why OAuth Tokens Aren't Auto-Refreshing

-- 1. Check if refresh_token is stored
SELECT
  user_id,
  fathom_user_email,
  token_expires_at,
  token_expires_at > NOW() as is_valid,
  refresh_token IS NOT NULL as has_refresh_token,
  LENGTH(refresh_token) as refresh_token_length,
  access_token IS NOT NULL as has_access_token,
  is_active
FROM fathom_integrations
WHERE is_active = true
ORDER BY token_expires_at DESC;

-- 2. Check when tokens expired
SELECT
  user_id,
  fathom_user_email,
  token_expires_at,
  NOW() - token_expires_at as expired_for,
  CASE
    WHEN token_expires_at > NOW() THEN '✅ Valid'
    WHEN token_expires_at > NOW() - INTERVAL '7 days' THEN '⚠️ Recently expired'
    WHEN token_expires_at > NOW() - INTERVAL '30 days' THEN '❌ Expired < 30 days'
    ELSE '💀 Expired > 30 days'
  END as status
FROM fathom_integrations
WHERE is_active = true
ORDER BY token_expires_at DESC;

-- 3. Check if we have OAuth client credentials configured
-- (These are needed for token refresh)
-- Note: Can't check Edge Function env vars from SQL,
-- but we can check if the refresh function exists

-- QUESTIONS TO ANSWER:
-- 1. Do all integrations have refresh_token? (should be TRUE)
-- 2. When did tokens expire? (shows how long they've been broken)
-- 3. Are Edge Function env vars set? (need to check Supabase dashboard)
