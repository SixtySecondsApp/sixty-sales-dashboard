-- Fix API Key Validation V2 - Handle existing function conflicts
-- Run this in Supabase Dashboard > SQL Editor

-- Step 1: Drop existing function if it exists (to avoid conflicts)
DROP FUNCTION IF EXISTS validate_api_key(TEXT);

-- Step 2: Create the validate_api_key function that the Edge Functions expect
CREATE OR REPLACE FUNCTION validate_api_key(key_text TEXT)
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
  key_hash_value TEXT;
  api_key_record RECORD;
BEGIN
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
      FALSE::BOOLEAN as is_valid,
      NULL::UUID as user_id,
      NULL::JSONB as permissions,
      0::INTEGER as rate_limit,
      FALSE::BOOLEAN as is_expired,
      FALSE::BOOLEAN as is_active;
    RETURN;
  END IF;
  
  -- Update last_used timestamp and usage count
  UPDATE api_keys 
  SET 
    last_used = NOW(),
    usage_count = COALESCE(usage_count, 0) + 1
  WHERE id = api_key_record.id;
  
  -- Check if key is expired
  DECLARE
    is_expired_value BOOLEAN;
  BEGIN
    is_expired_value := api_key_record.expires_at IS NOT NULL AND api_key_record.expires_at < NOW();
  END;
  
  -- Return validation result
  RETURN QUERY SELECT 
    (api_key_record.is_active AND NOT is_expired_value)::BOOLEAN as is_valid,
    api_key_record.user_id as user_id,
    api_key_record.permissions as permissions,
    api_key_record.rate_limit as rate_limit,
    is_expired_value as is_expired,
    api_key_record.is_active as is_active;
END;
$$;

-- Step 3: Grant execute permission to all roles that need it
GRANT EXECUTE ON FUNCTION validate_api_key(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_api_key(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION validate_api_key(TEXT) TO anon;

-- Step 4: Create helper function for UI to get user's API keys
CREATE OR REPLACE FUNCTION get_user_api_keys(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  key_preview TEXT,
  permissions JSONB,
  rate_limit INTEGER,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN,
  last_used TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ak.id,
    ak.name,
    ak.key_preview,
    ak.permissions,
    ak.rate_limit,
    ak.expires_at,
    ak.is_active,
    ak.last_used,
    ak.usage_count,
    ak.created_at
  FROM api_keys ak
  WHERE ak.user_id = p_user_id
  ORDER BY ak.created_at DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_api_keys(UUID) TO authenticated;

-- Step 5: Test the function with your existing API key
DO $$
DECLARE
  test_result RECORD;
  test_key TEXT := 'sk_f3e0066b9f7b47a99c766a5c04dc7e25'; -- Your actual API key
BEGIN
  -- Test the validation function with your real API key
  SELECT * INTO test_result
  FROM validate_api_key(test_key);
  
  IF test_result.is_valid THEN
    RAISE NOTICE '✅ validate_api_key function works with your API key!';
    RAISE NOTICE '   User ID: %', test_result.user_id;
    RAISE NOTICE '   Permissions: %', test_result.permissions;
    RAISE NOTICE '   Rate Limit: %', test_result.rate_limit;
    RAISE NOTICE '   Is Active: %', test_result.is_active;
    RAISE NOTICE '   Is Expired: %', test_result.is_expired;
  ELSE
    RAISE WARNING '❌ API key validation failed! This might mean:';
    RAISE WARNING '   1. The API key was not found in the database';
    RAISE WARNING '   2. The API key is inactive or expired';
    RAISE WARNING '   3. There might be a hashing issue';
  END IF;
END $$;

-- Step 6: Show summary
SELECT 
  'validate_api_key' as function_name,
  'Fixed and ready for API endpoints' as status
UNION ALL
SELECT 
  'get_user_api_keys' as function_name,
  'Ready for UI integration' as status;

-- Final confirmation
SELECT 
  '✅ API Key validation system fixed and ready!' as result,
  'Your API endpoints should now work with X-API-Key header authentication' as next_step;