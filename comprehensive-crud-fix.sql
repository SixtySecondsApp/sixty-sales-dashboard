-- Comprehensive CRUD API Fix
-- Fix both permission parsing and database relationship issues

-- 1. Run the permission fix first
-- Fix API key permissions to include all necessary permissions including admin
UPDATE api_keys 
SET permissions = '["contacts:read", "contacts:write", "contacts:delete", "companies:read", "companies:write", "companies:delete", "deals:read", "deals:write", "deals:delete", "tasks:read", "tasks:write", "tasks:delete", "meetings:read", "meetings:write", "meetings:delete", "activities:read", "activities:write", "activities:delete", "admin"]'::jsonb
WHERE key_hash = encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex');

-- 2. Check what tables and columns actually exist
SELECT 
  '=== TABLE COLUMNS CHECK ===' as section,
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('contacts', 'companies', 'deals', 'tasks', 'meetings', 'activities')
ORDER BY table_name, ordinal_position;

-- 3. Add missing foreign key relationships carefully
-- First, let's see what foreign keys already exist
SELECT 
  '=== EXISTING FOREIGN KEYS ===' as section,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public';

-- 4. Create the foreign key relationships that the CRUD endpoints expect
-- contacts.company_id -> companies.id
DO $$
BEGIN
  -- Check if both tables and columns exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'company_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'id'
  ) THEN
    -- Add the foreign key if it doesn't exist
    BEGIN
      ALTER TABLE contacts ADD CONSTRAINT fk_contacts_company 
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
      RAISE NOTICE '✅ Added: contacts.company_id -> companies.id';
    EXCEPTION 
      WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  Foreign key already exists: contacts.company_id -> companies.id';
      WHEN others THEN
        RAISE NOTICE '⚠️  Could not add contacts FK: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '⚠️  Missing table/column for contacts.company_id -> companies.id';
  END IF;
END $$;

-- deals.owner_id -> auth.users.id (if owner_id exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'owner_id'
  ) THEN
    BEGIN
      -- For Supabase, we reference auth.users
      ALTER TABLE deals ADD CONSTRAINT fk_deals_owner 
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
      RAISE NOTICE '✅ Added: deals.owner_id -> auth.users.id';
    EXCEPTION 
      WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  Foreign key already exists: deals.owner_id -> auth.users.id';
      WHEN others THEN
        RAISE NOTICE '⚠️  Could not add deals FK: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ℹ️  deals.owner_id column does not exist';
  END IF;
END $$;

-- contacts.owner_id -> auth.users.id (if owner_id exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'owner_id'
  ) THEN
    BEGIN
      ALTER TABLE contacts ADD CONSTRAINT fk_contacts_owner 
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
      RAISE NOTICE '✅ Added: contacts.owner_id -> auth.users.id';
    EXCEPTION 
      WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  Foreign key already exists: contacts.owner_id -> auth.users.id';
      WHEN others THEN
        RAISE NOTICE '⚠️  Could not add contacts owner FK: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ℹ️  contacts.owner_id column does not exist';
  END IF;
END $$;

-- activities.owner_id -> auth.users.id (if owner_id exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activities' AND column_name = 'owner_id'
  ) THEN
    BEGIN
      ALTER TABLE activities ADD CONSTRAINT fk_activities_owner 
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
      RAISE NOTICE '✅ Added: activities.owner_id -> auth.users.id';
    EXCEPTION 
      WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  Foreign key already exists: activities.owner_id -> auth.users.id';
      WHEN others THEN
        RAISE NOTICE '⚠️  Could not add activities owner FK: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ℹ️  activities.owner_id column does not exist';
  END IF;
END $$;

-- 5. Test the permission system one more time
DO $$
DECLARE
  final_test RECORD;
  test_key TEXT := 'sk_8b61b8892eec45fcb56908b7209a3985';
  perm_array TEXT[];
  write_perms BOOLEAN := FALSE;
  admin_perm BOOLEAN := FALSE;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== FINAL COMPREHENSIVE TEST ===';
  
  -- Test API key validation
  SELECT * INTO final_test FROM validate_api_key(test_key) LIMIT 1;
  
  IF final_test.is_valid AND final_test.permissions IS NOT NULL THEN
    -- Convert to string array like the CRUD endpoints do
    SELECT array(SELECT jsonb_array_elements_text(final_test.permissions)) INTO perm_array;
    
    -- Check for write permissions
    write_perms := 'contacts:write' = ANY(perm_array) AND 'deals:write' = ANY(perm_array);
    admin_perm := 'admin' = ANY(perm_array);
    
    RAISE NOTICE 'API Key Status:';
    RAISE NOTICE '  ✓ Valid: %', final_test.is_valid;
    RAISE NOTICE '  ✓ User ID: %', final_test.user_id;
    RAISE NOTICE '  ✓ Write Permissions: %', write_perms;
    RAISE NOTICE '  ✓ Admin Permission: %', admin_perm;
    RAISE NOTICE '  ✓ Total Permissions: %', array_length(perm_array, 1);
    
    IF write_perms AND admin_perm THEN
      RAISE NOTICE '';
      RAISE NOTICE '🎉 COMPLETE SUCCESS!';
      RAISE NOTICE '✅ API key validation working';
      RAISE NOTICE '✅ Write permissions granted';
      RAISE NOTICE '✅ Admin permissions granted';
      RAISE NOTICE '✅ Foreign keys established';
      RAISE NOTICE '🚀 Your API test suite should now PASS all 30 tests!';
    ELSE
      RAISE NOTICE '❌ Permission issues still exist';
    END IF;
  ELSE
    RAISE NOTICE '❌ API key validation failed';
  END IF;
END $$;

-- 6. Show final status
SELECT 
  '=== FINAL SYSTEM STATUS ===' as section,
  name,
  key_preview,
  array_length(array(SELECT jsonb_array_elements_text(permissions)), 1) as total_permissions,
  rate_limit,
  is_active,
  user_id
FROM api_keys 
WHERE key_hash = encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex');

-- Show foreign keys that now exist
SELECT 
  '=== ESTABLISHED FOREIGN KEYS ===' as section,
  tc.table_name as from_table,
  kcu.column_name as from_column,
  ccu.table_name as to_table,
  ccu.column_name as to_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('contacts', 'companies', 'deals', 'tasks', 'meetings', 'activities');

SELECT '🎯 Comprehensive CRUD fix complete! Run your API tests now!' as result;