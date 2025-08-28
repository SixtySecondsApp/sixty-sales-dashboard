-- Add company_id column to contacts table if it doesn't exist
-- This will allow the CRUD endpoint to work with company relationships

DO $$
BEGIN
  -- Check if company_id column exists in contacts table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' 
      AND column_name = 'company_id'
      AND table_schema = 'public'
  ) THEN
    -- Add the company_id column
    ALTER TABLE contacts ADD COLUMN company_id UUID;
    
    -- Add foreign key constraint
    ALTER TABLE contacts 
    ADD CONSTRAINT fk_contacts_company_id 
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
    
    RAISE NOTICE '✅ Added company_id column and foreign key to contacts table';
  ELSE
    -- Column exists, just make sure foreign key exists
    BEGIN
      ALTER TABLE contacts 
      ADD CONSTRAINT fk_contacts_company_id 
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
      
      RAISE NOTICE '✅ Added foreign key constraint to existing company_id column';
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'ℹ️  Foreign key already exists for company_id';
    END;
  END IF;
  
  -- Refresh schema cache
  NOTIFY pgrst, 'reload schema';
  
END $$;

-- Verify the column and constraint exist
SELECT 
  '=== CONTACTS TABLE COMPANY_ID STATUS ===' as section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'contacts' 
  AND column_name = 'company_id'
  AND table_schema = 'public';

-- Test the relationship works
SELECT 
  '=== TESTING COMPANY RELATIONSHIP ===' as test,
  COUNT(*) as contact_count
FROM contacts c
LEFT JOIN companies co ON c.company_id = co.id;

SELECT '🏢 Company relationship should now work!' as result;