-- Step 1: Check what API keys exist
SELECT 
  name,
  key_preview,
  is_active,
  permissions,
  user_id,
  created_at
FROM api_keys 
ORDER BY created_at DESC
LIMIT 5;