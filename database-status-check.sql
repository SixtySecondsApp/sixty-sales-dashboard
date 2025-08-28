-- Comprehensive Database Status Check
-- Check current state after API key and relationship fixes

-- 1. Test API Key Validation Function
SELECT 
  '=== API KEY VALIDATION TEST ===' as test_section,
  is_valid,
  permissions,
  array_length(permissions, 1) as permission_count,
  'contacts:write' = ANY(permissions) as has_write_permission,
  'admin' = ANY(permissions) as has_admin_permission
FROM validate_api_key('{"key_text": "sk_test_api_key_for_suite_12345"}'::jsonb);

-- 2. Check API Keys Table Structure and Data
SELECT '=== API KEYS TABLE ===' as section;
SELECT 
  name,
  key_hash,
  key_preview,
  permissions,
  is_active,
  created_at
FROM api_keys 
WHERE name LIKE '%Test Suite%' OR name LIKE '%Known Value%';

-- 3. Check Table Relationships and Missing Columns
SELECT '=== TABLE STRUCTURE CHECK ===' as section;

-- Check contacts table columns
SELECT 
  'contacts' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'contacts' 
  AND column_name IN ('company_id', 'owner_id', 'full_name', 'title', 'linkedin_url', 'is_primary')
ORDER BY column_name;

-- Check companies table columns
SELECT 
  'companies' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'companies' 
  AND column_name IN ('website', 'industry', 'size')
ORDER BY column_name;

-- Check deals table columns
SELECT 
  'deals' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'deals' 
  AND column_name IN ('company_id', 'owner_id')
ORDER BY column_name;

-- Check tasks table columns
SELECT 
  'tasks' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'tasks' 
  AND column_name IN ('company_id', 'contact_id', 'owner_id')
ORDER BY column_name;

-- Check activities table columns  
SELECT 
  'activities' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'activities' 
  AND column_name IN ('owner_id', 'contact_id', 'company_id')
ORDER BY column_name;

-- Check meetings table columns
SELECT 
  'meetings' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'meetings' 
  AND column_name IN ('created_by', 'contact_id', 'company_id')
ORDER BY column_name;

-- 4. Check Foreign Key Constraints
SELECT '=== FOREIGN KEY CONSTRAINTS ===' as section;
SELECT 
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('contacts', 'companies', 'deals', 'tasks', 'activities', 'meetings')
ORDER BY tc.table_name, kcu.column_name;

-- 5. Check Sample Data
SELECT '=== SAMPLE DATA CHECK ===' as section;
SELECT 'contacts' as table_name, COUNT(*) as record_count FROM contacts
UNION ALL
SELECT 'companies' as table_name, COUNT(*) as record_count FROM companies  
UNION ALL
SELECT 'deals' as table_name, COUNT(*) as record_count FROM deals
UNION ALL
SELECT 'tasks' as table_name, COUNT(*) as record_count FROM tasks
UNION ALL
SELECT 'activities' as table_name, COUNT(*) as record_count FROM activities
UNION ALL
SELECT 'meetings' as table_name, COUNT(*) as record_count FROM meetings;

SELECT '✅ Database status check complete!' as result;