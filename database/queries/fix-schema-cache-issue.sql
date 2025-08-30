-- Fix schema cache issue for contacts/company_id relationship
-- This specific error suggests the foreign key constraint is missing

-- 1. Check if contacts table has company_id column
SELECT 
  '=== CONTACTS TABLE COMPANY_ID CHECK ===' as section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'contacts' 
  AND column_name = 'company_id'
  AND table_schema = 'public';

-- 2. Check if companies table exists and has id column
SELECT 
  '=== COMPANIES TABLE ID CHECK ===' as section,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'companies' 
  AND column_name = 'id'
  AND table_schema = 'public';

-- 3. Drop existing constraint if it exists (might be malformed)
DO $$
BEGIN
  -- Drop any existing constraints with similar names
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'contacts' 
      AND constraint_name LIKE '%company%'
      AND table_schema = 'public'
  ) THEN
    EXECUTE 'ALTER TABLE contacts DROP CONSTRAINT IF EXISTS fk_contacts_company_id CASCADE';
    EXECUTE 'ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_company_id_fkey CASCADE';
    EXECUTE 'ALTER TABLE contacts DROP CONSTRAINT IF EXISTS fk_contacts_company CASCADE';
    RAISE NOTICE '🗑️  Dropped existing constraints';
  END IF;
END $$;

-- 4. Add the foreign key constraint specifically for the schema cache
ALTER TABLE contacts 
ADD CONSTRAINT contacts_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

-- 5. Verify the constraint was created
SELECT 
  '=== FOREIGN KEY VERIFICATION ===' as section,
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'contacts' 
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'company_id';

-- 6. Refresh the schema cache (this forces Supabase to reload)
NOTIFY pgrst, 'reload schema';

-- 7. Test a simple query to verify the relationship works
SELECT 
  '=== TESTING JOIN QUERY ===' as test_section,
  COUNT(*) as contact_count
FROM contacts c
LEFT JOIN companies co ON c.company_id = co.id
LIMIT 1;

SELECT '🔄 Schema cache should now recognize the relationship!' as result;