-- Debug HTTP 401 Authentication Errors
-- Check if API key exists and has correct format

-- 1. Check if our API key exists and has permissions
SELECT 
  '=== API KEY STATUS CHECK ===' as section,
  name,
  key_preview,
  permissions,
  is_active,
  expires_at,
  rate_limit,
  user_id
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

-- 3. Check if the validate_api_key RPC function exists and works
SELECT 
  '=== RPC FUNCTION TEST ===' as section,
  *
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

-- 5. Create a fresh API key if needed
DO $$
DECLARE
  new_key_result RECORD;
  test_user_id UUID;
BEGIN
  -- Get a user ID for testing
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'No users found in auth.users table';
    RETURN;
  END IF;
  
  RAISE NOTICE '=== CREATING FRESH TEST API KEY ===';
  RAISE NOTICE 'Using user ID: %', test_user_id;
  
  -- Insert a fresh test API key
  INSERT INTO api_keys (
    name,
    key_hash,
    key_preview,
    permissions,
    rate_limit,
    user_id,
    is_active
  ) VALUES (
    'Fresh Test Key',
    encode(digest('sk_test_fresh_key_123', 'sha256'), 'hex'),
    'sk_test_fresh_key_123'::text,
    '["contacts:read", "contacts:write", "contacts:delete", "companies:read", "companies:write", "companies:delete", "deals:read", "deals:write", "deals:delete", "tasks:read", "tasks:write", "tasks:delete", "meetings:read", "meetings:write", "meetings:delete", "activities:read", "activities:write", "activities:delete", "admin"]'::jsonb,
    10000,
    test_user_id,
    true
  )
  ON CONFLICT (key_hash) DO UPDATE SET
    permissions = EXCLUDED.permissions,
    rate_limit = EXCLUDED.rate_limit,
    is_active = true;
  
  -- Test the fresh key
  SELECT * INTO new_key_result FROM validate_api_key('sk_test_fresh_key_123') LIMIT 1;
  
  RAISE NOTICE 'Fresh key validation:';
  RAISE NOTICE '  is_valid: %', new_key_result.is_valid;
  RAISE NOTICE '  user_id: %', new_key_result.user_id;
  RAISE NOTICE '  permissions: %', new_key_result.permissions;
  
  IF new_key_result.is_valid THEN
    RAISE NOTICE '✅ Fresh API key works! Try using: sk_test_fresh_key_123';
  ELSE
    RAISE NOTICE '❌ Fresh API key validation failed';
  END IF;
END $$;

SELECT '🔍 API Key debugging complete!' as result;