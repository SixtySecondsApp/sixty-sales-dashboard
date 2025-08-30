-- Test the RPC version of validate_api_key that Edge Functions use

-- 1. Test direct function call (works)
SELECT 
  '=== DIRECT FUNCTION CALL ===' as test_type,
  is_valid,
  user_id,
  permissions,
  rate_limit
FROM validate_api_key('sk_test_api_key_for_suite_12345');

-- 2. Test RPC call (what Edge Functions use)
SELECT 
  '=== RPC CALL (Edge Functions use this) ===' as test_type,
  is_valid,
  user_id,
  permissions,
  rate_limit
FROM validate_api_key('{"key_text": "sk_test_api_key_for_suite_12345"}'::jsonb);

-- 3. Check if there are two different validate_api_key functions
SELECT 
  '=== FUNCTION SIGNATURES ===' as info,
  routine_name,
  specific_name,
  data_type,
  ordinal_position,
  parameter_name,
  parameter_mode
FROM information_schema.parameters 
WHERE specific_name LIKE '%validate_api_key%'
ORDER BY specific_name, ordinal_position;

-- 4. Make sure the RPC version exists and works correctly
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
  -- Extract key_text from the JSONB parameter
  key_text_param := params->>'key_text';
  
  -- Call the text version of the function
  RETURN QUERY SELECT * FROM validate_api_key(key_text_param);
END $$;

-- 5. Test the RPC version again
SELECT 
  '=== TESTING FIXED RPC VERSION ===' as test_type,
  is_valid,
  user_id,
  permissions,
  rate_limit
FROM validate_api_key('{"key_text": "sk_test_api_key_for_suite_12345"}'::jsonb);

SELECT '🧪 RPC validation test complete!' as result;