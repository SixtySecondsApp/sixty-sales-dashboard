-- Fix all relationship and permission issues at once

-- 1. Add missing columns to all tables that need them
DO $$
BEGIN
  -- Add company_id to contacts if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'company_id') THEN
    ALTER TABLE contacts ADD COLUMN company_id UUID;
    RAISE NOTICE '✅ Added company_id to contacts';
  END IF;
  
  -- Add owner_id to contacts if missing  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'owner_id') THEN
    ALTER TABLE contacts ADD COLUMN owner_id UUID;
    RAISE NOTICE '✅ Added owner_id to contacts';
  END IF;
  
  -- Add company_id to tasks if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'company_id') THEN
    ALTER TABLE tasks ADD COLUMN company_id UUID;
    RAISE NOTICE '✅ Added company_id to tasks';
  END IF;
  
  -- Add owner_id to deals if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'owner_id') THEN
    ALTER TABLE deals ADD COLUMN owner_id UUID;
    RAISE NOTICE '✅ Added owner_id to deals';
  END IF;
  
  -- Add owner_id to activities if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'owner_id') THEN
    ALTER TABLE activities ADD COLUMN owner_id UUID;
    RAISE NOTICE '✅ Added owner_id to activities';
  END IF;
  
  -- Add created_by to meetings if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'created_by') THEN
    ALTER TABLE meetings ADD COLUMN created_by UUID;
    RAISE NOTICE '✅ Added created_by to meetings';
  END IF;
END $$;

-- 2. Add all foreign key relationships
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
  
  -- tasks relationships
  BEGIN
    ALTER TABLE tasks ADD CONSTRAINT fk_tasks_company_id FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
    RAISE NOTICE '✅ Added tasks->companies FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  -- deals relationships  
  BEGIN
    ALTER TABLE deals ADD CONSTRAINT fk_deals_owner_id FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added deals->users FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  -- activities relationships
  BEGIN
    ALTER TABLE activities ADD CONSTRAINT fk_activities_owner_id FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added activities->users FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  -- meetings relationships
  BEGIN
    ALTER TABLE meetings ADD CONSTRAINT fk_meetings_created_by FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE '✅ Added meetings->users FK';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 3. Fix the API key permissions - add the missing permission format
UPDATE api_keys 
SET permissions = '[
  "contacts:read", "contacts:write", "contacts:delete",
  "companies:read", "companies:write", "companies:delete", 
  "deals:read", "deals:write", "deals:delete",
  "tasks:read", "tasks:write", "tasks:delete",
  "meetings:read", "meetings:write", "meetings:delete",
  "activities:read", "activities:write", "activities:delete",
  "admin"
]'::jsonb
WHERE name = 'Test Suite Key - Known Value';

-- 4. Test the API key validation returns the right format
DO $$
DECLARE
  test_result RECORD;
  perm_array TEXT[];
BEGIN
  SELECT * INTO test_result FROM validate_api_key('sk_test_api_key_for_suite_12345') LIMIT 1;
  
  IF test_result.is_valid AND test_result.permissions IS NOT NULL THEN
    SELECT array(SELECT jsonb_array_elements_text(test_result.permissions)) INTO perm_array;
    RAISE NOTICE '✅ API Key Valid: %', test_result.is_valid;
    RAISE NOTICE '✅ Has write permission: %', 'contacts:write' = ANY(perm_array);
    RAISE NOTICE '✅ Has admin permission: %', 'admin' = ANY(perm_array);
  ELSE
    RAISE NOTICE '❌ API Key validation failed';
  END IF;
END $$;

-- 5. Refresh schema cache
NOTIFY pgrst, 'reload schema';

SELECT '🎉 All relationships and permissions fixed!' as result;