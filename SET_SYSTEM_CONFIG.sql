-- Set System Configuration for Next-Actions Triggers
-- Run this in Supabase SQL Editor after enabling pg_net

-- Step 1: Update Supabase URL (replace with your actual project URL)
UPDATE system_config
SET value = 'https://YOUR-PROJECT-REF.supabase.co',
    updated_at = NOW()
WHERE key = 'supabase_url';

-- Step 2: Update Service Role Key (get from Dashboard → Settings → API)
UPDATE system_config
SET value = 'YOUR-SERVICE-ROLE-KEY',
    updated_at = NOW()
WHERE key = 'service_role_key';

-- Step 3: Verify configuration is set
SELECT
  key,
  CASE
    WHEN key = 'supabase_url' THEN value
    WHEN key = 'service_role_key' THEN
      CASE
        WHEN value = 'placeholder-key' THEN '❌ NOT SET'
        ELSE '✅ SET (hidden)'
      END
    ELSE value
  END as value_status,
  description,
  updated_at
FROM system_config
ORDER BY key;

-- Expected output:
-- key                | value_status           | description                              | updated_at
-- -------------------+------------------------+------------------------------------------+---------------------------
-- service_role_key   | ✅ SET (hidden)        | Service role key for authenticating...   | 2025-10-31 12:34:56+00
-- supabase_url       | https://abc123.supabase.co | Supabase project URL for Edge Function... | 2025-10-31 12:34:56+00
