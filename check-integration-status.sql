-- Check Fathom integration status
-- Run this in Supabase SQL Editor

SELECT
  id,
  user_id,
  fathom_user_email,
  is_active,
  token_expires_at,
  CASE
    WHEN token_expires_at < NOW() THEN '❌ EXPIRED'
    WHEN token_expires_at < NOW() + INTERVAL '1 hour' THEN '⚠️ EXPIRING SOON'
    ELSE '✅ VALID'
  END as token_status,
  EXTRACT(EPOCH FROM (token_expires_at - NOW())) / 3600 as hours_until_expiry,
  last_sync_at,
  created_at,
  updated_at,
  -- Mask tokens for security (show first 10 chars only)
  LEFT(access_token, 10) || '...' as access_token_preview,
  CASE
    WHEN refresh_token IS NOT NULL AND LENGTH(refresh_token) > 0
    THEN '✅ Present'
    ELSE '❌ Missing'
  END as refresh_token_status
FROM fathom_integrations
WHERE is_active = true
ORDER BY created_at DESC;
