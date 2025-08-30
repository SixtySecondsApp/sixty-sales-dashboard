-- Quick database status check

-- 1. Check if contacts table has company_id column now
SELECT 
  '=== CONTACTS COLUMNS ===' as section,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'contacts' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check foreign key relationships
SELECT 
  '=== FOREIGN KEY RELATIONSHIPS ===' as section,
  tc.table_name as from_table,
  kcu.column_name as from_column, 
  ccu.table_name as to_table,
  ccu.column_name as to_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'contacts';

-- 3. Test the API key is still working
SELECT 
  '=== API KEY TEST ===' as section,
  is_valid,
  user_id IS NOT NULL as has_user_id
FROM validate_api_key('sk_test_api_key_for_suite_12345');

SELECT '✅ Database status check complete!' as result;