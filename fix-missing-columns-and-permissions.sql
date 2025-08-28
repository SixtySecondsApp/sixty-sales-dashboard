-- Fix missing columns and permission parsing issue

-- 1. Add missing columns that CRUD endpoints expect
DO $$
BEGIN
  -- Add full_name to contacts if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'full_name') THEN
    ALTER TABLE contacts ADD COLUMN full_name TEXT;
    RAISE NOTICE '✅ Added full_name to contacts';
  END IF;
  
  -- Add other commonly expected columns
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
  
  -- Add missing columns to companies
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'website') THEN
    ALTER TABLE companies ADD COLUMN website TEXT;
    RAISE NOTICE '✅ Added website to companies';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'industry') THEN
    ALTER TABLE companies ADD COLUMN industry TEXT;
    RAISE NOTICE '✅ Added industry to companies';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'size') THEN
    ALTER TABLE companies ADD COLUMN size TEXT;
    RAISE NOTICE '✅ Added size to companies';
  END IF;
END $$;

-- 2. Fix the permission system - the issue is the checkPermission function expects string[]
-- but we're still returning JSONB somehow. Let's fix the RPC version properly.

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

-- 3. Also add company->deals relationship (reverse relationship)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'company_id') THEN
    ALTER TABLE deals ADD COLUMN company_id UUID;
    RAISE NOTICE '✅ Added company_id to deals';
  END IF;
  
  BEGIN
    ALTER TABLE deals ADD CONSTRAINT fk_deals_company_id FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Added deals->companies FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 4. Test the fixed RPC function
SELECT 
  '=== TESTING FIXED RPC FUNCTION ===' as test,
  is_valid,
  permissions,
  array_length(permissions, 1) as permission_count,
  'contacts:write' = ANY(permissions) as has_write_permission
FROM validate_api_key('{"key_text": "sk_test_api_key_for_suite_12345"}'::jsonb);

-- 5. Refresh schema cache
NOTIFY pgrst, 'reload schema';

SELECT '🔧 Missing columns and permission system fixed!' as result;