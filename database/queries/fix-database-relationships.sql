-- Fix database relationships for CRUD API joins
-- The error "Could not find a relationship between 'contacts' and 'company_id'" means missing foreign keys

-- 1. Check what columns exist in each table
SELECT 
  '=== CONTACTS TABLE STRUCTURE ===' as section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'contacts' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 
  '=== COMPANIES TABLE STRUCTURE ===' as section,
  column_name,
  data_type,
  is_nullable  
FROM information_schema.columns 
WHERE table_name = 'companies' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check existing foreign keys
SELECT 
  '=== EXISTING FOREIGN KEY CONSTRAINTS ===' as section,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('contacts', 'companies', 'deals', 'tasks', 'meetings', 'activities');

-- 3. Add foreign key relationships that the CRUD endpoints expect

-- contacts.company_id -> companies.id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'company_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'id'
  ) THEN
    BEGIN
      ALTER TABLE contacts 
      ADD CONSTRAINT fk_contacts_company_id 
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
      
      RAISE NOTICE '✅ Added: contacts.company_id -> companies.id';
    EXCEPTION 
      WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  Already exists: contacts.company_id -> companies.id';
      WHEN others THEN
        RAISE NOTICE '⚠️  Error adding contacts->companies FK: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '⚠️  Missing columns for contacts.company_id -> companies.id relationship';
  END IF;
END $$;

-- deals.company_id -> companies.id (if deals has company_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'company_id'
  ) THEN
    BEGIN
      ALTER TABLE deals 
      ADD CONSTRAINT fk_deals_company_id 
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
      
      RAISE NOTICE '✅ Added: deals.company_id -> companies.id';
    EXCEPTION 
      WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  Already exists: deals.company_id -> companies.id';
      WHEN others THEN
        RAISE NOTICE '⚠️  Error adding deals->companies FK: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ℹ️  deals table has no company_id column';
  END IF;
END $$;

-- contacts.owner_id -> auth.users.id (if contacts has owner_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'owner_id'
  ) THEN
    BEGIN
      ALTER TABLE contacts 
      ADD CONSTRAINT fk_contacts_owner_id 
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
      
      RAISE NOTICE '✅ Added: contacts.owner_id -> auth.users.id';
    EXCEPTION 
      WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  Already exists: contacts.owner_id -> auth.users.id';
      WHEN others THEN
        RAISE NOTICE '⚠️  Error adding contacts->users FK: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ℹ️  contacts table has no owner_id column';
  END IF;
END $$;

-- deals.owner_id -> auth.users.id (if deals has owner_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'owner_id'
  ) THEN
    BEGIN
      ALTER TABLE deals 
      ADD CONSTRAINT fk_deals_owner_id 
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
      
      RAISE NOTICE '✅ Added: deals.owner_id -> auth.users.id';
    EXCEPTION 
      WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  Already exists: deals.owner_id -> auth.users.id';
      WHEN others THEN
        RAISE NOTICE '⚠️  Error adding deals->users FK: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ℹ️  deals table has no owner_id column';  
  END IF;
END $$;

-- activities.owner_id -> auth.users.id (if activities has owner_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activities' AND column_name = 'owner_id'
  ) THEN
    BEGIN
      ALTER TABLE activities 
      ADD CONSTRAINT fk_activities_owner_id 
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
      
      RAISE NOTICE '✅ Added: activities.owner_id -> auth.users.id';
    EXCEPTION 
      WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  Already exists: activities.owner_id -> auth.users.id';
      WHEN others THEN
        RAISE NOTICE '⚠️  Error adding activities->users FK: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ℹ️  activities table has no owner_id column';
  END IF;
END $$;

-- meetings.created_by -> auth.users.id (if meetings has created_by)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'meetings' AND column_name = 'created_by'
  ) THEN
    BEGIN
      ALTER TABLE meetings 
      ADD CONSTRAINT fk_meetings_created_by 
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
      
      RAISE NOTICE '✅ Added: meetings.created_by -> auth.users.id';
    EXCEPTION 
      WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  Already exists: meetings.created_by -> auth.users.id';
      WHEN others THEN
        RAISE NOTICE '⚠️  Error adding meetings->users FK: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ℹ️  meetings table has no created_by column';
  END IF;
END $$;

-- tasks.company_id -> companies.id (if tasks has company_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'company_id'
  ) THEN
    BEGIN
      ALTER TABLE tasks 
      ADD CONSTRAINT fk_tasks_company_id 
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
      
      RAISE NOTICE '✅ Added: tasks.company_id -> companies.id';
    EXCEPTION 
      WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  Already exists: tasks.company_id -> companies.id';
      WHEN others THEN
        RAISE NOTICE '⚠️  Error adding tasks->companies FK: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'ℹ️  tasks table has no company_id column';
  END IF;
END $$;

-- 4. Show final foreign key relationships
SELECT 
  '=== FINAL FOREIGN KEY RELATIONSHIPS ===' as section,
  tc.table_name as from_table,
  kcu.column_name as from_column,
  ccu.table_name as to_table,
  ccu.column_name as to_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('contacts', 'companies', 'deals', 'tasks', 'meetings', 'activities')
ORDER BY tc.table_name, kcu.column_name;

SELECT '🔗 Database relationships fixed!' as result;