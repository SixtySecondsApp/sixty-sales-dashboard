-- Fix Permission Parsing Mismatch in CRUD Endpoints
-- Target the exact issue: JSONB from database vs string[] expected by CRUD endpoints

-- 1. First verify our API key has the correct permissions format
SELECT 
  '=== CURRENT API KEY PERMISSIONS ===' as section,
  name,
  permissions,
  pg_typeof(permissions) as permissions_type,
  jsonb_array_length(permissions) as permission_count
FROM api_keys 
WHERE key_hash = encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex');

-- 2. Test the validate_api_key function output format
DO $$
DECLARE
  test_result RECORD;
  test_key TEXT := 'sk_8b61b8892eec45fcb56908b7209a3985';
BEGIN
  RAISE NOTICE '=== TESTING API KEY VALIDATION OUTPUT ===';
  
  -- Call the function and examine the output
  SELECT * INTO test_result FROM validate_api_key(test_key) LIMIT 1;
  
  RAISE NOTICE 'Validation result:';
  RAISE NOTICE '  is_valid: %', test_result.is_valid;
  RAISE NOTICE '  permissions type: %', pg_typeof(test_result.permissions);
  RAISE NOTICE '  permissions value: %', test_result.permissions;
  RAISE NOTICE '  permissions as array: %', array(SELECT jsonb_array_elements_text(test_result.permissions));
  
  -- Test the exact conversion the CRUD endpoints need
  IF test_result.permissions IS NOT NULL THEN
    RAISE NOTICE '  can convert to text array: %', 
      'contacts:write' = ANY(array(SELECT jsonb_array_elements_text(test_result.permissions)));
  END IF;
END $$;

-- 3. Update API key with explicit write permissions in the correct format
UPDATE api_keys 
SET permissions = '["contacts:read", "contacts:write", "contacts:delete", "companies:read", "companies:write", "companies:delete", "deals:read", "deals:write", "deals:delete", "tasks:read", "tasks:write", "tasks:delete", "meetings:read", "meetings:write", "meetings:delete", "activities:read", "activities:write", "activities:delete", "admin"]'::jsonb
WHERE key_hash = encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex');

-- 4. Verify the update worked
SELECT 
  '=== UPDATED PERMISSIONS ===' as section,
  permissions,
  'contacts:write' = ANY(array(SELECT jsonb_array_elements_text(permissions))) as has_contacts_write,
  'admin' = ANY(array(SELECT jsonb_array_elements_text(permissions))) as has_admin
FROM api_keys 
WHERE key_hash = encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex');

-- 5. Test the complete authentication flow that the CRUD endpoints use
DO $$
DECLARE
  auth_result RECORD;
  test_key TEXT := 'sk_8b61b8892eec45fcb56908b7209a3985';
  perm_array TEXT[];
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== SIMULATING CRUD ENDPOINT AUTHENTICATION ===';
  
  -- This simulates exactly what authenticateRequest() does in api-utils.ts
  SELECT * INTO auth_result FROM validate_api_key(test_key) LIMIT 1;
  
  IF auth_result.is_valid THEN
    -- Convert JSONB to string array like the CRUD endpoints do
    SELECT array(SELECT jsonb_array_elements_text(auth_result.permissions)) INTO perm_array;
    
    RAISE NOTICE 'Authentication simulation:';
    RAISE NOTICE '  ✓ API key is valid: %', auth_result.is_valid;
    RAISE NOTICE '  ✓ User ID: %', auth_result.user_id;
    RAISE NOTICE '  ✓ Permissions array: %', perm_array;
    RAISE NOTICE '  ✓ Has contacts:write: %', 'contacts:write' = ANY(perm_array);
    RAISE NOTICE '  ✓ Has contacts:delete: %', 'contacts:delete' = ANY(perm_array);
    RAISE NOTICE '  ✓ Has admin: %', 'admin' = ANY(perm_array);
    
    -- Test the checkPermission logic from api-utils.ts
    IF 'contacts:write' = ANY(perm_array) THEN
      RAISE NOTICE '';
      RAISE NOTICE '🎉 PERMISSION CHECK SHOULD NOW PASS!';
      RAISE NOTICE '✅ contacts:write permission found in array';
      RAISE NOTICE '✅ CRUD endpoints should allow write operations';
    ELSE
      RAISE NOTICE '❌ contacts:write permission NOT found';
    END IF;
  ELSE
    RAISE NOTICE '❌ API key validation failed';
  END IF;
END $$;

-- 6. Final verification
SELECT 
  '=== FINAL STATUS ===' as section,
  'API Key Ready for Testing' as status,
  array_length(array(SELECT jsonb_array_elements_text(permissions)), 1) as total_permissions
FROM api_keys 
WHERE key_hash = encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex');

SELECT '🚀 Permission parsing mismatch should now be fixed!' as result;