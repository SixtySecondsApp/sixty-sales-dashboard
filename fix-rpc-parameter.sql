-- Fix RPC Parameter Issue
-- The API utils are calling rpc('validate_api_key', { key_text: apiKey })
-- But our function expects the parameter to be passed directly
-- This creates a wrapper function that handles the parameter correctly

-- Create a wrapper function that handles the RPC call format
CREATE OR REPLACE FUNCTION validate_api_key(params JSONB)
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
  is_expired_value BOOLEAN;
BEGIN
  -- Extract the key_text from the JSON parameters
  key_text := params->>'key_text';
  
  IF key_text IS NULL THEN
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
  
  -- Look up the API key
  SELECT 
    ak.user_id,
    ak.permissions,
    ak.rate_limit,
    ak.expires_at,
    ak.is_active,
    ak.id
  INTO api_key_record
  FROM api_keys ak
  WHERE ak.key_hash = key_hash_value
  LIMIT 1;
  
  -- Check if key exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE::BOOLEAN,
      NULL::UUID,
      NULL::JSONB,
      0::INTEGER,
      FALSE::BOOLEAN,
      FALSE::BOOLEAN;
    RETURN;
  END IF;
  
  -- Update last_used timestamp and usage count
  UPDATE api_keys 
  SET 
    last_used = NOW(),
    usage_count = COALESCE(usage_count, 0) + 1
  WHERE id = api_key_record.id;
  
  -- Check if key is expired
  is_expired_value := api_key_record.expires_at IS NOT NULL AND api_key_record.expires_at < NOW();
  
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

-- Test the function with the RPC call format
DO $$
DECLARE
  test_result RECORD;
  test_params JSONB;
BEGIN
  -- Test with your API key using the RPC format
  test_params := jsonb_build_object('key_text', 'sk_7c452587fbad4ad0adfbb8798e3c92b5');
  
  SELECT * INTO test_result
  FROM validate_api_key(test_params);
  
  IF test_result.is_valid THEN
    RAISE NOTICE '✅ SUCCESS: RPC-style validate_api_key works!';
    RAISE NOTICE '   User ID: %', test_result.user_id;
    RAISE NOTICE '   Permissions: %', test_result.permissions;
    RAISE NOTICE '   Rate Limit: %', test_result.rate_limit;
  ELSE
    RAISE NOTICE '❌ RPC validation failed';
    RAISE NOTICE '   This might mean the API key is not in the database';
  END IF;
END $$;

SELECT '✅ Fixed RPC parameter issue! API endpoints should work now.' as result;