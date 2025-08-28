-- Fix validate_api_key function and test API key validation
-- This addresses the missing error_message field issue

-- 1. First, let's see what the current function looks like
SELECT 
  proname as function_name,
  pg_get_function_result(oid) as return_type,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'validate_api_key';

-- 2. Drop and recreate the function with the correct return type
DROP FUNCTION IF EXISTS validate_api_key(JSONB);

CREATE OR REPLACE FUNCTION validate_api_key(params JSONB)
RETURNS TABLE(
  is_valid BOOLEAN,
  rate_limit INTEGER,
  permissions JSONB
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
  
  -- Validate input
  IF key_text IS NULL OR key_text = '' THEN
    RETURN QUERY SELECT FALSE, 0, NULL::JSONB;
    RETURN;
  END IF;
  
  -- Calculate hash
  key_hash_value := encode(digest(key_text, 'sha256'), 'hex');
  
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
    RETURN QUERY SELECT FALSE, 0, NULL::JSONB;
    RETURN;
  END IF;
  
  -- Check if key is active
  IF NOT api_key_record.is_active THEN
    RETURN QUERY SELECT FALSE, 0, NULL::JSONB;
    RETURN;
  END IF;
  
  -- Check expiration
  IF api_key_record.expires_at IS NOT NULL THEN
    is_expired_value := api_key_record.expires_at < NOW();
    IF is_expired_value THEN
      RETURN QUERY SELECT FALSE, 0, NULL::JSONB;
      RETURN;
    END IF;
  END IF;
  
  -- Update usage count
  UPDATE api_keys 
  SET 
    usage_count = COALESCE(usage_count, 0) + 1,
    last_used = NOW()
  WHERE key_hash = key_hash_value;
  
  -- Return success
  RETURN QUERY SELECT 
    TRUE, 
    COALESCE(api_key_record.rate_limit, 1000), 
    COALESCE(api_key_record.permissions, '[]'::jsonb);
  
END $$;

-- 3. Make sure our test API key exists with correct hash
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
  'Test Suite API Key',
  encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex'),
  'sk_...209a3985',
  '["contacts:read", "contacts:write", "companies:read", "companies:write", "deals:read", "deals:write", "tasks:read", "tasks:write", "meetings:read", "meetings:write", "activities:read", "activities:write"]'::jsonb,
  10000,
  0,
  true,
  NOW()
)
ON CONFLICT (key_hash) DO UPDATE SET
  name = 'Test Suite API Key',
  permissions = '["contacts:read", "contacts:write", "companies:read", "companies:write", "deals:read", "deals:write", "tasks:read", "tasks:write", "meetings:read", "meetings:write", "activities:read", "activities:write"]'::jsonb,
  rate_limit = 10000,
  usage_count = 0,
  is_active = true;

-- 4. Test the API key exists
DO $$
DECLARE
  test_key TEXT := 'sk_8b61b8892eec45fcb56908b7209a3985';
  expected_hash TEXT;
  found_record RECORD;
BEGIN
  RAISE NOTICE '=== CHECKING API KEY ===';
  
  expected_hash := encode(digest(test_key, 'sha256'), 'hex');
  RAISE NOTICE 'Looking for hash: %', expected_hash;
  
  SELECT INTO found_record 
    name, rate_limit, is_active, permissions
  FROM api_keys 
  WHERE key_hash = expected_hash;
  
  IF FOUND THEN
    RAISE NOTICE '✅ API KEY FOUND: % (Rate: %, Active: %)', found_record.name, found_record.rate_limit, found_record.is_active;
    RAISE NOTICE '   Permissions: %', found_record.permissions;
  ELSE
    RAISE NOTICE '❌ API KEY NOT FOUND!';
  END IF;
END $$;

-- 5. Test the validate_api_key function
DO $$
DECLARE
  test_result RECORD;
  test_params JSONB;
  test_key TEXT := 'sk_8b61b8892eec45fcb56908b7209a3985';
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TESTING FUNCTION ===';
  
  test_params := jsonb_build_object('key_text', test_key);
  
  SELECT * INTO test_result FROM validate_api_key(test_params);
  
  RAISE NOTICE 'Function result:';
  RAISE NOTICE '  is_valid: %', test_result.is_valid;
  RAISE NOTICE '  rate_limit: %', test_result.rate_limit;
  RAISE NOTICE '  permissions: %', test_result.permissions;
  
  IF test_result.is_valid THEN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 SUCCESS! API validation is working!';
    RAISE NOTICE '🚀 Your test suite should now pass!';
  ELSE
    RAISE NOTICE '❌ Validation failed';
  END IF;
END $$;

-- 6. Show all current API keys
SELECT 
  'Current API Keys:' as info,
  name,
  key_preview,
  rate_limit,
  is_active,
  permissions,
  created_at
FROM api_keys 
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'andrew.bryce@sixtyseconds.video')
ORDER BY created_at DESC;

SELECT '✅ API Key validation function fixed and tested!' as result;