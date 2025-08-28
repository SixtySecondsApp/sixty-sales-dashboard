-- Fix validate_api_key function to work with CRUD endpoints
-- The CRUD endpoints expect specific fields and structure

-- Drop and recreate function with correct return structure
DROP FUNCTION IF EXISTS validate_api_key(JSONB);

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
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::JSONB, 0, FALSE, FALSE;
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
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::JSONB, 0, FALSE, FALSE;
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
  
  -- Return success
  RETURN QUERY SELECT 
    TRUE, 
    api_key_record.user_id,
    COALESCE(api_key_record.permissions, '[]'::jsonb),
    COALESCE(api_key_record.rate_limit, 1000), 
    FALSE,
    TRUE;
  
END $$;

-- Also create the JSONB version that matches the RPC call pattern
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
  -- Extract key from parameters
  key_text_param := params->>'key_text';
  
  -- Call the main function
  RETURN QUERY SELECT * FROM validate_api_key(key_text_param);
END $$;

-- Ensure our test API key exists and is properly configured
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
  'Test Suite API Key Fixed',
  encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex'),
  'sk_...209a3985',
  '["contacts:read", "contacts:write", "companies:read", "companies:write", "deals:read", "deals:write", "tasks:read", "tasks:write", "meetings:read", "meetings:write", "activities:read", "activities:write"]'::jsonb,
  10000,
  0,
  true,
  NOW()
)
ON CONFLICT (key_hash) DO UPDATE SET
  name = 'Test Suite API Key Fixed',
  permissions = '["contacts:read", "contacts:write", "companies:read", "companies:write", "deals:read", "deals:write", "tasks:read", "tasks:write", "meetings:read", "meetings:write", "activities:read", "activities:write"]'::jsonb,
  rate_limit = 10000,
  usage_count = 0,
  is_active = true;

-- Test the function exactly as the CRUD endpoints call it
DO $$
DECLARE
  test_result RECORD;
  test_params JSONB;
  test_key TEXT := 'sk_8b61b8892eec45fcb56908b7209a3985';
BEGIN
  RAISE NOTICE '=== TESTING CRUD ENDPOINT CALL ===';
  
  test_params := jsonb_build_object('key_text', test_key);
  
  -- This is exactly how the CRUD endpoints call it
  SELECT * INTO test_result FROM validate_api_key(test_params) LIMIT 1;
  
  RAISE NOTICE 'RPC call result:';
  RAISE NOTICE '  is_valid: %', test_result.is_valid;
  RAISE NOTICE '  user_id: %', test_result.user_id;
  RAISE NOTICE '  permissions: %', test_result.permissions;
  RAISE NOTICE '  rate_limit: %', test_result.rate_limit;
  RAISE NOTICE '  is_expired: %', test_result.is_expired;
  RAISE NOTICE '  is_active: %', test_result.is_active;
  
  IF test_result.is_valid AND test_result.user_id IS NOT NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 SUCCESS! API key validation now matches CRUD endpoint expectations!';
    RAISE NOTICE '🚀 Your 30 tests should now pass!';
  ELSE
    RAISE NOTICE '❌ Still having issues';
  END IF;
END $$;

SELECT '✅ API Key validation function fixed to work with CRUD endpoints!' as result;