-- Fix the permission function by dropping and recreating it

-- 1. Drop the existing RPC version of validate_api_key
DROP FUNCTION IF EXISTS validate_api_key(jsonb);

-- 2. Create the RPC version that returns TEXT[] for permissions
CREATE OR REPLACE FUNCTION validate_api_key(params JSONB)
RETURNS TABLE(
  is_valid BOOLEAN,
  user_id UUID,
  permissions TEXT[], -- Return TEXT[] instead of JSONB
  rate_limit INTEGER,
  is_expired BOOLEAN,
  is_active BOOLEAN
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
  key_text_param TEXT;
  validation_result RECORD;
  perm_array TEXT[];
BEGIN
  -- Extract key_text from the JSONB parameter
  key_text_param := params->>'key_text';
  
  -- Call the text version of the function
  SELECT * INTO validation_result FROM validate_api_key(key_text_param) LIMIT 1;
  
  -- Convert JSONB permissions to TEXT array
  IF validation_result.permissions IS NOT NULL THEN
    SELECT array(SELECT jsonb_array_elements_text(validation_result.permissions)) INTO perm_array;
  ELSE
    perm_array := ARRAY[]::TEXT[];
  END IF;
  
  -- Return with TEXT array permissions
  RETURN QUERY SELECT 
    validation_result.is_valid,
    validation_result.user_id,
    perm_array,
    validation_result.rate_limit,
    validation_result.is_expired,
    validation_result.is_active;
END $$;

-- 3. Test the fixed RPC function
SELECT 
  '=== TESTING FIXED RPC FUNCTION ===' as test,
  is_valid,
  permissions,
  array_length(permissions, 1) as permission_count,
  'contacts:write' = ANY(permissions) as has_write_permission,
  'admin' = ANY(permissions) as has_admin_permission
FROM validate_api_key('{"key_text": "sk_test_api_key_for_suite_12345"}'::jsonb);

-- 4. Also add the missing columns we need
DO $$
BEGIN
  -- Add full_name to contacts if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'full_name') THEN
    ALTER TABLE contacts ADD COLUMN full_name TEXT;
    RAISE NOTICE '✅ Added full_name to contacts';
  END IF;
  
  -- Add other expected columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'title') THEN
    ALTER TABLE contacts ADD COLUMN title TEXT;
    RAISE NOTICE '✅ Added title to contacts';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'linkedin_url') THEN
    ALTER TABLE contacts ADD COLUMN linkedin_url TEXT;
    RAISE NOTICE '✅ Added linkedin_url to contacts';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'is_primary') THEN
    ALTER TABLE contacts ADD COLUMN is_primary BOOLEAN DEFAULT false;
    RAISE NOTICE '✅ Added is_primary to contacts';
  END IF;
END $$;

-- 5. Refresh schema cache
NOTIFY pgrst, 'reload schema';

SELECT '🎉 Permission function fixed - write operations should now work!' as result;