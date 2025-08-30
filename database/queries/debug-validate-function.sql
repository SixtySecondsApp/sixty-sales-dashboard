-- Debug the validate_api_key function specifically
-- Find out exactly why HTTP 401 errors are happening

-- 1. Check if the validate_api_key function exists
SELECT 
  '=== FUNCTION EXISTENCE CHECK ===' as section,
  routine_name,
  routine_type,
  specific_name
FROM information_schema.routines 
WHERE routine_name = 'validate_api_key'
  AND routine_schema = 'public';

-- 2. Show the current function definition
SELECT 
  '=== FUNCTION DEFINITION ===' as section,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'validate_api_key'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 3. Test with a simple direct call
SELECT 
  '=== DIRECT FUNCTION TEST ===' as section,
  'sk_dbd6aed12345' as test_key_partial,
  validate_api_key('sk_test_nonexistent') as result_nonexistent;

-- 4. Check all existing API keys to find the right one
SELECT 
  '=== ALL EXISTING API KEYS ===' as section,
  name,
  key_preview,
  substring(key_hash, 1, 20) as hash_start,
  is_active,
  permissions IS NOT NULL as has_permissions,
  user_id IS NOT NULL as has_user_id
FROM api_keys 
ORDER BY created_at DESC;

-- 5. Test validation with each existing key
DO $$
DECLARE
  key_record RECORD;
  validation_result RECORD;
  test_keys TEXT[] := ARRAY[
    'sk_8b61b8892eec45fcb56908b7209a3985',
    'sk_dbd6aed12345',
    'sk_test_fresh_key_123'
  ];
  test_key TEXT;
BEGIN
  RAISE NOTICE '=== TESTING KNOWN KEYS ===';
  
  FOREACH test_key IN ARRAY test_keys
  LOOP
    BEGIN
      SELECT * INTO validation_result FROM validate_api_key(test_key) LIMIT 1;
      
      RAISE NOTICE 'Key %: valid=%, user_id=%, permissions=%', 
        left(test_key, 12) || '...',
        COALESCE(validation_result.is_valid, false),
        COALESCE(validation_result.user_id::text, 'NULL'),
        COALESCE(validation_result.permissions::text, 'NULL');
        
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Key %: ERROR - %', left(test_key, 12) || '...', SQLERRM;
    END;
  END LOOP;
  
  -- Also test RPC version
  RAISE NOTICE '';
  RAISE NOTICE '=== TESTING RPC VERSION ===';
  
  BEGIN
    SELECT * INTO validation_result FROM validate_api_key('{"key_text": "sk_8b61b8892eec45fcb56908b7209a3985"}'::jsonb) LIMIT 1;
    
    RAISE NOTICE 'RPC result: valid=%, user_id=%', 
      COALESCE(validation_result.is_valid, false),
      COALESCE(validation_result.user_id::text, 'NULL');
      
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RPC ERROR: %', SQLERRM;
  END;
END $$;

-- 6. Create a minimal working function if the current one is broken
CREATE OR REPLACE FUNCTION validate_api_key_simple(key_text TEXT)
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
    ak.expires_at
  FROM api_keys ak
  WHERE ak.key_hash = key_hash_value;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, '[]'::JSONB, 0, FALSE, FALSE;
    RETURN;
  END IF;
  
  -- Check if key is active
  IF NOT api_key_record.is_active THEN
    RETURN QUERY SELECT FALSE, api_key_record.user_id, api_key_record.permissions, COALESCE(api_key_record.rate_limit, 0), FALSE, FALSE;
    RETURN;
  END IF;
  
  -- Return success
  RETURN QUERY SELECT 
    TRUE, 
    api_key_record.user_id,
    COALESCE(api_key_record.permissions, '[]'::jsonb),
    COALESCE(api_key_record.rate_limit, 1000), 
    FALSE,
    TRUE;
END $$;

-- 7. Test the simple version
SELECT 
  '=== TESTING SIMPLE FUNCTION ===' as section,
  validate_api_key_simple('sk_8b61b8892eec45fcb56908b7209a3985') as simple_result;

SELECT '🔧 Function debugging complete!' as result;