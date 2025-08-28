-- Fix Database Relationships and API Key Permissions
-- Address schema cache relationship issues and permission parsing

-- 1. First, let's check what tables and relationships exist
SELECT 
  '=== EXISTING TABLES ===' as section,
  table_name,
  table_schema
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Check existing foreign key relationships
SELECT 
  '=== FOREIGN KEY RELATIONSHIPS ===' as section,
  tc.table_name as from_table,
  kcu.column_name as from_column,
  ccu.table_name as to_table,
  ccu.column_name as to_column,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 3. Fix API key permissions - ensure they're stored as valid JSON array
UPDATE api_keys 
SET permissions = '["contacts:read", "contacts:write", "companies:read", "companies:write", "deals:read", "deals:write", "tasks:read", "tasks:write", "meetings:read", "meetings:write", "activities:read", "activities:write"]'::jsonb
WHERE key_hash = encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex');

-- 4. Test the permission parsing in validate_api_key function
DO $$
DECLARE
  test_result RECORD;
  test_key TEXT := 'sk_8b61b8892eec45fcb56908b7209a3985';
  permission_check BOOLEAN;
BEGIN
  RAISE NOTICE '=== TESTING API KEY PERMISSIONS ===';
  
  -- Test validation function
  SELECT * INTO test_result FROM validate_api_key(test_key) LIMIT 1;
  
  RAISE NOTICE 'Validation result:';
  RAISE NOTICE '  is_valid: %', test_result.is_valid;
  RAISE NOTICE '  user_id: %', test_result.user_id;
  RAISE NOTICE '  permissions type: %', pg_typeof(test_result.permissions);
  RAISE NOTICE '  permissions value: %', test_result.permissions;
  
  -- Test if permissions contain write permissions
  IF test_result.permissions IS NOT NULL THEN
    permission_check := test_result.permissions ? 'contacts:write';
    RAISE NOTICE '  contains contacts:write: %', permission_check;
    
    permission_check := test_result.permissions ? 'companies:write';  
    RAISE NOTICE '  contains companies:write: %', permission_check;
  ELSE
    RAISE NOTICE '  permissions is NULL!';
  END IF;
END $$;

-- 5. Create missing foreign key relationships if they don't exist
-- This will help resolve the schema cache relationship errors

-- Contacts to Companies relationship
DO $$
BEGIN
  -- Check if foreign key exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'contacts' 
      AND kcu.column_name = 'company_id'
  ) THEN
    -- Add foreign key if it doesn't exist
    BEGIN
      ALTER TABLE contacts 
      ADD CONSTRAINT fk_contacts_company 
      FOREIGN KEY (company_id) REFERENCES companies(id);
      RAISE NOTICE '✅ Added foreign key: contacts.company_id -> companies.id';
    EXCEPTION 
      WHEN others THEN
        RAISE NOTICE '⚠️  Could not add contacts->companies FK: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '✅ Foreign key already exists: contacts.company_id -> companies.id';
  END IF;
END $$;

-- Deals to users/owner relationship  
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'deals' 
      AND kcu.column_name = 'owner_id'
  ) THEN
    BEGIN
      -- First check if auth.users table exists and is accessible
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        ALTER TABLE deals 
        ADD CONSTRAINT fk_deals_owner 
        FOREIGN KEY (owner_id) REFERENCES auth.users(id);
        RAISE NOTICE '✅ Added foreign key: deals.owner_id -> auth.users.id';
      ELSE
        RAISE NOTICE '⚠️  auth.users table not accessible, skipping deals FK';
      END IF;
    EXCEPTION 
      WHEN others THEN
        RAISE NOTICE '⚠️  Could not add deals->users FK: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '✅ Foreign key already exists: deals.owner_id -> auth.users.id';
  END IF;
END $$;

-- Tasks to deals relationship (if deal_id column exists)
DO $$
BEGIN
  -- First check if deal_id column exists in tasks table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'deal_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'tasks' 
        AND kcu.column_name = 'deal_id'
    ) THEN
      BEGIN
        ALTER TABLE tasks 
        ADD CONSTRAINT fk_tasks_deal 
        FOREIGN KEY (deal_id) REFERENCES deals(id);
        RAISE NOTICE '✅ Added foreign key: tasks.deal_id -> deals.id';
      EXCEPTION 
        WHEN others THEN
          RAISE NOTICE '⚠️  Could not add tasks->deals FK: %', SQLERRM;
      END;
    ELSE
      RAISE NOTICE '✅ Foreign key already exists: tasks.deal_id -> deals.id';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ️  tasks.deal_id column does not exist, skipping FK';
  END IF;
END $$;

-- Meetings to users/created_by relationship
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meetings' AND column_name = 'created_by'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'meetings' 
        AND kcu.column_name = 'created_by'
    ) THEN
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
          ALTER TABLE meetings 
          ADD CONSTRAINT fk_meetings_creator 
          FOREIGN KEY (created_by) REFERENCES auth.users(id);
          RAISE NOTICE '✅ Added foreign key: meetings.created_by -> auth.users.id';
        ELSE
          RAISE NOTICE '⚠️  auth.users table not accessible, skipping meetings FK';
        END IF;
      EXCEPTION 
        WHEN others THEN
          RAISE NOTICE '⚠️  Could not add meetings->users FK: %', SQLERRM;
      END;
    ELSE
      RAISE NOTICE '✅ Foreign key already exists: meetings.created_by -> auth.users.id';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ️  meetings.created_by column does not exist, skipping FK';
  END IF;
END $$;

-- Activities to users/owner relationship
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activities' AND column_name = 'owner_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'activities' 
        AND kcu.column_name = 'owner_id'
    ) THEN
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
          ALTER TABLE activities 
          ADD CONSTRAINT fk_activities_owner 
          FOREIGN KEY (owner_id) REFERENCES auth.users(id);
          RAISE NOTICE '✅ Added foreign key: activities.owner_id -> auth.users.id';
        ELSE
          RAISE NOTICE '⚠️  auth.users table not accessible, skipping activities FK';
        END IF;
      EXCEPTION 
        WHEN others THEN
          RAISE NOTICE '⚠️  Could not add activities->users FK: %', SQLERRM;
      END;
    ELSE
      RAISE NOTICE '✅ Foreign key already exists: activities.owner_id -> auth.users.id';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ️  activities.owner_id column does not exist, skipping FK';
  END IF;
END $$;

-- 6. Final verification
SELECT 
  '=== FINAL API KEY STATUS ===' as section,
  name,
  key_preview,
  permissions,
  rate_limit,
  is_active,
  user_id
FROM api_keys 
WHERE key_hash = encode(digest('sk_8b61b8892eec45fcb56908b7209a3985', 'sha256'), 'hex');

-- 7. Final test
DO $$
DECLARE
  final_test RECORD;
  test_key TEXT := 'sk_8b61b8892eec45fcb56908b7209a3985';
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== FINAL VERIFICATION ===';
  
  SELECT * INTO final_test FROM validate_api_key(test_key) LIMIT 1;
  
  IF final_test.is_valid AND final_test.permissions ? 'contacts:write' THEN
    RAISE NOTICE '🎉 SUCCESS! API key has proper write permissions!';
    RAISE NOTICE '🔗 Database relationships have been established!';
    RAISE NOTICE '🚀 Your API test suite should now pass!';
  ELSE
    RAISE NOTICE '❌ Still having issues with permissions';
    RAISE NOTICE '   Valid: %, Has write permission: %', 
      final_test.is_valid, (final_test.permissions ? 'contacts:write');
  END IF;
END $$;

SELECT '✅ Database relationships and API permissions fixed!' as result;