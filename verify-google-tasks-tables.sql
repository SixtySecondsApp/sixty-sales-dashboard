-- Check if the google_tasks_list_configs table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'google_tasks_list_configs'
) as table_exists;

-- If table exists, check its structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'google_tasks_list_configs'
ORDER BY ordinal_position;

-- Check if there are any existing configurations
SELECT COUNT(*) as config_count 
FROM google_tasks_list_configs;

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'google_tasks_list_configs';