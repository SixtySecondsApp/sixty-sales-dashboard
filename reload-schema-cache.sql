-- Reload PostgREST Schema Cache
-- This forces Supabase to recognize the new tables

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

-- Verify the table exists and has correct permissions
SELECT 
  'Verifying google_task_mappings table:' as info,
  has_table_privilege('authenticated', 'google_task_mappings', 'SELECT') as can_select,
  has_table_privilege('authenticated', 'google_task_mappings', 'INSERT') as can_insert,
  has_table_privilege('authenticated', 'google_task_mappings', 'UPDATE') as can_update,
  has_table_privilege('authenticated', 'google_task_mappings', 'DELETE') as can_delete;

-- Check if RLS is enabled
SELECT 
  'RLS Status:' as info,
  relname as table_name,
  relrowsecurity as rls_enabled
FROM pg_class
WHERE relname = 'google_task_mappings';

-- Check current policies
SELECT 
  'Current Policies:' as info,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'google_task_mappings';

-- If needed, recreate the grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

SELECT 'Schema cache reload requested. Wait 5-10 seconds for it to take effect.' as message;