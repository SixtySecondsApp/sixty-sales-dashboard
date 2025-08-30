-- Complete API Key Validation Debug and Fix
-- This will show us exactly what's in the database and fix any issues

-- 1. Show all API keys in the database
SELECT 
  '=== ALL API KEYS IN DATABASE ===' as debug_step,
  id,
  name,
  key_hash,
  key_preview,
  permissions,
  rate_limit,
  usage_count,
  is_active,
  user_id,
  created_at
FROM api_keys 
ORDER BY created_at DESC;

-- 2. Test the specific API key we're using
DO $$
DECLARE
  test_key TEXT := 'sk_8b61b8892eec45fcb56908b7209a3985';
  expected_hash TEXT;
  found_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TESTING SPECIFIC API KEY ===';
  RAISE NOTICE 'Testing key: %', test_key;
  
  -- Calculate expected hash
  expected_hash := encode(digest(test_key, 'sha256'), 'hex');
  RAISE NOTICE 'Expected hash: %', expected_hash;
  
  -- Look for the key
  SELECT INTO found_record 
    id, name, key_hash, rate_limit, permissions, is_active, user_id
  FROM api_keys 
  WHERE key_hash = expected_hash;
  
  IF FOUND THEN
    RAISE NOTICE '✅ KEY FOUND!';
    RAISE NOTICE '  ID: %', found_record.id;
    RAISE NOTICE '  Name: %', found_record.name;
    RAISE NOTICE '  Rate Limit: %', found_record.rate_limit;
    RAISE NOTICE '  Active: %', found_record.is_active;
    RAISE NOTICE '  User ID: %', found_record.user_id;
    RAISE NOTICE '  Permissions: %', found_record.permissions;
  ELSE
    RAISE NOTICE '❌ KEY NOT FOUND!';
    RAISE NOTICE 'This means the hash in database does not match calculated hash';
  END IF;
END $$;

-- 3. Test the validate_api_key function directly
DO $$
DECLARE
  test_result RECORD;
  test_params JSONB;
  test_key TEXT := 'sk_8b61b8892eec45fcb56908b7209a3985';
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TESTING validate_api_key FUNCTION ===';
  
  test_params := jsonb_build_object('key_text', test_key);
  RAISE NOTICE 'Calling validate_api_key with params: %', test_params;
  
  SELECT * INTO test_result FROM validate_api_key(test_params);
  
  RAISE NOTICE 'Function returned:';
  RAISE NOTICE '  is_valid: %', test_result.is_valid;
  RAISE NOTICE '  rate_limit: %', test_result.rate_limit;
  RAISE NOTICE '  permissions: %', test_result.permissions;
  RAISE NOTICE '  error_message: %', test_result.error_message;
END $$;

-- 4. Create/Update the API key with proper structure
-- First, let's make sure we have the key with the correct hash
INSERT INTO api_keys (
  user_id,
  name,
  key_hash,
  key_preview,
  permissions,
  rate_limit,
  usage_count,
  is_active,
  created_at
) VALUES (
  (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video' LIMIT 1),
  'Test Suite Debug Key',
  encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex'),
  'sk_...209a3985',
  '["contacts:read", "contacts:write", "companies:read", "companies:write", "deals:read", "deals:write", "tasks:read", "tasks:write", "meetings:read", "meetings:write", "activities:read", "activities:write"]'::jsonb,
  10000,
  0,
  true,
  NOW()
)
ON CONFLICT (key_hash) DO UPDATE SET
  name = 'Test Suite Debug Key',
  permissions = '["contacts:read", "contacts:write", "companies:read", "companies:write", "deals:read", "deals:write", "tasks:read", "tasks:write", "meetings:read", "meetings:write", "activities:read", "activities:write"]'::jsonb,
  rate_limit = 10000,
  usage_count = 0,
  is_active = true;

-- 5. Fix the validate_api_key function to handle any edge cases
CREATE OR REPLACE FUNCTION validate_api_key(params JSONB)
RETURNS TABLE(
  is_valid BOOLEAN,
  rate_limit INTEGER,
  permissions JSONB,
  error_message TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
  key_text TEXT;
  key_hash_value TEXT;
  api_key_record RECORD;
  is_expired_value BOOLEAN := FALSE;
BEGIN
  -- Extract key from parameters
  key_text := params->>'key_text';
  
  -- Debug logging
  RAISE NOTICE 'validate_api_key called with key: %', SUBSTRING(key_text, 1, 10) || '...';
  
  -- Validate input
  IF key_text IS NULL OR key_text = '' THEN
    RAISE NOTICE 'Invalid input: key_text is null or empty';
    RETURN QUERY SELECT FALSE, 0, NULL::JSONB, 'API key is required'::TEXT;
    RETURN;
  END IF;
  
  -- Calculate hash
  key_hash_value := encode(digest(key_text, 'sha256'), 'hex');
  RAISE NOTICE 'Calculated hash: %', key_hash_value;
  
  -- Look up the API key
  SELECT INTO api_key_record
    ak.rate_limit,
    ak.permissions,
    ak.is_active,
    ak.expires_at,
    ak.usage_count
  FROM api_keys ak
  WHERE ak.key_hash = key_hash_value;
  
  IF NOT FOUND THEN
    RAISE NOTICE 'API key not found in database';
    RETURN QUERY SELECT FALSE, 0, NULL::JSONB, 'Invalid API key'::TEXT;
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found API key - active: %, rate_limit: %', api_key_record.is_active, api_key_record.rate_limit;
  
  -- Check if key is active
  IF NOT api_key_record.is_active THEN
    RAISE NOTICE 'API key is not active';
    RETURN QUERY SELECT FALSE, 0, NULL::JSONB, 'API key is inactive'::TEXT;
    RETURN;
  END IF;
  
  -- Check expiration
  IF api_key_record.expires_at IS NOT NULL THEN
    is_expired_value := api_key_record.expires_at < NOW();
    IF is_expired_value THEN
      RAISE NOTICE 'API key has expired';
      RETURN QUERY SELECT FALSE, 0, NULL::JSONB, 'API key has expired'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- Update usage count (optional - could be done elsewhere)
  UPDATE api_keys 
  SET 
    usage_count = COALESCE(usage_count, 0) + 1,
    last_used = NOW()
  WHERE key_hash = key_hash_value;
  
  RAISE NOTICE 'API key validation successful';
  
  -- Return success
  RETURN QUERY SELECT 
    TRUE, 
    api_key_record.rate_limit, 
    api_key_record.permissions,
    'Success'::TEXT;
  
END $$;

-- 6. Test the function again after our fixes
DO $$
DECLARE
  final_test_result RECORD;
  test_params JSONB;
  test_key TEXT := 'sk_8b61b8892eec45fcb56908b7209a3985';
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== FINAL FUNCTION TEST ===';
  
  test_params := jsonb_build_object('key_text', test_key);
  
  SELECT * INTO final_test_result FROM validate_api_key(test_params);
  
  RAISE NOTICE 'Final test result:';
  RAISE NOTICE '  is_valid: %', final_test_result.is_valid;
  RAISE NOTICE '  rate_limit: %', final_test_result.rate_limit;
  RAISE NOTICE '  permissions: %', final_test_result.permissions;
  RAISE NOTICE '  error_message: %', final_test_result.error_message;
  
  IF final_test_result.is_valid THEN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 SUCCESS! API key validation is now working!';
    RAISE NOTICE '🚀 Your test suite should now pass all 30 tests!';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '❌ Still having issues. Error: %', final_test_result.error_message;
  END IF;
END $$;

SELECT '✅ API Key Validation Debug and Fix Complete!' as result;