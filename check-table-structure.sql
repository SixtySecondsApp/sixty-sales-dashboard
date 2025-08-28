-- Check actual table structures to understand what columns exist

-- 1. Show all columns in contacts table
SELECT 
  '=== CONTACTS TABLE - ALL COLUMNS ===' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'contacts' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Show all columns in companies table  
SELECT 
  '=== COMPANIES TABLE - ALL COLUMNS ===' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'companies' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Show all columns in deals table
SELECT 
  '=== DEALS TABLE - ALL COLUMNS ===' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'deals' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Show all columns in tasks table
SELECT 
  '=== TASKS TABLE - ALL COLUMNS ===' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'tasks' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Show all columns in meetings table
SELECT 
  '=== MEETINGS TABLE - ALL COLUMNS ===' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'meetings' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 6. Show all columns in activities table
SELECT 
  '=== ACTIVITIES TABLE - ALL COLUMNS ===' as section,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'activities' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT '🔍 Table structure analysis complete!' as result;