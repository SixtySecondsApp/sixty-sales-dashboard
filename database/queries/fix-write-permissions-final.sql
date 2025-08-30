-- Focus on fixing write permissions and critical relationships

-- 1. Create our test API key with the exact hash needed
INSERT INTO api_keys (
  name, 
  key_hash, 
  key_preview,
  permissions, 
  user_id, 
  is_active, 
  rate_limit
) VALUES (
  'Test Suite Key - Known Value',
  encode(digest('sk_test_api_key_for_suite_12345', 'sha256'), 'hex'),
  'sk_...suite_12345',
  '["contacts:read", "contacts:write", "contacts:delete", "companies:read", "companies:write", "companies:delete", "deals:read", "deals:write", "deals:delete", "tasks:read", "tasks:write", "tasks:delete", "meetings:read", "meetings:write", "meetings:delete", "activities:read", "activities:write", "activities:delete", "admin"]'::jsonb,
  (SELECT id FROM auth.users LIMIT 1),
  true,
  10000
) ON CONFLICT (key_hash) DO UPDATE SET
  permissions = '["contacts:read", "contacts:write", "contacts:delete", "companies:read", "companies:write", "companies:delete", "deals:read", "deals:write", "deals:delete", "tasks:read", "tasks:write", "tasks:delete", "meetings:read", "meetings:write", "meetings:delete", "activities:read", "activities:write", "activities:delete", "admin"]'::jsonb,
  is_active = true,
  name = 'Test Suite Key - Known Value';

-- 2. Check if we have the base validate_api_key function that takes TEXT
-- If not, create it first
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
  key_record RECORD;
  key_hash_computed TEXT;
BEGIN
  -- Compute hash of provided key
  key_hash_computed := encode(digest(key_text, 'sha256'), 'hex');
  
  -- Look up the API key using qualified column names
  SELECT 
    ak.id,
    ak.name,
    ak.key_hash,
    ak.user_id,
    ak.permissions,
    ak.rate_limit,
    ak.expires_at,
    ak.is_active
  INTO key_record 
  FROM api_keys ak
  WHERE ak.key_hash = key_hash_computed 
    AND ak.is_active = true;
  
  IF NOT FOUND THEN
    -- Invalid key
    RETURN QUERY SELECT false, NULL::UUID, NULL::JSONB, 0, false, false;
    RETURN;
  END IF;
  
  -- Check expiration
  IF key_record.expires_at IS NOT NULL AND key_record.expires_at < NOW() THEN
    -- Expired key
    RETURN QUERY SELECT false, key_record.user_id, key_record.permissions, key_record.rate_limit, true, key_record.is_active;
    RETURN;
  END IF;
  
  -- Valid key
  RETURN QUERY SELECT true, key_record.user_id, key_record.permissions, key_record.rate_limit, false, key_record.is_active;
END $$;

-- 3. Now create the JSONB version that returns TEXT[]
DROP FUNCTION IF EXISTS validate_api_key(jsonb);

CREATE OR REPLACE FUNCTION validate_api_key(params JSONB)
RETURNS TABLE(
  is_valid BOOLEAN,
  user_id UUID,
  permissions TEXT[],
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
  
  -- Call the text version
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

-- 4. Add the most critical missing columns for relationships
DO $$
BEGIN
  -- deals.owner_id (this is causing the schema error)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'owner_id') THEN
    ALTER TABLE deals ADD COLUMN owner_id UUID;
    RAISE NOTICE '✅ Added owner_id to deals';
  END IF;
  
  -- companies relationship to deals (reverse lookup)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'company_id') THEN
    ALTER TABLE deals ADD COLUMN company_id UUID;
    RAISE NOTICE '✅ Added company_id to deals';
  END IF;
END $$;

-- 5. Add the critical foreign key constraints
DO $$
BEGIN
  BEGIN
    ALTER TABLE deals ADD CONSTRAINT fk_deals_owner_id FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added deals->users FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER TABLE deals ADD CONSTRAINT fk_deals_company_id FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Added deals->companies FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 6. Test the function
SELECT 
  '=== TESTING WRITE PERMISSIONS ===' as test,
  is_valid,
  permissions,
  'contacts:write' = ANY(permissions) as has_contacts_write,
  'companies:write' = ANY(permissions) as has_companies_write,
  'admin' = ANY(permissions) as has_admin
FROM validate_api_key('{"key_text": "sk_test_api_key_for_suite_12345"}'::jsonb);

-- 7. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

SELECT '🚀 Write permissions fix complete!' as result;