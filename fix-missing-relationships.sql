-- Fix missing database relationships for API test suite

-- 1. Add missing columns if they don't exist

-- Add owner_id to activities table if missing
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'owner_id') THEN
    ALTER TABLE activities ADD COLUMN owner_id UUID;
    RAISE NOTICE 'Added owner_id column to activities table';
  END IF;
END $$;

-- Add created_by to meetings table if missing  
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'meetings' AND column_name = 'created_by') THEN
    ALTER TABLE meetings ADD COLUMN created_by UUID;
    RAISE NOTICE 'Added created_by column to meetings table';
  END IF;
END $$;

-- 2. Add foreign key relationships

-- Activities owner_id → profiles relationship
DO $$
BEGIN
  BEGIN
    ALTER TABLE activities 
    ADD CONSTRAINT fk_activities_owner_id 
    FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added activities owner_id foreign key';
  EXCEPTION 
    WHEN duplicate_object THEN 
      RAISE NOTICE 'Activities owner_id foreign key already exists';
  END;
END $$;

-- Meetings created_by → profiles relationship
DO $$
BEGIN
  BEGIN
    ALTER TABLE meetings 
    ADD CONSTRAINT fk_meetings_created_by 
    FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added meetings created_by foreign key';
  EXCEPTION 
    WHEN duplicate_object THEN 
      RAISE NOTICE 'Meetings created_by foreign key already exists';
  END;
END $$;

-- Companies to deals relationship (deals should already have company_id, but ensure foreign key exists)
DO $$
BEGIN
  BEGIN
    ALTER TABLE deals 
    ADD CONSTRAINT fk_deals_company_id 
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added deals company_id foreign key';
  EXCEPTION 
    WHEN duplicate_object THEN 
      RAISE NOTICE 'Deals company_id foreign key already exists';
  END;
END $$;

-- Deals owner_id → profiles relationship (should already exist but ensure)
DO $$
BEGIN
  BEGIN
    ALTER TABLE deals 
    ADD CONSTRAINT fk_deals_owner_id 
    FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added deals owner_id foreign key';
  EXCEPTION 
    WHEN duplicate_object THEN 
      RAISE NOTICE 'Deals owner_id foreign key already exists';
  END;
END $$;

-- 3. Set default values for existing records

-- Update existing activities with null owner_id to a default user
UPDATE activities 
SET owner_id = (SELECT id FROM profiles WHERE email LIKE '%sixtyseconds.video' LIMIT 1)
WHERE owner_id IS NULL;

-- Update existing meetings with null created_by to a default user  
UPDATE meetings
SET created_by = (SELECT id FROM profiles WHERE email LIKE '%sixtyseconds.video' LIMIT 1)
WHERE created_by IS NULL;

-- Show relationship verification
SELECT 'Database relationships fixed!' as status;

-- Verify foreign keys exist
SELECT 
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN ('activities', 'meetings', 'deals', 'companies')
ORDER BY tc.table_name, tc.constraint_name;