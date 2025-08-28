-- Simple Debug for HTTP 401 Authentication Errors
-- Check existing API key without creating new ones

-- 1. Check if our API key exists and has permissions
SELECT 
  '=== API KEY STATUS CHECK ===' as section,
  name,
  key_preview,
  permissions,
  is_active,
  expires_at,
  rate_limit,
  user_id,
  created_at
FROM api_keys 
WHERE key_hash = encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex');

-- 2. Test the validate_api_key function directly
SELECT 
  '=== DIRECT VALIDATION TEST ===' as section,
  is_valid,
  user_id,
  permissions,
  rate_limit,
  is_expired,
  is_active
FROM validate_api_key('sk_8b61b8892eec45fcb56908b7209a3985');

-- 3. Check if the validate_api_key RPC function exists and works (for Edge Functions)
SELECT 
  '=== RPC FUNCTION TEST ===' as section
FROM validate_api_key('{"key_text": "sk_8b61b8892eec45fcb56908b7209a3985"}'::jsonb);

-- 4. Verify the key hash calculation matches
SELECT 
  '=== HASH VERIFICATION ===' as section,
  'sk_8b61b8892eec45fcb56908b7209a3985' as original_key,
  encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex') as calculated_hash,
  key_hash as stored_hash,
  (encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex') = key_hash) as hash_matches
FROM api_keys 
WHERE key_preview LIKE 'sk_8b61b88%';

-- 5. Check what profiles exist
SELECT 
  '=== PROFILES TABLE CHECK ===' as section,
  id,
  email,
  created_at
FROM profiles 
LIMIT 5;

-- 6. Update the existing API key with full permissions (if it exists)
UPDATE api_keys 
SET permissions = '["contacts:read", "contacts:write", "contacts:delete", "companies:read", "companies:write", "companies:delete", "deals:read", "deals:write", "deals:delete", "tasks:read", "tasks:write", "tasks:delete", "meetings:read", "meetings:write", "meetings:delete", "activities:read", "activities:write", "activities:delete", "admin"]'::jsonb,
    is_active = true,
    rate_limit = 10000
WHERE key_hash = encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex');

-- 7. Final verification
SELECT 
  '=== FINAL VERIFICATION ===' as section,
  name,
  permissions,
  is_active,
  'contacts:write' = ANY(array(SELECT jsonb_array_elements_text(permissions))) as has_write_permission,
  'admin' = ANY(array(SELECT jsonb_array_elements_text(permissions))) as has_admin_permission
FROM api_keys 
WHERE key_hash = encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex');

SELECT '🔍 Simple API Key debugging complete!' as result;