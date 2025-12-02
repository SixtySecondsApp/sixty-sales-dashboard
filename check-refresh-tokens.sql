-- Check if refresh_token is stored for all users

SELECT
  user_id,
  fathom_user_email,
  token_expires_at,
  token_expires_at > NOW() as is_valid,
  NOW() - token_expires_at as expired_for,
  -- Check if tokens exist (without revealing the actual values)
  access_token IS NOT NULL as has_access_token,
  refresh_token IS NOT NULL as has_refresh_token,
  CASE
    WHEN refresh_token IS NULL THEN '❌ NO REFRESH TOKEN'
    WHEN LENGTH(refresh_token) < 10 THEN '⚠️ TOKEN TOO SHORT'
    ELSE '✅ HAS REFRESH TOKEN'
  END as refresh_token_status,
  LENGTH(refresh_token) as refresh_token_length,
  is_active
FROM fathom_integrations
WHERE is_active = true
ORDER BY token_expires_at DESC;

-- EXPECTED:
-- All users should have:
-- - has_refresh_token: true
-- - refresh_token_status: ✅ HAS REFRESH TOKEN
-- - refresh_token_length: > 20 characters

-- IF ANY HAVE NULL REFRESH TOKENS:
-- This is the problem! The initial OAuth didn't store the refresh_token.
-- Users need to reconnect to get a fresh refresh_token stored.
