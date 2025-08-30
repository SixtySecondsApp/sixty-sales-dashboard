-- Comprehensive API Key Fix and Authentication Test
-- This script will fix the API key and test the complete auth flow

-- 1. First, let's see what API keys currently exist
SELECT 
  '=== CURRENT API KEYS ===' as section,
  name,
  key_preview,
  permissions,
  is_active,
  user_id,
  rate_limit,
  created_at
FROM api_keys 
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check if the specific key exists
SELECT 
  '=== SEARCHING FOR TEST KEY ===' as section,
  COUNT(*) as key_count,
  bool_or(is_active) as any_active
FROM api_keys 
WHERE key_hash = encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex');

-- 3. Update or insert the test API key with proper permissions
DO $$
DECLARE
  test_user_id UUID;
  existing_key_count INTEGER;
BEGIN
  -- Get the first available user ID from profiles table
  SELECT id INTO test_user_id FROM profiles LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'No profiles found. Checking auth.users...';
    SELECT id INTO test_user_id FROM auth.users LIMIT 1;
    
    IF test_user_id IS NULL THEN
      RAISE NOTICE 'No users found. Creating a test user reference...';
      -- We'll use a placeholder UUID for testing
      test_user_id := '00000000-0000-0000-0000-000000000000';
    END IF;
  END IF;
  
  RAISE NOTICE 'Using user_id: %', test_user_id;
  
  -- Check if key exists
  SELECT COUNT(*) INTO existing_key_count 
  FROM api_keys 
  WHERE key_hash = encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex');
  
  IF existing_key_count > 0 THEN
    -- Update existing key
    UPDATE api_keys 
    SET 
      permissions = '["contacts:read", "contacts:write", "contacts:delete", "companies:read", "companies:write", "companies:delete", "deals:read", "deals:write", "deals:delete", "tasks:read", "tasks:write", "tasks:delete", "meetings:read", "meetings:write", "meetings:delete", "activities:read", "activities:write", "activities:delete", "admin"]'::jsonb,
      is_active = true,
      rate_limit = 50000,
      name = 'Test Suite Master Key - Updated'
    WHERE key_hash = encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex');
    
    RAISE NOTICE 'Updated existing API key';
  ELSE
    -- Insert new key (try with user_id, fallback without foreign key constraint)
    BEGIN
      INSERT INTO api_keys (
        name,
        key_hash,
        key_preview,
        permissions,
        rate_limit,
        user_id,
        is_active
      ) VALUES (
        'Test Suite Master Key - Created',
        encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex'),
        'sk_8b61b88...',
        '["contacts:read", "contacts:write", "contacts:delete", "companies:read", "companies:write", "companies:delete", "deals:read", "deals:write", "deals:delete", "tasks:read", "tasks:write", "tasks:delete", "meetings:read", "meetings:write", "meetings:delete", "activities:read", "activities:write", "activities:delete", "admin"]'::jsonb,
        50000,
        test_user_id,
        true
      );
      RAISE NOTICE 'Created new API key with user_id';
    EXCEPTION 
      WHEN foreign_key_violation THEN
        RAISE NOTICE 'Foreign key constraint failed, trying without user_id...';
        -- If foreign key fails, insert without user_id (set to NULL)
        INSERT INTO api_keys (
          name,
          key_hash,
          key_preview,
          permissions,
          rate_limit,
          is_active
        ) VALUES (
          'Test Suite Master Key - No User',
          encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex'),
          'sk_8b61b88...',
          '["contacts:read", "contacts:write", "contacts:delete", "companies:read", "companies:write", "companies:delete", "deals:read", "deals:write", "deals:delete", "tasks:read", "tasks:write", "tasks:delete", "meetings:read", "meetings:write", "meetings:delete", "activities:read", "activities:write", "activities:delete", "admin"]'::jsonb,
          50000,
          true
        );
        RAISE NOTICE 'Created new API key without user_id';
    END;
  END IF;
END $$;

-- 4. Verify the API key was created/updated correctly
SELECT 
  '=== UPDATED API KEY STATUS ===' as section,
  name,
  key_preview,
  permissions,
  is_active,
  user_id,
  rate_limit,
  'contacts:write' = ANY(array(SELECT jsonb_array_elements_text(permissions))) as has_write,
  'admin' = ANY(array(SELECT jsonb_array_elements_text(permissions))) as has_admin,
  array_length(array(SELECT jsonb_array_elements_text(permissions)), 1) as permission_count
FROM api_keys 
WHERE key_hash = encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex');

-- 5. Test the validate_api_key function
DO $$
DECLARE
  auth_result RECORD;
  test_key TEXT := 'sk_8b61b8892eec45fcb56908b7209a3985';
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TESTING API KEY VALIDATION ===';
  
  -- Test the function
  SELECT * INTO auth_result FROM validate_api_key(test_key) LIMIT 1;
  
  RAISE NOTICE 'Validation result:';
  RAISE NOTICE '  is_valid: %', COALESCE(auth_result.is_valid, false);
  RAISE NOTICE '  user_id: %', COALESCE(auth_result.user_id::text, 'NULL');
  RAISE NOTICE '  permissions: %', COALESCE(auth_result.permissions::text, 'NULL');
  RAISE NOTICE '  is_active: %', COALESCE(auth_result.is_active, false);
  RAISE NOTICE '  is_expired: %', COALESCE(auth_result.is_expired, false);
  
  IF auth_result.is_valid THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ API KEY VALIDATION PASSED!';
    RAISE NOTICE '🎉 The API endpoints should now work!';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '❌ API key validation failed';
    RAISE NOTICE 'Check the validate_api_key function definition';
  END IF;
END $$;

-- 6. Test the RPC version (used by Edge Functions)
DO $$
DECLARE
  rpc_result RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TESTING RPC VERSION ===';
  
  -- Test RPC call like Edge Functions use
  BEGIN
    SELECT * INTO rpc_result FROM validate_api_key('{"key_text": "sk_8b61b8892eec45fcb56908b7209a3985"}'::jsonb) LIMIT 1;
    
    RAISE NOTICE 'RPC result:';
    RAISE NOTICE '  is_valid: %', COALESCE(rpc_result.is_valid, false);
    RAISE NOTICE '  user_id: %', COALESCE(rpc_result.user_id::text, 'NULL');
    
    IF rpc_result.is_valid THEN
      RAISE NOTICE '✅ RPC validation works!';
    ELSE
      RAISE NOTICE '❌ RPC validation failed';
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ RPC call failed: %', SQLERRM;
  END;
END $$;

-- 7. Final status
SELECT 
  '=== FINAL STATUS SUMMARY ===' as section,
  COUNT(*) as total_active_keys,
  bool_and('contacts:write' = ANY(array(SELECT jsonb_array_elements_text(permissions)))) as all_have_write,
  bool_and('admin' = ANY(array(SELECT jsonb_array_elements_text(permissions)))) as all_have_admin
FROM api_keys 
WHERE is_active = true;

SELECT '🚀 API Key setup complete! Try your test suite now!' as result;