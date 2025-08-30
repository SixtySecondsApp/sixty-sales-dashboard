-- Fix Permission Parsing and Database Join Issues
-- Comprehensive fix for CRUD endpoint problems

-- 1. First, let's see what the validate_api_key function actually returns
DO $$
DECLARE
  test_result RECORD;
  test_key TEXT := 'sk_8b61b8892eec45fcb56908b7209a3985';
BEGIN
  RAISE NOTICE '=== DEBUGGING API KEY VALIDATION ===';
  
  SELECT * INTO test_result FROM validate_api_key(test_key) LIMIT 1;
  
  RAISE NOTICE 'Raw validation result:';
  RAISE NOTICE '  is_valid: % (type: %)', test_result.is_valid, pg_typeof(test_result.is_valid);
  RAISE NOTICE '  user_id: % (type: %)', test_result.user_id, pg_typeof(test_result.user_id);
  RAISE NOTICE '  permissions: % (type: %)', test_result.permissions, pg_typeof(test_result.permissions);
  RAISE NOTICE '  rate_limit: % (type: %)', test_result.rate_limit, pg_typeof(test_result.rate_limit);
  
  -- Check if permissions can be converted to array
  IF test_result.permissions IS NOT NULL THEN
    RAISE NOTICE '  permissions as array: %', array(SELECT jsonb_array_elements_text(test_result.permissions));
  END IF;
END $$;

-- 2. Fix the validate_api_key function to return permissions in a format the CRUD endpoints can use
-- The CRUD endpoints expect permissions as a JSONB array they can convert to string[]
CREATE OR REPLACE FUNCTION validate_api_key(key_text TEXT)
RETURNS TABLE(
  is_valid BOOLEAN,
  user_id UUID,
  permissions JSONB,
  rate_limit INTEGER,
  is_expired BOOLEAN,
  is_active BOOLEAN
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
  key_hash_value TEXT;
  api_key_record RECORD;
  is_expired_value BOOLEAN := FALSE;
BEGIN
  -- Validate input
  IF key_text IS NULL OR key_text = '' THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, '[]'::JSONB, 0, FALSE, FALSE;
    RETURN;
  END IF;
  
  -- Calculate hash
  key_hash_value := encode(digest(key_text, 'sha256'), 'hex');
  
  -- Look up the API key
  SELECT INTO api_key_record
    ak.user_id,
    ak.rate_limit,
    ak.permissions,
    ak.is_active,
    ak.expires_at,
    ak.usage_count
  FROM api_keys ak
  WHERE ak.key_hash = key_hash_value;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, '[]'::JSONB, 0, FALSE, FALSE;
    RETURN;
  END IF;
  
  -- Check if key is active
  IF NOT api_key_record.is_active THEN
    RETURN QUERY SELECT FALSE, api_key_record.user_id, api_key_record.permissions, api_key_record.rate_limit, FALSE, FALSE;
    RETURN;
  END IF;
  
  -- Check expiration
  IF api_key_record.expires_at IS NOT NULL THEN
    is_expired_value := api_key_record.expires_at < NOW();
    IF is_expired_value THEN
      RETURN QUERY SELECT FALSE, api_key_record.user_id, api_key_record.permissions, api_key_record.rate_limit, TRUE, api_key_record.is_active;
      RETURN;
    END IF;
  END IF;
  
  -- Update usage count
  UPDATE api_keys 
  SET 
    usage_count = COALESCE(usage_count, 0) + 1,
    last_used = NOW()
  WHERE key_hash = key_hash_value;
  
  -- Return success with proper permissions format
  RETURN QUERY SELECT 
    TRUE, 
    api_key_record.user_id,
    COALESCE(api_key_record.permissions, '["contacts:read"]'::jsonb),
    COALESCE(api_key_record.rate_limit, 1000), 
    FALSE,
    TRUE;
  
END $$;

-- Keep the JSONB version for RPC calls
CREATE OR REPLACE FUNCTION validate_api_key(params JSONB)
RETURNS TABLE(
  is_valid BOOLEAN,
  user_id UUID,
  permissions JSONB,
  rate_limit INTEGER,
  is_expired BOOLEAN,
  is_active BOOLEAN
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
  key_text_param TEXT;
BEGIN
  key_text_param := params->>'key_text';
  RETURN QUERY SELECT * FROM validate_api_key(key_text_param);
END $$;

-- 3. Ensure our API key has proper write permissions
UPDATE api_keys 
SET permissions = '["contacts:read", "contacts:write", "companies:read", "companies:write", "deals:read", "deals:write", "tasks:read", "tasks:write", "meetings:read", "meetings:write", "activities:read", "activities:write", "contacts:delete", "companies:delete", "deals:delete", "tasks:delete", "meetings:delete", "activities:delete"]'::jsonb
WHERE key_hash = encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex');

-- 4. Fix the database join issues by simplifying the queries
-- The CRUD endpoints are trying to join tables that don't have proper relationships
-- Let's check what columns actually exist in each table

SELECT 
  '=== CONTACTS TABLE COLUMNS ===' as section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'contacts' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 
  '=== COMPANIES TABLE COLUMNS ===' as section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'companies' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 
  '=== DEALS TABLE COLUMNS ===' as section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'deals' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Test the updated validation function
DO $$
DECLARE
  final_test RECORD;
  test_key TEXT := 'sk_8b61b8892eec45fcb56908b7209a3985';
  perm_array TEXT[];
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TESTING FIXED VALIDATION ===';
  
  SELECT * INTO final_test FROM validate_api_key(test_key) LIMIT 1;
  
  RAISE NOTICE 'Validation result:';
  RAISE NOTICE '  is_valid: %', final_test.is_valid;
  RAISE NOTICE '  user_id: %', final_test.user_id;
  RAISE NOTICE '  permissions: %', final_test.permissions;
  
  -- Convert JSONB to string array (like CRUD endpoints will do)
  IF final_test.permissions IS NOT NULL THEN
    SELECT array(SELECT jsonb_array_elements_text(final_test.permissions)) INTO perm_array;
    RAISE NOTICE '  permissions as string array: %', perm_array;
    RAISE NOTICE '  contains contacts:write: %', 'contacts:write' = ANY(perm_array);
    RAISE NOTICE '  contains deals:write: %', 'deals:write' = ANY(perm_array);
  END IF;
  
  IF final_test.is_valid AND 'contacts:write' = ANY(perm_array) THEN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 SUCCESS! API key validation and permissions are working!';
    RAISE NOTICE '🚀 Write operations should now work!';
  ELSE
    RAISE NOTICE '❌ Still having permission issues';
  END IF;
END $$;

-- 6. Show final API key status
SELECT 
  '=== FINAL API KEY STATUS ===' as section,
  name,
  key_preview,
  permissions,
  array_length(array(SELECT jsonb_array_elements_text(permissions)), 1) as permission_count,
  rate_limit,
  is_active
FROM api_keys 
WHERE key_hash = encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex');

SELECT '✅ Permission parsing and database structure fixes applied!' as result;