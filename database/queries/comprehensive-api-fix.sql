-- Comprehensive API Fix - Debug and Fix All Issues
-- Run this in Supabase Dashboard > SQL Editor

-- Step 1: Check what's in the database
DO $$
DECLARE
  rec RECORD;
  test_key TEXT := 'sk_7c452587fbad4ad0adfbb8798e3c92b5';
  expected_hash TEXT;
BEGIN
  RAISE NOTICE '=== DEBUGGING API KEY SYSTEM ===';
  
  -- Show recent API keys
  RAISE NOTICE '';
  RAISE NOTICE '1. Recent API keys in database:';
  FOR rec IN 
    SELECT name, key_preview, rate_limit, is_active, permissions
    FROM api_keys 
    ORDER BY created_at DESC 
    LIMIT 3
  LOOP
    RAISE NOTICE '   Name: %, Preview: %, Rate Limit: %, Active: %, Permissions: %', 
      rec.name, rec.key_preview, rec.rate_limit, rec.is_active, rec.permissions;
  END LOOP;
  
  -- Check hash matching
  expected_hash := encode(digest(test_key, 'sha256'), 'hex');
  RAISE NOTICE '';
  RAISE NOTICE '2. Hash check for test key:';
  RAISE NOTICE '   Key: %', test_key;
  RAISE NOTICE '   Expected hash: %', expected_hash;
  
  -- Check if hash exists in database
  SELECT INTO rec name, rate_limit, permissions, is_active
  FROM api_keys 
  WHERE key_hash = expected_hash;
  
  IF FOUND THEN
    RAISE NOTICE '   ✅ Hash found in database!';
    RAISE NOTICE '   Name: %, Rate Limit: %, Active: %', rec.name, rec.rate_limit, rec.is_active;
  ELSE
    RAISE NOTICE '   ❌ Hash NOT found in database!';
  END IF;
END $$;

-- Step 2: Drop and recreate the validate_api_key function with proper debugging
DROP FUNCTION IF EXISTS validate_api_key(JSONB);
DROP FUNCTION IF EXISTS validate_api_key(TEXT);

CREATE OR REPLACE FUNCTION validate_api_key(input_params JSONB)
RETURNS TABLE (
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
  key_text TEXT;
  key_hash_value TEXT;
  api_key_record RECORD;
  is_expired_value BOOLEAN := FALSE;
BEGIN
  -- Debug: Log the input
  RAISE NOTICE 'validate_api_key called with: %', input_params;
  
  -- Extract the key_text from the JSON parameters
  key_text := input_params->>'key_text';
  
  -- Debug: Log extracted key
  RAISE NOTICE 'Extracted key_text: %', key_text;
  
  IF key_text IS NULL OR key_text = '' THEN
    RAISE NOTICE 'No key_text provided, returning invalid';
    RETURN QUERY SELECT 
      FALSE::BOOLEAN,
      NULL::UUID,
      NULL::JSONB,
      0::INTEGER,
      FALSE::BOOLEAN,
      FALSE::BOOLEAN;
    RETURN;
  END IF;
  
  -- Hash the provided API key
  key_hash_value := encode(digest(key_text, 'sha256'), 'hex');
  RAISE NOTICE 'Generated hash: %', key_hash_value;
  
  -- Look up the API key
  SELECT 
    ak.user_id,
    ak.permissions,
    ak.rate_limit,
    ak.expires_at,
    ak.is_active,
    ak.id,
    ak.name
  INTO api_key_record
  FROM api_keys ak
  WHERE ak.key_hash = key_hash_value
  LIMIT 1;
  
  -- Debug: Check if found
  IF NOT FOUND THEN
    RAISE NOTICE 'API key not found in database';
    RETURN QUERY SELECT 
      FALSE::BOOLEAN,
      NULL::UUID,
      NULL::JSONB,
      0::INTEGER,
      FALSE::BOOLEAN,
      FALSE::BOOLEAN;
    RETURN;
  ELSE
    RAISE NOTICE 'Found API key: %, rate_limit: %', api_key_record.name, api_key_record.rate_limit;
  END IF;
  
  -- Update last_used timestamp and usage count
  UPDATE api_keys 
  SET 
    last_used = NOW(),
    usage_count = COALESCE(usage_count, 0) + 1
  WHERE id = api_key_record.id;
  
  -- Check if key is expired
  IF api_key_record.expires_at IS NOT NULL THEN
    is_expired_value := api_key_record.expires_at < NOW();
  END IF;
  
  RAISE NOTICE 'Returning: valid=%, rate_limit=%, active=%, expired=%', 
    (api_key_record.is_active AND NOT is_expired_value), 
    api_key_record.rate_limit, 
    api_key_record.is_active, 
    is_expired_value;
  
  -- Return validation result
  RETURN QUERY SELECT 
    (api_key_record.is_active AND NOT is_expired_value)::BOOLEAN,
    api_key_record.user_id,
    api_key_record.permissions,
    api_key_record.rate_limit,
    is_expired_value,
    api_key_record.is_active;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION validate_api_key(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_api_key(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION validate_api_key(JSONB) TO anon;

-- Step 3: Test the function immediately
DO $$
DECLARE
  test_result RECORD;
  test_params JSONB;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TESTING FIXED FUNCTION ===';
  
  -- Test with the new API key
  test_params := jsonb_build_object('key_text', 'sk_7c452587fbad4ad0adfbb8798e3c92b5');
  
  RAISE NOTICE 'Testing with params: %', test_params;
  
  SELECT * INTO test_result
  FROM validate_api_key(test_params);
  
  RAISE NOTICE 'Function returned:';
  RAISE NOTICE '  is_valid: %', test_result.is_valid;
  RAISE NOTICE '  user_id: %', test_result.user_id;
  RAISE NOTICE '  rate_limit: %', test_result.rate_limit;
  RAISE NOTICE '  permissions: %', test_result.permissions;
  RAISE NOTICE '  is_active: %', test_result.is_active;
  RAISE NOTICE '  is_expired: %', test_result.is_expired;
  
  IF test_result.is_valid AND test_result.rate_limit > 0 THEN
    RAISE NOTICE '✅ SUCCESS: Function returns valid API key with rate limit!';
  ELSE
    RAISE NOTICE '❌ ISSUE: Function not working correctly';
  END IF;
END $$;

-- Final confirmation
SELECT '🔧 Comprehensive API fix complete! Check the notices above for debug info.' as result;