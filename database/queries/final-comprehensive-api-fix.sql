-- Final Comprehensive API Fix
-- Fix remaining permission issues and database relationships to get more tests passing

-- 1. First, ensure we have the correct API key with proper permissions
-- Create the hash for our known test key: sk_test_api_key_for_suite_12345
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
  '[
    "contacts:read", "contacts:write", "contacts:delete",
    "companies:read", "companies:write", "companies:delete", 
    "deals:read", "deals:write", "deals:delete",
    "tasks:read", "tasks:write", "tasks:delete",
    "meetings:read", "meetings:write", "meetings:delete",
    "activities:read", "activities:write", "activities:delete",
    "admin"
  ]'::jsonb,
  (SELECT id FROM auth.users LIMIT 1),
  true,
  10000
) ON CONFLICT (key_hash) DO UPDATE SET
  permissions = EXCLUDED.permissions,
  is_active = true,
  name = EXCLUDED.name;

-- 2. Drop and recreate the RPC validation function to ensure it returns TEXT[]
DROP FUNCTION IF EXISTS validate_api_key(jsonb);

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

-- 3. Add all missing columns that CRUD endpoints expect
DO $$
BEGIN
  -- contacts table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'full_name') THEN
    ALTER TABLE contacts ADD COLUMN full_name TEXT;
    RAISE NOTICE '✅ Added full_name to contacts';
  END IF;
  
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
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'company_id') THEN
    ALTER TABLE contacts ADD COLUMN company_id UUID;
    RAISE NOTICE '✅ Added company_id to contacts';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'owner_id') THEN
    ALTER TABLE contacts ADD COLUMN owner_id UUID;
    RAISE NOTICE '✅ Added owner_id to contacts';
  END IF;
  
  -- companies table
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
  
  -- deals table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'company_id') THEN
    ALTER TABLE deals ADD COLUMN company_id UUID;
    RAISE NOTICE '✅ Added company_id to deals';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'owner_id') THEN
    ALTER TABLE deals ADD COLUMN owner_id UUID;
    RAISE NOTICE '✅ Added owner_id to deals';
  END IF;
  
  -- tasks table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'company_id') THEN
    ALTER TABLE tasks ADD COLUMN company_id UUID;
    RAISE NOTICE '✅ Added company_id to tasks';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'contact_id') THEN
    ALTER TABLE tasks ADD COLUMN contact_id UUID;
    RAISE NOTICE '✅ Added contact_id to tasks';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'owner_id') THEN
    ALTER TABLE tasks ADD COLUMN owner_id UUID;
    RAISE NOTICE '✅ Added owner_id to tasks';
  END IF;
  
  -- activities table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'owner_id') THEN
    ALTER TABLE activities ADD COLUMN owner_id UUID;
    RAISE NOTICE '✅ Added owner_id to activities';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'contact_id') THEN
    ALTER TABLE activities ADD COLUMN contact_id UUID;
    RAISE NOTICE '✅ Added contact_id to activities';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'company_id') THEN
    ALTER TABLE activities ADD COLUMN company_id UUID;
    RAISE NOTICE '✅ Added company_id to activities';
  END IF;
  
  -- meetings table
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'created_by') THEN
    ALTER TABLE meetings ADD COLUMN created_by UUID;
    RAISE NOTICE '✅ Added created_by to meetings';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'contact_id') THEN
    ALTER TABLE meetings ADD COLUMN contact_id UUID;
    RAISE NOTICE '✅ Added contact_id to meetings';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'company_id') THEN
    ALTER TABLE meetings ADD COLUMN company_id UUID;
    RAISE NOTICE '✅ Added company_id to meetings';
  END IF;
END $$;

-- 4. Add all foreign key relationships
DO $$
BEGIN
  -- contacts relationships
  BEGIN
    ALTER TABLE contacts ADD CONSTRAINT fk_contacts_company_id FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Added contacts->companies FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER TABLE contacts ADD CONSTRAINT fk_contacts_owner_id FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added contacts->users FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  -- deals relationships
  BEGIN
    ALTER TABLE deals ADD CONSTRAINT fk_deals_company_id FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Added deals->companies FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER TABLE deals ADD CONSTRAINT fk_deals_owner_id FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added deals->users FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  -- tasks relationships
  BEGIN
    ALTER TABLE tasks ADD CONSTRAINT fk_tasks_company_id FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Added tasks->companies FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER TABLE tasks ADD CONSTRAINT fk_tasks_contact_id FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Added tasks->contacts FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER TABLE tasks ADD CONSTRAINT fk_tasks_owner_id FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added tasks->users FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  -- activities relationships
  BEGIN
    ALTER TABLE activities ADD CONSTRAINT fk_activities_owner_id FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added activities->users FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER TABLE activities ADD CONSTRAINT fk_activities_contact_id FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Added activities->contacts FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER TABLE activities ADD CONSTRAINT fk_activities_company_id FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Added activities->companies FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  -- meetings relationships
  BEGIN
    ALTER TABLE meetings ADD CONSTRAINT fk_meetings_created_by FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added meetings->users FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER TABLE meetings ADD CONSTRAINT fk_meetings_contact_id FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Added meetings->contacts FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  BEGIN
    ALTER TABLE meetings ADD CONSTRAINT fk_meetings_company_id FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Added meetings->companies FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 5. Test the fixed RPC function
SELECT 
  '=== TESTING FINAL RPC FUNCTION ===' as test,
  is_valid,
  permissions,
  array_length(permissions, 1) as permission_count,
  'contacts:write' = ANY(permissions) as has_write_permission,
  'companies:write' = ANY(permissions) as has_companies_write,
  'admin' = ANY(permissions) as has_admin_permission
FROM validate_api_key('{"key_text": "sk_test_api_key_for_suite_12345"}'::jsonb);

-- 6. Refresh schema cache to ensure PostgREST sees all changes
NOTIFY pgrst, 'reload schema';

SELECT '🎉 Final comprehensive fix complete - all relationships and permissions should now work!' as result;